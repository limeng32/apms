package com.ruoyi.system.service.apms.batchimport;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 成绩导入 Redis 草稿（仅含 commit 必需数据，预览态不入库）。
 *
 * @author apms
 */
public class ResultImportDraft extends ImportDraft {

    private static final long serialVersionUID = 1L;

    /** 行号 → 可提交行（仅含 ok/warn 且无行错误的行；MODEL 列不含） */
    private List<DraftRow> rows = new ArrayList<>();

    public static class DraftRow implements Serializable {
        private static final long serialVersionUID = 1L;
        public int lineNo;
        public Long athleteId;
        /** YYYY-MM-DD 标准日期（preview 已校验） */
        public String measureDate;
        public String sessionKey;
        /** 本期散录恒为 null；任务导入时挂任务 */
        public Long taskId;
        public List<DraftCell> cells = new ArrayList<>();
    }

    public static class DraftCell implements Serializable {
        private static final long serialVersionUID = 1L;
        public Long indicatorId;
        public String code;
        public BigDecimal value;
    }

    public List<DraftRow> getRows() { return rows; }
    public void setRows(List<DraftRow> rows) { this.rows = rows; }
}
