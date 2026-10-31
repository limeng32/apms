import vue from '@vitejs/plugin-vue'

import createAutoImport from './auto-import.js'
import createSvgIcon from './svg-icon.js'
import createCompression from './compression.js'
import createSetupExtend from './setup-extend.js'
import createEditionMarker from './edition.js'

export default function createVitePlugins(viteEnv, isBuild = false) {
  const vitePlugins = [vue()]
  vitePlugins.push(createAutoImport())
  vitePlugins.push(createSetupExtend())
  vitePlugins.push(createSvgIcon(isBuild))
  // 构建产物写 edition.txt（standard|ai），供部署脚本做线别配对校验
  isBuild && vitePlugins.push(createEditionMarker(viteEnv.VITE_EDITION))
  isBuild && vitePlugins.push(...createCompression(viteEnv))
  return vitePlugins
}
