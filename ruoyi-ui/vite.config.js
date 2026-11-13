import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import createVitePlugins from './vite/plugins/index.js'

const baseUrl = 'http://localhost:8080' // 后端接口（本地）

// 每次「构建/启动 dev server」生成一次的构建号，用于 public 下不参与哈希的静态资源
// （如 /favicon.ico）版本化：重新部署后 URL 查询串变化，强制浏览器拉新，绕过 nginx 7 天强缓存
const BUILD_ID = String(Date.now())

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd())
  const { VITE_APP_ENV } = env
  // 产品线：standard（缺省，零 AI 代码）| ai。@ai 别名解析到容器实现或空桩
  const edition = env.VITE_EDITION === 'ai' ? 'ai' : 'standard'
  return {
    // 部署生产环境和开发环境下的URL。
    // 默认情况下，vite 会假设你的应用是被部署在一个域名的根路径上
    // 例如 https://www.ruoyi.vip/。如果应用被部署在一个子路径上，你就需要用 baseUrl 设置这个子路径。例如，如果你的应用被部署在 https://www.ruoyi.vip/admin/，则设置 baseUrl 为 /admin/。
    // trial 构建经 VITE_APP_BASEPATH=/trial/ 挂同域子路径；其余 mode 缺省回退根路径，行为不变
    base: env.VITE_APP_BASEPATH || '/',
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID)
    },
    plugins: [
      ...createVitePlugins(env, command === 'build'),
      {
        name: 'apms-build-id-html',
        transformIndexHtml(html) {
          return html.replace(/%BUILD_ID%/g, BUILD_ID)
        }
      }
    ],
    resolve: {
      // https://cn.vitejs.dev/config/#resolve-alias
      alias: {
        // 设置路径
        '~': path.resolve(__dirname, './'),
        // 设置别名
        '@': path.resolve(__dirname, './src'),
        // AI 容器唯一入口：ai 构建解析 src/ai，standard 构建解析 src/ai-stub（零 AI 代码进产物）
        '@ai': path.resolve(__dirname, edition === 'ai' ? './src/ai' : './src/ai-stub')
      },
      // https://cn.vitejs.dev/config/#resolve-extensions
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue']
    },
    // 打包配置
    build: {
      // https://vite.dev/config/build-options.html
      sourcemap: command === 'build' ? false : 'inline',
      // trial 构建输出 dist-trial，与正式构建的 dist 物理隔离；其余 mode 缺省 dist
      outDir: env.VITE_BUILD_OUTDIR || 'dist',
      assetsDir: 'assets',
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          chunkFileNames: 'static/js/[name]-[hash].js',
          entryFileNames: 'static/js/[name]-[hash].js',
          assetFileNames: 'static/[ext]/[name]-[hash].[ext]'
        }
      }
    },
    // vite 相关配置
    server: {
      port: 5173,
      host: true,
      open: true,
      proxy: {
        // https://cn.vitejs.dev/config/#server-proxy
        '/dev-api': {
          target: baseUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/dev-api/, '')
        },
         // springdoc proxy
         '^/v3/api-docs/(.*)': {
          target: baseUrl,
          changeOrigin: true,
        }
      }
    },
    css: {
      postcss: {
        plugins: [
          {
            postcssPlugin: 'internal:charset-removal',
            AtRule: {
              charset: (atRule) => {
                if (atRule.name === 'charset') {
                  atRule.remove()
                }
              }
            }
          }
        ]
      }
    }
  }
})
