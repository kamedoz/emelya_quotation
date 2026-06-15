import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { saveEstimateDocument } from '../electron/save-estimate.js'

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDirectory = path.join(rootDirectory, '.tmp-demo-runtime')

async function transpileModuleFile(sourcePath, targetPath) {
  const source = await fs.readFile(sourcePath, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  }).outputText.replace("'../data/workRates'", "'../data/workRates.mjs'")

  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, output, 'utf8')
}

async function prepareQuotationRuntime() {
  const files = [
    ['src/lib/quotation.ts', '.tmp-demo-runtime/src/lib/quotation.mjs'],
    ['src/data/workRates.ts', '.tmp-demo-runtime/src/data/workRates.mjs'],
  ]

  for (const [sourceRelative, targetRelative] of files) {
    await transpileModuleFile(
      path.join(rootDirectory, sourceRelative),
      path.join(rootDirectory, targetRelative),
    )
  }

  const quotationModule = await import(
    pathToFileURL(path.join(tempDirectory, 'src/lib/quotation.mjs')).href
  )

  return quotationModule
}

async function main() {
  const { buildEstimate } = await prepareQuotationRuntime()
  const demoProjects = JSON.parse(
    await fs.readFile(path.join(rootDirectory, 'demo', 'demo-projects.json'), 'utf8'),
  )

  const project = demoProjects[0]
  const profile = 'premium'
  const estimate = buildEstimate(project, profile)
  const scenario = estimate.scenarios.find((item) => item.id === 'knx') ?? estimate.scenarios[0]

  const result = await saveEstimateDocument({
    objectDescription: project.objectType,
    profile,
    project,
    scenario,
    settings: {
      companyName: 'Умный дом Емеля',
      estimateFolder: path.join(rootDirectory, 'demo', 'generated'),
      managerEmail: 'sales@emelya-smart.ru',
      managerName: 'Дмитрий Горьков',
      managerPhone: '+7 915 098 49 90',
      managerPhotoPath: '',
      managerTitle: 'Менеджер по работе с клиентами',
      nomenclatureFilePath: path.join(rootDirectory, 'demo', 'demo-catalog.json'),
      projectsFilePath: path.join(rootDirectory, 'demo', 'demo-projects.json'),
      proposalTemplateName: 'ПРЕМИУМ KNX / ЕМЕЛЯ',
      proposalValidityDays: 7,
    },
  })

  console.log(result.filePath)
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error)
    app.exitCode = 1
    app.quit()
  })
