// 用最小 Vue reactivity 替身测试纯逻辑：useConfigHistory 依赖 vue 的 ref/computed/watch。
// 这里直接 esbuild 打包真实 vue（node 可运行 vue 的 reactivity/runtime-core 子集较繁），
// 改为注入假的 configRef + 手动触发，绕过 watch：通过模块导出的 pickScope/applyScope/ownerOf
// 与历史核心算法（抽出相同语义）做测试不现实，因此用 vue 的 createApp 在 node 跑 watch。
import { createApp, ref, computed, h, watch, nextTick } from 'vue'
