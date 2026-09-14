/* ============================================================
   静态演示数据（虚构，仅用于界面演示）
   ============================================================ */

// rtp: g=正常全量(绿) y=限制参训(黄) r=不建议训练(红)
const PLAYERS = [
  { id: 1,  name: '周启航', no: 10, pos: '前锋',     rtp: 'g', color: '#4a78c9' },
  { id: 2,  name: '林泽宇', no: 1,  pos: '守门员',   rtp: 'g', color: '#7a63c9' },
  { id: 3,  name: '赵沐阳', no: 7,  pos: '右边锋',   rtp: 'y', color: '#c96a5a' },
  { id: 4,  name: '陈予安', no: 8,  pos: '中前卫',   rtp: 'y', color: '#3d8a6e' },
  { id: 5,  name: '方俊熙', no: 4,  pos: '中后卫',   rtp: 'g', color: '#4f8fb0' },
  { id: 6,  name: '孙秉诚', no: 9,  pos: '中锋',     rtp: 'g', color: '#9c7a44' },
  { id: 7,  name: '许嘉佑', no: 6,  pos: '后腰',     rtp: 'g', color: '#3f8a72' },
  { id: 8,  name: '韩亦宸', no: 11, pos: '左边锋',   rtp: 'g', color: '#7251b5' },
  { id: 9,  name: '高承岳', no: 5,  pos: '中后卫',   rtp: 'r', color: '#b8545f' },
  { id: 10, name: '宋子昂', no: 12, pos: '守门员',   rtp: 'g', color: '#4a8aa0' },
  { id: 11, name: '宋柏川', no: 10, pos: '前锋',     rtp: 'y', color: '#a97440' },
  { id: 12, name: '郑钧哲', no: 3,  pos: '左后卫',   rtp: 'g', color: '#4f82a8' },
];

const RTP_TEXT = { g: '正常全量', y: '限制参训', r: '不建议训练' };

// 当前主角
const HERO = PLAYERS.find(p => p.id === 4);

// 陈予安 · 基础体态
const BODY = {
  date: '2026-07-30',
  height: 175.6,  // 站立身高 cm
  weight: 65.4,   // 体重 kg
  sitHeight: 90.5,// 坐高 cm
  birthday: '2010-01-18',
};

// 陈予安 · 最新专项表现（U18暑期启动综合测试）
const LATEST_TESTS = [
  { label: 'Yo-Yo IR1',    value: '1800', unit: 'm'    },
  { label: 'RSA平均',      value: '7.22', unit: 's'    },
  { label: '伊利诺伊',    value: '16.45', unit: 's'    },
  { label: 'CMJ相对峰值功率', value: '58.9', unit: 'W/kg' },
];

// 参训限制
const RTP_LIMIT = {
  status: 'y',
  reviewDate: '2026-08-21',
  content: '避免速度突变和对抗训练，慢跑不超过20分钟',
};

// RTP 总览
const RTP_SUMMARY = [
  { key: 'g', label: '正常全量', count: 8 },
  { key: 'y', label: '限制参训', count: 3 },
  { key: 'r', label: '不建议训练', count: 1 },
];

// 状态变更记录
const RTP_LOGS = [
  {
    from: 'r', to: 'y',
    title: '不建议训练 → 限制参训',
    desc: '左膝韧带复查措施控制，解除高速变向与对抗，安排恢复性训练',
    time: '2026-08-16 09:40',
    operator: '沈禹',
  },
];

// 医疗附件
const MEDICAL_FILES = [
  { name: '右膝MR检查报告_建议.pdf', type: 'MRI检查', date: '2026-04-10', source: '驻地运动医学中心', ext: 'PDF' },
];

// PHV 本次测量
const PHV_FORM = {
  date: '2026/06/19',
  height: 175.6,
  sitHeight: 90.5,
  weight: 65.4,
  decimalAge: 16.58,
  fatherHeight: 176,
  motherHeight: 163,
};

// PHV 计算结果
const PHV_RESULTS = [
  { label: '成熟度偏移量', value: '+2.19', unit: '年', tag: 'PHV后', tagCls: 'badge-green', note: 'Mirwald 男性公式', icon: 'offset' },
  { label: '预计PHV年龄', value: '14.4', unit: '岁', tag: '', tagCls: '', note: 'Mirwald 男性公式', icon: 'calendar' },
  { label: '预测成年身高', value: '178.7', unit: 'cm', tag: '', tagCls: '', note: 'Khamis-Roche · 16.5岁系数', icon: 'ruler' },
  { label: '当前身高占比', value: '98.3', unit: '%', tag: '', tagCls: '', note: '占预测成年身高比例', icon: 'percent' },
];

// 身高变化趋势
const HEIGHT_TREND = [
  { d: '2025-08', v: 166.4 },
  { d: '2025-11', v: 170.4 },
  { d: '2026-02', v: 172.6 },
  { d: '2026-05', v: 174.4 },
  { d: '2026-08', v: 175.6 },
];

// 指标矩阵
const INDICATORS = [
  {
    cat: '身体形态', desc: '基础体态与生长发育记录', total: 5,
    items: [
      { name: '站立身高', checked: true,  src: '手工导入' },
      { name: '坐高',     checked: false, src: '手工导入' },
      { name: '体重',     checked: true,  src: '手工导入' },
      { name: '体脂率',   checked: false, src: '手工导入' },
      { name: '腰围',     checked: false, src: '手工导入' },
    ],
  },
  {
    cat: '身体机能', desc: '生理机能与运动负荷记录', total: 5,
    items: [
      { name: '静息心率',   checked: true,  src: '手工导入' },
      { name: '肺活量',     checked: false, src: '手工导入' },
      { name: '最大心率',   checked: false, src: '手工导入' },
      { name: '运动后心率恢复', checked: false, src: '手工导入' },
      { name: '主观疲劳RPE', checked: false, src: '手工导入' },
    ],
  },
  {
    cat: '身体素质', desc: '力量、速度、耐力与敏捷指标', total: 5,
    items: [
      { name: 'CMJ相对峰值功率', checked: true, src: '设备导入' },
      { name: '10米冲刺',        checked: true, src: '设备导入' },
      { name: 'Yo-Yo IR1',      checked: true, src: '手工导入' },
      { name: 'RSA平均时间',     checked: false, src: 'RSA录入' },
      { name: '伊利诺伊敏捷',    checked: false, src: '手工导入' },
    ],
  },
  {
    cat: '健康风险筛查', desc: '由专业人员采集与解释的筛查记录', total: 5,
    items: [
      { name: '疼痛评分',   checked: true,  src: '手工导入' },
      { name: '关节活动度', checked: false, src: '手工导入' },
      { name: '左右差异评分', checked: true, src: '手工导入' },
      { name: '运动中停僵量', checked: false, src: '手工导入' },
      { name: '既往伤病情况', checked: false, src: '手工导入' },
    ],
  },
];

// 测试模型库
const TEST_MODELS = [
  {
    cat: '耐力', catCls: 'badge-green', scheme: '专项方案',
    name: 'Yo-Yo间歇恢复测试',
    desc: '2×20米往返，播放15秒主动恢复，逐级提速至终止。',
    fields: '4项记录字段',
    border: '#3fa96e',
    detail: {
      code: 'Yo-Yo IR1',
      protocol: '2×20米往返、播放15秒主动恢复、逐级提速至终止。',
      rows: [
        { name: '完成总距离 (m)', src: '手工 / CSV导入' },
        { name: '终止阶段',       src: '手工 / CSV导入' },
        { name: '最大心率（可选）', src: '手工 / CSV导入' },
        { name: 'RPE（可选）',    src: '手工 / CSV导入' },
      ],
      note: '参考区间按性别、年龄组、队伍和测试版本配置，本DEMO只展示队内参考。',
    },
  },
  {
    cat: '速度耐力', catCls: 'badge-blue', scheme: '专项方案',
    name: '多次冲刺能力测试',
    desc: '6×40米折返冲刺，180°转身，RPE对冲刺结果。',
    fields: '4项记录字段',
    border: '#4a78c9',
    detail: null,
  },
  {
    cat: '敏捷', catCls: 'badge-amber', scheme: '专项方案',
    name: '伊利诺伊敏捷测试',
    desc: '站立起跑，标准路线穿绕往返冲刺，折返和钻杆绕行。',
    fields: '4项记录字段',
    border: '#dd9a33',
    detail: null,
  },
  {
    cat: '带球敏捷', catCls: 'badge-purple', scheme: '专项方案',
    name: '带球改良伊利诺伊测试',
    desc: '10×5米区域，中绕4根标志杆3.3米，完成两次最大努力。',
    fields: '4项记录字段',
    border: '#7251b5',
    detail: null,
  },
  {
    cat: '组合模型', catCls: 'badge-purple', scheme: '组合模型',
    name: '爆发—启动综合指数',
    desc: 'CMJ相对峰值功率与10米冲刺时间在测试齐备后转换为标准分并合成。',
    fields: '5项记录字段',
    border: '#7251b5',
    combo: true,
    detail: null,
  },
];

// 测试任务看板
const TASKS = [
  {
    id: 1, name: 'U18夏训阶段综合测试', group: 'U18梯队 · 主测人 陈聪',
    window: '08.18→08.23', status: '进行中', statusCls: 'badge-blue',
    done: 5, total: 6, bar: 'blue',
    items: ['Yo-Yo IR1', 'RSA', '伊利诺伊敏捷'],
    members: [
      { name: '周启航', sub: '#10 · 前锋',   done: true },
      { name: '林泽宇', sub: '#1 · 守门员',  done: true },
      { name: '赵沐阳', sub: '#7 · 右边锋',  done: true },
      { name: '陈予安', sub: '#8 · 中前卫',  done: true },
      { name: '方俊熙', sub: '#4 · 中后卫',  done: true },
      { name: '孙秉诚', sub: '#9 · 中锋',    done: false },
    ],
  },
  {
    id: 2, name: 'U16年生长发育周期测面', group: 'U16梯队 · 主测人 陈聪',
    window: '08.20→08.25', status: '进行中', statusCls: 'badge-blue',
    done: 2, total: 6, bar: 'amber',
    items: ['PHV测量'],
    members: [],
  },
  {
    id: 3, name: '速度专项组10米冲刺复测', group: '速度专项组 · 主测人 陈聪',
    window: '08.24→08.25', status: '待开始', statusCls: 'badge-gray',
    done: 0, total: 4, bar: '',
    items: [],
    members: [],
  },
  {
    id: 4, name: 'RTP复核组功能复测', group: 'RTP复核组 · 主测人 沈禹',
    window: '08.12→08.16', status: '已完成', statusCls: 'badge-green',
    done: 2, total: 2, bar: '',
    items: ['KPI复测'],
    members: [],
  },
];

// 报告 · 多维表现概览（标准分）
const REPORT_SCORES = [
  { name: 'Yo-Yo IR1', score: 90, color: '#3d8a6e' },
  { name: 'RSA',       score: 82, color: '#7251b5' },
  { name: '敏捷',      score: 56, color: '#438a72' },
  { name: 'CMJ功率',   score: 91, color: '#4a78c9' },
  { name: '10米冲刺',  score: 75, color: '#3f8a72' },
];

// 报告 · 核心指标卡
const REPORT_METRICS = [
  { label: 'Yo-Yo IR1', value: '1800', unit: 'm',  range: '队内参考：1600~1880 m' },
  { label: 'RSA平均时间', value: '7.22', unit: 's', range: '队内参考：6.90~7.25 s' },
  { label: '伊利诺伊敏捷', value: '16.45', unit: 's', range: '队内参考：15.00~16.40 s' },
  { label: '爆发—启动指数', value: '55.7', unit: '', range: '参考基准：CY-U18-2026A' },
];

// 报告 · 专业人员记录
const REPORT_NOTES = [
  { who: '陈聪', role: '体能师', type: '限制参训', text: '避免速度突发和对抗训练，慢跑不超过20分钟。' },
  { who: '沈禹', role: '康复师', type: '恢复观察', text: '耐力与加速表现保持上升趋势，适应3次移动对抗训练，恢复后结合RTP周期安排体测。' },
];

// 报告 · 近5次专项测试
const REPORT_HISTORY = [
  { date: '2026-08-12', yoyo: '1,800 m', rsa: '7.42 s', illinois: '17.27 s', cmj: '53.6 W/kg', sprint: '1.89 s' },
  { date: '2026-04-16', yoyo: '1,530 m', rsa: '7.42 s', illinois: '17.04 s', cmj: '54.8 W/kg', sprint: '1.95 s' },
];
