import { useState } from 'react'
import type { EstimateLine, ProjectEstimate, SmartHomeProfile } from '../types'
import {
  computeModelQty,
  getDefaultSpecs,
  getLineSpecs,
  modelKey,
  type CustomModels,
  type ModelSpec,
} from '../data/equipment-models'

const profileLabels: Record<SmartHomeProfile, string> = {
  balanced: 'Сбалансированный',
  premium: 'Премиум',
  essential: 'Базовый',
}

interface Props {
  estimate: ProjectEstimate
  profile: SmartHomeProfile
  selectedScenarioId: string
  onSelectScenario: (id: string) => void
  lineOverrides?: Record<string, { quantity?: number; unitPrice?: number }>
  onLineOverride?: (code: string, patch: { quantity?: number; unitPrice?: number }) => void
  onResetLine?: (code: string) => void
  customModels?: CustomModels
  onSaveModels?: (key: string, specs: ModelSpec[] | null) => void
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
}

// Щитовое оборудование — контроллер, интерфейсы, шкаф автоматики.
// Полевое — датчики, выключатели и прочие устройства по помещениям.
function isPanelLine(line: EstimateLine) {
  return line.code.endsWith('-controller')
}

export function EquipmentOverview({
  estimate, profile, selectedScenarioId, onSelectScenario,
  lineOverrides = {}, onLineOverride, onResetLine,
  customModels = {}, onSaveModels,
}: Props) {
  const selectedScenario = estimate.scenarios.find(s => s.id === selectedScenarioId) ?? estimate.scenarios[0]
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [editingModels, setEditingModels] = useState<string | null>(null)
  const [draftSpecs, setDraftSpecs] = useState<ModelSpec[]>([])

  function toggleRow(code: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  function startEditModels(line: EstimateLine) {
    const { specs } = getLineSpecs(selectedScenario.id, line.code, customModels)
    setDraftSpecs(specs.map(s => ({ ...s })))
    setEditingModels(line.code)
  }

  function patchDraft(index: number, patch: Partial<ModelSpec>) {
    setDraftSpecs(prev => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function saveDraft(line: EstimateLine) {
    const cleaned = draftSpecs.filter(s => s.model.trim())
    onSaveModels?.(modelKey(selectedScenario.id, line.code), cleaned)
    setEditingModels(null)
  }

  function resetToDefault(line: EstimateLine) {
    onSaveModels?.(modelKey(selectedScenario.id, line.code), null)
    setEditingModels(null)
  }

  const editable = !!onLineOverride

  const groups: { key: string; title: string; lines: EstimateLine[] }[] = [
    { key: 'panel', title: 'Щитовое оборудование', lines: selectedScenario.lines.filter(l => l.category === 'materials' && isPanelLine(l)) },
    { key: 'field', title: 'Полевое оборудование', lines: selectedScenario.lines.filter(l => l.category === 'materials' && !isPanelLine(l)) },
    { key: 'works', title: 'Работы', lines: selectedScenario.lines.filter(l => l.category === 'works') },
    { key: 'transport', title: 'Транспорт', lines: selectedScenario.lines.filter(l => l.category === 'transport') },
  ].filter(g => g.lines.length > 0)

  function renderModelsBlock(line: EstimateLine) {
    const { specs, isCustom } = getLineSpecs(selectedScenario.id, line.code, customModels)
    const hasDefaults = getDefaultSpecs(selectedScenario.id, line.code).length > 0
    const isEditing = editingModels === line.code

    if (!isEditing && specs.length === 0 && !onSaveModels) return null

    if (isEditing) {
      return (
        <div className="line-models is-editing" onClick={e => e.stopPropagation()}>
          <div className="line-models-title">Редактирование модельного состава</div>
          {draftSpecs.map((spec, i) => (
            <div key={i} className="line-models-edit-row">
              <input
                className="line-models-edit-name"
                value={spec.model}
                placeholder="Модель оборудования"
                onChange={e => patchDraft(i, { model: e.target.value })}
              />
              <select
                className="line-models-edit-mode"
                value={spec.mode}
                onChange={e => patchDraft(i, { mode: e.target.value as ModelSpec['mode'] })}
              >
                <option value="per">на каждые N шт.</option>
                <option value="fixed">фиксированно</option>
              </select>
              <input
                type="number"
                min={spec.mode === 'per' ? 1 : 0}
                className="line-models-edit-value"
                value={spec.value}
                title={spec.mode === 'per' ? '1 шт. на каждые N единиц позиции' : 'Точное количество'}
                onChange={e => patchDraft(i, { value: Math.max(0, Number(e.target.value) || 0) })}
              />
              <span className="line-models-qty">= {computeModelQty(spec, line.quantity)} шт.</span>
              <button className="line-reset-btn" title="Удалить строку" onClick={() => setDraftSpecs(prev => prev.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <div className="line-models-edit-actions">
            <button className="btn btn-sm" onClick={() => setDraftSpecs(prev => [...prev, { model: '', mode: 'per', value: 1 }])}>+ Добавить модель</button>
            <div style={{ flex: 1 }} />
            {hasDefaults && isCustom ? (
              <button className="btn btn-ghost btn-sm" onClick={() => resetToDefault(line)}>Вернуть по умолчанию</button>
            ) : null}
            <button className="btn btn-ghost btn-sm" onClick={() => setEditingModels(null)}>Отмена</button>
            <button className="btn btn-primary btn-sm" onClick={() => saveDraft(line)}>Сохранить</button>
          </div>
        </div>
      )
    }

    return (
      <div className="line-models" onClick={e => e.stopPropagation()}>
        <div className="line-models-title">
          <span>Модельный состав — для проверки, в PDF не попадает{isCustom ? ' · изменён' : ''}</span>
          {onSaveModels ? (
            <button className="line-models-edit-btn" onClick={() => startEditModels(line)}>Изменить</button>
          ) : null}
        </div>
        {specs.length > 0 ? specs.map((spec, i) => (
          <div key={i} className="line-models-row">
            <span>{spec.model}</span>
            <span className="line-models-qty">{computeModelQty(spec, line.quantity)} шт.</span>
          </div>
        )) : (
          <div className="line-models-row" style={{ color: 'var(--text-dim)' }}>
            Состав не задан — нажмите «Изменить», чтобы добавить модели
          </div>
        )}
      </div>
    )
  }

  function renderLineRow(line: EstimateLine) {
    const override = lineOverrides[line.code]
    const isOverridden = !!override
    const expanded = expandedRows.has(line.code)
    const hasModels = line.category === 'materials' &&
      (getLineSpecs(selectedScenario.id, line.code, customModels).specs.length > 0 || !!onSaveModels)
    const expandable = !!line.note || hasModels
    return (
      <tr key={line.code} className={isOverridden ? 'is-overridden' : ''}>
        <td style={{ cursor: expandable ? 'pointer' : 'default', userSelect: 'none' }} onClick={() => expandable && toggleRow(line.code)}>
          {expandable ? (
            <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'none' }}>▶</span>
          ) : ''}
        </td>
        <td onClick={() => expandable && toggleRow(line.code)} style={{ cursor: expandable ? 'pointer' : 'default' }}>
          <strong>{line.title}</strong>
          {!expanded && line.note && (
            <span className="line-note-collapsed">{line.note}</span>
          )}
          {expanded && line.note && (
            <div className="line-note-expanded">{line.note}</div>
          )}
          {expanded && line.category === 'materials' && renderModelsBlock(line)}
        </td>
        <td className="num">
          {editable ? (
            <input
              type="number"
              min={0}
              className="line-edit-input"
              value={line.quantity}
              onChange={e => onLineOverride?.(line.code, { quantity: Math.max(0, Number(e.target.value) || 0) })}
            />
          ) : line.quantity}
        </td>
        <td className="num">
          {editable ? (
            <input
              type="number"
              min={0}
              step={100}
              className="line-edit-input line-edit-price"
              value={line.unitPrice}
              onChange={e => onLineOverride?.(line.code, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
            />
          ) : formatMoney(line.unitPrice)}
        </td>
        <td className="num"><strong>{formatMoney(line.total)}</strong></td>
        <td className="num" style={{ width: 36 }}>
          {isOverridden ? (
            <button className="line-reset-btn" title="Сбросить к расчётному значению" onClick={() => onResetLine?.(line.code)}>↺</button>
          ) : null}
        </td>
      </tr>
    )
  }

  return (
    <>
      <div className="section-header">
        <h2>Оснащение</h2>
        <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>{profileLabels[profile]}</span>
      </div>

      <div className="scenario-grid">
        {estimate.scenarios.map(sc => (
          <button key={sc.id} type="button"
            className={`scenario-card ${sc.id === selectedScenario.id ? 'is-selected' : ''}`}
            onClick={() => onSelectScenario(sc.id)}>
            <div className="scenario-card-top">
              <span className="scenario-card-title">{sc.title}</span>
              <span className="scenario-card-badge">{sc.reliabilityLabel}</span>
            </div>
            <div className="scenario-card-amount">{formatMoney(sc.total)}</div>
            <p className="scenario-card-desc">{sc.summary}</p>
            <dl className="scenario-card-details">
              <dt>Оборудование</dt>
              <dd>{formatMoney(sc.hardwareTotal)}</dd>
              <dt>Монтаж</dt>
              <dd>{formatMoney(sc.installationTotal)}</dd>
              <dt>Пусконаладка</dt>
              <dd>{formatMoney(sc.commissioningTotal)}</dd>
              <dt>Срок поставки</dt>
              <dd>{sc.leadTime}</dd>
            </dl>
          </button>
        ))}
      </div>

      <div className="section-header">
        <h3>
          Детальный состав — {selectedScenario.title}
          <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 400, color: 'var(--text-soft)' }}>
            / {profileLabels[profile]}
          </span>
        </h3>
        {editable ? (
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Количество и цены можно править — итоги и PDF пересчитаются
          </span>
        ) : null}
      </div>

      {groups.map(group => {
        const subtotal = group.lines.reduce((s, l) => s + l.total, 0)
        return (
          <div key={group.key} className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="equipment-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}></th>
                  <th>{group.title}</th>
                  <th className="num" style={{ width: 90 }}>Кол-во</th>
                  <th className="num" style={{ width: 130 }}>Цена</th>
                  <th className="num" style={{ width: 130 }}>Сумма</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {group.lines.map(renderLineRow)}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Итого: {group.title.toLowerCase()}</td>
                  <td className="num">{formatMoney(subtotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      })}

      <div className="estimate-total-bar">
        <span>Итого по смете</span>
        <strong>{formatMoney(selectedScenario.total)}</strong>
      </div>
    </>
  )
}
