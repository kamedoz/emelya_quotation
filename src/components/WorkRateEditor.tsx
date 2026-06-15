import { workRates } from '../data/workRates'

interface WorkRateEditorProps {
  rateOverrides: Record<string, { minPrice?: number; maxPrice?: number }>
  onChange: (overrides: Record<string, { minPrice?: number; maxPrice?: number }>) => void
}

type WorkRate = { code: string; title: string; unitLabel: string; minPrice: number; maxPrice: number }

const sectionMeta: Record<string, { label: string; icon: string }> = {
  design: { label: 'Проектные работы', icon: '📐' },
  server: { label: 'Сервер и интерфейс', icon: '🖥' },
  lighting: { label: 'Освещение', icon: '💡' },
  curtains: { label: 'Шторы', icon: '🪟' },
  safety: { label: 'Безопасность', icon: '🔒' },
  climate: { label: 'Климат', icon: '🌡' },
  warmFloor: { label: 'Тёплые полы', icon: '🔥' },
}

export function WorkRateEditor({ rateOverrides, onChange }: WorkRateEditorProps) {
  const sections = Object.entries(workRates) as [string, Record<string, WorkRate>][]

  function updateRate(path: string, field: 'minPrice' | 'maxPrice', value: number) {
    const current = rateOverrides[path] ?? {}
    onChange({ ...rateOverrides, [path]: { ...current, [field]: value } })
  }

  function resetRate(path: string) {
    const next = { ...rateOverrides }
    delete next[path]
    onChange(next)
  }

  return (
    <div className="workrate-editor">
      {sections.map(([sectionKey, rates]) => {
        const meta = sectionMeta[sectionKey] ?? { label: sectionKey, icon: '📋' }
        const entries = Object.entries(rates) as [string, WorkRate][]
        return (
          <details key={sectionKey} className="workrate-section" open>
            <summary className="workrate-section-title">
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
              <span className="workrate-count">{entries.length}</span>
            </summary>
            <div className="workrate-rows">
              {entries.map(([, rate]) => {
                const key = rate.code
                const override = rateOverrides[key] ?? {}
                const minVal = override.minPrice ?? rate.minPrice
                const maxVal = override.maxPrice ?? rate.maxPrice
                const isOverridden = override.minPrice !== undefined || override.maxPrice !== undefined
                return (
                  <div key={key} className={`workrate-row ${isOverridden ? 'is-overridden' : ''}`}>
                    <div className="workrate-info">
                      <span className="workrate-title">{rate.title}</span>
                      <span className="workrate-unit">{rate.unitLabel}</span>
                    </div>
                    <div className="workrate-fields">
                      <label className="workrate-field">
                        <span>от</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={minVal}
                          onChange={(e) => updateRate(key, 'minPrice', Number(e.target.value) || 0)}
                        />
                      </label>
                      <label className="workrate-field">
                        <span>до</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={maxVal}
                          onChange={(e) => updateRate(key, 'maxPrice', Number(e.target.value) || 0)}
                        />
                      </label>
                      <button
                        type="button"
                        className={`workrate-reset ${!isOverridden ? 'is-hidden' : ''}`}
                        onClick={() => resetRate(key)}
                        title="Сбросить"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        )
      })}
    </div>
  )
}
