// Типовой модельный состав оборудования по позициям сметы.
// Используется только для проверки менеджером внутри приложения — в PDF не попадает.
// Справочник можно править прямо в программе (раздел «Оснащение» → раскрыть позицию),
// правки сохраняются в ~/.1c-quotation/equipment-models.json и перекрывают значения ниже.

export interface ModelSpec {
  model: string
  // 'per' — 1 шт. на каждые `value` единиц позиции (округление вверх)
  // 'fixed' — ровно `value` шт. независимо от количества
  mode: 'per' | 'fixed'
  value: number
}

export type CustomModels = Record<string, ModelSpec[]>

export interface LineModel {
  model: string
  qty: number
}

const per = (model: string, value = 1): ModelSpec => ({ model, mode: 'per', value })
const fixed = (model: string, value = 1): ModelSpec => ({ model, mode: 'fixed', value })

const DEFAULT_MODELS: Record<string, Record<string, ModelSpec[]>> = {
  knx: {
    controller: [
      fixed('Логический сервер Logic Machine LM5 Power'),
      fixed('IP-интерфейс Weinzierl KNX IP Interface 731'),
      fixed('Блок питания MeanWell KNX-40E-1280D'),
      fixed('Шкаф автоматики ABB TwinLine (по проекту)'),
      fixed('Автоматика защиты ABB S200 (комплект)'),
    ],
    'light-groups': [
      per('Релейный актуатор MDT AKK-1616.03 (16 каналов)', 16),
      per('Универсальный диммер MDT AKD-0424V.02 (4 канала)', 8),
    ],
    switches: [per('Выключатель MDT BE-GT2Tx.01 Glass II Smart')],
    motion: [per('Датчик присутствия MDT SCN-P360D4.03 (360°)')],
    climate: [
      per('Фанкойл-актуатор MDT AKH-0800.03', 4),
      per('Комнатный термостат MDT SCN-RTR55S.01'),
    ],
    'warm-floor': [
      per('Термоактуатор MDT AKH-0800.03 (8 контуров)', 8),
      per('Сервопривод NC 230В на коллектор'),
      per('Датчик температуры пола (NTC)'),
    ],
    curtains: [
      per('Жалюзийный актуатор MDT JAL-0810.02 (8 каналов)', 8),
      per('Привод штор Somfy Glydea / Dauerhaft 35'),
    ],
    scenes: [per('Кнопочная панель сцен MDT BE-TAS86.01')],
    leak: [
      per('Модуль защиты от протечек + краны Gidrolock Ultimate', 2),
      per('Датчик протечки проводной'),
    ],
  },
  'wiren-board': {
    controller: [
      fixed('Контроллер Wiren Board 7 (WB7)'),
      fixed('Блок питания MeanWell HDR-100-24'),
      fixed('Щит автоматики IEK FORMAT (по проекту)'),
      fixed('Автоматика защиты ABB S200 (комплект)'),
    ],
    'light-groups': [
      per('Модуль реле WB-MR6C v.2 (6 каналов)', 6),
      per('Диммер WB-MDM3 (3 канала)', 6),
    ],
    switches: [
      per('Выключатель сухой контакт (дизайн по выбору)'),
      per('Модуль входов WB-MCM8 (8 входов)', 8),
    ],
    motion: [per('Датчик движения/освещённости WB-MSW v.4')],
    climate: [
      per('Датчик климата WB-MSW v.4 (CO₂, T, RH)'),
      per('ИК-модуль управления кондиционером'),
    ],
    'warm-floor': [
      per('Модуль реле WB-MR6C v.2 (управление контурами)', 6),
      per('Датчик температуры пола 1-Wire'),
      per('Сервопривод NC 230В на коллектор'),
    ],
    curtains: [
      per('Модуль реле WB-MR6C v.2 (реверс штор)', 3),
      per('Привод штор Dauerhaft / Novo 35'),
    ],
    scenes: [per('Сценарная кнопка (вход WB-MCM8)')],
    leak: [
      per('Модуль протечек WB-MWAC + краны Gidrolock', 2),
      per('Датчик протечки проводной'),
    ],
  },
  zigbee: {
    controller: [
      fixed('Сервер Home Assistant Yellow / Intel NUC'),
      fixed('Zigbee-координатор SLZB-06 (PoE)'),
      fixed('Роутер/усилители сети Zigbee', 2),
    ],
    'light-groups': [per('Реле Aqara T2 / Sonoff ZBMINI Extreme')],
    switches: [per('Беспроводной выключатель Aqara H1')],
    motion: [per('Датчик движения Aqara P1')],
    climate: [
      per('ИК-пульт Tuya Zigbee (кондиционер)'),
      per('Датчик температуры/влажности Aqara T1'),
    ],
    'warm-floor': [per('Терморегулятор Tuya Zigbee 16А с датчиком пола')],
    curtains: [per('Привод штор Aqara Curtain Driver E1')],
    scenes: [per('Кнопка сцен Aqara Wireless Mini Switch')],
    leak: [
      per('Датчик протечки Aqara'),
      fixed('Кран с приводом Tuya Zigbee 3/4"', 2),
    ],
  },
}

export function modelKey(scenarioId: string, lineCode: string) {
  const requirementCode = lineCode.startsWith(`${scenarioId}-`)
    ? lineCode.slice(scenarioId.length + 1)
    : lineCode
  return `${scenarioId}:${requirementCode}`
}

export function getDefaultSpecs(scenarioId: string, lineCode: string): ModelSpec[] {
  const requirementCode = lineCode.startsWith(`${scenarioId}-`)
    ? lineCode.slice(scenarioId.length + 1)
    : lineCode
  return DEFAULT_MODELS[scenarioId]?.[requirementCode] ?? []
}

export function getLineSpecs(
  scenarioId: string,
  lineCode: string,
  customModels?: CustomModels,
): { specs: ModelSpec[]; isCustom: boolean } {
  const custom = customModels?.[modelKey(scenarioId, lineCode)]
  if (custom) return { specs: custom, isCustom: true }
  return { specs: getDefaultSpecs(scenarioId, lineCode), isCustom: false }
}

export function computeModelQty(spec: ModelSpec, lineQuantity: number): number {
  if (spec.mode === 'fixed') return Math.max(0, Math.round(spec.value))
  const divisor = Math.max(1, spec.value)
  return Math.max(1, Math.ceil(lineQuantity / divisor))
}

export function getLineModels(
  scenarioId: string,
  lineCode: string,
  quantity: number,
  customModels?: CustomModels,
): LineModel[] {
  const { specs } = getLineSpecs(scenarioId, lineCode, customModels)
  return specs
    .filter((spec) => spec.model.trim())
    .map((spec) => ({ model: spec.model, qty: computeModelQty(spec, quantity) }))
}
