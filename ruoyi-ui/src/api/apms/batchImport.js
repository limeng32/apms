import request from '@/utils/request'

/**
 * 两阶段批量导入
 * ① previewImport：上传文件解析预览（multipart/form-data），返回预览 VO（含一次性 token）
 * ② commitImport：按 token 确认入库，返回 成功/跳过/失败 明细
 */

export function previewImport(url, file, extraForm = {}) {
  const formData = new FormData()
  formData.append('file', file)
  Object.keys(extraForm).forEach(k => {
    if (extraForm[k] !== null && extraForm[k] !== undefined && extraForm[k] !== '') {
      formData.append(k, extraForm[k])
    }
  })
  return request({
    url,
    method: 'post',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000
  })
}

export function commitImport(url, data) {
  return request({ url, method: 'post', data })
}
