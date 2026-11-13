import fs from 'fs'
import path from 'path'

/**
 * Edition 产物标记插件：构建结束时在产物根写 edition.txt（standard|ai）。
 * 部署脚本据此校验前端产物线别与后端运行 EDITION 配对，防止错配上线。
 * trial 构建额外写 trial.txt 作为演示包标识（不参与正式站部署门禁）。
 * @param {string} edition VITE_EDITION（缺省 standard）
 * @param {boolean} isTrial 是否演示锁定构建（VITE_DEMO_LOCKED==='true'）
 */
export default function createEditionMarker(edition, isTrial = false) {
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
      if (isTrial) {
        const trialTarget = path.resolve(outDir, 'trial.txt')
        fs.writeFileSync(trialTarget, 'trial\n', 'utf-8')
        console.log(`[edition] ${trialTarget} = trial`)
      }
    }
  }
}
