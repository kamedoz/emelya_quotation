import fs from 'node:fs/promises'
import path from 'node:path'
import pkg from 'electron'
const { app } = pkg

const defaultSettings = {
  companyName: 'ООО Компания',
  estimateFolder: '',
  managerEmail: '',
  managerName: '',
  managerPhone: '',
  managerPhotoPath: '',
  managerTitle: 'Менеджер по работе с клиентами',
  nomenclatureFilePath: '',
  proposalValidityDays: 7,
  projectsFilePath: '',
  proposalTemplateName: 'ПРЕМИУМ KNX / ЕМЕЛЯ',
  marginPercent: 0,
  sectionMargins: {},
  updateFeedUrl: '',
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'company-settings.json')
}

export async function readSettings() {
  try {
    const content = await fs.readFile(getSettingsPath(), 'utf8')
    return {
      ...defaultSettings,
      ...JSON.parse(content),
    }
  } catch {
    return { ...defaultSettings }
  }
}

export async function writeSettings(settings) {
  const normalized = {
    ...defaultSettings,
    ...settings,
  }

  await fs.mkdir(path.dirname(getSettingsPath()), { recursive: true })
  await fs.writeFile(
    getSettingsPath(),
    JSON.stringify(normalized, null, 2),
    'utf8',
  )

  return normalized
}
