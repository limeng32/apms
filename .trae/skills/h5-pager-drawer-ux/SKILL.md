---
name: h5-pager-drawer-ux
description: APMS 花名册风列表页 H5（≤768px）分页横滑、详情抽屉触发与返回手势、窄屏文字防折行的统一交互规范与修复流程。用户反馈手机端分页被裁切无滚动条、抽屉打不开/误触、胶囊文字竖排、列表横滚异常时使用。不用于桌面双栏宽度问题（用 rk-split-width-fix）或后端接口问题。
---

# H5 分页 + 抽屉用户体验规范

纯前端修复，红线：不动后端/API/路由/菜单；桌面端（>768px）既有行为不允许被媒体查询改动。

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

## 4. 窄屏文字竖排/折行：通用修复公式

事故形态：胶囊「13岁」竖成「13/岁」、「全部」竖成「全/部」。根因都是 flex 子项可收缩 + 无 nowrap。

1. 文本容器基础类加 `white-space: nowrap; flex: none;`（见 `.rp-chip`）。
2. 同组胶囊在 ≤768px 占整行并内部横滑：父组 `width:100%; flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none`，`::-webkit-scrollbar { display:none }`（筛选组允许隐藏滚动条，与分页不同——筛选组有边缘半截胶囊暗示可滑；分页必须显式滚动条）。
3. 标签 `.rpf-label` 同样 `flex: none`，防止被挤。
4. 禁止靠缩字号/拆两行迁就宽度；用户名、编号等表格文本在 H5 媒体查询内统一 `white-space: nowrap`，交给表格横滑容器。

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

## 6. 验证流程（轻量优先，禁止无头浏览器）

1. Vite 编译探针：`curl -s -o /tmp/vc.txt -w "%{http_code}" "http://localhost:5173/<文件路径>?t=$(date +%s)"`，需 200 且无 `Transform failed/Internal server error/Pre-transform error`。
2. GetDiagnostics 目标文件 0 错误。
3. mock/纯逻辑改动写 Node 桩测（参考 `.trae/demo-tests/run.mjs`，用其 `hooks.mjs` ESM loader 解析无扩展名 import；`register(new URL('./hooks.mjs', import.meta.url))` 后经 `mockDispatch` 走完整引擎），临时桩测文件用完即删。
4. 回归：跑完桩测后再跑 `node .trae/demo-tests/run.mjs` 全量（当前基线 55 项全过）。
5. 视觉与触摸手感由用户在真机/手机视口验收，agent 不主动开 headless Chrome。
6. 汇报必须给出：改动文件、断点行为对照表（桌面/H5 各是什么行为）、桩测通过数。
