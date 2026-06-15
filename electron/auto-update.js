import pkg from 'electron'
import electronUpdater from 'electron-updater'
import { readSettings } from './config-store.js'

const { app, dialog } = pkg
const { autoUpdater } = electronUpdater

let configured = false
let lastResult = { status: 'idle', message: '' }

function wireEvents(getMainWindow) {
  if (configured) return
  configured = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    lastResult = { status: 'checking', message: 'Проверка обновлений…' }
  })
  autoUpdater.on('update-available', (info) => {
    lastResult = { status: 'downloading', message: `Загрузка обновления ${info?.version ?? ''}…` }
  })
  autoUpdater.on('update-not-available', () => {
    lastResult = { status: 'latest', message: 'Установлена последняя версия' }
  })
  autoUpdater.on('error', (err) => {
    lastResult = { status: 'error', message: `Ошибка обновления: ${err?.message ?? err}` }
  })
  autoUpdater.on('update-downloaded', async (info) => {
    lastResult = { status: 'ready', message: `Обновление ${info?.version ?? ''} готово` }
    const win = getMainWindow?.()
    const { response } = await dialog.showMessageBox(win ?? undefined, {
      type: 'info',
      buttons: ['Перезапустить сейчас', 'Позже'],
      defaultId: 0,
      cancelId: 1,
      title: 'Доступно обновление',
      message: `Загружена новая версия ${info?.version ?? ''}.`,
      detail: 'Перезапустить программу, чтобы установить обновление?',
    })
    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall())
    }
  })
}

// Применяем источник: свой HTTP-адрес (если задан) либо релизы GitHub из сборки
function applySource(settings) {
  if (settings.updateFeedUrl) {
    autoUpdater.setFeedURL({ provider: 'generic', url: settings.updateFeedUrl })
  }
  // Иначе используется зашитый при сборке github-провайдер (kamedoz/emelya_quotation)
}

// Тихая проверка при запуске
export async function initAutoUpdate(getMainWindow) {
  if (!app.isPackaged) {
    lastResult = { status: 'dev', message: 'Автообновление доступно только в установленной версии' }
    return
  }
  try {
    const settings = await readSettings()
    wireEvents(getMainWindow)
    applySource(settings)
    await autoUpdater.checkForUpdates()
  } catch (err) {
    lastResult = { status: 'error', message: String(err?.message ?? err) }
  }
}

// Ручная проверка из интерфейса
export async function checkForUpdatesManual(getMainWindow) {
  if (!app.isPackaged) {
    lastResult = { status: 'dev', message: 'Автообновление доступно только в установленной версии' }
    return lastResult
  }
  try {
    const settings = await readSettings()
    wireEvents(getMainWindow)
    applySource(settings)
    await autoUpdater.checkForUpdates()
  } catch (err) {
    lastResult = { status: 'error', message: String(err?.message ?? err) }
  }
  return lastResult
}

export function getUpdateStatus() {
  return lastResult
}
