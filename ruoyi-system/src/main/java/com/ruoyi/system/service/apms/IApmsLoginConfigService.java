package com.ruoyi.system.service.apms;

import java.util.Map;

/**
 * 登录页页面配置 Service
 *
 * 后端不维护视觉默认值、不做默认值合并：
 * 有配置行则原样解析 config_json 返回；无行（或内容异常）返回空 Map，
 * 由前端 login.defaults.js 深度合并出最终配置。
 *
 * @author apms
 */
public interface IApmsLoginConfigService {

    /**
     * 读取单例登录页配置（config_key='default'）
     *
     * @return 配置 JSON 解析后的 Map；无配置行或内容为空时返回空 Map（永不返回 null）
     */
    public Map<String, Object> getConfigMap();

    /**
     * 保存（upsert）登录页配置
     *
     * 保存与 JSON 导入走同一套校验：结构、大小、枚举、颜色格式、图标白名单、
     * URL 白名单（防 javascript:/data:/file:/协议相对地址/任意外链图片）。
     * 校验不通过抛 ServiceException，绝不静默补默认值。
     *
     * @param config   前端提交的完整配置对象
     * @param operator 操作人（登录账号）
     */
    public void saveConfig(Map<String, Object> config, String operator);
}
