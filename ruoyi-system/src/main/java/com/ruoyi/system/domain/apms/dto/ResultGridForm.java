package com.ruoyi.system.domain.apms.dto;

import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import com.fasterxml.jackson.annotation.JsonFormat;

/**
 * 测试成绩在线网格批量录入入参
 *
 * <p>行 = 队员，cells = 本次已测的直接指标（INDICATOR）；空单元格前端不上传。
 * taskId 非空 = 任务模式（服务端权威解析 task_item 归属并校验队员/指标属于该任务）；
 * taskId 为空 = 散录（task_item_id 为 null，走散录最佳试次分组）。
 *
 * @author apms
 */
public class ResultGridForm implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 单次人数 / 单人指标数上限（服务端硬校验） */
    public static final int MAX_ROWS = 100;
    public static final int MAX_CELLS_PER_ROW = 50;

    /** 关联任务ID（散录为 null） */
    private Long taskId;

    /** 全表统一测试日期 */
    @JsonFormat(pattern = "yyyy-MM-dd")
    private Date measureDate;

    /** 场次（可选，如 S1） */
    private String sessionKey;

    private List<Row> rows;

    public Long getTaskId() { return taskId; }
    public void setTaskId(Long taskId) { this.taskId = taskId; }
    public Date getMeasureDate() { return measureDate; }
    public void setMeasureDate(Date measureDate) { this.measureDate = measureDate; }
    public String getSessionKey() { return sessionKey; }
    public void setSessionKey(String sessionKey) { this.sessionKey = sessionKey; }
    public List<Row> getRows() { return rows; }
    public void setRows(List<Row> rows) { this.rows = rows; }

    /** 一名队员一行 */
    public static class Row implements Serializable {

        private static final long serialVersionUID = 1L;

        private Long athleteId;
        private List<Cell> cells;

        public Long getAthleteId() { return athleteId; }
        public void setAthleteId(Long athleteId) { this.athleteId = athleteId; }
        public List<Cell> getCells() { return cells; }
        public void setCells(List<Cell> cells) { this.cells = cells; }
    }

    /** 一格 = 一个直接指标的本次数值 */
    public static class Cell implements Serializable {

        private static final long serialVersionUID = 1L;

        private Long indicatorId;
        private BigDecimal value;

        public Long getIndicatorId() { return indicatorId; }
        public void setIndicatorId(Long indicatorId) { this.indicatorId = indicatorId; }
        public BigDecimal getValue() { return value; }
        public void setValue(BigDecimal value) { this.value = value; }
    }
}
