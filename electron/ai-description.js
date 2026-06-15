import { readSettings } from './config-store.js'

const API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-opus-4-8'

function money(value) {
  return `${Math.round(value || 0).toLocaleString('ru-RU')} ₽`
}

// Краткая сводка проекта/сметы для модели
function buildContext(payload) {
  const { project, scenario, objectKind } = payload
  const lines = []
  lines.push(`Тип объекта: ${objectKind || project?.objectType || 'Дом'}`)
  if (project?.name) lines.push(`Название: ${project.name}`)
  if (project?.areaM2) lines.push(`Площадь: ${project.areaM2} м²`)
  if (Array.isArray(project?.rooms) && project.rooms.length) {
    lines.push(`Помещений: ${project.rooms.length}`)
  }
  if (scenario?.title) lines.push(`Технология: ${scenario.title}`)
  if (scenario?.total) lines.push(`Бюджет проекта: ${money(scenario.total)}`)

  // Состав по разделам (что реально входит в КП)
  const sections = (payload.sections || [])
    .filter((s) => s && (s.materials > 0 || s.works > 0))
    .map((s) => s.name)
  if (sections.length) lines.push(`Системы: ${sections.join(', ')}`)

  // Из требований проекта (ручной режим)
  const reqs = (project?.requirements || [])
    .filter((r) => r.quantity > 0)
    .map((r) => `${r.name} — ${r.quantity}`)
  if (reqs.length) lines.push(`Оборудование: ${reqs.join('; ')}`)

  return lines.join('\n')
}

const SYSTEM = `Ты — копирайтер компании «Емеля умный дом», которая проектирует и монтирует системы умного дома.
Пиши короткий продающий текст-описание объекта для обложки коммерческого предложения.
Требования:
- 1–2 коротких предложения, до 200 символов (текст идёт на обложку, место ограничено);
- живой деловой тон, без канцелярита и без воды;
- подчеркни выгоды для клиента (комфорт, безопасность, экономия, управление со смартфона), опираясь на состав систем;
- не указывай цены и не выдумывай факты, которых нет в данных;
- не используй кавычки-ёлочки вокруг всего текста, эмодзи и markdown;
- верни ТОЛЬКО сам текст описания, без вступлений вроде «Вот описание».`

export async function generateObjectDescription(payload) {
  const settings = await readSettings()
  const apiKey = settings.aiApiKey
  if (!apiKey) {
    throw new Error('Не указан API-ключ Anthropic в профиле менеджера.')
  }

  const context = buildContext(payload)
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Данные объекта:\n${context}\n\nНапиши продающее описание объекта для обложки КП.`,
        },
      ],
    }),
  })

  if (!response.ok) {
    let detail = ''
    try {
      const err = await response.json()
      detail = err?.error?.message || ''
    } catch {
      // ignore
    }
    if (response.status === 401) throw new Error('Неверный API-ключ Anthropic.')
    throw new Error(`Ошибка ИИ (${response.status}): ${detail || 'не удалось получить ответ'}`)
  }

  const data = await response.json()
  const text = (data?.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()

  if (!text) throw new Error('ИИ вернул пустой ответ.')
  return text
}
