package com.ruoyi.system.service.apms;

/**
 * 测试结果 CSV 导入模板生成
 */
public interface ITestResultTemplateService {

    /**
     * 生成 CSV 模板内容（不含 BOM，由调用方按需添加）
     *
     * @param taskId 任务 ID；为 null 时生成通用模板（全部启用指标列 + 在训队员行）
     */
    String buildTemplateCsv(Long taskId);
}
