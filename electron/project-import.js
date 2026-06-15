import fs from 'node:fs/promises'
import path from 'node:path'
import * as XLSX from 'xlsx'

function normalizeString(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback
  }

  return String(value).trim()
}

function normalizeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const normalized = String(value ?? '')
    .replace(/\s+/g, '')
    .replace(',', '.')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeLookup(value) {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function slugify(value, fallback) {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

function mapRow(row) {
  return {
    areaM2: normalizeNumber(row.areaM2 ?? row.area ?? row.projectAreaM2),
    clientName: normalizeString(row.clientName ?? row.client ?? row.customer, 'Не указан'),
    complexity: normalizeNumber(row.complexity, 1),
    objectType: normalizeString(row.objectType ?? row.object ?? row.objectKind, 'Объект'),
    projectId: normalizeString(row.projectId ?? row.projectCode ?? row.id),
    projectName: normalizeString(row.projectName ?? row.project ?? row.name),
    quantity: normalizeNumber(row.quantity ?? row.qty, 0),
    requirementCode: normalizeString(
      row.requirementCode ?? row.code ?? row.requirementSku,
    ),
    requirementName: normalizeString(
      row.requirementName ?? row.requirement ?? row.itemName,
    ),
    roomAreaM2: normalizeNumber(row.roomAreaM2 ?? row.roomArea),
    roomId: normalizeString(row.roomId ?? row.roomCode),
    roomName: normalizeString(row.roomName ?? row.room),
    source1cSku: normalizeString(row.source1cSku ?? row.sku ?? row.article),
    unitLabel: normalizeString(row.unitLabel ?? row.unit ?? row.uom, 'шт'),
    zone: normalizeString(row.zone ?? row.section ?? row.group, 'Общее'),
  }
}

function buildProjectsFromRows(rows) {
  const projectMap = new Map()

  for (const rawRow of rows) {
    const row = mapRow(rawRow)
    if (!row.projectName) {
      continue
    }

    const projectId = row.projectId || slugify(row.projectName, `project-${projectMap.size + 1}`)
    const project =
      projectMap.get(projectId) ??
      {
        areaM2: row.areaM2,
        clientName: row.clientName,
        id: projectId,
        name: row.projectName,
        objectType: row.objectType,
        requirements: [],
        rooms: [],
      }

    if (!projectMap.has(projectId)) {
      projectMap.set(projectId, project)
    }

    if (row.roomName) {
      const roomId = row.roomId || `${projectId}-room-${slugify(row.roomName, `${project.rooms.length + 1}`)}`
      const hasRoom = project.rooms.some((room) => room.id === roomId)

      if (!hasRoom) {
        project.rooms.push({
          areaM2: row.roomAreaM2,
          id: roomId,
          name: row.roomName,
        })
      }
    }

    if (row.requirementName) {
      const requirementCode =
        row.requirementCode ||
        `${projectId}-requirement-${slugify(row.requirementName, `${project.requirements.length + 1}`)}`
      const existingRequirement = project.requirements.find(
        (requirement) => requirement.code === requirementCode,
      )

      if (existingRequirement) {
        existingRequirement.quantity += row.quantity
      } else {
        project.requirements.push({
          code: requirementCode,
          complexity: row.complexity,
          name: row.requirementName,
          quantity: row.quantity,
          source1cSku: row.source1cSku,
          unitLabel: row.unitLabel,
          zone: row.zone,
        })
      }
    }
  }

  return Array.from(projectMap.values())
}

function validateProject(project) {
  return (
    normalizeString(project.id) &&
    normalizeString(project.name) &&
    Array.isArray(project.rooms) &&
    Array.isArray(project.requirements)
  )
}

async function parseJson(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(content)
  const projects = Array.isArray(parsed) ? parsed : parsed.projects

  if (!Array.isArray(projects) || !projects.every(validateProject)) {
    throw new Error('JSON должен содержать массив projects в формате приложения.')
  }

  return projects
}

function readRowsFromWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath)
  const firstSheetName = workbook.SheetNames[0]

  if (!firstSheetName) {
    throw new Error('В файле нет листов с данными.')
  }

  const worksheet = workbook.Sheets[firstSheetName]
  return XLSX.utils.sheet_to_json(worksheet, {
    defval: '',
  })
}

async function parseWorkbook(filePath) {
  const rows = readRowsFromWorkbook(filePath)
  const projects = buildProjectsFromRows(rows)

  if (projects.length === 0) {
    throw new Error('Не удалось собрать проекты из таблицы. Проверьте названия колонок.')
  }

  return projects
}

function getCatalogText(row, candidates) {
  for (const key of candidates) {
    const value = row[key]
    if (normalizeString(value)) {
      return normalizeString(value)
    }
  }

  return ''
}

function getCatalogNumber(row, candidates) {
  for (const key of candidates) {
    const value = normalizeNumber(row[key], 0)
    if (value > 0) {
      return value
    }
  }

  return 0
}

function buildCatalogIndex(rows) {
  const index = new Map()

  for (const row of rows) {
    const code = getCatalogText(row, ['code', 'Code', 'Код', 'Артикул', 'article', 'sku'])
    const sku = getCatalogText(row, ['sku', 'SKU', 'Артикул', 'article', 'Код', 'code'])
    const name = getCatalogText(row, [
      'name',
      'Name',
      'Наименование',
      'Номенклатура',
      'itemName',
      'requirementName',
    ])
    const price = getCatalogNumber(row, [
      'price',
      'Price',
      'Цена',
      'Стоимость',
      'Цена продажи',
      'Розничная цена',
      'Цена за ед.',
      'Закупочная цена',
    ])

    if (!name && !code && !sku) {
      continue
    }

    const entry = {
      code,
      name,
      price,
      sku,
    }

    for (const key of [code, sku, name]) {
      const normalized = normalizeLookup(key)
      if (normalized && !index.has(normalized)) {
        index.set(normalized, entry)
      }
    }
  }

  return index
}

async function parseCatalog(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.json') {
    const content = await fs.readFile(filePath, 'utf8')
    const parsed = JSON.parse(content)
    const rows = Array.isArray(parsed) ? parsed : parsed.items ?? parsed.rows ?? []
    return buildCatalogIndex(rows)
  }

  if (extension === '.xlsx' || extension === '.xls' || extension === '.csv') {
    return buildCatalogIndex(readRowsFromWorkbook(filePath))
  }

  throw new Error(`Формат ${extension} пока не поддерживается для номенклатуры.`)
}

function enrichProjectsWithCatalog(projects, catalogIndex) {
  if (!catalogIndex || catalogIndex.size === 0) {
    return projects
  }

  return projects.map((project) => ({
    ...project,
    requirements: project.requirements.map((requirement) => {
      const matched =
        catalogIndex.get(normalizeLookup(requirement.source1cSku)) ??
        catalogIndex.get(normalizeLookup(requirement.code)) ??
        catalogIndex.get(normalizeLookup(requirement.name))

      if (!matched) {
        return requirement
      }

      return {
        ...requirement,
        estimatedUnitPrice: matched.price || requirement.estimatedUnitPrice,
        source1cSku: requirement.source1cSku || matched.sku || matched.code,
      }
    }),
  }))
}

async function parseProjectsFile(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  if (extension === '.json') {
    return parseJson(filePath)
  }

  if (extension === '.xlsx' || extension === '.xls' || extension === '.csv') {
    return parseWorkbook(filePath)
  }

  throw new Error(`Формат ${extension} пока не поддерживается.`)
}

export async function importProjectsFromSources(projectsFilePath, nomenclatureFilePath) {
  const fileName = path.basename(projectsFilePath)
  const projects = await parseProjectsFile(projectsFilePath)
  const catalogIndex = nomenclatureFilePath
    ? await parseCatalog(nomenclatureFilePath)
    : new Map()

  return {
    fileName,
    projects: enrichProjectsWithCatalog(projects, catalogIndex),
  }
}
