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

function getValue(record, keys, fallback = '') {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
      return record[key]
    }
  }

  return fallback
}

function slugify(value, fallback) {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

function createAuthHeader(settings) {
  if (!settings.username) {
    return {}
  }

  const token = Buffer.from(`${settings.username}:${settings.password}`).toString(
    'base64',
  )

  return {
    Authorization: `Basic ${token}`,
  }
}

function sanitizeBaseUrl(baseUrl) {
  const trimmed = normalizeString(baseUrl)
  if (!trimmed) {
    return ''
  }

  return trimmed.replace(/\/+$/, '')
}

function buildODataRootCandidates(baseUrl) {
  const sanitized = sanitizeBaseUrl(baseUrl)
  if (!sanitized) {
    return []
  }

  const withoutLocale = sanitized.replace(/\/[a-z]{2}_[A-Z]{2}$/i, '')
  const roots = [
    sanitized,
    `${sanitized}/odata/standard.odata/`,
    `${withoutLocale}/odata/standard.odata/`,
    `${withoutLocale}/odata/standard.odata`,
  ]

  const normalized = roots.map((item) =>
    item.includes('/odata/')
      ? item.replace(/(?<!:)\/{2,}/g, '/').replace('https:/', 'https://').replace('http:/', 'http://')
      : item,
  )

  return Array.from(new Set(normalized.map((item) => (item.endsWith('/') ? item : `${item}/`))))
}

async function requestJson(url, settings) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...createAuthHeader(settings),
      },
    })

    if (!response.ok) {
      throw buildHttpError(response.status, response.statusText, url)
    }

    return response.json()
  } catch (error) {
    throw normalizeRequestError(error, url)
  }
}

async function requestText(url, settings) {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/xml,text/xml,*/*',
        ...createAuthHeader(settings),
      },
    })

    if (!response.ok) {
      throw buildHttpError(response.status, response.statusText, url)
    }

    return response.text()
  } catch (error) {
    throw normalizeRequestError(error, url)
  }
}

function buildHttpError(status, statusText, url) {
  if (status === 401) {
    return new Error(`Неверный логин или пароль 1С. Проверялся адрес: ${url}`)
  }

  if (status === 403) {
    return new Error(`У вашей учетной записи нет доступа к OData 1С. Проверялся адрес: ${url}`)
  }

  if (status === 404) {
    return new Error(`API не найдено по адресу: ${url}`)
  }

  if (status === 402) {
    return new Error(
      `1С:Фреш ответила "402 Payment Required". Обычно это означает, что доступ к OData для этой базы или пользователя недоступен/ограничен. Проверялся адрес: ${url}`,
    )
  }

  return new Error(`1С вернула ошибку ${status} ${statusText}. Адрес: ${url}`)
}

function normalizeRequestError(error, url) {
  if (error instanceof Error) {
    if (error.message.includes('fetch failed')) {
      return new Error(`Не удалось связаться с сервером 1С. Проверялся адрес: ${url}`)
    }

    return error
  }

  return new Error(`Не удалось выполнить запрос к 1С. Адрес: ${url}`)
}

function parseEntitySets(metadataXml) {
  const matches = metadataXml.matchAll(/EntitySet Name="([^"]+)"/g)
  return Array.from(matches, (match) => match[1]).sort((a, b) =>
    a.localeCompare(b),
  )
}

function scoreEntitySet(entitySet, patterns) {
  const name = entitySet.toLowerCase()
  return patterns.reduce((score, pattern, index) => {
    return name.includes(pattern) ? score + patterns.length - index : score
  }, 0)
}

function guessEntitySet(entitySets, patterns) {
  let best = ''
  let bestScore = 0

  for (const entitySet of entitySets) {
    const score = scoreEntitySet(entitySet, patterns)
    if (score > bestScore) {
      best = entitySet
      bestScore = score
    }
  }

  return best
}

function buildEntityUrl(odataRoot, entitySet) {
  const url = new URL(odataRoot)
  const basePath = url.pathname.replace(/\/$/, '')
  url.pathname = `${basePath}/${encodeURIComponent(entitySet)}`
  url.searchParams.set('$format', 'json')
  url.searchParams.set('$top', '500')
  return url.toString()
}

function extractArray(payload) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload?.value)) {
    return payload.value
  }

  if (Array.isArray(payload?.projects)) {
    return payload.projects
  }

  if (Array.isArray(payload?.data)) {
    return payload.data
  }

  return []
}

function mapRooms(projectRecord, projectId) {
  const rooms = Array.isArray(projectRecord.rooms)
    ? projectRecord.rooms
    : Array.isArray(projectRecord.Rooms)
      ? projectRecord.Rooms
      : []

  return rooms.map((room, index) => ({
    areaM2: normalizeNumber(getValue(room, ['areaM2', 'Площадь', 'Area'])),
    id:
      normalizeString(getValue(room, ['id', 'roomId', 'Ref_Key', 'Ссылка'])) ||
      `${projectId}-room-${index + 1}`,
    name:
      normalizeString(getValue(room, ['name', 'Description', 'Наименование'])) ||
      `Помещение ${index + 1}`,
  }))
}

function mapRequirement(item, projectId, index) {
  const name = normalizeString(
    getValue(item, [
      'name',
      'requirementName',
      'itemName',
      'Номенклатура',
      'Description',
      'Наименование',
    ]),
  )

  return {
    code:
      normalizeString(
        getValue(item, ['code', 'requirementCode', 'sku', 'Артикул', 'Ref_Key']),
      ) || `${projectId}-requirement-${index + 1}`,
    complexity: normalizeNumber(
      getValue(item, ['complexity', 'Сложность', 'Complexity']),
      1,
    ),
    name,
    quantity: normalizeNumber(
      getValue(item, ['quantity', 'qty', 'Количество', 'Count']),
      0,
    ),
    source1cSku: normalizeString(
      getValue(item, ['source1cSku', 'sku', 'Артикул', 'Code']),
    ),
    unitLabel: normalizeString(
      getValue(item, ['unitLabel', 'unit', 'Единица', 'MeasureUnit']),
      'шт',
    ),
    zone: normalizeString(
      getValue(item, ['zone', 'section', 'Раздел', 'Group']),
      'Общее',
    ),
  }
}

function mapProject(projectRecord, requirementRows) {
  const projectId = normalizeString(
    getValue(projectRecord, ['id', 'projectId', 'Ref_Key', 'Ссылка', 'Код', 'code']),
  )
  const projectName = normalizeString(
    getValue(projectRecord, ['name', 'projectName', 'Description', 'Наименование']),
  )
  const effectiveProjectId =
    projectId || slugify(projectName, `project-${Math.random().toString(36).slice(2, 8)}`)
  const embeddedRequirements = Array.isArray(projectRecord.requirements)
    ? projectRecord.requirements
    : []

  const requirementsSource =
    requirementRows.length > 0
      ? requirementRows.filter((item) => {
          const ownerId = normalizeString(
            getValue(item, ['projectId', 'ownerId', 'Owner_Key', 'Проект', 'ПроектId']),
          )

          return ownerId === effectiveProjectId || ownerId === projectName
        })
      : embeddedRequirements

  return {
    areaM2: normalizeNumber(getValue(projectRecord, ['areaM2', 'Площадь', 'square', 'Area'])),
    clientName: normalizeString(
      getValue(projectRecord, ['clientName', 'client', 'Customer', 'Заказчик']),
      'Не указан',
    ),
    id: effectiveProjectId,
    name: projectName || effectiveProjectId,
    objectType: normalizeString(
      getValue(projectRecord, ['objectType', 'ТипОбъекта', 'ObjectType']),
      'Объект',
    ),
    requirements: requirementsSource
      .map((item, index) => mapRequirement(item, effectiveProjectId, index))
      .filter((item) => item.quantity > 0 && item.name),
    rooms: mapRooms(projectRecord, effectiveProjectId),
  }
}

async function discoverWorkingODataRoot(settings) {
  const candidates = buildODataRootCandidates(settings.baseUrl)
  const triedRoots = []
  let lastError = null

  for (const candidate of candidates) {
    triedRoots.push(candidate)
    const metadataUrl = new URL('$metadata', candidate).toString()

    try {
      const metadataXml = await requestText(metadataUrl, settings)
      const entitySets = parseEntitySets(metadataXml)

      if (entitySets.length === 0) {
        lastError = new Error(`По адресу ${candidate} metadata получено, но сущности не найдены.`)
        continue
      }

      const guessedProjectsEntitySet =
        guessEntitySet(entitySets, [
          'проект',
          'project',
          'объектстроительства',
          'object',
          'заказклиента',
          'order',
        ]) || entitySets[0]

      const guessedRequirementsEntitySet =
        guessEntitySet(entitySets, [
          'номенклатур',
          'nomencl',
          'equipment',
          'товар',
          'product',
          'материал',
          'catalog_номенклатура',
        ]) || entitySets[0]

      return {
        entitySets,
        guessedProjectsEntitySet,
        guessedRequirementsEntitySet,
        odataRoot: candidate,
        triedRoots,
      }
    } catch (error) {
      lastError = error
    }
  }

  throw lastError ?? new Error('Не удалось подобрать рабочий OData-адрес.')
}

export async function testConnection(settings) {
  if (!settings.baseUrl) {
    throw new Error('Введите ссылку на базу 1С.')
  }

  if (!settings.username || !settings.password) {
    throw new Error('Введите логин и пароль от 1С.')
  }

  return discoverWorkingODataRoot(settings)
}

export async function loadProjectsFromApi(settings) {
  const connection = await testConnection(settings)
  const projectsEntitySet =
    normalizeString(settings.projectsEntitySet) || connection.guessedProjectsEntitySet
  const requirementsEntitySet =
    normalizeString(settings.requirementsEntitySet) || connection.guessedRequirementsEntitySet

  if (!projectsEntitySet) {
    throw new Error('Не удалось определить сущность проектов в OData.')
  }

  if (!requirementsEntitySet) {
    throw new Error('Не удалось определить сущность номенклатуры в OData.')
  }

  const [projectsPayload, requirementsPayload] = await Promise.all([
    requestJson(buildEntityUrl(connection.odataRoot, projectsEntitySet), settings),
    requestJson(buildEntityUrl(connection.odataRoot, requirementsEntitySet), settings),
  ])

  const projectRows = extractArray(projectsPayload)
  const requirementRows = extractArray(requirementsPayload)
  const projects = projectRows
    .map((item) => mapProject(item, requirementRows))
    .filter((item) => item.name)

  if (projects.length === 0) {
    throw new Error(
      `Не получилось собрать проекты из сущности ${projectsEntitySet}. Возможно, в вашей базе проекты лежат в другой сущности.`,
    )
  }

  return projects
}
