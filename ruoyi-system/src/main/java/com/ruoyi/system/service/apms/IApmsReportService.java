package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsReport;

public interface IApmsReportService {
    List<ApmsReport> list(ApmsReport query);
    ApmsReport getById(Long id);

    /**
     * 生成报告 — 聚合上游数据 → JSON 快照 → OpenPDF 渲染 → 存 DB + 磁盘
     * @param athleteId 单人报告必填；taskId 可选限定任务；deptId 队伍报告必填
     */
    ApmsReport generate(String reportType, Long athleteId, Long deptId, Long taskId);

    int delete(Long id);
}
