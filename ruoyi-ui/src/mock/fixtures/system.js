/**
 * 演示模式 · 框架级静态数据（喂给真实 getInfo()/菜单/字典机制）
 *
 * - getInfoBody / apmsRouters / dictMap 为只读常量，handler 直接引用（不经可变 db）；
 * - notices / depts 为可变表，经 db.js 深拷贝后供 handler 读写；
 * - 蓝本取自 dev 真实接口（2026-09-28，super/business_admin），仅保留 APMS 目录。
 */

/* ============================ GET /getInfo ============================ */

export const getInfoBody = {
  code: 200,
  msg: '操作成功',
  user: {
    userId: -1,
    userName: 'super',
    nickName: '体验账号（super）',
    avatar: '',                    // 前端已移除头像展示与设置，字段保留仅为对齐后端 getInfo 结构
    sex: '0',
    status: '0'
  },
  // 与真实库一致：super 用户(100) 已由 business_admin 切换到 super 角色（role_id=200，
  // 见 patch-0.0.6-2610061605）
  roles: ['super'],
  // 通配权限：演示无后端鉴权，保证所有 v-hasPermi 按钮与真实 super 外观一致
  permissions: ['*:*:*'],
  portalMode: false,
  homePath: '',
  pwdChrtype: null,
  // 两个密码弹窗标志必须为 false，避免进入演示即弹改密框
  isDefaultModifyPwd: false,
  isPasswordExpired: false
}

/* ============================ GET /getRouters ============================ */
/* 蓝本：super 角色（role_id=200）的真实 2400 分组菜单树（patch-0.0.6 ~ 0.0.7 系列）。
   六个两组结构（顶级 M=Layout + C 子页），F 型权限点不进路由树：
     总览(数据驾驶舱)
     运动员(花名册 / 青训发育监控)
     测试(指标库与任务下发 / 组合测试调度)
     健康(健康预警中心 / 医疗康复)
     分析(报告中心)
     系统(角色权限管理 / 组织架构)
   字段与后端 RouterVo/MetaVo 同构：顶级 M path 带前导 /、redirect=noRedirect、
   alwaysShow=true；C 页 path 不带前导 /；name=path 首字母大写。 */

export const apmsRouters = [
  {
    name: 'Overview',
    path: '/overview',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: '', link: null, noCache: false, title: '总览' },
    children: [
      { name: 'Cockpit', path: 'cockpit', hidden: false, component: 'apms/dashboard/index', meta: { icon: 'layout-dashboard', link: null, noCache: false, title: '数据驾驶舱' } }
    ]
  },
  {
    name: 'Athletes',
    path: '/athletes',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: 'users', link: null, noCache: false, title: '运动员' },
    children: [
      { name: 'Roster', path: 'roster', hidden: false, component: 'apms/athlete/index', meta: { icon: 'users', link: null, noCache: false, title: '花名册' } },
      { name: 'Growth', path: 'growth', hidden: false, component: 'apms/growth/index', meta: { icon: 'trending-up', link: null, noCache: false, title: '青训发育监控' } }
    ]
  },
  {
    name: 'Testings',
    path: '/testings',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: 'flask-conical', link: null, noCache: false, title: '测试' },
    children: [
      { name: 'Dispatch', path: 'dispatch', hidden: false, component: 'apms/dispatch/index', meta: { icon: 'clipboard-list', link: null, noCache: false, title: '指标库与任务下发' } },
      { name: 'Combo-dispatch', path: 'combo-dispatch', hidden: false, component: 'apms/comboDispatch/index', meta: { icon: 'layers', link: null, noCache: false, title: '组合测试调度' } }
    ]
  },
  {
    name: 'Healthcare',
    path: '/healthcare',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: 'activity', link: null, noCache: false, title: '健康' },
    children: [
      { name: 'Alert-center', path: 'alert-center', hidden: false, component: 'apms/healthAlert/index', meta: { icon: 'heart-pulse', link: null, noCache: false, title: '健康预警中心' } },
      { name: 'Medical-care', path: 'medical-care', hidden: false, component: 'apms/medical/index', meta: { icon: 'stethoscope', link: null, noCache: false, title: '医疗康复' } }
    ]
  },
  {
    name: 'Analytics',
    path: '/analytics',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: 'chart-line', link: null, noCache: false, title: '分析' },
    children: [
      { name: 'Report-center', path: 'report-center', hidden: false, component: 'apms/report/index', meta: { icon: 'file-text', link: null, noCache: false, title: '报告中心' } }
    ]
  },
  {
    name: 'Sysmgr',
    path: '/sysmgr',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: 'settings', link: null, noCache: false, title: '系统' },
    children: [
      { name: 'Role-acl', path: 'role-acl', hidden: false, component: 'system/role/index', meta: { icon: 'shield-check', link: null, noCache: false, title: '角色权限管理' } },
      { name: 'Org', path: 'org', hidden: false, component: 'system/dept/index', meta: { icon: 'tree', link: null, noCache: false, title: '组织架构' } }
    ]
  }
]

/* ===================== GET /system/dict/data/type/:type ===================== */
/* APMS 页面经 useDict 实际消费的字典（grep 核实仅 2 个）+ 常用框架字典兜底。 */

function dict(type, sort, label, value, listClass, isDefault = false) {
  return {
    dictType: type,
    dictSort: sort,
    dictLabel: label,
    dictValue: value,
    listClass,
    cssClass: null,
    isDefault: isDefault ? 'Y' : 'N',
    default: isDefault
  }
}

export const dictMap = {
  apms_position: [
    dict('apms_position', 1, '门将', 'GK', 'primary'),
    dict('apms_position', 2, '后卫', 'DF', 'success'),
    dict('apms_position', 3, '中场', 'MF', 'info'),
    dict('apms_position', 4, '前锋', 'FW', 'warning')
  ],
  apms_athlete_status: [
    dict('apms_athlete_status', 1, '在队', '0', 'success', true),
    dict('apms_athlete_status', 2, '离队', '1', 'info'),
    dict('apms_athlete_status', 3, '退役', '2', 'danger')
  ],
  apms_dept_type: [
    dict('apms_dept_type', 1, '总部', '10', 'primary'),
    dict('apms_dept_type', 2, '梯队', '20', 'success'),
    dict('apms_dept_type', 3, '专项组', '30', 'info'),
    dict('apms_dept_type', 4, '康复组', '50', 'warning')
  ],
  sys_user_sex: [
    dict('sys_user_sex', 1, '男', '0', 'primary', true),
    dict('sys_user_sex', 2, '女', '1', 'danger'),
    dict('sys_user_sex', 3, '未知', '2', 'info')
  ],
  sys_normal_disable: [
    dict('sys_normal_disable', 1, '正常', '0', 'primary', true),
    dict('sys_normal_disable', 2, '停用', '1', 'danger')
  ]
}

/* ============================ 可变表（经 db 深拷贝） ============================ */

/* 顶部公告（Navbar 铃铛 onMounted 即拉 listTop） */
export const notices = [
  {
    noticeId: 1,
    noticeTitle: '欢迎使用 运动员训练数据管理系统演示环境',
    noticeType: '2',
    status: '0',
    isRead: false,
    noticeContent: '本环境为静态演示：所有数据均为样本数据，新增、修改、删除仅在当前标签页生效，刷新页面后全部还原。文件下载/上传在演示环境中不可用。',
    createTime: '2026-09-28 09:00:00'
  },
  {
    noticeId: 2,
    noticeTitle: '演示数据每周自动重置说明',
    noticeType: '1',
    status: '0',
    isRead: false,
    noticeContent: '演示环境不连接生产数据库，无需数据清理：每次刷新页面都会从内置样本重新生成一份全新数据。',
    createTime: '2026-09-27 15:30:00'
  }
]

/* 部门/队伍（花名册筛选与归属使用；蓝本取自真实 /system/dept/list 的 APMS 子树）。
   与真实接口一致返回扁平列表（children 均为空数组），树由前端 handleTree 构建。 */
export const depts = [
  { deptId: 200, parentId: 0, ancestors: '0,200', deptName: 'APMS 总部', deptType: '10', orderNum: 10, leader: '张领队', phone: '13800000200', email: 'hq@apms.demo', status: '0', parentName: null, children: [] },
  { deptId: 201, parentId: 200, ancestors: '0,200,201', deptName: 'U18 梯队', deptType: '20', orderNum: 1, leader: '李指导', phone: '13800000201', email: 'u18@apms.demo', status: '0', parentName: 'APMS 总部', children: [] },
  { deptId: 202, parentId: 200, ancestors: '0,200,202', deptName: 'U16 梯队', deptType: '20', orderNum: 2, leader: '王指导', phone: '13800000202', email: 'u16@apms.demo', status: '0', parentName: 'APMS 总部', children: [] },
  { deptId: 203, parentId: 200, ancestors: '0,200,203', deptName: '速度专项组', deptType: '30', orderNum: 3, leader: '陈教练', phone: '13800000203', email: 'speed@apms.demo', status: '0', parentName: 'APMS 总部', children: [] },
  { deptId: 204, parentId: 200, ancestors: '0,200,204', deptName: '康复组', deptType: '50', orderNum: 4, leader: '刘康复师', phone: '13800000204', email: 'rehab@apms.demo', status: '0', parentName: 'APMS 总部', children: [] },
  { deptId: 205, parentId: 200, ancestors: '0,200,205', deptName: '力量组', deptType: '30', orderNum: 5, leader: '赵体能师', phone: '13800008205', email: 'strength@apms.demo', status: '0', parentName: 'APMS 总部', children: [] }
]

/* 角色列表（系统 → 角色权限管理页 GET /system/role/list 使用）。
   蓝本取自真实库 super 可见的角色（200 super + 三门户专岗；
   admin(1)/business_admin(100) 按权限设计对 super 不可见，演示从略）。
   演示态只读：新增/修改/删除等写操作由 mock 引擎统一 601 拦截。 */
export const roles = [
  {
    roleId: 200, roleName: '超级用户', roleKey: 'super', roleSort: 1,
    dataScope: '1', menuCheckStrictly: true, deptCheckStrictly: true,
    status: '0', delFlag: '0', remark: '客户侧超级账号', portalMode: '0', homePath: '',
    createBy: 'admin', createTime: '2026-10-06 16:05:00'
  },
  {
    roleId: 201, roleName: '教练', roleKey: 'portal_coach', roleSort: 2,
    dataScope: '1', menuCheckStrictly: true, deptCheckStrictly: true,
    status: '0', delFlag: '0', remark: '只读分析岗', portalMode: '1', homePath: '/overview/cockpit',
    createBy: 'admin', createTime: '2026-09-23 14:00:00'
  },
  {
    roleId: 202, roleName: '测量员', roleKey: 'portal_tester', roleSort: 3,
    dataScope: '1', menuCheckStrictly: true, deptCheckStrictly: true,
    status: '0', delFlag: '0', remark: '测量执行岗', portalMode: '1', homePath: '/testings/dispatch',
    createBy: 'admin', createTime: '2026-09-23 14:00:00'
  },
  {
    roleId: 203, roleName: '队医', roleKey: 'portal_medic', roleSort: 4,
    dataScope: '1', menuCheckStrictly: true, deptCheckStrictly: true,
    status: '0', delFlag: '0', remark: '医疗保障岗', portalMode: '1', homePath: '/healthcare/medical-care',
    createBy: 'admin', createTime: '2026-09-23 14:00:00'
  }
]
