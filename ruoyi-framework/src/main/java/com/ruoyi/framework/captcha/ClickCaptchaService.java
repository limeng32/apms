package com.ruoyi.framework.captcha;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.GradientPaint;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.FastByteArrayOutputStream;
import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONObject;
import com.ruoyi.common.constant.CacheConstants;
import com.ruoyi.common.core.redis.RedisCache;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.common.utils.uuid.IdUtils;

/**
 * 彩色图形点选验证码（无动画，低端机友好）
 *
 * <p>流程：
 * <ol>
 *   <li>{@link #createChallenge()} 在浅色画布上绘制 5 个「形状+颜色」互不重复的图形，
 *       随机抽取 3 个作为按顺序点击的目标；答案（图形中心坐标）存 Redis，
 *       前端只拿到图形的形状/颜色文案，不拿坐标；</li>
 *   <li>用户按提示顺序点击 3 个图形，{@link #verify} 在服务端逐点判定与目标中心的距离，
 *       通过则下发一次性「通过标记」（{@link CacheConstants#CAPTCHA_PASS_KEY}）；</li>
 *   <li>登录/发短信时由业务服务 {@link #consumePass(String)} 消费，校验后立即删除，不可重放。</li>
 * </ol>
 *
 * <p>纯 JDK AWT 几何绘图，无第三方依赖、不依赖服务器中文字体（提示文案在前端拼接）；
 * 前端仅展示一张静态 JPEG 并采集点击坐标，没有拖拽/动画，低端手机无渲染与性能负担。
 *
 * @author apms

 */
@Service
public class ClickCaptchaService
{
    /** 背景画布逻辑尺寸（前端按显示比例换算后回传，服务端统一按此坐标判定） */
    public static final int WIDTH = 300;
    public static final int HEIGHT = 190;

    /** 图形外接边长；点击判定半径（图形直径约 48px，容差略大于半径以贴合手指触击面） */
    private static final int SHAPE_SIZE = 48;
    private static final int TOLERANCE = 30;

    /** 图形总数 / 需按序点击的目标数 */
    private static final int SHAPE_COUNT = 5;
    private static final int TARGET_COUNT = 3;

    /**
     * 5 个图形的锚点槽位（300×190 画布）：任意两槽距离 ≥ 88px，
     * 叠加 ±8/±6 抖动后仍 ≥ 72px（大于图形外接直径 ~60px），数学上保证不重叠。
     * 不做「随机投放+拒绝重试」：随机序列吸附在约 3% 的题面上会耗尽重试并留下重叠坐标。
     */
    private static final int[][] SLOTS = {
            { 58, 52 }, { 150, 42 }, { 244, 58 }, { 104, 142 }, { 206, 138 }
    };
    private static final int JITTER_X = 8;
    private static final int JITTER_Y = 6;

    /** 挑战答案有效期 2 分钟；通过标记有效期 3 分钟（仅用于紧接着的登录/发码请求） */
    private static final int CHALLENGE_TTL_MIN = 2;
    private static final int PASS_TTL_MIN = 3;

    /** 形状枚举（与前端 shape key 一一对应） */
    private static final String[] SHAPE_KEYS = { "circle", "square", "triangle", "star", "diamond" };
    /** 颜色枚举（与前端 color key 一一对应；值为绘制用 RGB） */
    private static final String[] COLOR_KEYS = { "red", "blue", "yellow", "green", "purple" };
    private static final Color[] COLORS = {
            new Color(0xE5, 0x39, 0x35),  // red
            new Color(0x1E, 0x88, 0xE5),  // blue
            new Color(0xF9, 0xA8, 0x25),  // yellow
            new Color(0x43, 0xA0, 0x47),  // green
            new Color(0x8E, 0x24, 0xAA)   // purple
    };

    @Autowired
    private RedisCache redisCache;

    /** 单个图形（答案项） */
    public static class Target
    {
        /** 形状 key（circle/square/triangle/star/diamond） */
        public String shape;
        /** 颜色 key（red/blue/yellow/green/purple） */
        public String color;
        /** 图形中心画布坐标 */
        public int x;
        public int y;

        public Target() {}

        public Target(String shape, String color, int x, int y)
        {
            this.shape = shape;
            this.color = color;
            this.x = x;
            this.y = y;
        }
    }

    /** 一次挑战的前端展示数据（坐标不下发） */
    public static class Challenge
    {
        private final String uuid;
        private final String img;
        /** 需按顺序点击的目标（仅形状/颜色文案） */
        private final List<Target> prompts;

        public Challenge(String uuid, String img, List<Target> prompts)
        {
            this.uuid = uuid;
            this.img = img;
            this.prompts = prompts;
        }
        public String getUuid() { return uuid; }
        public String getImg() { return img; }
        public List<Target> getPrompts() { return prompts; }
        public int getWidth() { return WIDTH; }
        public int getHeight() { return HEIGHT; }
    }

    /**
     * 生成一次点选挑战：5 个形状固定、颜色做随机双射配对（形状/颜色各自唯一 → 文案无歧义），
     * 位置随机且互不重叠，整体随机小角度旋转增加脚本识别成本。
     */
    public Challenge createChallenge()
    {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();

        // 颜色索引做一次洗牌，与形状索引形成随机双射
        List<Integer> colorIdx = new ArrayList<>();
        for (int i = 0; i < SHAPE_COUNT; i++)
        {
            colorIdx.add(i);
        }
        Collections.shuffle(colorIdx);

        // 槽位洗牌 + 小抖动：形状落到哪个槽随机，位置在槽点附近随机且保证不重叠
        List<Integer> slotOrder = new ArrayList<>();
        for (int i = 0; i < SHAPE_COUNT; i++)
        {
            slotOrder.add(i);
        }
        Collections.shuffle(slotOrder);
        int[] cx = new int[SHAPE_COUNT];
        int[] cy = new int[SHAPE_COUNT];
        for (int i = 0; i < SHAPE_COUNT; i++)
        {
            int[] slot = SLOTS[slotOrder.get(i)];
            cx[i] = Math.max(34, Math.min(WIDTH - 34, slot[0] + rnd.nextInt(-JITTER_X, JITTER_X + 1)));
            cy[i] = Math.max(36, Math.min(HEIGHT - 30, slot[1] + rnd.nextInt(-JITTER_Y, JITTER_Y + 1)));
        }

        List<Target> all = new ArrayList<>(SHAPE_COUNT);
        BufferedImage img = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try
        {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
            paintBackground(g);
            for (int i = 0; i < SHAPE_COUNT; i++)
            {
                int ci = colorIdx.get(i);
                all.add(new Target(SHAPE_KEYS[i], COLOR_KEYS[ci], cx[i], cy[i]));
                double theta = Math.toRadians(rnd.nextInt(-25, 26));
                drawShape(g, i, COLORS[ci], cx[i], cy[i], theta);
            }
        }
        finally
        {
            g.dispose();
        }

        // 从 5 个图形中随机抽 3 个并随机顺序作为点击目标
        List<Integer> pick = new ArrayList<>();
        for (int i = 0; i < SHAPE_COUNT; i++)
        {
            pick.add(i);
        }
        Collections.shuffle(pick);
        List<Target> ordered = new ArrayList<>(TARGET_COUNT);
        List<Target> prompts = new ArrayList<>(TARGET_COUNT);
        for (int i = 0; i < TARGET_COUNT; i++)
        {
            Target t = all.get(pick.get(i));
            ordered.add(t);
            // 提示项只含形状/颜色，不含坐标
            prompts.add(new Target(t.shape, t.color, 0, 0));
        }

        String uuid = IdUtils.simpleUUID();
        redisCache.setCacheObject(CacheConstants.CLICK_CAPTCHA_KEY + uuid,
                JSON.toJSONString(ordered), CHALLENGE_TTL_MIN, TimeUnit.MINUTES);

        return new Challenge(uuid, "data:image/jpeg;base64," + encodeJpeg(img), prompts);
    }

    /**
     * 校验点选结果；通过则写入一次性通过标记。
     * 无论成败挑战一次性消费（失败前端需重新获取新题，防止同题枚举坐标）。
     *
     * @param uuid   挑战标识
     * @param points 前端按点击顺序回传的画布坐标点（须恰好 3 个）
     */
    public void verify(String uuid, List<int[]> points)
    {
        if (uuid == null || uuid.isEmpty() || points == null || points.size() != TARGET_COUNT)
        {
            throw new ServiceException("请按提示依次点击 " + TARGET_COUNT + " 个图形");
        }
        for (int[] p : points)
        {
            if (p == null || p.length < 2)
            {
                throw new ServiceException("点击数据不完整，请重新验证");
            }
        }

        String key = CacheConstants.CLICK_CAPTCHA_KEY + uuid;
        String json = redisCache.getCacheObject(key);
        if (json == null)
        {
            throw new ServiceException("验证已失效，请刷新后重试");
        }
        // 一次性消费
        redisCache.deleteObject(key);

        List<JSONObject> targets = JSON.parseArray(json).toJavaList(JSONObject.class);
        for (int i = 0; i < TARGET_COUNT; i++)
        {
            JSONObject t = targets.get(i);
            int tx = t.getIntValue("x");
            int ty = t.getIntValue("y");
            int dx = points.get(i)[0] - tx;
            int dy = points.get(i)[1] - ty;
            if (Math.hypot(dx, dy) > TOLERANCE)
            {
                throw new ServiceException("点击顺序或位置不正确，请换一张重试");
            }
        }
        redisCache.setCacheObject(CacheConstants.CAPTCHA_PASS_KEY + uuid,
                Boolean.TRUE, PASS_TTL_MIN, TimeUnit.MINUTES);
    }

    /**
     * 登录/发码时消费通过标记（存在即合法，消费后立即删除，不可重放）
     *
     * @return true=已通过人机验证
     */
    public boolean consumePass(String uuid)
    {
        if (uuid == null || uuid.isEmpty())
        {
            return false;
        }
        String key = CacheConstants.CAPTCHA_PASS_KEY + uuid;
        Boolean pass = redisCache.getCacheObject(key);
        if (Boolean.TRUE.equals(pass))
        {
            redisCache.deleteObject(key);
            return true;
        }
        return false;
    }

    /* ========================== 绘图 ========================== */

    /** 浅色背景：冷白渐变 + 极淡光斑/斜线/噪点，保证彩色图形对比度且每张图纹理不同 */
    private void paintBackground(Graphics2D g)
    {
        ThreadLocalRandom rnd = ThreadLocalRandom.current();
        g.setPaint(new GradientPaint(0, 0, new Color(0xF8, 0xFA, 0xFC), WIDTH, HEIGHT, new Color(0xDD, 0xE6, 0xF0)));
        g.fillRect(0, 0, WIDTH, HEIGHT);

        // 注意：AWT 没有 (int,int,int,float) 构造，(int,int,int,float) 会被提升为
        // float 色域构造（RGB 须在 0~1）而抛异常；半透明黑色统一用 4-int（alpha 0~255）
        for (int i = 0; i < 10; i++)
        {
            int d = rnd.nextInt(24, 64);
            int x = rnd.nextInt(0, WIDTH);
            int y = rnd.nextInt(0, HEIGHT);
            g.setColor(new Color(0, 0, 0, rnd.nextInt(3)));
            g.fillOval(x - d / 2, y - d / 2, d, d);
        }
        g.setColor(new Color(0, 0, 0, 13));
        g.setStroke(new BasicStroke(1f));
        for (int i = 0; i < 6; i++)
        {
            int x1 = rnd.nextInt(0, WIDTH);
            int y1 = rnd.nextInt(0, HEIGHT);
            g.drawLine(x1, y1, x1 + rnd.nextInt(-60, 60), y1 + rnd.nextInt(-40, 40));
        }
        for (int i = 0; i < 700; i++)
        {
            int v = rnd.nextInt(150, 230);
            g.setColor(new Color(v, v, v, rnd.nextInt(8)));
            g.fillRect(rnd.nextInt(WIDTH), rnd.nextInt(HEIGHT), 1, 1);
        }
    }

    /**
     * 以 (cx,cy) 为中心绘制指定形状；填充饱和色，深色半透明描边保证在浅色背景上边缘清晰。
     *
     * @param type  SHAPE_KEYS 下标
     * @param theta 旋转角（弧度）
     */
    private void drawShape(Graphics2D g, int type, Color color, int cx, int cy, double theta)
    {
        int s = SHAPE_SIZE;
        Shape shape;
        switch (type)
        {
            case 0: // 圆
                shape = new Ellipse2D.Float(cx - s / 2f, cy - s / 2f, s, s);
                break;
            case 1: // 圆角方
                shape = new RoundRectangle2D.Float(cx - s / 2f, cy - s / 2f, s, s, 10, 10);
                break;
            case 2: // 正三角
            {
                Polygon p = new Polygon();
                float r = s * 0.58f;
                for (int k = 0; k < 3; k++)
                {
                    double a = -Math.PI / 2 + k * (2 * Math.PI / 3);
                    p.addPoint((int) Math.round(cx + r * Math.cos(a)), (int) Math.round(cy + r * Math.sin(a)));
                }
                shape = p;
                break;
            }
            case 3: // 五角星
            {
                Polygon p = new Polygon();
                float ro = s * 0.58f;
                float ri = ro * 0.42f;
                for (int k = 0; k < 10; k++)
                {
                    double a = -Math.PI / 2 + k * Math.PI / 5;
                    float r = (k % 2 == 0) ? ro : ri;
                    p.addPoint((int) Math.round(cx + r * Math.cos(a)), (int) Math.round(cy + r * Math.sin(a)));
                }
                shape = p;
                break;
            }
            default: // 菱形
            {
                Polygon p = new Polygon();
                int rx = Math.round(s * 0.62f);
                int ry = Math.round(s * 0.52f);
                p.addPoint(cx, cy - ry);
                p.addPoint(cx + rx, cy);
                p.addPoint(cx, cy + ry);
                p.addPoint(cx - rx, cy);
                shape = p;
                break;
            }
        }

        java.awt.geom.AffineTransform old = g.getTransform();
        g.rotate(theta, cx, cy);
        g.setColor(color);
        g.fill(shape);
        g.setColor(new Color(15, 23, 42, 64));
        g.setStroke(new BasicStroke(2f));
        g.draw(shape);
        g.setTransform(old);
    }

    /** 高质量 JPEG 编码（几何边缘干净，300×190 约 12~20KB） */
    private String encodeJpeg(BufferedImage image)
    {
        FastByteArrayOutputStream os = new FastByteArrayOutputStream();
        try
        {
            javax.imageio.ImageWriter writer = ImageIO.getImageWritersByFormatName("jpg").next();
            javax.imageio.ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.9f);
            try (javax.imageio.stream.ImageOutputStream ios = ImageIO.createImageOutputStream(os))
            {
                writer.setOutput(ios);
                writer.write(null, new javax.imageio.IIOImage(image, null, null), param);
            }
            finally
            {
                writer.dispose();
            }
        }
        catch (IOException e)
        {
            throw new ServiceException("验证码生成失败");
        }
        return Base64.getEncoder().encodeToString(os.toByteArray());
    }
}
