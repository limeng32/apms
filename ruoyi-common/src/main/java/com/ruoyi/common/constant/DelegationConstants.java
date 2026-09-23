package com.ruoyi.common.constant;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

/**
 * 专岗角色委派权限常量（D9/D10）
 *
 * @author ruoyi
 */
public class DelegationConstants
{
    /** Portal专岗角色key前缀 */
    public static final String PORTAL_ROLE_PREFIX = "portal_";

    /** 受保护、不可由客户账号管理的角色key */
    public static final Set<String> PROTECTED_ROLE_KEYS = Collections.unmodifiableSet(
            new HashSet<>(Arrays.asList("admin", "business_admin")));

    /** 总览看板组件路径（无perms，以component识别） */
    public static final Set<String> DELEGATABLE_COMPONENTS = Collections.unmodifiableSet(
            new HashSet<>(Collections.singletonList("apms/dashboard/index")));

    /** 可委派的功能权限码白名单（C/F菜单行的perms） */
    public static final Set<String> DELEGATABLE_PERMS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            // 运动员档案
            "apms:athlete:list",
            "apms:athlete:query",
            // 指标库
            "apms:indicator:list",
            "apms:indicator:query",
            // 测试模型库
            "apms:testModel:list",
            "apms:testModel:query",
            // 测试任务
            "apms:testTask:list",
            "apms:testTask:query",
            "apms:testTask:edit",
            // 测试结果
            "apms:testResult:list",
            "apms:testResult:query",
            "apms:testResult:add",
            "apms:testResult:edit",
            // 体态测量
            "apms:body:list",
            "apms:body:query",
            "apms:body:edit",
            // PHV成熟度
            "apms:phv:list",
            "apms:phv:query",
            "apms:phv:edit",
            // RTP风险预警
            "apms:rtp:list",
            "apms:rtp:query",
            "apms:rtp:edit",
            "apms:rtp:clear",
            // 组合体能评分
            "apms:comboScore:list",
            "apms:comboScore:query",
            // 医疗记录
            "apms:medicalRecord:list",
            "apms:medicalRecord:query",
            "apms:medicalRecord:add",
            "apms:medicalRecord:edit",
            // 报告中心
            "apms:report:list",
            "apms:report:query",
            "apms:report:download"
    )));

    /**
     * 判断角色key是否为Portal专岗角色
     */
    public static boolean isPortalRole(String roleKey)
    {
        return roleKey != null && roleKey.startsWith(PORTAL_ROLE_PREFIX);
    }
}
