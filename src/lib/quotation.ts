import { workRates } from '../data/workRates'
import type {
  EstimateLine,
  EstimateScenario,
  Project,
  ProjectEstimate,
  ProjectRequirement,
  SmartHomeProfile,
} from '../types'

interface ScenarioDefinition {
  baseControllerCost: number
  commissioningMultiplier: number
  hardwareMultiplier: number
  id: EstimateScenario['id']
  leadTime: string
  profileBoost: Record<SmartHomeProfile, number>
  reliabilityLabel: string
  summary: string
  title: string
  workComplexityMultiplier: number
}

const requirementBasePrice: Record<string, number> = {
  climate: 18500,
  curtains: 11200,
  dali: 12400,
  leak: 6800,
  'light-groups': 9100,
  motion: 5400,
  scenes: 3900,
  'warm-floor': 8600,
  switches: 4500,
}

const profileWorkRatePosition: Record<SmartHomeProfile, number> = {
  balanced: 0.55,
  essential: 0.2,
  premium: 0.9,
}

const scenarioDefinitions: ScenarioDefinition[] = [
  {
    baseControllerCost: 165000,
    commissioningMultiplier: 0.035,
    hardwareMultiplier: 1,
    id: 'wiren-board',
    leadTime: '7-10 дней',
    profileBoost: { balanced: 1, essential: 0.92, premium: 1.12 },
    reliabilityLabel: 'Проводной / гибкий',
    summary:
      'Хороший баланс цены и гибкости. Подходит для большинства коттеджей и квартир с серверной логикой.',
    title: 'Wiren Board',
    workComplexityMultiplier: 1,
  },
  {
    baseControllerCost: 290000,
    commissioningMultiplier: 0.045,
    hardwareMultiplier: 1.45,
    id: 'knx',
    leadTime: '10-14 дней',
    profileBoost: { balanced: 1, essential: 0.95, premium: 1.15 },
    reliabilityLabel: 'Премиум / стандарт',
    summary:
      'Премиальная проводная система с высокой отказоустойчивостью и понятной архитектурой для крупных объектов.',
    title: 'KNX',
    workComplexityMultiplier: 1.16,
  },
  {
    baseControllerCost: 98000,
    commissioningMultiplier: 0.028,
    hardwareMultiplier: 0.82,
    id: 'zigbee',
    leadTime: '4-6 дней',
    profileBoost: { balanced: 1, essential: 0.9, premium: 1.08 },
    reliabilityLabel: 'Быстрый старт',
    summary:
      'Беспроводной вариант для ускоренного запуска и объектов, где важно минимизировать кабельную часть.',
    title: 'Zigbee',
    workComplexityMultiplier: 0.88,
  },
]

function applyMargin(
  value: number,
  category: string,
  marginPercent: number,
  sectionMargins: Record<string, number>,
): number {
  const margin = sectionMargins[category] ?? marginPercent
  if (margin <= 0) return value
  return Math.round(value * (1 + margin / 100))
}

export function buildEstimate(
  project: Project,
  profile: SmartHomeProfile,
  marginPercent = 0,
  sectionMargins: Record<string, number> = {},
  rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }> = {},
): ProjectEstimate {
  return {
    projectId: project.id,
    scenarios: scenarioDefinitions.map((scenario) =>
      createScenarioEstimate(project, scenario, profile, marginPercent, sectionMargins, rateOverrides),
    ),
  }
}

function createScenarioEstimate(
  project: Project,
  scenario: ScenarioDefinition,
  profile: SmartHomeProfile,
  marginPercent: number,
  sectionMargins: Record<string, number>,
  rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }>,
): EstimateScenario {
  const profileBoost = scenario.profileBoost[profile]
  const hardwareLines = project.requirements.map((requirement) =>
    createRequirementLine(requirement, scenario, profileBoost, marginPercent, sectionMargins),
  )

  const controllerUnitPrice = Math.round(scenario.baseControllerCost * profileBoost)
  const controllerLine: EstimateLine = {
    category: 'materials',
    code: `${scenario.id}-controller`,
    note: 'Контроллер, интерфейсы и шкаф автоматики',
    quantity: 1,
    title: `Базовый комплект ${scenario.title}`,
    total: applyMargin(controllerUnitPrice, 'materials', marginPercent, sectionMargins),
    unitPrice: applyMargin(controllerUnitPrice, 'materials', marginPercent, sectionMargins),
  }

  const hardwareTotal =
    controllerLine.total + hardwareLines.reduce((sum, line) => sum + line.total, 0)

  const workLines = createWorkLines(project, scenario, profile, rateOverrides)
  let worksBreakdownTotal = workLines.reduce((sum, line) => sum + line.total, 0)
  worksBreakdownTotal = applyMargin(worksBreakdownTotal, 'works', marginPercent, sectionMargins)
  const commissioningTotal = Math.round(
    hardwareTotal * scenario.commissioningMultiplier,
  )

  const total = hardwareTotal + worksBreakdownTotal + commissioningTotal

  const lines: EstimateLine[] = [
    controllerLine,
    ...hardwareLines,
    ...workLines.map((line) => ({
      ...line,
      total: applyMargin(line.total, 'works', marginPercent, sectionMargins),
      unitPrice: applyMargin(line.unitPrice, 'works', marginPercent, sectionMargins),
    })),
    {
      category: 'works',
      code: `${scenario.id}-commissioning`,
      note: 'Финальная проверка, пусконаладка и контрольные сценарии',
      quantity: 1,
      title: 'Пусконаладка',
      total: applyMargin(commissioningTotal, 'works', marginPercent, sectionMargins),
      unitPrice: applyMargin(commissioningTotal, 'works', marginPercent, sectionMargins),
    },
  ]

  return {
    commissioningTotal: applyMargin(commissioningTotal, 'works', marginPercent, sectionMargins),
    hardwareTotal,
    id: scenario.id,
    installationTotal: worksBreakdownTotal,
    leadTime: scenario.leadTime,
    lines,
    reliabilityLabel: scenario.reliabilityLabel,
    summary: scenario.summary,
    title: scenario.title,
    total,
    worksBreakdownTotal,
  }
}

function createRequirementLine(
  requirement: ProjectRequirement,
  scenario: ScenarioDefinition,
  profileBoost: number,
  marginPercent = 0,
  sectionMargins: Record<string, number> = {},
): EstimateLine {
  const basePrice =
    requirement.estimatedUnitPrice && requirement.estimatedUnitPrice > 0
      ? requirement.estimatedUnitPrice
      : requirementBasePrice[requirement.code] ?? 5000
  const unitPrice = applyMargin(
    Math.round(basePrice * scenario.hardwareMultiplier * requirement.complexity * profileBoost),
    'materials', marginPercent, sectionMargins,
  )

  return {
    category: 'materials',
    code: `${scenario.id}-${requirement.code}`,
    note: `Источник каталога: ${requirement.source1cSku}`,
    quantity: requirement.quantity,
    title: requirement.name,
    total: unitPrice * requirement.quantity,
    unitPrice,
  }
}

function createWorkLines(
  project: Project,
  scenario: ScenarioDefinition,
  profile: SmartHomeProfile,
  rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }> = {},
): EstimateLine[] {
  const lines: EstimateLine[] = []

  lines.push(
    createAreaWorkLine(project, scenario, profile, workRates.design.audit, 1,
      'Предпроектное обследование объекта', rateOverrides),
    createAreaWorkLine(project, scenario, profile, workRates.design.oneLine, 1,
      'Разработка базовых однолинейных схем', rateOverrides),
    createAreaWorkLine(project, scenario, profile, workRates.design.panelLayout, 1,
      'План расстановки оборудования', rateOverrides),
    createAreaWorkLine(project, scenario, profile, workRates.design.cableJournal, 1,
      'Кабельный журнал', rateOverrides),
    createAreaWorkLine(project, scenario, profile, workRates.design.panelVisual, 1,
      'Визуализация щита автоматики', rateOverrides),
    createAreaWorkLine(project, scenario, profile, workRates.design.specification, 1,
      'Спецификация проекта', rateOverrides),
  )

  if (getRequirement(project, 'light-groups') || getRequirement(project, 'dali')) {
    lines.push(createAreaWorkLine(project, scenario, profile, workRates.design.lightingWiring, 1,
      'Проектирование освещения', rateOverrides))
  }

  if (getRequirement(project, 'curtains')) {
    lines.push(createAreaWorkLine(project, scenario, profile, workRates.design.curtainWiring, 1,
      'Проектирование управления шторами', rateOverrides))
  }

  if (getRequirement(project, 'climate')) {
    lines.push(
      createAreaWorkLine(project, scenario, profile, workRates.design.climateWiring, 1,
        'Проектирование климатической системы', rateOverrides),
      createAreaWorkLine(project, scenario, profile, workRates.design.peripheralBus, 1,
        'Шина управления и периферия климата', rateOverrides),
    )
  }

  if (getRequirement(project, 'warm-floor')) {
    lines.push(createAreaWorkLine(project, scenario, profile, workRates.design.floorWiring, 1,
      'Проектирование теплых полов', rateOverrides))
  }

  if (getRequirement(project, 'leak') || getRequirement(project, 'motion')) {
    lines.push(createAreaWorkLine(project, scenario, profile, workRates.design.safetyDesign, 0.55,
      'Проектирование системы безопасности', rateOverrides))
  }

  lines.push(
    createFixedWorkLine(scenario, profile, workRates.server.serverSetup, 1,
      'Подготовка серверной логики умного дома', rateOverrides),
    createFixedWorkLine(scenario, profile, workRates.server.mobileApp, 1,
      'Настройка мобильного приложения и прав доступа', rateOverrides),
  )

  if (profile !== 'essential') {
    lines.push(createFixedWorkLine(scenario, profile, workRates.server.reserve, 1,
      'Резервное копирование и облачная синхронизация', rateOverrides))
  }

  const daliGroups = getRequirement(project, 'dali')?.quantity ?? 0
  const lightGroups = (getRequirement(project, 'light-groups')?.quantity ?? 0) + daliGroups
  if (daliGroups > 0) {
    lines.push(
      createFixedWorkLine(scenario, profile, workRates.lighting.lightRelay, Math.max(1, Math.ceil(daliGroups / 16)),
        'Настройка шлюза и линий DALI', rateOverrides),
    )
  }
  if (lightGroups > 0) {
    const lightPackages = Math.max(1, Math.ceil(lightGroups / 8))
    lines.push(
      createFixedWorkLine(scenario, profile, workRates.lighting.lightRelay, lightPackages,
        'Настройка модулей реле освещения', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.lighting.lightIntegration, lightPackages,
        'Интеграция групп освещения', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.lighting.lightScenarios,
        Math.max(1, Math.ceil(lightGroups / 10)), 'Сценарии освещения', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.lighting.lightApp, 1,
        'Интерфейс управления светом', rateOverrides),
    )
  }

  const motionSensors = getRequirement(project, 'motion')?.quantity ?? 0
  if (motionSensors > 0) {
    lines.push(createFixedWorkLine(scenario, profile, workRates.lighting.lightMotion, motionSensors,
      'Настройка датчиков движения и присутствия', rateOverrides))
  }

  const curtainCount = getRequirement(project, 'curtains')?.quantity ?? 0
  if (curtainCount > 0) {
    lines.push(
      createFixedWorkLine(scenario, profile, workRates.curtains.curtainMotor, curtainCount,
        'Настройка моторов штор', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.curtains.curtainIntegration,
        Math.max(1, Math.ceil(curtainCount / 2)), 'Интеграция управления шторами', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.curtains.curtainScenarios,
        Math.max(1, Math.ceil(curtainCount / 4)), 'Сценарии управления шторами', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.curtains.curtainApp, 1,
        'Интерфейс управления шторами', rateOverrides),
    )
  }

  const leakPoints = getRequirement(project, 'leak')?.quantity ?? 0
  if (leakPoints > 0) {
    lines.push(
      createFixedWorkLine(scenario, profile, workRates.safety.leakIntegration,
        Math.max(1, Math.ceil(leakPoints / 2)), 'Интеграция защиты от протечек', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.safety.leakSensors, leakPoints,
        'Настройка датчиков протечки', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.safety.notifications, 1,
        'Настройка уведомлений безопасности', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.safety.leakApp, 1,
        'Интерфейс защиты и аварийных уведомлений', rateOverrides),
    )
  }

  if (motionSensors > 0) {
    lines.push(createFixedWorkLine(scenario, profile, workRates.safety.motionSensors, motionSensors,
      'Настройка объемных датчиков безопасности', rateOverrides))
  }

  const climateZones = getRequirement(project, 'climate')?.quantity ?? 0
  if (climateZones > 0) {
    lines.push(
      createFixedWorkLine(scenario, profile, workRates.climate.climateSensors, climateZones,
        'Настройка климатических датчиков', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.climate.climateScenarios,
        Math.max(1, Math.ceil(climateZones / 4)), 'Климатические сценарии и калибровка', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.climate.climateApp, 1,
        'Интерфейс управления климатом', rateOverrides),
    )
  }

  const warmFloorLoops = getRequirement(project, 'warm-floor')?.quantity ?? 0
  if (warmFloorLoops > 0) {
    lines.push(
      createFixedWorkLine(scenario, profile, workRates.warmFloor.thermostats, warmFloorLoops,
        'Настройка термостатов теплого пола', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.warmFloor.floorRelay,
        Math.max(1, Math.ceil(warmFloorLoops / 3)), 'Настройка модулей реле теплых полов', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.warmFloor.floorScenarios,
        Math.max(1, Math.ceil(warmFloorLoops / 4)), 'Сценарии теплых полов', rateOverrides),
      createFixedWorkLine(scenario, profile, workRates.warmFloor.floorApp, 1,
        'Интерфейс управления теплыми полами', rateOverrides),
    )
  }

  return lines.filter((line) => line.total > 0)
}

function createAreaWorkLine(
  project: Project,
  scenario: ScenarioDefinition,
  profile: SmartHomeProfile,
  rate: { code: string; maxPrice: number; minPrice: number; title: string; unitLabel: string },
  areaFactor: number,
  note: string,
  rateOverrides?: Record<string, { minPrice?: number; maxPrice?: number }>,
): EstimateLine {
  const quantity = Math.max(1, Math.round(project.areaM2 * areaFactor))
  const unitPrice = getRateValue(rate.minPrice, rate.maxPrice, profile, scenario, rate.code, rateOverrides)

  return {
    category: 'works',
    code: `${scenario.id}-${rate.code}`,
    note: note,
    quantity,
    title: rate.title,
    total: quantity * unitPrice,
    unitPrice,
  }
}

function createFixedWorkLine(
  scenario: ScenarioDefinition,
  profile: SmartHomeProfile,
  rate: { code: string; maxPrice: number; minPrice: number; title: string; unitLabel: string },
  quantity: number,
  note: string,
  rateOverrides?: Record<string, { minPrice?: number; maxPrice?: number }>,
): EstimateLine {
  const unitPrice = getRateValue(rate.minPrice, rate.maxPrice, profile, scenario, rate.code, rateOverrides)

  return {
    category: 'works',
    code: `${scenario.id}-${rate.code}`,
    note: note,
    quantity,
    title: rate.title,
    total: quantity * unitPrice,
    unitPrice,
  }
}

function getRateValue(
  minPrice: number,
  maxPrice: number,
  profile: SmartHomeProfile,
  scenario: ScenarioDefinition,
  rateCode?: string,
  rateOverrides?: Record<string, { minPrice?: number; maxPrice?: number }>,
) {
  let effectiveMin = minPrice
  let effectiveMax = maxPrice
  if (rateCode && rateOverrides?.[rateCode]) {
    const o = rateOverrides[rateCode]
    if (o.minPrice !== undefined) effectiveMin = o.minPrice
    if (o.maxPrice !== undefined) effectiveMax = o.maxPrice
  }
  const base = effectiveMin + (effectiveMax - effectiveMin) * profileWorkRatePosition[profile]
  return Math.round(base * scenario.workComplexityMultiplier)
}

function getRequirement(project: Project, code: string) {
  return project.requirements.find((requirement) => requirement.code === code)
}

