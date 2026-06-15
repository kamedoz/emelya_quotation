import type { EstimateScenario, Project, ProposalPageSummary, SmetaImportResult } from '../types'

// Сопоставление разделов внешней сметы со страницами шаблона по ключевым словам.
// Порядок важен: первое совпадение выигрывает; «щит/сборка/сервер» — последним,
// он же приёмник для нераспознанных разделов.
const PAGE_KEYWORDS: [number, RegExp][] = [
  [3, /проектир/i],
  [4, /наружн/i],
  [5, /свет|освещ/i],
  [6, /штор|карниз/i],
  [7, /отопл|тепл|тёпл|термо/i],
  [8, /кондиц|климат/i],
  [9, /безопас|протеч|охран|сигнализ/i],
  [10, /мультимед|аудио|акуст|медиа|телевиз/i],
  [11, /видеонабл|камер/i],
  [12, /домоф|замок|скуд|доступ/i],
  [15, /голос|алис|ассистент/i],
  [13, /щит|сборк|сервер|контроллер|интерфейс|наладк|программир/i],
]

const PAGE_TITLES: Record<number, string> = {
  1: 'Обложка',
  2: 'Ключевая технология',
  3: 'Проектирование',
  4: 'Наружное освещение',
  5: 'Свет',
  6: 'Шторы',
  7: 'Отопление',
  8: 'Кондиционирование',
  9: 'Безопасность',
  10: 'Мультимедиа',
  11: 'Видеонаблюдение',
  12: 'Домофон и умный замок',
  13: 'Настройка сервера и интерфейса',
  14: 'Визуальный интерфейс управления',
  15: 'Голосовые помощники',
  16: 'Сводная информация',
  17: 'Преимущества работы с нами',
  18: 'Контакты',
}

const TECH_TITLES: Record<string, string> = {
  knx: 'KNX',
  'wiren-board': 'Wiren Board',
  zigbee: 'Zigbee',
}

function pageForSection(name: string): number {
  for (const [page, re] of PAGE_KEYWORDS) {
    if (re.test(name)) return page
  }
  return 13
}

export function buildImportedProposal(
  smeta: SmetaImportResult,
  projectName: string,
  objectKind: string,
): { scenario: EstimateScenario; proposalPages: ProposalPageSummary[]; project: Project } {
  const lines: EstimateScenario['lines'] = []
  smeta.sections.forEach((section, i) => {
    if (section.materials > 0) {
      lines.push({ category: 'materials', code: `imp-${i}-m`, note: '', quantity: 1, title: section.name, total: section.materials, unitPrice: section.materials })
    }
    if (section.works > 0) {
      lines.push({ category: 'works', code: `imp-${i}-w`, note: '', quantity: 1, title: section.name, total: section.works, unitPrice: section.works })
    }
    if (section.transport > 0) {
      lines.push({ category: 'transport', code: `imp-${i}-t`, note: '', quantity: 1, title: section.name, total: section.transport, unitPrice: section.transport })
    }
  })
  const extraTransport = smeta.totals.transport - lines.filter(l => l.category === 'transport').reduce((s, l) => s + l.total, 0)
  if (extraTransport > 0) {
    lines.push({ category: 'transport', code: 'imp-transport', note: '', quantity: 1, title: 'Транспортные расходы', total: extraTransport, unitPrice: extraTransport })
  }

  const scenario: EstimateScenario = {
    id: smeta.techId,
    title: TECH_TITLES[smeta.techId] ?? 'KNX',
    summary: '',
    reliabilityLabel: '',
    leadTime: '',
    hardwareTotal: smeta.totals.materials,
    installationTotal: smeta.totals.works,
    commissioningTotal: 0,
    worksBreakdownTotal: smeta.totals.works,
    total: smeta.totals.total,
    lines,
  }

  const pageSums = new Map<number, { m: number; w: number; names: string[] }>()
  for (const section of smeta.sections) {
    const page = pageForSection(section.name)
    const current = pageSums.get(page) ?? { m: 0, w: 0, names: [] }
    current.m += section.materials
    current.w += section.works
    current.names.push(section.name)
    pageSums.set(page, current)
  }

  const proposalPages: ProposalPageSummary[] = []
  for (let page = 1; page <= 18; page++) {
    const sums = pageSums.get(page)
    const alwaysIncluded = page <= 2 || page >= 16
    const included = alwaysIncluded || (!!sums && (sums.m > 0 || sums.w > 0))
    proposalPages.push({
      pageNumber: page,
      title: PAGE_TITLES[page],
      description: sums ? sums.names.join(' · ') : '',
      included,
      countValues: [],
      amountValues: !sums ? [] : page === 3 ? [sums.m + sums.w] : [sums.m, sums.w],
    })
  }

  const project: Project = {
    id: `imported-${Date.now()}`,
    name: projectName,
    clientName: '',
    objectType: objectKind,
    areaM2: 0,
    rooms: [],
    requirements: [],
  }

  return { scenario, proposalPages, project }
}
