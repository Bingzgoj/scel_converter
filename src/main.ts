import { parseScel, wordsToText, type ScelResult } from './parser'

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface OutputFile {
  name: string
  blob: Blob
  count: number
  url: string
}

/* ─────────────────────────────────────────
   DOM refs
───────────────────────────────────────── */
const fileInput    = document.getElementById('fileInput')    as HTMLInputElement
const browseBtn    = document.getElementById('browseBtn')    as HTMLButtonElement
const dropZone     = document.getElementById('dropZone')     as HTMLDivElement
const fileListEl   = document.getElementById('fileList')     as HTMLDivElement
const convertBtn   = document.getElementById('convertBtn')   as HTMLButtonElement
const clearBtn     = document.getElementById('clearBtn')     as HTMLButtonElement
const progressWrap = document.getElementById('progressWrap') as HTMLDivElement
const progressText = document.getElementById('progressText') as HTMLSpanElement
const progressPct  = document.getElementById('progressPct')  as HTMLSpanElement
const progressFill = document.getElementById('progressFill') as HTMLDivElement
const logPanel     = document.getElementById('logPanel')     as HTMLDivElement
const resultsEl    = document.getElementById('results')      as HTMLDivElement
const resultItems  = document.getElementById('resultItems')  as HTMLDivElement
const dlAllBtn     = document.getElementById('dlAllBtn')     as HTMLButtonElement

/* ─────────────────────────────────────────
   State
───────────────────────────────────────── */
let pendingFiles: File[]    = []
let outputFiles:  OutputFile[] = []

/* ─────────────────────────────────────────
   File selection
───────────────────────────────────────── */
browseBtn.addEventListener('click', () => fileInput.click())
fileInput.addEventListener('change', () => {
  addFiles(Array.from(fileInput.files ?? []))
  fileInput.value = ''
})

dropZone.addEventListener('dragover', e => {
  e.preventDefault()
  dropZone.classList.add('drag-over')
})
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'))
dropZone.addEventListener('drop', e => {
  e.preventDefault()
  dropZone.classList.remove('drag-over')
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.name.endsWith('.scel'))
  if (files.length) addFiles(files)
})

function addFiles(files: File[]): void {
  const existing = new Set(pendingFiles.map(f => f.name + f.size))
  files.forEach(f => { if (!existing.has(f.name + f.size)) pendingFiles.push(f) })
  renderFileList()
}

function renderFileList(): void {
  if (pendingFiles.length === 0) {
    fileListEl.classList.remove('visible')
    convertBtn.disabled = true
    return
  }
  fileListEl.classList.add('visible')
  convertBtn.disabled = false
  fileListEl.innerHTML = pendingFiles
    .map((f, i) => `
      <div class="file-item">
        <span class="file-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="file-name" title="${f.name}">${f.name}</span>
        <span class="file-size">${fmtSize(f.size)}</span>
        <button class="file-remove" data-i="${i}" title="移除">×</button>
      </div>`)
    .join('')

  fileListEl.querySelectorAll<HTMLButtonElement>('.file-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      pendingFiles.splice(Number(btn.dataset.i), 1)
      renderFileList()
    })
  })
}

clearBtn.addEventListener('click', reset)

function reset(): void {
  // revoke old object URLs
  outputFiles.forEach(f => URL.revokeObjectURL(f.url))
  pendingFiles = []
  outputFiles  = []
  renderFileList()
  logPanel.classList.remove('visible')
  resultsEl.classList.remove('visible')
  progressWrap.classList.remove('visible')
  logPanel.innerHTML   = ''
  resultItems.innerHTML = ''
}

/* ─────────────────────────────────────────
   Convert
───────────────────────────────────────── */
convertBtn.addEventListener('click', async () => {
  if (!pendingFiles.length) return

  // cleanup previous run
  outputFiles.forEach(f => URL.revokeObjectURL(f.url))
  outputFiles = []
  resultItems.innerHTML = ''
  logPanel.innerHTML    = ''
  logPanel.classList.add('visible')
  resultsEl.classList.remove('visible')
  progressWrap.classList.add('visible')
  convertBtn.disabled = true

  for (let i = 0; i < pendingFiles.length; i++) {
    const file = pendingFiles[i]
    setProgress(Math.round((i / pendingFiles.length) * 100), `处理 ${i + 1}/${pendingFiles.length}: ${file.name}`)
    log(`◆ 读取: ${file.name}`, 'info')

    try {
      const buf = await file.arrayBuffer()
      const result: ScelResult = parseScel(buf)

      log(`  词库名:  ${result.meta.name || '(无)'}`, 'ok')
      log(`  词库类型: ${result.meta.type || '(无)'}`, 'ok')
      log(`  词条数:  ${result.words.length}`, 'ok')

      const text    = wordsToText(result.words)
      const blob    = new Blob([text], { type: 'text/plain;charset=utf-8' })
      const url     = URL.createObjectURL(blob)
      const outName = file.name.replace(/\.scel$/i, '.txt')
      const entry: OutputFile = { name: outName, blob, count: result.words.length, url }

      outputFiles.push(entry)
      appendResult(entry, outputFiles.length)
    } catch (err) {
      log(`  ✗ 解析失败: ${(err as Error).message}`, 'err')
    }

    // yield to browser render loop
    await new Promise<void>(r => setTimeout(r, 0))
  }

  setProgress(100, '完成')
  log('─'.repeat(40), 'info')
  log(`✓ 全部完成，共 ${outputFiles.length} 个文件`, 'ok')

  if (outputFiles.length) resultsEl.classList.add('visible')
  convertBtn.disabled = false
})

/* ─────────────────────────────────────────
   Download
───────────────────────────────────────── */
dlAllBtn.addEventListener('click', () => {
  outputFiles.forEach(f => triggerDownload(f.url, f.name))
})

function appendResult(f: OutputFile, idx: number): void {
  const item = document.createElement('div')
  item.className = 'result-item'
  item.style.animationDelay = `${idx * 0.05}s`
  item.innerHTML = `
    <span class="result-name">${f.name}</span>
    <span class="result-meta">${f.count.toLocaleString()} 词条 · ${fmtSize(f.blob.size)}</span>
    <a class="btn-dl" href="${f.url}" download="${f.name}">↓ 下载</a>
  `
  resultItems.appendChild(item)
}

function triggerDownload(url: string, name: string): void {
  const a = document.createElement('a')
  a.href     = url
  a.download = name
  a.click()
}

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function setProgress(pct: number, label: string): void {
  progressFill.style.width  = `${pct}%`
  progressPct.textContent   = `${pct}%`
  progressText.textContent  = label
}

function log(msg: string, type: 'ok' | 'err' | 'info' | '' = ''): void {
  const line = document.createElement('div')
  line.className = `log-line${type ? ' ' + type : ''}`
  line.textContent = msg
  logPanel.appendChild(line)
  logPanel.scrollTop = logPanel.scrollHeight
}

function fmtSize(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}
