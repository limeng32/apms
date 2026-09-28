<template>
  <el-form label-position="top" class="ld-form">
    <!-- 布局模板：决定下方显示哪些配置项 -->
    <el-form-item label="布局模板">
      <el-radio-group :model-value="template" @update:model-value="onTemplateChange">
        <el-radio-button value="split">左右分栏</el-radio-button>
        <el-radio-button value="centered">居中卡片</el-radio-button>
        <el-radio-button value="fullscreen">全屏背景</el-radio-button>
      </el-radio-group>
      <div class="ld-hint" v-if="template === 'split'">
        左侧品牌区（Hero 标语/特性列表/左下版权）+ 右侧登录表单；可在下方调整分栏比例
        <template v-if="!mobile">与窄屏行为</template>
      </div>
      <div class="ld-hint" v-else-if="template === 'centered'">
        不显示左侧品牌区；整页背景为品牌渐变，居中浮层卡片，卡片底色为页面底色
      </div>
      <div class="ld-hint" v-else>
        整屏背景图 + 品牌渐变遮罩 + 浮层登录卡片；不显示 Hero 标语/特性列表。
        背景图与遮罩浓度在下方上传和调整；未上传背景图时整页为品牌渐变
      </div>
    </el-form-item>

    <!-- ===== 背景（三种模板通用：split 作用于左侧品牌区，centered/fullscreen 作用于整页） ===== -->
    <div class="ld-section">背景与科技动效</div>

    <el-form-item label="内置背景（随系统发布，可直接使用）">
      <el-radio-group v-model="bgBuiltin" size="small">
        <el-radio-button :value="null">不使用</el-radio-button>
        <el-radio-button
          v-for="b in BUILTIN_BACKGROUNDS"
          :key="b.value"
          :value="b.value"
        >{{ b.label }}</el-radio-button>
      </el-radio-group>
      <div class="ld-builtin-row" v-if="builtinPreview">
        <el-image :src="builtinPreview" fit="cover" class="ld-bg-preview" />
        <span class="ld-hint">深色运动科技风：球场大图 + 线稿纹理，搭配粒子/雷达特效</span>
      </div>
    </el-form-item>

    <el-form-item label="自定义背景图（设置后优先于内置背景）">
      <div class="ld-upload-row">
        <el-image
          v-if="background.image"
          :src="mediaUrl(background.image)"
          fit="cover"
          class="ld-bg-preview"
        />
        <div v-else class="ld-logo-empty">未上传</div>
        <el-upload
          name="file"
          :action="uploadAction"
          :headers="uploadHeaders"
          :show-file-list="false"
          accept="image/jpeg,image/png"
          :before-upload="beforeBgUpload"
          :on-success="(res) => emit('bg-uploaded', res)"
        >
          <el-button size="small" type="primary" plain>上传背景图（jpg/png）</el-button>
        </el-upload>
        <el-button
          size="small"
          :disabled="!background.image"
          @click="emit('clear-bg')"
        >清除</el-button>
      </div>
      <div class="ld-hint">
        建议{{ mobile ? '竖版大图（手机 9:16）' : '横版大图（桌面 16:9）' }}，不超过 5MB；
        自定义图不叠加球场线稿纹理
      </div>
    </el-form-item>

    <el-form-item :label="`遮罩浓度：${Math.round(bgOverlay * 100)}%`">
      <el-slider v-model="bgOverlay" :min="0" :max="1" :step="0.05" />
      <div class="ld-hint">遮罩为品牌渐变：数值越大背景越暗、白色文字对比越强</div>
    </el-form-item>

    <el-form-item label="动态装饰特效">
      <el-radio-group v-model="bgEffect" size="small">
        <el-radio-button
          v-for="e in BACKGROUND_EFFECTS"
          :key="e.value"
          :value="e.value"
        >{{ e.label }}</el-radio-button>
      </el-radio-group>
      <div class="ld-hint">粒子漂浮 + 雷达扫描为纯 CSS 动效，访客系统开启「减弱动态效果」时自动停用</div>
    </el-form-item>

    <el-form-item label="背景缓推动效（Ken Burns，缓慢推近/拉远）">
      <el-switch v-model="kenBurns" />
    </el-form-item>

    <!-- ===== 左右分栏模板专属：分栏比例（桌面端另有窄屏开关） ===== -->
    <template v-if="template === 'split'">
      <el-form-item :label="`左右分栏比例（左:右）：${Number(splitRatio).toFixed(1)} : 1`">
        <el-slider v-model="splitRatio" :min="0.5" :max="3" :step="0.1" />
      </el-form-item>
      <el-form-item v-if="!mobile" label="窄屏（≤900px）显示品牌区">
        <el-switch
          :model-value="showBrandOnMobile"
          @update:model-value="(v) => emit('patch', { section: 'layout', key: 'showBrandOnMobile', value: v })"
        />
        <div class="ld-hint">默认隐藏品牌区，仅显示登录表单</div>
      </el-form-item>
    </template>

    <!-- ===== 版权方 Logo（左上，通用） ===== -->
    <div class="ld-section">版权方 Logo（左上）</div>

    <el-form-item label="Logo 来源">
      <el-radio-group
        :model-value="logoType"
        size="small"
        @update:model-value="(v) => emit('logo-type-change', v)"
      >
        <el-radio-button value="builtin">内置图标</el-radio-button>
        <el-radio-button value="image">上传图片</el-radio-button>
      </el-radio-group>
    </el-form-item>

    <!-- 内置图标库 -->
    <template v-if="logoType === 'builtin'">
      <div class="ld-logo-grid">
        <div
          v-for="l in BUILTIN_LOGOS"
          :key="l.value"
          class="ld-logo-cell"
          :class="{ active: logo.value === l.value }"
          :title="l.label"
          @click="emit('select-builtin', l.value)"
        >
          <svg v-if="l.customSvg" viewBox="0 0 40 46" class="ld-logo-shield">
            <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
              fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
            <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
            <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
            <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
          </svg>
          <img v-else-if="l.customImage" :src="l.customImage" class="ld-logo-builtin-img" alt="">
          <el-icon v-else :size="26"><component :is="l.value" /></el-icon>
          <span class="ld-logo-name">{{ l.label }}</span>
        </div>
      </div>
    </template>

    <!-- 自定义上传 -->
    <template v-else>
      <div class="ld-upload-row">
        <el-image
          v-if="logo.value"
          :src="mediaUrl(logo.value)"
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
          :on-success="(res) => emit('logo-uploaded', res)"
        >
          <el-button size="small" type="primary" plain>上传 Logo（jpg/png）</el-button>
        </el-upload>
        <el-button size="small" @click="emit('reset-builtin')">恢复内置盾牌</el-button>
      </div>
      <div class="ld-hint">建议使用透明 PNG；图片经系统统一上传通道，匿名登录页可显示</div>
    </template>

    <!-- 像素级调整 -->
    <div class="ld-section">
      像素级调整
      <el-button link type="primary" size="small" style="margin-left:8px" @click="emit('reset-geometry')">归零</el-button>
    </div>
    <div class="ld-hint" style="margin-bottom:10px">
      也可以直接在预览中按住 logo 拖动（自动吸附到整数像素）；偏移不影响周围文字排版
    </div>
    <div class="ld-px-grid">
      <div class="ld-px-item">
        <div class="ld-px-label">水平偏移 X：{{ offsetX }}px</div>
        <el-input-number
          v-model="offsetX"
          :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1"
          size="small" controls-position="right" style="width:130px"
        />
        <el-slider v-model="offsetX" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" />
      </div>
      <div class="ld-px-item">
        <div class="ld-px-label">垂直偏移 Y：{{ offsetY }}px</div>
        <el-input-number
          v-model="offsetY"
          :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1"
          size="small" controls-position="right" style="width:130px"
        />
        <el-slider v-model="offsetY" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" />
      </div>
      <div class="ld-px-item">
        <div class="ld-px-label">宽度：{{ logoWidth }}px</div>
        <el-input-number
          v-model="logoWidth"
          :min="LOGO_LIMITS.sizeMin" :max="LOGO_LIMITS.sizeMax" :step="1"
          size="small" controls-position="right" style="width:130px"
        />
        <el-slider v-model="logoWidth" :min="LOGO_LIMITS.sizeMin" :max="LOGO_LIMITS.sizeMax" :step="1" />
      </div>
    </div>

    <!-- ===== 客户方 Logo（登录区左上，与登录框左缘对齐；双 logo 方案，可关闭） ===== -->
    <div class="ld-section">
      客户方 Logo（登录区左上）
      <el-switch v-model="clientEnabled" size="small" style="margin-left:12px" />
    </div>
    <template v-if="clientEnabled">
      <el-form-item label="Logo 来源">
        <el-radio-group
          :model-value="clientLogoType"
          size="small"
          @update:model-value="(v) => emit('logo-type-change', v, 'client')"
        >
          <el-radio-button value="builtin">内置图标</el-radio-button>
          <el-radio-button value="image">上传图片</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 内置图标库 -->
      <template v-if="clientLogoType === 'builtin'">
        <div class="ld-logo-grid">
          <div
            v-for="l in BUILTIN_LOGOS"
            :key="l.value"
            class="ld-logo-cell"
            :class="{ active: clientLogo.value === l.value }"
            :title="l.label"
            @click="emit('select-builtin', l.value, 'client')"
          >
            <svg v-if="l.customSvg" viewBox="0 0 40 46" class="ld-logo-shield">
              <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
                fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
              <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
              <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
              <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
            </svg>
            <img v-else-if="l.customImage" :src="l.customImage" class="ld-logo-builtin-img" alt="">
            <el-icon v-else :size="26"><component :is="l.value" /></el-icon>
            <span class="ld-logo-name">{{ l.label }}</span>
          </div>
        </div>
      </template>

      <!-- 自定义上传 -->
      <template v-else>
        <div class="ld-upload-row">
          <el-image
            v-if="clientLogo.value"
            :src="mediaUrl(clientLogo.value)"
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
            :on-success="(res) => emit('logo-uploaded', res, 'client')"
          >
            <el-button size="small" type="primary" plain>上传 Logo（jpg/png）</el-button>
          </el-upload>
          <el-button size="small" @click="emit('reset-builtin', 'client')">恢复内置盾牌</el-button>
        </div>
        <div class="ld-hint">建议使用透明 PNG；图片经系统统一上传通道，匿名登录页可显示</div>
      </template>

      <!-- 像素级调整 -->
      <div class="ld-section">
        像素级调整
        <el-button
          link type="primary" size="small" style="margin-left:8px"
          @click="emit('reset-geometry', 'client')"
        >归零</el-button>
      </div>
      <div class="ld-hint" style="margin-bottom:10px">
        也可以直接在预览中按住客户方 logo 拖动；偏移不影响左栏版权方 logo 与文字排版
      </div>
      <div class="ld-px-grid">
        <div class="ld-px-item">
          <div class="ld-px-label">水平偏移 X：{{ clientOffsetX }}px（{{ CLIENT_X_LIMITS.min }} ~ {{ CLIENT_X_LIMITS.max }}）</div>
          <el-input-number
            v-model="clientOffsetX"
            :min="CLIENT_X_LIMITS.min" :max="CLIENT_X_LIMITS.max" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="clientOffsetX" :min="CLIENT_X_LIMITS.min" :max="CLIENT_X_LIMITS.max" :step="1" />
        </div>
        <div class="ld-px-item">
          <div class="ld-px-label">垂直偏移 Y：{{ clientOffsetY }}px</div>
          <el-input-number
            v-model="clientOffsetY"
            :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="clientOffsetY" :min="LOGO_LIMITS.offsetMin" :max="LOGO_LIMITS.offsetMax" :step="1" />
        </div>
        <div class="ld-px-item">
          <div class="ld-px-label">宽度：{{ clientLogoWidth }}px</div>
          <el-input-number
            v-model="clientLogoWidth"
            :min="CLIENT_SIZE_LIMITS.min" :max="CLIENT_SIZE_LIMITS.max" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="clientLogoWidth" :min="CLIENT_SIZE_LIMITS.min" :max="CLIENT_SIZE_LIMITS.max" :step="1" />
        </div>
      </div>
    </template>
    <div class="ld-hint" style="margin-bottom:12px" v-else>
      关闭后品牌区仅显示左上版权方 Logo（与单 logo 方案外观一致）
    </div>

    <!-- Logo 上下留白：仅显示当前模板对应的一组 -->
    <div class="ld-section">Logo 上下留白</div>
    <div class="ld-hint" style="margin-bottom:10px">
      控制 Logo 上方与下方的间距；各模板的数值独立保存，切换模板后再切回仍保留。
      下方高度允许负值，可把下一区块上提
    </div>
    <div class="ld-space-grid">
      <div class="ld-space-group" v-if="template === 'split'">
        <div class="ld-space-title">左右分栏</div>
        <div class="ld-px-item">
          <div class="ld-px-label">上方高度：{{ splitTop }}px</div>
          <el-input-number
            v-model="splitTop"
            :min="LOGO_SPACE_LIMITS.topMin" :max="LOGO_SPACE_LIMITS.max" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="splitTop" :min="LOGO_SPACE_LIMITS.topMin" :max="LOGO_SPACE_LIMITS.max" :step="1" />
        </div>
        <div class="ld-px-item">
          <div class="ld-px-label">下方高度：{{ splitBottom }}px</div>
          <el-input-number
            v-model="splitBottom"
            :min="LOGO_SPACE_LIMITS.bottomMin" :max="LOGO_SPACE_LIMITS.max" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="splitBottom" :min="LOGO_SPACE_LIMITS.bottomMin" :max="LOGO_SPACE_LIMITS.max" :step="1" />
          <div class="ld-hint">负值可把下方 Hero 标语与版权块整体上提，正值下移；0 为默认位置</div>
        </div>
      </div>
      <div class="ld-space-group" v-else>
        <div class="ld-space-title">{{ template === 'fullscreen' ? '全屏背景' : '居中卡片' }}</div>
        <div class="ld-px-item">
          <div class="ld-px-label">上方高度：{{ overlayTop }}px</div>
          <el-input-number
            v-model="overlayTop"
            :min="LOGO_SPACE_LIMITS.topMin" :max="LOGO_SPACE_LIMITS.max" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="overlayTop" :min="LOGO_SPACE_LIMITS.topMin" :max="LOGO_SPACE_LIMITS.max" :step="1" />
        </div>
        <div class="ld-px-item">
          <div class="ld-px-label">下方高度：{{ overlayBottom }}px</div>
          <el-input-number
            v-model="overlayBottom"
            :min="LOGO_SPACE_LIMITS.bottomMin" :max="LOGO_SPACE_LIMITS.max" :step="1"
            size="small" controls-position="right" style="width:130px"
          />
          <el-slider v-model="overlayBottom" :min="LOGO_SPACE_LIMITS.bottomMin" :max="LOGO_SPACE_LIMITS.max" :step="1" />
          <div class="ld-hint">Logo 名称行与登录卡片之间的间距；负值可让卡片上移与 Logo 靠近</div>
        </div>
      </div>
    </div>

    <!-- 圆角（桌面端：全局生效，移动端跟随该值） -->
    <el-form-item v-if="!mobile" :label="`圆角：${cardRadius}px`">
      <el-slider v-model="cardRadius" :min="0" :max="40" :step="1" />
      <div class="ld-hint">系统全局生效：按钮、输入框、卡片、弹窗圆角；移动端登录页同样使用该圆角</div>
    </el-form-item>

    <!-- Favicon（仅桌面端浏览器概念） -->
    <template v-if="!mobile">
      <div class="ld-section">浏览器图标 Favicon</div>
      <div class="ld-upload-row">
        <el-image
          v-if="favicon"
          :src="mediaUrl(favicon)"
          fit="contain"
          class="ld-favicon-preview"
        />
        <!-- 未上传时显示随包默认 favicon（带构建号，换图重新部署后自动刷新） -->
        <el-image
          v-else
          :src="DEFAULT_FAVICON_HREF"
          fit="contain"
          class="ld-favicon-preview"
        />
        <el-upload
          name="file"
          :action="uploadAction"
          :headers="uploadHeaders"
          :show-file-list="false"
          accept="image/png"
          :before-upload="beforeFaviconUpload"
          :on-success="(res) => emit('favicon-uploaded', res)"
        >
          <el-button size="small" type="primary" plain>上传 PNG（建议 64×64）</el-button>
        </el-upload>
        <el-button size="small" :disabled="!favicon" @click="emit('clear-favicon')">清除</el-button>
      </div>
      <div class="ld-hint">仅登录页标签页生效；浏览器标题使用「品牌名称」，离开登录页自动恢复</div>
    </template>

    <div class="ld-section ld-section-disabled">
      视频背景
      <el-tag size="small" type="info" effect="plain" style="margin-left:8px">规划中（M4）</el-tag>
    </div>
    <div class="ld-hint">未来支持自动播放、静音、循环 mp4 + 封面图兜底，当前版本暂不开放</div>
  </el-form>
</template>

<script setup>
/**
 * 登录页「布局」属性表单（纯展示）
 *
 * 浏览器端布局 / 移动端布局两个页签共用本组件：
 * 通过 layout/logo/logoSpace/background 四个响应式根对象切换编辑目标，
 * 任何写操作均以事件上交父组件，本组件不直接改 props。
 */
import { getToken } from '@/utils/auth'
import {
  BUILTIN_LOGOS, BUILTIN_BACKGROUNDS, BACKGROUND_EFFECTS,
  LOGO_LIMITS, LOGO_SPACE_LIMITS,
  CLIENT_LOGO_OFFSET_X_LIMITS as CLIENT_X_LIMITS,
  CLIENT_LOGO_SIZE_LIMITS as CLIENT_SIZE_LIMITS,
  mediaUrl, builtinBgImage, DEFAULT_FAVICON_HREF
} from './login.utils'

const props = defineProps({
  /** 当前是否为移动端布局（控制窄屏开关/圆角/Favicon 等区块显隐与文案） */
  mobile: { type: Boolean, default: false },
  /** 布局根（桌面：template/splitRatio/showBrandOnMobile/cardRadius；移动：template/splitRatio） */
  layout: { type: Object, required: true },
  /** Logo 根（版权方，左上） */
  logo: { type: Object, required: true },
  /** 客户方 Logo 根（登录区左上，双 logo 方案；缺省时不渲染编辑区） */
  clientLogo: { type: Object, default: () => ({}) },
  /** Logo 留白根 */
  logoSpace: { type: Object, required: true },
  /** 背景根 */
  background: { type: Object, required: true },
  /** Favicon（仅桌面端；null=默认 ico） */
  favicon: { type: String, default: null }
})

const emit = defineEmits([
  'patch',                    // 通用标量改写 { section, key, value }
  'logo-type-change',         // 切换 logo 来源（父组件需联动校验 value）
  'select-builtin',           // 选择内置 logo
  'reset-builtin',            // 恢复内置盾牌
  'reset-geometry',           // logo 偏移归零
  'logo-uploaded',            // logo 上传成功（res）
  'bg-uploaded',              // 背景图上传成功（res）
  'clear-bg',                 // 清除背景图
  'favicon-uploaded',         // favicon 上传成功（res）
  'clear-favicon'             // 清除 favicon
])

const { proxy } = getCurrentInstance()

/** 一级字段双向绑定（get 读 props，set 上交 patch） */
function bind(section, key) {
  return computed({
    get: () => props[section][key],
    set: (value) => emit('patch', { section, key, value })
  })
}
/** 二级字段（logoSpace.split.top 等） */
function bind2(section, sub, key) {
  return computed({
    get: () => props[section][sub][key],
    set: (value) => emit('patch', { section, sub, key, value })
  })
}

const template = bind('layout', 'template')
const splitRatio = bind('layout', 'splitRatio')
const showBrandOnMobile = bind('layout', 'showBrandOnMobile')
const cardRadius = bind('layout', 'cardRadius')
const logoType = bind('logo', 'type')
const offsetX = bind('logo', 'offsetX')
const offsetY = bind('logo', 'offsetY')
const logoWidth = bind('logo', 'width')
// 客户方 Logo（登录区左上）：写入路由 section=clientLogo，父组件按当前设备落到 brand.logoClient
const clientEnabled = bind('clientLogo', 'enabled')
const clientLogoType = bind('clientLogo', 'type')
const clientOffsetX = bind('clientLogo', 'offsetX')
const clientOffsetY = bind('clientLogo', 'offsetY')
const clientLogoWidth = bind('clientLogo', 'width')
const splitTop = bind2('logoSpace', 'split', 'top')
const splitBottom = bind2('logoSpace', 'split', 'bottom')
const overlayTop = bind2('logoSpace', 'overlay', 'top')
const overlayBottom = bind2('logoSpace', 'overlay', 'bottom')
const bgOverlay = bind('background', 'overlay')
const bgBuiltin = bind('background', 'builtin')
const bgEffect = bind('background', 'effect')
const kenBurns = bind('background', 'kenBurns')
// 当前选中内置背景的缩略图地址（非内置 key 时为空，不显示预览）
const builtinPreview = computed(() => builtinBgImage(props.background.builtin))

// 切换模板（无附加逻辑，单独事件仅为语义清晰；父组件按通用 patch 处理即可）
function onTemplateChange(v) {
  emit('patch', { section: 'layout', key: 'template', value: v })
}

/* ============ 上传通道（与设计器原逻辑一致） ============ */
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
function beforeBgUpload(file) {
  return validateImageFile(file, ['image/jpeg', 'image/png'])
}
function beforeFaviconUpload(file) {
  return validateImageFile(file, ['image/png'])
}
</script>

<style lang="scss" scoped>
/* 布局属性区：Logo 网格/上传行/像素滑块等样式沿用设计器既有类，见 index.vue 全局样式；
   本组件在设计器页内渲染，以下仅保证被独立复用时的最小可用 */
.ld-upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.ld-logo-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}
.ld-logo-cell {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 10px 4px 6px;
  text-align: center;
  cursor: pointer;
  background: #fff;
  transition: border-color .15s;
  &:hover { border-color: #c0c4cc; }
  &.active { border-color: var(--el-color-primary); box-shadow: 0 0 0 1px var(--el-color-primary) inset; }
}
.ld-logo-name { display: block; font-size: 11px; color: #606266; margin-top: 5px; }
.ld-logo-shield { width: 26px; height: 30px; }
.ld-logo-builtin-img { width: 40px; height: 30px; object-fit: contain; }
.ld-logo-preview { width: 64px; height: 64px; border-radius: 6px; border: 1px solid #ebeef5; }
.ld-bg-preview { width: 96px; height: 60px; border-radius: 6px; border: 1px solid #ebeef5; }
.ld-builtin-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.ld-favicon-preview { width: 40px; height: 40px; border-radius: 6px; border: 1px solid #ebeef5; }
.ld-logo-empty {
  width: 64px; height: 64px;
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; color: #909399;
  border: 1px dashed #dcdfe6; border-radius: 6px;
}
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
}
.ld-px-item :deep(.el-slider) { margin: 0 0 10px 0; }
.ld-space-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.ld-space-group {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px 14px 2px;
}
.ld-space-title { font-size: 13px; font-weight: 600; color: #303133; margin-bottom: 8px; }
.ld-section-disabled,
.ld-section-disabled + .ld-hint { opacity: .55; }
</style>
