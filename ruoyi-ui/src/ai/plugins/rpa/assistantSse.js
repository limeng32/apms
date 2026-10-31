/**
 * SSE 解析器（纯函数，不依赖 Vue/axios）。
 * 按空行分帧，兼容 \n\n 与 \r\n\r\n；支持 event 名、多行 data、心跳注释。
 */
function nextSeparator(buffer) {
  const lf = buffer.indexOf('\n\n')
  const crlf = buffer.indexOf('\r\n\r\n')
  if (lf < 0 && crlf < 0) return null
  if (crlf >= 0 && (lf < 0 || crlf < lf)) return { index: crlf, length: 4 }
  return { index: lf, length: 2 }
}

function dispatchFrame(frame, onEvent) {
  if (!frame || !frame.trim()) return
  let event = 'message'
  const dataLines = []
  frame.split('\n').forEach(line => {
    const clean = line.endsWith('\r') ? line.slice(0, -1) : line
    if (clean.startsWith(':')) return
    if (clean.startsWith('event:')) {
      event = clean.slice(6).trim()
    } else if (clean.startsWith('data:')) {
      dataLines.push(clean.slice(5).replace(/^\s/, ''))
    }
  })
  if (dataLines.length === 0) return
  const raw = dataLines.join('\n')
  let data
  try {
    data = JSON.parse(raw)
  } catch (e) {
    return
  }
  onEvent(event, data)
}

/**
 * @param {ReadableStream} body fetch 响应体
 * @param {(event: string, data: any) => void} onEvent
 */
export async function parseSse(body, onEvent) {
  if (!body || typeof body.getReader !== 'function') {
    throw new Error('当前浏览器不支持流式响应')
  }
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let sep
    while ((sep = nextSeparator(buffer)) !== null) {
      dispatchFrame(buffer.slice(0, sep.index), onEvent)
      buffer = buffer.slice(sep.index + sep.length)
    }
  }
  buffer += decoder.decode()
  if (buffer.trim()) dispatchFrame(buffer, onEvent)
}
