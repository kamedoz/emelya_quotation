interface MarginEditorProps {
  marginPercent: number
  sectionMargins: Record<string, number>
  onMarginChange: (marginPercent: number) => void
  onSectionMarginChange: (section: string, value: number | undefined) => void
}

const sectionLabels: Record<string, string> = {
  materials: 'Оборудование',
  works: 'Работы',
  transport: 'Транспорт',
}

const MAX_MARGIN = 200

export function MarginEditor({ marginPercent, sectionMargins, onMarginChange, onSectionMarginChange }: MarginEditorProps) {
  const globalValue = Number.isFinite(marginPercent) ? marginPercent : 0
  const hasOverrides = Object.keys(sectionMargins).length > 0

  return (
    <div className="margin-editor">
      <div className="margin-global">
        <label className="margin-label">
          <span>Общая наценка</span>
          <span className="margin-value">{globalValue}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={MAX_MARGIN}
          step={1}
          value={globalValue}
          onChange={(e) => onMarginChange(Number(e.target.value))}
          className="margin-slider"
        />
        <div className="margin-slider-ticks">
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
        {hasOverrides ? (
          <p className="margin-note">
            Движение общего ползунка сбрасывает индивидуальные наценки категорий.
          </p>
        ) : null}
      </div>

      <p className="margin-subtitle">Наценка по категориям</p>
      <div className="margin-sections">
        {(['materials', 'works', 'transport'] as const).map((section) => {
          const sectionValue = sectionMargins[section]
          const isOverridden = sectionValue !== undefined && sectionValue !== null
          return (
            <label key={section} className="margin-section-row">
              <span className="margin-section-label">{sectionLabels[section]}</span>
              <div className="margin-section-controls">
                <input
                  type="range"
                  min={0}
                  max={MAX_MARGIN}
                  step={1}
                  value={isOverridden ? sectionValue : globalValue}
                  onChange={(e) => {
                    onSectionMarginChange(section, Number(e.target.value))
                  }}
                  className="margin-slider"
                />
                <span className="margin-section-value">
                  {isOverridden ? sectionValue : globalValue}%
                </span>
                <button
                  type="button"
                  className={`margin-reset-btn ${!isOverridden ? 'is-hidden' : ''}`}
                  onClick={() => onSectionMarginChange(section, undefined)}
                  title="Сбросить к общей наценке"
                >
                  ✕
                </button>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
