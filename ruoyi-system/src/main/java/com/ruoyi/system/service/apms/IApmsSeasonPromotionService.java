package com.ruoyi.system.service.apms;

import com.ruoyi.system.domain.apms.ApmsPromotionPlan;
import com.ruoyi.system.domain.apms.ApmsPromotionRequest;

/**
 * 赛季整队晋升 Service
 *
 * <p>规则：
 * <ul>
 *   <li>按部门名中的 U+数字 识别梯队（如「U16 梯队」），仅在同一上级部门内寻找上一档</li>
 *   <li>cut-off 日当天周岁超过本档上限（age &gt;= N）的队员才晋升</li>
 *   <li>目标档 = 同一上级下能容纳该年龄的最小 U 档（自动跳过未建的中间档）</li>
 *   <li>已超龄但没有更高档梯队：留在原队并标记，人工处理</li>
 *   <li>只改 primary_team_id；历史测试成绩/评级不重算</li>
 * </ul>
 *
 * @author apms
 */
public interface IApmsSeasonPromotionService {

    /** 预览晋升名单（不落库） */
    ApmsPromotionPlan preview(ApmsPromotionRequest request);

    /** 执行晋升（服务端重新计算，事务内更新队伍并写晋升记录） */
    ApmsPromotionPlan execute(ApmsPromotionRequest request);
}
