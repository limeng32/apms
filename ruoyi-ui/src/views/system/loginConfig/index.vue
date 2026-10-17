<template>
  <div class="login-designer" v-loading="loading">
    <!-- 顶部操作栏 -->
    <div class="ld-header">
      <div class="ld-title">
        登录页设计
        <el-tag v-if="dirty" type="warning" size="small" effect="plain" class="ld-dirty">未保存</el-tag>
        <!-- 双入口切换：业务站 aoti.apms.top / 展示站 apms.top，两套配置独立保存 -->
        <el-radio-group
          :model-value="entry"
          size="small"
          class="ld-entry-switch"
          @change="switchEntry"
        >
          <el-radio-button label="portal">业务站（aoti）</el-radio-button>
          <el-radio-button label="showcase">展示站（www）</el-radio-button>
        </el-radio-group>
      </div>
      <div class="ld-actions">
        <el-button v-if="entry === 'showcase'" @click="copyFromPortal">从业务站复制</el-button>
        <!-- 两站点导入/导出完全分开：直接选「业务站」或「展示站」操作，不依赖当前编辑入口 -->
        <el-dropdown trigger="click" @command="onImportCommand">
          <el-button :loading="saving">导入 JSON<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="portal">导入到业务站（aoti）</el-dropdown-item>
              <el-dropdown-item command="showcase">导入到展示站（www）</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-dropdown trigger="click" @command="onExportCommand">
          <el-button>导出 JSON<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="portal">导出业务站（aoti）配置</el-dropdown-item>
              <el-dropdown-item command="showcase">导出展示站（www）配置</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
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

    <!-- 操作流提示条：降低首次使用门槛，关闭后记忆（不再打扰熟练用户） -->
    <div v-if="!tipDismissed" class="ld-flow-tip">
      <el-icon class="ld-flow-tip-icon"><InfoFilled /></el-icon>
      <div class="ld-flow-tip-body">
        <b>三步完成配置：</b>
        ① 左侧是<em>实时预览</em>，改动立即可见；
        ② 右侧在「文案 / 外观 / 浏览器端布局 / 移动端布局」中调整，<em>电脑端与手机端需分别设置</em>；
        ③ 点右上角<em>「保存」</em>后立即生效。
        顶部先切换「业务站 / 展示站」分别编辑；「导入/导出 JSON」下拉可对两个站点各自独立备份与恢复（含标题、移动端 Logo 等全部设置）。
      </div>
      <button type="button" class="ld-flow-tip-x" aria-label="关闭提示" @click="dismissDesignerTip">×</button>
    </div>

    <div class="ld-body">
      <!-- 左侧：实时预览（与真实登录页共用 LoginRenderer + LoginFormFields） -->
      <div class="ld-preview">
        <div class="preview-stage" ref="stageRef">
          <div class="preview-canvas" :class="{ 'canvas-mobile': isMobileView }" :style="canvasStyle">
            <div class="preview-scaler" :class="scalerClass" :style="scalerStyle">
              <!-- 移动端：手机外框内渲染 H5 登录页 -->
              <div v-if="isMobileView" class="phone-bezel">
                <div class="phone-screen">
                  <LoginRenderer
                    :config="localConfig"
                    device="mobile"
                    :showcase="isShowcaseEntry"
                    logo-draggable
                    :preview-scale="scale"
                    @logo-offset="onLogoOffset"
                  >
                    <!-- 展示形态无登录卡片，与真实 apms.top 落地页一致 -->
                    <template v-if="!isShowcaseEntry" #form>
                      <LoginFormFields
                        :model-value="previewForm"
                        :config="localConfig"
                        preview
                      />
                    </template>
                  </LoginRenderer>
                </div>
              </div>
              <!-- 桌面端：1280×800 设计稿 -->
              <LoginRenderer
                v-else
                :config="localConfig"
                :showcase="isShowcaseEntry"
                logo-draggable
                :preview-scale="scale"
                @logo-offset="onLogoOffset"
              >
                <template v-if="!isShowcaseEntry" #form>
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
        <div class="preview-tip">{{ previewTip }}</div>
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
              <el-form-item label="浏览器标签页标题（留空使用入口默认）">
                <el-input
                  v-model="localConfig.brand.browserTitle"
                  maxlength="100"
                  show-word-limit
                  :placeholder="`默认：${defaultBrowserTitle}`"
                />
                <div class="ld-hint">整站生效（登录页/展示页与登录后各页面标签标题）；仅作用于当前「{{ entry === 'showcase' ? '展示站' : '业务站' }}」，两站分别配置</div>
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
                  ref="brandTextInput"
                  v-model="localConfig.footer.brandText"
                  type="textarea"
                  :rows="3"
                  maxlength="400"
                  show-word-limit
                />
                <div class="ld-hint">
                  链接写法：&lt;a href="https://beian.miit.gov.cn/" target="_blank"&gt;京ICP备XXXXXXXX号-X&lt;/a&gt;（仅允许 http(s)）
                  <el-button link type="primary" size="small" @click="insertIcp('brandText')">插入备案链接</el-button>
                  <el-button link type="primary" size="small" @click="insertPolice('brandText')">插入公安备案标识</el-button>
                  <div>文本框中直接回车换行即可控制排版；{police} 显示为警徽+公安备案号（需开启下方开关并填写编号）</div>
                </div>
              </el-form-item>
              <el-form-item label="表单区版权（右下，{footerContent} 为占位符，支持备案链接）">
                <el-input
                  ref="copyrightInput"
                  v-model="localConfig.footer.copyright"
                  type="textarea"
                  :rows="3"
                  maxlength="400"
                  show-word-limit
                />
                <div class="ld-hint">
                  链接写法：&lt;a href="https://beian.miit.gov.cn/" target="_blank"&gt;京ICP备XXXXXXXX号-X&lt;/a&gt;（仅允许 http(s)）
                  <el-button link type="primary" size="small" @click="insertIcp('copyright')">插入备案链接</el-button>
                  <el-button link type="primary" size="small" @click="insertPolice('copyright')">插入公安备案标识</el-button>
                  <div>文本框中直接回车换行即可控制排版；{police} 显示为警徽+公安备案号（需开启下方开关并填写编号）</div>
                </div>
              </el-form-item>
              <el-form-item label="显示表单区版权">
                <el-switch v-model="localConfig.footer.showCopyright" />
              </el-form-item>

              <div class="ld-section">公安备案</div>
              <el-form-item label="显示公安备案标识">
                <el-switch v-model="localConfig.footer.police.show" />
              </el-form-item>
              <el-form-item label="备案编号">
                <el-input
                  v-model="localConfig.footer.police.number"
                  placeholder="如：京公网安备 11010802020425号"
                  maxlength="60"
                  :disabled="!localConfig.footer.police.show"
                />
              </el-form-item>
              <el-form-item label="备案查询链接">
                <el-input
                  v-model="localConfig.footer.police.url"
                  placeholder="https://beian.mps.gov.cn/ 备案详情地址"
                  :disabled="!localConfig.footer.police.show"
                />
                <div class="ld-hint">
                  填写公安联网备案信息详情页地址（http(s) 外链），点击警徽新标签打开；留空则仅展示标识不可点击
                </div>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- ======================== 外观（配色 / 字体 / 圆角 / 入场动效） ======================== -->
          <el-tab-pane label="外观" name="appearance">
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

              <div class="ld-section">渐变效果</div>
              <div v-for="g in GRADIENT_FIELDS" :key="g.key" class="ld-grad-block">
                <div class="ld-grad-head">
                  <span class="ld-grad-title">{{ g.label }}</span>
                  <el-switch v-model="localConfig.colors[g.key].enabled" />
                </div>
                <template v-if="localConfig.colors[g.key].enabled">
                  <el-form-item :label="`渐变角度：${localConfig.colors[g.key].angle}°`" style="margin-bottom:8px">
                    <el-slider v-model="localConfig.colors[g.key].angle" :min="0" :max="360" :step="1" />
                  </el-form-item>
                  <div class="ld-stops">
                    <div v-for="(s, idx) in localConfig.colors[g.key].stops" :key="idx" class="ld-color-row">
                      <span class="ld-color-label">色标 {{ idx + 1 }}</span>
                      <el-color-picker v-model="localConfig.colors[g.key].stops[idx]" />
                      <el-input v-model="localConfig.colors[g.key].stops[idx]" size="small" class="ld-color-input" />
                      <el-button
                        link type="danger"
                        :disabled="localConfig.colors[g.key].stops.length <= 2"
                        @click="localConfig.colors[g.key].stops.splice(idx, 1)"
                      >删除</el-button>
                    </div>
                    <el-button
                      size="small" plain
                      :disabled="localConfig.colors[g.key].stops.length >= 4"
                      @click="localConfig.colors[g.key].stops.push('#22d3ee')"
                    >+ 添加色标</el-button>
                  </div>
                </template>
                <div class="ld-hint">{{ g.hint }}</div>
              </div>

              <div class="ld-section">颜色明细</div>
              <div class="ld-color-grid">
                <div v-for="c in COLOR_FIELDS" :key="c.path" class="ld-color-row">
                  <span class="ld-color-label">{{ c.label }}</span>
                  <el-color-picker v-model="localConfig.colors[c.path]" show-alpha />
                  <el-input v-model="localConfig.colors[c.path]" size="small" class="ld-color-input" />
                </div>
              </div>

              <div class="ld-section">整体字体（登录页 + 后台管理系统）</div>
              <el-form-item label="字体风格">
                <el-radio-group v-model="localConfig.typography.fontFamily" class="ld-font-group">
                  <el-radio value="heiti" class="ld-font-radio">
                    <div class="ld-font-card" :style="{ fontFamily: FONT_STACKS.heiti }">
                      <div class="ld-font-name">黑体</div>
                      <div class="ld-font-sample">运动员训练数据管理系统 123ABC</div>
                      <div class="ld-font-desc">Inter · Noto Sans SC · 系统字体回退（与原型 demo 一致）</div>
                    </div>
                  </el-radio>
                  <el-radio value="songti" class="ld-font-radio">
                    <div class="ld-font-card" :style="{ fontFamily: FONT_STACKS.songti }">
                      <div class="ld-font-name">宋体</div>
                      <div class="ld-font-sample">运动员训练数据管理系统 123ABC</div>
                      <div class="ld-font-desc">Songti SC · STSong · SimSun 衬线回退</div>
                    </div>
                  </el-radio>
                </el-radio-group>
                <div class="ld-hint">切换后保存即对整体系统（含登录页）生效；黑体使用随站点自托管的 Inter / Noto Sans SC（无需访问外网），缺字库时按字体栈自动回退</div>
              </el-form-item>

              <el-form-item :label="`Hero 主标题字号：${localConfig.typography.heroSize}px`">
                <el-slider v-model="localConfig.typography.heroSize" :min="20" :max="64" :step="1" />
              </el-form-item>
              <el-form-item :label="`Hero 主标题字重：${localConfig.typography.heroWeight}`">
                <el-slider v-model="localConfig.typography.heroWeight" :min="300" :max="900" :step="100" />
              </el-form-item>
              <el-form-item :label="`品牌名称字号：${localConfig.typography.brandNameSize}px`">
                <el-slider v-model="localConfig.typography.brandNameSize" :min="12" :max="36" :step="1" />
              </el-form-item>
              <el-form-item :label="`表单标题字号：${localConfig.typography.formTitleSize}px`">
                <el-slider v-model="localConfig.typography.formTitleSize" :min="14" :max="40" :step="1" />
              </el-form-item>

              <div class="ld-section">圆角与入场动效</div>
              <el-form-item>
                <template #label>
                  全局圆角：{{ localConfig.layout.cardRadius }}px
                  <LoginHelpTip content="登录页与后台管理系统全局生效：按钮、输入框、卡片、弹窗的圆角统一变化；移动端登录页同样使用该值。" />
                </template>
                <el-slider v-model="localConfig.layout.cardRadius" :min="0" :max="40" :step="1" />
                <div class="ld-hint">系统全局生效：按钮、输入框、卡片、弹窗圆角；移动端登录页同样使用该圆角</div>
              </el-form-item>
              <el-form-item label="文字与卡片入场动画（标语逐字上浮 + 区块依次淡入）">
                <el-switch v-model="localConfig.animation.entrance" />
                <div class="ld-hint">
                  关闭后登录页静态呈现，无任何入场动画；开启时访客系统若设置了「减弱动态效果」也会自动停用。
                </div>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <!-- ======================== 浏览器端布局 ======================== -->
          <el-tab-pane label="浏览器端布局" name="layout">
            <LoginLayoutFields
              :layout="localConfig.layout"
              :logo="localConfig.brand.logo"
              :client-logo="localConfig.brand.logoClient"
              :logo-space="localConfig.brand.logoSpace"
              :background="localConfig.background"
              :favicon="localConfig.brand.favicon"
              @patch="onFieldPatch"
              @logo-type-change="onLogoTypeChange"
              @select-builtin="selectBuiltinLogo"
              @reset-builtin="resetLogoBuiltin"
              @reset-geometry="resetLogoGeometry"
              @logo-uploaded="onLogoUploaded"
              @bg-uploaded="onBgUploaded"
              @clear-bg="clearBg"
              @favicon-uploaded="onFaviconUploaded"
              @clear-favicon="clearFavicon"
            />
          </el-tab-pane>

          <!-- ======================== 移动端布局 ======================== -->
          <el-tab-pane label="移动端布局" name="mobileLayout">
            <LoginLayoutFields
              mobile
              :layout="localConfig.mobile.layout"
              :logo="localConfig.mobile.brand.logo"
              :client-logo="localConfig.mobile.brand.logoClient"
              :logo-space="localConfig.mobile.brand.logoSpace"
              :background="localConfig.mobile.background"
              @patch="onFieldPatch"
              @logo-type-change="onLogoTypeChange"
              @select-builtin="selectBuiltinLogo"
              @reset-builtin="resetLogoBuiltin"
              @reset-geometry="resetLogoGeometry"
              @logo-uploaded="onLogoUploaded"
              @bg-uploaded="onBgUploaded"
              @clear-bg="clearBg"
            />
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup name="LoginConfig">
import LoginRenderer from '@/views/login/LoginRenderer.vue'
import LoginFormFields from '@/views/login/LoginFormFields.vue'
import LoginLayoutFields from '@/views/login/LoginLayoutFields.vue'
import LoginHelpTip from '@/views/login/LoginHelpTip.vue'
import { ArrowDown, InfoFilled } from '@element-plus/icons-vue'
import { getManagedLoginConfig, updateLoginConfig } from '@/api/loginConfig'
import useLoginThemeStore from '@/store/modules/loginTheme'
import { isShowcaseHost } from '@/utils/entry'
import {
  cloneDefaults, mergeWithDefaults,
  BUILTIN_LOGO_VALUES,
  FONT_STACKS,
  normalizeProfileUrl,
  applyLoginHead, restoreLoginHead
} from '@/views/login/login.utils'

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
  { path: 'accent', label: '品牌色（全局主色）' },
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

// 渐变构建器字段（path 对应 localConfig.colors.*）
const GRADIENT_FIELDS = [
  {
    key: 'heroGradient',
    label: 'Hero 强调文字渐变（作用于勾选「强调」的标语行）',
    hint: '关闭后强调行使用「颜色明细」中的品牌色（纯色）'
  },
  {
    key: 'buttonGradient',
    label: '登录按钮渐变',
    hint: '关闭后按钮使用「颜色明细」中的常规/悬停/加载三色（纯色）'
  }
]

// 快速预设色板（仅前端编辑辅助，不产生第二份默认值）
const PALETTES = [
  {
    name: '科技蓝（默认）',
    swatches: ['#0a1120', '#3b82f6', '#2563eb'],
    colors: {
      brandGradient: { angle: 150, stops: ['#0a1120', '#0f172a', '#111b31'] },
      accent: '#2563eb', glow2: '#3b82f6', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.7)', pageBg: '#ffffff',
      formTitle: '#0f172a', formSubText: '#94a3b8', inputBorder: '#e5e9f0',
      inputFocus: '#2563eb', buttonBg: '#2563eb', buttonHover: '#3b82f6',
      buttonLoading: '#06b6d4', link: '#2563eb',
      heroGradient: { enabled: true, angle: 90, stops: ['#3b82f6', '#22d3ee'] },
      buttonGradient: { enabled: true, angle: 90, stops: ['#2563eb', '#06b6d4'] }
    }
  },
  {
    name: '经典墨绿',
    swatches: ['#1d3b33', '#4aa886', '#2f6b57'],
    colors: {
      brandGradient: { angle: 150, stops: ['#16302a', '#1d3b33', '#27503f'] },
      accent: '#4aa886', glow2: '#3fa96e', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.7)', pageBg: '#ffffff',
      formTitle: '#1f2c28', formSubText: '#8a9a93', inputBorder: '#e3eae6',
      inputFocus: '#4aa886', buttonBg: '#2f6b57', buttonHover: '#3d8a6e',
      buttonLoading: '#4aa886', link: '#2f6b57',
      heroGradient: { enabled: false, angle: 90, stops: ['#4aa886', '#7fd1b4'] },
      buttonGradient: { enabled: false, angle: 90, stops: ['#2f6b57', '#3d8a6e'] }
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
      buttonLoading: '#4ea3e0', link: '#2563eb',
      heroGradient: { enabled: true, angle: 90, stops: ['#4ea3e0', '#7cc4f2'] },
      buttonGradient: { enabled: true, angle: 90, stops: ['#2563eb', '#3b82c4'] }
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
      buttonLoading: '#fbbf24', link: '#d97706',
      heroGradient: { enabled: true, angle: 90, stops: ['#fbbf24', '#f59e0b'] },
      buttonGradient: { enabled: true, angle: 90, stops: ['#d97706', '#f59e0b'] }
    }
  },
  {
    name: '运动红',
    swatches: ['#7f1d1d', '#ef4444', '#c62828'],
    colors: {
      brandGradient: { angle: 150, stops: ['#4a0e0e', '#7f1d1d', '#991b1b'] },
      accent: '#ef4444', glow2: '#dc2626', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.72)', pageBg: '#ffffff',
      formTitle: '#2d1515', formSubText: '#a68484', inputBorder: '#eee3e3',
      inputFocus: '#ef4444', buttonBg: '#c62828', buttonHover: '#dc2626',
      buttonLoading: '#ef5350', link: '#c62828',
      heroGradient: { enabled: true, angle: 90, stops: ['#ef4444', '#f87171'] },
      buttonGradient: { enabled: true, angle: 90, stops: ['#c62828', '#ef4444'] }
    }
  },
  {
    name: '典雅紫',
    swatches: ['#3b1770', '#8b5cf6', '#6d28d9'],
    colors: {
      brandGradient: { angle: 150, stops: ['#2a1057', '#3b1770', '#4c1d95'] },
      accent: '#8b5cf6', glow2: '#7c3aed', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.72)', pageBg: '#ffffff',
      formTitle: '#241a3d', formSubText: '#8a84a6', inputBorder: '#e6e3f0',
      inputFocus: '#8b5cf6', buttonBg: '#6d28d9', buttonHover: '#7c3aed',
      buttonLoading: '#8b5cf6', link: '#6d28d9',
      heroGradient: { enabled: true, angle: 90, stops: ['#8b5cf6', '#c4b5fd'] },
      buttonGradient: { enabled: true, angle: 90, stops: ['#6d28d9', '#8b5cf6'] }
    }
  },
  {
    name: '碧海青',
    swatches: ['#0c4a5e', '#06b6d4', '#0e7490'],
    colors: {
      brandGradient: { angle: 150, stops: ['#083344', '#0c4a5e', '#0e5c6e'] },
      accent: '#06b6d4', glow2: '#0891b2', textOnBrand: '#ffffff',
      textOnBrandMuted: 'rgba(255,255,255,.72)', pageBg: '#ffffff',
      formTitle: '#15303a', formSubText: '#7d96a0', inputBorder: '#e0ecef',
      inputFocus: '#06b6d4', buttonBg: '#0e7490', buttonHover: '#0891b2',
      buttonLoading: '#22b8cf', link: '#0e7490',
      heroGradient: { enabled: true, angle: 90, stops: ['#22d3ee', '#06b6d4'] },
      buttonGradient: { enabled: true, angle: 90, stops: ['#0e7490', '#06b6d4'] }
    }
  }
]

const loading = ref(true)
const saving = ref(false)
const activeTab = ref('content')
/**
 * 当前编辑的入口：'portal' 业务站（aoti.apms.top）| 'showcase' 展示站（www）。
 * 两套配置独立加载/保存；切换时未保存草稿需二次确认后丢弃。
 */
const entry = ref('portal')
const isShowcaseEntry = computed(() => entry.value === 'showcase')
const entryLabel = computed(() => (isShowcaseEntry.value ? '展示站' : '业务站'))

// 顶部操作流提示条：关闭后记忆，不再打扰熟练用户（版本号变更可重新引导）
const tipDismissed = ref(false)
try {
  tipDismissed.value = localStorage.getItem('apms_designer_tip_v1') === '1'
} catch (e) { /* localStorage 不可用时默认显示提示 */ }
function dismissDesignerTip() {
  tipDismissed.value = true
  try { localStorage.setItem('apms_designer_tip_v1', '1') } catch (e) { /* 忽略 */ }
}
/** 浏览器标题留空时的默认值（仅用于输入框占位提示）：构建标题 VITE_APP_TITLE */
const defaultBrowserTitle = computed(() => import.meta.env.VITE_APP_TITLE)
const localConfig = ref(cloneDefaults())
// 已保存快照必须是响应式的：dirty 是 computed，若基准用普通闭包变量，
// 保存只更新该变量不会触发 dirty 重算，UI（保存按钮/切换入口确认）会停留在「未保存」状态。
const savedSnapshot = ref(JSON.stringify(localConfig.value))

const previewForm = { username: 'admin', password: 'admin123', rememberMe: false }

/* ============ 设备视图（由当前页签决定；点击「移动端布局」即切 H5 预览） ============ */
const isMobileView = computed(() => activeTab.value === 'mobileLayout')

/**
 * 当前设备下四个可独立编辑的布局根。
 * 桌面 → 顶层 layout/brand.logo/brand.logoSpace/background；
 * 移动 → mobile 子树对应字段。
 */
const editRoots = computed(() => {
  const c = localConfig.value
  return isMobileView.value
    ? {
        layout: c.mobile.layout,
        logo: c.mobile.brand.logo,
        clientLogo: c.mobile.brand.logoClient,
        logoSpace: c.mobile.brand.logoSpace,
        background: c.mobile.background
      }
    : {
        layout: c.layout,
        logo: c.brand.logo,
        clientLogo: c.brand.logoClient,
        logoSpace: c.brand.logoSpace,
        background: c.background
      }
})

// 子组件通用改写：{ section, sub?, key, value }
function onFieldPatch({ section, sub, key, value }) {
  const root = editRoots.value[section]
  if (sub) root[sub][key] = value
  else root[key] = value
}

const previewTip = computed(() => {
  if (isShowcaseEntry.value) {
    return isMobileView.value
      ? '当前为展示站移动端 H5 预览（375×812，无登录卡片）；保存后 apms.top 手机端即时生效'
      : '当前为展示站（www）落地页预览：无登录卡片与客户 logo，品牌区满宽；保存后即时生效'
  }
  return isMobileView.value
    ? '当前为业务站移动端 H5 登录页预览（375×812）；此处修改仅作用于移动端，点击「保存」后与浏览器端配置一起生效'
    : '预览为真实登录页等比缩放，所有修改即时生效；可直接按住 logo 拖动调整位置；保存后登录页与全系统品牌即时生效'
})

const dirty = computed(() => JSON.stringify(localConfig.value) !== savedSnapshot.value)

// 当前真实访问入口（设计器部署在业务站，但可能正在编辑展示站配置）
const hostEntry = isShowcaseHost() ? 'showcase' : 'portal'

function markSaved() {
  savedSnapshot.value = JSON.stringify(localConfig.value)
  // 仅当编辑的入口与当前访问入口一致时同步登录页 store（onMounted 仍会重新拉取），
  // 避免在业务站编辑展示站配置时污染本站登录预览
  if (entry.value === hostEntry) {
    loginThemeStore.config = mergeWithDefaults(localConfig.value)
  }
}

// ============================ 加载 / 保存 ============================

async function loadData(targetEntry) {
  loading.value = true
  try {
    const data = await getManagedLoginConfig(targetEntry)
    // 回显同样在前端合并默认值后再填表，保存提交完整对象
    localConfig.value = mergeWithDefaults(data)
    savedSnapshot.value = JSON.stringify(localConfig.value)
  } finally {
    loading.value = false
  }
}

/**
 * 切换编辑入口：当前草稿有未保存修改时需确认丢弃；确认后重新拉取目标入口配置。
 * radio-group 使用单向 :model-value，取消切换时 entry 不变、按钮状态自动回退。
 */
function switchEntry(target) {
  if (target === entry.value) return
  const doSwitch = () => {
    entry.value = target
    loadData(target)
  }
  if (dirty.value) {
    proxy.$modal.confirm(
      `当前${entryLabel.value}配置尚未保存，切换到「${target === 'showcase' ? '展示站' : '业务站'}」将丢弃未保存修改，是否继续？`
    ).then(doSwitch).catch(() => {})
  } else {
    doSwitch()
  }
}

/**
 * 展示站一键以业务站当前已保存配置为起点：
 * 仅拉取业务站正式配置填入本地草稿（不自动保存），管理员调整后点「保存」才落展示站配置行。
 */
function copyFromPortal() {
  proxy.$modal.confirm(
    '将用业务站当前已保存的配置覆盖展示站草稿（不会立即保存），可再调整后点「保存」。是否继续？'
  ).then(async () => {
    loading.value = true
    try {
      const data = await getManagedLoginConfig('portal')
      localConfig.value = mergeWithDefaults(JSON.parse(JSON.stringify(data)))
      proxy.$modal.msgSuccess('已复制业务站配置到展示站草稿，确认后请点击「保存」')
    } finally {
      loading.value = false
    }
  }).catch(() => {})
}

function save() {
  saving.value = true
  updateLoginConfig(localConfig.value, entry.value).then(() => {
    markSaved()
    proxy.$modal.msgSuccess(`${entryLabel.value}配置已保存并立即生效`)
  }).finally(() => {
    saving.value = false
  })
}

function resetDefault() {
  proxy.$modal.confirm(
    `确定恢复为系统内置默认配置吗？将重置当前编辑的「${entryLabel.value}」草稿，恢复后需点击「保存」才会生效。`
  ).then(() => {
    localConfig.value = cloneDefaults()
    proxy.$modal.msgSuccess(`已恢复为默认配置（${entryLabel.value}，尚未保存）`)
  }).catch(() => {})
}

function applyPalette(p) {
  localConfig.value.colors = { ...localConfig.value.colors, ...JSON.parse(JSON.stringify(p.colors)) }
}

// 版权 textarea 模板引用：备案链接/{police} 片段在光标处插入
const brandTextInput = ref(null)
const copyrightInput = ref(null)
const ICP_SNIPPET = ' <a href="https://beian.miit.gov.cn/" target="_blank">京ICP备XXXXXXXX号-X</a>'
const POLICE_SNIPPET = '{police}'

// 在 textarea 最后一次光标位置插入片段（el-input 失焦后 selectionStart 仍保留）；
// 拿不到原生节点时退化为追加末尾。插入后聚焦并把光标移到片段末尾
function insertFooterSnippet(key, snippet) {
  const inputRef = key === 'brandText' ? brandTextInput.value : copyrightInput.value
  const ta = inputRef?.$el?.querySelector?.('textarea') || null
  const cur = localConfig.value.footer[key] || ''
  let start = cur.length
  let end = cur.length
  if (ta && typeof ta.selectionStart === 'number') {
    start = ta.selectionStart
    end = ta.selectionEnd
  }
  localConfig.value.footer[key] = cur.slice(0, start) + snippet + cur.slice(end)
  nextTick(() => {
    if (!ta) return
    const pos = start + snippet.length
    ta.focus()
    ta.setSelectionRange(pos, pos)
  })
}
function insertIcp(key) {
  insertFooterSnippet(key, ICP_SNIPPET)
}
function insertPolice(key) {
  insertFooterSnippet(key, POLICE_SNIPPET)
}

// ============================ Logo / 背景 / Favicon ============================
// 所有编辑动作通过 editRoots 路由到当前设备（浏览器端顶层 / mobile 子树）；
// 上传通道与文件校验在 LoginLayoutFields 内，此处只处理上传成功后的落库。

// 预览区拖拽 logo → 像素偏移；位移已在 Renderer 内按 previewScale 换算。
// target='main' 写版权方 logo（左上），'client' 写客户方 logoClient（右上）
function onLogoOffset({ offsetX, offsetY }, target = 'main') {
  const logo = target === 'client' ? editRoots.value.clientLogo : editRoots.value.logo
  logo.offsetX = offsetX
  logo.offsetY = offsetY
}

function selectBuiltinLogo(value, target = 'main') {
  const logo = target === 'client' ? editRoots.value.clientLogo : editRoots.value.logo
  logo.type = 'builtin'
  logo.value = value
}
// 切换来源时保持 type/value 一致，避免「builtin + 图片路径」的瞬态把路径当组件名渲染
function onLogoTypeChange(type, target = 'main') {
  const logo = target === 'client' ? editRoots.value.clientLogo : editRoots.value.logo
  logo.type = type
  if (type === 'builtin') {
    if (!BUILTIN_LOGO_VALUES.includes(logo.value)) logo.value = 'shield'
  } else if (typeof logo.value !== 'string' || !logo.value.startsWith('/profile/')) {
    logo.value = ''
  }
}
function resetLogoBuiltin(target = 'main') {
  const logo = target === 'client' ? editRoots.value.clientLogo : editRoots.value.logo
  logo.type = 'builtin'
  logo.value = 'shield'
}
function resetLogoGeometry(target = 'main') {
  const logo = target === 'client' ? editRoots.value.clientLogo : editRoots.value.logo
  logo.offsetX = 0
  logo.offsetY = 0
}

function onLogoUploaded(res, target = 'main') {
  // 优先取相对路径 fileName；绝对 url 归一化为 /profile/ 相对路径（配置不允许存环境相关地址）
  const rel = normalizeProfileUrl(res && (res.fileName || res.url))
  if (res && res.code === 200 && rel) {
    const logo = target === 'client' ? editRoots.value.clientLogo : editRoots.value.logo
    logo.type = 'image'
    logo.value = rel
    proxy.$modal.msgSuccess('Logo 已上传，点击「保存」后正式生效')
  } else {
    proxy.$modal.msgError((res && res.msg) || '上传返回地址非法')
  }
}

function onBgUploaded(res) {
  const rel = normalizeProfileUrl(res && (res.fileName || res.url))
  if (res && res.code === 200 && rel) {
    const bg = editRoots.value.background
    bg.type = 'image'
    bg.image = rel
    proxy.$modal.msgSuccess('背景图已上传，点击「保存」后正式生效')
  } else {
    proxy.$modal.msgError((res && res.msg) || '上传返回地址非法')
  }
}

function clearBg() {
  editRoots.value.background.image = null
}

// Favicon 两端共享，始终落在顶层 brand
function onFaviconUploaded(res) {
  const rel = normalizeProfileUrl(res && (res.fileName || res.url))
  if (res && res.code === 200 && rel) {
    localConfig.value.brand.favicon = rel
    proxy.$modal.msgSuccess('Favicon 已上传，点击「保存」后登录页生效')
  } else {
    proxy.$modal.msgError((res && res.msg) || '上传返回地址非法')
  }
}
function clearFavicon() {
  localConfig.value.brand.favicon = null
}

// ============================ 导入 / 导出（业务站 / 展示站 各自独立）============================
//
// 设计要点：
// - 两个站点的导入/导出在顶栏完全分开，直接选择目标站点，不依赖当前正在编辑哪个入口；
// - 导出的是「该站点最近一次已保存的配置」（GET 后端），与默认值合并成完整结构，
//   保证任意版本导出的文件都含全部字段（浏览器标题 brand.browserTitle、
//   移动端 mobile.brand.logo / logoClient 等），跨版本导入不丢字段；
// - 文件顶层 meta 记录来源站点/导出时间；导入时校验归属：
//   跨站导入强警告、旧版无 meta 文件提示；meta 在提交前剥离，不写入数据库。

const EXPORT_META_KEY = 'meta'
const fileInputRef = ref(null)
/** 选择文件后要导入到的站点（由「导入到业务站/展示站」下拉项决定） */
let pendingImportEntry = 'portal'

function entryLabelOf(e) {
  return e === 'showcase' ? '展示站（www）' : '业务站（aoti）'
}

// 导出文件名站点段：展示站 www（www）、业务站 aoti（aoti.apms.top）
function entryFileSlug(e) {
  return e === 'showcase' ? 'www' : 'aoti'
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function timestampForFile() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** 下拉选择「导出业务站 / 导出展示站」 */
async function onExportCommand(targetEntry) {
  try {
    const data = await getManagedLoginConfig(targetEntry)
    // 与默认值合并：导出文件始终是「完整配置对象」，杜绝缺字段导致再次导入时「无指定」
    const full = mergeWithDefaults(data)
    full[EXPORT_META_KEY] = {
      source: 'apms-login-designer',
      entry: targetEntry,
      exportedAt: new Date().toISOString()
    }
    downloadJson(full, `apms-login-${entryFileSlug(targetEntry)}-${timestampForFile()}.json`)
    proxy.$modal.msgSuccess(`已导出${entryLabelOf(targetEntry)}配置（含桌面端、移动端、文案、标题等全部设置）`)
  } catch (e) {
    proxy.$modal.msgError('导出失败，请稍后重试')
  }
}

/** 下拉选择「导入到业务站 / 导入到展示站」→ 打开文件选择 */
function onImportCommand(targetEntry) {
  pendingImportEntry = targetEntry
  fileInputRef.value && fileInputRef.value.click()
}

function onFilePicked(e) {
  const file = e.target.files && e.target.files[0]
  e.target.value = ''
  if (!file) return
  const targetEntry = pendingImportEntry
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

    // 来源归属校验（meta 不入库，提交前剥离）
    const meta = parsed[EXPORT_META_KEY]
    delete parsed[EXPORT_META_KEY]
    const sourceEntry = meta && (meta.entry === 'portal' || meta.entry === 'showcase') ? meta.entry : ''
    let confirmText
    if (sourceEntry && sourceEntry !== targetEntry) {
      confirmText = `⚠️ 文件「${file.name}」是【${entryLabelOf(sourceEntry)}】的配置，确定要覆盖导入到【${entryLabelOf(targetEntry)}】吗？\n导入后立即生效，该站现有配置将被完全替换。`
    } else if (!sourceEntry) {
      confirmText = `文件「${file.name}」是旧版导出（未标注来源站点），将作为【${entryLabelOf(targetEntry)}】配置导入并立即生效，是否继续？\n如文件并非该站配置，请点取消后重新选择。`
    } else {
      confirmText = `将用文件「${file.name}」覆盖【${entryLabelOf(targetEntry)}】配置并立即生效，是否继续？`
    }

    proxy.$modal.confirm(confirmText).then(() => {
      saving.value = true
      updateLoginConfig(parsed, targetEntry).then(() => {
        // 若导入目标正是当前编辑入口：重新拉取该站数据回填，保证界面与后端一致
        if (targetEntry === entry.value) {
          return loadData(targetEntry)
        }
      }).then(() => {
        if (targetEntry === entry.value) {
          proxy.$modal.msgSuccess(`${entryLabelOf(targetEntry)}配置已导入并生效`)
        } else {
          proxy.$modal.msgSuccess(`已导入到${entryLabelOf(targetEntry)}；切换顶部入口可查看/继续编辑`)
        }
      }).finally(() => {
        saving.value = false
      })
    }).catch(() => {})
  }
  reader.readAsText(file)
}

// ============================ 未保存离开拦截 ============================

onBeforeRouteLeave(() => {
  if (!dirty.value) return true
  return window.confirm(`当前${entryLabel.value}登录页配置尚未保存，确定离开吗？`)
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

// 桌面设计稿 1280×800；移动端手机外框（含边框，屏幕 375×814）399×852
const DESIGN_DIMS = {
  desktop: { w: 1280, h: 800 },
  mobile: { w: 399, h: 852 }
}
const stageRef = ref(null)
const scale = ref(0.5)

const designDims = computed(() => (isMobileView.value ? DESIGN_DIMS.mobile : DESIGN_DIMS.desktop))

const canvasStyle = computed(() => ({
  width: `${designDims.value.w * scale.value}px`,
  height: `${designDims.value.h * scale.value}px`
}))

// 设计稿等比缩放进画布（transform 不影响布局，需配合外层缩放后尺寸 + overflow:hidden）
const scalerStyle = computed(() => ({
  width: `${designDims.value.w}px`,
  height: `${designDims.value.h}px`,
  transform: `scale(${scale.value})`
}))
const scalerClass = computed(() => (isMobileView.value ? 'scaler-mobile' : 'scaler-desktop'))

let resizeObserver = null
onMounted(() => {
  loadData()
  resizeObserver = new ResizeObserver(measure)
  if (stageRef.value) resizeObserver.observe(stageRef.value)
  measure()
})
onBeforeUnmount(() => {
  resizeObserver && resizeObserver.disconnect()
  // 离开设计器：favicon 实时预览恢复为系统默认（不在此处恢复标题，交由路由守卫）
  restoreLoginHead()
})

// 切换设备后画布尺寸改变，立即重新测量缩放
watch(isMobileView, () => nextTick(measure))

// favicon 所见即所得：上传/清除即时反映到当前标签页（仅图标，不改设计器标签标题）
watch(
  () => localConfig.value.brand?.favicon,
  (fav) => applyLoginHead({ favicon: fav || null })
)

function measure() {
  const el = stageRef.value
  if (!el) return
  const w = el.clientWidth - 24
  const h = el.clientHeight - 24
  if (w > 0 && h > 0) {
    scale.value = Math.min(w / designDims.value.w, h / designDims.value.h)
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
.ld-entry-switch { margin-left: 16px; }
.ld-actions { display: flex; gap: 8px; }

.ld-body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 操作流提示条（可关闭） */
.ld-flow-tip {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 18px 0;
  padding: 9px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  color: #1e40af;
  font-size: 12.5px;
  line-height: 1.7;
}
.ld-flow-tip-icon {
  margin-top: 3px;
  color: #2563eb;
  font-size: 15px;
  flex: none;
}
.ld-flow-tip-body {
  flex: 1;
  min-width: 0;
}
.ld-flow-tip-body b {
  color: #1e3a8a;
}
.ld-flow-tip-body em {
  font-style: normal;
  color: #b45309;
  font-weight: 600;
}
.ld-flow-tip-x {
  flex: none;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  padding: 0;
}
.ld-flow-tip-x:hover {
  background: #dbeafe;
  color: #1e40af;
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
/* 手机画布整体圆角（包住内部深色外框） */
.preview-canvas.canvas-mobile { border-radius: 44px; }

.preview-scaler {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: top left;
}

/* 桌面设计稿：覆盖 Renderer 的 100vh 与真实视口媒体查询，固定 1280×800 双栏形态 */
.scaler-desktop {
  :deep(.login-wrap) {
    min-height: 800px !important;
    grid-template-columns: var(--login-split) !important;
  }
  :deep(.login-brand) { display: flex !important; }
  :deep(.login-form-side) { min-height: 800px; }
}

/* 手机外框：深色边框 + 屏幕区（375×814） */
.phone-bezel {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 19px 12px;
  background: #111;
}
.phone-screen {
  width: 375px;
  height: 814px;
  border-radius: 28px;
  overflow: hidden;
  position: relative;
}
/* 屏幕内 Renderer 固定 H5 高度；.force-mobile 负责布局形态 */
.scaler-mobile :deep(.login-wrap) {
  min-height: 814px !important;
}
.scaler-mobile :deep(.login-form-side) {
  min-height: 814px;
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

/* 整体字体卡片式单选 */
.ld-font-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}
:deep(.ld-font-radio) {
  position: relative;
  height: auto;
  margin-right: 0;
  padding: 0;
  border: 1px solid #dcdfe6;
  border-radius: 10px;
  background: #fff;
  transition: border-color .15s, box-shadow .15s, background .15s;
  overflow: hidden;
  &:hover {
    border-color: var(--el-color-primary, #2563eb);
  }
  &.is-checked {
    border-color: var(--el-color-primary, #2563eb);
    background: var(--el-color-primary-light-9, #ecf0fe);
    box-shadow: 0 0 0 1px var(--el-color-primary, #2563eb) inset;
  }
  .el-radio__input {
    // 圆点移入卡片左上角内边距区，不占布局主轴
    position: absolute;
    top: 10px;
    left: 12px;
  }
  .el-radio__label {
    width: 100%;
    padding: 0;
  }
}
.ld-font-card {
  padding: 12px 14px 12px 30px;
  cursor: pointer;
}
.ld-font-name {
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 6px;
}
.ld-font-sample {
  font-size: 13px;
  line-height: 1.5;
  color: #303133;
  word-break: break-all;
}
.ld-font-desc {
  font-family: var(--el-font-family) !important;
  font-size: 11px;
  color: #909399;
  margin-top: 4px;
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
.ld-grad-block {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 12px 4px;
  margin-bottom: 12px;
  background: #fafbfc;
}
.ld-grad-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.ld-grad-title { font-size: 13px; color: #606266; font-weight: 500; }

/* 预设色板 */
.ld-presets {
  display: inline-flex;
  flex-wrap: wrap;
  row-gap: 8px;
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
