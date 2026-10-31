package com.ruoyi.system.domain.apms.assistant;

/**
 * 请求附带的前端上下文。
 */
public class AssistantContext
{
    private String route;
    private String pageTitle;
    private Long entityId;

    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public String getPageTitle() { return pageTitle; }
    public void setPageTitle(String pageTitle) { this.pageTitle = pageTitle; }
    public Long getEntityId() { return entityId; }
    public void setEntityId(Long entityId) { this.entityId = entityId; }
}
