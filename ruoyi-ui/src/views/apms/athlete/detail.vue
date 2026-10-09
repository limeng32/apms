<template>
  <div class="app-container rk-detail-page">
    <!-- 返回面包屑 -->
    <div class="rk-crumb">
      <button class="rk-crumb-link" @click="goBack"><el-icon><ArrowLeft/></el-icon>花名册</button>
      <span>/</span>
      <span class="rk-crumb-current">运动员 #{{ athleteId }}</span>
    </div>

    <!-- 详情内容（花名册内已改为抽屉，本路由页保留用于直达链接/刷新兜底） -->
    <AthleteDetailPanel :key="athleteId" :athlete-id="athleteId" @back="goBack" />
  </div>
</template>

<script setup name="AthleteDetail">
import { ArrowLeft } from '@element-plus/icons-vue'
import AthleteDetailPanel from './components/AthleteDetailPanel.vue'

const route = useRoute()
const router = useRouter()

const athleteId = computed(() => Number(route.params.athleteId))

// 返回花名册：
// 同一运动员名单页在不同菜单树下路径不同（旧 2200 树 /apms/athlete，
// 新 2400 树 /athletes/roster），不能硬编码，否则无权角色会 404。
// 顺序：列表入口携带的 from → 浏览器历史上一页 → 路由表实时解析 → 首页兜底。
function isKnownPath(p) {
  if (!p || typeof p !== 'string' || p.charAt(0) !== '/') return false
  // 命中 404 catch-all（/:pathMatch(.*)*）视为不可达
  return router.resolve(p).matched.some(r => !r.path.includes(':pathMatch'))
}
function goBack() {
  const from = Array.isArray(route.query.from) ? route.query.from[0] : route.query.from
  if (from && !from.startsWith(route.path) && isKnownPath(from)) {
    router.push(from)
    return
  }
  // 站内历史上一页（列表点进来的常规路径；刷新后 state.back 为 null 会走兜底）
  if (window.history.state && window.history.state.back) {
    router.back()
    return
  }
  const rosterPath = ['/athletes/roster', '/apms/athlete'].find(isKnownPath)
  router.push(rosterPath || '/index')
}
</script>

<style lang="scss" scoped>
@use "@/assets/styles/roster-kit.scss" as *;
</style>
