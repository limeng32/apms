<template>
  <div class="login-designer" v-loading="loading">
    <!-- 顶部操作栏 -->
    <div class="ld-header">
      <div class="ld-title">
        登录页设计
        <el-tag v-if="dirty" type="warning" size="small" effect="plain" class="ld-dirty">未保存</el-tag>
      </div>
      <div class="ld-actions">
        <el-button @click="triggerImport">导入 JSON</el-button>
        <el-button @click="exportJson">导出 JSON</el-button>
        <el-button @click="resetDefault">恢复默认</el-button>
        <el-button
          v-hasPermi="['system:loginconfig:edit']"
          type="primary"
          :disabled="!dirty || saving"
          :loading="saving"
          @click="save"
        >保存</el-button>
        <input
          ref="fileInputRef"
          type="file"
          accept=".json,application/json"
          style="display:none"
          @change="onFilePicked"
        >
      </div>
    </div>

    <div class="ld-body">
      <!-- 左侧：实时预览（与真实登录页共用 LoginRenderer + LoginFormFields） -->
      <div class="ld-preview">
        <div class="preview-stage" ref="stageRef">
          <div class="preview-canvas" :style="canvasStyle">
            <div class="preview-scaler" :style="scalerStyle">
              <LoginRenderer :config="localConfig">
                <template #form>
                  <LoginFormFields
                    :model-value="previewForm"
                    :config="localConfig"
                    preview
                  />
                </template>
              </LoginRenderer>
            </div>
          </div>
        </div>
        <div class="preview-tip">预览为真实登录页等比缩放，所有修改即时生效；保存后退出登录即可看到线上效果</div>
      </div>

      <!-- 右侧：属性面板 -->
      <div class="ld-panel">
        <el-tabs v-model="activeTab" class="ld-tabs">
          <!-- ======================== 文案与显隐 ======================== -->
          <el-tab-pane label="文案" name="content">
            <el-form label-position="top" class="ld-form">
              <div class="ld-section">品牌区</div>
              <el-form-item label="品牌名称（留空则取系统标题）">
                <el-input v-model="localConfig.brand.name" maxlength="100" placeholder="默认取 VITE_APP_TITLE" />
              </el-form-item>
              <el-form-item label="英文副标题">
                <el-input v-model="localConfig.brand.subTitle" maxlength="200" />
              </el-form-item>

              <div class="ld-section">
                Hero 标题区
                <el-switch v-model="localConfig.hero.visible" size="small" style="margin-left:12px" />
              </div>
              <template v-if="localConfig.hero.visible">
                <div
                  v-for="(line, idx) in localConfig.hero.lines"
                  :key="idx"
                  class="ld-line-row"
                >
                  <el-input v-model="line.text" maxlength="200" :placeholder="`第 ${idx + 1} 行`" />
                  <el-tooltip content="强调色显示" placement="top">
                    <el-checkbox v-model="line.accent">强调</el-checkbox>
                  </el-tooltip>
                  <el-button
                    link
                    type="danger"
                    :disabled="localConfig.hero.lines.length <= 1"
                    @click="localConfig.hero.lines.splice(idx, 1)"
                  >删除</el-button>
                </div>
                <el-button
                  size="small"
                  plain
                  :disabled="localConfig.hero.lines.length >= 6"
                  @click="localConfig.hero.lines.push({ text: '', accent: false })"
                >+ 添加一行</el-button>
                <el-form-item label="描述段落" style="margin-top:12px">
                  <el-input v-model="localConfig.hero.description" type="textarea" :rows="2" maxlength="500" show-word-limit />
                </el-form-item>

                <div class="ld-section">
                  特性列表
                  <el-switch v-model="localConfig.hero.features.visible" size="small" style="margin-left:12px" />
                </div>
                <div
                  v-for="(f, idx) in localConfig.hero.features.items"
                  :key="idx"
                  class="ld-feature-card"
                >
                  <div class="ld-feature-head">
                    <el-select v-model="f.icon" style="width:150px">
                      <el-option v-for="ic in ICON_OPTIONS" :key="ic.value" :label="ic.label" :value="ic.value">
                        <el-icon style="vertical-align:-2px;margin-right:6px"><component :is="ic.value" /></el-icon>
                        {{ ic.label }}
                      </el-option>
                    </el-select>
                    <el-button
                      link
                      type="danger"
                      :disabled="localConfig.hero.features.items.length <= 1"
                      @click="localConfig.hero.features.items.splice(idx, 1)"
                    >删除</el-button>
                  </div>
                  <el-input v-model="f.title" maxlength="50" placeholder="加粗小标题" style="margin-top:8px" />
                  <el-input v-model="f.text" maxlength="200" placeholder="说明文字" style="margin-top:8px" />
                </div>
                <el-button
                  size="small"
                  plain
                  :disabled="localConfig.hero.features.items.length >= 8"
                  @click="localConfig.hero.features.items.push({ icon: 'Check', title: '', text: '' })"
                >+ 添加特性</el-button>
              </template>

              <div class="ld-section">登录表单</div>
              <div class="ld-grid-2">
                <el-form-item label="表单标题"><el-input v-model="localConfig.form.title" maxlength="100" /></el-form-item>
                <el-form-item label="表单副标题"><el-input v-model="localConfig.form.subtitle" maxlength="200" /></el-form-item>
                <el-form-item label="用户名占位"><el-input v-model="localConfig.form.usernamePlaceholder" maxlength="100" /></el-form-item>
                <el-form-item label="密码占位"><el-input v-model="localConfig.form.passwordPlaceholder" maxlength="100" /></el-form-item>
                <el-form-item label="记住我文案"><el-input v-model="localConfig.form.rememberText" maxlength="50" /></el-form-item>
                <el-form-item label="按钮文案"><el-input v-model="localConfig.form.buttonText" maxlength="50" /></el-form-item>
                <el-form-item label="登录中文案"><el-input v-model="localConfig.form.loadingText" maxlength="50" /></el-form-item>
              </div>

              <div class="ld-section">忘记密码</div>
              <el-radio-group v-model="localConfig.form.forgot.mode" size="small">
                <el-radio-button value="alert">点击弹提示</el-radio-button>
                <el-radio-button value="link">跳转链接</el-radio-button>
                <el-radio-button value="hidden">隐藏</el-radio-button>
              </el-radio-group>
              <el-form-item label="链接/按钮文案" style="margin-top:10px">
                <el-input v-model="localConfig.form.forgot.text" maxlength="50" :disabled="localConfig.form.forgot.mode === 'hidden'" />
              </el-form-item>
              <el-form-item v-if="localConfig.form.forgot.mode === 'alert'" label="提示内容">
                <el-input v-model="localConfig.form.forgot.alertMessage" maxlength="200" />
              </el-form-item>
              <el-form-item v-else-if="localConfig.form.forgot.mode === 'link'" label="跳转地址">
                <el-input v-model="localConfig.form.forgot.url" placeholder="https:// 或 /站内路径" />
                <div class="ld-hint">仅允许 http(s):// 外链或单斜杠开头站内路径，保存时服务端校验</div>
              </el-form-item>

              <div class="ld-section">版权</div>
              <el-form-item label="品牌区版权（左下，{year} {title} 为占位符，支持备案链接）">
                <el-input
                  v-model="localConfig.footer.brandText"
                  type="textarea"
                  :rows="2"
                  maxlength="400"
                  show-word-limit
                />
                <div class="ld-hint">
                  链接写法：&lt;a href="https://beian.miit.gov.cn/" target="_blank"&gt;京ICP备XXXXXXXX号-X&lt;/a&gt;（仅允许 http(s)）
                  <el-button link type="primary" size="small" @click="appendIcp('brandText')">插入备案链接</el-button>
                </div>
              </el-form-item>
              <el-form-item label="表单区版权（右下，{footerContent} 为占位符，支持备案链接）">
                <el-input
                  v-model="localConfig.footer.copyright"
                  type="textarea"
                  :rows="2"
                  maxlength="400"
                  show-word-limit
                />
                <div class="ld-hint">
                  链接写法：&lt;a href="https://beian.miit.gov.cn/" target="_blank"&gt;京ICP备XXXXXXXX号-X&lt;/a&gt;（仅允许 http(s)）
                  <el-button link type="primary" size="small" @click="appendIcp('copyright')">插入备案链接</el-button>
                </div>
              </el-form-item>
              <el-form-item label="显示表单区版权">
                <el-switch v-model="localConfig.footer.showCopyright" />
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- ======================== 主题色 ======================== -->
          <el-tab-pane label="主题色" name="colors">
            <el-form label-position="top" class="ld-form">
              <div class="ld-section">
                品牌背景渐变
                <div class="ld-presets">
                  <span class="ld-preset-label">快速色板：</span>
                  <span
                    v-for="p in PALETTES"
                    :key="p.name"
                    class="ld-palette"
                    :title="p.name"
                    @click="applyPalette(p)"
                  >
                    <i v-for="(c, i) in p.swatches" :key="i" :style="{ background: c }" />
                  </span>
                </div>
              </div>
              <el-form-item :label="`渐变角度：${localConfig.colors.brandGradient.angle}°`">
                <el-slider v-model="localConfig.colors.brandGradient.angle" :min="0" :max="360" :step="1" />
              </el-form-item>
              <div class="ld-stops">
                <div v-for="(s, idx) in localConfig.colors.brandGradient.stops" :key="idx" class="ld-color-row">
                  <span class="ld-color-label">渐变色 {{ idx + 1 }}</span>
                  <el-color-picker v-model="localConfig.colors.brandGradient.stops[idx]" />
                  <el-input v-model="localConfig.colors.brandGradient.stops[idx]" size="small" class="ld-color-input" />
                  <el-button
                    link type="danger"
                    :disabled="localConfig.colors.brandGradient.stops.length <= 2"
                    @click="localConfig.colors.brandGradient.stops.splice(idx, 1)"
                  >删除</el-button>
                </div>
                <el-button
                  size="small" plain
                  :disabled="localConfig.colors.brandGradient.stops.length >= 4"
                  @click="localConfig.colors.brandGradient.stops.push('#27503f')"
                >+ 添加渐变色</el-button>
              </div>

              <div class="ld-section">颜色明细</div>
              <div class="ld-color-grid">
                <div v-for="c in COLOR_FIELDS" :key="c.path" class="ld-color-row">
                  <span class="ld-color-label">{{ c.label }}</span>
                  <el-color-picker v-model="localConfig.colors[c.path]" show-alpha />
                  <el-input v-model="localConfig.colors[c.path]" size="small" class="ld-color-input" />
                </div>
              </div>
            </el-form>
          </el-tab-pane>

          <!-- ======================== 布局 ======================== -->
          <el-tab-pane label="布局" name="layout">
            <el-form label-position="top" class="ld-form">
              <el-form-item label="布局模板">
                <el-radio-group model-value="split" disabled>
                  <el-radio-button value="split">左右分栏（当前支持）</el-radio-button>
                </el-radio-group>
                <div class="ld-hint">居中卡片 / 全屏背景模板将在后续版本提供</div>
              </el-form-item>
              <el-form-item :label="`左右分栏比例（左:右）：${localConfig.layout.splitRatio} : 1`">
                <el-slider v-model="localConfig.layout.splitRatio" :min="0.5" :max="3" :step="0.1" />
              </el-form-item>
              <el-form-item :label="`圆角：${localConfig.layout.cardRadius}px`">
                <el-slider v-model="localConfig.layout.cardRadius" :min="0" :max="40" :step="1" />
              </el-form-item>
              <el-form-item label="窄屏（≤900px）显示品牌区">
                <el-switch v-model="localConfig.layout.showBrandOnMobile" />
                <div class="ld-hint">默认隐藏品牌区，仅显示登录表单</div>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup name="LoginConfig">
import LoginRenderer from '@/views/login/LoginRenderer.vue'
import LoginFormFields from '@/views/login/LoginFormFields.vue'
import { getManagedLoginConfig, updateLoginConfig } from '@/api/loginConfig'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { cloneDefaults, mergeWithDefaults } from '@/views/login/login.utils'

const { proxy } = getCurrentInstance()
const router = useRouter()
const loginThemeStore = useLoginThemeStore()

// 设计器可选图标（后端 ICONS 白名单的精选子集；View/Hide/Sunny/Moon 为界面控件图标不适合特性条目）
const ICON_OPTIONS = [
  { value: 'Check', label: '勾选' },
  { value: 'TrendCharts', label: '趋势' },
  { value: 'Key', label: '钥匙' },
  { value: 'Document', label: '文档' },
  { value: 'User', label: '用户' },
  { value: 'Lock', label: '锁' },
  { value: 'CircleCheck', label: '圆形勾选' },
  { value: 'DataAnalysis', label: '数据分析' },
  { value: 'Medal', label: '奖牌' },
  { value: 'Histogram', label: '直方图' },
  { value: 'Aim', label: '目标' },
  { value: 'Timer', label: '秒表' },
  { value: 'FirstAidKit', label: '急救箱' },
  { value: 'Monitor', label: '显示器' },
  { value: 'Cellphone', label: '手机' },
  { value: 'Star', label: '星星' },
  { value: 'Flag', label: '旗帜' },
  { value: 'Trophy', label: '奖杯' },
  { value: 'MagicStick', label: '魔棒' },
  { value: 'Odometer', label: '仪表' }
]

// 可编辑颜色字段（path 对应 localConfig.colors.*）
const COLOR_FIELDS = [
  { path: 'accent', label: '强调色' },
  { path: 'glow2', label: '第二光晕' },
  { path: 'textOnBrand', label: '品牌区主文字' },
  { path: 'textOnBrandMuted', label: '品牌区描述文字' },
  { path: 'pageBg', label: '页面底色' },
  { path: 'formTitle', label: '表单标题' },
  { path: 'formSubText', label: '次要文字' },
  { path: 'inputBorder', label: '输入框边框' },
  { path: 'inputFocus', label: '输入框聚焦' },
  { path: 'link', label: '链接色' },
  { path: 'buttonBg', label: '按钮常规' },
  { path: 'buttonHover', label: '按钮悬停' },
  { path: 'buttonLoading', label: '按钮加载态' }
]

// 快速预设色板（仅前端编辑辅助，不产生第二份默认值）
const PALETTES = [
  {
    name: '默认墨绿',
    swatches: ['#1d3b33', '#4aa886', '#2f6b57'],
    colors: {
      brandGradient: { angle: 150, stops: ['#16302a', '#1d3b33', '#27503f'] },
      accent: '#4aa886', glow2: '#3fa96e', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.7)', pageBg: '#ffffff',
      formTitle: '#1f2c28', formSubText: '#8a9a93', inputBorder: '#e3eae6',
      inputFocus: '#4aa886', buttonBg: '#2f6b57', buttonHover: '#3d8a6e',
      buttonLoading: '#4aa886', link: '#2f6b57'
    }
  },
  {
    name: '商务藏蓝',
    swatches: ['#1e3a5f', '#3b82c4', '#2563eb'],
    colors: {
      brandGradient: { angle: 150, stops: ['#13293f', '#1e3a5f', '#274f7a'] },
      accent: '#4ea3e0', glow2: '#3b82c4', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.72)', pageBg: '#ffffff',
      formTitle: '#1f2d3d', formSubText: '#8492a6', inputBorder: '#e3e8ee',
      inputFocus: '#3b82c4', buttonBg: '#2563eb', buttonHover: '#3b82f6',
      buttonLoading: '#4ea3e0', link: '#2563eb'
    }
  },
  {
    name: '碳黑橙金',
    swatches: ['#222222', '#f59e0b', '#d97706'],
    colors: {
      brandGradient: { angle: 150, stops: ['#141414', '#222222', '#333333'] },
      accent: '#f59e0b', glow2: '#d97706', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.68)', pageBg: '#ffffff',
      formTitle: '#262626', formSubText: '#8c8c8c', inputBorder: '#e5e5e5',
      inputFocus: '#f59e0b', buttonBg: '#d97706', buttonHover: '#f59e0b',
      buttonLoading: '#fbbf24', link: '#d97706'
    }
  }
]

const loading = ref(true)
const saving = ref(false)
const activeTab = ref('content')
const localConfig = ref(cloneDefaults())
let savedSnapshot = JSON.stringify(localConfig.value)

const previewForm = { username: 'admin', password: 'admin123', rememberMe: false }

const dirty = computed(() => JSON.stringify(localConfig.value) !== savedSnapshot)

function markSaved() {
  savedSnapshot = JSON.stringify(localConfig.value)
  // 同步登录页 store：同 SPA 内退出重进登录页前保持一致（onMounted 仍会重新拉取）
  loginThemeStore.config = mergeWithDefaults(localConfig.value)
}

// ============================ 加载 / 保存 ============================

async function loadData() {
  loading.value = true
  try {
    const data = await getManagedLoginConfig()
    // 回显同样在前端合并默认值后再填表，保存提交完整对象
    localConfig.value = mergeWithDefaults(data)
    savedSnapshot = JSON.stringify(localConfig.value)
  } finally {
    loading.value = false
  }
}

function save() {
  saving.value = true
  updateLoginConfig(localConfig.value).then(() => {
    markSaved()
    proxy.$modal.msgSuccess('登录页配置已保存并立即生效')
  }).finally(() => {
    saving.value = false
  })
}

function resetDefault() {
  proxy.$modal.confirm('确定恢复为系统内置默认配置吗？恢复后需点击「保存」才会生效。').then(() => {
    localConfig.value = cloneDefaults()
    proxy.$modal.msgSuccess('已恢复为默认配置（尚未保存）')
  }).catch(() => {})
}

function applyPalette(p) {
  localConfig.value.colors = { ...localConfig.value.colors, ...JSON.parse(JSON.stringify(p.colors)) }
}

const ICP_SNIPPET = ' <a href="https://beian.miit.gov.cn/" target="_blank">京ICP备XXXXXXXX号-X</a>'
function appendIcp(key) {
  localConfig.value.footer[key] = (localConfig.value.footer[key] || '') + ICP_SNIPPET
}

// ============================ 导入 / 导出 ============================

const fileInputRef = ref(null)

function triggerImport() {
  fileInputRef.value && fileInputRef.value.click()
}

function onFilePicked(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    let parsed
    try {
      parsed = JSON.parse(reader.result)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('not-object')
      }
    } catch (err) {
      proxy.$modal.msgError('文件不是合法的登录页配置 JSON 对象')
      return
    }
    // 导入复用保存接口：服务端走与保存完全相同的白名单校验
    proxy.$modal.confirm(`将用文件「${file.name}」的内容直接覆盖当前配置并立即生效，是否继续？`).then(() => {
      saving.value = true
      updateLoginConfig(parsed).then(() => {
        localConfig.value = mergeWithDefaults(parsed)
        markSaved()
        proxy.$modal.msgSuccess('配置已导入并生效')
      }).finally(() => {
        saving.value = false
      })
    }).catch(() => {})
  }
  reader.readAsText(file)
}

function exportJson() {
  const blob = new Blob([JSON.stringify(localConfig.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'login-page-config.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ============================ 未保存离开拦截 ============================

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return window.confirm('当前登录页配置尚未保存，确定离开吗？')
})

function onBeforeUnload(e) {
  if (dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

// ============================ 预览缩放 ============================

const DESIGN_W = 1280
const DESIGN_H = 800
const stageRef = ref(null)
const scale = ref(0.5)

const canvasStyle = computed(() => ({
  width: `${DESIGN_W * scale.value}px`,
  height: `${DESIGN_H * scale.value}px`
}))

// 1280×800 设计稿等比缩放进画布（transform 不影响布局，需配合外层缩放后尺寸 + overflow:hidden）
const scalerStyle = computed(() => ({
  width: `${DESIGN_W}px`,
  height: `${DESIGN_H}px`,
  transform: `scale(${scale.value})`
}))

let resizeObserver = null
onMounted(() => {
  loadData()
  resizeObserver = new ResizeObserver(measure)
  if (stageRef.value) resizeObserver.observe(stageRef.value)
  measure()
})
onBeforeUnmount(() => resizeObserver && resizeObserver.disconnect())

function measure() {
  const el = stageRef.value
  if (!el) return
  const w = el.clientWidth - 24
  const h = el.clientHeight - 24
  if (w > 0 && h > 0) {
    scale.value = Math.min(w / DESIGN_W, h / DESIGN_H)
  }
}
</script>

<style lang="scss" scoped>
.login-designer {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 84px);
  background: #f5f7fa;
}

.ld-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.ld-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.ld-dirty { margin-left: 10px; }
.ld-actions { display: flex; gap: 8px; }

.ld-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* ============ 预览区 ============ */
.ld-preview {
  flex: 0 0 46%;
  display: flex;
  flex-direction: column;
  padding: 14px;
  min-width: 0;
}
.preview-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dfe4ea;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
}
.preview-canvas {
  position: relative;
  box-shadow: 0 8px 30px rgba(0, 0, 0, .18);
  overflow: hidden;
}
.preview-scaler {
  position: absolute;
  top: 0;
  left: 0;
  width: 1280px;
  transform-origin: top left;
  /* 覆盖 Renderer 的 100vh 与真实视口媒体查询，保证设计稿固定 1280×800 双栏形态 */
  :deep(.login-wrap) {
    min-height: 800px !important;
    grid-template-columns: var(--login-split) !important;
  }
  :deep(.login-brand) { display: flex !important; }
  :deep(.login-form-side) { min-height: 800px; }
}
.preview-tip {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

/* ============ 属性面板 ============ */
.ld-panel {
  flex: 1;
  min-width: 0;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  display: flex;
  flex-direction: column;
}
.ld-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
  :deep(.el-tabs__content) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
.ld-form { max-width: 560px; padding-bottom: 40px; }

.ld-section {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin: 18px 0 12px;
  padding-left: 8px;
  border-left: 3px solid #409eff;
}
.ld-section:first-child { margin-top: 6px; }

.ld-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}
.ld-line-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.ld-feature-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 10px;
  background: #fafbfc;
}
.ld-feature-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ld-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

/* 颜色编辑行 */
.ld-color-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 18px;
}
.ld-color-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.ld-color-label {
  flex: 1;
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
}
.ld-color-input { width: 108px; }
.ld-stops { margin-bottom: 8px; }

/* 预设色板 */
.ld-presets {
  display: inline-flex;
  align-items: center;
  margin-left: 14px;
  font-weight: 400;
}
.ld-preset-label { font-size: 12px; color: #909399; margin-right: 6px; }
.ld-palette {
  display: inline-flex;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  margin-right: 8px;
  cursor: pointer;
  i {
    display: inline-block;
    width: 20px;
    height: 18px;
  }
}
</style>
