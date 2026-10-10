/**
 * 登录页内置默认配置（视觉默认值的唯一真相源）
 *
 * 后端不维护任何默认 JSON：GET /login/config 无配置行时返回 {}，
 * 由 mergeWithDefaults() 与本文件深度合并得到完整配置。
 *
 * M1：以下所有值均从改造前 login.vue 的硬编码原样搬运，空表时渲染结果须与改造前肉眼一致。
 */
export default {
  version: 1,
  layout: {
    template: 'split',          // split（双栏）| centered（居中卡片，M3b）| fullscreen（M3c）
    splitRatio: 1.1,            // 左栏占比
    showBrandOnMobile: false,   // ≤900px 是否显示品牌区
    cardRadius: 10              // 输入框/按钮圆角 px
  },
  brand: {
    name: '',                   // 空则回退 VITE_APP_TITLE
    subTitle: 'ATHLETE PERFORMANCE MANAGEMENT SYSTEM',
    // type: builtin（内置矢量库）| image（/profile/ 下 jpg/png）
    // value: builtin 时为内置标识（shield 或 Element Plus 图标名）；image 时为 /profile/ 相对路径
    // width/height：渲染像素；offsetX/offsetY：相对默认位置的像素偏移（transform，不影响布局流）
    logo: { type: 'builtin', value: 'shield', width: 42, height: 48, offsetX: 0, offsetY: 0 },
    // 客户方 Logo（双 logo 方案：品牌区右上；enabled=false 时不显示，仅剩左上版权方 logo）
    // 结构与 logo 完全一致：内置矢量/位图 / 上传图 + 宽高 + 像素偏移，桌面/移动各自独立
    // 默认 nosc（奥体中心，内置位图 1.69:1，src/assets 构建后带内容哈希）
    logoClient: { enabled: true, type: 'builtin', value: 'nosc', width: 96, height: 57, offsetX: 0, offsetY: 0 },
    // Logo 上下留白（px），按布局族各自独立：
    //   split  → 左右分栏：top=品牌区顶部间距；bottom=Logo 与 Hero 之间的最小间距
    //   overlay→ 居中卡片/全屏背景共用：top=Logo 上方间距；bottom=Logo 与登录卡片间距
    logoSpace: {
      split: { top: 56, bottom: 0 },
      overlay: { top: 40, bottom: 22 }
    },
    favicon: null               // null 保持 /favicon.ico；配置后为 /profile/ 下 PNG
  },
  hero: {
    visible: true,
    lines: [
      { text: '为运动员的', accent: false },
      { text: '每一次成长', accent: false },
      { text: '建立数据基石', accent: true }
    ],
    description: '覆盖数字档案、生长发育监控、科研测试、RTP 参训状态、医疗附件、组合评价与 PDF 报告的一体化管理平台。',
    features: {
      visible: true,
      items: [
        { icon: 'Check', title: '一人一档', text: '跨赛季持续数据归集，体态/测试/RTP/医疗全维度' },
        { icon: 'TrendCharts', title: 'Mirwald PHV', text: '已确认公式可计算，Khamis-Roche 待参数确认' },
        { icon: 'Key', title: '数据权限', text: '队伍级 DataScope，医疗附件私有存储，独立权限点' },
        { icon: 'Document', title: '报告可复现', text: '算法版本+参考统计量快照，历史分数不漂移' }
      ]
    }
  },
  form: {
    title: '欢迎回来',
    subtitle: '请使用账号登录 {title} 工作台',
    usernamePlaceholder: '请输入用户名',
    passwordPlaceholder: '请输入密码',
    rememberText: '记住我',
    // demo 同款按钮文案（设计器「文案」页签仍可改）；按钮尾部带 → 箭头
    buttonText: '进入系统',
    loadingText: '正在进入…',
    forgot: {
      mode: 'alert',             // alert | link | hidden（M2 设计器开放；M1 渲染层已兼容）
      text: '忘记密码？',
      alertMessage: '请联系管理员重置密码',
      url: ''
    }
  },
  footer: {
    brandText: '© {year} {title} · 基于 RuoYi-Vue 3.9.2',
    copyright: '© {year} {title} · {footerContent}',
    showCopyright: true,
    // 公安联网备案（警徽图标 + 备案号，点击新开公安备案查询页）
    police: {
      show: false,
      number: '',  // 例：京公网安备 11010802020425号
      url: ''      // 例：https://beian.mps.gov.cn/#/query/webSearch?code=11010802020425
    }
  },
  colors: {
    // 深色运动科技底（demo 同款 ink 色板：#0A1120/#0F172A/#111B31）
    brandGradient: { angle: 150, stops: ['#0a1120', '#0f172a', '#111b31'] },
    // 品牌色 = demo/rk 体系主题蓝 #2563EB（App.vue 会推广为全系统 Element 主色，含标签页/侧栏/按钮）
    accent: '#2563eb',
    glow2: '#3b82f6',
    textOnBrand: '#ffffff',
    textOnBrandMuted: 'rgba(255,255,255,.7)',
    pageBg: '#ffffff',
    formTitle: '#0f172a',
    formSubText: '#94a3b8',
    inputBorder: '#e4e4e7',
    inputFocus: '#2563eb',
    // 渐变关闭时按钮使用的纯色兜底
    buttonBg: '#2563eb',
    buttonHover: '#3b82f6',
    buttonLoading: '#06b6d4',
    link: '#2563eb',
    // Hero「强调行」渐变色（demo：brand-500 → cyan-400）；enabled=false 时强调行用纯色 accent
    heroGradient: { enabled: true, angle: 90, stops: ['#3b82f6', '#22d3ee'] },
    // 登录按钮渐变（demo：#2563EB → #06B6D4，hover 整体提亮）；enabled=false 时用上方纯色三态
    buttonGradient: { enabled: true, angle: 90, stops: ['#2563eb', '#06b6d4'] }
  },
  /* 动效：入场总开关（逐字标语、元素 stagger、卡片入场）；
     背景动态（粒子/雷达/缓推）在 background.effect / background.kenBurns 按设备配置。
     访客系统开启「减少动态效果」时浏览器媒体查询会自动停用一切动画。 */
  animation: {
    entrance: true
  },
  typography: {
    fontFamily: 'heiti',        // 整体字体（登录页 + 后台管理）：heiti 黑体 | songti 宋体
    heroSize: 38,
    heroWeight: 700,
    brandNameSize: 22,
    formTitleSize: 24
  },
  background: {
    type: 'image',
    image: null,                // 管理员上传图（仅 /profile/ 下 jpg/png）；优先级高于 builtin
    // 内置背景：null=不使用 | 'tech'=深色科技球场（随包内置，无需上传，直接可用）
    builtin: 'tech',
    overlay: 0.55,              // 品牌渐变遮罩浓度；内置科技图默认 0.55 保证文字对比
    // 动态装饰特效：none | particles（粒子漂浮）| radar（雷达扫描）| all（粒子+雷达）
    effect: 'all',
    kenBurns: true,             // 背景图缓慢推近/拉远（呼吸感）
    video: { url: '', poster: '', autoplay: true, muted: true, loop: true }
  },

  /*
   * 移动端（H5，视口 ≤900px）专属配置。
   * 桌面端使用上方同名字段（layout/brand.logo/brand.logoSpace/background），
   * 移动端在此整树覆盖这四类「布局相关」字段；其余（品牌名/副标题、Hero、表单、
   * 版权、主题色、字体、favicon、圆角）两端共享。
   * 保存时整份 JSON 一次提交，两端配置同生共存。
   */
  mobile: {
    // 移动端布局：默认居中卡片（H5 常见形态）；不携带 showBrandOnMobile/cardRadius
    layout: {
      template: 'centered',
      splitRatio: 1.1
    },
    brand: {
      // 移动端可使用独立 Logo（不同图标/尺寸/偏移）
      logo: { type: 'builtin', value: 'shield', width: 42, height: 48, offsetX: 0, offsetY: 0 },
      // 移动端独立客户方 Logo（右上）：nosc 奥体中心，小屏略缩
      logoClient: { enabled: true, type: 'builtin', value: 'nosc', width: 84, height: 50, offsetX: 0, offsetY: 0 },
      // 移动端独立上下留白
      logoSpace: {
        split: { top: 24, bottom: 0 },
        overlay: { top: 24, bottom: 28 }
      }
    },
    // 移动端独立背景（同一张内置科技图，遮罩略深保证竖屏可读性）
    background: {
      type: 'image',
      image: null,
      builtin: 'tech',
      overlay: 0.6,
      effect: 'particles',
      kenBurns: true
    }
  }
}
