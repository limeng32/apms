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
    avatar: '',                    // 空串 → getInfo action 回退本地 defAva，不产生 HTTP
    sex: '0',
    status: '0'
  },
  roles: ['business_admin'],
  // 通配权限：保证 13 个业务页面内所有 v-hasPermi 按钮与真实 super 外观一致
  permissions: ['*:*:*'],
  portalMode: false,
  homePath: '',
  pwdChrtype: null,
  // 两个密码弹窗标志必须为 false，避免进入演示即弹改密框
  isDefaultModifyPwd: false,
  isPasswordExpired: false
}

/* ============================ GET /getRouters ============================ */
/* 蓝本：真实 GET /getRouters 的 APMS 顶级节点（menu_id=2200 对应 name=Apms），
   结构逐字段保留；不含系统管理目录（演示定位为 APMS 业务模块展示）。 */

export const apmsRouters = [
  {
    name: 'Apms',
    path: '/apms',
    hidden: false,
    redirect: 'noRedirect',
    component: 'Layout',
    alwaysShow: true,
    meta: { icon: 'star', link: null, noCache: false, title: 'APMS 系统' },
    children: [
      { name: 'Dashboard', path: 'dashboard', hidden: false, component: 'apms/dashboard/index', meta: { icon: 'dashboard', link: null, noCache: false, title: '数据驾驶舱' } },
      { name: 'Athlete', path: 'athlete', hidden: false, component: 'apms/athlete/index', meta: { icon: 'user', link: null, noCache: false, title: '花名册' } },
      { name: 'Indicator', path: 'indicator', hidden: false, component: 'apms/indicator/index', meta: { icon: 'list', link: null, noCache: false, title: '指标库' } },
      { name: 'TestModel', path: 'testModel', hidden: false, component: 'apms/testModel/index', meta: { icon: 'build', link: null, noCache: false, title: '测试模型库' } },
      { name: 'TestTask', path: 'testTask', hidden: false, component: 'apms/testTask/index', meta: { icon: 'date', link: null, noCache: false, title: '测试任务' } },
      { name: 'TestResult', path: 'testResult', hidden: false, component: 'apms/testResult/index', meta: { icon: 'edit', link: null, noCache: false, title: '测试结果' } },
      { name: 'BodyMeasure', path: 'bodyMeasure', hidden: false, component: 'apms/bodyMeasure/index', meta: { icon: 'people', link: null, noCache: false, title: '体态测量' } },
      { name: 'Phv', path: 'phv', hidden: false, component: 'apms/phv/index', meta: { icon: 'chart', link: null, noCache: false, title: 'PHV 成熟度' } },
      { name: 'Rtp', path: 'rtp', hidden: false, component: 'apms/rtp/index', meta: { icon: 'monitor', link: null, noCache: false, title: 'RTP 状态管理' } },
      { name: 'RtpWarning', path: 'rtpWarning', hidden: false, component: 'apms/rtpWarning/index', meta: { icon: 'bell', link: null, noCache: false, title: 'RTP 风险预警' } },
      { name: 'ComboModel', path: 'comboModel', hidden: false, component: 'apms/comboModel/index', meta: { icon: 'component', link: null, noCache: false, title: '组合模型' } },
      { name: 'ComboScore', path: 'comboScore', hidden: false, component: 'apms/comboScore/index', meta: { icon: 'validCode', link: null, noCache: false, title: '组合体能评分' } },
      { name: 'Medical', path: 'medical', hidden: false, component: 'apms/medical/index', meta: { icon: 'documentation', link: null, noCache: false, title: '医疗康复' } },
      { name: 'Report', path: 'report', hidden: false, component: 'apms/report/index', meta: { icon: 'form', link: null, noCache: false, title: '报告中心' } }
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
    noticeTitle: '欢迎使用 APMS 运动员管理系统演示环境',
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
  { deptId: 205, parentId: 200, ancestors: '0,200,205', deptName: '力量组', deptType: '30', orderNum: 5, leader: '赵体能师', phone: '13800000205', email: 'strength@apms.demo', status: '0', parentName: 'APMS 总部', children: [] }
]
