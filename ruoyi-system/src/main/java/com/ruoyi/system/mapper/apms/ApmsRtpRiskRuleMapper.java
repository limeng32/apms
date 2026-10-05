package com.ruoyi.system.mapper.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsRtpRiskRule;

/**
 * RTP 预警规则配置 Mapper
 *
 * @author apms
 */
public interface ApmsRtpRiskRuleMapper {

    /** 全部规则（配置页只读展示） */
    List<ApmsRtpRiskRule> selectAll();

    /** 全部启用规则（评估引擎使用） */
    List<ApmsRtpRiskRule> selectAllEnabled();
}
