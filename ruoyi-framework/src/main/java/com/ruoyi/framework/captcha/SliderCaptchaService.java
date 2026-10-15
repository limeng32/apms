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

    /** 背景画布逻辑尺寸（前端按实际显示宽度等比缩放后回传，服务端统一按此坐标判定） */
    public static final int WIDTH = 300;
    public static final int HEIGHT = 128;

    /**
     * 超采样倍数：先按 2× 物理像素绘制再降采样回逻辑尺寸，
     * 在 Retina 等高分屏上拼图块/缺口边缘清晰不糊。判定坐标仍用逻辑尺寸。
     */
    private static final int SS = 2;

    /** 拼图主体边长 / 凸起半径 / 允许误差（像素，画布坐标） */
    private static final int S = 40;
    private static final int R = 9;
    /** 拼图块图像四周留白：描边居中绘制，无留白时外半笔会被图像边界裁掉（底/侧边白线发虚） */
    private static final int PAD = 2;
    /**
     * 对齐容差。背景经 JPEG 压缩缺口边缘有约 1px 晕染，加上移动端分数缩放四舍五入，
     * 5px 在临界位置会误判；放宽到 6px（300 宽画布下随机盲猜命中率约 8%，仍具人机区分度）。
     */
    private static final int TOLERANCE = 6;

    /** 挑战答案有效期 2 分钟；通过标记有效期 3 分钟（仅用于紧接着的登录请求） */
    private static final int CHALLENGE_TTL_MIN = 2;
    private static final int PASS_TTL_MIN = 3;

    /**
     * 真人判定（放宽到不误伤正常用户，瞬移脚本仍可拦）：
     * 拖动时长下限 120ms——正常人拖 150px 用 120~400ms，旧值 250ms 会误伤干脆的用户；
     * 轨迹点下限 3——部分触摸板/高分屏 pointermove 触发稀疏，旧值 6 会误判为未拖到位。
     */
    private static final long MIN_DURATION_MS = 120;
    private static final int MIN_POINTS = 3;

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
     *
     * <p>全程在 {@link #SS} 倍超采样缓冲上绘制，最后用双线性插值降采样到逻辑尺寸，
     * 使高分屏（Retina，物理像素约 2×）下拼图块和缺口边缘都清晰、无放大模糊；
     * 判定坐标/前端缩放仍统一用逻辑尺寸 {@link #WIDTH}×{@link #HEIGHT}。
     */
    public Challenge createChallenge() {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        // 缺口位置：X 落在右半区（保证拖动距离），Y 避开上下边缘；含凸起的边界都要在画布内
        int targetX = rnd.nextInt(WIDTH / 2 - 10, WIDTH - S - R - 10);
        int targetY = rnd.nextInt(R + 4, HEIGHT - S - 2);

        Shape shape = pieceShape();
        // 高分缓冲：背景、块均按 SS 倍绘制，逻辑坐标统一乘以 SS
        int hw = WIDTH * SS, hh = HEIGHT * SS;
        int hs = S * SS, hr = R * SS, hpad = PAD * SS;
        AffineTransform toHi = AffineTransform.getScaleInstance(SS, SS);

        // 1) 高分背景（干净，未挖缺口）
        BufferedImage bg = new BufferedImage(hw, hh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = bg.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            paintBackgroundHi(g, rnd, hw, hh);
        } finally {
            g.dispose();
        }

        // 2) 拼图块：先从「未压暗」的干净高分背景抠出（否则抠到缺口黑影）
        int pieceSizeHi = hs + hr + hpad * 2;
        BufferedImage pieceHi = new BufferedImage(pieceSizeHi, pieceSizeHi, BufferedImage.TYPE_INT_ARGB);
        Graphics2D pg = pieceHi.createGraphics();
        try {
            pg.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            pg.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            pg.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            // 块内形状在高分坐标整体偏移 (hpad, hr+hpad)
            Shape pieceLogical = AffineTransform.getTranslateInstance(PAD, R + PAD).createTransformedShape(shape);
            Shape pieceInImg = toHi.createTransformedShape(pieceLogical);
            pg.setClip(pieceInImg);
            // 背景(targetX,targetY)映射到块内(hpad,hr+hpad)，高分坐标直接取高分背景
            pg.drawImage(bg, hpad - targetX * SS, hr + hpad - targetY * SS, null);
            pg.setClip(null);
            pg.setColor(new Color(255, 255, 255, 235));
            pg.setStroke(new BasicStroke(1.5f * SS));
            pg.draw(pieceInImg);
        } finally {
            pg.dispose();
        }

        // 3) 干净背景抠块完成后，再在高分背景上挖缺口
        Graphics2D gapG = bg.createGraphics();
        try {
            gapG.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            gapG.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            Shape gapHi = AffineTransform.getTranslateInstance(targetX * (double) SS, targetY * (double) SS)
                    .createTransformedShape(toHi.createTransformedShape(shape));
            gapG.setComposite(AlphaComposite.SrcOver.derive(0.38f));
            gapG.setColor(new Color(20, 28, 44));
            gapG.fill(gapHi);
            gapG.setComposite(AlphaComposite.SrcOver.derive(0.7f));
            gapG.setColor(Color.WHITE);
            gapG.setStroke(new BasicStroke(1.2f * SS));
            gapG.draw(gapHi);
        } finally {
            gapG.dispose();
        }

        // 4) 降采样到逻辑尺寸（高质量缩放）
        BufferedImage bgLo = downscale(bg, WIDTH, HEIGHT);
        int pieceLo = S + R + PAD * 2;
        BufferedImage piece = downscale(pieceHi, pieceLo, pieceLo);

        String uuid = IdUtils.simpleUUID();
        redisCache.setCacheObject(CacheConstants.SLIDER_CAPTCHA_KEY + uuid,
                Integer.valueOf(targetX), CHALLENGE_TTL_MIN, TimeUnit.MINUTES);

        return new Challenge(uuid,
                "data:image/jpeg;base64," + encodeJpeg(bgLo),
                "data:image/png;base64," + encodePng(piece),
                targetY - R - PAD);
    }

    /**
     * 双线性高质量降采样
     */
    private BufferedImage downscale(BufferedImage src, int w, int h) {
        BufferedImage dst = new BufferedImage(w, h,
                src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D d = dst.createGraphics();
        try {
            d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            d.drawImage(src, 0, 0, w, h, null);
        } finally {
            d.dispose();
        }
        return dst;
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
            throw new ServiceException("拖动太快啦，请按住滑块平稳地拖到缺口处");
        }
        if (points != null && points < MIN_POINTS) {
            throw new ServiceException("请按住滑块持续拖动，不要直接点跳");
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

    /**
     * 拼图形状：圆角方块 + 顶部凸起 + 右侧凸起（包围盒 (S+1)×(S+2)）。
     * 凸起圆心内收 1~2px 到主体内部，使圆与方块根部是平滑搭接而非 90° 硬肩，
     * 避免描边在根部出现锯齿状小缺口。
     */
    private Shape pieceShape() {
        Area a = new Area(new RoundRectangle2D.Float(0, 0, S, S, 9, 9));
        // 顶部凸起：圆心下移 2px，根部没入主体
        a.add(new Area(new Ellipse2D.Float(S / 2f - R, -R + 2, 2f * R, 2f * R)));
        // 右侧凸起：圆心左移 1px，根部没入主体（最右点仍被 PAD 留白覆盖：2+S+1+R=52 ≤ 53）
        a.add(new Area(new Ellipse2D.Float(S - R + 1, S / 2f - R, 2f * R, 2f * R)));
        return a;
    }

    /**
     * 随机运动风背景（直接绘制到调用方给定的高分 Graphics 上，尺寸 w×h 已是 SS 倍）。
     * 所有几何/线宽按 SS 放大；半透明渐变 + 光斑 + 纹理 + 噪点，保证每张挑战图都不同。
     */
    private void paintBackgroundHi(Graphics2D g, ThreadLocalRandom rnd, int w, int h) {
        // 运动科技色系（与登录页青蓝调协调）
        Color[][] palettes = {
            { new Color(30, 64, 120), new Color(14, 165, 180) },
            { new Color(20, 82, 110), new Color(34, 197, 160) },
            { new Color(36, 52, 92), new Color(68, 120, 220) },
            { new Color(18, 78, 96), new Color(44, 160, 200) }
        };
        Color[] pal = palettes[rnd.nextInt(palettes.length)];

        g.setPaint(new GradientPaint(0, 0, pal[0], w, h, pal[1]));
        g.fillRect(0, 0, w, h);

        // 半透明圆形光斑（直径/坐标按 SS 放大）
        for (int i = 0; i < 12; i++) {
            int d = rnd.nextInt(20, 72) * SS;
            int cx = rnd.nextInt(0, w);
            int cy = rnd.nextInt(0, h);
            g.setComposite(AlphaComposite.SrcOver.derive(rnd.nextFloat(0.06f, 0.18f)));
            g.setColor(Color.WHITE);
            g.fillOval(cx - d / 2, cy - d / 2, d, d);
        }
        // 细斜线/折线，增加图像纹理
        g.setComposite(AlphaComposite.SrcOver.derive(0.10f));
        g.setColor(Color.WHITE);
        g.setStroke(new BasicStroke(1.2f * SS));
        for (int i = 0; i < 7; i++) {
            int x1 = rnd.nextInt(0, w);
            int y1 = rnd.nextInt(0, h);
            g.drawLine(x1, y1, x1 + rnd.nextInt(-60, 60) * SS, y1 + rnd.nextInt(-40, 40) * SS);
        }
        // 物理像素噪点：数量按面积(SS²)倍增，降采样后形成细腻颗粒
        for (int i = 0; i < 1400 * SS * SS; i++) {
            int v = rnd.nextInt(180, 256);
            g.setComposite(AlphaComposite.SrcOver.derive(rnd.nextFloat(0.03f, 0.10f)));
            g.setColor(new Color(v, v, v));
            g.fillRect(rnd.nextInt(w), rnd.nextInt(h), 1, 1);
        }
        g.setComposite(AlphaComposite.SrcOver);
    }

    /**
     * 背景以高质量 JPEG 编码：缺口白边与高对比描边在默认(~0.75)质量下会产生振铃/晕染，
     * 视觉上就是一圈粗糙白毛边；0.9 质量体积仍很小（300×128，约 15~25KB），边缘干净。
     */
    private String encodeJpeg(BufferedImage img) {
        FastByteArrayOutputStream os = new FastByteArrayOutputStream();
        try {
            javax.imageio.ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
            javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.9f);
            try (javax.imageio.stream.ImageOutputStream ios = ImageIO.createImageOutputStream(os)) {
                writer.setOutput(ios);
                writer.write(null, new javax.imageio.IIOImage(img, null, null), param);
            } finally {
                writer.dispose();
            }
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
