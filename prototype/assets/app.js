/* ============================================================
   公共布局：侧边栏 / 顶栏 / 图标 / 简易 SVG 图表
   ============================================================ */

const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  org: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 11h.01M15 11h.01M9 14h.01M15 14h.01"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5"/><path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 15.2c1.7.7 2.8 2.2 3.2 4.3"/></svg>',
  growth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M7 8l5-5 5 5M5 21h14"/></svg>',
  matrix: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.4 2.2h12.2a1.5 1.5 0 0 0 1.4-2.2L14 9V3"/><path d="M7.5 15h9"/></svg>',
  task: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 3v3M15 3v3M8.5 11.5l2 2 4-4M8.5 17h7"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>',
  health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.6-9.2-9C1.3 8 2.7 4.8 6 4.8c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.3 0 4.7 3.2 3.2 6.2C19 15.4 12 20 12 20z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9 2.6V1a2 2 0 1 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H23a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" transform="scale(.85) translate(2,1)"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v5h-5"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3L2 20h20L12 3z"/><path d="M12 10v4M12 17.5h.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12l5 5 9-10"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 16V4M7 9l5-5 5 5M4 20h16"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  calc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v4M8 19h4"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/></svg>',
  trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
};

const MENU = [
  {
    title: '日常管理',
    items: [
      { key: 'dashboard', icon: 'dashboard', name: '工作台', href: 'index.html' },
      { key: 'org',       icon: 'org',       name: '机构与小组', href: 'org.html' },
      { key: 'profile',   icon: 'users',     name: '队员档案', href: 'profile.html' },
    ],
  },
  {
    title: '科研测试',
    items: [
      { key: 'phv',     icon: 'growth', name: '生长发育', href: 'phv.html' },
      { key: 'matrix',  icon: 'matrix', name: '指标矩阵', href: 'matrix.html' },
      { key: 'models',  icon: 'flask',  name: '测试模型', href: 'models.html' },
      { key: 'tasks',   icon: 'task',   name: '测试任务', href: 'tasks.html' },
      { key: 'report',  icon: 'report', name: '分析报告', href: 'report.html' },
    ],
  },
  {
    title: '健康与安全',
    items: [
      { key: 'health', icon: 'health', name: '健康与医疗', href: 'health.html' },
      { key: 'rbac',   icon: 'shield', name: '角色权限', href: 'rbac.html' },
    ],
  },
  {
    title: '环境',
    items: [
      { key: 'system', icon: 'system', name: '系统说明', href: 'system.html' },
    ],
  },
];

function brandLogoSVG() {
  // 盾牌形足球 Logo（简化绘制）
  return `
  <svg class="brand-logo" viewBox="0 0 40 46" fill="none">
    <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
      fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
    <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
    <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
    <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
  </svg>`;
}

function renderShell(activeKey, crumb) {
  const sidebar = `
  <aside class="sidebar">
    <div class="brand">
      ${brandLogoSVG()}
      <div>
        <div class="brand-name">APMS</div>
        <div class="brand-sub">运动员管理系统</div>
      </div>
    </div>
    <nav class="nav">
      ${MENU.map(g => `
        <div class="nav-group">
          <div class="nav-group-title">${g.title}</div>
          ${g.items.map(it => `
            <a class="nav-item ${it.key === activeKey ? 'active' : ''}" href="${it.href}">
              ${ICONS[it.icon]}<span>${it.name}</span>
            </a>`).join('')}
        </div>`).join('')}
    </nav>
    <div class="env-note">
      <div class="t"><span class="dot"></span>静态演示环境</div>
      <div class="d">本地数据 · 无数据库</div>
    </div>
  </aside>`;

  const topbar = `
  <header class="topbar">
    <button class="menu-toggle" data-menu-toggle aria-label="打开菜单">${ICONS.menu}</button>
    <div class="crumb">运动员训练数据管理系统 <span class="sep">/</span> <b>${crumb}</b></div>
    <div class="top-search">
      ${ICONS.search}<span>搜索队员、测试任务或报告</span><kbd>Ctrl K</kbd>
    </div>
    <div class="top-right">
      <button class="season-select">当前赛季 · 全部队伍（12） ${ICONS.chevronDown}</button>
      <button class="icon-btn" title="刷新">${ICONS.refresh}</button>
      <button class="icon-btn" title="通知">${ICONS.bell}<span class="badge"></span></button>
      <div class="user-chip">
        <div class="meta"><div class="name">鹏思</div><div class="role">体能师</div></div>
        <div class="avatar avatar-sm" style="background:#2f6b57">鹏</div>
      </div>
    </div>
  </header>`;

  const host = document.getElementById('app');
  host.classList.add('main');
  host.innerHTML = sidebar + `<div class="sidebar-backdrop" data-menu-close></div>` +
    `<div style="display:flex;flex-direction:column;flex:1;min-width:0;">${topbar}<main class="content" id="content"></main></div>`;

  // 移动端侧边栏抽屉交互（每页加载只绑定一次）
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-menu-toggle]')) {
      e.preventDefault();
      document.body.classList.toggle('sidebar-open');
    } else if (e.target.closest('[data-menu-close]') || e.target.closest('.sidebar .nav-item')) {
      document.body.classList.remove('sidebar-open');
    }
  });
}

/* ============ 通用渲染辅助 ============ */

function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

function avatarHTML(p, size = 'md') {
  return `<div class="avatar avatar-${size}" style="background:${p.color || '#3d8a6e'}">${p.name.slice(-2).slice(0, 2).charAt(0) === p.name.charAt(0) ? p.name.charAt(0) : p.name.charAt(0)}</div>`;
}

function rtpBadge(key, outline) {
  const cls = { g: 'badge-green', y: 'badge-amber', r: 'badge-red' }[key];
  return `<span class="badge ${cls} ${outline ? 'badge-outline' : ''}"><span class="rtp-dot ${key}"></span>${RTP_TEXT[key]}</span>`;
}

/** 队员选择列表（档案/健康/PHV 页复用） */
function rosterHTML(activeId, opts = {}) {
  const { showStatusCounts = false } = opts;
  return `
  <div class="card roster">
    <div class="search-box">
      <div class="mini-input">${ICONS.search}<span>搜索姓名、号码或位置</span></div>
    </div>
    <div class="filters">
      <select class="select"><option>全部小组</option><option>U18梯队</option><option>U16梯队</option><option>速度专项组</option><option>RTP复核组</option></select>
      <select class="select"><option>全部状态</option><option>正常全量</option><option>限制参训</option><option>不建议训练</option></select>
    </div>
    <div class="count">共 12 名队员</div>
    <div class="roster-list">
      ${PLAYERS.map(p => `
        <div class="player-row ${p.id === activeId ? 'active' : ''}" onclick="switchPlayer(${p.id})">
          ${avatarHTML(p, 'md')}
          <div class="p-meta">
            <div class="p-name">${p.name}</div>
            <div class="p-sub">#${p.no} · ${p.pos}</div>
          </div>
          <span class="rtp-dot ${p.rtp}"></span>
        </div>`).join('')}
    </div>
  </div>`;
}

function switchPlayer() { /* 静态页：保持当前选中，不跳转 */ }

/* ============ SVG 折线图 ============ */
function lineChart(data, opts = {}) {
  const w = 900, h = 260, padL = 56, padR = 20, padT = 20, padB = 40;
  const vals = data.map(d => d.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  min -= range * 0.25; max += range * 0.15;
  const x = i => padL + (w - padL - padR) * (i / (data.length - 1));
  const y = v => padT + (h - padT - padB) * (1 - (v - min) / (max - min));
  const pts = data.map((d, i) => [x(i), y(d.v)]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const yTicks = 4;
  const grid = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = min + (max - min) * i / yTicks;
    const yy = y(v);
    return `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="#e7ede9" stroke-dasharray="3 4"/>
            <text x="${padL - 10}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#98a69f">${v.toFixed(1)}</text>`;
  }).join('');
  const xLabels = data.map((d, i) =>
    `<text x="${x(i)}" y="${h - 14}" text-anchor="middle" font-size="11" fill="#98a69f">${d.d}</text>`).join('');
  const dots = pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="#fff" stroke="#3d8a6e" stroke-width="2.5"/>`).join('');
  const unit = opts.unit ? `<text x="${padL}" y="14" font-size="11" fill="#98a69f">${opts.unit}</text>` : '';
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
    ${unit}${grid}${xLabels}
    <path d="${path}" fill="none" stroke="#3d8a6e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
  </svg></div>`;
}

/* ============ SVG 柱状图 ============ */
function barChart(data, opts = {}) {
  const w = 900, h = 300, padL = 40, padR = 20, padT = 20, padB = 46;
  const max = 100;
  const iw = (w - padL - padR) / data.length;
  const bw = Math.min(90, iw * 0.52);
  const y = v => padT + (h - padT - padB) * (1 - v / max);
  const grid = [0, 25, 50, 75, 100].map(v => {
    const yy = y(v);
    return `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="#e7ede9" stroke-dasharray="3 4"/>
            <text x="${padL - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#98a69f">${v}</text>`;
  }).join('');
  const bars = data.map((d, i) => {
    const cx = padL + iw * i + iw / 2;
    const bh = h - padT - padB - y(d.score) + padT;
    return `<rect x="${cx - bw / 2}" y="${y(d.score)}" width="${bw}" height="${h - padT - padB - (y(d.score) - padT)}" rx="5" fill="${d.color}"/>
            <text x="${cx}" y="${h - 20}" text-anchor="middle" font-size="12" fill="#53655e">${d.name}</text>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${grid}${bars}</svg></div>`;
}
