export type SmartHomeProfile = 'essential' | 'balanced' | 'premium'

export interface ProjectRequirement {
  code: string
  complexity: number
  estimatedUnitPrice?: number
  name: string
  quantity: number
  unitLabel: string
  zone: string
  source1cSku: string
}

export interface RoomConfig {
  id: string
  name: string
  areaM2: number
  switches: number
  lightingGroups: number
  dimmable: boolean
  dali: boolean
  noLighting: boolean
  curtains: number
  motion: boolean
  ac: boolean
  warmFloor: boolean
}

export interface ProjectRoom {
  id: string
  name: string
  areaM2: number
}

export interface Project {
  id: string
  name: string
  clientName: string
  objectType: string
  areaM2: number
  rooms: ProjectRoom[]
  requirements: ProjectRequirement[]
  // Заполняется, если проект создан импортом готовой сметы (PDF)
  importedSmeta?: SmetaImportResult
}

export interface EstimateLine {
  category: 'materials' | 'works' | 'transport'
  code: string
  title: string
  quantity: number
  unitPrice: number
  total: number
  note: string
}

export interface EstimateScenario {
  id: string
  title: string
  summary: string
  reliabilityLabel: string
  leadTime: string
  hardwareTotal: number
  installationTotal: number
  commissioningTotal: number
  worksBreakdownTotal: number
  total: number
  lines: EstimateLine[]
}

export interface ProjectEstimate {
  projectId: string
  scenarios: EstimateScenario[]
}

export interface ImportProjectsResult {
  fileName: string
  projects: Project[]
}

export interface SmetaSection {
  name: string
  materials: number
  works: number
  transport: number
  total: number
}

export interface SmetaImportResult {
  fileName: string
  techId: string
  title: string
  sections: SmetaSection[]
  totals: {
    materials: number
    works: number
    transport: number
    total: number
  }
}

export interface CompanyApiSettings {
  companyName: string
  estimateFolder: string
  managerEmail: string
  managerName: string
  managerPhone: string
  managerPhotoPath: string
  managerTelegram: string
  managerTitle: string
  nomenclatureFilePath: string
  proposalValidityDays: number
  projectsFilePath: string
  proposalTemplateName: string
  marginPercent: number
  sectionMargins: Record<string, number>
  updateFeedUrl?: string
  aiApiKey?: string
}

export interface SaveEstimateResult {
  filePath: string
  fileName: string
}

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
  // Если задано — под текстом рисуется заливка этого цвета (чтобы перекрыть шаблонный текст)
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

export interface ProposalPageSummary {
  amountLabel?: string
  countLabel?: string
  countValues?: number[]
  amountValues?: number[]
  description: string
  included: boolean
  pageNumber: number
  title: string
}
