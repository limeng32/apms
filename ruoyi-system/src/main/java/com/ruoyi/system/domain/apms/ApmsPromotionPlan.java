package com.ruoyi.system.domain.apms;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 赛季晋升预览/执行结果
 *
 * @author apms
 */
public class ApmsPromotionPlan {

    /** 生效的赛季 cut-off 日期（yyyy-MM-dd） */
    private String cutoffDate;

    /** 执行批次号（仅执行时有值） */
    private String batchNo;

    /** 识别到的梯队清单（按父部门分组后的扁平列表） */
    private List<Map<String, Object>> teams = new ArrayList<>();

    /** 每个运动员的处置行 */
    private List<ApmsPromotionItem> items = new ArrayList<>();

    /** 配置问题（如同一上级下出现两个 U16）；存在配置问题时禁止执行 */
    private List<String> configErrors = new ArrayList<>();

    private int promoteCount;
    private int stayYoungCount;
    private int stayOverAgeCount;
    private int noBirthdayCount;
    private int invalidTeamCount;

    public void addTeam(Long deptId, String deptName, Long parentId, Integer bracket, int memberCount) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("deptId", deptId);
        m.put("deptName", deptName);
        m.put("parentId", parentId);
        m.put("bracket", bracket);
        m.put("memberCount", memberCount);
        teams.add(m);
    }

    public String getCutoffDate() { return cutoffDate; }
    public void setCutoffDate(String cutoffDate) { this.cutoffDate = cutoffDate; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public List<Map<String, Object>> getTeams() { return teams; }
    public void setTeams(List<Map<String, Object>> teams) { this.teams = teams; }
    public List<ApmsPromotionItem> getItems() { return items; }
    public void setItems(List<ApmsPromotionItem> items) { this.items = items; }
    public List<String> getConfigErrors() { return configErrors; }
    public void setConfigErrors(List<String> configErrors) { this.configErrors = configErrors; }
    public int getPromoteCount() { return promoteCount; }
    public void setPromoteCount(int promoteCount) { this.promoteCount = promoteCount; }
    public int getStayYoungCount() { return stayYoungCount; }
    public void setStayYoungCount(int stayYoungCount) { this.stayYoungCount = stayYoungCount; }
    public int getStayOverAgeCount() { return stayOverAgeCount; }
    public void setStayOverAgeCount(int stayOverAgeCount) { this.stayOverAgeCount = stayOverAgeCount; }
    public int getNoBirthdayCount() { return noBirthdayCount; }
    public void setNoBirthdayCount(int noBirthdayCount) { this.noBirthdayCount = noBirthdayCount; }
    public int getInvalidTeamCount() { return invalidTeamCount; }
    public void setInvalidTeamCount(int invalidTeamCount) { this.invalidTeamCount = invalidTeamCount; }
}
