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
    template: 'split',          // split | centered | fullscreen（M1 仅实现 split）
    splitRatio: 1.1,            // 左栏占比
    showBrandOnMobile: false,   // ≤900px 是否显示品牌区
    cardRadius: 10              // 输入框/按钮圆角 px
  },
  brand: {
    name: '',                   // 空则回退 VITE_APP_TITLE
    subTitle: 'ATHLETE PERFORMANCE MANAGEMENT SYSTEM',
    logo: { type: 'builtin', value: 'shield' },  // M1 仅内置盾牌
    favicon: null               // M1 不启用动态 favicon
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
    buttonText: '登 录',
    loadingText: '登录中...',
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
    showCopyright: true
  },
  colors: {
    brandGradient: { angle: 150, stops: ['#16302a', '#1d3b33', '#27503f'] },
    accent: '#4aa886',
    glow2: '#3fa96e',
    textOnBrand: '#ffffff',
    textOnBrandMuted: 'rgba(255,255,255,.7)',
    pageBg: '#ffffff',
    formTitle: '#1f2c28',
    formSubText: '#8a9a93',
    inputBorder: '#e3eae6',
    inputFocus: '#4aa886',
    buttonBg: '#2f6b57',
    buttonHover: '#3d8a6e',
    buttonLoading: '#4aa886',
    link: '#2f6b57'
  },
  typography: {
    fontFamily: 'system',       // system | pingfang | yahei | heiti | songti
    heroSize: 38,
    heroWeight: 700,
    brandNameSize: 22,
    formTitleSize: 24
  },
  background: {                 // M3 启用，M1 仅占位
    type: 'image',
    image: null,
    overlay: 0.4,
    video: { url: '', poster: '', autoplay: true, muted: true, loop: true }
  }
}
