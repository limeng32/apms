package com.ruoyi.framework.captcha;

import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.AffineTransform;
import java.awt.geom.Area;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.FastByteArrayOutputStream;
import com.ruoyi.common.constant.CacheConstants;
import com.ruoyi.common.constant.Constants;
import com.ruoyi.common.core.redis.RedisCache;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.uuid.IdUtils;

/**
 * 滑块拼图验证码（真人拖拽校验）
 *
 * <p>流程：
 * <ol>
 *   <li>{@link #createChallenge()} 生成随机背景+缺口+拼图块，答案（缺口 X 坐标）存 Redis，
 *       图片以 base64 返回前端，服务端不暴露答案；</li>
 *   <li>前端拖动拼图块对齐缺口后回传位移，{@link #verify} 在服务端判定误差，
 *       通过则下发一次性「通过标记」（{@link CacheConstants#SLIDER_PASS_KEY}）；</li>
 *   <li>登录时 {@code SysLoginService} 校验该标记，校验后立即删除，不可重放。</li>
 * </ol>
 *
 * <p>纯 JDK AWT 绘图，无第三方依赖；服务端以 {@code java.awt.headless=true} 运行
 * （Spring Boot 默认 headless，与现有 kaptcha 一致）。
 *
 * @author apms
 */
@Service
public class SliderCaptchaService {

    /** 背景画布尺寸（前端按实际显示宽度等比缩放后回传，服务端统一按此坐标判定） */
    public static final int WIDTH = 300;
    public static final int HEIGHT = 128;

    /** 拼图主体边长 / 凸起半径 / 允许误差（像素，画布坐标） */
    private static final int S = 40;
    private static final int R = 9;
    /** 拼图块图像四周留白：描边居中绘制，无留白时外半笔会被图像边界裁掉（底/侧边白线发虚） */
    private static final int PAD = 2;
    private static final int TOLERANCE = 5;

    /** 挑战答案有效期 2 分钟；通过标记有效期 3 分钟（仅用于紧接着的登录请求） */
    private static final int CHALLENGE_TTL_MIN = 2;
    private static final int PASS_TTL_MIN = 3;

    /** 人机判定：拖动时长下限（ms）与轨迹点数下限，过滤瞬移脚本 */
    private static final long MIN_DURATION_MS = 250;
    private static final int MIN_POINTS = 6;

    @Autowired
    private RedisCache redisCache;

    /** 一次挑战的前端展示数据 */
    public static class Challenge {
        private final String uuid;
        private final String bgImg;
        private final String pieceImg;
        /** 拼图块纵向位置（相对背景顶，画布坐标） */
        private final int pieceY;

        public Challenge(String uuid, String bgImg, String pieceImg, int pieceY) {
            this.uuid = uuid;
            this.bgImg = bgImg;
            this.pieceImg = pieceImg;
            this.pieceY = pieceY;
        }
        public String getUuid() { return uuid; }
        public String getBgImg() { return bgImg; }
        public String getPieceImg() { return pieceImg; }
        public int getPieceY() { return pieceY; }
        public int getWidth() { return WIDTH; }
        public int getHeight() { return HEIGHT; }
    }

    /**
     * 生成一次滑块挑战
     */
    public Challenge createChallenge() {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        // 缺口位置：X 落在右半区（保证拖动距离），Y 避开上下边缘；含凸起的边界都要在画布内
        int targetX = rnd.nextInt(WIDTH / 2 - 10, WIDTH - S - R - 10);
        int targetY = rnd.nextInt(R + 4, HEIGHT - S - 2);

        Shape shape = pieceShape();
        BufferedImage bg = paintBackground(rnd);

        // 拼图块：必须先从「未压暗」的干净背景抠出，再画缺口，否则抠到的是缺口黑影。
        // 画布四周留 PAD 像素，保证 2px 描边的外半笔不被图像边界裁掉（底部白线清晰）。
        int pieceSize = S + R + PAD * 2;
        BufferedImage piece = new BufferedImage(pieceSize, pieceSize, BufferedImage.TYPE_INT_ARGB);
        Graphics2D pg = piece.createGraphics();
        try {
            // 块内图形整体偏移 (PAD, R+PAD)：顶部凸起与四周边缘都落在留白之内
            Shape pieceInImg = AffineTransform.getTranslateInstance(PAD, R + PAD).createTransformedShape(shape);
            pg.setClip(pieceInImg);
            // 背景 (targetX,targetY) 映射到块内 (PAD,R+PAD)
            pg.drawImage(bg, PAD - targetX, R + PAD - targetY, null);
            pg.setClip(null);
            pg.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            pg.setColor(new Color(255, 255, 255, 245));
            pg.setStroke(new BasicStroke(2.0f));
            pg.draw(pieceInImg);
        } finally {
            pg.dispose();
        }

        // 干净背景抠块完成后，再在背景上挖缺口：暗色压暗 + 白色描边
        Graphics2D g = bg.createGraphics();
        try {
            Shape gap = AffineTransform.getTranslateInstance(targetX, targetY).createTransformedShape(shape);
            g.setComposite(AlphaComposite.SrcOver.derive(0.42f));
            g.setColor(new Color(20, 28, 44));
            g.fill(gap);
            g.setComposite(AlphaComposite.SrcOver.derive(0.85f));
            g.setColor(Color.WHITE);
            g.setStroke(new BasicStroke(1.4f));
            g.draw(gap);
        } finally {
            g.dispose();
        }

        String uuid = IdUtils.simpleUUID();
        redisCache.setCacheObject(CacheConstants.SLIDER_CAPTCHA_KEY + uuid,
                Integer.valueOf(targetX), CHALLENGE_TTL_MIN, TimeUnit.MINUTES);

        return new Challenge(uuid,
                "data:image/jpeg;base64," + encodeJpeg(bg),
                "data:image/png;base64," + encodePng(piece),
                targetY - R - PAD);
    }

    /**
     * 校验拖拽结果；通过则写入一次性通过标记。
     *
     * @param uuid       挑战标识
     * @param x          拼图块左沿位移（画布坐标，前端已按显示比例换算）
     * @param durationMs 拖拽耗时（ms）
     * @param points     轨迹点数
     */
    public void verify(String uuid, Integer x, Long durationMs, Integer points) {
        if (uuid == null || uuid.isEmpty() || x == null) {
            throw new ServiceException("验证数据不完整，请重新拖动验证");
        }
        String key = CacheConstants.SLIDER_CAPTCHA_KEY + uuid;
        Integer target = redisCache.getCacheObject(key);
        if (target == null) {
            throw new ServiceException("验证已失效，请刷新后重试");
        }
        // 无论成败，挑战一次性消费（失败前端需重新获取）
        redisCache.deleteObject(key);

        if (durationMs != null && durationMs < MIN_DURATION_MS) {
            throw new ServiceException("拖动速度异常，请按住滑块平稳拖动");
        }
        if (points != null && points < MIN_POINTS) {
            throw new ServiceException("请按住滑块拖动到缺口处完成验证");
        }
        if (Math.abs(x - target.intValue()) > TOLERANCE) {
            throw new ServiceException("拼图未对齐缺口，请重试");
        }
        redisCache.setCacheObject(CacheConstants.SLIDER_PASS_KEY + uuid,
                Boolean.TRUE, PASS_TTL_MIN, TimeUnit.MINUTES);
    }

    /**
     * 登录时消费通过标记（存在即合法，消费后立即删除，不可重放）
     *
     * @return true=已通过真人验证
     */
    public boolean consumePass(String uuid) {
        if (uuid == null || uuid.isEmpty()) {
            return false;
        }
        String key = CacheConstants.SLIDER_PASS_KEY + uuid;
        Boolean pass = redisCache.getCacheObject(key);
        if (Boolean.TRUE.equals(pass)) {
            redisCache.deleteObject(key);
            return true;
        }
        return false;
    }

    /* ========================== 绘图 ========================== */

    /** 拼图形状：圆角方块 + 顶部凸起 + 右侧凸起（包围盒 S+R × S+R，原点上方有 R 的凸起） */
    private Shape pieceShape() {
        Area a = new Area(new RoundRectangle2D.Float(0, 0, S, S, 9, 9));
        a.add(new Area(new Ellipse2D.Float(S / 2f - R, -R, 2f * R, 2f * R)));
        a.add(new Area(new Ellipse2D.Float(S - R, S / 2f - R, 2f * R, 2f * R)));
        return a;
    }

    /** 随机运动风背景：双色渐变 + 半透明几何 + 噪点，保证每张挑战图都不同，增加识别难度 */
    private BufferedImage paintBackground(ThreadLocalRandom rnd) {
        // 运动科技色系（与登录页青蓝调协调）
        Color[][] palettes = {
            { new Color(30, 64, 120), new Color(14, 165, 180) },
            { new Color(20, 82, 110), new Color(34, 197, 160) },
            { new Color(36, 52, 92), new Color(68, 120, 220) },
            { new Color(18, 78, 96), new Color(44, 160, 200) }
        };
        Color[] pal = palettes[rnd.nextInt(palettes.length)];

        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.setPaint(new GradientPaint(0, 0, pal[0], WIDTH, HEIGHT, pal[1]));
        g.fillRect(0, 0, WIDTH, HEIGHT);

        // 半透明圆形光斑
        for (int i = 0; i < 12; i++) {
            int d = rnd.nextInt(20, 72);
            int cx = rnd.nextInt(0, WIDTH);
            int cy = rnd.nextInt(0, HEIGHT);
            g.setComposite(AlphaComposite.SrcOver.derive(rnd.nextFloat(0.06f, 0.18f)));
            g.setColor(Color.WHITE);
            g.fillOval(cx - d / 2, cy - d / 2, d, d);
        }
        // 细斜线/折线，增加图像纹理
        g.setComposite(AlphaComposite.SrcOver.derive(0.10f));
        g.setColor(Color.WHITE);
        g.setStroke(new BasicStroke(1.2f));
        for (int i = 0; i < 7; i++) {
            int x1 = rnd.nextInt(0, WIDTH);
            int y1 = rnd.nextInt(0, HEIGHT);
            g.drawLine(x1, y1, x1 + rnd.nextInt(-60, 60), y1 + rnd.nextInt(-40, 40));
        }
        // 像素噪点
        for (int i = 0; i < 1400; i++) {
            int v = rnd.nextInt(180, 256);
            g.setComposite(AlphaComposite.SrcOver.derive(rnd.nextFloat(0.03f, 0.10f)));
            g.setColor(new Color(v, v, v));
            g.fillRect(rnd.nextInt(WIDTH), rnd.nextInt(HEIGHT), 1, 1);
        }
        g.setComposite(AlphaComposite.SrcOver);
        g.dispose();
        return img;
    }

    private String encodeJpeg(BufferedImage img) {
        FastByteArrayOutputStream os = new FastByteArrayOutputStream();
        try {
            ImageIO.write(img, "jpg", os);
        } catch (IOException e) {
            throw new ServiceException("验证码生成失败");
        }
        return Base64.getEncoder().encodeToString(os.toByteArray());
    }

    private String encodePng(BufferedImage img) {
        ByteArrayOutputStream os = new ByteArrayOutputStream();
        try {
            ImageIO.write(img, "png", os);
        } catch (IOException e) {
            throw new ServiceException("验证码生成失败");
        }
        return Base64.getEncoder().encodeToString(os.toByteArray());
    }
}
