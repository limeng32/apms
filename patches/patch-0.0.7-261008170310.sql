-- ======================================================================
-- patch-0.0.7-261008170310
-- 所有角色登录后统一落地「数据驾驶舱」(/overview/cockpit)：
--   将三个门户专岗角色的 home_path 归一到驾驶舱
--   （coach 历史补丁已是该值，tester/medic 原分别指向测试调度/医疗康复）。
-- 前端守卫同步改为无条件重定向（不再按 portalMode/homePath 分叉），
-- 本补丁保证库内配置、角色管理页「落地页」字段、门户角色访问未注册路由
-- 时的回退目标三者一致。2401/2402 菜单此前已授予三角色，路由可达。
-- 幂等：UPDATE 带旧值守卫，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

UPDATE sys_role
   SET home_path = '/overview/cockpit', update_time = NOW()
 WHERE role_key IN ('portal_coach', 'portal_tester', 'portal_medic')
   AND (home_path IS NULL OR home_path <> '/overview/cockpit');

-- 验收：三行均应为 /overview/cockpit
-- SELECT role_key, home_path FROM sys_role
--  WHERE role_key IN ('portal_coach', 'portal_tester', 'portal_medic');
