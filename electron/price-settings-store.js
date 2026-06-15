import fs from 'node:fs/promises'
import path from 'node:path'
import pkg from 'electron'
const { app } = pkg

const defaultPriceSettings = {
  rateOverrides: {},
}

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'price-settings.json')
}

export async function readPriceSettings() {
  try {
    const content = await fs.readFile(getSettingsPath(), 'utf8')
    return {
      ...defaultPriceSettings,
      ...JSON.parse(content),
    }
  } catch {
    return { ...defaultPriceSettings }
  }
}

export async function writePriceSettings(settings) {
  const normalized = {
    ...defaultPriceSettings,
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
