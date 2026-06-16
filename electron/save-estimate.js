import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import pkg from 'electron'
const { BrowserWindow, shell } = pkg
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const templateDirectory = path.join(__dirname, 'template-assets', 'premium-knx')
const pageSizePt = 595.2
const templatePixelSize = 1600
const scale = pageSizePt / templatePixelSize

const profileLabels = {
  balanced: 'Сбалансированный',
  essential: 'Базовый',
  premium: 'Премиум',
}

function px(value) {
  return `${value * scale}pt`
}

// Формат как в шаблоне: «₽ 933 149»
function formatMoney(value) {
  return `₽ ${Math.round(value).toLocaleString('ru-RU')}`
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function imageUrl(pageNumber) {
  return pathToFileURL(
    path.join(templateDirectory, `page${String(pageNumber).padStart(2, '0')}.png`),
  ).href
}

function fileImageUrl(filePath) {
  if (!filePath) {
    return ''
  }
  return pathToFileURL(filePath).href
}

function sumByCategory(lines, category) {
  return lines
    .filter((line) => line.category === category)
    .reduce((sum, line) => sum + line.total, 0)
}

function sumLines(lines, predicate, category) {
  return lines
    .filter((line) => (!category || line.category === category) && predicate(line))
    .reduce((sum, line) => sum + line.total, 0)
}

function countRequirement(project, code) {
  return project.requirements
    .filter((requirement) => requirement.code === code)
    .reduce((sum, requirement) => sum + requirement.quantity, 0)
}

function includesAny(value, keywords) {
  const source = String(value).toLowerCase()
  return keywords.some((keyword) => source.includes(keyword))
}

function countRequirementsByKeywords(project, keywords) {
  return project.requirements
    .filter((requirement) =>
      includesAny(
        `${requirement.code} ${requirement.name} ${requirement.zone} ${requirement.source1cSku}`,
        keywords,
      ),
    )
    .reduce((sum, requirement) => sum + requirement.quantity, 0)
}

function sumRequirementMaterialsByKeywords(scenario, keywords) {
  return sumLines(
    scenario.lines,
    (line) =>
      line.category === 'materials' &&
      includesAny(`${line.code} ${line.title} ${line.note}`, keywords),
    'materials',
  )
}

function sumWorksByCodes(scenario, codePrefixes) {
  return sumLines(
    scenario.lines,
    (line) =>
      line.category === 'works' &&
      codePrefixes.some((prefix) => line.code.includes(prefix)),
    'works',
  )
}

function createSectionMetrics(project, scenario) {
  const materialsTotal = sumByCategory(scenario.lines, 'materials')
  const worksTotal = sumByCategory(scenario.lines, 'works')

  const lightGroups = countRequirement(project, 'light-groups') + countRequirement(project, 'dali')
  const motionSensors = countRequirement(project, 'motion')
  const curtains = countRequirement(project, 'curtains')
  const climateZones = countRequirement(project, 'climate')
  const warmFloorLoops = countRequirement(project, 'warm-floor')
  const leakPoints = countRequirement(project, 'leak')
  const scenes = countRequirement(project, 'scenes')
  const cameraCount = countRequirementsByKeywords(project, ['виде', 'camera', 'камер'])
  const multimediaCount = countRequirementsByKeywords(project, [
    'мультим',
    'audio',
    'video',
    'tv',
    'акуст',
    'колон',
    'меди',
  ])
  const intercomCount = countRequirementsByKeywords(project, [
    'домоф',
    'замок',
    'door',
    'access',
    'вызыв',
  ])
  const voiceAssistantCount = countRequirementsByKeywords(project, [
    'alice',
    'alexa',
    'siri',
    'voice',
    'голос',
    'ассист',
    'яндекс',
  ])

  const controllerMaterials = sumLines(
    scenario.lines,
    (line) => includesAny(line.title, ['базовый комплект']) || line.code.endsWith('-controller'),
    'materials',
  )
  const designWorks = sumLines(scenario.lines, (line) => /-1\./.test(line.code), 'works')
  const lightingMaterials = sumLines(
    scenario.lines,
    (line) => includesAny(line.code, ['light-groups', 'dali']) || includesAny(line.title, ['освещ', 'свет', 'dali']),
    'materials',
  )
  const lightingWorks = sumLines(
    scenario.lines,
    (line) => includesAny(`${line.title} ${line.note}`, ['освещ', 'свет']),
    'works',
  )
  const curtainMaterials = sumLines(
    scenario.lines,
    (line) => includesAny(line.code, ['curtains']),
    'materials',
  )
  const curtainWorks = sumLines(
    scenario.lines,
    (line) => includesAny(`${line.title} ${line.note}`, ['штор']),
    'works',
  )
  const climateMaterials = sumLines(
    scenario.lines,
    (line) => includesAny(line.code, ['climate']),
    'materials',
  )
  const climateWorks = sumLines(
    scenario.lines,
    (line) => includesAny(`${line.title} ${line.note}`, ['климат']),
    'works',
  )
  const floorMaterials = sumLines(
    scenario.lines,
    (line) => includesAny(line.code, ['warm-floor']),
    'materials',
  )
  const floorWorks = sumLines(
    scenario.lines,
    (line) => includesAny(`${line.title} ${line.note}`, ['тепл', 'термостат']),
    'works',
  )
  const safetyMaterials = sumLines(
    scenario.lines,
    (line) => includesAny(line.code, ['leak', 'motion']),
    'materials',
  )
  const safetyWorks = sumLines(
    scenario.lines,
    (line) => includesAny(`${line.title} ${line.note}`, ['протеч', 'безопас', 'уведомлен', 'датчик']),
    'works',
  )
  const serverWorksBase = sumLines(
    scenario.lines,
    (line) => includesAny(`${line.title} ${line.note}`, ['сервер', 'резерв', 'приложени', 'пусконалад']),
    'works',
  )
  const multimediaMaterials = sumRequirementMaterialsByKeywords(scenario, [
    'мультим',
    'audio',
    'video',
    'tv',
    'акуст',
    'колон',
    'меди',
  ])
  const multimediaWorks = sumWorksByCodes(scenario, ['5.1.6', '2.1.2'])
  const cameraMaterials = sumRequirementMaterialsByKeywords(scenario, ['виде', 'camera', 'камер'])
  const cameraWorks = Math.round(cameraMaterials * 0.08)
  const intercomMaterials = sumRequirementMaterialsByKeywords(scenario, [
    'домоф',
    'замок',
    'door',
    'access',
    'вызыв',
  ])
  const intercomWorks = Math.round(intercomMaterials * 0.07)
  const voiceMaterials = sumRequirementMaterialsByKeywords(scenario, [
    'alice',
    'alexa',
    'siri',
    'voice',
    'голос',
    'ассист',
    'яндекс',
  ])
  const voiceWorks = Math.round(voiceMaterials * 0.06)
  const interfaceWorks = sumWorksByCodes(scenario, ['2.1.2', '5.1.5', '6.1.4', '8.1.5', '9.1.3', '10.1.6'])
  const interfaceInclude =
    interfaceWorks > 0 ||
    lightGroups > 0 ||
    curtains > 0 ||
    climateZones > 0 ||
    warmFloorLoops > 0 ||
    leakPoints > 0

  const outdoorLightGroups = lightGroups > 0 ? Math.max(1, Math.round(lightGroups * 0.25)) : 0
  const indoorLightGroups = Math.max(0, lightGroups - outdoorLightGroups)

  const sections = {
    page03: {
      include: designWorks > 0,
      materials: 0,
      works: designWorks,
    },
    page04: {
      include: outdoorLightGroups > 0 || motionSensors > 0 || lightingMaterials > 0 || lightingWorks > 0,
      leftCount: outdoorLightGroups,
      materials: lightingMaterials * 0.2,
      rightCount: motionSensors,
      works: lightingWorks * 0.22,
    },
    page05: {
      include: lightGroups > 0 || motionSensors > 0 || lightingMaterials > 0 || lightingWorks > 0,
      leftCount: indoorLightGroups || lightGroups,
      materials: lightingMaterials * 0.8,
      rightCount: motionSensors,
      works: lightingWorks * 0.78,
    },
    page06: {
      count: curtains,
      include: curtains > 0 || curtainMaterials > 0 || curtainWorks > 0,
      materials: curtainMaterials,
      works: curtainWorks,
    },
    page07: {
      include: warmFloorLoops > 0 || floorMaterials > 0 || floorWorks > 0,
      leftCount: Math.max(warmFloorLoops, climateZones || warmFloorLoops),
      middleCount: Math.max(1, Math.ceil(Math.max(warmFloorLoops, 1) / 3)),
      materials: floorMaterials,
      rightCount: Math.max(climateZones, warmFloorLoops),
      works: floorWorks,
    },
    page08: {
      include: climateZones > 0 || climateMaterials > 0 || climateWorks > 0,
      leftCount: Math.max(0, climateZones),
      materials: climateMaterials,
      rightCount: Math.max(1, climateZones || 1),
      works: climateWorks,
    },
    page09: {
      firstCount: leakPoints > 0 ? 1 : 0,
      fourthCount: Math.max(1, Math.ceil(project.rooms.length / 4)),
      include: leakPoints > 0 || motionSensors > 0 || safetyMaterials > 0 || safetyWorks > 0,
      materials: safetyMaterials,
      secondCount: leakPoints,
      thirdCount: Math.max(2, Math.ceil(project.areaM2 / 90)),
      works: safetyWorks,
    },
    page10: {
      count: multimediaCount,
      include: multimediaCount > 0 || multimediaMaterials > 0,
      materials: multimediaMaterials,
      works: multimediaWorks,
    },
    page11: {
      count: cameraCount,
      include: cameraCount > 0 || cameraMaterials > 0,
      materials: cameraMaterials,
      works: cameraWorks,
    },
    page12: {
      count: intercomCount,
      include: intercomCount > 0 || intercomMaterials > 0,
      materials: intercomMaterials,
      works: intercomWorks,
    },
    page13: {
      count: 1,
      include: controllerMaterials > 0 || serverWorksBase > 0,
      materials: controllerMaterials,
      works: serverWorksBase,
    },
    page14: {
      count: Math.max(1, Math.ceil(project.rooms.length / 5)),
      include: interfaceInclude,
      materials: 0,
      works: interfaceWorks,
    },
    page15: {
      count: voiceAssistantCount,
      include: voiceAssistantCount > 0 || voiceMaterials > 0,
      materials: voiceMaterials,
      works: voiceWorks,
    },
  }

  const allocatedMaterials = [
    sections.page04.materials,
    sections.page05.materials,
    sections.page06.materials,
    sections.page07.materials,
    sections.page08.materials,
    sections.page09.materials,
    sections.page10.materials,
    sections.page11.materials,
    sections.page12.materials,
    sections.page13.materials,
  ].reduce((sum, value) => sum + value, 0)
  const allocatedWorks = [
    designWorks,
    sections.page04.works,
    sections.page05.works,
    sections.page06.works,
    sections.page07.works,
    sections.page08.works,
    sections.page09.works,
    sections.page10.works,
    sections.page11.works,
    sections.page12.works,
    sections.page13.works,
    sections.page14.works,
    sections.page15.works,
  ].reduce((sum, value) => sum + value, 0)

  const remainingMaterials = Math.max(0, materialsTotal - allocatedMaterials)
  const remainingWorks = Math.max(0, worksTotal - allocatedWorks)

  sections.page13.materials += Math.max(
    0,
    materialsTotal -
      (sections.page04.materials +
        sections.page05.materials +
        sections.page06.materials +
        sections.page07.materials +
        sections.page08.materials +
        sections.page09.materials +
        sections.page10.materials +
        sections.page11.materials +
        sections.page12.materials +
        sections.page15.materials +
        controllerMaterials),
  )
  sections.page13.works += Math.max(
    0,
    worksTotal -
      (sections.page03.works +
        sections.page04.works +
        sections.page05.works +
        sections.page06.works +
        sections.page07.works +
        sections.page08.works +
        sections.page09.works +
        sections.page10.works +
        sections.page11.works +
        sections.page12.works +
        sections.page14.works +
        sections.page15.works +
        serverWorksBase),
  )

  if (sections.page10.include) {
    sections.page10.count = Math.max(1, Math.ceil(Math.max(scenes, multimediaCount) / 2))
  }

  if (sections.page12.include) {
    sections.page12.count = Math.max(1, intercomCount)
  }

  if (sections.page15.include) {
    sections.page15.count = Math.max(1, voiceAssistantCount)
  }

  return sections
}

function overlayRect({ x, y, width, height, background, radius = 10, border = '' }) {
  return `<div class="rect" style="left:${px(x)};top:${px(y)};width:${px(width)};height:${px(height)};background:${background};border-radius:${px(radius)};border:${border}"></div>`
}

function overlayText({ x, y, width, text, size = 54, color = '#f05b32', weight = 700, align = 'left', lineHeight = 1.05, nowrap = false }) {
  const wrap = nowrap ? 'white-space:nowrap;overflow:hidden;' : 'white-space:pre-wrap;'
  return `<div class="text" style="left:${px(x)};top:${px(y)};width:${px(width)};font-size:${px(size)};color:${color};font-weight:${weight};text-align:${align};line-height:${lineHeight};${wrap}">${escapeHtml(text)}</div>`
}

function coverOverlay(project, scenario, profile, settings, objectDescription, objectLead) {
  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + (settings.proposalValidityDays || 7))
  const validity = validUntil.toLocaleDateString('ru-RU')
  const managerPhoto = fileImageUrl(settings.managerPhotoPath)

  // Карточка «Ключевая технология»: шаблон уже содержит текст и логотип KNX.
  // Для KNX ничего не трогаем; для других технологий закрываем текст (1043-1112)
  // и логотип (696-857, 1008-1104) цветом карточки и пишем свою формулировку.
  const techPhrases = {
    'wiren-board': 'Проводной умный дом\nна базе Wiren Board',
    zigbee: 'Беспроводной умный\nдом на базе Zigbee',
  }
  const techPhrase = techPhrases[scenario.id]
  const techOverlay = techPhrase
    ? [
        overlayRect({ x: 296, y: 1029, width: 396, height: 74, background: 'rgb(60,31,25)', radius: 8 }),
        overlayRect({ x: 686, y: 994, width: 184, height: 118, background: 'rgb(60,31,25)', radius: 8 }),
        overlayText({ x: 304, y: 1033, width: 385, text: techPhrase, size: 28, color: '#ffffff', weight: 700, lineHeight: 1.25 }),
      ].join('')
    : ''

  // Контакты в нижнем блоке: центрируем по вертикали карточки (1374-1570)
  const contactLines = [settings.managerEmail, settings.managerTelegram].filter(Boolean)
  const contactText = contactLines.join('\n')
  const contactY = contactLines.length > 1 ? 1430 : 1452

  // Описание объекта. Без ИИ — короткая строка «Тип — Название».
  // С продающим текстом ИИ — закрываем большую область и пишем 2–3 строки.
  const lead = (objectLead || '').trim()
  const descBlock = lead
    ? [
        overlayRect({ x: 296, y: 858, width: 565, height: 132, background: 'rgb(17,17,19)' }),
        overlayText({ x: 304, y: 862, width: 552, text: lead, size: 23, color: '#ffffff', weight: 600, lineHeight: 1.3 }),
      ].join('')
    : [
        overlayRect({ x: 296, y: 862, width: 560, height: 42, background: 'rgb(17,17,19)' }),
        overlayText({ x: 304, y: 864, width: 545, text: [objectDescription || project.objectType, project.name].filter(Boolean).join(' — '), size: 30, color: '#ffffff', weight: 700, nowrap: true }),
      ].join('')

  return [
    descBlock,
    techOverlay,
    overlayRect({ x: 78, y: 560, width: 720, height: 72, background: 'rgb(17,17,19)', radius: 6 }),
    // Срок действия: закрывает шаблонную дату (y 1250-1285)
    overlayRect({ x: 66, y: 1238, width: 520, height: 62, background: 'rgb(17,17,19)', radius: 10 }),
    // Нижний блок менеджера: фото (шаблонное 60-310 x 1354-1575), имя, контакты, телефон
    overlayRect({ x: 54, y: 1346, width: 264, height: 240, background: 'rgb(17,17,19)', radius: 38 }),
    overlayRect({ x: 318, y: 1350, width: 366, height: 216, background: 'rgb(21,21,23)' }),
    overlayRect({ x: 688, y: 1374, width: 446, height: 196, background: 'rgb(28,27,32)', radius: 26 }),
    overlayRect({ x: 1148, y: 1374, width: 436, height: 196, background: 'rgb(28,28,30)', radius: 26 }),
    managerPhoto ? `<img class="manager-photo cover-photo" src="${managerPhoto}" alt="" />` : '',
    overlayText({ x: 90, y: 570, width: 680, text: project.name, size: 33, color: '#ffffff', weight: 500 }),
    overlayText({ x: 82, y: 1252, width: 480, text: `КП действительно до ${validity}`, size: 26, color: '#ffffff', weight: 500 }),
    overlayText({ x: 332, y: 1376, width: 340, text: settings.managerTitle || 'Менеджер по работе с клиентами', size: 20, color: '#9f9fa5', weight: 500, lineHeight: 1.3 }),
    overlayText({ x: 332, y: 1462, width: 345, text: settings.managerName || 'Имя Фамилия', size: 28, color: '#ffffff', weight: 700, lineHeight: 1.15 }),
    overlayText({ x: 700, y: contactY, width: 422, text: contactText, size: 26, color: '#ffffff', weight: 600, align: 'center', lineHeight: 1.5, nowrap: contactLines.length <= 1 }),
    overlayText({ x: 1160, y: 1452, width: 412, text: settings.managerPhone || '', size: 32, color: '#f05b32', weight: 700, align: 'center', nowrap: true }),
  ].join('')
}

// Колонки технологий на стр. 2 (шаблон уже подсвечивает «Премиум»/KNX коричневой
// подложкой, которую нельзя убрать). Невыбранные колонки затемняем вуалью —
// это гасит и шаблонную подсветку, — а выбранную обводим рамкой без подписей.
function technologyPageOverlay(scenario) {
  const columns = {
    zigbee: { x: 64, w: 448 },
    'wiren-board': { x: 574, w: 452 },
    knx: { x: 1064, w: 496 },
  }
  const selectedId = columns[scenario.id] ? scenario.id : 'knx'
  const top = 244
  const height = 1186

  const parts = []
  for (const [id, col] of Object.entries(columns)) {
    if (id !== selectedId) {
      parts.push(overlayRect({ x: col.x, y: top, width: col.w, height, background: 'rgba(10,10,12,0.62)', radius: 24 }))
    }
  }
  const sel = columns[selectedId]
  parts.push(overlayRect({
    x: sel.x - 8, y: top - 8, width: sel.w + 16, height: height + 16,
    background: 'transparent', radius: 30,
    border: `${px(4)} solid rgba(240,91,50,0.85)`,
  }))
  return parts.join('')
}

// Цвета патчей (замерены по карточкам шаблона)
const COUNT_BG = 'rgb(24,23,27)'
const PRICE_BG_LEFT = 'rgb(53,23,18)'
const PRICE_BG_RIGHT = 'rgb(61,31,27)'

// Патчи закрывают только запечённые цифры шаблона; подписи и иконки остаются
function stdPriceOverlay(section, wl = 380, wr = 375) {
  return [
    overlayRect({ x: 202, y: 1441, width: wl, height: 76, background: PRICE_BG_LEFT, radius: 10 }),
    overlayRect({ x: 972, y: 1441, width: wr, height: 76, background: PRICE_BG_RIGHT, radius: 10 }),
    overlayText({ x: 212, y: 1448, width: 560, text: formatMoney(section.materials), size: 50, nowrap: true }),
    overlayText({ x: 982, y: 1448, width: 570, text: formatMoney(section.works), size: 50, nowrap: true }),
  ].join('')
}

function countCell(x, w, y, textY, value, size = 54) {
  return [
    overlayRect({ x, y, width: w, height: 80, background: COUNT_BG, radius: 10 }),
    overlayText({ x: x + 12, y: textY, width: 320, text: String(Math.round(value)), size, color: '#ffffff' }),
  ].join('')
}

function designOverlay(section) {
  return [
    overlayRect({ x: 202, y: 1441, width: 378, height: 76, background: 'rgb(28,27,32)', radius: 10 }),
    overlayText({ x: 212, y: 1448, width: 560, text: formatMoney(section.works), size: 50, nowrap: true }),
  ].join('')
}

function twoCardOverlay(section) {
  return [
    countCell(200, 155, 1211, 1214, section.leftCount),
    countCell(970, 68, 1211, 1214, section.rightCount),
    stdPriceOverlay(section),
  ].join('')
}

function singleCountOverlay(section) {
  return [
    countCell(203, 107, 1211, 1214, section.count),
    stdPriceOverlay(section),
  ].join('')
}

function tripleCountOverlay(section) {
  return [
    countCell(201, 110, 1227, 1230, section.leftCount),
    countCell(714, 64, 1228, 1231, section.middleCount),
    countCell(1228, 110, 1227, 1230, section.rightCount),
    stdPriceOverlay(section),
  ].join('')
}

function fourCountOverlay(section) {
  return [
    countCell(223, 55, 1222, 1232, section.firstCount, 44),
    countCell(637, 81, 1229, 1232, section.secondCount, 44),
    countCell(976, 75, 1229, 1232, section.thirdCount, 44),
    countCell(1315, 55, 1229, 1232, section.fourthCount, 44),
    stdPriceOverlay(section),
  ].join('')
}

function priceOnlyOverlay(section) {
  return stdPriceOverlay(section)
}

function noOverlay() {
  return ''
}

function summaryOverlay(scenario) {
  const materialsTotal = sumByCategory(scenario.lines, 'materials')
  const worksTotal = sumByCategory(scenario.lines, 'works')
  const transportTotal = sumByCategory(scenario.lines, 'transport')

  return [
    overlayRect({ x: 240, y: 378, width: 500, height: 95, background: 'rgb(27,26,31)', radius: 10 }),
    overlayRect({ x: 240, y: 576, width: 500, height: 100, background: 'rgb(27,26,31)', radius: 10 }),
    overlayRect({ x: 240, y: 790, width: 500, height: 95, background: 'rgb(27,26,31)', radius: 10 }),
    overlayRect({ x: 235, y: 970, width: 520, height: 105, background: 'rgb(246,246,246)', radius: 12 }),
    overlayText({ x: 262, y: 398, width: 460, text: formatMoney(materialsTotal), size: 50, color: '#ffffff', nowrap: true }),
    overlayText({ x: 262, y: 598, width: 460, text: formatMoney(worksTotal), size: 50, color: '#ffffff', nowrap: true }),
    overlayText({ x: 262, y: 812, width: 460, text: formatMoney(transportTotal), size: 50, color: '#ffffff', nowrap: true }),
    overlayText({ x: 262, y: 992, width: 460, text: formatMoney(scenario.total), size: 52, color: '#111111', nowrap: true }),
  ].join('')
}

// Страница 18 остаётся как в шаблоне — без наложений
function contactOverlay() {
  return ''
}

function pageOverlayFromConfig(pageCfg, countValues, amountValues) {
  if (!pageCfg || (!pageCfg.countCards?.length && !pageCfg.priceCards?.length)) return ''
  const overrideCounts = pageCfg.overrideCounts || []
  const overrideAmounts = pageCfg.overrideAmounts || []
  const cards = (pageCfg.countCards || []).map((card, i) => {
    const rect = overlayRect({ x: card.rect.x, y: card.rect.y, width: card.rect.width, height: card.rect.height, background: card.color || 'rgb(29,29,35)', radius: card.rect.radius ?? 12 })
    // Значение берём из оверрайда либо из данных страницы. Если данных нет
    // (undefined/null) — только закрываем шаблонную цифру, своё число НЕ рисуем,
    // чтобы не показывать клиенту выдуманные значения.
    const hasOverride = overrideCounts[i] != null && overrideCounts[i] !== ''
    const raw = hasOverride ? overrideCounts[i] : countValues[i]
    if (raw == null || raw === '') return rect
    return rect +
      overlayText({ x: card.textX, y: card.textY, width: card.textWidth, text: String(Math.round(Number(raw))), size: card.size ?? (card.textY < 1210 ? 48 : 56), align: card.align ?? 'left', color: '#ffffff' })
  }).join('')
  const prices = (pageCfg.priceCards || []).map((price, i) => {
    const val = overrideAmounts[i] != null ? overrideAmounts[i] : formatMoney(amountValues[i] ?? 0)
    const color = price.color || 'rgb(76,43,31)'
    return overlayRect({ x: price.rect.x, y: price.rect.y, width: price.rect.width, height: price.rect.height, background: color, radius: price.rect.radius ?? 16 }) +
      overlayText({ x: price.textX, y: price.textY, width: price.textWidth, text: val, size: price.size ?? 42, nowrap: true })
  }).join('')
  return cards + prices
}

function buildHtmlDocument(project, scenario, profile, settings, objectDescription, overlayConfig, proposalPages, objectLead) {
  const sections = createSectionMetrics(project, scenario)
  const proposalPageMap = new Map()
  if (Array.isArray(proposalPages)) {
    for (const page of proposalPages) {
      proposalPageMap.set(page.pageNumber, page)
    }
  }

  const pageOverlays = new Map()
  pageOverlays.set(1, coverOverlay(project, scenario, profile, settings, objectDescription, objectLead))
  pageOverlays.set(2, technologyPageOverlay(scenario))
  pageOverlays.set(16, summaryOverlay(scenario))
  pageOverlays.set(17, '')
  pageOverlays.set(18, contactOverlay())

  const pageCfg = {
    3: { fn: designOverlay, section: sections.page03 },
    4: { fn: twoCardOverlay, section: sections.page04 },
    5: { fn: twoCardOverlay, section: sections.page05 },
    6: { fn: singleCountOverlay, section: sections.page06 },
    7: { fn: tripleCountOverlay, section: sections.page07 },
    8: { fn: twoCardOverlay, section: sections.page08 },
    9: { fn: fourCountOverlay, section: sections.page09 },
    10: { fn: priceOnlyOverlay, section: sections.page10 },
    11: { fn: singleCountOverlay, section: sections.page11 },
    12: { fn: priceOnlyOverlay, section: sections.page12 },
    13: { fn: priceOnlyOverlay, section: sections.page13 },
    14: { fn: noOverlay, section: sections.page14 },
    15: { fn: priceOnlyOverlay, section: sections.page15 },
  }

  for (const [pn, cfg] of Object.entries(pageCfg)) {
    const pageNum = Number(pn)
    const pageConfig = overlayConfig?.pages?.[pageNum]
    const pageSummary = proposalPageMap.get(pageNum)
    if (pageConfig && (pageConfig.countCards?.length || pageConfig.priceCards?.length) && pageSummary) {
      pageOverlays.set(pageNum, pageOverlayFromConfig(pageConfig, pageSummary.countValues || [], pageSummary.amountValues || []))
    } else {
      pageOverlays.set(pageNum, cfg.fn(cfg.section))
    }
  }

  // Обложка (1) и контакты (18) — всегда. Остальные страницы (2,3..17)
  // включаются по флагу пользователя из proposalPages; если флага нет —
  // по наличию данных (для разделов) либо по умолчанию (2,16,17).
  const visiblePages = new Set([1, 18])
  const sectionByPage = {
    3: sections.page03, 4: sections.page04, 5: sections.page05, 6: sections.page06,
    7: sections.page07, 8: sections.page08, 9: sections.page09, 10: sections.page10,
    11: sections.page11, 12: sections.page12, 13: sections.page13, 14: sections.page14,
    15: sections.page15,
  }

  for (let pageNumber = 2; pageNumber <= 17; pageNumber++) {
    const pageSummary = proposalPageMap.get(pageNumber)
    const section = sectionByPage[pageNumber]
    let include
    if (pageSummary) {
      // Пользователь явно управляет видимостью через интерфейс
      include = pageSummary.included !== false
    } else {
      // Нет данных страницы: разделы — по наличию сумм, прочие — по умолчанию да
      include = section ? section.include : true
    }
    if (include) {
      visiblePages.add(pageNumber)
    }
  }

  // Пользовательские тексты с любой страницы (из редактора КП). Рисуются поверх
  // всего: при наличии bg — сначала плашка, перекрывающая шаблонный текст.
  const customTexts = (pageNumber) => {
    const list = overlayConfig?.pages?.[pageNumber]?.texts
    if (!Array.isArray(list) || list.length === 0) return ''
    return list.map((t) => {
      if (!t || !t.rect) return ''
      const bg = t.bg
        ? overlayRect({ x: t.rect.x, y: t.rect.y, width: t.rect.width, height: t.rect.height, background: t.bg, radius: t.rect.radius ?? 0 })
        : ''
      const text = overlayText({
        x: t.rect.x + 6, y: t.rect.y + 6, width: t.rect.width - 12,
        text: t.text ?? '', size: t.size ?? 30, color: t.color ?? '#ffffff',
        weight: t.weight ?? 600, align: t.align ?? 'left', lineHeight: t.lineHeight ?? 1.25,
      })
      return bg + text
    }).join('')
  }

  const pages = Array.from(visiblePages)
    .sort((left, right) => left - right)
    .map(
      (pageNumber) => `
      <section class="page">
        <img class="page-bg" src="${imageUrl(pageNumber)}" alt="" />
        <div class="overlay-layer">${pageOverlays.get(pageNumber) ?? ''}${customTexts(pageNumber)}</div>
      </section>
    `,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(project.name)} - ${escapeHtml(settings.proposalTemplateName)}</title>
  <style>
    @page { size: ${pageSizePt}pt ${pageSizePt}pt; margin: 0; }
    html, body { margin: 0; padding: 0; background: #111; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .page {
      position: relative;
      width: ${pageSizePt}pt;
      height: ${pageSizePt}pt;
      break-after: page;
      overflow: hidden;
    }
    .page:last-child { break-after: auto; }
    .page-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .overlay-layer {
      position: absolute;
      inset: 0;
    }
    .rect {
      position: absolute;
      z-index: 2;
      box-sizing: border-box;
    }
    .text {
      position: absolute;
      z-index: 3;
    }
    .manager-photo {
      position: absolute;
      object-fit: cover;
      z-index: 4;
    }
    .cover-photo {
      left: ${px(58)};
      top: ${px(1350)};
      width: ${px(256)};
      height: ${px(232)};
      border-radius: ${px(36)};
    }
    .contact-photo {
      left: ${px(95)};
      top: ${px(65)};
      width: ${px(340)};
      height: ${px(340)};
      border-radius: 50%;
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`
}

async function waitForPageAssets(previewWindow) {
  const TIMEOUT_MS = 30000

  const loadPromise = previewWindow.webContents.executeJavaScript(`
    new Promise((resolve) => {
      const images = Array.from(document.images);
      if (images.length === 0) {
        resolve();
        return;
      }

      let pending = images.length;
      const finish = () => {
        pending -= 1;
        if (pending <= 0) {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }
      };

      images.forEach((image) => {
        if (image.complete) {
          finish();
          return;
        }

        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', () => { finish(); }, { once: true });
      });
    });
  `)

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`PDF image loading timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
  })

  return Promise.race([loadPromise, timeoutPromise])
}

export async function saveEstimateDocument(payload) {
  const { objectDescription, overlayConfig, project, proposalPages, scenario, settings } = payload

  if (!settings.estimateFolder) {
    throw new Error('Укажите папку для сохранения КП.')
  }

  if (!project || typeof project.name !== 'string' || !Array.isArray(project.requirements)) {
    throw new Error('Некорректные данные проекта.')
  }

  if (!scenario || typeof scenario.title !== 'string' || !Array.isArray(scenario.lines)) {
    throw new Error('Некорректные данные сценария.')
  }

  await fs.mkdir(settings.estimateFolder, { recursive: true })
  const fileName = sanitizeFileName(`КП ${scenario.title} ${project.name}.pdf`)
  const filePath = path.join(settings.estimateFolder, fileName)

  const html = buildHtmlDocument(
    project,
    scenario,
    payload.profile,
    settings,
    objectDescription,
    payload.overlayConfig,
    proposalPages,
    payload.objectLead,
  )

  const tempDir = path.join(os.tmpdir(), '1c-quotation-pdf')
  await fs.mkdir(tempDir, { recursive: true })
  const tempHtmlPath = path.join(tempDir, `proposal-${Date.now()}.html`)
  await fs.writeFile(tempHtmlPath, html, 'utf-8')

  const previewWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
    },
  })

  try {
    await previewWindow.loadFile(tempHtmlPath)
    await waitForPageAssets(previewWindow)
    const pdfBuffer = await previewWindow.webContents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
    })

    await fs.writeFile(filePath, pdfBuffer)
    await shell.openPath(filePath)
  } finally {
    if (!previewWindow.isDestroyed()) {
      previewWindow.destroy()
    }
    try { await fs.unlink(tempHtmlPath) } catch { /* ignore */ }
  }

  return {
    fileName,
    filePath,
  }
}