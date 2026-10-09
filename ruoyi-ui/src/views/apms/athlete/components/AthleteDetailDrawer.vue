<template>
  <el-drawer
    v-model="open"
    :size="drawerSize"
    :with-header="false"
    destroy-on-close
    class="ad-drawer-wrap"
    :style="drawerPanelStyle"
  >
    <div class="ad-drawer">
      <!-- 抽屉头 -->
      <div class="ad-drawer-head">
        <div class="ad-drawer-title">
          <div class="ad-drawer-name">运动员档案</div>
          <div class="ad-drawer-sub">编号 <span class="rk-mono">#{{ athleteId }}</span></div>
        </div>
        <button type="button" class="ad-drawer-close" @click="open = false">
          <el-icon><Close/></el-icon>
        </button>
      </div>

      <!-- 详情内容（destroy-on-close 保证每次打开重新加载） -->
      <AthleteDetailPanel
        v-if="athleteId"
        :athlete-id="athleteId"
        embedded
        @back="open = false"
        @changed="emit('changed')"
      />
    </div>
  </el-drawer>
</template>

<script setup name="AthleteDetailDrawer">
import { Close } from '@element-plus/icons-vue'
import AthleteDetailPanel from './AthleteDetailPanel.vue'
import useUserStore from '@/store/modules/user'
import useSettingsStore from '@/store/modules/settings'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  athleteId: { type: Number, default: null }
})
const emit = defineEmits(['update:modelValue', 'changed'])

const open = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

// 顶栏是 fixed 浮层（navbar 50px；标准模式另有 tagsView 34px；Portal 专岗无 tagsView），
// 抽屉默认 top:0 会被顶栏盖住头部，按当前布局下移到顶栏之下。
// 用内联 style 直写 top/height：抽屉 teleport 到 body，scoped :deep 的 data-v 选择器
// 在面板祖先链上无匹配、规则不生效；内联样式经 $attrs 合并到 .el-drawer，必定命中
const userStore = useUserStore()
const settingsStore = useSettingsStore()
const headerOffset = computed(() =>
  (!userStore.portalMode && settingsStore.tagsView) ? 84 : 50)
const drawerPanelStyle = computed(() => ({
  top: headerOffset.value + 'px',
  height: 'calc(100vh - ' + headerOffset.value + 'px)',
  maxWidth: '100vw'
}))

// 窄屏全宽，桌面 760px（表格在 rk-table-scroll 内横向滚动，不撑破抽屉）
const viewportWidth = ref(window.innerWidth)
function onResize() { viewportWidth.value = window.innerWidth }
onMounted(() => window.addEventListener('resize', onResize))
onBeforeUnmount(() => window.removeEventListener('resize', onResize))
const drawerSize = computed(() => (viewportWidth.value <= 800 ? '100%' : '760px'))
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;

.ad-drawer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: $rk-canvas;
  overflow: hidden;
}
.ad-drawer-head {
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid $rk-line;
}
.ad-drawer-name {
  font-size: 16px;
  font-weight: 700;
  color: $rk-text-1;
  line-height: 22px;
}
.ad-drawer-sub {
  margin-top: 2px;
  font-size: 12px;
  color: $rk-text-3;
}
.ad-drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  color: $rk-text-3;
  background: none;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  &:hover { background: $rk-canvas; color: $rk-text-1; }
}

/* 内容区独立滚动，头部固定 */
.ad-drawer :deep(.ad-panel) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 20px 28px;
}
@media (max-width: 768px) {
  .ad-drawer :deep(.ad-panel) { padding: 14px 14px 24px; }
}
</style>

<!-- 全局样式：.el-drawer 面板经 teleport 挂到 body，scoped 选择器无法可靠命中其内部元素 -->
<style lang="scss">
.el-drawer.ad-drawer-wrap .el-drawer__body {
  padding: 0;
}
</style>
