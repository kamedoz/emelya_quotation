import { useState } from 'react'
import type { Project, RoomConfig } from '../types'
import { generateRequirements, getDefaultRoom, ROOM_TYPE_NAMES } from '../lib/room-requirements'

interface Props {
  projects: Project[]
  onSelectProject: (project: Project) => void
  onCreateProject: (project: Project) => void
  onDeleteProject?: (projectId: string) => void
  onUpdateRoomConfig: (rooms: RoomConfig[]) => void
  onLoadDemo?: () => void
  onImportSmeta?: () => void
  finance?: Record<string, { base: number; withMargin: number; profit: number }>
}

function money(n: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽'
}

let nextId = 1
function freshId() { return `proj_${Date.now()}_${nextId++}` }
function roomId() { return `room_${Date.now()}_${nextId++}` }

function pluralRooms(n: number) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'помещение'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'помещения'
  return 'помещений'
}

export function ProjectDashboard({ projects, onSelectProject, onCreateProject, onDeleteProject, onUpdateRoomConfig, onLoadDemo, onImportSmeta, finance }: Props) {
  const [mode, setMode] = useState<'list' | 'new'>('list')
  const [projectName, setProjectName] = useState('')
  const [clientName, setClientName] = useState('')
  const [rooms, setRooms] = useState<RoomConfig[]>([])

  function addRoom(name: string) {
    const def = getDefaultRoom(name)
    setRooms(prev => [...prev, { ...def, id: roomId() }])
  }

  function updateRoom(id: string, patch: Partial<RoomConfig>) {
    setRooms(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  function removeRoom(id: string) {
    setRooms(prev => prev.filter(r => r.id !== id))
  }

  function startNew() {
    setMode('new')
    setProjectName('')
    setClientName('')
    setRooms([])
  }

  function handleCreate() {
    if (!projectName.trim()) return
    const totalArea = rooms.reduce((s, r) => s + r.areaM2, 0)
    const requirements = generateRequirements(rooms)
    const project: Project = {
      id: freshId(),
      name: projectName.trim(),
      clientName: clientName.trim() || 'Частное лицо',
      objectType: 'Дом',
      areaM2: totalArea,
      rooms: [],
      requirements,
    }
    onUpdateRoomConfig(rooms)
    onCreateProject(project)
  }

  if (mode === 'new') {
    return (
      <div className="section">
        <div className="page-nav">
          <button className="btn btn-ghost btn-sm" onClick={() => setMode('list')}>
            ← Назад
          </button>
          <span className="page-nav-title">Новый проект</span>
        </div>

        <div className="card animate-fade-up">
          <div className="field-row">
            <label className="field">
              <span className="field-label">Название проекта</span>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="Например, Коттедж Иваново" autoFocus />
            </label>
            <label className="field">
              <span className="field-label">Клиент</span>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Иванов И.И." />
            </label>
          </div>

          <h3 style={{ marginTop: 24, marginBottom: 12 }}>Помещения</h3>
          <div className="room-type-grid">
            {ROOM_TYPE_NAMES.map(t => (
              <button key={t} type="button" className="room-type-btn" onClick={() => addRoom(t)}>
                + {t}
              </button>
            ))}
          </div>

          {rooms.length > 0 && (
            <div className="room-count-badge">
              Добавлено: <strong>{rooms.length}</strong> {pluralRooms(rooms.length)} · Общая площадь: <strong>{rooms.reduce((s, r) => s + r.areaM2, 0)} м²</strong>
            </div>
          )}

          {rooms.length > 0 && (
            <div className="room-grid">
              {rooms.map(room => (
                <div key={room.id} className="room-card">
                  <div className="room-card-header">
                    <strong>{room.name}</strong>
                    <button className="btn btn-ghost btn-sm" title="Удалить помещение" onClick={() => removeRoom(room.id)}>✕</button>
                  </div>
                  <div className="room-card-body">
                    <label className="field">
                      <label>Площадь, м²</label>
                      <input type="number" min={1} value={room.areaM2} onChange={e => updateRoom(room.id, { areaM2: +e.target.value })} />
                    </label>
                    <label className="field">
                      <label>Выключатели</label>
                      <input type="number" min={0} value={room.switches} onChange={e => updateRoom(room.id, { switches: +e.target.value })} />
                    </label>
                    <label className="field">
                      <label>Групп света</label>
                      <input type="number" min={0} value={room.lightingGroups} onChange={e => updateRoom(room.id, { lightingGroups: +e.target.value })} />
                    </label>
                    <label className="field">
                      <label>Электрокарнизы</label>
                      <input type="number" min={0} value={room.curtains} onChange={e => updateRoom(room.id, { curtains: +e.target.value })} />
                    </label>
                    {room.lightingGroups > 0 && (
                      <label className="checkbox-field">
                        <input type="checkbox" checked={room.dimmable} onChange={e => updateRoom(room.id, { dimmable: e.target.checked })} />
                        Диммируется
                      </label>
                    )}
                    {room.lightingGroups > 0 && (
                      <label className="checkbox-field">
                        <input type="checkbox" checked={room.dali} onChange={e => updateRoom(room.id, { dali: e.target.checked })} />
                        Освещение DALI
                      </label>
                    )}
                    <label className="checkbox-field">
                      <input type="checkbox" checked={room.motion} onChange={e => updateRoom(room.id, { motion: e.target.checked })} />
                      Датчик движения
                    </label>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={room.noLighting} onChange={e => updateRoom(room.id, { noLighting: e.target.checked, lightingGroups: e.target.checked ? 0 : room.lightingGroups, switches: e.target.checked ? 0 : room.switches })} />
                      Нет освещения
                    </label>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={room.ac} onChange={e => updateRoom(room.id, { ac: e.target.checked })} />
                      Кондиционер
                    </label>
                    <label className="checkbox-field">
                      <input type="checkbox" checked={room.warmFloor} onChange={e => updateRoom(room.id, { warmFloor: e.target.checked })} />
                      Тёплый пол
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="button-row">
            <button className="btn btn-primary" disabled={!projectName.trim()} onClick={handleCreate}>
              Создать проект
            </button>
            <button className="btn btn-ghost" onClick={() => setMode('list')}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="section">
      <div className="page-header animate-fade-up">
        <h1>Проекты</h1>
        <p>Выберите объект или создайте новый, чтобы рассчитать смету и сформировать КП</p>
      </div>

      <div className="section">
        <div className="section-header">
          <h2 style={{ fontSize: 20 }}>Все проекты</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={startNew}>
              + Новый проект
            </button>
            {onImportSmeta ? (
              <button className="btn" onClick={onImportSmeta} title="Загрузить готовую смету (PDF) и сформировать КП по шаблону">
                Импорт сметы (PDF)
              </button>
            ) : null}
            {onLoadDemo ? (
              <button className="btn" onClick={onLoadDemo} title="Загрузить демо-проект для проверки">
                Демо
              </button>
            ) : null}
          </div>
        </div>

        {projects.length > 0 ? (
          <div className="project-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card" role="button" tabIndex={0}
                onClick={() => onSelectProject(p)}
                onKeyDown={e => { if (e.key === 'Enter') onSelectProject(p) }}>
                <div className="project-card-top">
                  <span className="project-card-name">{p.name}</span>
                  {onDeleteProject ? (
                    <button
                      className="project-card-delete"
                      title="Удалить проект"
                      onClick={e => {
                        e.stopPropagation()
                        if (window.confirm(`Удалить проект «${p.name}»?`)) onDeleteProject(p.id)
                      }}
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                <div className="project-card-meta">
                  <span>{p.clientName}</span>
                  <span>{p.areaM2} м²</span>
                </div>
                {finance?.[p.id] ? (
                  <div className="project-card-finance" title="Внутренняя информация — в КП не попадает">
                    <span>Без маржи: <strong>{money(finance[p.id].base)}</strong></span>
                    <span>С маржой: <strong>{money(finance[p.id].withMargin)}</strong></span>
                    <span className="finance-profit">Прибыль: <strong>{money(finance[p.id].profit)}</strong></span>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1Z" />
              </svg>
            </div>
            <p>Нет сохранённых проектов</p>
            <button className="btn btn-primary" onClick={startNew}>
              Создать первый проект
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
