---
name: roster-style-pages
description: Reconstruct APMS ruoyi-ui (Vue3 + Element Plus) management list pages into the roster 花名册 style via roster-kit.scss. Use when the user asks to 按花名册风格重构/改造/美化 a 管理/列表 page such as 菜单/岗位/字典/参数管理. Do not use for backend changes or new feature pages.
---

# 花名册风格列表页改造

把 RuoYi 原生 `app-container + el-form 查询 + el-row 按钮 + el-table + pagination` 的管理页，改造为 APMS demo「花名册」视觉。**纯前端改造，零后端改动。**

## 改造前必读（每次都要核对）

1. **样式包**：[roster-kit.scss](file:///Users/limeng/Documents/trae_projects/apms/ruoyi-ui/src/assets/styles/roster-kit.scss)，scoped style 内 `@use "../../../assets/styles/roster-kit.scss" as *;`（页面在 `src/views/<三级目录>/index.vue` 时是三级；路径层级按实际文件调整）。不要在页面里重造同名 token/class。
2. **三个标杆范例**（改前先读对应模式的页面，不要凭记忆写）：
   - 普通分页列表（全宽）：`src/views/system/role/index.vue`
   - 普通分页列表（左树双栏）：`src/views/system/user/index.vue`
   - 树形列表（保留 el-table）：`src/views/system/dept/index.vue`
3. 完整读一遍目标页现有 `<script>`，列出必须原样保留的逻辑清单（API、权限指令、字典、弹窗、路由跳转、保护口径），改造后逐条对照。

## 页面骨架

- 根节点仍保留 `class="app-container"`（依赖全局 20px padding），追加页面类（如 `rm-page`/`dm-page`）。
- 顺序：`rk-header`（标题 + `N 个XX` 副标题 + 右侧操作）→ `rk-filter` 筛选卡 → `rk-table-card`（表格 + 可选 `rk-pager`）。弹窗/drawer 保持在根 div 内。
- 全宽页 canvas 底色：页面类 `margin:-20px; padding:40px 16px 36px 40px; min-height:calc(100vh - 84px); background:$rk-canvas;`。**左/上 padding 必须补偿 20px**——侧栏与头部是 fixed 定位，负 margin 会让盒子钻到它们下面，只补 16px 会导致 hero 被遮挡（详见 references/skeletons.md 第 8 节，含几何量测验收）。
- 左树双栏页：不改 margin，仅 `:deep(.tree-sidebar-manage-wrap)` 与 `.tree-sidebar-content/.content-inner` 覆盖底色与 16px padding（参照 user 页）。

## 筛选卡

- 文本用原生 `<input class="rk-input">`、下拉用原生 `<select class="rk-select">`（字典项 `dict.label/dict.value`，首项 `<option value="">全部</option>`）；日期仍用 el-date-picker，外层 `rm-date-field` + deep 收敛 32px/10px 圆角（直接抄范例 CSS）。
- 右侧 `rk-btn-reset`。筛选项变化 300ms 防抖自动查询（watch + `clearTimeout/setTimeout(handleQuery)`）；resetQuery 必须显式清空每个字段，不能依赖 resetForm（原生控件无 ref 校验绑定）。

## 普通列表（role 模式）

- el-table → 原生 `<table class="rk-table">`；复选框、全选/半选/禁选、`openMenuId` 行菜单、自定义分页（PAGE_SIZE=12、页码省略号窗口、空页自动回退一页）整套 script 直接按 role 页复制改字段名。
- 主实体列用 `rk-person`（32/34px 哈希首字头像 `avatarColor()` + 主名/副行）；编码类字段用 `rk-mono` 或 `rk-soft-chip`；状态用可点击 `rk-status-badge`（先翻转行 status 再走原 confirm/API，取消 catch 里回滚）。
- 操作列：可编辑行给「编辑 →」+ ⋮ 菜单（删除/其他次要动作）；内置/保护行给 `rk-dash` 文字。
- 批量按钮只在 `ids.length` 时出现；「修改选中」`:disabled="single"`。删除成功后清空 ids。
- 列宽：窄屏 media query 隐藏次要列（role：≤1280 隐创建时间、≤1080 隐编号）；验证 `scrollWidth <= clientWidth`。

## 树形列表（dept 模式）

- **保留 el-table**（树能力不要手写），用 `class="dm-tree-table"` + `:deep()` 收敛：CSS 变量覆盖 `--el-table-*` 颜色、th 12px 灰字、cell padding、展开箭头配色；整块外面包 `rk-table-card`。
- 名称列自定义 cell：首字方块/圆头像 + 名称 ellipsis；状态用**非按钮** `rk-status-badge`（树表状态通常无行内切换）。
- 内联编辑控件（如 el-input-number 排序）保留，deep 收敛高度圆角；展开/折叠的 `refreshTable + isExpandAll` 重建法保留。
- 无分页；副标题计数递归 walk。

## 红线（违反即返工）

- 不动任何 API 文件、后端、SQL、路由、菜单。
- 弹窗（新增/编辑/导入/数据权限/树勾选）、`v-hasPermi`、`useDict`、`v-loading`、表单 rules、跳转路径全部保留原逻辑；只改列表页外壳。
- 保护口径不能丢：内置角色/账户只读或禁选、自己不能停用自己等（按原 `isReadonlyXxx/checkRowSelectable` 语义搬）。
- 图标从 `@element-plus/icons-vue` 显式导入，不使用字符串 icon。
- 不新建无关文件、不主动写 README/文档。
- `handleCommand` 等原页死代码不必保留；但拿不准是否死代码时保留。

## 完成后的验证（GetDiagnostics 0 错误 + 浏览器实测）

浏览器 `browser_evaluate` 取不到返回值时，用 Image beacon（本地起 `python3 -m http.server`，脚本里 `new Image().src='http://127.0.0.1:9999/p?d='+encodeURIComponent(JSON.stringify(x))`，读 http server 日志解析）。验证完杀掉 server、删日志。

逐项过：
1. 标题/副标题计数、表格无横向溢出（`scrollWidth<=clientWidth`）、底色 `rgb(248,250,255)`、卡 14px 圆角。**hero 不被遮挡**：量 `rk-title` 位置，展开侧栏时 left=220/top=104，折叠侧栏（54px 窄栏）时 left=74。
2. 状态徽章/开关：confirm 文案、确定切换、**取消回滚**；保护行禁用态。
3. 复选：单选、全选、半选 indeterminate、禁选行、批量按钮显隐与 disabled。
4. ⋮ 菜单各项动作与弹窗外点击关闭（`onBeforeUnmount` 移除 document 监听）。
5. 筛选防抖、空状态、重置；左树页还要测节点点击 → chip → × 清除。
6. 新增/修改弹窗打开与数据回填、导入弹窗、抽屉；树表测展开折叠、行内新增下级、根节点无删除。
7. 分页：翻页、禁用态、删空页回退（数据不足 1 页时验证按钮 disabled）。
8. console 无 error。

## 可复用代码骨架

见 [references/skeletons.md](references/skeletons.md)：头像哈希、分页、多选、行菜单、筛选 watch、el-table 树表 deep 样式块。优先从标杆范例文件直接复制改名，骨架文件只作速查。
