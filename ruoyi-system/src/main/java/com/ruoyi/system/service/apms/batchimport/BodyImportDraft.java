package com.ruoyi.system.service.apms.batchimport;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 体态测量导入 Redis 草稿。
 *
 * @author apms
 */
public class BodyImportDraft extends ImportDraft {

    private static final long serialVersionUID = 1L;

    private List<DraftRow> rows = new ArrayList<>();

    public static class DraftRow implements Serializable {
        private static final long serialVersionUID = 1L;
        public int lineNo;
        public Long athleteId;
        /** yyyy-MM-dd */
        public String measureDate;
        public BigDecimal height;
        public BigDecimal weight;
        public BigDecimal sitHeight;
        public BigDecimal bodyFatRate;
        public BigDecimal waist;
        /** null=新增；非空=当天已有 import 记录，默认跳过，overwriteImport=true 时覆盖 */
        public Long conflictExistingId;

        public boolean isConflict() { return conflictExistingId != null; }
    }

    public List<DraftRow> getRows() { return rows; }
    public void setRows(List<DraftRow> rows) { this.rows = rows; }
}
