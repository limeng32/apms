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
              <LoginRenderer
                :config="localConfig"
                logo-draggable
                :preview-scale="scale"
                @logo-offset="onLogoOffset"
              >
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
        <div class="preview-tip">预览为真实登录页等比缩放，所有修改即时生效；可直接按住左上角 logo 拖动调整位置；保存后登录页与全系统品牌即时生效</div>
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

          <!-- ======================== 字体 ======================== -->
          <el-tab-pane label="字体" name="font">
            <el-form label-position="top" class="ld-form">
              <div class="ld-section">字体族（5 个系统字体栈）</div>
              <el-form-item label="全局字体">
                <el-select v-model="localConfig.typography.fontFamily" style="width:100%">
                  <el-option label="系统默认（与全局一致）" value="system" />
                  <el-option label="苹方优先" value="pingfang" />
                  <el-option label="雅黑优先" value="yahei" />
                  <el-option label="黑体" value="heiti" />
                  <el-option label="宋体衬线" value="songti" />
                </el-select>
                <div class="ld-hint">仅使用访客本机系统字体，不加载网络字体，避免登录页加载外部资源</div>
              </el-form-item>

              <div class="ld-section">字号 / 字重</div>
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
            </el-form>
          </el-tab-pane>

          <!-- ======================== 图标与图片 ======================== -->
          <el-tab-pane label="图标与图片" name="media">
            <el-form label-position="top" class="ld-form">
              <div class="ld-section">品牌 Logo</div>

              <el-form-item label="Logo 来源">
                <el-radio-group v-model="localConfig.brand.logo.type" size="small" @change="onLogoTypeChange">
                  <el-radio-button value="builtin">内置图标</el-radio-button>
                  <el-radio-button value="image">上传图片</el-radio-button>
                </el-radio-group>
              </el-form-item>

              <!-- 内置图标库 -->
              <template v-if="localConfig.brand.logo.type === 'builtin'">
                <div class="ld-logo-grid">
                  <div
                    v-for="l in BUILTIN_LOGOS"
                    :key="l.value"
                    class="ld-logo-cell"
                    :class="{ active: localConfig.brand.logo.value === l.value }"
                    :title="l.label"
                    @click="selectBuiltinLogo(l.value)"
                  >
                    <svg v-if="l.customSvg" viewBox="0 0 40 46" class="ld-logo-shield">
                      <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
                        fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
                      <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
                      <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
                      <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
                    </svg>
                    <el-icon v-else :size="26"><component :is="l.value" /></el-icon>
                    <span class="ld-logo-name">{{ l.label }}</span>
                  </div>
                </div>
              </template>

              <!-- 自定义上传 -->
              <template v-else>
                <div class="ld-upload-row">
                  <el-image
                    v-if="localConfig.brand.logo.value"
                    :src="mediaUrl(localConfig.brand.logo.value)"
                    fit="contain"
                    class="ld-logo-preview"
                  />
                  <div v-else class="ld-logo-empty">未上传</div>
                  <el-upload
                    name="file"
                    :action="uploadAction"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    accept="image/jpeg,image/png"
                    :before-upload="beforeLogoUpload"
                    :on-success="onLogoUploaded"
                  >
                    <el-button size="small" type="primary" plain>上传 Logo（jpg/png）</el-button>
                  </el-upload>
                  <el-button size="small" @click="resetLogoBuiltin">恢复内置盾牌</el-button>
                </div>
                <div class="ld-hint">建议使用正方形或接近 42:48 比例的透明 PNG；图片经系统统一上传通道，匿名登录页可显示</div>
              </template>

              <div class="ld-section">
                像素级调整
                <el-button link type="primary" size="small" style="margin-left:8px" @click="resetLogoGeometry">归零</el-button>
              </div>
              <div class="ld-hint" style="margin-bottom:10px">
                也可以直接在左侧预览中按住 logo 拖动（自动吸附到整数像素）；偏移不影响周围文字排版
              </div>
              <div class="ld-px-grid">
                <div class="ld-px-item">
                  <div class="ld-px-label">水平偏移 X：{{ localConfig.brand.logo.offsetX }}px</div>
                  <el-input-number v-model="localConfig.brand.logo.offsetX" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" size="small" controls-position="right" style="width:130px" />
                  <el-slider v-model="localConfig.brand.logo.offsetX" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" />
                </div>
                <div class="ld-px-item">
                  <div class="ld-px-label">垂直偏移 Y：{{ localConfig.brand.logo.offsetY }}px</div>
                  <el-input-number v-model="localConfig.brand.logo.offsetY" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" size="small" controls-position="right" style="width:130px" />
                  <el-slider v-model="localConfig.brand.logo.offsetY" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" />
                </div>
                <div class="ld-px-item">
                  <div class="ld-px-label">宽度：{{ localConfig.brand.logo.width }}px</div>
                  <el-input-number v-model="localConfig.brand.logo.width" :min="LOGO_LIMITS.sizeMin" :max="LOGO_LIMITS.sizeMax" :step="1" size="small" controls-position="right" style="width:130px" />
                  <el-slider v-model="localConfig.brand.logo.width" :min="LOGO_LIMITS.sizeMin" :max="LOGO_LIMITS.sizeMax" :step="1" />
                </div>
                <div class="ld-px-item">
                  <div class="ld-px-label">高度：{{ localConfig.brand.logo.height }}px</div>
                  <el-input-number v-model="localConfig.brand.logo.height" :min="LOGO_LIMITS.sizeMin" :max="LOGO_LIMITS.sizeMax" :step="1" size="small" controls-position="right" style="width:130px" />
                  <el-slider v-model="localConfig.brand.logo.height" :min="LOGO_LIMITS.sizeMin" :max="LOGO_LIMITS.sizeMax" :step="1" />
                </div>
              </div>

              <div class="ld-section">浏览器图标 Favicon</div>
              <div class="ld-upload-row">
                <el-image
                  v-if="localConfig.brand.favicon"
                  :src="mediaUrl(localConfig.brand.favicon)"
                  fit="contain"
                  class="ld-favicon-preview"
                />
                <div v-else class="ld-logo-empty">默认 ico</div>
                <el-upload
                  name="file"
                  :action="uploadAction"
                  :headers="uploadHeaders"
                  :show-file-list="false"
                  accept="image/png"
                  :before-upload="beforeFaviconUpload"
                  :on-success="onFaviconUploaded"
                >
                  <el-button size="small" type="primary" plain>上传 PNG（建议 64×64）</el-button>
                </el-upload>
                <el-button size="small" :disabled="!localConfig.brand.favicon" @click="localConfig.brand.favicon = null">清除</el-button>
              </div>
              <div class="ld-hint">仅登录页标签页生效；浏览器标题使用上方「品牌名称」，离开登录页自动恢复</div>

              <div class="ld-section ld-section-disabled">
                视频背景
                <el-tag size="small" type="info" effect="plain" style="margin-left:8px">规划中（M4）</el-tag>
              </div>
              <div class="ld-hint">未来支持自动播放、静音、循环 mp4 + 封面图兜底，当前版本暂不开放</div>
            </el-form>
          </el-tab-pane>

          <!-- ======================== 布局 ======================== -->
          <el-tab-pane label="布局" name="layout">
            <el-form label-position="top" class="ld-form">
              <el-form-item label="布局模板">
                <el-radio-group v-model="localConfig.layout.template">
                  <el-radio-button value="split">左右分栏</el-radio-button>
                  <el-radio-button value="centered">居中卡片</el-radio-button>
                  <el-radio-button value="fullscreen">全屏背景</el-radio-button>
                </el-radio-group>
                <div class="ld-hint" v-if="localConfig.layout.template === 'centered'">
                  居中卡片不显示左侧品牌区（Hero 标语/特性列表/左下版权）；整页背景为「主题色」中的品牌渐变，卡片底色为页面底色
                </div>
                <div class="ld-hint" v-else-if="localConfig.layout.template === 'fullscreen'">
                  整屏背景图 + 品牌渐变遮罩 + 浮层登录卡片；不显示 Hero 标语/特性列表。
                  背景图与遮罩浓度在下方「全屏背景」区域上传和调整；未上传背景图时整页为品牌渐变
                </div>
              </el-form-item>
              <template v-if="localConfig.layout.template === 'fullscreen'">
                <div class="ld-section">全屏背景</div>
                <div class="ld-upload-row">
                  <el-image
                    v-if="localConfig.background.image"
                    :src="mediaUrl(localConfig.background.image)"
                    fit="cover"
                    class="ld-bg-preview"
                  />
                  <div v-else class="ld-logo-empty">未设置</div>
                  <el-upload
                    name="file"
                    :action="uploadAction"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    accept="image/jpeg,image/png"
                    :before-upload="beforeBgUpload"
                    :on-success="onBgUploaded"
                  >
                    <el-button size="small" type="primary" plain>上传背景图（jpg/png）</el-button>
                  </el-upload>
                  <el-button
                    size="small"
                    :disabled="!localConfig.background.image"
                    @click="localConfig.background.image = null"
                  >清除</el-button>
                </div>
                <el-form-item :label="`遮罩浓度：${Math.round(localConfig.background.overlay * 100)}%`" style="margin-top:10px">
                  <el-slider
                    v-model="localConfig.background.overlay"
                    :min="0" :max="1" :step="0.05"
                  />
                  <div class="ld-hint">
                    遮罩为「主题色」中的品牌渐变：数值越大背景图越暗、白色文字对比越强；
                    不上传背景图时整页为纯品牌渐变。建议横版大图（桌面 16:9），不超过 5MB
                  </div>
                </el-form-item>
              </template>
              <template v-if="localConfig.layout.template === 'split'">
                <el-form-item :label="`左右分栏比例（左:右）：${localConfig.layout.splitRatio} : 1`">
                  <el-slider v-model="localConfig.layout.splitRatio" :min="0.5" :max="3" :step="0.1" />
                </el-form-item>
                <el-form-item label="窄屏（≤900px）显示品牌区">
                  <el-switch v-model="localConfig.layout.showBrandOnMobile" />
                  <div class="ld-hint">默认隐藏品牌区，仅显示登录表单</div>
                </el-form-item>
              </template>
              <el-form-item :label="`圆角：${localConfig.layout.cardRadius}px`">
                <el-slider v-model="localConfig.layout.cardRadius" :min="0" :max="40" :step="1" />
                <div class="ld-hint">系统全局生效：按钮、输入框、卡片、弹窗圆角；登录页同样使用该圆角</div>
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
import { getToken } from '@/utils/auth'
import {
  cloneDefaults, mergeWithDefaults,
  BUILTIN_LOGOS, BUILTIN_LOGO_VALUES, LOGO_LIMITS,
  normalizeProfileUrl, mediaUrl,
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
      buttonLoading: '#ef5350', link: '#c62828'
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
      buttonLoading: '#8b5cf6', link: '#6d28d9'
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
      buttonLoading: '#22b8cf', link: '#0e7490'
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

// ============================ Logo / Favicon（M3a） ============================

// 预览区拖拽 logo → 像素偏移；位移已在 Renderer 内按 previewScale 换算
function onLogoOffset({ offsetX, offsetY }) {
  localConfig.value.brand.logo.offsetX = offsetX
  localConfig.value.brand.logo.offsetY = offsetY
}

function selectBuiltinLogo(value) {
  const logo = localConfig.value.brand.logo
  logo.type = 'builtin'
  logo.value = value
}
// 切换来源时保持 type/value 一致，避免「builtin + 图片路径」的瞬态把路径当组件名渲染
function onLogoTypeChange(type) {
  const logo = localConfig.value.brand.logo
  if (type === 'builtin') {
    if (!BUILTIN_LOGO_VALUES.includes(logo.value)) logo.value = 'shield'
  } else if (typeof logo.value !== 'string' || !logo.value.startsWith('/profile/')) {
    logo.value = ''
  }
}
function resetLogoBuiltin() {
  const logo = localConfig.value.brand.logo
  logo.type = 'builtin'
  logo.value = 'shield'
}
function resetLogoGeometry() {
  const logo = localConfig.value.brand.logo
  logo.offsetX = 0
  logo.offsetY = 0
}

// 复用系统统一上传通道（/common/upload 返回 /profile/... 站内路径，匿名可读）
const uploadAction = import.meta.env.VITE_APP_BASE_API + '/common/upload'
const uploadHeaders = computed(() => ({ Authorization: 'Bearer ' + getToken() }))
const UPLOAD_MAX_MB = 5

function validateImageFile(file, allowTypes) {
  if (!allowTypes.includes(file.type)) {
    proxy.$modal.msgError('仅支持 ' + allowTypes.map((t) => t.replace('image/', '')).join('/') + ' 格式')
    return false
  }
  if (file.size / 1024 / 1024 > UPLOAD_MAX_MB) {
    proxy.$modal.msgError(`图片大小不能超过 ${UPLOAD_MAX_MB}MB`)
    return false
  }
  return true
}
function beforeLogoUpload(file) {
  return validateImageFile(file, ['image/jpeg', 'image/png'])
}
function beforeFaviconUpload(file) {
  return validateImageFile(file, ['image/png'])
}
function onLogoUploaded(res) {
  // 优先取相对路径 fileName；绝对 url 归一化为 /profile/ 相对路径（配置不允许存环境相关地址）
  const rel = normalizeProfileUrl(res && (res.fileName || res.url))
  if (res && res.code === 200 && rel) {
    const logo = localConfig.value.brand.logo
    logo.type = 'image'
    logo.value = rel
    proxy.$modal.msgSuccess('Logo 已上传，点击「保存」后正式生效')
  } else {
    proxy.$modal.msgError((res && res.msg) || '上传返回地址非法')
  }
}
function onFaviconUploaded(res) {
  const rel = normalizeProfileUrl(res && (res.fileName || res.url))
  if (res && res.code === 200 && rel) {
    localConfig.value.brand.favicon = rel
    proxy.$modal.msgSuccess('Favicon 已上传，点击「保存」后登录页生效')
  } else {
    proxy.$modal.msgError((res && res.msg) || '上传返回地址非法')
  }
}

// 全屏背景图（M3c，布局页签「全屏背景」区域使用，仅 fullscreen 模板下显示）
function beforeBgUpload(file) {
  return validateImageFile(file, ['image/jpeg', 'image/png'])
}
function onBgUploaded(res) {
  const rel = normalizeProfileUrl(res && (res.fileName || res.url))
  if (res && res.code === 200 && rel) {
    localConfig.value.background.type = 'image'
    localConfig.value.background.image = rel
    proxy.$modal.msgSuccess('背景图已上传，点击「保存」后正式生效')
  } else {
    proxy.$modal.msgError((res && res.msg) || '上传返回地址非法')
  }
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
onBeforeUnmount(() => {
  resizeObserver && resizeObserver.disconnect()
  // 离开设计器：favicon 实时预览恢复为系统默认（不在此处恢复标题，交由路由守卫）
  restoreLoginHead()
})

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

/* ============ Logo 内置库 / 上传 ============ */
.ld-logo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 8px;
}
.ld-logo-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px 8px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fafbfc;
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s;
  &:hover { border-color: #4aa886; }
  &.active {
    border-color: #2f6b57;
    box-shadow: 0 0 0 2px rgba(47, 107, 87, .15);
    background: #f2f8f5;
  }
}
.ld-logo-shield { width: 28px; height: 32px; }
.ld-logo-name { font-size: 12px; color: #606266; text-align: center; line-height: 1.2; }

.ld-upload-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.ld-logo-preview {
  width: 72px;
  height: 72px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafbfc;
  padding: 6px;
}
.ld-favicon-preview {
  width: 40px;
  height: 40px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafbfc;
  padding: 4px;
}
.ld-logo-empty {
  width: 72px;
  height: 72px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #909399;
}
.ld-bg-preview {
  width: 96px;
  height: 54px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafbfc;
}
.ld-section-disabled,
.ld-section-disabled + .ld-hint { opacity: .55; }

/* ============ 像素级调整 ============ */
.ld-px-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 18px;
}
.ld-px-item { margin-bottom: 6px; }
.ld-px-label {
  font-size: 12.5px;
  color: #606266;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.ld-px-item :deep(.el-slider) { margin: 0 0 10px 0; }
</style>
