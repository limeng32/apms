package com.ruoyi.system.service.apms;

import java.util.Map;

/**
 * 登录页页面配置 Service
 *
 * 后端不维护视觉默认值、不做默认值合并：
 * 有配置行则原样解析 config_json 返回；无行（或内容为空）返回空 Map，
 * 由前端 login.defaults.js 深度合并出最终配置。
 *
 * 双入口：同一张 apms_login_config 表按 config_key 存两套配置——
 *  - portal（key='default'）：业务站 aoti.apms.top（历史行直接复用，零迁移）
 *  - showcase（key='showcase'）：品牌展示站 apms.top
 *
 * @author apms
 */
public interface IApmsLoginConfigService {

    /**
     * 读取业务站配置（config_key='default'）
     *
     * @return 配置 JSON 解析后的 Map；无配置行或内容为空时返回空 Map（永不返回 null）
     */
    public Map<String, Object> getConfigMap();

    /**
     * 按入口读取配置
     *
     * @param entry 入口标识：null/空/"default"/"portal" → 业务站；"showcase" → 展示站；其余抛异常
     * @return 配置 JSON 解析后的 Map；无配置行或内容为空时返回空 Map（永不返回 null）
     */
    public Map<String, Object> getConfigMap(String entry);

    /**
     * 保存（upsert）业务站配置
     *
     * 保存与 JSON 导入走同一套校验：结构、大小、枚举、颜色格式、图标白名单、
     * URL 白名单（防 javascript:/data:/file:/协议相对地址/任意外链图片）。
     * 校验不通过抛 ServiceException，绝不静默补默认值。
     *
     * @param config   前端提交的完整配置对象
     * @param operator 操作人（登录账号）
     */
    public void saveConfig(Map<String, Object> config, String operator);

    /**
     * 按入口保存（upsert）配置，校验规则同 {@link #saveConfig(Map, String)}
     *
     * @param entry 入口标识：null/空/"default"/"portal" → 业务站；"showcase" → 展示站；其余抛异常
     */
    public void saveConfig(Map<String, Object> config, String operator, String entry);
}
