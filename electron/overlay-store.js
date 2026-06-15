import fs from 'node:fs/promises'
import path from 'node:path'

const OVERLAY_CONFIG_VERSION = 2

let configCache = null

function getConfigPath() {
  const home = process.env.USERPROFILE || process.env.HOME
  return path.join(home, '.1c-quotation', 'overlay-config.json')
}

export async function loadOverlayConfig() {
  if (configCache) return configCache
  const configPath = getConfigPath()
  try {
    const data = await fs.readFile(configPath, 'utf-8')
    const parsed = JSON.parse(data)
    if (parsed?.configVersion !== OVERLAY_CONFIG_VERSION) {
      return null
    }
    configCache = parsed
    return configCache
  } catch {
    return null
  }
}

export async function saveOverlayConfig(config) {
  const configPath = getConfigPath()
  await fs.mkdir(path.dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify({ ...config, configVersion: OVERLAY_CONFIG_VERSION }, null, 2), 'utf-8')
  configCache = { ...config, configVersion: OVERLAY_CONFIG_VERSION }
  return true
}

export function clearConfigCache() {
  configCache = null
}
