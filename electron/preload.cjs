const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('companyApi', {
  appReady: () => ipcRenderer.send('company:app-ready'),
  checkUpdates: async () => ipcRenderer.invoke('company:check-updates'),
  getUpdateStatus: async () => ipcRenderer.invoke('company:update-status'),
  chooseEstimateFolder: async () => ipcRenderer.invoke('company:choose-estimate-folder'),
  chooseManagerPhoto: async () => ipcRenderer.invoke('company:choose-manager-photo'),
  chooseNomenclatureFile: async () => ipcRenderer.invoke('company:choose-nomenclature-file'),
  chooseProjectsFile: async () => ipcRenderer.invoke('company:choose-projects-file'),
  getSettings: async () => ipcRenderer.invoke('company:get-settings'),
  getStoredCatalogInfo: async () => ipcRenderer.invoke('company:get-stored-catalog-info'),
  getTemplatePreviewPages: async () => ipcRenderer.invoke('company:get-template-preview-pages'),
  loadDemoWorkspace: async () => ipcRenderer.invoke('company:load-demo-workspace'),
  importProjects: async (payload) => ipcRenderer.invoke('company:import-projects', payload),
  installLocalCatalog: async (sourceFilePath) =>
    ipcRenderer.invoke('company:install-local-catalog', sourceFilePath),
  importSmetaPdf: async () => ipcRenderer.invoke('company:import-smeta-pdf'),
  aiGenerateDescription: async (payload) => ipcRenderer.invoke('company:ai-generate-description', payload),
  loadEquipmentModels: async () => ipcRenderer.invoke('company:load-equipment-models'),
  saveEquipmentModels: async (models) => ipcRenderer.invoke('company:save-equipment-models', models),
  loadProjects: async () => ipcRenderer.invoke('company:load-projects'),
  saveProjects: async (projects) => ipcRenderer.invoke('company:save-projects', projects),
  openCatalogFolder: async () => ipcRenderer.invoke('company:open-catalog-folder'),
  saveEstimateDocument: async (payload) =>
    ipcRenderer.invoke('company:save-estimate-document', payload),
  saveSettings: async (settings) => ipcRenderer.invoke('company:save-settings', settings),
  loadOverlayConfig: async () => ipcRenderer.invoke('company:load-overlay-config'),
  saveOverlayConfig: async (config) => ipcRenderer.invoke('company:save-overlay-config', config),
  readPriceSettings: async () => ipcRenderer.invoke('company:read-price-settings'),
  writePriceSettings: async (settings) => ipcRenderer.invoke('company:write-price-settings', settings),
})
