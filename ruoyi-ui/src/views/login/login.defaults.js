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
      // 移动端独立上下留白
      logoSpace: {
        split: { top: 24, bottom: 0 },
        overlay: { top: 24, bottom: 28 }
      }
    },
    // 移动端独立全屏背景（竖版图更合适）
    background: {
      type: 'image',
      image: null,
      overlay: 0.4
    }
  }
}
