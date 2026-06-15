import fs from 'node:fs/promises'

// Извлечение текста из PDF постранично, со склейкой строк по Y-координате
export async function extractPdfText(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const data = new Uint8Array(await fs.readFile(filePath))
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, isEvalSupported: false }).promise

  let text = ''
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const lineMap = new Map()
    for (const item of content.items) {
      if (!item.str || !item.transform) continue
      const y = Math.round(item.transform[5] / 3) * 3
      if (!lineMap.has(y)) lineMap.set(y, [])
      lineMap.get(y).push({ x: item.transform[4], str: item.str })
    }
    const sortedLines = [...lineMap.entries()].sort((a, b) => b[0] - a[0])
    for (const [, items] of sortedLines) {
      text += items.sort((a, b) => a.x - b.x).map((i) => i.str).join(' ') + '\n'
    }
  }
  await doc.destroy()
  return text
}

const NUM_RE = /\d[\d\s ]*,\d{2}/g

function toNum(value) {
  return Math.round(parseFloat(String(value).replace(/[\s ]/g, '').replace(',', '.')))
}

const WORKS_SECTION_RE = /проект|монтаж|сборк|наладк|настройк|работ|программ|установк/i

// Разбор текста сметы 1С: разделы с итогами «материалы / работы / итого»
export function parseSmetaText(text) {
  const head = text.slice(0, 1000)
  let techId = 'knx'
  if (/wiren|\bWB\b|вирен/i.test(head)) techId = 'wiren-board'
  else if (/zigbee|зигб/i.test(head)) techId = 'zigbee'

  const titleMatch = text.match(/^\s*Смета\s+([^\n]{2,90})$/m)
  const title = titleMatch ? titleMatch[1].replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').trim() : ''

  const sectionRe = /Раздел\s*№?\s*(\d+)\s*\.?\s*([^\n]+)/g
  const headers = []
  let match
  while ((match = sectionRe.exec(text))) {
    headers.push({ index: match.index, name: match[2].trim() })
  }

  const sections = []
  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].index
    const end = i + 1 < headers.length ? headers[i + 1].index : text.length
    const block = text.slice(start, end)

    let nums = null
    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim()
      if (/^Итого(?![а-яё])/i.test(line) && !/по смете/i.test(line)) {
        const found = (line.match(NUM_RE) || []).map(toNum)
        if (found.length >= 2) nums = found
      }
    }
    if (!nums) continue

    let materials = 0
    let works = 0
    let transport = 0
    const total = nums[nums.length - 1]
    if (nums.length >= 4) {
      materials = nums[0]; works = nums[1]; transport = nums[2]
    } else if (nums.length === 3) {
      materials = nums[0]; works = nums[1]
    } else {
      if (WORKS_SECTION_RE.test(headers[i].name)) works = nums[0]
      else materials = nums[0]
    }
    sections.push({ name: headers[i].name, materials, works, transport, total })
  }

  // «Итого по смете»: числа могут стоять в той же строке, строкой ниже или выше
  let totals = null
  const allLines = text.split('\n')
  const grandIdx = allLines.findIndex((line) => /Итого по смете/i.test(line))
  if (grandIdx >= 0) {
    for (const candidate of [allLines[grandIdx], allLines[grandIdx + 1], allLines[grandIdx - 1]]) {
      const nums = ((candidate || '').match(NUM_RE) || []).map(toNum)
      if (nums.length >= 4) { totals = { materials: nums[0], works: nums[1], transport: nums[2], total: nums[3] }; break }
      if (nums.length === 3) { totals = { materials: nums[0], works: nums[1], transport: 0, total: nums[2] }; break }
      if (nums.length === 2) { totals = { materials: nums[0], works: nums[1], transport: 0, total: nums[0] + nums[1] }; break }
    }
  }
  if (!totals) {
    totals = sections.reduce(
      (acc, s) => ({
        materials: acc.materials + s.materials,
        works: acc.works + s.works,
        transport: acc.transport + s.transport,
        total: acc.total + s.total,
      }),
      { materials: 0, works: 0, transport: 0, total: 0 },
    )
  }

  return { techId, title, sections, totals }
}

export async function importSmetaFromPdf(filePath) {
  const text = await extractPdfText(filePath)
  return parseSmetaText(text)
}
