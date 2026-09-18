package com.ruoyi.system.service.apms;

import java.io.InputStream;
import java.util.List;
import java.util.Map;

/**
 * 测试结果批量导入 Provider 接口
 *
 * <p>
 * 一期实现：CsvResultImportProvider（CSV 格式）。
 * 未来可扩展：XlsxResultImportProvider、SpssResultImportProvider 等。
 *
 * <p>
 * CSV 格式约定：
 * <pre>
 *   第一行：表头
 *   前 3 列固定：athlete_id, measure_date, session_key
 *   后续列：indicator.code 或 model.code 作为列名
 *   多趟值（RSA 等）：CSV 单元格内逗号分隔，整体加引号
 *
 *   athlete_id,measure_date,session_key,HEIGHT,WEIGHT,50M_SPRINT,RSA_10X40
 *   1001,2026-09-18,S1,178.5,72.3,5.21,"5.21,5.34,5.19,5.28,5.31,5.22,5.30,5.26,5.24,5.27"
 * </pre>
 */
public interface ITestResultImportProvider {

    /**
     * 解析输入流，生成导入草稿（未持久化）
     *
     * @param inputStream CSV 文件流（UTF-8）
     * @param taskId      目标任务（可为 null，表示非任务绑定的手工批量录入）
     * @return 导入结果：包含成功条数、错误行、警告
     */
    ImportResult parse(InputStream inputStream, Long taskId);

    /**
     * 将 parse 结果持久化到数据库（事务内逐运动员提交）
     *
     * @param parsed parse() 返回的草稿
     * @return 实际写入的 result 数
     */
    int persist(ImportResult parsed);

    /** 统一入口：解析 + 持久化 */
    default ImportResult importAll(InputStream inputStream, Long taskId) {
        ImportResult result = parse(inputStream, taskId);
        if (result.errorRows.isEmpty()) {
            persist(result);
        }
        return result;
    }

    /**
     * 导入结果 DTO
     */
    class ImportResult {
        /** 表头列名 → indicator_id / model_id 的解析映射 */
        public Map<String, Long> headerToIndicatorId;
        public Map<String, Long> headerToModelId;
        public Map<String, String> headerToType;           // "indicator" / "model"
        public Map<String, List<Double>> headerMultiValues; // 多趟列名 → 趟数（0 表示单值）

        /** 每行数据：athleteId → (columnHeader → value) */
        public List<Row> rows = new java.util.ArrayList<>();

        /** 解析错误行（表头错误、缺 athlete_id 等） */
        public List<String> errorRows = new java.util.ArrayList<>();

        /** 警告信息（如"列名 HEIGHT 未在 indicator 表找到，已忽略"） */
        public List<String> warnings = new java.util.ArrayList<>();

        /** 实际写入的 test_result 条数（persist 后填充） */
        public int writtenResultCount;

        /**
         * CSV 行数据
         */
        public static class Row {
            public int lineNo;
            public Long athleteId;
            public String measureDate; // YYYY-MM-DD
            public String sessionKey;
            public Map<String, String> values = new java.util.LinkedHashMap<>(); // header → 原始值
        }
    }
}
