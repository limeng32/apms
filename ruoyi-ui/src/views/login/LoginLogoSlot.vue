<template>
  <div
    class="brand-logo-slot"
    :class="{ 'logo-draggable': draggable }"
    :style="slotStyle"
    @pointerdown="emit('logo-pointerdown', $event)"
  >
    <!-- 定制盾牌（默认） -->
    <svg v-if="logo.type === 'builtin' && builtinName === 'shield'" viewBox="0 0 40 46" fill="none">
      <path d="M20 1.5L37 7v13c0 12-7.5 19-17 24C10.5 39 3 32 3 20V7l17-5.5z"
        fill="#2c5a4b" stroke="#7fc7ad" stroke-width="1.4"/>
      <circle cx="20" cy="20" r="8" fill="none" stroke="#d8efe4" stroke-width="1.3"/>
      <path d="M20 12l4 3-1.5 5h-5L16 15l4-3z" fill="#d8efe4"/>
      <path d="M14.5 29c1.6-2.2 3.4-3.3 5.5-3.3s3.9 1.1 5.5 3.3" stroke="#d8efe4" stroke-width="1.3" fill="none"/>
    </svg>
    <!-- 其余内置 logo：全局注册的 Element Plus 图标；非白名单值兜底盾牌 -->
    <el-icon v-else-if="logo.type === 'builtin'" class="brand-logo-ep">
      <component :is="builtinName" />
    </el-icon>
    <!-- 自定义上传图片（仅 /profile/ 路径，显示时前缀 baseApi） -->
    <img v-else-if="logo.type === 'image' && imageSrc" class="brand-logo-img" :src="imageSrc" alt="client logo" />
  </div>
</template>

<script setup>
/**
 * Logo 渲染槽（与 LoginRenderer 中主 logo 的标记/样式完全一致）
 *
 * 双 logo 方案中客户方 Logo（登录区左上）复用本组件；主 Logo 保留在
 * LoginRenderer 原模板中未做迁移，避免影响既有拖拽/像素调整链路。
 */
import {
  clampLogoSize, clampLogoOffset, mediaUrl,
  CLIENT_LOGO_OFFSET_X_LIMITS,
  BUILTIN_LOGO_VALUES
} from './login.utils'

const props = defineProps({
  /** { enabled?, type, value, width, height, offsetX, offsetY } */
  logo: { type: Object, required: true },
  /** 设计器预览：允许直接拖拽调整 offset */
  draggable: { type: Boolean, default: false }
})
const emit = defineEmits(['logo-pointerdown'])

const builtinName = computed(() =>
  BUILTIN_LOGO_VALUES.includes(props.logo.value) ? props.logo.value : 'shield')
const imageSrc = computed(() => mediaUrl(props.logo.value))

const slotStyle = computed(() => {
  const w = clampLogoSize(props.logo.width, 42)
  const h = clampLogoSize(props.logo.height, 48)
  return {
    width: `${w}px`,
    height: `${h}px`,
    // el-icon 内 svg 为 1em，用 font-size 撑满 slot
    fontSize: `${h}px`,
    // 客户方 logo：X 用放宽行程（-200~400），Y 与版权方一致（±100）
    transform: `translate(${clampLogoOffset(props.logo.offsetX, CLIENT_LOGO_OFFSET_X_LIMITS)}px, ${clampLogoOffset(props.logo.offsetY)}px)`
  }
})
</script>

<style scoped>
/* 与 LoginRenderer 主 logo 样式同口径；子组件内部元素无法继承父 scoped 样式，故在此复制 */
.brand-logo-slot {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  user-select: none;
}
.brand-logo-slot > svg {
  width: 100%;
  height: 100%;
  display: block;
}
.brand-logo-slot.logo-draggable { cursor: grab; }
.brand-logo-slot.logo-draggable:active { cursor: grabbing; }
.brand-logo-ep {
  width: 100%;
  height: 100%;
  color: var(--login-text-brand);
}
.brand-logo-img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  -webkit-user-drag: none;
}
</style>
