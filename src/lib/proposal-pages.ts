import type { EstimateScenario, Project, ProposalPageSummary } from '../types'

const money = new Intl.NumberFormat('ru-RU', {
  currency: 'RUB',
  maximumFractionDigits: 0,
  style: 'currency',
})

function formatMoney(value: number) {
  return money.format(Math.round(value))
}

function includesAny(value: string, keywords: string[]) {
  const source = String(value).toLowerCase()
  return keywords.some((keyword) => source.includes(keyword))
}

function sumByCategory(lines: EstimateScenario['lines'], category: 'materials' | 'works' | 'transport') {
  return lines
    .filter((line) => line.category === category)
    .reduce((sum, line) => sum + line.total, 0)
}

function sumLines(
  lines: EstimateScenario['lines'],
  predicate: (line: EstimateScenario['lines'][number]) => boolean,
  category?: 'materials' | 'works' | 'transport',
) {
  return lines
    .filter((line) => (!category || line.category === category) && predicate(line))
    .reduce((sum, line) => sum + line.total, 0)
}

function countRequirement(project: Project, code: string) {
  return project.requirements
    .filter((requirement) => requirement.code === code)
    .reduce((sum, requirement) => sum + requirement.quantity, 0)
}

function countRequirementsByKeywords(project: Project, keywords: string[]) {
  return project.requirements
    .filter((requirement) =>
      includesAny(
        `${requirement.code} ${requirement.name} ${requirement.zone} ${requirement.source1cSku}`,
        keywords,
      ),
    )
    .reduce((sum, requirement) => sum + requirement.quantity, 0)
}

function sumRequirementMaterialsByKeywords(scenario: EstimateScenario, keywords: string[]) {
  return sumLines(
    scenario.lines,
    (line) =>
      line.category === 'materials' &&
      includesAny(`${line.code} ${line.title} ${line.note}`, keywords),
    'materials',
  )
}

function sumWorksByCodes(scenario: EstimateScenario, codePrefixes: string[]) {
  return sumLines(
    scenario.lines,
    (line) =>
      line.category === 'works' &&
      codePrefixes.some((prefix) => line.code.includes(prefix)),
    'works',
  )
}

export function buildProposalPageSummaries(project: Project, scenario: EstimateScenario) {
  const materialsTotal = sumByCategory(scenario.lines, 'materials')
  const worksTotal = sumByCategory(scenario.lines, 'works')
  const transportTotal = sumByCategory(scenario.lines, 'transport')

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

  const summaryPages: ProposalPageSummary[] = [
    {
      countValues: [],
      amountValues: [],
      description: `Обложка для объекта "${project.name}" с технологией ${scenario.title}.`,
      included: true,
      pageNumber: 1,
      title: 'Обложка',
    },
    {
      countValues: [],
      amountValues: [],
      description: `Сравнение вариантов с акцентом на ${scenario.title}.`,
      included: true,
      pageNumber: 2,
      title: 'Ключевая технология',
    },
    {
      amountLabel: formatMoney(designWorks),
      countValues: [],
      amountValues: [Math.round(designWorks)],
      description: 'Проектная документация и подготовка схем.',
      included: designWorks > 0,
      pageNumber: 3,
      title: 'Проектирование',
    },
    {
      amountLabel: `${formatMoney(lightingMaterials * 0.2)} / ${formatMoney(lightingWorks * 0.22)}`,
      countLabel: `${outdoorLightGroups} групп / ${motionSensors} датчиков`,
      countValues: [outdoorLightGroups, motionSensors],
      amountValues: [Math.round(lightingMaterials * 0.2), Math.round(lightingWorks * 0.22)],
      description: 'Наружное освещение и часть сценариев по датчикам.',
      included: outdoorLightGroups > 0 || motionSensors > 0 || lightingMaterials > 0 || lightingWorks > 0,
      pageNumber: 4,
      title: 'Наружное освещение',
    },
    {
      amountLabel: `${formatMoney(lightingMaterials * 0.8)} / ${formatMoney(lightingWorks * 0.78)}`,
      countLabel: `${indoorLightGroups || lightGroups} групп / ${motionSensors} датчиков`,
      countValues: [indoorLightGroups || lightGroups, motionSensors],
      amountValues: [Math.round(lightingMaterials * 0.8), Math.round(lightingWorks * 0.78)],
      description: 'Основной контур внутреннего освещения.',
      included: lightGroups > 0 || motionSensors > 0 || lightingMaterials > 0 || lightingWorks > 0,
      pageNumber: 5,
      title: 'Свет',
    },
    {
      amountLabel: `${formatMoney(curtainMaterials)} / ${formatMoney(curtainWorks)}`,
      countLabel: `${curtains} приводов`,
      countValues: [curtains],
      amountValues: [Math.round(curtainMaterials), Math.round(curtainWorks)],
      description: 'Моторизованные шторы и сценарии управления.',
      included: curtains > 0 || curtainMaterials > 0 || curtainWorks > 0,
      pageNumber: 6,
      title: 'Шторы',
    },
    {
      amountLabel: `${formatMoney(floorMaterials)} / ${formatMoney(floorWorks)}`,
      countLabel: `${Math.max(warmFloorLoops, climateZones || warmFloorLoops)} контуров`,
      countValues: [Math.max(warmFloorLoops, climateZones || warmFloorLoops), Math.max(1, Math.ceil(Math.max(warmFloorLoops, 1) / 3)), Math.max(climateZones, warmFloorLoops)],
      amountValues: [Math.round(floorMaterials), Math.round(floorWorks)],
      description: 'Теплые полы и отопительные контуры.',
      included: warmFloorLoops > 0 || floorMaterials > 0 || floorWorks > 0,
      pageNumber: 7,
      title: 'Отопление',
    },
    {
      amountLabel: `${formatMoney(climateMaterials)} / ${formatMoney(climateWorks)}`,
      countLabel: `${climateZones} зон`,
      countValues: [Math.max(0, climateZones), Math.max(1, climateZones || 1)],
      amountValues: [Math.round(climateMaterials), Math.round(climateWorks)],
      description: 'Климатические зоны и управление кондиционированием.',
      included: climateZones > 0 || climateMaterials > 0 || climateWorks > 0,
      pageNumber: 8,
      title: 'Кондиционирование',
    },
    {
      amountLabel: `${formatMoney(safetyMaterials)} / ${formatMoney(safetyWorks)}`,
      countLabel: `${leakPoints} протечек / ${motionSensors} датчиков`,
      countValues: [leakPoints > 0 ? 1 : 0, leakPoints, Math.max(2, Math.ceil(project.areaM2 / 90)), Math.max(1, Math.ceil(project.rooms.length / 4))],
      amountValues: [Math.round(safetyMaterials), Math.round(safetyWorks)],
      description: 'Безопасность, оповещения и защита от протечек.',
      included: leakPoints > 0 || motionSensors > 0 || safetyMaterials > 0 || safetyWorks > 0,
      pageNumber: 9,
      title: 'Безопасность',
    },
    {
      amountLabel: `${formatMoney(multimediaMaterials)} / ${formatMoney(multimediaWorks)}`,
      countLabel: `${Math.max(1, Math.ceil(Math.max(scenes, multimediaCount) / 2))} блока`,
      countValues: [Math.max(1, Math.ceil(Math.max(scenes, multimediaCount) / 2))],
      amountValues: [Math.round(multimediaMaterials), Math.round(multimediaWorks)],
      description: 'Мультимедиа, акустика и сценическое управление.',
      included: multimediaCount > 0 || multimediaMaterials > 0,
      pageNumber: 10,
      title: 'Мультимедиа',
    },
    {
      amountLabel: `${formatMoney(cameraMaterials)} / ${formatMoney(cameraWorks)}`,
      countLabel: `${cameraCount} камер`,
      countValues: [cameraCount],
      amountValues: [Math.round(cameraMaterials), Math.round(cameraWorks)],
      description: 'Видеонаблюдение и базовая интеграция камер.',
      included: cameraCount > 0 || cameraMaterials > 0,
      pageNumber: 11,
      title: 'Видеонаблюдение',
    },
    {
      amountLabel: `${formatMoney(intercomMaterials)} / ${formatMoney(intercomWorks)}`,
      countLabel: `${Math.max(1, intercomCount)} точка доступа`,
      countValues: [Math.max(1, intercomCount)],
      amountValues: [Math.round(intercomMaterials), Math.round(intercomWorks)],
      description: 'Домофон, замок и контроль доступа.',
      included: intercomCount > 0 || intercomMaterials > 0,
      pageNumber: 12,
      title: 'Домофон и умный замок',
    },
    {
      amountLabel: `${formatMoney(controllerMaterials)} / ${formatMoney(serverWorksBase)}`,
      countLabel: '1 серверный блок',
      countValues: [1],
      amountValues: [Math.round(controllerMaterials), Math.round(serverWorksBase)],
      description: 'Сервер, шкаф автоматики и базовая пусконаладка.',
      included: controllerMaterials > 0 || serverWorksBase > 0,
      pageNumber: 13,
      title: 'Настройка сервера и интерфейса',
    },
    {
      amountLabel: `0 ₽ / ${formatMoney(interfaceWorks)}`,
      countLabel: `${Math.max(1, Math.ceil(project.rooms.length / 5))}`,
      countValues: [Math.max(1, Math.ceil(project.rooms.length / 5))],
      amountValues: [0, Math.round(interfaceWorks)],
      description: 'Визуальный интерфейс управления и мобильное приложение.',
      included: interfaceInclude,
      pageNumber: 14,
      title: 'Визуальный интерфейс управления',
    },
    {
      amountLabel: `${formatMoney(voiceMaterials)} / ${formatMoney(voiceWorks)}`,
      countLabel: `${Math.max(1, voiceAssistantCount)} ассистента`,
      countValues: [Math.max(1, voiceAssistantCount)],
      amountValues: [Math.round(voiceMaterials), Math.round(voiceWorks)],
      description: 'Интеграция с голосовыми помощниками.',
      included: voiceAssistantCount > 0 || voiceMaterials > 0,
      pageNumber: 15,
      title: 'Голосовые помощники',
    },
    {
      amountLabel: `${formatMoney(materialsTotal)} / ${formatMoney(worksTotal)} / ${formatMoney(transportTotal)} / ${formatMoney(scenario.total)}`,
      countValues: [],
      amountValues: [Math.round(materialsTotal), Math.round(worksTotal), Math.round(transportTotal), Math.round(scenario.total)],
      description: 'Сводная информация по материалам, работам и итоговой стоимости.',
      included: true,
      pageNumber: 16,
      title: 'Сводная информация',
    },
    {
      countValues: [],
      amountValues: [],
      description: 'Преимущества компании и пояснения по подходу к реализации.',
      included: true,
      pageNumber: 17,
      title: 'Преимущества работы с нами',
    },
    {
      countValues: [],
      amountValues: [],
      description: 'Контактная страница менеджера и компании.',
      included: true,
      pageNumber: 18,
      title: 'Контакты',
    },
  ]

  return summaryPages
}
