package com.ruoyi.system.service.apms;

import java.util.List;
import com.ruoyi.system.domain.apms.ApmsComboScore;

public interface IApmsComboScoreService {

    List<ApmsComboScore> list(ApmsComboScore query);

    ApmsComboScore selectById(Long id);

    /**
     * 触发批量计算
     */
    BatchResult batchCalculate(Long comboModelId, Long taskId);

    /** 单条重算 */
    void recalculate(Long athleteId, Long comboModelId, Long triggerResultId);

    int deleteById(Long id);

    public static class BatchResult {
        public int totalAthletes;
        public int successCount;
        public int skipCount;
        public List<AthleteItem> items;
        public String algoVersion;

        public static class AthleteItem {
            public Long athleteId;
            public String athleteName;
            public Double comboScore;
            public String status;
            public String reason;
        }
    }
}

