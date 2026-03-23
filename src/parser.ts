// 拼音表偏移
const START_PY = 0x1540
// 汉语词组表偏移
const START_CHINESE = 0x2628

export interface ScelMeta {
  name: string
  type: string
  desc: string
  sample: string
}

export interface ScelResult {
  meta: ScelMeta
  /** [词频, 拼音, 中文词组] */
  words: Array<[number, string, string]>
}

/** 每两个字节读取一个 UTF-16LE 字符，拼成字符串 */
function byte2str(buf: Uint8Array, offset: number, length: number): string {
  let s = ''
  const end = offset + length
  for (let i = offset; i + 1 < end; i += 2) {
    const code = buf[i] | (buf[i + 1] << 8)
    if (code !== 0) s += String.fromCharCode(code)
  }
  return s
}

function readU16LE(buf: Uint8Array, pos: number): number {
  return buf[pos] | (buf[pos + 1] << 8)
}

/** 解析全局拼音表 index -> pinyin */
function parsePyTable(
  buf: Uint8Array,
  start: number,
  end: number
): Record<number, string> {
  const table: Record<number, string> = {}
  let pos = start + 4 // 跳过 4 字节表头
  while (pos + 3 < end) {
    const index = readU16LE(buf, pos); pos += 2
    const lenPy = readU16LE(buf, pos); pos += 2
    if (pos + lenPy > end) break
    table[index] = byte2str(buf, pos, lenPy)
    pos += lenPy
  }
  return table
}

/** 根据拼音索引列表还原拼音字符串 */
function getWordPy(
  buf: Uint8Array,
  offset: number,
  length: number,
  pyTable: Record<number, string>
): string {
  let s = ''
  for (let i = 0; i < length; i += 2) {
    const idx = readU16LE(buf, offset + i)
    s += pyTable[idx] ?? ''
  }
  return s
}

/** 解析汉语词组表 */
function parseChinese(
  buf: Uint8Array,
  start: number,
  pyTable: Record<number, string>
): Array<[number, string, string]> {
  const words: Array<[number, string, string]> = []
  let pos = start

  while (pos + 3 < buf.length) {
    // 同音词数量
    const same = readU16LE(buf, pos); pos += 2
    // 拼音索引表长度
    const pyLen = readU16LE(buf, pos); pos += 2
    if (pos + pyLen > buf.length) break
    const py = getWordPy(buf, pos, pyLen, pyTable)
    pos += pyLen

    for (let i = 0; i < same; i++) {
      if (pos + 1 >= buf.length) break
      // 中文词组字节长度
      const cLen = readU16LE(buf, pos); pos += 2
      if (pos + cLen > buf.length) break
      const word = byte2str(buf, pos, cLen)
      pos += cLen
      // 扩展数据长度（通常为 10）
      if (pos + 1 >= buf.length) break
      const extLen = readU16LE(buf, pos); pos += 2
      // 词频（扩展数据前两个字节）
      if (pos + 1 >= buf.length) break
      const count = readU16LE(buf, pos)
      words.push([count, py, word])
      pos += extLen
    }
  }

  return words
}

/** 解析一个 .scel 文件的 ArrayBuffer，返回元信息和词条列表 */
export function parseScel(arrayBuffer: ArrayBuffer): ScelResult {
  const buf = new Uint8Array(arrayBuffer)

  const meta: ScelMeta = {
    name:   byte2str(buf, 0x130,  0x338 - 0x130),
    type:   byte2str(buf, 0x338,  0x540 - 0x338),
    desc:   byte2str(buf, 0x540,  0xd40 - 0x540),
    sample: byte2str(buf, 0xd40,  START_PY - 0xd40),
  }

  const pyTable = parsePyTable(buf, START_PY, START_CHINESE)
  const words   = parseChinese(buf, START_CHINESE, pyTable)

  return { meta, words }
}

/** 将词条列表转为纯文本（每行一个词） */
export function wordsToText(words: ScelResult['words']): string {
  return words.map(([, , w]) => w).join('\n') + '\n'
}
