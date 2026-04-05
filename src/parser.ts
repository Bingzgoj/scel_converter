const START_PY = 0x1540
const START_CHINESE = 0x2628

export interface ScelMeta {
  name: string
  type: string
  desc: string
  sample: string
}

export interface ScelResult {
  meta: ScelMeta
  words: Array<[number, string, string]>
}

const utf16leDecoder = new TextDecoder('utf-16le')

function decodeUtf16le(buf: Uint8Array, offset: number, length: number): string {
  return utf16leDecoder.decode(buf.slice(offset, offset + length)).replace(/\0/g, '')
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

function looksGarbled(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return true

  const mojibakeChars = [...value].filter(ch =>
    '脗脙脛脌脿脫脝脪录没鲁拢茫忙碌'.includes(ch)
  ).length

  return value.length >= 4 && mojibakeChars >= 2
}

function sanitizeMeta(meta: ScelMeta, sourceName = ''): ScelMeta {
  const fallbackName = stripExtension(sourceName)

  return {
    name: looksGarbled(meta.name) ? fallbackName : meta.name,
    type: looksGarbled(meta.type) ? '' : meta.type,
    desc: looksGarbled(meta.desc) ? '' : meta.desc,
    sample: looksGarbled(meta.sample) ? '' : meta.sample,
  }
}

function readU16LE(buf: Uint8Array, pos: number): number {
  return buf[pos] | (buf[pos + 1] << 8)
}

function parsePyTable(
  buf: Uint8Array,
  start: number,
  end: number
): Record<number, string> {
  const table: Record<number, string> = {}
  let pos = start + 4
  while (pos + 3 < end) {
    const index = readU16LE(buf, pos); pos += 2
    const lenPy = readU16LE(buf, pos); pos += 2
    if (pos + lenPy > end) break
    table[index] = decodeUtf16le(buf, pos, lenPy)
    pos += lenPy
  }
  return table
}

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

function parseChinese(
  buf: Uint8Array,
  start: number,
  pyTable: Record<number, string>
): Array<[number, string, string]> {
  const words: Array<[number, string, string]> = []
  let pos = start

  while (pos + 3 < buf.length) {
    const same = readU16LE(buf, pos); pos += 2
    const pyLen = readU16LE(buf, pos); pos += 2
    if (pos + pyLen > buf.length) break
    const py = getWordPy(buf, pos, pyLen, pyTable)
    pos += pyLen

    for (let i = 0; i < same; i++) {
      if (pos + 1 >= buf.length) break
      const cLen = readU16LE(buf, pos); pos += 2
      if (pos + cLen > buf.length) break
      const word = decodeUtf16le(buf, pos, cLen)
      pos += cLen
      if (pos + 1 >= buf.length) break
      const extLen = readU16LE(buf, pos); pos += 2
      if (pos + 1 >= buf.length) break
      const count = readU16LE(buf, pos)
      words.push([count, py, word])
      pos += extLen
    }
  }

  return words
}

export function parseScel(arrayBuffer: ArrayBuffer, sourceName = ''): ScelResult {
  const buf = new Uint8Array(arrayBuffer)

  const meta = sanitizeMeta({
    name:   decodeUtf16le(buf, 0x130, 0x338 - 0x130).trim(),
    type:   decodeUtf16le(buf, 0x338, 0x540 - 0x338).trim(),
    desc:   decodeUtf16le(buf, 0x540, 0xd40 - 0x540).trim(),
    sample: decodeUtf16le(buf, 0xd40, START_PY - 0xd40).trim(),
  }, sourceName)

  const pyTable = parsePyTable(buf, START_PY, START_CHINESE)
  const words   = parseChinese(buf, START_CHINESE, pyTable)

  return { meta, words }
}

export function wordsToText(words: ScelResult['words']): string {
  return words.map(([, , w]) => w).join('\n') + '\n'
}
