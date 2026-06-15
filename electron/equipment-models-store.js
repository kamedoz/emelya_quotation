import fs from 'node:fs/promises'
import path from 'node:path'

function getStorePath() {
  const home = process.env.USERPROFILE || process.env.HOME
  return path.join(home, '.1c-quotation', 'equipment-models.json')
}

export async function loadEquipmentModels() {
  try {
    const data = await fs.readFile(getStorePath(), 'utf-8')
    const parsed = JSON.parse(data)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export async function saveEquipmentModels(models) {
  const storePath = getStorePath()
  await fs.mkdir(path.dirname(storePath), { recursive: true })
  await fs.writeFile(storePath, JSON.stringify(models ?? {}, null, 2), 'utf-8')
  return true
}
