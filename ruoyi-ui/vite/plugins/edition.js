import fs from 'fs'
import path from 'path'

/**
 * Edition 产物标记插件：构建结束时在 dist 根写 edition.txt（standard|ai）。
 * 部署脚本据此校验前端产物线别与后端运行 EDITION 配对，防止错配上线。
 * @param {string} edition VITE_EDITION（缺省 standard）
 */
export default function createEditionMarker(edition) {
  const value = edition === 'ai' ? 'ai' : 'standard'
  let outDir = 'dist'
  return {
    name: 'apms-edition-marker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir || 'dist'
    },
    closeBundle() {
      const target = path.resolve(outDir, 'edition.txt')
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, `${value}\n`, 'utf-8')
      console.log(`[edition] ${target} = ${value}`)
    }
  }
}
