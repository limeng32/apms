-- ======================================================================
-- patch-0.0.6-261007114125
-- 菜单图标统一改为 Lucide 线性风格（stroke-width 1.8，圆角端点）
--   图标命名与 demo（lucide-react）保持一致：
--     数据驾驶舱=LayoutDashboard 花名册=Users 青训发育监控=TrendingUp
--     纵向趋势=LineChart 指标库与任务下发=ClipboardList 组合测试调度=Layers
--     健康预警中心=HeartPulse 医疗康复=Stethoscope 报告中心=FileText
--     角色权限管理=ShieldCheck
--   对应 SVG 文件已置于 ruoyi-ui/src/assets/icons/svg/
-- 涉及 2200 系列（业务角色菜单）与 2400 系列（super 分组菜单）
-- 幂等：UPDATE 直接覆盖，可重复执行
-- ======================================================================

SET NAMES utf8mb4;

-- ----------------------------------------------------------------------
-- 2200 系列（业务角色菜单）
-- ----------------------------------------------------------------------
UPDATE sys_menu SET icon = 'layout-dashboard' WHERE menu_id = 2201;  -- 数据驾驶舱
UPDATE sys_menu SET icon = 'users'            WHERE menu_id = 2210;  -- 花名册
UPDATE sys_menu SET icon = 'book-open'        WHERE menu_id = 2231;  -- 指标库
UPDATE sys_menu SET icon = 'flask-conical'    WHERE menu_id = 2232;  -- 测试模型库
UPDATE sys_menu SET icon = 'calendar-check'   WHERE menu_id = 2241;  -- 测试任务
UPDATE sys_menu SET icon = 'clipboard-check'  WHERE menu_id = 2242;  -- 测试结果
UPDATE sys_menu SET icon = 'ruler'            WHERE menu_id = 2251;  -- 体态测量
UPDATE sys_menu SET icon = 'trending-up'      WHERE menu_id = 2252;  -- PHV 成熟度
UPDATE sys_menu SET icon = 'activity'         WHERE menu_id = 2261;  -- RTP 状态管理
UPDATE sys_menu SET icon = 'layers'           WHERE menu_id = 2262;  -- 组合模型
UPDATE sys_menu SET icon = 'chart-line'       WHERE menu_id = 2263;  -- 组合体能评分
UPDATE sys_menu SET icon = 'triangle-alert'   WHERE menu_id = 2264;  -- RTP 风险预警
UPDATE sys_menu SET icon = 'stethoscope'      WHERE menu_id = 2271;  -- 医疗康复
UPDATE sys_menu SET icon = 'file-text'        WHERE menu_id = 2281;  -- 报告中心
UPDATE sys_menu SET icon = 'shield-check'     WHERE menu_id = 2200;  -- APMS 系统（根）

-- ----------------------------------------------------------------------
-- 2400 系列（super 分组菜单，与 demo lucide 图标一一对应）
-- ----------------------------------------------------------------------
UPDATE sys_menu SET icon = 'users'            WHERE menu_id = 2410;  -- 运动员（目录）
UPDATE sys_menu SET icon = 'users'            WHERE menu_id = 2411;  -- 花名册
UPDATE sys_menu SET icon = 'trending-up'      WHERE menu_id = 2412;  -- 青训发育监控
UPDATE sys_menu SET icon = 'chart-line'       WHERE menu_id = 2415;  -- 纵向趋势
UPDATE sys_menu SET icon = 'flask-conical'    WHERE menu_id = 2420;  -- 测试（目录）
UPDATE sys_menu SET icon = 'clipboard-list'   WHERE menu_id = 2421;  -- 指标库与任务下发
UPDATE sys_menu SET icon = 'layers'           WHERE menu_id = 2425;  -- 组合测试调度
UPDATE sys_menu SET icon = 'activity'         WHERE menu_id = 2430;  -- 健康（目录）
UPDATE sys_menu SET icon = 'heart-pulse'      WHERE menu_id = 2431;  -- 健康预警中心
UPDATE sys_menu SET icon = 'stethoscope'      WHERE menu_id = 2434;  -- 医疗康复
UPDATE sys_menu SET icon = 'chart-line'       WHERE menu_id = 2440;  -- 分析（目录）
UPDATE sys_menu SET icon = 'file-text'        WHERE menu_id = 2441;  -- 报告中心
UPDATE sys_menu SET icon = 'settings'         WHERE menu_id = 2450;  -- 系统（目录）
UPDATE sys_menu SET icon = 'shield-check'     WHERE menu_id = 2451;  -- 角色权限管理
