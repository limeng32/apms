package com.ruoyi.system.service.apms.impl;

import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruoyi.common.exception.ServiceException;
import com.ruoyi.system.domain.apms.ApmsLoginConfig;
import com.ruoyi.system.mapper.apms.ApmsLoginConfigMapper;
import com.ruoyi.system.service.apms.IApmsLoginConfigService;

/**
 * 登录页页面配置 Service 实现
 *
 * 职责边界：读取（无行返回 {}）、upsert 保存、只校验形态不补默认值。
 * 视觉默认值的唯一真相源在前端 login.defaults.js。
 *
 * @author apms
 */
@Service
public class ApmsLoginConfigServiceImpl implements IApmsLoginConfigService {

    private static final Logger log = LoggerFactory.getLogger(ApmsLoginConfigServiceImpl.class);

    /** 单例配置标识 */
    private static final String DEFAULT_CONFIG_KEY = "default";

    /** config_json 上限 64KB（UTF-8） */
    private static final int MAX_JSON_BYTES = 64 * 1024;

    private static final int SCHEMA_VER = 1;

    /** ObjectMapper 线程安全，直接持有实例，不依赖容器 Bean */
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    /** 布局模板枚举（M3c 起 split/centered/fullscreen） */
    private static final Set<String> TEMPLATES = Set.of("split", "centered", "fullscreen");
    /**
     * 背景类型：M3c 仅开放 image（整屏背景图 + 遮罩）。
     * video 为 M4 预留值，当前保存即拒绝，避免库中落入渲染器半支持的状态。
     */
    private static final Set<String> BACKGROUND_TYPES = Set.of("image");
    /** 内置背景标识（与前端 BUILTIN_BACKGROUNDS 一致）：随包静态资源，非 /profile/ 上传文件 */
    private static final Set<String> BACKGROUND_BUILTINS = Set.of("tech");
    /** 背景动态装饰特效（与前端 BACKGROUND_EFFECTS 一致） */
    private static final Set<String> BACKGROUND_EFFECTS = Set.of("none", "particles", "radar", "all");
    private static final Set<String> FONT_FAMILIES = Set.of("system", "pingfang", "yahei", "heiti", "songti");
    private static final Set<String> FORGOT_MODES = Set.of("alert", "link", "hidden");

    /** logo 类型（M3a：内置矢量 / 上传图片） */
    private static final Set<String> LOGO_TYPES = Set.of("builtin", "image");
    /**
     * 内置 logo 标识（与前端 BUILTIN_LOGOS 一致）：
     * shield 为定制内联 SVG，nosc 为奥体中心随包位图，其余为全局注册的 Element Plus 图标名
     */
    private static final Set<String> LOGO_BUILTINS = Set.of(
            "shield", "nosc", "Trophy", "Medal", "Star", "Flag", "Aim", "Basketball", "Football");

    /**
     * 特性图标白名单（均为已全局注册的 Element Plus 图标名）。
     * 为设计器可选图标（20 个）的超集：另含 View/Hide/Sunny/Moon 四个界面控件类图标，
     * 不适合做特性条目故设计器不展示，但允许导入的配置中存在，向前兼容。
     */
    private static final Set<String> ICONS = Set.of(
            "Check", "TrendCharts", "Key", "Document", "User", "Lock", "View", "Hide",
            "CircleCheck", "DataAnalysis", "Medal", "Histogram", "Aim", "Timer",
            "FirstAidKit", "Monitor", "Cellphone", "Star", "Flag", "Trophy",
            "MagicStick", "Odometer", "Sunny", "Moon");

    /** #rgb / #rrggbb / rgb()/rgba() */
    private static final Pattern COLOR = Pattern.compile(
            "^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
            + "|^rgba?\\(\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*,\\s*\\d{1,3}\\s*(?:,\\s*(?:0|1|0?\\.\\d+)\\s*)?\\)$");

    /** http(s) 绝对地址 */
    private static final Pattern HTTP_URL = Pattern.compile("^https?://.+$", Pattern.CASE_INSENSITIVE);

    /**
     * 版权富文本白名单：仅允许 <a>链接</a> 标签（ICP 备案场景）。
     * 标签体与属性区不允许出现 < >，从结构上杜绝嵌套/属性逃逸。
     */
    private static final Pattern FOOTER_ANCHOR = Pattern.compile(
            "<a\\s+([^<>]*?)>([^<>]*)</a>", Pattern.CASE_INSENSITIVE);
    private static final Pattern FOOTER_ATTR = Pattern.compile(
            "\\s*([a-zA-Z:_-]+)\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')\\s*", Pattern.CASE_INSENSITIVE);
    /** 非锚点文本中出现标签起始符则拒绝（只允许 <a>） */
    private static final Pattern FOOTER_OTHER_TAG = Pattern.compile("<\\s*/?[a-zA-Z]");

    @Autowired
    private ApmsLoginConfigMapper apmsLoginConfigMapper;

    @Override
    public Map<String, Object> getConfigMap()
    {
        ApmsLoginConfig row = apmsLoginConfigMapper.selectByConfigKey(DEFAULT_CONFIG_KEY);
        if (row == null || row.getConfigJson() == null || row.getConfigJson().isBlank())
        {
            // 无配置行：返回空对象，由前端与 login.defaults.js 合并
            return Collections.emptyMap();
        }
        try
        {
            Map<String, Object> config = OBJECT_MAPPER.readValue(
                    row.getConfigJson(), new TypeReference<Map<String, Object>>() {});
            return config == null ? Collections.emptyMap() : config;
        }
        catch (Exception e)
        {
            // 库中 JSON 损坏等异常不阻断登录页：记录日志并返回空对象
            log.error("解析登录页配置 config_json 失败，回退空配置: {}", e.getMessage());
            return Collections.emptyMap();
        }
    }

    @Override
    public void saveConfig(Map<String, Object> config, String operator)
    {
        if (config == null)
        {
            throw new ServiceException("配置内容不能为空");
        }
        validate(config);

        String json;
        try
        {
            json = OBJECT_MAPPER.writeValueAsString(config);
        }
        catch (Exception e)
        {
            throw new ServiceException("配置序列化失败：" + e.getMessage());
        }
        if (json.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES)
        {
            throw new ServiceException("配置内容超出 64KB 上限");
        }

        ApmsLoginConfig row = apmsLoginConfigMapper.selectByConfigKey(DEFAULT_CONFIG_KEY);
        if (row == null)
        {
            ApmsLoginConfig entity = new ApmsLoginConfig();
            entity.setConfigKey(DEFAULT_CONFIG_KEY);
            entity.setConfigName("默认配置");
            entity.setConfigJson(json);
            entity.setSchemaVer(SCHEMA_VER);
            entity.setStatus("0");
            entity.setCreateBy(operator);
            apmsLoginConfigMapper.insertConfig(entity);
        }
        else
        {
            row.setConfigJson(json);
            row.setSchemaVer(SCHEMA_VER);
            row.setUpdateBy(operator);
            apmsLoginConfigMapper.updateByConfigKey(row);
        }
    }

    // ============================ 形态校验 ============================
    // 说明：只校验已知字段的形态；保存与 JSON 导入共用，导入无法绕过任何限制。

    private void validate(Map<String, Object> root)
    {
        Map<String, Object> layout = obj(root.get("layout"), "layout");
        if (layout != null)
        {
            enumStr(layout.get("template"), TEMPLATES, "layout.template", true);
            number(layout.get("splitRatio"), "layout.splitRatio", 0.5, 3.0);
            bool(layout.get("showBrandOnMobile"), "layout.showBrandOnMobile");
            number(layout.get("cardRadius"), "layout.cardRadius", 0, 40);
        }

        Map<String, Object> brand = obj(root.get("brand"), "brand");
        if (brand != null)
        {
            str(brand.get("name"), "brand.name", 100);
            str(brand.get("subTitle"), "brand.subTitle", 200);
            // v1 favicon 仅允许 /profile/ 站内路径
            mediaUrl(brand.get("favicon"), "brand.favicon", true);
            // Logo 与上下留白（桌面端）：复用校验方法，移动端共用同一套口径
            validateLogo(obj(brand.get("logo"), "brand.logo"), "brand.logo", false);
            // 客户方 Logo（登录区左上，双 logo 方案；enabled=false 时仅校验像素字段）
            validateLogo(obj(brand.get("logoClient"), "brand.logoClient"), "brand.logoClient", true);
            validateLogoSpace(obj(brand.get("logoSpace"), "brand.logoSpace"), "brand.logoSpace");
        }

        // 移动端独立布局配置（与桌面端同一次保存提交）
        Map<String, Object> mobile = obj(root.get("mobile"), "mobile");
        if (mobile != null)
        {
            Map<String, Object> mobileLayout = obj(mobile.get("layout"), "mobile.layout");
            if (mobileLayout != null)
            {
                enumStr(mobileLayout.get("template"), TEMPLATES, "mobile.layout.template", true);
                number(mobileLayout.get("splitRatio"), "mobile.layout.splitRatio", 0.5, 3.0);
            }
            Map<String, Object> mobileBrand = obj(mobile.get("brand"), "mobile.brand");
            if (mobileBrand != null)
            {
                validateLogo(obj(mobileBrand.get("logo"), "mobile.brand.logo"), "mobile.brand.logo", false);
                validateLogo(obj(mobileBrand.get("logoClient"), "mobile.brand.logoClient"), "mobile.brand.logoClient", true);
                validateLogoSpace(obj(mobileBrand.get("logoSpace"), "mobile.brand.logoSpace"), "mobile.brand.logoSpace");
            }
            Map<String, Object> mobileBg = obj(mobile.get("background"), "mobile.background");
            if (mobileBg != null)
            {
                enumStr(mobileBg.get("type"), BACKGROUND_TYPES, "mobile.background.type", false);
                mediaUrl(mobileBg.get("image"), "mobile.background.image", true);
                number(mobileBg.get("overlay"), "mobile.background.overlay", 0, 1);
                validateBackgroundMotion(mobileBg, "mobile.background");
            }
        }

        Map<String, Object> hero = obj(root.get("hero"), "hero");
        if (hero != null)
        {
            bool(hero.get("visible"), "hero.visible");
            str(hero.get("description"), "hero.description", 500);
            List<Object> lines = list(hero.get("lines"), "hero.lines", 1, 6);
            if (lines != null)
            {
                for (int i = 0; i < lines.size(); i++)
                {
                    Map<String, Object> line = asObj(lines.get(i), "hero.lines[" + i + "]");
                    str(line.get("text"), "hero.lines[" + i + "].text", 200);
                    bool(line.get("accent"), "hero.lines[" + i + "].accent");
                }
            }
            Map<String, Object> features = obj(hero.get("features"), "hero.features");
            if (features != null)
            {
                bool(features.get("visible"), "hero.features.visible");
                List<Object> items = list(features.get("items"), "hero.features.items", 0, 8);
                if (items != null)
                {
                    for (int i = 0; i < items.size(); i++)
                    {
                        Map<String, Object> f = asObj(items.get(i), "hero.features.items[" + i + "]");
                        enumStr(f.get("icon"), ICONS, "hero.features.items[" + i + "].icon", true);
                        str(f.get("title"), "hero.features.items[" + i + "].title", 50);
                        str(f.get("text"), "hero.features.items[" + i + "].text", 200);
                    }
                }
            }
        }

        Map<String, Object> form = obj(root.get("form"), "form");
        if (form != null)
        {
            str(form.get("title"), "form.title", 100);
            str(form.get("subtitle"), "form.subtitle", 200);
            str(form.get("usernamePlaceholder"), "form.usernamePlaceholder", 100);
            str(form.get("passwordPlaceholder"), "form.passwordPlaceholder", 100);
            str(form.get("rememberText"), "form.rememberText", 50);
            str(form.get("buttonText"), "form.buttonText", 50);
            str(form.get("loadingText"), "form.loadingText", 50);
            Map<String, Object> forgot = obj(form.get("forgot"), "form.forgot");
            if (forgot != null)
            {
                enumStr(forgot.get("mode"), FORGOT_MODES, "form.forgot.mode", true);
                str(forgot.get("text"), "form.forgot.text", 50);
                str(forgot.get("alertMessage"), "form.forgot.alertMessage", 200);
                // 忘记密码 URL：http(s) 绝对地址或单斜杠站内路径
                linkUrl(forgot.get("url"), "form.forgot.url");
            }
        }

        Map<String, Object> footer = obj(root.get("footer"), "footer");
        if (footer != null)
        {
            richFooter(footer.get("brandText"), "footer.brandText");
            richFooter(footer.get("copyright"), "footer.copyright");
            bool(footer.get("showCopyright"), "footer.showCopyright");
            // 公安联网备案：开关 + 备案号（最长 60）+ 公安备案查询外链（可空）
            Map<String, Object> police = obj(footer.get("police"), "footer.police");
            if (police != null)
            {
                bool(police.get("show"), "footer.police.show");
                str(police.get("number"), "footer.police.number", 60);
                httpUrl(police.get("url"), "footer.police.url");
            }
        }

        Map<String, Object> colors = obj(root.get("colors"), "colors");
        if (colors != null)
        {
            color(colors.get("accent"), "colors.accent");
            color(colors.get("glow2"), "colors.glow2");
            color(colors.get("textOnBrand"), "colors.textOnBrand");
            color(colors.get("textOnBrandMuted"), "colors.textOnBrandMuted");
            color(colors.get("pageBg"), "colors.pageBg");
            color(colors.get("formTitle"), "colors.formTitle");
            color(colors.get("formSubText"), "colors.formSubText");
            color(colors.get("inputBorder"), "colors.inputBorder");
            color(colors.get("inputFocus"), "colors.inputFocus");
            color(colors.get("buttonBg"), "colors.buttonBg");
            color(colors.get("buttonHover"), "colors.buttonHover");
            color(colors.get("buttonLoading"), "colors.buttonLoading");
            color(colors.get("link"), "colors.link");
            Map<String, Object> grad = obj(colors.get("brandGradient"), "colors.brandGradient");
            if (grad != null)
            {
                number(grad.get("angle"), "colors.brandGradient.angle", 0, 360);
                List<Object> stops = list(grad.get("stops"), "colors.brandGradient.stops", 2, 4);
                if (stops != null)
                {
                    for (int i = 0; i < stops.size(); i++)
                    {
                        color(stops.get(i), "colors.brandGradient.stops[" + i + "]");
                    }
                }
            }
            // Hero 强调文字渐变 / 登录按钮渐变（可开关；关闭后前端回退纯色）
            validateGradient(obj(colors.get("heroGradient"), "colors.heroGradient"), "colors.heroGradient");
            validateGradient(obj(colors.get("buttonGradient"), "colors.buttonGradient"), "colors.buttonGradient");
        }

        Map<String, Object> typography = obj(root.get("typography"), "typography");
        if (typography != null)
        {
            enumStr(typography.get("fontFamily"), FONT_FAMILIES, "typography.fontFamily", false);
            number(typography.get("heroSize"), "typography.heroSize", 8, 80);
            number(typography.get("heroWeight"), "typography.heroWeight", 100, 900);
            number(typography.get("brandNameSize"), "typography.brandNameSize", 8, 80);
            number(typography.get("formTitleSize"), "typography.formTitleSize", 8, 80);
        }

        Map<String, Object> animation = obj(root.get("animation"), "animation");
        if (animation != null)
        {
            bool(animation.get("entrance"), "animation.entrance");
        }

        Map<String, Object> background = obj(root.get("background"), "background");
        if (background != null)
        {
            // M3c 开放 image 编辑；video 为 M4 预留，当前拒绝（见 BACKGROUND_TYPES）
            enumStr(background.get("type"), BACKGROUND_TYPES, "background.type", false);
            mediaUrl(background.get("image"), "background.image", true);
            number(background.get("overlay"), "background.overlay", 0, 1);
            validateBackgroundMotion(background, "background");
            Map<String, Object> video = obj(background.get("video"), "background.video");
            if (video != null)
            {
                mediaUrl(video.get("poster"), "background.video.poster", true);
                // video.url 预留：同样只允许站内 /profile/
                mediaUrl(video.get("url"), "background.video.url", true);
                bool(video.get("autoplay"), "background.video.autoplay");
                bool(video.get("muted"), "background.video.muted");
                bool(video.get("loop"), "background.video.loop");
            }
        }
    }

    // ============================ 基础工具 ============================

    /**
     * Logo 校验（桌面 brand.logo 与移动 mobile.brand.logo 共用）。
     * prefix 为字段路径前缀（如 "brand.logo"），错误信息与之拼接。
     * clientLogo=true 为客户方 logo：其 X 行程单独放宽（与前端 CLIENT_LOGO_OFFSET_X_LIMITS 一致）。
     */
    private void validateLogo(Map<String, Object> logo, String prefix, boolean clientLogo)
    {
        if (logo == null)
        {
            return;
        }
        // enabled 仅客户方 logo（logoClient）携带；显式关闭时不校验来源/取值，
        // 允许「切到 image 尚未上传就先关闭」这类中间态保存
        bool(logo.get("enabled"), prefix + ".enabled");
        boolean logoDisabled = Boolean.FALSE.equals(logo.get("enabled"));
        // 像素级调整范围（与前端限制一致；无论开关与否均合法）
        // 客户方 logo 宽度上限放宽到 300（奥体等横版官方 logo），高度及版权方宽高均为 16~200
        number(logo.get("width"), prefix + ".width", 16, clientLogo ? 300 : 200);
        number(logo.get("height"), prefix + ".height", 16, 200);
        // 客户方 logo 锚定登录框左缘，水平行程放宽到 -200~400；版权方与所有 Y 均为 ±100
        number(logo.get("offsetX"), prefix + ".offsetX", clientLogo ? -200 : -100, clientLogo ? 400 : 100);
        number(logo.get("offsetY"), prefix + ".offsetY", -100, 100);
        if (logoDisabled)
        {
            return;
        }
        // type 缺省按 builtin 处理（兼容 M2 配置）
        String logoType = enumStr(logo.get("type"), LOGO_TYPES, prefix + ".type", false);
        if ("image".equals(logoType))
        {
            Object logoValue = logo.get("value");
            if (!(logoValue instanceof String) || ((String) logoValue).isBlank())
            {
                throw new ServiceException(prefix + ".value 不能为空（image 类型须为 /profile/ 下的图片路径）");
            }
            mediaUrl(logoValue, prefix + ".value", false);
        }
        else
        {
            enumStr(logo.get("value"), LOGO_BUILTINS, prefix + ".value", true);
        }
    }

    /**
     * Logo 上下留白校验（桌面/移动共用）。
     * 上方高度 0~200；下方高度 -100~200（负值允许下一区块上提）。
     */
    private void validateLogoSpace(Map<String, Object> logoSpace, String prefix)
    {
        if (logoSpace == null)
        {
            return;
        }
        Map<String, Object> spaceSplit = obj(logoSpace.get("split"), prefix + ".split");
        if (spaceSplit != null)
        {
            number(spaceSplit.get("top"), prefix + ".split.top", 0, 200);
            number(spaceSplit.get("bottom"), prefix + ".split.bottom", -100, 200);
        }
        Map<String, Object> spaceOverlay = obj(logoSpace.get("overlay"), prefix + ".overlay");
        if (spaceOverlay != null)
        {
            number(spaceOverlay.get("top"), prefix + ".overlay.top", 0, 200);
            number(spaceOverlay.get("bottom"), prefix + ".overlay.bottom", -100, 200);
        }
    }

    /**
     * 渐变配置校验（colors.heroGradient / colors.buttonGradient 共用）：
     * enabled 可缺省；angle 0~360；stops 2~4 个合法颜色。
     */
    private void validateGradient(Map<String, Object> gradient, String prefix)
    {
        if (gradient == null)
        {
            return;
        }
        bool(gradient.get("enabled"), prefix + ".enabled");
        number(gradient.get("angle"), prefix + ".angle", 0, 360);
        List<Object> stops = list(gradient.get("stops"), prefix + ".stops", 2, 4);
        if (stops != null)
        {
            for (int i = 0; i < stops.size(); i++)
            {
                color(stops.get(i), prefix + ".stops[" + i + "]");
            }
        }
    }

    /**
     * 背景动态字段校验（桌面 background 与移动 mobile.background 共用）：
     * builtin 为内置背景枚举（允许 null=不使用）；effect 为特效枚举；kenBurns 布尔。
     */
    private void validateBackgroundMotion(Map<String, Object> background, String prefix)
    {
        enumStr(background.get("builtin"), BACKGROUND_BUILTINS, prefix + ".builtin", false);
        enumStr(background.get("effect"), BACKGROUND_EFFECTS, prefix + ".effect", false);
        bool(background.get("kenBurns"), prefix + ".kenBurns");
    }

    private Map<String, Object> obj(Object v, String path)
    {
        if (v == null)
        {
            return null;
        }
        if (!(v instanceof Map))
        {
            throw new ServiceException(path + " 必须是对象");
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> m = (Map<String, Object>) v;
        return m;
    }

    private Map<String, Object> asObj(Object v, String path)
    {
        Map<String, Object> m = obj(v, path);
        if (m == null)
        {
            throw new ServiceException(path + " 必须是对象");
        }
        return m;
    }

    private List<Object> list(Object v, String path, int min, int max)
    {
        if (v == null)
        {
            return null;
        }
        if (!(v instanceof List))
        {
            throw new ServiceException(path + " 必须是数组");
        }
        @SuppressWarnings("unchecked")
        List<Object> l = (List<Object>) v;
        if (l.size() < min || l.size() > max)
        {
            throw new ServiceException(path + " 元素数量须在 " + min + "~" + max + " 之间");
        }
        return l;
    }

    /** 字符串字段：允许缺省/null；非字符串或超长拒绝（不做 trim 改写，保持所见即所存） */
    private void str(Object v, String path, int maxLen)
    {
        if (v == null)
        {
            return;
        }
        if (!(v instanceof String))
        {
            throw new ServiceException(path + " 必须是字符串");
        }
        String s = (String) v;
        if (s.length() > maxLen)
        {
            throw new ServiceException(path + " 长度不能超过 " + maxLen);
        }
    }

    private void bool(Object v, String path)
    {
        if (v != null && !(v instanceof Boolean))
        {
            throw new ServiceException(path + " 必须是布尔值");
        }
    }

    private void number(Object v, String path, double min, double max)
    {
        if (v == null)
        {
            return;
        }
        if (!(v instanceof Number))
        {
            throw new ServiceException(path + " 必须是数值");
        }
        double n = ((Number) v).doubleValue();
        if (n < min || n > max)
        {
            throw new ServiceException(path + " 取值须在 " + min + "~" + max + " 之间");
        }
    }

    /** 枚举字符串；required=true 时非空，false 时允许缺省/null */
    private String enumStr(Object v, Set<String> allowed, String path, boolean required)
    {
        if (v == null)
        {
            if (required)
            {
                throw new ServiceException(path + " 不能为空");
            }
            return null;
        }
        if (!(v instanceof String) || !allowed.contains(v))
        {
            throw new ServiceException(path + " 取值非法：" + v);
        }
        return (String) v;
    }

    private void color(Object v, String path)
    {
        if (v == null)
        {
            return;
        }
        if (!(v instanceof String) || !COLOR.matcher((String) v).matches())
        {
            throw new ServiceException(path + " 不是合法颜色值（仅支持 #rgb/#rrggbb/rgb()/rgba()）：" + v);
        }
    }

    /**
     * 页面跳转链接：允许 http(s):// 绝对地址、单斜杠开头站内路径、空串；
     * 拒绝 javascript:/data:/file: 与 //host 协议相对地址。
     */
    private void linkUrl(Object v, String path)
    {
        if (v == null)
        {
            return;
        }
        if (!(v instanceof String))
        {
            throw new ServiceException(path + " 必须是字符串");
        }
        String u = ((String) v).trim();
        if (u.isEmpty())
        {
            return;
        }
        if (HTTP_URL.matcher(u).matches() || u.startsWith("/") && !u.startsWith("//"))
        {
            return;
        }
        throw new ServiceException(path + " 仅允许 http(s):// 链接或单斜杠开头的站内路径：" + u);
    }

    /**
     * 仅允许 http(s) 绝对外链（公安备案等必须指向站外的地址），空值放行。
     */
    private void httpUrl(Object v, String path)
    {
        if (v == null)
        {
            return;
        }
        if (!(v instanceof String))
        {
            throw new ServiceException(path + " 必须是字符串");
        }
        String u = ((String) v).trim();
        if (u.isEmpty() || HTTP_URL.matcher(u).matches())
        {
            return;
        }
        throw new ServiceException(path + " 仅允许 http(s):// 外链：" + u);
    }

    /**
     * 版权富文本校验：纯文本 + 白名单 &lt;a&gt; 链接（ICP 备案）。
     * - 长度 ≤ 400；
     * - 仅允许 &lt;a href="http(s)://..." target="_blank" rel="..."&gt;文字&lt;/a&gt;，
     *   href 必填且必须 http(s)，target 仅 _blank，rel 仅安全字符，其余属性拒绝；
     * - 锚点之外的文本出现任何标签起始符（&lt;script&gt;、&lt;img&gt; 等）拒绝。
     * 与前端 parseRichText 白名单保持一致，保存与 JSON 导入共用。
     */
    private void richFooter(Object v, String path)
    {
        if (v == null)
        {
            return;
        }
        if (!(v instanceof String))
        {
            throw new ServiceException(path + " 必须是字符串");
        }
        String s = (String) v;
        if (s.length() > 400)
        {
            throw new ServiceException(path + " 长度不能超过 400");
        }
        Matcher anchor = FOOTER_ANCHOR.matcher(s);
        int last = 0;
        while (anchor.find())
        {
            footerPlainText(s.substring(last, anchor.start()), path);
            String attrText = anchor.group(1);
            String label = anchor.group(2);
            if (label.indexOf('<') >= 0 || label.indexOf('>') >= 0)
            {
                throw new ServiceException(path + " 链接文字不合法");
            }
            Matcher attr = FOOTER_ATTR.matcher(attrText);
            int pos = 0;
            String href = null;
            String target = null;
            String rel = null;
            while (attr.find())
            {
                if (attr.start() != pos)
                {
                    throw footerAnchorError(path);
                }
                pos = attr.end();
                String name = attr.group(1).toLowerCase();
                String val = attr.group(2) != null ? attr.group(2) : attr.group(3);
                if ("href".equals(name))
                {
                    href = val.trim();
                }
                else if ("target".equals(name))
                {
                    target = val.trim();
                }
                else if ("rel".equals(name))
                {
                    rel = val;
                }
                else
                {
                    // onclick/style 等白名单外属性
                    throw footerAnchorError(path);
                }
            }
            if (pos != attrText.length() || href == null || !HTTP_URL.matcher(href).matches())
            {
                throw footerAnchorError(path);
            }
            if (target != null && !"_blank".equalsIgnoreCase(target))
            {
                throw new ServiceException(path + " 链接仅支持 target=\"_blank\"");
            }
            if (rel != null && !rel.matches("[A-Za-z0-9 _-]{0,50}"))
            {
                throw footerAnchorError(path);
            }
            last = anchor.end();
        }
        footerPlainText(s.substring(last), path);
    }

    private void footerPlainText(String text, String path)
    {
        if (FOOTER_OTHER_TAG.matcher(text).find())
        {
            throw new ServiceException(path
                    + " 仅支持纯文本与 <a href=\"http(s)://...\">链接</a>，不允许其他标签");
        }
    }

    private ServiceException footerAnchorError(String path)
    {
        return new ServiceException(path
                + " 的链接仅允许格式 <a href=\"https://...\" target=\"_blank\">备案号</a>");
    }

    /**
     * 媒体 URL（logo/favicon/背景/封面）：v1 仅允许空或 /profile/ 开头站内资源，
     * 防止导入 JSON 塞 javascript:/data:/file: 或任意外链图片。
     */
    private void mediaUrl(Object v, String path, boolean allowNull)
    {
        if (v == null || "".equals(v))
        {
            if (!allowNull && v == null)
            {
                throw new ServiceException(path + " 不能为空");
            }
            return;
        }
        if (!(v instanceof String))
        {
            throw new ServiceException(path + " 必须是字符串");
        }
        String u = ((String) v).trim();
        if (u.isEmpty() || u.startsWith("/profile/") && !u.startsWith("//"))
        {
            return;
        }
        throw new ServiceException(path + " 仅允许 /profile/ 开头的站内资源地址：" + u);
    }
}
