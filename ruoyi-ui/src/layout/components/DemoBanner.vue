<template>
  <!-- 演示态常驻提示条：底部居中悬浮，不占文档流、不影响任何页面布局 -->
  <transition name="demo-banner-fade">
    <div v-if="shown" class="demo-banner" :class="broken ? 'is-broken' : 'is-normal'" role="status">
      <el-icon class="demo-banner-icon">
        <WarningFilled v-if="broken" />
        <MagicStick v-else />
      </el-icon>
      <span class="demo-banner-text">
        <template v-if="broken">
          演示状态异常，请求仍完全在本地处理，刷新将退出
        </template>
        <template v-else>
          演示模式 · 数据为静态样本，仅当前标签页有效，刷新还原
        </template>
      </span>
      <el-tooltip v-if="!broken" content="退出演示，返回登录页" placement="top">
        <button type="button" class="demo-banner-exit" @click="exit">退出演示</button>
      </el-tooltip>
      <el-icon v-if="!broken" class="demo-banner-close" @click="dismissed = true">
        <Close />
      </el-icon>
    </div>
  </transition>
</template>

<script setup>
/**
 * 演示横幅（双态）：
 * - demo（正常）：琥珀色，可关闭（关闭只隐藏本标签页本次会话的提示，不改变演示状态），
 *   并提供「退出演示」快捷按钮；
 * - broken（会话单键损坏）：红色、不可关闭——此态下所有请求仍由 demoAdapter
 *   本地闭环，刷新页面后 login.vue 的 broken 自愈逻辑清键并回到普通登录。
 * storage-error 态用户停在登录页阻断页，Layout 不渲染，无需在此出现。
 */
import { ref, computed } from 'vue'
import { MagicStick, WarningFilled, Close } from '@element-plus/icons-vue'
import { readDemoSessionState } from '@/utils/auth'
import { exitDemo } from '@/utils/demo'
import useUserStore from '@/store/modules/user'

const userStore = useUserStore()

// Layout 在演示会话期间不卸载，初始化读一次即可（broken 不可能在运行中产生）
const state = readDemoSessionState()
const inDemo = computed(() => state.state === 'demo' || state.state === 'broken')
const broken = computed(() => state.state === 'broken')

// 正常态允许关闭提示条；broken 强制常驻
const dismissed = ref(false)
const shown = computed(() => inDemo.value && (!dismissed.value || broken.value))

function exit() {
  exitDemo()
  userStore.token = ''
  // 与 Navbar 退出一致，回到入口页
  window.location.href = '/index'
}
</script>

<style lang="scss" scoped>
.demo-banner {
  position: fixed;
  left: 50%;
  bottom: 22px;
  transform: translateX(-50%);
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 48px);
  padding: 8px 10px 8px 14px;
  border-radius: 999px;
  font-size: 12.5px;
  line-height: 1.4;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
  backdrop-filter: blur(6px);

  &.is-normal {
    color: #78350f;
    background: rgba(253, 230, 138, 0.95);
    border: 1px solid #f59e0b;
  }
  &.is-broken {
    color: #fff;
    background: rgba(220, 38, 38, 0.95);
    border: 1px solid #b91c1c;
  }
}
.demo-banner-icon { font-size: 15px; flex: none; }
.demo-banner-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.demo-banner-exit {
  flex: none;
  margin-left: 4px;
  padding: 2px 10px;
  border: none;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  color: #78350f;
  background: rgba(255, 255, 255, 0.75);
  transition: background .15s;
  &:hover { background: #fff; }
}
.demo-banner-close {
  flex: none;
  margin-left: 2px;
  font-size: 13px;
  cursor: pointer;
  opacity: .65;
  &:hover { opacity: 1; }
}

.demo-banner-fade-enter-active,
.demo-banner-fade-leave-active {
  transition: opacity .25s ease, transform .25s ease;
}
.demo-banner-fade-enter-from,
.demo-banner-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}

@media (max-width: 640px) {
  .demo-banner { bottom: 12px; max-width: calc(100vw - 24px); }
  .demo-banner-text { white-space: normal; }
}
</style>
