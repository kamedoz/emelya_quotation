import pkg from 'electron'
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = pkg
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSettings, writeSettings } from './config-store.js'
import { getLocalCatalogInfo, installLocalCatalog } from './local-catalog.js'
import { importProjectsFromSources } from './project-import.js'
import { saveEstimateDocument } from './save-estimate.js'
import { loadOverlayConfig, saveOverlayConfig } from './overlay-store.js'
import { loadProjects, saveProjects } from './projects-store.js'
import { loadEquipmentModels, saveEquipmentModels } from './equipment-models-store.js'
import { importSmetaFromPdf } from './smeta-import.js'
import { initAutoUpdate, checkForUpdatesManual, getUpdateStatus, installUpdate } from './auto-update.js'
import { generateObjectDescription } from './ai-description.js'
import { readPriceSettings, writePriceSettings } from './price-settings-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = process.env.ELECTRON_DEV === '1'

// ── Сплеш-окно с иконкой и прогресс-баром реальных этапов запуска ──
let splashWindow = null
let splashLoaded = false
let mainWindow = null

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 380,
    height: 400,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: true,
    icon: path.join(__dirname, '..', 'public', 'emelya-icon.ico'),
  })
  splashWindow.webContents.once('did-finish-load', () => { splashLoaded = true })
  splashWindow.on('closed', () => { splashWindow = null })
  void splashWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function setSplashProgress(value, label) {
  if (!splashWindow || splashWindow.isDestroyed()) return
  const run = () => {
    if (!splashWindow || splashWindow.isDestroyed()) return
    splashWindow.webContents
      .executeJavaScript(`window.setProgress(${value}, ${JSON.stringify(label ?? '')})`)
      .catch(() => {})
  }
  if (splashLoaded) run()
  else splashWindow.webContents.once('did-finish-load', run)
}

// Финал: дотягиваем бар до 100%, показываем главное окно, закрываем сплеш
function finishSplash() {
  setSplashProgress(1, 'Готово')
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show()
    }
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close()
    }
  }, 400)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    backgroundColor: '#f4f2ef',
    height: 1020,
    minHeight: 780,
    minWidth: 1180,
    show: false,
    title: 'Умный дом Емеля — КП',
    icon: path.join(__dirname, '..', 'public', 'emelya-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
    width: 1560,
  })

  setSplashProgress(0.3, 'Загрузка интерфейса…')
  mainWindow.webContents.on('dom-ready', () => setSplashProgress(0.6, 'Загрузка интерфейса…'))
  mainWindow.webContents.on('did-finish-load', () => setSplashProgress(0.82, 'Подготовка данных…'))

  // Страховка: если рендерер не отчитался о готовности за 10 секунд — показываем как есть
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      finishSplash()
    }
  }, 10000)

  if (isDev) {
    void mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
    return
  }

  void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

function getImportFilters() {
  return [
    { extensions: ['json'], name: 'JSON files' },
    { extensions: ['xlsx', 'xls'], name: 'Excel files' },
    { extensions: ['csv'], name: 'CSV files' },
  ]
}

function getDemoPaths() {
  const baseDirectory = path.join(__dirname, '..', 'demo')

  return {
    estimateFolder: path.join(baseDirectory, 'generated'),
    nomenclatureFilePath: path.join(baseDirectory, 'demo-catalog.json'),
    projectsFilePath: path.join(baseDirectory, 'demo-projects.json'),
  }
}

async function getTemplatePreviewPages() {
  const templateDirectory = path.join(__dirname, 'template-assets', 'premium-knx')
  const titles = {
    1: 'Обложка',
    2: 'Технология',
    3: 'Проектирование',
    4: 'Наружное освещение',
    5: 'Свет',
    6: 'Шторы',
    7: 'Отопление',
    8: 'Кондиционирование',
    9: 'Безопасность',
    10: 'Мультимедиа',
    11: 'Видеонаблюдение',
    12: 'Домофон и замок',
    13: 'Сервер и интерфейс',
    14: 'Визуальный интерфейс',
    15: 'Голосовые помощники',
    16: 'Сводка',
    17: 'Преимущества',
    18: 'Контакты',
  }

  const results = await Promise.allSettled(
    Array.from({ length: 18 }, async (_, index) => {
      const pageNumber = index + 1
      const imagePath = path.join(templateDirectory, `page${String(pageNumber).padStart(2, '0')}.png`)
      const imageBuffer = await fs.readFile(imagePath)

      return {
        imageUrl: `data:image/png;base64,${imageBuffer.toString('base64')}`,
        pageNumber,
        title: titles[pageNumber],
      }
    }),
  )

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)
}

app.whenReady().then(() => {
  // Убираем стандартное меню File/Edit/View/Window
  Menu.setApplicationMenu(null)

  // Сплеш появляется первым — сразу после запуска
  createSplash()
  setSplashProgress(0.12, 'Запуск…')

  // Рендерер сообщает, что данные загружены — реальное завершение запуска
  ipcMain.on('company:app-ready', () => finishSplash())

  // Автообновление (если в настройках задан адрес сервера обновлений)
  ipcMain.handle('company:check-updates', async () => checkForUpdatesManual(() => mainWindow))
  ipcMain.handle('company:update-status', async () => getUpdateStatus())
  ipcMain.handle('company:install-update', async () => installUpdate())

  ipcMain.handle('company:get-settings', async () => readSettings())
  ipcMain.handle('company:get-stored-catalog-info', async () => getLocalCatalogInfo())
  ipcMain.handle('company:get-template-preview-pages', async () => getTemplatePreviewPages())
  ipcMain.handle('company:save-settings', async (_event, settings) =>
    writeSettings(settings),
  )
  ipcMain.handle('company:choose-estimate-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Выберите папку для КП',
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    return filePaths[0]
  })
  ipcMain.handle('company:choose-projects-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: getImportFilters(),
      properties: ['openFile'],
      title: 'Выберите файл с проектами и составом объекта',
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    return filePaths[0]
  })
  ipcMain.handle('company:choose-nomenclature-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: getImportFilters(),
      properties: ['openFile'],
      title: 'Выберите каталог оборудования',
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    return filePaths[0]
  })
  ipcMain.handle('company:choose-manager-photo', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [
        { extensions: ['png', 'jpg', 'jpeg', 'webp'], name: 'Image files' },
      ],
      properties: ['openFile'],
      title: 'Выберите фото менеджера',
    })

    if (canceled || filePaths.length === 0) {
      return null
    }

    return filePaths[0]
  })
  ipcMain.handle('company:install-local-catalog', async (_event, sourceFilePath) =>
    installLocalCatalog(sourceFilePath),
  )
  ipcMain.handle('company:open-catalog-folder', async () => {
    const { directory } = await getLocalCatalogInfo()
    await fs.mkdir(directory, { recursive: true })
    await shell.openPath(directory)
    return directory
  })
  ipcMain.handle('company:save-estimate-document', async (_event, payload) =>
    saveEstimateDocument(payload),
  )
  ipcMain.handle('company:import-projects', async (_event, payload) => {
    if (!payload?.projectsFilePath) {
      throw new Error('Сначала выберите файл с проектами.')
    }

    return importProjectsFromSources(
      payload.projectsFilePath,
      payload.nomenclatureFilePath,
    )
  })
  ipcMain.handle('company:ai-generate-description', async (_event, payload) =>
    generateObjectDescription(payload),
  )
  ipcMain.handle('company:import-smeta-pdf', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      filters: [{ extensions: ['pdf'], name: 'PDF' }],
      properties: ['openFile'],
      title: 'Выберите PDF со сметой',
    })
    if (canceled || filePaths.length === 0) return null
    const filePath = filePaths[0]
    const parsed = await importSmetaFromPdf(filePath)
    return { ...parsed, fileName: path.basename(filePath) }
  })
  ipcMain.handle('company:load-equipment-models', async () => loadEquipmentModels())
  ipcMain.handle('company:save-equipment-models', async (_event, models) => saveEquipmentModels(models))
  ipcMain.handle('company:load-projects', async () => loadProjects())
  ipcMain.handle('company:save-projects', async (_event, projects) => saveProjects(projects))
  ipcMain.handle('company:load-overlay-config', async () => loadOverlayConfig())
  ipcMain.handle('company:save-overlay-config', async (_event, config) => saveOverlayConfig(config))
  ipcMain.handle('company:read-price-settings', async () => readPriceSettings())
  ipcMain.handle('company:write-price-settings', async (_event, settings) => writePriceSettings(settings))
  ipcMain.handle('company:load-demo-workspace', async () => {
    const demoPaths = getDemoPaths()
    const imported = await importProjectsFromSources(
      demoPaths.projectsFilePath,
      demoPaths.nomenclatureFilePath,
    )

    return {
      ...demoPaths,
      imported,
    }
  })

  createWindow()

  // Тихая проверка обновлений через несколько секунд после старта
  setTimeout(() => { void initAutoUpdate(() => mainWindow) }, 6000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
