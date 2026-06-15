import type {
  CompanyApiSettings,
  EstimateScenario,
  ImportProjectsResult,
  OverlayConfig,
  Project,
  ProposalPageSummary,
  SaveEstimateResult,
  SmartHomeProfile,
  SmetaImportResult,
} from './types'

declare global {
  interface Window {
    companyApi?: {
      appReady: () => void
      checkUpdates: () => Promise<{ status: string; message: string }>
      getUpdateStatus: () => Promise<{ status: string; message: string }>
      chooseEstimateFolder: () => Promise<string | null>
      chooseManagerPhoto: () => Promise<string | null>
      chooseNomenclatureFile: () => Promise<string | null>
      chooseProjectsFile: () => Promise<string | null>
      getSettings: () => Promise<CompanyApiSettings>
      getStoredCatalogInfo: () => Promise<{ directory: string; filePath: string }>
      getTemplatePreviewPages: () => Promise<Array<{
        imageUrl: string
        pageNumber: number
        title: string
      }>>
      loadDemoWorkspace: () => Promise<{
        estimateFolder: string
        imported: ImportProjectsResult
        nomenclatureFilePath: string
        projectsFilePath: string
      }>
      importProjects: (payload: {
        nomenclatureFilePath?: string
        projectsFilePath: string
      }) => Promise<ImportProjectsResult | null>
      installLocalCatalog: (sourceFilePath: string) => Promise<string>
      importSmetaPdf: () => Promise<SmetaImportResult | null>
      aiGenerateDescription: (payload: {
        project: Project
        scenario: EstimateScenario
        objectKind: string
        sections?: { name: string; materials: number; works: number }[]
      }) => Promise<string>
      loadEquipmentModels: () => Promise<Record<string, { model: string; mode: 'per' | 'fixed'; value: number }[]>>
      saveEquipmentModels: (models: Record<string, { model: string; mode: 'per' | 'fixed'; value: number }[]>) => Promise<boolean>
      loadProjects: () => Promise<Project[]>
      saveProjects: (projects: Project[]) => Promise<boolean>
      openCatalogFolder: () => Promise<string>
      saveEstimateDocument: (payload: {
        objectDescription: string
        objectLead?: string
        overlayConfig?: OverlayConfig
        profile: SmartHomeProfile
        project: Project
        proposalPages?: ProposalPageSummary[]
        scenario: EstimateScenario
        settings: CompanyApiSettings
      }) => Promise<SaveEstimateResult>
      saveSettings: (settings: CompanyApiSettings) => Promise<CompanyApiSettings>
      loadOverlayConfig: () => Promise<OverlayConfig | null>
      saveOverlayConfig: (config: OverlayConfig) => Promise<boolean>
      readPriceSettings: () => Promise<{ rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }> }>
      writePriceSettings: (settings: { rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }> }) => Promise<{ rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }> }>
    }
  }
}

export {}
