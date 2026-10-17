package com.ruoyi.framework.captcha;

import java.util.List;

/**
 * 图形点选校验请求体
 *
 * @author apms
 */
public class ClickCheckBody
{
    /** 挑战标识 */
    private String uuid;

    /** 按点击顺序回传的画布坐标点（须恰好 3 个） */
    private List<Point> points;

    public static class Point
    {
        private Integer x;
        private Integer y;

        public Integer getX() { return x; }
        public void setX(Integer x) { this.x = x; }
        public Integer getY() { return y; }
        public void setY(Integer y) { this.y = y; }
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public List<Point> getPoints() { return points; }
    public void setPoints(List<Point> points) { this.points = points; }
}
