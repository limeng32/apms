package com.ruoyi.system.domain.apms.assistant;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * 助手下发的前端动作（M1 仅 navigate）。
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssistantAction
{
    /** 动作类型：navigate */
    private String type;
    private String path;
    private String label;
    /** 仅当目标页默认渲染即可见时才下发 */
    private String highlightKey;
    /** 前端执行高亮前复核的按钮权限 */
    private List<String> requiresPerm;
    /** 高亮展示时长（毫秒） */
    private Integer durationMs;

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getHighlightKey() { return highlightKey; }
    public void setHighlightKey(String highlightKey) { this.highlightKey = highlightKey; }
    public List<String> getRequiresPerm() { return requiresPerm; }
    public void setRequiresPerm(List<String> requiresPerm) { this.requiresPerm = requiresPerm; }
    public Integer getDurationMs() { return durationMs; }
    public void setDurationMs(Integer durationMs) { this.durationMs = durationMs; }
}
