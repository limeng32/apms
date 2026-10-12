package com.ruoyi.system.service.apms.batchimport;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 导入预览返回体（成绩/体态同构）。
 *
 * @author apms
 */
public class ImportPreviewVo implements Serializable {

    private static final long serialVersionUID = 1L;

    private String token;
    private String domain;
    /** 致命错误（表头缺失/散录带 task_id 等）：存在时前端禁止提交 */
    private List<String> errors = new ArrayList<>();
    private Summary summary = new Summary();
    private List<Header> headers = new ArrayList<>();
    private List<String> ignoredColumns = new ArrayList<>();
    private List<RowVo> rows = new ArrayList<>();
    private List<String> warnings = new ArrayList<>();
    /** 体态：存在可覆盖的 import 旧数据行（前端据此显示勾选） */
    private boolean allowOverwriteOption = false;

    public static class Summary implements Serializable {
        private static final long serialVersionUID = 1L;
        public int total;
        public int valid;
        public int warn;
        public int error;
        /** 体态：IMPORT_CONFLICT 行数（默认跳过） */
        public int importConflict;
    }

    public static class Header implements Serializable {
        private static final long serialVersionUID = 1L;
        public String key;
        public String label;
        public String unit;
        public Header() {}
        public Header(String key, String label, String unit) {
            this.key = key; this.label = label; this.unit = unit;
        }
    }

    /** 单元格：ok/warn/error/ignore */
    public static class CellVo implements Serializable {
        private static final long serialVersionUID = 1L;
        public String key;
        public String raw;
        public String status;
        public String message;
        public CellVo() {}
        public CellVo(String key, String raw, String status, String message) {
            this.key = key; this.raw = raw; this.status = status; this.message = message;
        }
    }

    public static class ConflictVo implements Serializable {
        private static final long serialVersionUID = 1L;
        public String type;
        public Long existingId;
        public String existingSource;
        public ConflictVo() {}
        public ConflictVo(String type, Long existingId, String existingSource) {
            this.type = type; this.existingId = existingId; this.existingSource = existingSource;
        }
    }

    public static class RowVo implements Serializable {
        private static final long serialVersionUID = 1L;
        public int lineNo;
        public Long athleteId;
        public String athleteName;
        public boolean matched;
        public String date;
        public List<CellVo> cells = new ArrayList<>();
        public String rowError;
        public ConflictVo conflict;
    }

    // ---- getters/setters（FastJson 序列化 + EL 访问） ----
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getDomain() { return domain; }
    public void setDomain(String domain) { this.domain = domain; }
    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }
    public Summary getSummary() { return summary; }
    public void setSummary(Summary summary) { this.summary = summary; }
    public List<Header> getHeaders() { return headers; }
    public void setHeaders(List<Header> headers) { this.headers = headers; }
    public List<String> getIgnoredColumns() { return ignoredColumns; }
    public void setIgnoredColumns(List<String> ignoredColumns) { this.ignoredColumns = ignoredColumns; }
    public List<RowVo> getRows() { return rows; }
    public void setRows(List<RowVo> rows) { this.rows = rows; }
    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }
    public boolean isAllowOverwriteOption() { return allowOverwriteOption; }
    public void setAllowOverwriteOption(boolean allowOverwriteOption) { this.allowOverwriteOption = allowOverwriteOption; }
}
