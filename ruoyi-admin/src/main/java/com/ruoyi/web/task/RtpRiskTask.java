package com.ruoyi.web.task;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.ruoyi.system.service.apms.IRtpRiskService;

/**
 * RTP 风险预警定时任务（invoke_target = rtpRiskTask.scanDaily）
 *
 * Bean 放在 ruoyi-admin：ruoyi-quartz 模块仅依赖 ruoyi-common，无法引用 system 服务；
 * admin 同时依赖两者，组件扫描基包 com.ruoyi 覆盖本类。
 *
 * @author apms
 */
@Component("rtpRiskTask")
public class RtpRiskTask {

    private static final Logger log = LoggerFactory.getLogger(RtpRiskTask.class);

    @Autowired
    private IRtpRiskService riskService;

    /** 每日全量扫描：昨日 ACTIVE 置 EXPIRED，为在训运动员重算当日快照 */
    public void scanDaily() {
        Map<String, Object> stat = riskService.scanDaily();
        log.info("[rtpRiskTask] scanDaily finished: {}", stat);
    }
}
