package com.ruoyi.framework.captcha;

/**
 * 滑块拼图校验请求体
 *
 * @author apms
 */
public class SliderCheckBody {

    /** 挑战标识 */
    private String uuid;

    /** 拼图块左沿最终位移（画布坐标，前端按显示比例换算） */
    private Integer x;

    /** 拖拽耗时（ms），用于人机行为判定 */
    private Long duration;

    /** 拖拽轨迹采样点数 */
    private Integer points;

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Integer getX() { return x; }
    public void setX(Integer x) { this.x = x; }

    public Long getDuration() { return duration; }
    public void setDuration(Long duration) { this.duration = duration; }

    public Integer getPoints() { return points; }
    public void setPoints(Integer points) { this.points = points; }
}
