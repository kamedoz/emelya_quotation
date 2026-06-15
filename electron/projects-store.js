import fs from 'node:fs/promises'
import path from 'node:path'

function getProjectsPath() {
  const home = process.env.USERPROFILE || process.env.HOME
  return path.join(home, '.1c-quotation', 'projects.json')
}

export async function loadProjects() {
  try {
    const data = await fs.readFile(getProjectsPath(), 'utf-8')
    const parsed = JSON.parse(data)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export async function saveProjects(projects) {
  const projectsPath = getProjectsPath()
  await fs.mkdir(path.dirname(projectsPath), { recursive: true })
  await fs.writeFile(projectsPath, JSON.stringify(projects ?? [], null, 2), 'utf-8')
  return true
}
