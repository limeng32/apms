/**
 * 零依赖最小 XLSX 生成器（仅用于演示环境本地生成导入模板）。
 *
 * 背景：演示环境 request.download() 被统一拦截（无 blob 通道），而批量模板只保留
 * xlsx 格式，又不能为此引入 SheetJS 等重依赖。XLSX 本质是 ZIP 包 + 一组 XML，
 * 这里用 STORE（不压缩，method=0）方式打包，浏览器原生 API 即可完成，Excel/WPS
 * 均可正常打开。所有单元格按 inlineStr 文本写入（与后端 POI setCellValue(String)
 * 生成的模板口径一致）。
 *
 * 纯函数实现，不依赖 DOM，可直接在 Node 桩测中 import 验证。
 */

const enc = new TextEncoder()

/** CRC32（IEEE 802.3 多项式，ZIP 校验标配） */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 0 → A，25 → Z，26 → AA */
function colLetter(idx) {
  let n = idx
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

function sheetXml(rows) {
  const rowXml = rows.map((row, rIdx) => {
    const cells = row.map((val, cIdx) => {
      const ref = `${colLetter(cIdx)}${rIdx + 1}`
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(val)}</t></is></c>`
    }).join('')
    return `<row r="${rIdx + 1}">${cells}</row>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="import" sheetId="1" r:id="rId1"/></sheets></workbook>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`

/**
 * STORE 方式打 ZIP（无压缩，无需 deflate 实现）。
 * @param {{name: string, data: Uint8Array}[]} entries
 * @returns {Uint8Array}
 */
function zipStore(entries) {
  const locals = []
  const central = []
  let offset = 0
  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)
    const local = new Uint8Array(30 + nameBytes.length + data.length)
    const dv = new DataView(local.buffer)
    dv.setUint32(0, 0x04034b50, true) // 本地文件头签名
    dv.setUint16(4, 20, true)         // 解压所需版本
    dv.setUint16(6, 0, true)          // 通用标志
    dv.setUint16(8, 0, true)          // 压缩方式：0=STORE
    dv.setUint16(10, 0, true)         // DOS 时间
    dv.setUint16(12, 0x21, true)      // DOS 日期（1980-01-01）
    dv.setUint32(14, crc, true)
    dv.setUint32(18, data.length, true) // 压缩后大小
    dv.setUint32(22, data.length, true) // 原始大小
    dv.setUint16(26, nameBytes.length, true)
    dv.setUint16(28, 0, true)         // 扩展字段长度
    local.set(nameBytes, 30)
    local.set(data, 30 + nameBytes.length)
    locals.push(local)
    central.push({ nameBytes, crc, size: data.length, offset })
    offset += local.length
  }

  const centrals = []
  let centralSize = 0
  for (const c of central) {
    const cd = new Uint8Array(46 + c.nameBytes.length)
    const dv = new DataView(cd.buffer)
    dv.setUint32(0, 0x02014b50, true) // 中央目录头签名
    dv.setUint16(4, 20, true)
    dv.setUint16(6, 20, true)
    dv.setUint16(8, 0, true)
    dv.setUint16(10, 0, true)
    dv.setUint16(12, 0, true)
    dv.setUint16(14, 0x21, true)
    dv.setUint32(16, c.crc, true)
    dv.setUint32(20, c.size, true)
    dv.setUint32(24, c.size, true)
    dv.setUint16(28, c.nameBytes.length, true)
    dv.setUint32(42, c.offset, true)
    cd.set(c.nameBytes, 46)
    centrals.push(cd)
    centralSize += cd.length
  }

  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true) // EOCD 签名
  edv.setUint16(8, entries.length, true)
  edv.setUint16(10, entries.length, true)
  edv.setUint32(12, centralSize, true)
  edv.setUint32(16, offset, true)

  const total = offset + centralSize + 22
  const out = new Uint8Array(total)
  let p = 0
  for (const chunk of locals) { out.set(chunk, p); p += chunk.length }
  for (const chunk of centrals) { out.set(chunk, p); p += chunk.length }
  out.set(eocd, p)
  return out
}

/**
 * 生成 xlsx 二进制（字符串二维数组 → XLSX bytes）。
 * @param {string[][]} rows 行数据（第一行通常为说明行，第二行为表头）
 * @returns {Uint8Array}
 */
export function buildXlsxBytes(rows) {
  const parts = [
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['xl/workbook.xml', WORKBOOK],
    ['xl/_rels/workbook.xml.rels', WORKBOOK_RELS],
    ['xl/worksheets/sheet1.xml', sheetXml(rows)]
  ]
  return zipStore(parts.map(([name, xml]) => ({ name, data: enc.encode(xml) })))
}

/** 浏览器侧直接生成可下载 Blob */
export function buildXlsxBlob(rows) {
  return new Blob([buildXlsxBytes(rows)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}
