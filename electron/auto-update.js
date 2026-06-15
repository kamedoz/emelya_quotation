import pkg from 'electron'
import electronUpdater from 'electron-updater'
import { readSettings } from './config-store.js'

const { app } = pkg
const { autoUpdater } = electronUpdater

let configured = false
let getWindow = null
let lastResult = { status: 'idle', percent: 0, message: '' }

// Текущее состояние + рассылка в окно (для индикатора в интерфейсе)
function emit(payload) {
  lastResult = { ...lastResult, ...payload }
  const win = getWindow?.()
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send('company:update-event', lastResult)
    } catch {
      // окно ещё не готово — не критично
    }
  }
}

function wireEvents() {
  if (configured) return
  configured = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    emit({ status: 'checking', percent: 0, message: 'Проверка обновлений…' })
  })
  autoUpdater.on('update-available', (info) => {
    emit({ status: 'downloading', percent: 0, version: info?.version, message: `Найдено обновление ${info?.version ?? ''}` })
  })
  autoUpdater.on('update-not-available', () => {
    emit({ status: 'latest', percent: 100, message: 'Установлена последняя версия' })
  })
  autoUpdater.on('download-progress', (p) => {
    emit({ status: 'downloading', percent: Math.round(p?.percent ?? 0), message: 'Загрузка обновления…' })
  })
  autoUpdater.on('error', (err) => {
    emit({ status: 'error', message: `Ошибка обновления: ${err?.message ?? err}` })
  })
  autoUpdater.on('update-downloaded', (info) => {
    emit({ status: 'ready', percent: 100, version: info?.version, message: `Обновление ${info?.version ?? ''} готово` })
  })
}

function applySource(settings) {
  if (settings.updateFeedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: settings.updateFeedUrl })
  }
  // Иначе используется зашитый при сборке github-провайдер (kamedoz/emelya_quotation)
}

export async function initAutoUpdate(getMainWindow) {
  getWindow = getMainWindow
  if (!app.isPackaged) {
    emit({ status: 'dev', message: 'Автообновление доступно только в установленной версии' })
    return
  }
  try {
    const settings = await readSettings()
    wireEvents()
    applySource(settings)
    await autoUpdater.checkForUpdates()
  } catch (err) {
    emit({ status: 'error', message: String(err?.message ?? err) })
  }
}

export async function checkForUpdatesManual(getMainWindow) {
  if (getMainWindow) getWindow = getMainWindow
  if (!app.isPackaged) {
    emit({ status: 'dev', message: 'Автообновление доступно только в установленной версии' })
    return lastResult
  }
  try {
    const settings = await readSettings()
    wireEvents()
    applySource(settings)
    await autoUpdater.checkForUpdates()
  } catch (err) {
    emit({ status: 'error', message: String(err?.message ?? err) })
  }
  return lastResult
}

// Установить и перезапустить (вызывается из интерфейса)
export function installUpdate() {
  if (lastResult.status !== 'ready') return false
  setImmediate(() => autoUpdater.quitAndInstall())
  return true
}

export function getUpdateStatus() {
  return lastResult
}
