import { createApp } from 'vue'

import Cookies from 'js-cookie'

import ElementPlus, { ElDialog } from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import locale from 'element-plus/es/locale/lang/zh-cn'

import '@/assets/styles/index.scss' // global css（其中 @use fonts.scss：自托管 Inter/Noto Sans SC/Plex Mono，woff2 分片按需加载）

import App from './App'
import store from './store'
import router from './router'
import directive from './directive' // directive

// 注册指令
import plugins from './plugins' // plugins
import { download } from '@/utils/request'

// svg图标
import 'virtual:svg-icons-register'
import SvgIcon from '@/components/SvgIcon'
import elementIcons from '@/components/SvgIcon/svgicon'

import './permission' // permission control

// 业务站 PWA 全屏（仅生产 aoti 域生效；展示站/dev 自动跳过）
import { setupPortalPwa } from '@/utils/pwa'
setupPortalPwa()

import { useDict } from '@/utils/dict'
import { getConfigKey } from "@/api/system/config"
import { parseTime, resetForm, addDateRange, handleTree, selectDictLabel, selectDictLabels, cookieName } from '@/utils/ruoyi'

// ElDialog 全局增强包装（H5 右滑关闭）：必须在 app.use(ElementPlus) 之后覆盖注册，
// 所有 <el-dialog> 解析到包装版；内部直接 import 真 ElDialog 模块，无递归
import SwipeDialog from '@/components/SwipeDialog/index.vue'

// 分页组件
import Pagination from '@/components/Pagination'
// 自定义表格工具组件
import RightToolbar from '@/components/RightToolbar'
// 富文本组件
import Editor from "@/components/Editor"
// 文件上传组件
import FileUpload from "@/components/FileUpload"
// 图片上传组件
import ImageUpload from "@/components/ImageUpload"
// 图片预览组件
import ImagePreview from "@/components/ImagePreview"
// 字典标签组件
import DictTag from '@/components/DictTag'

const app = createApp(App)

// 全局方法挂载
app.config.globalProperties.useDict = useDict
app.config.globalProperties.download = download
app.config.globalProperties.parseTime = parseTime
app.config.globalProperties.resetForm = resetForm
app.config.globalProperties.handleTree = handleTree
app.config.globalProperties.addDateRange = addDateRange
app.config.globalProperties.getConfigKey = getConfigKey
app.config.globalProperties.selectDictLabel = selectDictLabel
app.config.globalProperties.selectDictLabels = selectDictLabels

// 全局组件挂载
app.component('DictTag', DictTag)
app.component('Pagination', Pagination)
app.component('FileUpload', FileUpload)
app.component('ImageUpload', ImageUpload)
app.component('ImagePreview', ImagePreview)
app.component('RightToolbar', RightToolbar)
app.component('Editor', Editor)

app.use(router)
app.use(store)
app.use(plugins)
app.use(elementIcons)
app.component('svg-icon', SvgIcon)

directive(app)

// 使用element-plus 并且设置全局的大小
app.use(ElementPlus, {
  locale: locale,
  // 支持 large、default、small
  size: Cookies.get(cookieName('size')) || 'default'
})

// 全局模态框默认禁止 ESC 关闭，防止录入表单被误触关闭丢失内容；
// 个别弹窗确需 ESC 关闭时，可在组件上显式 :close-on-press-escape="true" 覆盖。
// Drawer 复用 dialogProps 描述符对象，改 Dialog 默认值即同时覆盖 el-dialog 与 el-drawer。
ElDialog.props.closeOnPressEscape.default = false

// 覆盖全局 ElDialog 解析：包装版透传全部 props/事件/插槽，仅给默认插槽注入右滑关闭指令，
// 业务 SFC 中的 <el-dialog> 无需任何改动即获得 H5 手势（桌面端指令内部门控，零影响）
app.component('ElDialog', SwipeDialog)

app.mount('#app')
