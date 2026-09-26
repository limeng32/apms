<template>
  <!-- 登录页科技动态背景层：主图 + 渐变遮罩 + 球场线稿 + 雷达扫描 + 漂浮粒子
       纯展示组件，被 LoginRenderer 三种布局模板共用（真实登录页与设计器预览同一套）。
       所有动效仅使用 transform/opacity，且尊重 prefers-reduced-motion。 -->
  <div class="ltech" aria-hidden="true">
    <!-- 主视觉背景图（内置科技图或管理员上传图） -->
    <div
      v-if="src"
      class="ltech-img"
      :class="{ 'is-kenburns': kenBurns }"
      :style="{ backgroundImage: `url('${src}')` }"
    ></div>
    <!-- 品牌渐变遮罩：浓度由配置控制，保证上方文字可读性 -->
    <div class="ltech-overlay" :style="{ opacity: overlay }"></div>
    <!-- 球场线稿纹理（仅内置科技背景附带） -->
    <div
      v-if="texture"
      class="ltech-texture"
      :style="{ backgroundImage: `url('${texture}')` }"
    ></div>
    <!-- 雷达扫描（同心环 + 旋转扇面） -->
    <div v-if="showRadar" class="ltech-radar">
      <span v-for="pct in [100, 76, 52, 28]" :key="pct" class="ltech-radar-ring" :style="ringStyle(pct)"></span>
      <div class="ltech-radar-sweep"></div>
    </div>
    <!-- 漂浮粒子（挂载时生成一次，稳定不闪烁） -->
    <div v-if="showParticles" class="ltech-particles">
      <span
        v-for="p in particles"
        :key="p.id"
        class="ltech-particle"
        :style="{
          left: p.left + '%',
          top: p.top + '%',
          width: p.size + 'px',
          height: p.size + 'px',
          background: p.cyan ? '#06b6d4' : '#3b82f6',
          opacity: p.opacity,
          animationDelay: p.delay + 's',
          animationDuration: p.duration + 's'
        }"
      ></span>
    </div>
  </div>
</template>

<script setup>
import { createParticles } from './login.utils'

const props = defineProps({
  /** 主图完整 URL（站内 /profile/ 或内置 /login-assets/...）；空串=不渲染主图 */
  src: { type: String, default: '' },
  /** 线稿纹理 URL；空串=不渲染 */
  texture: { type: String, default: '' },
  /** 遮罩浓度 0~1 */
  overlay: { type: Number, default: 0.55 },
  /** 是否显示雷达 */
  showRadar: { type: Boolean, default: false },
  /** 是否显示粒子 */
  showParticles: { type: Boolean, default: false },
  /** 主图是否缓慢推近/拉远（Ken Burns） */
  kenBurns: { type: Boolean, default: true }
})

// setup 阶段只生成一次，重渲染复用同一份数据（避免动画重启/闪烁）
const particles = createParticles(28)

function ringStyle(pct) {
  return { width: pct + '%', height: pct + '%' }
}
</script>

<style lang="scss" scoped>
.ltech {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: var(--login-brand-bg);
}

.ltech-img {
  position: absolute;
  inset: 0;
  background-color: var(--login-brand-bg);
  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
  will-change: transform;
}
.ltech-img.is-kenburns {
  animation: ltech-kenburns 22s ease-in-out infinite alternate;
}
@keyframes ltech-kenburns {
  from { transform: scale(1.06); }
  to { transform: scale(1); }
}

.ltech-overlay {
  position: absolute;
  inset: 0;
  background: var(--login-brand-bg);
}

.ltech-texture {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 420px;
  height: 420px;
  background-size: 210px 210px;
  opacity: 0.5;
  -webkit-mask-image: radial-gradient(circle at bottom right, black 30%, transparent 75%);
  mask-image: radial-gradient(circle at bottom right, black 30%, transparent 75%);
}

.ltech-radar {
  position: absolute;
  right: -12%;
  bottom: -22%;
  width: 64%;
  aspect-ratio: 1;
}
.ltech-radar-ring {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(6, 182, 212, 0.15);
}
.ltech-radar-sweep {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, rgba(6, 182, 212, 0.28), rgba(6, 182, 212, 0.06) 60deg, transparent 90deg);
  animation: ltech-radar 20s linear infinite;
}
@keyframes ltech-radar {
  to { transform: rotate(360deg); }
}

.ltech-particles {
  position: absolute;
  inset: 0;
}
.ltech-particle {
  position: absolute;
  border-radius: 50%;
  animation-name: ltech-drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
  will-change: transform, opacity;
}
@keyframes ltech-drift {
  from { transform: translateY(-10px); }
  to { transform: translateY(10px); }
}

/* 访客系统开启「减弱动态效果」：停用一切装饰动画 */
@media (prefers-reduced-motion: reduce) {
  .ltech-img.is-kenburns,
  .ltech-radar-sweep,
  .ltech-particle {
    animation: none !important;
  }
}
</style>
