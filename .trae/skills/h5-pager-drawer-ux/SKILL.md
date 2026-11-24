---
name: h5-pager-drawer-ux
description: APMS 花名册风页面 H5（≤768px）分页横滑、详情抽屉触发与返回手势、模态框右滑关闭、弹窗宽表窄屏重构、关闭弹层蓝条假刷新、窄屏文字防折行的统一交互规范与修复流程。用户反馈手机端分页裁切、抽屉或弹窗打不开/误触/闪烁、胶囊竖排、列表横滚异常时使用。不用于桌面双栏宽度问题（用 rk-split-width-fix）或后端接口问题。
---

# H5 分页 + 抽屉 + 模态框用户体验规范

纯前端修复，红线：不动后端/API/菜单结构（前端路由守卫 permission.js 允许加导航短路）；桌面端（>768px）既有行为不允许被媒体查询改动。

## 1. 断点与视口事实（全项目唯一口径）

- 断点统一 **768px**：`src/utils/touchViewport.js` 的 `matchMedia('(max-width: 768px)')`、`roster-kit.scss` 媒体查询、各页 `@media (max-width: 768px)` 必须一致，禁止新造断点。
- JS 侧触摸判定只用 `useTouchViewport()` 的 `isTouchViewport.value`，不要自行 `window.innerWidth` 猜（旋转/分屏需响应式）。
- 花名册表格 H5 策略：**不压缩列宽**，`.rp-table { min-width: 800px }` 保持桌面形态，在 `.rp-table-scroll`（overflow-x:auto）内横滑；页面级 `documentElement.scrollWidth - innerWidth` 必须为 0，禁止整页横滚。

## 2. 详情抽屉：触发入口规则

参考实现 `src/views/apms/athlete/index.vue` + `components/AthleteDetailDrawer.vue`。

### 2.1 双端分流（误触守卫）

- 桌面端：整行 `@click="handleRowClick(row)"` 开抽屉。
- H5 端：`handleRowClick` 首行 `if (isTouchViewport.value) return`——整行不响应，因为列表横滑、复选框擦碰、滚动起手都会误触。
- H5 只保留**显式入口**，每个入口直连无守卫的 `openDetail(row)`：
  1. 行内「查看」按钮（`@click.stop`）；
  2. 首列主内容单元格（头像+姓名，class `col-user`，`@click.stop="openDetail(row)"`）。
- 所有入口必须 `@click.stop`，否则桌面端与整行点击重复触发；复选框单元格用 `@click.stop` 隔离。
- 禁止在 H5 重新放开整行点击来「方便用户」——这是已被否决的方案，误触回归比入口隐蔽更严重。

### 2.2 可点暗示（无暗示=用户不知道能点）

- 可点单元格在 ≤768px 媒体查询内给 `cursor: pointer` 与按压反馈，如 `.col-user:active .rp-user { opacity: .65 }`。
- 不可点的其余行保持 `cursor: default` 并去掉 hover 底色（`.rp-row:hover { background: #fff }`），斑马纹/状态行静态色保留。
- 只用 `:active` 不用 `:hover` 做触摸反馈；hover 态在触屏会残留。

### 2.3 抽屉本体必配项（新建抽屉照抄 AthleteDetailDrawer）

- `useDrawerHistory(open)`：接管系统返回手势（iOS 左沿/Android 返回键），先关抽屉不跳路由；默认 touchOnly，桌面零影响。
- `v-drawer-swipe` 指令：面板内向右跟手滑动关闭。
- 尺寸：`window.innerWidth <= 800 ? '100%' : '760px'`，resize 监听实时更新。
- 结构：固定头（flex:none）+ 内容体（`flex:1; min-height:0; overflow-y:auto`），滚动只发生在内容体。
- el-drawer 经 teleport 挂 body，scoped 样式打不到其内部：面板定位用内联 style（top/height 偏移顶栏 50/84px），内部覆写写非 scoped 的第二个 `<style>` 块。
- `destroy-on-close` 保证每次打开重新拉详情。

### 2.4 抽屉内嵌宽表：横向滚动单一承载链路（真实事故）

抽屉内放 7 列表格时，横滚可能漂移到 `.el-drawer__body`（EP 默认 overflow:auto），iOS 上横向手势被其纵向滚动吞掉，用户感知"表格不能横滑"。修复必须成链，缺一不可（参考 AthleteMeasureDrawer）：

1. flex 收缩链：`.amd-body { min-width:0 }` 及其直接卡片 `.amd-body > .rk-card { min-width:0 }`——flex 子项默认 min-width:auto 不收缩，宽表会把卡片一路撑到 drawer body，横滚源外移。
2. 表格给真实最小宽（如 `min-width:560px`）让它在窄屏确定性溢出；列宽不压缩、不截断。
3. 横滚只允许发生在紧贴表格的 `.rk-table-scroll`：`overflow-x:auto; -webkit-overflow-scrolling:touch; overscroll-behavior-x:contain`。
4. drawer body 横向关闭、纵向保留：给 el-drawer 加自定义类（如 amd-drawer-wrap），在**非 scoped 第二 style 块**写 `.amd-drawer-wrap .el-drawer__body { overflow-x:hidden }`。scoped 的 `:deep()` 对 teleport 出去的 EP 内部元素不可靠，实测不生效。
5. 验收量化：drawer body scrollWidth==clientWidth（无横溢）；table-scroll scrollWidth>clientWidth 且 scrollLeft 可设可读；documentElement 横溢为 0。**注意：scrollLeft API 可设可读只证明 CSS 层可滚，证明不了触摸可滚——必须再过 §2.5 的手势层检查。**
6. 同抽屉内多个卡片要视觉对齐时，padding 必须落在各卡片自身（同值同构），不能只靠外层容器 padding——否则无 padding 的卡片标题贴边。

### 2.5 CSS 可滚 ≠ 触摸可滚：滑动关闭指令的手势冲突（真实事故，排查两轮才定位）

现象：§2.4 全部量化项 PASS（scrollWidth>clientWidth、scrollLeft 可写），真机上表格仍然滑不动。根因在事件层不在样式层：`v-drawer-swipe`（utils/drawerSwipe.js）挂在整个 drawer 面板，一旦识别横向意向就 `e.preventDefault()` 拖面板，把表格区的原生横滚手势吞掉了。**任何"全屏手势指令 + 内部可横滚区"的组合都有此坑。**

修复模式（已落地于 drawerSwipe 的 `findHorizontalScroller`）：
1. touchstart 记录 `startTarget`；touchmove 判定为横向后，先从 target 向上找满足 `overflow-x:auto/scroll` 且 `scrollWidth>clientWidth+1` 的祖先。
2. 按方向做边缘判定：dx<0 要求 `scrollLeft+clientWidth < scrollWidth-1`（还能向左前进）；dx>0 要求 `scrollLeft>1`（还能向右回滚）。命中则**不 preventDefault、不拖面板**，本次手势 tracking 置 false 全程交还原生滚动。
3. 到边缘后查找返回 null，同一方向继续拖才接管为关闭手势（iOS scroll-view 边缘接管体验）；新手势在 touchstart 重新评估，状态不串。
4. overflow:hidden 的祖先（drawer body）天然被排除，不会误判。

验证方法（合成 TouchEvent，注意 matchMedia 门控）：
- 桌面视口下 `touchViewportActive()` 为 false，真实 dispatch 不进指令逻辑；可直接对 `findHorizontalScroller` + 决策分支做函数级验证，三分支必测：非边缘横滑=放行（defaultPrevented=false、无 transform）、到边缘=接管（preventDefault=true）、非滚动区右滑=关闭手势无回归（translateX 正值）。
- 教训：滚动类问题分两层排查，先 CSS 链路（overflow/min-width/滚动源唯一），再事件链路（passive 监听、preventDefault、手势指令/touch-action）。只验一层会反复返工。

### 2.6 存量抽屉 H5 补课清单（dispatch 三抽屉实战）

老抽屉往往已有 useDrawerOffset/useDrawerSize/自定义 wrap 类/非 scoped body 块，但缺 history 与滑动。按单抽屉 4 步补齐，三抽屉同构可批量：

1. script：`import { useDrawerHistory } from '@/utils/useDrawerHistory'`、`import { vDrawerSwipe } from '@/utils/drawerSwipe'`；在 visible ref 定义后立即 `useDrawerHistory(detailDrawerVisible)`，并加 `function handleSwipeClose(){ detailDrawerVisible.value = false }`。
2. template：抽屉根 div（.xx-drawer）加 `v-drawer-swipe="handleSwipeClose"`；指令内部自行 closest('.el-drawer')，挂根 div 即可。
3. 非 scoped 块的 `.el-drawer.xx-wrap .el-drawer__body { padding:0 }` 追加 `overflow-x: hidden`（抽屉内只要有 rk-table-scroll 就必须加，承接 §2.4 第 4 条）。
4. 列表首列主内容 td 加 `class="col-user" @click.stop="openDetail(row)"`；col-user 的 cursor/按压反馈已在 roster-kit 768 断点全局收口，**不要在页面 scoped 再写一遍**（athlete 旧双轨已删）。

验证两个坑：
- useDrawerHistory 默认 touchOnly，**桌面视口测 history 永远不 +1 是正确行为**；必须在 ≤768 的 iframe 内测。
- 同一页面会话里连续「开 A 抽屉→关→开 B 抽屉」时，关闭走的 `history.back()` 是异步的，未 settle 前 B 的 pushState 可能被挂起导航吞掉，表现为 B 的 history 不 +1。**每个抽屉用独立全新 iframe（URL 带 ?tab= 直切）隔离测**，不要串在一个会话里下结论。
- 滑动指令在 ≤768 iframe 内可用合成 TouchEvent 端到端验：右滑后 el-drawer 面板内联 transform 出现 translateX 正值即挂载生效（会真的触发吸附关闭，属预期）。

### 2.7 长抽屉内「状态切换型」按钮必须配滚动定位（真实事故，两次误诊才定位）

事故：任务详情抽屉引导区两个「管理」按钮真机"点不动"。排查走过弯路：先怀疑 v-drawer-swipe 吞 click（加了控件放行，属有效防御但非主诉），实测程序化 .click() 后 tab 的 is-active 已切换——**绑定从未坏过**。真相是抽屉内容高 ~1270px、可视区仅 ~530px，按钮只改 `activeTab`（v-show 面板在按钮下方 ~200px），点击后 scrollTop 不变，用户视觉零反馈，遂判定"失效"。

规则：抽屉/长页面里任何只切换下方区域状态的按钮（tab 切换、折叠展开、锚点跳转），处理函数必须 `nextTick(() => targetRef.value?.scrollIntoView({ behavior:'smooth', block:'start' }))`，让目标区域进入当前滚动容器可视区。

- 目标锚点加 `ref`；滚动容器是抽屉内容体（如 .tt-drawer-body，overflow-y:auto），scrollIntoView 只滚最近可滚动祖先，EP modal 锁滚保证背景页不被带动（实测 documentElement.scrollTop 保持 0）。
- 验证不能只看 class/状态变化，必须量化：点击后滚动容器 scrollTop 显著增大、目标 rect 进入容器可视区间、外层各容器 scrollTop 全为 0。
- 排查口诀：用户说"点不动"先做三分法——① elementFromPoint 查遮挡；② 程序化 .click() 查绑定与状态；③ 若状态变了，查目标区域是否在视口外、scrollTop 是否变化。跳过③会在事件层反复空转。

### 2.8 关抽屉后立即 router.push：history 竞争与 suppressNextClose（真实事故）

事故：任务抽屉引导区「去测试结果」点击后 URL 不变、Tab 不切。根因：`useDrawerHistory` 在 visible→false 时执行 `history.back()` 回收 marker，而处理函数紧接着 `router.push(同级 ?tab=xxx)`——push 先入栈、back 随 watcher 异步执行把它弹回，导航被撤销。

修复（composable 已支持）：`const { suppressNextClose } = useDrawerHistory(visible)`；导航前先 `suppressNextClose()`，再关 visible、再 router.push。suppress 是一次性的（下次 open 自动复位），普通 X 关闭/遮罩关闭/系统返回的 back 路径完全不变。

### 2.9 el-dialog 漏 append-to-body：iOS 真机顶部裁切（桌面永远复现不了）

事故：抽屉内打开的 el-dialog 在真机顶部被 navbar 下沿裁切、标题只剩半截，桌面 Chrome 与 375px iframe 内全部几何正常（margin/rect/祖先 transform 全绿），极难定位。

机理（EP 2.13 源码级）：dialog2.mjs 中 `ElTeleport` 的 `disabled = appendTo !== 'body' ? false : !appendToBody`。**不写 append-to-body 时 Teleport 禁用，overlay 留在组件原 DOM 位置**（本仓是 `.app-main`，overflow:auto+position:relative 的滚动容器）。iOS WKWebView 对滚动容器内 `position:fixed` 有包含块偏移老 bug，overlay 参照系错位到容器内容区顶部；桌面 Chrome 已修复该行为，故本地无法复现。

规则：
- 本仓**所有 el-dialog/el-drawer 一律显式写 append-to-body**，code review 见 dialog 先查这个属性；grep 验证修复后 `overlay.parentElement === document.body`。
- 排查 iOS-only 的 fixed/弹窗定位异常，先查 DOM 挂载点而不是算几何：桌面测量全正常本身就是信号。
- 弹窗内还有弹窗时（抽屉→dialog）更要加，否则嵌套在滚动容器深处偏移更严重。
- 修复要全量排查不要只修报错页：一次事故后用 `grep -rn "<el-dialog" src/views/apms` 列出全部弹窗逐行核对（多行标签的属性可能在第二/三行），本仓曾一次补齐 14 处（indicator/phv/comboModel/comboScore/testModel/bodyMeasure/medical/report/rtp/rtpWarning），零业务逻辑改动。system/monitor 等框架页与 tool/build 里 `:modal-append-to-body="false"` 的刻意用法不在收口范围。

### 2.10 关抽屉顶部蓝条闪一次：同 URL popstate 触发完整路由守卫（真实事故）

事故：H5 下无论 X、遮罩还是右滑手势关抽屉，页面顶部都有蓝色进度条飞快闪一次，用户体感"页面重新渲染了一次"，但滚动位置不变、无网络请求、无整页 reload。点 X 和手势表现一致，说明问题在两条路径的公共链路，不在手势代码。

机理（vue-router 4 源码级）：
1. useDrawerHistory 开抽屉时 pushState 压入**同 URL** marker；关闭时 visible→false 的 watch 执行 `history.back()` 回收，浏览器派发 popstate。
2. vue-router 的 `popStateHandler`（dist/vue-router.mjs）对**每个** popstate 无条件 `listeners.forEach` 派发完整导航，不判断 URL 是否变化。
3. `permission.js` 的 `router.beforeEach` 首行 `NProgress.start()` → 蓝条亮起，全套鉴权守卫空跑一遍 → `afterEach` 里 `NProgress.done()`。同 URL 时 router-view 的 `:key="route.path"` 不变、组件不重挂载，所以只有蓝条和守卫空转，位置不动。

修复（permission.js beforeEach 最前面短路）：

```js
// from.matched 非空排除首次导航：START_LOCATION.fullPath 恰为 '/'，
// 不排除会误跳过根路径 → /index → 驾驶舱的重定向链
if (from.matched && from.matched.length > 0 && to.fullPath === from.fullPath) {
  return true   // 不 NProgress.start()，不重跑鉴权
}
```

- afterEach 的 `NProgress.done()` 在未 start 时是 no-op（nprogress 源码 `!this.status` 直接 return），不会凭空亮条，无需特判。
- 正常路由跳转 path/query/hash 任一变化则 fullPath 不同，短路不命中，蓝条行为不变。
- 排查口诀：用户说"闪一下/像刷新了"但位置不变，先查全局唯一进度条来源（本仓 NProgress 只在 permission.js 启停），再查 vue-router 守卫链；不要先怀疑组件重挂载或手势指令。
- 任何"同 URL history 标记位"方案（抽屉/弹层/全屏接管返回）都有此副作用，新写同类 composable 时本短路自动覆盖，无需各组件补丁。

## 3. 分页窄屏模式（RkPager 共享组件）

组件：`src/components/RkPager/index.vue`，被 athlete/bodyMeasure/comboScore/phv/rtp 等 7 处共用，**修复只改组件本身，不要各页补丁**。

### 3.1 窄屏横滑公式（已落地，照搬思路到同类组件）

```scss
@media (max-width: 768px) {
  .rk-pager2 {
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;   // iOS 动量滚动，跟手
    scrollbar-width: thin;                // Firefox
    scrollbar-color: #cbd5e1 transparent;
    &::-webkit-scrollbar { height: 4px; }
    &::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
    &::-webkit-scrollbar-track { background: transparent; }
  }
  .rk-pager2-info, .rk-pager2-btns { flex: none; }  // 子项保持 natural 宽，不被压缩
}
```

要点：
- 信息文案（共 N 人）与按钮组都 `flex: none` + 自身 `white-space: nowrap`，超出后整行单行横滑，末页按钮永远可达。
- **必须留可见滚动条线索**（4px 细 thumb）：用户明确反馈过「没有滚动条」等于功能不可见；iOS 滚动时 thumb 浮现，可接受。
- 不要用 `flex-wrap: wrap` 把分页折成两行——会顶高底栏、跳动布局，用户要的是滑动。
- mini 形态（看板列内 `mini` prop）内容少，横滑规则对其无害，不需要特判。

### 3.2 判定分页是否真的溢出

不能只看截图，读实际尺寸：子项 `scrollWidth > clientWidth` 即溢出；修复后该容器可横滑且页面级无横滚。

### 3.3 手写分页条 .rk-pager（非 RkPager 组件）的全局收口

indicator/testTask/testResult/comboModel/medical/report/testModel 及 system/user、system/role 共 9 处用的是页面内手写 `.rk-pager > .rk-pager-info + .rk-pager-btns`（注意类名无 `2` 后缀，与 RkPager 组件的 `.rk-pager2` 是两套）。这些页面全部 @use roster-kit，故规则只在 roster-kit.scss 的 768 断点写一次，禁止逐页补丁：

```scss
@media (max-width: 768px) {
  .rk-pager { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch;
    scrollbar-width: thin; scrollbar-color: #c0c0c0 transparent; }
  .rk-pager-info { flex: none; white-space: nowrap; }
  .rk-pager-btns { flex: none; }
}
```

- 验收读 computed：`flex: none` 的序列化值是 **"0 0 auto"**（不是关键字 none），别误判为未生效；桌面视口下同元素是 "0 1 auto"（媒体查询未命中），可用来区分规则是否生效。
- 改每页条数只改该页 `const PAGE_SIZE`（dispatch 三页已从 10 改 4）；先全局 grep 组件是否只被一个路由 embedded 使用，确认无独立路由后才可直接改常量。

## 4. 窄屏文字竖排/折行：通用修复公式

事故形态：胶囊「13岁」竖成「13/岁」、「全部」竖成「全/部」。根因都是 flex 子项可收缩 + 无 nowrap。

1. 文本容器基础类加 `white-space: nowrap; flex: none;`（见 `.rp-chip`）。
2. 同组胶囊在 ≤768px 占整行并内部横滑：父组 `width:100%; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none`，`::-webkit-scrollbar { display:none }`（筛选组允许隐藏滚动条，与分页不同——筛选组有边缘半截胶囊暗示可滑；分页必须显式滚动条）。
3. 标签 `.rpf-label` 同样 `flex: none`，防止被挤。
4. 禁止靠缩字号/拆两行迁就宽度；用户名、编号等表格文本在 H5 媒体查询内统一 `white-space: nowrap`，交给表格横滑容器。
5. 通用类缺口在全局补，不要各页打补丁：`.rk-person-main/.rk-person-sub`（队员姓名/队伍）与 `.rk-table .rk-mono`（日期/数字列）曾整体缺 nowrap，导致姓名逐字竖排、`2026-09-12` 断两行——已在 roster-kit.scss 的 768 断点统一收口，bodyMeasure/phv/medical 等全部 rk-table 页面自动受益。新增表格页直接用这些类，不要自行再加 nowrap。
   - `.rk-soft-chip`（方向/分类徽章，如「仅参考」「越小越好」）的 nowrap 直接加在基础类而非媒体查询：徽章在任何宽度下折行都是缺陷，桌面宽列本就不折行故零影响，窄列直接修复。
   - 漏网类排查：全局收口只覆盖 rk-person-*/rk-mono，页面自定义姓名类（testTask 的 `.tt-mname`、testResult 的 `.tr-name`）不会自动受益，需在各页 768 块单独 `white-space:nowrap`。新写人名单元格优先复用 rk-person-main，自建类必须自查 nowrap。
   - 药丸/胶囊类（border-radius:999px 的状态 pill，如 testTask `.tt-dir` 方向药丸「↓越小越好」）同 rk-soft-chip 原则：nowrap 直接写基础类，任何宽度折行都是缺陷。
6. 滚动条唯一事实源是 `layout/components/AppMain.vue` 的非 scoped 全局 `::-webkit-scrollbar`（6px，thumb #c0c0c0）。组件内禁止另写 webkit scrollbar 尺寸（scoped 双轨会特异性打架且 @use 链路未必编译进目标页）；Firefox 补 `scrollbar-width: thin; scrollbar-color: #c0c0c0 transparent` 即可。iOS Safari 静止时隐藏滚动条是平台行为，CSS 不可强制常显，靠边缘裁切内容 + 滚动时浮现提供暗示。

## 5. 弹窗表单（el-dialog）H5 适配

事故形态：固定 `width="520px"` 的弹窗在 375px 视口超宽，两列 `el-col :span="12"` 把标签压折行（「体重(kg)」断成两段）、el-input-number 步进器被右边缘裁切。

### 5.1 动手前两条铁律（本仓真实返工教训）

1. **先沿用户点击路径确认真实组件**：同一标题的弹窗可能存在于多个组件（「新增体态测量」同时存在于 `bodyMeasure/index.vue` 页面级弹窗与 `athlete/components/AthleteDetailPanel.vue` 抽屉内弹窗）。用户从抽屉进入时命中的是后者，改页面级文件完全无效。用标题文本全局 grep 出全部 el-dialog，再按截图背景/入口路径锁定。
2. **先查全局样式再写组件补丁**：`src/assets/styles/ruoyi.scss` 的 `@media (max-width:768px)` 已有弹窗宽度规则（`.el-dialog:not(.is-fullscreen) { width: calc(100vw - 24px) !important }`）。宽度问题通常已解决，真实缺口是内部布局；在全局块扩展一次即覆盖全部 11+ 个同构弹窗，禁止在各 SFC 里加自定义类各修一遍（双轨规则必然漂移）。

### 5.2 全局收口三规则（已落地 ruoyi.scss，新增弹窗自动受益）

```scss
@media (max-width: 768px) {
  .el-dialog:not(.is-fullscreen) .el-col { flex: 0 0 100%; max-width: 100%; }  // 多列表单单列堆叠
  .el-dialog:not(.is-fullscreen) .el-form-item__label { white-space: nowrap; } // 标签不折行
  .el-dialog:not(.is-fullscreen) .el-input-number { width: 100%; }             // 步进器满宽
}
```

- 双类选择器特异性 (0,3,0) 高于 EP 单类 (0,1,0)，无需 !important；`:not(.is-fullscreen)` 排除全屏弹窗。
- EP 在 use-dialog 把 `--el-dialog-width` 写进内联 style，宽度只能靠已有的 `width !important` 覆盖，普通变量声明打不过内联。
- el-dialog teleport 到 body，组件 scoped 样式打不中；全局 ruoyi.scss 经 main.js 引入，是这类适配的唯一正确落点。
- 全部规则限定 ≤768px，桌面端多列布局原样保留。

### 5.3 验证注意

- 改 scss 后已存在的 iframe/页面可能持有旧 CSS（HMR 不总是替换 iframe 内样式），实测必须硬刷新或重建 iframe（src 加时间戳），否则会误判规则未生效。
- 验收量化值（375px 视口实测基线）：el-col computed flex=`0 0 100%`；label white-space=`nowrap`；el-input-number 宽度 ≈197px（不再是被压的 46px）；dialog offsetWidth ≈351px。

### 5.4 复杂弹窗内部（非标准表单）的窄屏模式

全局三规则只管 el-col/label/input-number；公式推导、详情类弹窗的自定义网格/表格要在组件内补 768 媒体查询（参考 `phv/index.vue` 的 mf-* 规则）：

- N 列等宽网格（如 5 列输入参数 `grid-template-columns: repeat(5,1fr)`）：窄屏统一降 2 列 `repeat(2, minmax(0,1fr))`，数字卡不再被压到 50px 折行。
- 弹窗内数据表：`display:block; overflow-x:auto; white-space:nowrap`——table 转 block 可横滑且不破坏表布局，长公式/代入表达式不压缩列。
- `<pre>` 公式块：保留 `white-space:pre-wrap` 换行能力，加 `overflow-x:auto` 兜底，字号可降到 11.5px。
- 左右对挤的结论行（`justify-content:space-between`）：改 `flex-direction:column; align-items:flex-start`。
- auto-fill 卡片网格 `minmax(300px,1fr)` 在 ~291px 内容宽下必然溢出：窄屏改 `minmax(0,1fr)` 单列（参考 MeasureCyclePanel 的 mc-grid）。

### 5.5 录入型宽表弹窗的 H5 重构（网格/手动录入实战）

§5.4 的 table 转 block 横滚只适合**只读短表**；列数随指标/模型字段动态增长的**录入网格**在窄屏整窗横晃、输入格够不着，必须换交互形态而不是继续压列宽。参考实现 `components/ResultGridEntryDialog`（网格录入）与 `components/ResultEntryDialog`（单人手动录入），桌面模板原样保留，≤768px 走独立分支。

三种替代形态（按场景选）：

1. **选人/选指标类 el-table → 全宽清单行**：每行 = 圆形勾选 + 名称/code/分类药丸 + 行尾单位方向状态；头部放「全选/清空」。勾选仍写原数据数组，下一步/提交逻辑无感知。
2. **多人×多指标录入网格 → 按测项分页**：每屏只呈现 1 个测项 + 全队纵向列表；三种换列方式（顶部 chip 横滑条带 `已填/总数` 进度与状态点、‹ › 箭头、列表区横滑手势），翻页后 chip 居中、列表回顶。模型维度按模型分组，双行 sticky 表头问题随之消失。
3. **单人录入的指标宽表 → 卡片流**：每指标一张卡，卡内纵向「名称/code/分类 → 单位·方向·当前值胶囊 → 满宽输入框」，无横向滚动。

配套规则：

- 输入框触摸规格统一：高 40px、字号 16px（低于 16px iOS 聚焦会自动放大页面）、数值框 `inputmode="decimal"`。
- 表单标签置顶纵排：el-form-item 窄屏改 block 布局，inline 的 `label-width` 只能 `!important` 覆盖；模型双列字段网格降单列满宽。
- **单一横滚承载（与 §2.4 抽屉同构）**：弹窗 body 加 `overflow-x:hidden`，横滚只允许发生在清单、chip 条等自带容器；窄屏唯一横滚元素是 chip 条，列表只纵滚。
- 固定宽控件撑破弹窗事故：el-select 内联 `width:340px` 在 375px 视口超宽 40+px，把整个 body 撑出横滚（表现为弹窗整窗能横晃）。修法：768 断点条带纵排 + select `width:100% !important`，body `overflow-x:hidden` 兜底——以后再漏一个固定宽控件也不会撑晃整窗。
- 历史值带出 UX：已有成绩自动回填时用淡蓝底（`.is-echo`）与用户新输入区分，并配 touched 双态——带出值不修改不进提交体（防止把历史成绩重复入库为新 attempt）；模型多字段记录任一字段被改时按整模型非空字段快照提交，避免新记录丢字段。统计行明示「已带出 N 格，修改后才作为新尝试提交」。

### 5.6 模态框右滑关闭指令 vDialogSwipe（两起真实事故沉淀）

指令在 `src/utils/dialogSwipe.js`，与 `vDrawerSwipe` 同构并复用 `touchViewportActive/findHorizontalScroller` 内核（阈值、边缘判定、输入控件放行完全一致）。本仓 68 个 el-dialog 分散在 40+ 文件，**不要做 document 全局委托**，以下事故已证明该路线不可行。

事故一：委托方案导致「再次打开弹窗消失」。

- 委托在 `.el-dialog` 上写内联 transform 跟手，而 EP 自身开关动画也用 transform 作用同一元素；内联样式清理靠两层 setTimeout，el-dialog 默认不销毁 DOM，快速重开时残留的 `translateX(100vw)` 压过进场动画，弹窗停在屏外。
- 模拟点击 `.el-dialog__headerbtn`/派发 Escape 是旁路通道，与组件 v-model 链路脱节；组件卸载后游离定时器仍操作旧节点，嵌套弹窗时序更乱。
- 正解是指令模式：与组件同生命周期，`unmounted` 必然移除监听并清理内联样式，touchstart 再防御性清一次；关闭直接调 binding 传入的组件关闭函数（组件自己的 v-model=false），不模拟 DOM 事件。

挂载方式（照抄四个公共弹窗：网格/手动/导入预览/设备接入）：

```vue
<el-dialog v-model="visible" append-to-body>
  <div class="dialog-swipe-host" v-dialog-swipe="() => (visible = false)">
    <!-- 默认插槽内容；host 是无样式单根包裹层 -->
  </div>
  <template #footer>...</template>   <!-- 具名插槽必须是 el-dialog 直接子节点 -->
</el-dialog>
```

- **#footer 包进 host div 会编译失败**（SFC 500：具名插槽找不到组件宿主），宿主 div 只包默认插槽内容。
- 嵌套弹窗（如手动录入里的设备采集子弹窗，teleport 到 body）各自挂指令，`closest('.el-dialog')` 天然只解析最近面板，右滑子弹窗不会带动外层。
- 关闭函数有额外收尾时传组件方法（如导入预览传 `handleClose` 保留 step3 成功回调），不要只传裸赋值。

事故二：手势关闭「闪一下」而点 X 不闪。

- EP 离场是 CSS **@keyframes**（`dialog-fade-out`/`modal-fade-out`，作用在 `.el-overlay` 与 `.el-overlay-dialog`），其 0% 关键帧 `opacity:1; transform:translateZ(0)` 优先级高于普通内联样式。手势先把弹窗内联到 `translateX(100vw)`，close 瞬间关键帧把它从屏外拉回原位再播淡出 = 闪烁；点 X 无内联样式所以不闪。
- 修复三阶段时序：①手势自己的 transition 跟手滑出（220ms）；②close 前一帧对 `.el-overlay`/`.el-overlay-dialog` 设 `animation:none !important` 再切 v-model，元素保持滑出终态；③等过 EP 离场窗口（300ms+余量，常量 EP_LEAVE_MS=380）overlay 已 `display:none` 后再清全部内联样式，切换不可见。
- `clearInline` 必须连 `animation` 残留一起清，否则压制带到下次打开，弹窗无淡入直接出现；定时器保存句柄，清理/卸载时可取消。
- el-drawer 的 vDrawerSwipe 同构存在相同隐患（EP drawer 离场也是 keyframes），仅因滑出方向与离场方向接近、跳变不明显而未被反馈；修法可直接复用同一套压制。

豁免面 `.dialog-swipe-ignore`：

- `findHorizontalScroller` 只认 `overflow-x:auto/scroll` 的容器；`overflow-x:hidden` 但自带横滑语义的自定义面（网格录入的测项翻页列表 `.rg-mlist`）识别不了，横滑翻页会被误接管为关闭手势。
- 这类容器显式打 `class="dialog-swipe-ignore"`，指令 touchstart 命中即整体放行；新增同类横滑组件照此打标，不要改手势内核。
- 输入控件（input/textarea/select/[contenteditable]/.el-input/.el-textarea/.el-select）默认放行，内部横拖是选文本/移光标。
- 适用范围：只挂高频公共弹窗，业务 CRUD 弹窗按需按上述模板补；el-drawer 仍用 vDrawerSwipe，`.el-dialog`/`.el-drawer` 类名互斥，两套手势不叠加。

## 6. 验证流程（轻量优先，禁止无头浏览器）

1. Vite 编译探针：`curl -s -o /tmp/vc.txt -w "%{http_code}" "http://localhost:5173/<文件路径>?t=$(date +%s)"`，需 200 且无 `Transform failed/Internal server error/Pre-transform error`。
2. GetDiagnostics 目标文件 0 错误。
3. mock/纯逻辑改动写 Node 桩测（参考 `.trae/demo-tests/run.mjs`，用其 `hooks.mjs` ESM loader 解析无扩展名 import；`register(new URL('./hooks.mjs', import.meta.url))` 后经 `mockDispatch` 走完整引擎），临时桩测文件用完即删。
4. 回归：跑完桩测后再跑 `node .trae/demo-tests/run.mjs` 全量（当前基线 55 项全过）。
5. 视觉与触摸手感由用户在真机/手机视口验收，agent 不主动开 headless Chrome。
6. 汇报必须给出：改动文件、断点行为对照表（桌面/H5 各是什么行为）、桩测通过数。
