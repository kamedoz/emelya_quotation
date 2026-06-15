import { useCallback, useEffect, useRef, useState } from 'react'
import type { OverlayConfig, ProposalPageSummary } from '../types'

function formatVal(n: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
}

interface Props {
  pages: Array<{ pageNumber: number; imageUrl: string; title: string }>
  config: OverlayConfig
  onSave: (config: OverlayConfig) => void
  onConfigChange?: (config: OverlayConfig) => void
  pageData?: ProposalPageSummary[]
}

const PAGE_SIZE = 595.2
const TEMPLATE_SIZE = 1600
const SCALE = PAGE_SIZE / TEMPLATE_SIZE
const ZOOM = 1.0
const CANVAS_W = Math.round(PAGE_SIZE * ZOOM)
const CANVAS_H = Math.round(PAGE_SIZE * ZOOM)
const DRAG_SENSITIVITY = 0.4

type ElKind = 'count' | 'price' | 'text'
type HandleDir = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e'

interface DragState {
  kind: ElKind
  index: number
  field: 'x' | 'y' | 'width' | 'height'
  startVal: number
  startMouseX: number
  startMouseY: number
  mode: 'move' | 'resize'
  resizeDir?: HandleDir
}

function px(v: number) { return Math.round(v * SCALE * ZOOM) }

export function TemplateEditor({ pages, config, onSave, onConfigChange, pageData }: Props) {
  const [selectedPage, setSelectedPage] = useState(6)
  const [editConfig, setEditConfig] = useState<OverlayConfig>(config)
  const [selectedEl, setSelectedEl] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoveredEl, setHoveredEl] = useState<string | null>(null)
  const userEditFlag = useRef(false)

  useEffect(() => { setEditConfig(config) }, [config])

  useEffect(() => {
    if (!userEditFlag.current) return
    const timer = setTimeout(() => { onConfigChange?.(editConfig); userEditFlag.current = false }, 500)
    return () => clearTimeout(timer)
  }, [editConfig, onConfigChange])

  const cfg = editConfig.pages?.[selectedPage]
  const items: { kind: ElKind; index: number; label: string }[] = []
  if (cfg) {
    cfg.countCards?.forEach((_, i) => items.push({ kind: 'count', index: i, label: `Счёт ${i + 1}` }))
    cfg.priceCards?.forEach((_, i) => items.push({ kind: 'price', index: i, label: `${cfg.priceCards[i].category === 'materials' ? 'Материалы' : 'Работы'} ${i + 1}` }))
    cfg.texts?.forEach((t, i) => items.push({ kind: 'text', index: i, label: `Текст: ${(t.text || '').slice(0, 14) || `№${i + 1}`}` }))
  }

  const getRect = useCallback((kind: ElKind, index: number) => {
    const arr = kind === 'count' ? cfg?.countCards : kind === 'price' ? cfg?.priceCards : cfg?.texts
    return arr?.[index] as { rect: { x: number; y: number; width: number; height: number; radius?: number } } | undefined
  }, [cfg])

  // Добавить текстовый блок по центру страницы
  const addText = useCallback(() => {
    userEditFlag.current = true
    setEditConfig(prev => {
      const pages = { ...prev.pages }
      const pc = { ...(pages[selectedPage] || { countCards: [], priceCards: [] }) }
      const texts = [...(pc.texts || [])]
      texts.push({
        rect: { x: 300, y: 700, width: 700, height: 120, radius: 0 },
        text: 'Новый текст', size: 34, color: '#ffffff', weight: 600, align: 'left', lineHeight: 1.25,
      })
      pc.texts = texts
      pages[selectedPage] = pc
      return { ...prev, pages }
    })
  }, [selectedPage])

  // Изменить произвольное свойство текстового блока
  const updateTextProp = useCallback((index: number, prop: string, value: string | number | undefined) => {
    userEditFlag.current = true
    setEditConfig(prev => {
      const pages = { ...prev.pages }
      const pc = { ...(pages[selectedPage] || { countCards: [], priceCards: [] }) }
      const texts = [...(pc.texts || [])]
      texts[index] = { ...texts[index], [prop]: value }
      pc.texts = texts
      pages[selectedPage] = pc
      return { ...prev, pages }
    })
  }, [selectedPage])

  // Удалить элемент (нужно прежде всего для текстов)
  const deleteEl = useCallback((kind: ElKind, index: number) => {
    userEditFlag.current = true
    setSelectedEl(null)
    setEditConfig(prev => {
      const pages = { ...prev.pages }
      const pc = { ...(pages[selectedPage] || { countCards: [], priceCards: [] }) }
      const key = kind === 'count' ? 'countCards' : kind === 'price' ? 'priceCards' : 'texts'
      const arr = [...((pc as any)[key] || [])]
      arr.splice(index, 1)
      ;(pc as any)[key] = arr
      pages[selectedPage] = pc
      return { ...prev, pages }
    })
  }, [selectedPage])

  const updateField = useCallback((kind: ElKind, index: number, field: string, value: number) => {
    userEditFlag.current = true
    setEditConfig(prev => {
      const pages = { ...prev.pages }
      const pc = { ...(pages[selectedPage] || { countCards: [], priceCards: [] }) }
      const key = kind === 'count' ? 'countCards' : kind === 'price' ? 'priceCards' : 'texts'
      const arr = [...((pc as any)[key] || [])]
      const item = { ...arr[index] }
      if (field === 'textX' || field === 'textY' || field === 'textWidth') {
        (item as any)[field] = value
      } else {
        item.rect = { ...item.rect, [field]: value }
      }
      arr[index] = item
      ;(pc as any)[key] = arr
      pages[selectedPage] = pc
      return { ...prev, pages }
    })
  }, [selectedPage])

  const setOverride = useCallback((kind: 'count' | 'price', index: number, value: string) => {
    userEditFlag.current = true
    setEditConfig(prev => {
      const pages = { ...prev.pages }
      const pc = { ...(pages[selectedPage] || { countCards: [], priceCards: [] }) }
      const key = kind === 'count' ? 'overrideCounts' : 'overrideAmounts'
      const arr = [...(pc[key] || [])]
      arr[index] = kind === 'count' ? (value ? Number(value) : null) : (value || null)
      ;(pc as any)[key] = arr
      pages[selectedPage] = pc
      return { ...prev, pages }
    })
  }, [selectedPage])

  const startDrag = useCallback((kind: ElKind, index: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = getRect(kind, index)
    if (!rect) return
    setDrag({
      kind, index,
      field: 'x', startVal: rect.rect.x,
      startMouseX: e.clientX, startMouseY: e.clientY,
      mode: 'move',
    })
    setSelectedEl(`${kind}-${index}`)
  }, [getRect])

  const startResize = useCallback((kind: ElKind, index: number, dir: HandleDir, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = getRect(kind, index)
    if (!rect) return
    setDrag({
      kind, index,
      field: 'width', startVal: rect.rect.x,
      startMouseX: e.clientX, startMouseY: e.clientY,
      mode: 'resize', resizeDir: dir,
    })
    setSelectedEl(`${kind}-${index}`)
  }, [getRect])

  useEffect(() => {
    if (!drag) return
    const handleMove = (e: MouseEvent) => {
      const rawDx = (e.clientX - drag.startMouseX) / ZOOM / SCALE
      const rawDy = (e.clientY - drag.startMouseY) / ZOOM / SCALE
      const dx = Math.round(rawDx * DRAG_SENSITIVITY)
      const dy = Math.round(rawDy * DRAG_SENSITIVITY)
      const rect = getRect(drag.kind, drag.index)
      if (!rect) return

      if (drag.mode === 'move') {
        updateField(drag.kind, drag.index, 'x', Math.max(0, rect.rect.x + dx))
        updateField(drag.kind, drag.index, 'y', Math.max(0, rect.rect.y + dy))
      } else if (drag.mode === 'resize' && drag.resizeDir) {
        const dir = drag.resizeDir
        if (dir.includes('e')) {
          updateField(drag.kind, drag.index, 'width', Math.max(30, rect.rect.width + dx))
        }
        if (dir.includes('w')) {
          const newX = Math.max(0, rect.rect.x + dx)
          const newW = Math.max(30, rect.rect.width + (rect.rect.x - newX))
          updateField(drag.kind, drag.index, 'x', newX)
          updateField(drag.kind, drag.index, 'width', newW)
        }
        if (dir.includes('s')) {
          updateField(drag.kind, drag.index, 'height', Math.max(20, rect.rect.height + dy))
        }
        if (dir.includes('n')) {
          const newY = Math.max(0, rect.rect.y + dy)
          const newH = Math.max(20, rect.rect.height + (rect.rect.y - newY))
          updateField(drag.kind, drag.index, 'y', newY)
          updateField(drag.kind, drag.index, 'height', newH)
        }
      }
    }
    const handleUp = () => { setDrag(null) }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [drag, getRect, updateField])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedEl) return
    const [kindStr, idxStr] = selectedEl.split('-')
    const kind = kindStr as ElKind
    const index = parseInt(idxStr)
    const rect = getRect(kind, index)
    if (!rect) return
    let dx = 0, dy = 0
    if (e.key === 'ArrowUp') dy = -1
    else if (e.key === 'ArrowDown') dy = 1
    else if (e.key === 'ArrowLeft') dx = -1
    else if (e.key === 'ArrowRight') dx = 1
    else return
    e.preventDefault()
    updateField(kind, index, 'x', rect.rect.x + dx)
    updateField(kind, index, 'y', rect.rect.y + dy)
  }, [selectedEl, getRect, updateField])

  const handleSave = () => { onSave(editConfig) }

  const pageSummary = pageData?.find(p => p.pageNumber === selectedPage)
  const countVals = pageSummary?.countValues ?? []
  const amountVals = pageSummary?.amountValues ?? []
  const overrideCounts = cfg?.overrideCounts || []
  const overrideAmounts = cfg?.overrideAmounts || []

  function countDisplay(i: number): string {
    if (overrideCounts[i] != null) return String(overrideCounts[i])
    if (i < countVals.length) return String(countVals[i])
    return '0'
  }

  function amountDisplay(i: number): string {
    if (overrideAmounts[i] != null) return overrideAmounts[i]
    if (i < amountVals.length) return formatVal(amountVals[i])
    return '—'
  }

  return (
    <div className="template-editor" tabIndex={0} onKeyDown={handleKeyDown}>
      <div className="editor-toolbar">
        <div className="page-selector">
          {pages.map(p => (
            <button key={p.pageNumber} className={`page-btn ${selectedPage === p.pageNumber ? 'active' : ''}`}
              onClick={() => { setSelectedPage(p.pageNumber); setSelectedEl(null) }}>
              {p.pageNumber}
            </button>
          ))}
        </div>
        <span className="page-title">{pages.find(p => p.pageNumber === selectedPage)?.title}</span>
        <button className="add-text-btn" onClick={addText}>+ Текст</button>
        <button className="save-btn" onClick={handleSave}>Сохранить</button>
      </div>

      <div className="editor-main">
        <div className="editor-layers">
          <h3>Слои</h3>
          {items.map(item => (
            <div key={`${item.kind}-${item.index}`}
              className={`layer-item ${selectedEl === `${item.kind}-${item.index}` ? 'active' : ''}`}
              onClick={() => setSelectedEl(`${item.kind}-${item.index}`)}>
              <span className="layer-dot" style={{ background: item.kind === 'count' ? 'rgb(29,29,35)' : item.kind === 'price' ? 'rgb(76,43,31)' : '#3b82f6' }} />
              {item.label}
            </div>
          ))}
          {items.length === 0 && <p className="layers-empty">Нет элементов на этой странице</p>}
        </div>

        <div className="editor-canvas-wrap" style={{ width: CANVAS_W, height: CANVAS_H }}>
          <div className="editor-canvas">
            {pages.find(p => p.pageNumber === selectedPage) && (
              <img src={pages.find(p => p.pageNumber === selectedPage)!.imageUrl} alt=""
                style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, objectFit: 'cover', pointerEvents: 'none' }} />
            )}

            {/* Grid lines */}
            <svg className="canvas-grid" style={{ position: 'absolute', inset: 0, width: CANVAS_W, height: CANVAS_H, pointerEvents: 'none' }}>
              {Array.from({ length: 17 }, (_, i) => (
                <line key={`gv${i}`} x1={px(i * 100)} y1={0} x2={px(i * 100)} y2={CANVAS_H}
                  stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              ))}
              {Array.from({ length: 17 }, (_, i) => (
                <line key={`gh${i}`} x1={0} y1={px(i * 100)} x2={CANVAS_W} y2={px(i * 100)}
                  stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              ))}
            </svg>

            {/* Render overlay elements */}
            {cfg?.countCards?.map((card, i) => renderEl('count', i, card, selectedEl, hoveredEl, startDrag, startResize, setSelectedEl, setHoveredEl, countDisplay(i), overrideCounts[i] != null))}
            {cfg?.priceCards?.map((card, i) => renderEl('price', i, card, selectedEl, hoveredEl, startDrag, startResize, setSelectedEl, setHoveredEl, amountDisplay(i), overrideAmounts[i] != null))}
            {cfg?.texts?.map((t, i) => renderTextEl(i, t, selectedEl, hoveredEl, startDrag, startResize, setSelectedEl, setHoveredEl))}
          </div>
        </div>

        <div className="editor-props">
          <h3>Свойства</h3>
          {selectedEl ? (() => {
            const [kindStr, idxStr] = selectedEl.split('-')
            const kind = kindStr as ElKind
            const index = parseInt(idxStr)
            const card = getRect(kind, index) as any
            if (!card) return <p>Выберите элемент</p>
            if (kind === 'text') {
              const t = card
              return (
                <div className="prop-detail">
                  <h4>Текстовый блок {index + 1}</h4>
                  <label className="prop-textarea">
                    <span>Текст:</span>
                    <textarea rows={3} value={t.text ?? ''} onChange={e => updateTextProp(index, 'text', e.target.value)} />
                  </label>
                  {renderField('texts', index, 'x', t.rect.x, updateField)}
                  {renderField('texts', index, 'y', t.rect.y, updateField)}
                  {renderField('texts', index, 'width', t.rect.width, updateField)}
                  {renderFieldT('размер', t.size ?? 34, v => updateTextProp(index, 'size', v))}
                  <label>
                    <span>цвет:</span>
                    <input type="color" value={t.color ?? '#ffffff'} onChange={e => updateTextProp(index, 'color', e.target.value)} />
                  </label>
                  <label>
                    <span>выравнивание:</span>
                    <select value={t.align ?? 'left'} onChange={e => updateTextProp(index, 'align', e.target.value)}>
                      <option value="left">слева</option>
                      <option value="center">по центру</option>
                      <option value="right">справа</option>
                    </select>
                  </label>
                  <label>
                    <span>жирность:</span>
                    <select value={t.weight ?? 600} onChange={e => updateTextProp(index, 'weight', Number(e.target.value))}>
                      <option value={400}>обычный</option>
                      <option value={600}>средний</option>
                      <option value={700}>жирный</option>
                    </select>
                  </label>
                  <label className="prop-check">
                    <span>подложка (перекрыть текст шаблона):</span>
                    <input type="checkbox" checked={!!t.bg} onChange={e => updateTextProp(index, 'bg', e.target.checked ? '#101014' : undefined)} />
                  </label>
                  {t.bg ? (
                    <label>
                      <span>цвет подложки:</span>
                      <input type="color" value={t.bg} onChange={e => updateTextProp(index, 'bg', e.target.value)} />
                    </label>
                  ) : null}
                  <button className="el-delete-btn" onClick={() => deleteEl('text', index)}>Удалить текст</button>
                </div>
              )
            }
            const key = kind === 'count' ? 'countCards' : 'priceCards'
            return (
              <div className="prop-detail">
                <h4>{kind === 'count' ? `Счётная карта ${index + 1}` : `Ценовая карта ${index + 1}`}</h4>
                {kind === 'price' && <p className="prop-category">Категория: {(card as any).category}</p>}
                {renderField(key, index, 'x', card.rect.x, updateField)}
                {renderField(key, index, 'y', card.rect.y, updateField)}
                {renderField(key, index, 'width', card.rect.width, updateField)}
                {renderField(key, index, 'height', card.rect.height, updateField)}
                {renderFieldT('textX', card.textX, v => updateField(kind, index, 'textX', v))}
                {renderFieldT('textY', card.textY, v => updateField(kind, index, 'textY', v))}
                {renderFieldT('textWidth', card.textWidth, v => updateField(kind, index, 'textWidth', v))}
                {renderFieldT('radius', card.rect.radius ?? 10, v => updateField(kind, index, 'radius', v))}
                <div className="override-field">
                  <span>Значение:</span>
                  <input type={kind === 'count' ? 'number' : 'text'}
                    value={kind === 'count'
                      ? (overrideCounts[index] ?? countVals[index] ?? '')
                      : (overrideAmounts[index] ?? amountDisplay(index) ?? '')}
                    placeholder={kind === 'count' ? String(countVals[index] ?? '') : amountDisplay(index)}
                    onChange={e => setOverride(kind, index, e.target.value)} />
                  {(kind === 'count' ? overrideCounts[index] != null : overrideAmounts[index] != null) ? (
                    <button className="override-clear" onClick={() => setOverride(kind, index, '')} title="Сбросить">↺</button>
                  ) : null}
                </div>
              </div>
            )
          })() : <p className="props-hint">Кликните на элемент на холсте или в списке слоёв</p>}
          {pageSummary && (
            <div className="editor-page-data">
              <h3>Данные страницы</h3>
              <div className="page-data-section">
                <strong>Счётные карты:</strong>
                {countVals.length > 0 ? (
                  <ul>{countVals.map((v, i) => <li key={i}>Карта {i + 1}: <b>{v}</b></li>)}</ul>
                ) : <p className="data-empty">нет</p>}
              </div>
              <div className="page-data-section">
                <strong>Ценовые карты:</strong>
                {amountVals.length > 0 ? (
                  <ul>{amountVals.map((v, i) => <li key={i}>Карта {i + 1}: <b>{formatVal(v)}</b></li>)}</ul>
                ) : <p className="data-empty">нет</p>}
              </div>
              <div className="page-data-section">
                <strong>Описание:</strong>
                <p className="data-desc">{pageSummary.description}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function renderField(key: string, index: number, field: string, value: number, update: (kind: ElKind, idx: number, f: string, v: number) => void) {
  const kind: ElKind = key === 'countCards' ? 'count' : key === 'texts' ? 'text' : 'price'
  return (
    <label key={`${key}-${index}-${field}`}>
      <span>{field}:</span>
      <input type="number" value={value} onChange={e => update(kind, index, field, +e.target.value)} />
    </label>
  )
}

function renderFieldT(field: string, value: number, onChange: (v: number) => void) {
  return (
    <label key={field}>
      <span>{field}:</span>
      <input type="number" value={value} onChange={e => onChange(+e.target.value)} />
    </label>
  )
}

function renderEl(
  kind: ElKind, i: number, card: any,
  selectedEl: string | null, hoveredEl: string | null,
  startDrag: (kind: ElKind, index: number, e: React.MouseEvent) => void,
  startResize: (kind: ElKind, index: number, dir: HandleDir, e: React.MouseEvent) => void,
  setSelectedEl: (s: string | null) => void,
  setHoveredEl: (s: string | null) => void,
  displayValue?: string,
  isOverridden?: boolean,
) {
  const r = card.rect
  const isSelected = selectedEl === `${kind}-${i}`
  const isHovered = hoveredEl === `${kind}-${i}`
  const elId = `${kind}-${i}`
  const color = card.color || (kind === 'count' ? 'rgb(29,29,35)' : 'rgb(76,43,31)')

  return (
    <div key={elId} className={`el ${isSelected ? 'el-selected' : ''} ${isHovered ? 'el-hovered' : ''}`}
      style={{
        left: px(r.x), top: px(r.y),
        width: px(r.width), height: px(r.height),
        borderRadius: px(r.radius ?? (kind === 'count' ? 12 : 16)),
        background: color,
      }}
      onClick={(e) => { e.stopPropagation(); setSelectedEl(elId) }}
      onMouseDown={(e) => startDrag(kind, i, e)}
      onMouseEnter={() => setHoveredEl(elId)}
      onMouseLeave={() => setHoveredEl(null)}
    >
      <span className={`el-center-label ${isOverridden ? 'el-overridden' : ''}`}>{displayValue ?? (kind === 'count' ? `N${i + 1}` : `P${i + 1}`)}</span>
      {isOverridden ? <span className="el-override-badge">✎</span> : null}

      {/* Resize handles */}
      {isSelected && (
        <>
          <div className="handle handle-nw" onMouseDown={e => startResize(kind, i, 'nw', e)} />
          <div className="handle handle-n" onMouseDown={e => startResize(kind, i, 'n', e)} />
          <div className="handle handle-ne" onMouseDown={e => startResize(kind, i, 'ne', e)} />
          <div className="handle handle-w" onMouseDown={e => startResize(kind, i, 'w', e)} />
          <div className="handle handle-e" onMouseDown={e => startResize(kind, i, 'e', e)} />
          <div className="handle handle-sw" onMouseDown={e => startResize(kind, i, 'sw', e)} />
          <div className="handle handle-s" onMouseDown={e => startResize(kind, i, 's', e)} />
          <div className="handle handle-se" onMouseDown={e => startResize(kind, i, 'se', e)} />
        </>
      )}

      {/* Info badge */}
      {isSelected && (
        <div className="el-badge">
          {r.x},{r.y} · {r.width}×{r.height}
        </div>
      )}
    </div>
  )
}

function renderTextEl(
  i: number, t: any,
  selectedEl: string | null, hoveredEl: string | null,
  startDrag: (kind: ElKind, index: number, e: React.MouseEvent) => void,
  startResize: (kind: ElKind, index: number, dir: HandleDir, e: React.MouseEvent) => void,
  setSelectedEl: (s: string | null) => void,
  setHoveredEl: (s: string | null) => void,
) {
  const r = t.rect
  const elId = `text-${i}`
  const isSelected = selectedEl === elId
  const isHovered = hoveredEl === elId
  const align = t.align ?? 'left'
  return (
    <div key={elId} className={`el el-text ${isSelected ? 'el-selected' : ''} ${isHovered ? 'el-hovered' : ''}`}
      style={{
        left: px(r.x), top: px(r.y), width: px(r.width), height: px(r.height),
        background: t.bg || 'transparent',
        justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        alignItems: 'flex-start',
        padding: px(6),
      }}
      onClick={(e) => { e.stopPropagation(); setSelectedEl(elId) }}
      onMouseDown={(e) => startDrag('text', i, e)}
      onMouseEnter={() => setHoveredEl(elId)}
      onMouseLeave={() => setHoveredEl(null)}
    >
      <span style={{
        color: t.color ?? '#ffffff',
        fontSize: px(t.size ?? 34),
        fontWeight: t.weight ?? 600,
        lineHeight: t.lineHeight ?? 1.25,
        textAlign: align,
        whiteSpace: 'pre-wrap',
        pointerEvents: 'none',
        width: '100%',
      }}>{t.text || 'Текст'}</span>

      {isSelected && (
        <>
          <div className="handle handle-w" onMouseDown={e => startResize('text', i, 'w', e)} />
          <div className="handle handle-e" onMouseDown={e => startResize('text', i, 'e', e)} />
          <div className="handle handle-s" onMouseDown={e => startResize('text', i, 's', e)} />
          <div className="handle handle-n" onMouseDown={e => startResize('text', i, 'n', e)} />
          <div className="el-badge">{r.x},{r.y} · {r.width}×{r.height}</div>
        </>
      )}
    </div>
  )
}
