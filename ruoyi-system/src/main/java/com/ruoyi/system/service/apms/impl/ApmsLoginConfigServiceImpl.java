package com.ruoyi.system.service.apms.impl;

import java.util.Collections;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruoyi.system.domain.apms.ApmsLoginConfig;
import com.ruoyi.system.mapper.apms.ApmsLoginConfigMapper;
import com.ruoyi.system.service.apms.IApmsLoginConfigService;

/**
 * 登录页页面配置 Service 实现
 *
 * @author apms
 */
@Service
public class ApmsLoginConfigServiceImpl implements IApmsLoginConfigService {

    private static final Logger log = LoggerFactory.getLogger(ApmsLoginConfigServiceImpl.class);

    /** 单例配置标识 */
    private static final String DEFAULT_CONFIG_KEY = "default";

    /** ObjectMapper 线程安全，配置读取只需最简解析，直接持有实例，不依赖容器 Bean */
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

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
}
