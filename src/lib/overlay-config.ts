export const OVERLAY_CONFIG_VERSION = 2

export interface OverlayRect {
  x: number
  y: number
  width: number
  height: number
  radius?: number
}

export interface CountCard {
  rect: OverlayRect
  textX: number
  textY: number
  textWidth: number
  size?: number
  align?: 'left' | 'center' | 'right'
  color?: string
}

export interface PriceCard {
  rect: OverlayRect
  textX: number
  textY: number
  textWidth: number
  size?: number
  category: 'materials' | 'works'
  color?: string
}

export interface TextElement {
  rect: OverlayRect
  text: string
  size?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  weight?: number
  lineHeight?: number
  bg?: string
}

export interface PageOverlay {
  countCards: CountCard[]
  priceCards: PriceCard[]
  texts?: TextElement[]
  overrideCounts?: (number | null)[]
  overrideAmounts?: (string | null)[]
}

export interface OverlayConfig {
  templateId: string
  configVersion?: number
  pages: Record<number, PageOverlay>
}

// Патчи закрывают ТОЛЬКО запечённые цифры шаблона (границы замерены попиксельно),
// новые значения рисуются в той же позиции. Цвет каждого патча взят из карточки
// в этом месте, поэтому заплатки не видны. Подписи и иконки шаблона не трогаем.

// Карточка количества: патч поверх цифр + белое число той же позиции.
// Цвет каждого патча замерен в точке карточки, где он рисуется.
function count(x: number, w: number, y: number, ty: number, bg: string, size = 54): CountCard {
  return {
    rect: { x, y, width: w, height: 80, radius: 10 },
    textX: x + 12, textY: ty, textWidth: 320, size, color: bg,
  }
}

// Цена: левая карточка «Материалы» / правая «Работы»
function priceL(w: number, bg = 'rgb(53,23,18)'): PriceCard {
  return {
    rect: { x: 202, y: 1441, width: w, height: 76, radius: 10 },
    textX: 212, textY: 1448, textWidth: 560, size: 50, category: 'materials', color: bg,
  }
}
function priceR(w: number, bg = 'rgb(61,31,27)'): PriceCard {
  return {
    rect: { x: 972, y: 1441, width: w, height: 76, radius: 10 },
    textX: 982, textY: 1448, textWidth: 570, size: 50, category: 'works', color: bg,
  }
}

export function defaultOverlayConfig(templateId: string): OverlayConfig {
  return {
    templateId,
    configVersion: OVERLAY_CONFIG_VERSION,
    pages: {
      1: { countCards: [], priceCards: [] },
      2: { countCards: [], priceCards: [] },
      3: {
        countCards: [],
        priceCards: [
          { rect: { x: 202, y: 1441, width: 378, height: 76, radius: 10 }, textX: 212, textY: 1448, textWidth: 560, size: 50, category: 'works', color: 'rgb(28,27,32)' },
        ],
      },
      4: {
        countCards: [count(200, 96, 1211, 1214, 'rgb(23,22,26)'), count(970, 68, 1211, 1214, 'rgb(29,29,31)')],
        priceCards: [priceL(330), priceR(332)],
      },
      5: {
        countCards: [count(201, 155, 1211, 1214, 'rgb(23,22,26)'), count(970, 68, 1211, 1214, 'rgb(29,29,31)')],
        priceCards: [priceL(374), priceR(366)],
      },
      6: {
        countCards: [count(203, 107, 1211, 1214, 'rgb(22,21,26)')],
        priceCards: [priceL(426), priceR(332)],
      },
      7: {
        // Подписи в две строки — цифры ниже (1239-1292)
        countCards: [
          count(201, 110, 1227, 1230, 'rgb(24,24,26)'),
          count(714, 64, 1228, 1231, 'rgb(25,25,27)'),
          count(1228, 110, 1227, 1230, 'rgb(29,29,32)'),
        ],
        priceCards: [priceL(362, 'rgb(54,23,17)'), priceR(370, 'rgb(65,34,28)')],
      },
      8: {
        countCards: [count(200, 67, 1211, 1214, 'rgb(23,22,27)'), count(970, 67, 1212, 1215, 'rgb(29,27,30)')],
        priceCards: [priceL(326), priceR(374)],
      },
      9: {
        countCards: [
          count(223, 55, 1222, 1232, 'rgb(23,22,26)', 44),
          count(637, 81, 1229, 1232, 'rgb(23,23,26)', 44),
          count(976, 75, 1229, 1232, 'rgb(27,26,30)', 44),
          count(1315, 55, 1229, 1232, 'rgb(28,27,32)', 44),
        ],
        priceCards: [priceL(318), priceR(324)],
      },
      10: { countCards: [], priceCards: [priceL(380), priceR(332)] },
      11: {
        countCards: [count(202, 65, 1211, 1214, 'rgb(22,21,26)')],
        priceCards: [priceL(356), priceR(332)],
      },
      12: { countCards: [], priceCards: [priceL(358), priceR(332)] },
      13: { countCards: [], priceCards: [priceL(374), priceR(330)] },
      14: { countCards: [], priceCards: [] },
      15: { countCards: [], priceCards: [] },
      16: { countCards: [], priceCards: [] },
      17: { countCards: [], priceCards: [] },
      18: { countCards: [], priceCards: [] },
    },
  }
}
