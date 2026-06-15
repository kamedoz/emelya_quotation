import type { ProjectRequirement, RoomConfig } from '../types'

const roomTypeDefaults: Record<string, { lightingGroups: number; switches: number; dimmable: boolean }> = {
  'Гостиная': { lightingGroups: 3, switches: 3, dimmable: true },
  'Спальня': { lightingGroups: 2, switches: 2, dimmable: true },
  'Детская': { lightingGroups: 2, switches: 2, dimmable: true },
  'Кухня': { lightingGroups: 2, switches: 2, dimmable: true },
  'Прихожая': { lightingGroups: 1, switches: 1, dimmable: false },
  'Ванная': { lightingGroups: 1, switches: 1, dimmable: false },
  'Туалет': { lightingGroups: 1, switches: 1, dimmable: false },
  'Коридор': { lightingGroups: 1, switches: 1, dimmable: false },
  'Кабинет': { lightingGroups: 2, switches: 2, dimmable: true },
  'Столовая': { lightingGroups: 2, switches: 2, dimmable: true },
  'Гардеробная': { lightingGroups: 1, switches: 1, dimmable: false },
  'Балкон': { lightingGroups: 1, switches: 1, dimmable: false },
  'Кладовая': { lightingGroups: 1, switches: 0, dimmable: false },
  'Прачечная': { lightingGroups: 1, switches: 1, dimmable: false },
  'Котельная': { lightingGroups: 1, switches: 1, dimmable: false },
  'Терраса': { lightingGroups: 1, switches: 1, dimmable: true },
}

export function getDefaultRoom(name: string): RoomConfig {
  const def = roomTypeDefaults[name] || { lightingGroups: 1, switches: 1, dimmable: false }
  return {
    id: '',
    name,
    areaM2: 20,
    switches: def.switches,
    lightingGroups: def.lightingGroups,
    dimmable: def.dimmable,
    dali: false,
    noLighting: false,
    curtains: 0,
    motion: false,
    ac: false,
    warmFloor: false,
  }
}

export const ROOM_TYPE_NAMES = Object.keys(roomTypeDefaults)

export function generateRequirements(rooms: RoomConfig[]): ProjectRequirement[] {
  const reqs: ProjectRequirement[] = []
  let regularGroups = 0
  let daliGroups = 0
  let totalSwitches = 0
  let roomsWithAC = 0
  let roomsWithWarmFloor = 0
  let totalCurtains = 0
  let motionSensors = 0

  for (const room of rooms) {
    if (!room.noLighting) {
      if (room.dali) daliGroups += room.lightingGroups
      else regularGroups += room.lightingGroups
      totalSwitches += room.switches
    }
    if (room.ac) roomsWithAC++
    if (room.warmFloor) roomsWithWarmFloor++
    totalCurtains += Math.max(0, room.curtains || 0)
    if (room.motion) motionSensors++
  }

  const push = (code: string, name: string, quantity: number, complexity = 1) => {
    if (quantity > 0) {
      reqs.push({ code, complexity, name, quantity, unitLabel: 'шт.', zone: 'Все помещения', source1cSku: '' })
    }
  }

  push('light-groups', 'Группы освещения', regularGroups, 1)
  push('dali', 'Освещение DALI', daliGroups, 1.25)
  push('switches', 'Выключатели', totalSwitches, 0.7)
  push('climate', 'Кондиционеры', roomsWithAC, 1.2)
  push('warm-floor', 'Тёплые полы', roomsWithWarmFloor, 1)
  push('curtains', 'Электрокарнизы', totalCurtains, 1)
  push('motion', 'Датчики движения', motionSensors, 0.8)

  // Сцены добавляем только если есть чем управлять
  if (regularGroups + daliGroups + totalCurtains + roomsWithAC + roomsWithWarmFloor > 0) {
    push('scenes', 'Сцены', Math.max(1, Math.ceil(rooms.length / 3)), 1)
  }

  return reqs
}
