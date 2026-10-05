package com.ruoyi.system.service.apms;

import java.util.List;
import java.util.Map;
import com.ruoyi.system.domain.apms.ApmsRtpRiskRule;
import com.ruoyi.system.domain.apms.ApmsRtpRiskSnapshot;
import com.ruoyi.system.domain.apms.dto.RtpRiskHandleForm;

/**
 * RTP 风险预警 Service
 *
 * @author apms
 */
public interface IRtpRiskService {

    /** 待办/已处理列表（query.statusList 为空时默认当日 ACTIVE） */
    List<ApmsRtpRiskSnapshot> selectList(ApmsRtpRiskSnapshot query);

    /** 详情（含解析后的因子明细） */
    ApmsRtpRiskSnapshot getById(Long id);

    /** 运动员最新 ACTIVE 非 NONE 快照（详情页横幅，无则 null） */
    ApmsRtpRiskSnapshot latestByAthlete(Long athleteId);

    /** 规则列表（一期只读） */
    List<ApmsRtpRiskRule> listRules();

    /** KPI 统计（同 DataScope）：total/warning/attention/infoHealth/processOnly */
    Map<String, Object> stat(ApmsRtpRiskSnapshot query);

    /** 全量扫描（定时/手动），返回扫描统计 */
    Map<String, Object> scanDaily();

    /** 单运动员增量重算（医疗新增/PHV 自动计算/采纳 afterCommit 触发） */
    void scanOne(Long athleteId);

    /** 已知悉（仅 INFO 的 ACTIVE 快照；幂等） */
    ApmsRtpRiskSnapshot ack(Long id, String remark);

    /** 忽略（任意级别的 ACTIVE 快照，理由必填；幂等） */
    ApmsRtpRiskSnapshot dismiss(Long id, String remark);

    /**
     * 采纳并更新 RTP（仅 ATTENTION/WARNING 的 ACTIVE 快照）：
     * 单本地事务内完成 行锁 → 校验 → 写 RTP → 写 rtp_log → 快照 ACCEPTED；
     * afterCommit 再 scanOne，消除与重扫的竞争。
     */
    ApmsRtpRiskSnapshot acceptAndApplyRtp(Long id, RtpRiskHandleForm form);
}
