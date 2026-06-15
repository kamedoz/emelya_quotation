import fs from 'node:fs/promises'
import path from 'node:path'
import pkg from 'electron'
const { app } = pkg

function getCatalogDirectory() {
  return path.join(app.getPath('userData'), 'catalog')
}

export async function ensureCatalogDirectory() {
  const directory = getCatalogDirectory()
  await fs.mkdir(directory, { recursive: true })
  return directory
}

export async function installLocalCatalog(sourceFilePath) {
  if (!sourceFilePath) {
    throw new Error('Не выбран файл каталога.')
  }

  const directory = await ensureCatalogDirectory()
  const extension = path.extname(sourceFilePath) || '.xlsx'
  const targetPath = path.join(directory, `products-catalog${extension}`)

  await fs.copyFile(sourceFilePath, targetPath)
  return targetPath
}

export async function getLocalCatalogInfo() {
  const directory = await ensureCatalogDirectory()
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const file = entries.find((entry) => entry.isFile())

  return {
    directory,
    filePath: file ? path.join(directory, file.name) : '',
  }
}
