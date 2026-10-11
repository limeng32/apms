import { ElMessage, ElMessageBox, ElNotification, ElLoading } from 'element-plus'

let loadingInstance

export default {
  // 消息提示
  msg(content) {
    ElMessage.info(content)
  },
  // 错误消息
  msgError(content) {
    ElMessage.error(content)
  },
  // 成功消息
  msgSuccess(content) {
    ElMessage.success(content)
  },
  // 警告消息
  msgWarning(content) {
    ElMessage.warning(content)
  },
  // 弹出提示（title 可选，默认「系统提示」；建议业务确认传动作名，如「删除指标」）
  alert(content, title) {
    ElMessageBox.alert(content, title || "系统提示")
  },
  // 错误提示
  alertError(content, title) {
    ElMessageBox.alert(content, title || "系统提示", { type: 'error' })
  },
  // 成功提示
  alertSuccess(content, title) {
    ElMessageBox.alert(content, title || "系统提示", { type: 'success' })
  },
  // 警告提示
  alertWarning(content, title) {
    ElMessageBox.alert(content, title || "系统提示", { type: 'warning' })
  },
  // 通知提示
  notify(content) {
    ElNotification.info(content)
  },
  // 错误通知
  notifyError(content) {
    ElNotification.error(content)
  },
  // 成功通知
  notifySuccess(content) {
    ElNotification.success(content)
  },
  // 警告通知
  notifyWarning(content) {
    ElNotification.warning(content)
  },
  // 确认窗体（title 可选，默认「系统提示」；业务写操作请传动作名，如 confirm(text, '队员离队')）
  confirm(content, title, options) {
    return ElMessageBox.confirm(content, title || "系统提示", {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: "warning",
      ...options,
    })
  },
  // 提交内容（title/options 可选）
  prompt(content, title, options) {
    return ElMessageBox.prompt(content, title || "系统提示", {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: "warning",
      ...options,
    })
  },
  // 打开遮罩层
  loading(content) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: content,
      background: "rgba(0, 0, 0, 0.7)",
    })
  },
  // 关闭遮罩层
  closeLoading() {
    loadingInstance.close()
  }
}
