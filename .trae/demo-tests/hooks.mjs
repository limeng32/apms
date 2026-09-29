/**
 * Node 桩测 · ESM 定制钩子
 *
 * 用途：让 Node 直接加载 ruoyi-ui/src 下的演示模块（auth/mock/demo/request），
 * - '@/...' 别名 → src 真实文件（保持与 Vite 一致的解析）；
 * - 仅桩掉浏览器/工程化依赖（js-cookie、element-plus、file-saver、pinia user store 等），
 *   被测核心代码一律加载真实源码；
 * - import.meta.env 在 Node 不存在，统一改写为 globalThis.__VITE_ENV__（由 run.mjs 提供）。
 */
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const UI_ROOT = '/Users/limeng/Documents/trae_projects/apms/ruoyi-ui'
const UI_SRC = `${UI_ROOT}/src`
const SRC_PREFIX = pathToFileURL(`${UI_SRC}/`).href

const requireFromUi = createRequire(`${UI_ROOT}/package.json`)

const dataUrl = (code) => 'data:text/javascript,' + encodeURIComponent(code)

/** 桩模块（自包含，不引用 '@/'） */
export const STUBS = {
  // 内存 Cookie：记录每次访问，断言"演示流零 Cookie 写删"
  'js-cookie': dataUrl(`
    const jar = new Map(); const log = [];
    export default {
      get(k) { log.push(['get', k]); return jar.has(k) ? jar.get(k) : undefined; },
      set(k, v) { log.push(['set', k, String(v)]); jar.set(k, String(v)); },
      remove(k) { log.push(['remove', k]); jar.delete(k); },
      _seed(k, v) { jar.set(k, String(v)); },
      _reset() { jar.clear(); log.length = 0; },
      _log: log
    };
  `),
  // element-plus：只记录调用，不渲染
  'element-plus': dataUrl(`
    export const __calls = [];
    const rec = (tag) => (...args) => { __calls.push([tag, ...args]); };
    const ElMessage = Object.assign(rec('ElMessage'), {
      success: rec('ElMessage.success'), warning: rec('ElMessage.warning'),
      info: rec('ElMessage.info'), error: rec('ElMessage.error')
    });
    export { ElMessage };
    export const ElNotification = { success: rec('N.success'), error: rec('N.error'), warning: rec('N.warning'), info: rec('N.info') };
    export const ElMessageBox = { confirm: () => Promise.reject(new Error('stub cancel')), alert: () => Promise.resolve() };
    export const ElLoading = { service: (...a) => { __calls.push(['ElLoading.service', ...a]); return { close: rec('loading.close') }; } };
  `),
  'file-saver': dataUrl(`
    export const __saveAsCalls = [];
    export function saveAs(...args) { __saveAsCalls.push(args); }
  `),
  '@/plugins/cache': dataUrl(`
    const mk = () => {
      const m = new Map();
      return {
        get: (k) => m.get(k), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k),
        getJSON: (k) => { const v = m.get(k); return v === undefined ? undefined : JSON.parse(v); },
        setJSON: (k, v) => m.set(k, JSON.stringify(v))
      };
    };
    export default { session: mk(), local: mk() };
  `),
  '@/utils/errorCode': dataUrl(`export default { 401: '认证失败' };`),
  // pinia user store：可观察的单例
  '@/store/modules/user': dataUrl(`
    export const __store = { token: '', roles: [], permissions: [], portalMode: false, homePath: '' };
    export default function useUserStore() { return __store; }
  `)
}

function aliasReal(specifier) {
  const rest = specifier.slice(2)
  const file = /\.(js|mjs|vue)$/.test(rest) ? rest : `${rest}.js`
  return pathToFileURL(`${UI_SRC}/${file}`).href
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'axios') {
    // 强制从 ruoyi-ui/node_modules 解析，保证测到的是项目真实安装的 axios 1.13.2
    return nextResolve(pathToFileURL(requireFromUi.resolve('axios')).href, context)
  }
  if (Object.prototype.hasOwnProperty.call(STUBS, specifier)) {
    return { url: STUBS[specifier], shortCircuit: true }
  }
  if (specifier.startsWith('@/')) {
    return { url: aliasReal(specifier), shortCircuit: true }
  }
  // Vite 允许无扩展相对导入（'./framework'、'./fixtures/index'）；Node 需补 '.js'
  if ((specifier.startsWith('./') || specifier.startsWith('../'))
    && context.parentURL && context.parentURL.startsWith(SRC_PREFIX)
    && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    try {
      return await nextResolve(specifier, context)
    } catch {
      return { url: new URL(`${specifier}.js`, context.parentURL).href, shortCircuit: true }
    }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url.startsWith(SRC_PREFIX)) {
    const res = await nextLoad(url, context)
    // Node 返回的 source 可能是 Buffer/Uint8Array，先统一成字符串再判定
    let source = res.source
    if (source instanceof Uint8Array) {
      source = Buffer.from(source).toString('utf8')
    }
    if (typeof source === 'string' && source.includes('import.meta.env')) {
      return {
        format: 'module',
        source: source.replaceAll('import.meta.env', 'globalThis.__VITE_ENV__'),
        shortCircuit: true
      }
    }
    return { format: res.format || 'module', source, shortCircuit: true }
  }
  return nextLoad(url, context)
}

export { UI_SRC, pathToFileURL }
