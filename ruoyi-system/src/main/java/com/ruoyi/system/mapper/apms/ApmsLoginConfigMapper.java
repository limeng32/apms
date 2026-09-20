package com.ruoyi.system.mapper.apms;

import com.ruoyi.system.domain.apms.ApmsLoginConfig;

/**
 * 登录页页面配置 Mapper
 *
 * @author apms
 */
public interface ApmsLoginConfigMapper {

    /**
     * 按配置标识查询单例配置
     *
     * @param configKey 配置标识（default）
     * @return 配置行；无数据返回 null
     */
    public ApmsLoginConfig selectByConfigKey(String configKey);

    /**
     * 新增配置行
     *
     * @param config 配置行
     * @return 影响行数
     */
    public int insertConfig(ApmsLoginConfig config);

    /**
     * 按配置标识更新配置内容
     *
     * @param config 配置行
     * @return 影响行数
     */
    public int updateByConfigKey(ApmsLoginConfig config);
}
