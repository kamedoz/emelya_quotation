import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { buildProposalPageSummaries } from './lib/proposal-pages'
import { buildEstimate } from './lib/quotation'
import type {
  CompanyApiSettings,
  OverlayConfig,
  Project,
  SmartHomeProfile,
  SmetaImportResult,
} from './types'
import type { RoomConfig } from './types'
import { buildImportedProposal } from './lib/smeta-to-proposal'
import { MarginEditor } from './components/MarginEditor'
import { ProjectDashboard } from './components/ProjectDashboard'
import { EquipmentOverview } from './components/EquipmentOverview'
import { TemplateEditor } from './components/TemplateEditor'
import { defaultOverlayConfig } from './lib/overlay-config'
import type { CustomModels, ModelSpec } from './data/equipment-models'

type LoadState = 'idle' | 'loading' | 'success' | 'error'
type ObjectKind = 'Дом' | 'Квартира' | 'Коммерческий объект' | 'Офис' | 'Таунхаус'
type Page = 'home' | 'equipment' | 'pdf'
type TemplatePreviewPage = {
  imageUrl: string
  pageNumber: number
  title: string
}

const defaultSettings: CompanyApiSettings = {
  companyName: 'ООО Компания',
  estimateFolder: '',
  managerEmail: '',
  managerName: '',
  managerPhone: '',
  managerPhotoPath: '',
  managerTelegram: '',
  managerTitle: 'Менеджер по работе с клиентами',
  nomenclatureFilePath: '',
  proposalValidityDays: 7,
  projectsFilePath: '',
  proposalTemplateName: 'ПРЕМИУМ KNX / ЕМЕЛЯ',
  marginPercent: 0,
  sectionMargins: {},
  updateFeedUrl: '',
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Произошла ошибка.'
}

const NavIcons: Record<Page, React.ReactNode> = {
  home: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
    </svg>
  ),
  equipment: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" /><circle cx="9" cy="6" r="2" fill="var(--sidebar-bg)" />
      <line x1="4" y1="12" x2="20" y2="12" /><circle cx="15" cy="12" r="2" fill="var(--sidebar-bg)" />
      <line x1="4" y1="18" x2="20" y2="18" /><circle cx="7" cy="18" r="2" fill="var(--sidebar-bg)" />
    </svg>
  ),
  pdf: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  ),
}

const NAV_ITEMS: { id: Page; label: string; step: number }[] = [
  { id: 'home', label: 'Проекты', step: 1 },
  { id: 'equipment', label: 'Оснащение', step: 2 },
  { id: 'pdf', label: 'PDF', step: 3 },
]

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [profile] = useState<SmartHomeProfile>('premium')
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('knx')
  const [settings, setSettings] = useState<CompanyApiSettings>(defaultSettings)
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [loadMessage, setLoadMessage] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [templatePreviewPages, setTemplatePreviewPages] = useState<TemplatePreviewPage[]>([])
  const [objectDescription, setObjectDescription] = useState<ObjectKind>('Дом')
  const [overlayConfig, setOverlayConfig] = useState<OverlayConfig | null>(null)
  const [rateOverrides, setRateOverrides] = useState<Record<string, { minPrice?: number; maxPrice?: number }>>({})
  const [, setRoomConfigs] = useState<RoomConfig[]>([])
  const [page, setPage] = useState<Page>('home')
  const [showProfile, setShowProfile] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [pageOverrides, setPageOverrides] = useState<Record<number, boolean>>({})
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [logoError, setLogoError] = useState(false)
  const [lineOverrides, setLineOverrides] = useState<Record<string, { quantity?: number; unitPrice?: number }>>({})
  const [customModels, setCustomModels] = useState<CustomModels>({})
  const [smetaImport, setSmetaImport] = useState<SmetaImportResult | null>(null)
  const [importName, setImportName] = useState('')
  const [importKind, setImportKind] = useState<ObjectKind>('Дом')
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const bootstrapped = useRef(false)

  useEffect(() => {
    async function bootstrap() {
      try {
        const [loadedSettings, catalogInfo, previewPages, storedProjects] = await Promise.all([
          window.companyApi?.getSettings?.(),
          window.companyApi?.getStoredCatalogInfo?.(),
          window.companyApi?.getTemplatePreviewPages?.(),
          window.companyApi?.loadProjects?.(),
        ])

        if (loadedSettings) {
          setSettings({
            ...defaultSettings,
            ...loadedSettings,
            nomenclatureFilePath:
              loadedSettings.nomenclatureFilePath || catalogInfo?.filePath || '',
          })
        }

        if (previewPages?.length) {
          setTemplatePreviewPages(previewPages)
        }

        if (storedProjects?.length) {
          setProjects(storedProjects)
        }

        const savedConfig = await window.companyApi?.loadOverlayConfig?.()
        if (savedConfig) {
          setOverlayConfig(savedConfig)
        }

        const priceSettings = await window.companyApi?.readPriceSettings?.()
        if (priceSettings?.rateOverrides) {
          setRateOverrides(priceSettings.rateOverrides)
        }

        const storedModels = await window.companyApi?.loadEquipmentModels?.()
        if (storedModels && Object.keys(storedModels).length > 0) {
          setCustomModels(storedModels)
        }
      } catch (error) {
        setLoadState('error')
        setLoadMessage(getErrorMessage(error))
      } finally {
        bootstrapped.current = true
        // Данные загружены — главный процесс закрывает сплеш и показывает окно
        window.companyApi?.appReady?.()
      }
    }

    void bootstrap()
  }, [])

  // Автосохранение настроек (профиль, маржа) с дебаунсом
  useEffect(() => {
    if (!bootstrapped.current) return
    const timer = setTimeout(() => {
      void window.companyApi?.saveSettings?.(settings)
    }, 800)
    return () => clearTimeout(timer)
  }, [settings])

  // Автосохранение списка проектов
  useEffect(() => {
    if (!bootstrapped.current || projects.length === 0) return
    void window.companyApi?.saveProjects?.(projects)
  }, [projects])

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? projects[0],
    [projects, selectedProjectId],
  )

  const baseEstimate = useMemo(() => {
    if (!selectedProject) return null
    return buildEstimate(selectedProject, profile, settings.marginPercent, settings.sectionMargins, rateOverrides)
  }, [profile, selectedProject, settings.marginPercent, settings.sectionMargins, rateOverrides])

  // Ручные правки состава (кол-во / цена строки) поверх расчётной сметы
  const estimate = useMemo(() => {
    if (!baseEstimate) return null
    if (Object.keys(lineOverrides).length === 0) return baseEstimate
    return {
      ...baseEstimate,
      scenarios: baseEstimate.scenarios.map(scenario => {
        const lines = scenario.lines.map(line => {
          const override = lineOverrides[line.code]
          if (!override) return line
          const quantity = override.quantity ?? line.quantity
          const unitPrice = override.unitPrice ?? line.unitPrice
          return { ...line, quantity, unitPrice, total: Math.round(quantity * unitPrice) }
        })
        const materials = lines.filter(l => l.category === 'materials').reduce((s, l) => s + l.total, 0)
        const works = lines.filter(l => l.category === 'works').reduce((s, l) => s + l.total, 0)
        const transport = lines.filter(l => l.category === 'transport').reduce((s, l) => s + l.total, 0)
        const commissioning = lines.find(l => l.code.endsWith('-commissioning'))?.total ?? scenario.commissioningTotal
        return {
          ...scenario,
          lines,
          hardwareTotal: materials,
          installationTotal: works - commissioning,
          commissioningTotal: commissioning,
          total: materials + works + transport,
        }
      }),
    }
  }, [baseEstimate, lineOverrides])

  function handleLineOverride(code: string, patch: { quantity?: number; unitPrice?: number }) {
    setLineOverrides(prev => ({ ...prev, [code]: { ...prev[code], ...patch } }))
  }

  function handleResetLine(code: string) {
    setLineOverrides(prev => {
      const next = { ...prev }
      delete next[code]
      return next
    })
  }

  // Себестоимость / цена с маржой / прибыль по каждому проекту (только для менеджера)
  const projectFinance = useMemo(() => {
    const map: Record<string, { base: number; withMargin: number; profit: number }> = {}
    for (const project of projects) {
      try {
        const noMargin = buildEstimate(project, profile, 0, {}, rateOverrides)
        const withMargin = buildEstimate(project, profile, settings.marginPercent, settings.sectionMargins, rateOverrides)
        const baseScenario = noMargin.scenarios.find(s => s.id === selectedScenarioId) ?? noMargin.scenarios[0]
        const marginScenario = withMargin.scenarios.find(s => s.id === selectedScenarioId) ?? withMargin.scenarios[0]
        if (baseScenario && marginScenario) {
          map[project.id] = {
            base: baseScenario.total,
            withMargin: marginScenario.total,
            profit: marginScenario.total - baseScenario.total,
          }
        }
      } catch {
        // проект с неполными данными не ломает главное меню
      }
    }
    return map
  }, [projects, profile, settings.marginPercent, settings.sectionMargins, rateOverrides, selectedScenarioId])

  async function handleImportSmeta() {
    try {
      setImportMsg('')
      const result = await window.companyApi?.importSmetaPdf?.()
      if (!result) return
      if (!result.sections.length || result.totals.total <= 0) {
        setLoadState('error')
        setLoadMessage(`Не удалось распознать разделы сметы в файле «${result.fileName}». Проверьте, что это смета 1С с разделами и строками «Итого».`)
        return
      }
      setSmetaImport(result)
      setImportName(result.title || result.fileName.replace(/\.pdf$/i, ''))
      setImportKind('Дом')
    } catch (error) {
      setLoadState('error')
      setLoadMessage(getErrorMessage(error))
    }
  }

  async function handleGenerateFromSmeta() {
    if (!smetaImport || importBusy) return
    setImportBusy(true)
    setImportMsg('')
    try {
      const { scenario, proposalPages: pages, project } = buildImportedProposal(
        smetaImport,
        importName.trim() || 'Импортированная смета',
        importKind,
      )
      // Для внешней сметы конкретных количеств нет. Карточки-заглушки оставляем,
      // чтобы они ЗАКРЫЛИ шаблонные цифры, но числа не подставляем (см. pageOverlayFromConfig).
      const cfg = overlayConfig ?? defaultOverlayConfig('premium-knx')
      const result = await window.companyApi?.saveEstimateDocument({
        objectDescription: importKind,
        overlayConfig: cfg,
        profile,
        project,
        proposalPages: pages,
        scenario,
        settings,
      })
      if (result) {
        setImportMsg(`КП сохранено: ${result.filePath}`)
      }
    } catch (error) {
      setImportMsg(getErrorMessage(error))
    } finally {
      setImportBusy(false)
    }
  }

  // Сохранение правок справочника моделей (ключ `scenario:requirement`)
  function handleSaveModels(key: string, specs: ModelSpec[] | null) {
    setCustomModels(prev => {
      const next = { ...prev }
      if (specs === null) delete next[key]
      else next[key] = specs
      void window.companyApi?.saveEquipmentModels?.(next)
      return next
    })
  }

  // При смене проекта ручные правки сбрасываются
  useEffect(() => {
    setLineOverrides({})
  }, [selectedProjectId])

  const activeScenarioId =
    estimate?.scenarios.some((scenario) => scenario.id === selectedScenarioId)
      ? selectedScenarioId
      : estimate?.scenarios[0]?.id ?? ''

  const selectedScenario = estimate?.scenarios.find(
    (scenario) => scenario.id === activeScenarioId,
  )

  const rawProposalPages = useMemo(() => {
    if (!selectedProject || !selectedScenario) return []
    return buildProposalPageSummaries(selectedProject, selectedScenario)
  }, [selectedProject, selectedScenario])

  // Обложку и контакты нельзя выключить
  const LOCKED_PAGES = [1, 18]

  // Эффективные страницы с учётом ручного выбора пользователя
  const proposalPages = useMemo(
    () =>
      rawProposalPages.map((page) => ({
        ...page,
        included: LOCKED_PAGES.includes(page.pageNumber)
          ? true
          : (pageOverrides[page.pageNumber] ?? page.included),
      })),
    [rawProposalPages, pageOverrides],
  )

  // Сбрасываем ручной выбор при смене проекта
  useEffect(() => {
    setPageOverrides({})
  }, [selectedProjectId])

  const proposalPagesWithPreview = useMemo(
    () =>
      proposalPages.map((page) => ({
        ...page,
        locked: LOCKED_PAGES.includes(page.pageNumber),
        preview: templatePreviewPages.find(
          (previewPage) => previewPage.pageNumber === page.pageNumber,
        ),
      })),
    [proposalPages, templatePreviewPages],
  )

  function patchSettings(patch: Partial<CompanyApiSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  async function persistSettings(nextSettings: CompanyApiSettings) {
    const saved = await window.companyApi?.saveSettings(nextSettings)
    if (saved) {
      setSettings(saved)
      return saved
    }
    setSettings(nextSettings)
    return nextSettings
  }

  async function handleChooseFolder() {
    try {
      const folder = await window.companyApi?.chooseEstimateFolder()
      if (folder) patchSettings({ estimateFolder: folder })
    } catch (error) {
      setLoadState('error')
      setLoadMessage(getErrorMessage(error))
    }
  }

  async function handleCheckUpdates() {
    setUpdateChecking(true)
    setUpdateMsg('')
    try {
      // Сохраняем адрес, чтобы main-процесс прочитал его при проверке
      await persistSettings(settings)
      const result = await window.companyApi?.checkUpdates?.()
      setUpdateMsg(result?.message ?? 'Проверка запущена')
    } catch (error) {
      setUpdateMsg(getErrorMessage(error))
    } finally {
      setUpdateChecking(false)
    }
  }

  async function handleChooseManagerPhoto() {
    try {
      const filePath = await window.companyApi?.chooseManagerPhoto()
      if (filePath) {
        setLogoError(false)
        patchSettings({ managerPhotoPath: filePath })
      }
    } catch (error) {
      setLoadState('error')
      setLoadMessage(getErrorMessage(error))
    }
  }

  async function handleLoadDemoWorkspace() {
    setLoadState('loading')
    setLoadMessage('Поднимаю демо-проект, каталог и папку выгрузки для быстрой проверки КП...')
    setSaveMessage('')

    try {
      const demoWorkspace = await window.companyApi?.loadDemoWorkspace()
      if (!demoWorkspace?.imported.projects.length) {
        throw new Error('Не удалось загрузить демо-набор.')
      }

      const nextSettings = {
        ...settings,
        estimateFolder: demoWorkspace.estimateFolder,
        nomenclatureFilePath: demoWorkspace.nomenclatureFilePath,
        projectsFilePath: demoWorkspace.projectsFilePath,
      }

      await persistSettings(nextSettings)
      setProjects(demoWorkspace.imported.projects)
      setSelectedProjectId(demoWorkspace.imported.projects[0]?.id ?? '')
      setObjectDescription(
        (demoWorkspace.imported.projects[0]?.objectType as ObjectKind) || 'Дом',
      )
      setLoadState('success')
      setLoadMessage(
        `Демо-набор загружен. Найдено объектов: ${demoWorkspace.imported.projects.length}. Можно сразу формировать тестовое КП.`,
      )
    } catch (error) {
      setLoadState('error')
      setLoadMessage(getErrorMessage(error))
    }
  }

  function handleSelectProject(project: Project) {
    setSelectedProjectId(project.id)
    setPage('equipment')
  }

  function handleCreateProject(project: Project) {
    setProjects(prev => [...prev, project])
    setSelectedProjectId(project.id)
    setPage('equipment')
  }

  function handleDeleteProject(projectId: string) {
    setProjects(prev => {
      const next = prev.filter(p => p.id !== projectId)
      void window.companyApi?.saveProjects?.(next)
      return next
    })
    if (selectedProjectId === projectId) {
      setSelectedProjectId('')
      setPage('home')
    }
  }

  function navigateTo(target: Page) {
    if (target === 'home') { setPage('home'); return }
    if ((target === 'equipment' || target === 'pdf') && selectedProject) { setPage(target) }
  }

  async function handleSaveEstimate() {
    if (!selectedProject || !selectedScenario || saving) return

    setSaving(true)
    setSaveMessage('')
    try {
      await persistSettings(settings)
      const result = await window.companyApi?.saveEstimateDocument({
        objectDescription,
        overlayConfig: overlayConfig ?? defaultOverlayConfig('premium-knx'),
        profile,
        project: selectedProject,
        proposalPages,
        scenario: selectedScenario,
        settings,
      })

      if (result) {
        setSaveMessage(`КП сохранено: ${result.filePath}`)
      }
    } catch (error) {
      setSaveMessage(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  function isNavEnabled(id: Page) {
    if (id === 'home') return true
    return !!selectedProject
  }

  function handleSidebarClick(id: Page) {
    if (!isNavEnabled(id)) return
    navigateTo(id)
  }

  function renderPageNav(active: 'equipment' | 'pdf') {
    return (
      <div className="page-nav">
        <button className="btn btn-ghost btn-sm" onClick={() => navigateTo(active === 'equipment' ? 'home' : 'equipment')}>
          ← {active === 'equipment' ? 'Проекты' : 'Оснащение'}
        </button>
        <span className="page-nav-title">{selectedProject?.name}</span>
        <div className="page-nav-links">
          <button className="page-nav-link" onClick={() => navigateTo('home')}>Проекты</button>
          <button className={`page-nav-link ${active === 'equipment' ? 'is-active' : ''}`} onClick={() => navigateTo('equipment')}>Оснащение</button>
          <button className={`page-nav-link ${active === 'pdf' ? 'is-active' : ''}`} onClick={() => navigateTo('pdf')}>PDF</button>
        </div>
      </div>
    )
  }

  function renderPage() {
    switch (page) {
      case 'equipment':
        if (!selectedProject || !estimate || !selectedScenario) return null
        return (
          <>
            {renderPageNav('equipment')}

            <div className="section animate-fade-up">
              <EquipmentOverview
                estimate={estimate}
                profile={profile}
                selectedScenarioId={selectedScenario.id}
                onSelectScenario={setSelectedScenarioId}
                lineOverrides={lineOverrides}
                onLineOverride={handleLineOverride}
                onResetLine={handleResetLine}
                customModels={customModels}
                onSaveModels={handleSaveModels}
              />
            </div>

            <div className="section animate-fade-up">
              <div className="section-header">
                <h2>Маржа</h2>
              </div>
              <MarginEditor
                marginPercent={settings.marginPercent}
                sectionMargins={settings.sectionMargins}
                onMarginChange={(v) => patchSettings({ marginPercent: v, sectionMargins: {} })}
                onSectionMarginChange={(key, v) => {
                  setSettings(prev => {
                    const next = { ...prev.sectionMargins }
                    if (v === undefined) delete next[key]
                    else next[key] = v
                    return { ...prev, sectionMargins: next }
                  })
                }}
              />
            </div>

            <div className="section button-row">
              <button className="btn btn-primary" onClick={() => navigateTo('pdf')}>
                Далее → PDF
              </button>
            </div>
          </>
        )

      case 'pdf':
        if (!selectedProject || !estimate || !selectedScenario) return null
        return (
          <>
            {renderPageNav('pdf')}

            <div className="section card animate-fade-up">
              <div className="card-header">
                <h2>Формирование КП</h2>
              </div>
              <div className="field-row">
                <label className="field">
                  <span className="field-label">Описание объекта на обложке</span>
                  <select value={objectDescription}
                    onChange={(event) => setObjectDescription(event.target.value as ObjectKind)}>
                    {['Дом', 'Квартира', 'Коммерческий объект', 'Офис', 'Таунхаус'].map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Папка для сохранения</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={settings.estimateFolder} readOnly placeholder="Выберите папку" style={{ flex: 1 }} />
                    <button type="button" className="btn" onClick={handleChooseFolder}>Выбрать</button>
                  </div>
                </label>
              </div>
              <div className="field-row" style={{ marginTop: 16 }}>
                <label className="field">
                  <span className="field-label">Название компании</span>
                  <input value={settings.companyName} onChange={e => patchSettings({ companyName: e.target.value })} placeholder="ООО Компания" />
                </label>
                <label className="field">
                  <span className="field-label">Срок действия КП, дней</span>
                  <input type="number" min={1} max={30} value={settings.proposalValidityDays}
                    onChange={e => patchSettings({ proposalValidityDays: Math.max(1, Number(e.target.value) || 7) })} />
                </label>
              </div>
            </div>

            {proposalPages.length > 0 && (
              <div className="section animate-fade-up">
                <div className="section-header">
                  <h2>Страницы КП</h2>
                  <span className="section-header-note">
                    Войдёт страниц: {proposalPages.filter(p => p.included).length} · нажмите на карточку, чтобы включить/выключить
                  </span>
                </div>
                <div className="preview-grid">
                  {proposalPagesWithPreview.map(page => (
                    <div
                      key={page.pageNumber}
                      className={`preview-card preview-toggle ${page.included ? 'is-on' : 'is-off'} ${page.locked ? 'is-locked' : ''}`}
                      onClick={() => {
                        if (page.locked) return
                        setPageOverrides(prev => ({ ...prev, [page.pageNumber]: !page.included }))
                      }}
                      title={page.locked ? 'Эта страница входит всегда' : (page.included ? 'Нажмите, чтобы убрать из КП' : 'Нажмите, чтобы добавить в КП')}
                    >
                      <div className="preview-card-head">
                        <span className="preview-num">Страница {page.pageNumber}</span>
                        <span className={`preview-switch ${page.included ? 'on' : 'off'}`}>
                          {page.locked ? '🔒' : (page.included ? '✓' : '')}
                        </span>
                      </div>
                      <strong>{page.title}</strong>
                      <p>{page.description}</p>
                      {page.preview ? (
                        <img
                          src={page.preview.imageUrl}
                          alt={page.title}
                          className="preview-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <div className="preview-thumb-broken">Нет изображения</div>
                      )}
                      <div className="preview-values">
                        {page.countLabel ? <span>{page.countLabel}: {page.countValues?.join(', ') ?? '—'}</span> : null}
                        {page.amountLabel ? <span>{page.amountLabel}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="section button-row">
              <button className="btn btn-primary" onClick={handleSaveEstimate} disabled={saving}>
                {saving ? 'Формируется…' : 'Сформировать PDF'}
              </button>
              <button className="btn" onClick={() => setShowEditor(true)} title="Подвинуть и поправить значения на страницах перед выгрузкой">
                Редактор КП
              </button>
              {saveMessage ? <span className="save-msg">{saveMessage}</span> : null}
            </div>
          </>
        )

      default:
        return (
          <>
            {loadState === 'error' ? (
              <div className="error-banner">{loadMessage}</div>
            ) : null}
            {loadState === 'success' && loadMessage ? (
              <div className="success-banner">{loadMessage}</div>
            ) : null}
            <ProjectDashboard
              projects={projects}
              onSelectProject={handleSelectProject}
              onCreateProject={handleCreateProject}
              onDeleteProject={handleDeleteProject}
              onUpdateRoomConfig={setRoomConfigs}
              onLoadDemo={handleLoadDemoWorkspace}
              onImportSmeta={handleImportSmeta}
              finance={projectFinance}
            />
          </>
        )
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">Е</div>
          <div>
            <div className="sidebar-brand-text">Емеля</div>
            <div className="sidebar-brand-sub">Умный дом</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar-link ${page === item.id ? 'is-active' : ''} ${!isNavEnabled(item.id) ? 'is-disabled' : ''}`}
              onClick={() => handleSidebarClick(item.id)}
              title={!isNavEnabled(item.id) ? 'Сначала выберите проект' : undefined}
            >
              <span className="sidebar-link-icon">{NavIcons[item.id]}</span>
              <span>{item.label}</span>
              <span className="sidebar-link-step">{item.step}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-footer">
          <button className="sidebar-profile-btn" onClick={() => setShowProfile(true)}>
            <div className="sidebar-profile-avatar">
              {settings.managerPhotoPath && !logoError ? (
                <img src={settings.managerPhotoPath} alt="" onError={() => setLogoError(true)} />
              ) : settings.managerName ? (
                settings.managerName.charAt(0).toUpperCase()
              ) : (
                '•'
              )}
            </div>
            <span>{settings.managerName || 'Профиль'}</span>
          </button>
        </div>
      </aside>

      <main className="app-content">
        {renderPage()}
      </main>

      {showProfile ? (
        <div className="modal-backdrop" onClick={() => setShowProfile(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h2>Профиль менеджера</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowProfile(false)}>✕</button>
            </div>
            <p className="modal-hint">Эти данные подставляются на обложку КП. Сохраняются автоматически.</p>
            <div className="profile-grid">
              <label className="field"><span className="field-label">ФИО</span>
                <input value={settings.managerName} onChange={e => patchSettings({ managerName: e.target.value })} placeholder="Иванов Иван" />
              </label>
              <label className="field"><span className="field-label">Должность</span>
                <input value={settings.managerTitle} onChange={e => patchSettings({ managerTitle: e.target.value })} placeholder="Менеджер по работе с клиентами" />
              </label>
              <label className="field"><span className="field-label">Email</span>
                <input value={settings.managerEmail} onChange={e => patchSettings({ managerEmail: e.target.value })} placeholder="mail@company.ru" />
              </label>
              <label className="field"><span className="field-label">Телефон</span>
                <input value={settings.managerPhone} onChange={e => patchSettings({ managerPhone: e.target.value })} placeholder="+7 900 000 00 00" />
              </label>
              <label className="field"><span className="field-label">Telegram</span>
                <input value={settings.managerTelegram} onChange={e => patchSettings({ managerTelegram: e.target.value })} placeholder="t.me/username" />
              </label>
              <label className="field"><span className="field-label">Срок КП, дней</span>
                <input type="number" min={1} max={30} value={settings.proposalValidityDays}
                  onChange={e => patchSettings({ proposalValidityDays: Math.max(1, Number(e.target.value) || 7) })} />
              </label>
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <span className="field-label">Фото</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={settings.managerPhotoPath} readOnly placeholder="Выберите фото" style={{ flex: 1 }} />
                <button type="button" className="btn" onClick={handleChooseManagerPhoto}>Выбрать</button>
              </div>
            </div>

            <div className="update-section">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <h3 style={{ fontSize: 16 }}>Обновления программы</h3>
              </div>
              <p className="modal-hint" style={{ marginTop: 0 }}>
                Программа проверяет новые версии на GitHub при запуске и предлагает установку. Поле ниже — только для своего сервера обновлений (необязательно).
              </p>
              <div className="field">
                <span className="field-label">Свой сервер обновлений (необязательно)</span>
                <input value={settings.updateFeedUrl ?? ''} onChange={e => patchSettings({ updateFeedUrl: e.target.value })} placeholder="оставьте пустым — обновления из GitHub" />
              </div>
              <div className="button-row" style={{ marginTop: 12 }}>
                <button type="button" className="btn" disabled={updateChecking} onClick={handleCheckUpdates}>
                  {updateChecking ? 'Проверка…' : 'Проверить обновления'}
                </button>
                {updateMsg ? <span className="save-msg">{updateMsg}</span> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {smetaImport ? (
        <div className="modal-backdrop" onClick={() => !importBusy && setSmetaImport(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h2>Импорт сметы → КП</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setSmetaImport(null)}>✕</button>
            </div>
            <p className="modal-hint">
              Файл «{smetaImport.fileName}» распознан. Проверьте данные и сформируйте КП по шаблону.
            </p>
            <div className="profile-grid">
              <label className="field"><span className="field-label">Название проекта (на обложке)</span>
                <input value={importName} onChange={e => setImportName(e.target.value)} placeholder="Название объекта" />
              </label>
              <label className="field"><span className="field-label">Описание объекта</span>
                <select value={importKind} onChange={e => setImportKind(e.target.value as ObjectKind)}>
                  {['Дом', 'Квартира', 'Коммерческий объект', 'Офис', 'Таунхаус'].map(item => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="field"><span className="field-label">Технология</span>
                <select value={smetaImport.techId}
                  onChange={e => setSmetaImport({ ...smetaImport, techId: e.target.value })}>
                  <option value="knx">KNX</option>
                  <option value="wiren-board">Wiren Board</option>
                  <option value="zigbee">Zigbee</option>
                </select>
              </label>
              <label className="field"><span className="field-label">Папка для сохранения</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={settings.estimateFolder} readOnly placeholder="Выберите папку" style={{ flex: 1 }} />
                  <button type="button" className="btn" onClick={handleChooseFolder}>Выбрать</button>
                </div>
              </label>
            </div>

            <div className="table-wrap" style={{ marginTop: 18 }}>
              <table className="equipment-table">
                <thead>
                  <tr>
                    <th>Раздел сметы</th>
                    <th className="num">Материалы</th>
                    <th className="num">Работы</th>
                    <th className="num">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {smetaImport.sections.map((section, i) => (
                    <tr key={i}>
                      <td><strong>{section.name}</strong></td>
                      <td className="num">{section.materials.toLocaleString('ru-RU')} ₽</td>
                      <td className="num">{section.works.toLocaleString('ru-RU')} ₽</td>
                      <td className="num">{section.total.toLocaleString('ru-RU')} ₽</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Итого по смете</td>
                    <td className="num">{smetaImport.totals.materials.toLocaleString('ru-RU')} ₽</td>
                    <td className="num">{smetaImport.totals.works.toLocaleString('ru-RU')} ₽</td>
                    <td className="num">{smetaImport.totals.total.toLocaleString('ru-RU')} ₽</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="button-row" style={{ marginTop: 18 }}>
              <button className="btn btn-primary" onClick={handleGenerateFromSmeta} disabled={importBusy || !settings.estimateFolder}>
                {importBusy ? 'Формируется…' : 'Сформировать PDF по шаблону'}
              </button>
              {!settings.estimateFolder ? <span className="modal-hint" style={{ margin: 0 }}>Сначала выберите папку для сохранения</span> : null}
              {importMsg ? <span className="save-msg">{importMsg}</span> : null}
            </div>
          </div>
        </div>
      ) : null}

      {showEditor ? (
        <div className="editor-overlay">
          <div className="editor-shell">
            <div className="editor-head">
              <div>
                <h2>Редактор КП</h2>
                <span className="editor-head-sub">Перетаскивайте карточки, меняйте размеры и значения. Влияет на выгружаемый PDF.</span>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowEditor(false)}>Закрыть</button>
            </div>
            <TemplateEditor
              pages={templatePreviewPages}
              config={overlayConfig ?? defaultOverlayConfig('premium-knx')}
              pageData={proposalPages}
              onSave={(cfg) => {
                setOverlayConfig(cfg)
                void window.companyApi?.saveOverlayConfig?.(cfg)
                setShowEditor(false)
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
