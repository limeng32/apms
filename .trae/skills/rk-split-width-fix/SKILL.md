---
name: rk-split-width-fix
description: 修复 APMS 花名册风主从双栏页（.rk-split-grid）左栏过窄、左表横向滚动、日期或长文本折行问题。用户反馈测试模型库/指标库/测试任务/报告中心/测试结果/组合模型等页左右分栏左栏太窄、关键信息要横滚或日期换行时使用。不适用于单列页面或后端问题。
---

# 主从双栏左栏宽度修复（roster-kit）

纯前端修复，红线：不动后端/API/路由/菜单。

## 页面结构事实

- 分栏容器 `.rk-split-grid`，定义在 `ruoyi-ui/src/assets/styles/roster-kit.scss`（约 L999）：
  `grid-template-columns: minmax(0,var(--rk-split-l,1fr)) minmax(0,var(--rk-split-r,1fr)); gap:16px;`
  比例由各页行内 `style="--rk-split-l:..fr; --rk-split-r:..fr;"` 覆盖。**≤1279px 媒体查询自动单列**，所以横滚问题只发生在 ≥1280 双栏态。
- 左表：`.rk-table-scroll{overflow-x:auto}` 包 `<table class="rk-table xxx-table">`；默认 th/td 横向 padding 16px；列宽用 scoped 固定 px width。
- 紧凑修饰类 `.rk-table.is-compact`（roster-kit.scss 约 L296）：th/td 横向 padding 16→12px，`.col-check` 左 padding 12。只加在**左台账表**，不要加到右栏详情/子表。
- 现有比例基线：testModel/indicator/report/comboModel 用 13/11；testTask 用 13.2/10.8；testResult 用 13.5/10.5（有不换行日期区间、列更挤）。medical 等未反馈页面保持原样。

## 修复杠杆（按优先级，优先少改）

1. 调比例变量（左栏不够宽的根因通常是比例失衡，旧值 10/14 约 42%）：先试 13fr/11fr；临界档仍差几 px 且有硬宽度内容时用 13.5fr/10.5fr。
2. 左表加 `is-compact`（列多、padding 占大头时最有效，8 列省 64px）。
3. 个别固定列宽微调（如日期列 104→112），或把不换行内容字号降到 11px；**不要**靠把内容拆两行来省宽，用户通常要求一行显示。
4. 不要用 position/left 位移、不要在多处叠加覆盖；一次只收敛到比例 + is-compact + 最多 1-2 个列宽。

## 实测流程（必须做，不能只看代码估算）

通过 MCP `integrated_code_mode` 的 `Exec` 调 browser 工具。`browser_evaluate` 只传简单语句（不用闭包），返回值取 `res.content[0].text`。dev server 一般在 localhost:5173（登录态 cookie 已在顶层页，同源 iframe 直接复用）。

1. 注入固定宽度 iframe：

```js
var f=document.createElement('iframe'); f.id='wframe';
f.style.cssText='position:fixed;right:0;bottom:0;width:1440px;height:900px;z-index:999999;border:2px solid red;background:#fff';
f.src='/apms/<page>'; document.body.appendChild(f); window.__wf=f;
```

2. 每档宽度（iframe style.width 用 **1290 / 1366 / 1440 / 1536**，对应 innerWidth 1286/1362/1436/1532；1290 是双栏切换后的最临界档）等待 300ms 后读：

```js
var d=window.__wf.contentDocument, g=d.querySelector('.rk-split-grid');
var sc=g.querySelector('.rk-table-card .rk-table-scroll');
JSON.stringify({cols:getComputedStyle(g).gridTemplateColumns.split(' ').length,
  L:Math.round(g.children[0].getBoundingClientRect().width),
  over:sc.scrollWidth-sc.clientWidth});
```

验收：双栏四档 `over` 全部 0。

3. 文本是否折行（td 高度会被同行其他多行单元格污染，不可靠），用 Range 行数：

```js
var td=d.querySelector('.<page>-table tbody tr').children[N]; // N=目标列下标
var rng=d.createRange(); rng.selectNodeContents(td); rng.getClientRects().length; // 1=一行
```

4. 试改比例时行内变量只能用 `g.style.setProperty('--rk-split-l','13.5fr')`，样式表规则打不过 inline style。
5. 回归：iframe width 1100（单列态）与 380（手机）。单列态左表 over 必须 0、页面 `documentElement.scrollWidth-innerWidth` 为 0；376px 下表内可以有滚动（既有设计），但页面级横滚为 0。
6. 右栏：`.rk-split-grid` children[1] 内所有 `.rk-table-scroll`/pre 的 scrollWidth-clientWidth 检查；右栏最窄会到 431px，确认子表/快照卡无新增溢出。
7. 验证真实代码：改动落盘后 iframe 重新 navigate（不带任何注入样式/style 覆盖）重跑 2-6。

## 收尾

- Vite 编译检查（IDE 诊断 0 不等于编译通过）：
  `curl -s -o/tmp/vc.txt -w "%{http_code}" "http://localhost:5173/src/views/apms/<page>/index.vue?t=$(date +%s)"`，需 200 且响应中无 `Transform failed/Internal server error/Pre-transform error`。
- GetDiagnostics 目标文件 0 错误（TS Hint 可接受）。
- 移除 iframe：`window.__wf && window.__wf.remove()`。
- 汇报：改动文件、四档 + 单列实测数值表；文件留给用户手动 git 提交。
