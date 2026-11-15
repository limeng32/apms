/**
 * 演示模式 · 助手本地能力与本地伪流式（零网络）。
 * 路径与 mock/fixtures/system.js 的 2400 菜单树保持一致。
 */

export const DEMO_PATHS = [
  '/overview/cockpit',
  '/athletes/roster',
  '/athletes/growth',
  '/testings/dispatch',
  '/testings/combo-dispatch',
  '/healthcare/alert-center',
  '/healthcare/medical-care',
  '/analytics/report-center'
]

export const DEMO_SUGGESTIONS = [
  // 数据查询类样例置顶：与下方「操作导航类」问法不同，这条直接消费 APMS 内部业务数据
  '运动员张志远的训练情况',
  '怎么新增运动员',
  '怎么导入测试成绩',
  '组合评分怎么算',
  '报告在哪里下载'
]

const ANSWERS = {
  // 数据均取自 mock/fixtures/business.js：athletes(1001)、athleteGroups、taskMembers、testResults
  ATHLETE_PROFILE: '张志远 · U18 梯队 10 号中场，17 岁，身高 175.2cm、体重 65.3kg，目前在队；\n'
    + 'RTP 状态为绿灯，可正常参训，现编入速度专项组。\n'
    + '近期测试（冬季体能测试 · U18，2024-12-12）：\n'
    + '· 纵跳高度 58.0cm，评级 Good\n'
    + '· RSA 10×20m Sdec 5.8%，评级 Good（该指标越低越好）\n'
    + '测试任务进度：3 项已完成，1 项待执行。完整履历可在花名册档案中查看。',
  ATHLETE_CREATE: '1. 进入「花名册」，点击右上角「新建运动员档案」。\n'
    + '2. 填写姓名、性别、出生日期、主队伍等信息。\n'
    + '3. 新建运动员不会自动生成 RTP 状态。',
  PHV_HOW: '1. 进入「青训发育监控」，上半区录入体态测量。\n'
    + '2. 下半区打开 PHV 计算弹窗。\n'
    + '3. 计算会保存输入快照与算法版本。',
  IMPORT_RESULT: '1. 进入「指标库与任务下发」，切换到「测试结果」页签。\n'
    + '2. 点击右上角「批量导入」，先预览再确认入库。',
  COMBO_SCORE: '1. 进入「组合测试调度」，切换到「评分记录」页签。\n'
    + '2. 点击右上角「批量计算」，选择组合模型与任务。',
  RTP_EDIT: '1. 进入「健康预警中心」的 RTP 状态看板。\n'
    + '2. 拖动卡片或打开抽屉进行评估处置。',
  REPORT_GENERATE: '1. 进入「报告中心」，点击右上角「生成新报告」。\n'
    + '2. 选择类型并填写对象，生成后可下载。',
  REPORT_DOWNLOAD: '1. 进入「报告中心」，在左侧选中一条报告。\n'
    + '2. 右侧详情点击「下载 PDF 报告」。',
  FALLBACK: '我可以帮你查询演示数据，也能定位系统页面与操作流程。试试问：运动员张志远的训练情况、怎么新增运动员、怎么导入成绩、报告在哪下载。'
}

function matchIntent(question) {
  const q = String(question || '').toLowerCase()
  // 数据查询类：以 mock 中真实存在的队员姓名做强锚定，避免与下方操作类关键词互相误命中
  if (/张志远/.test(q)) return 'ATHLETE_PROFILE'
  if (/新增运动员|新建运动员|建档|添加运动员/.test(q)) return 'ATHLETE_CREATE'
  if (/phv|生长发育|成熟度|成年身高/.test(q)) return 'PHV_HOW'
  if (/导入成绩|成绩导入|批量导入|体测导入|导入体测|导入测试|测试成绩|体测|csv|excel|xlsx|导入/.test(q)) return 'IMPORT_RESULT'
  if (/组合评分|组合分|组合模型|加权|t分/.test(q)) return 'COMBO_SCORE'
  if (/rtp|参训状态|红黄绿|评估处置/.test(q)) return 'RTP_EDIT'
  if (/生成报告|报告生成|新建报告|重新生成/.test(q)) return 'REPORT_GENERATE'
  if (/报告下载|下载报告|pdf下载|下载pdf|导出报告|报告在哪|在哪下载|报告|下载/.test(q)) return 'REPORT_DOWNLOAD'
  return 'FALLBACK'
}

function actionFor(intent) {
  if (intent === 'ATHLETE_CREATE') {
    return {
      type: 'navigate',
      path: '/athletes/roster',
      label: '打开花名册并定位新建按钮',
      highlightKey: 'athlete-add',
      requiresPerm: ['apms:athlete:add'],
      durationMs: 3000
    }
  }
  const map = {
    // 数据查询类只导航到花名册（行内档案无默认可见锚点，按严格一致原则不带 highlightKey）
    ATHLETE_PROFILE: ['/athletes/roster', '打开花名册查看张志远档案'],
    PHV_HOW: ['/athletes/growth', '打开青训发育监控'],
    IMPORT_RESULT: ['/testings/dispatch', '打开指标库与任务下发'],
    COMBO_SCORE: ['/testings/combo-dispatch', '打开组合测试调度'],
    RTP_EDIT: ['/healthcare/alert-center', '打开健康预警中心'],
    REPORT_GENERATE: ['/analytics/report-center', '打开报告中心'],
    REPORT_DOWNLOAD: ['/analytics/report-center', '打开报告中心']
  }
  const entry = map[intent]
  if (!entry) return null
  return { type: 'navigate', path: entry[0], label: entry[1] }
}

export function demoCapabilities() {
  return {
    version: 'v1',
    provider: 'pseudo',
    paths: DEMO_PATHS.slice(),
    suggestions: DEMO_SUGGESTIONS.slice()
  }
}

/**
 * 本地伪流式：同步发送 meta/delta/action/done，不走 fetch/axios。
 */
export function demoChatStream(payload, { onEvent, signal } = {}) {
  if (signal && signal.aborted) return Promise.resolve()
  const emit = (event, data) => {
    if (!signal || !signal.aborted) onEvent(event, data)
  }
  const intent = matchIntent(payload && payload.message)
  const action = actionFor(intent)
  const messageId = 'demo-' + Date.now()
  emit('meta', { messageId, provider: 'pseudo', version: 'v1' })
  emit('delta', { text: ANSWERS[intent] || ANSWERS.FALLBACK })
  if (action) emit('action', action)
  emit('done', { finishReason: 'stop' })
  return Promise.resolve()
}
