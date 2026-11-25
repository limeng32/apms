<script setup>
/**
 * ElDialog 全局增强包装：为所有 el-dialog 统一注入 H5 右滑关闭手势。
 *
 * 背景：项目内 69 处 el-dialog 分布在 49 个 SFC，逐模板包裹 host div 成本高、
 * 易漏 #footer 具名插槽（包进普通 div 会 SFC 编译失败）。本组件在 main.js 以
 * app.component('ElDialog', SwipeDialog) 覆盖注册，所有 <el-dialog> 自动解析到本包装，
 * 业务 SFC 零改动；ElMessageBox/ElDrawer 内部直接引用模块对象、不走全局组件解析，不受影响。
 *
 * 这不是 document 委托：手势仍是 vDialogSwipe 指令实例，生命周期随本组件、
 * 无全局监听/游离定时器。关闭调用 ElDialog expose 的 handleClose()，与点右上角 X
 * 完全同路径——beforeClose 拦截、close 事件、update:modelValue 全链路保留，
 * 因此 v-model 双向绑定与「:model-value 单向 + @close 自管」两种用法都能正确关闭。
 * 指令的全部既有能力（≤768px 触摸门控、输入控件放行、横滚边缘放行、
 * .dialog-swipe-ignore 豁免、EP 离场关键帧压制）原样继承。
 *
 * 透传契约：
 * - inheritAttrs:false 后 v-bind="$attrs" 把全部 props 与事件原样交给 ElDialog；
 * - footer/header/title 具名插槽原样透传，header 的作用域参数 { close,titleId,titleClass }
 *   用 v-bind="slotProps" 整体带出；默认插槽外包一层无样式 host div 作为指令挂载点。
 */
import { ref } from 'vue'
import { ElDialog } from 'element-plus'
import { vDialogSwipe } from '@/utils/dialogSwipe'

defineOptions({ inheritAttrs: false, name: 'ElDialog' })
defineProps({
  modelValue: Boolean
})
defineEmits(['update:modelValue'])

const dialogRef = ref(null)
// 与点 X 同路径：EP 内部依次执行 beforeClose → emit close → emit update:modelValue(false)
const close = () => dialogRef.value?.handleClose()
</script>

<template>
  <ElDialog ref="dialogRef" v-bind="$attrs" :model-value="modelValue"
            @update:model-value="$emit('update:modelValue', $event)">
    <div class="dialog-swipe-host" v-dialog-swipe="close">
      <slot />
    </div>
    <template v-if="$slots.header" #header="slotProps">
      <slot name="header" v-bind="slotProps" />
    </template>
    <template v-if="$slots.title" #title="slotProps">
      <slot name="title" v-bind="slotProps" />
    </template>
    <template v-if="$slots.footer" #footer="slotProps">
      <slot name="footer" v-bind="slotProps" />
    </template>
  </ElDialog>
</template>
