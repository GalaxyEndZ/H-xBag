
import { useState } from 'react'

type CyberneticImplant = {
  id: string
  name: string
  category: string
  description: string
  location: string
  biologicalLoad: number
  cost: string
  effects: string
  status: 'installed' | 'stored'
}

type CyberneticsInventoryProps = {
  sheetDraft: string
  setSheetDraft: React.Dispatch<React.SetStateAction<string>>
  editingSheet: boolean
  canEditSelectedSheet: boolean
  sheetSaving: boolean
}

const emptyImplant: Omit<CyberneticImplant, 'id'> = {
  name: '',
  category: 'Outro',
  description: '',
  location: '',
  biologicalLoad: 0,
  cost: '',
  effects: '',
  status: 'stored',
}

const categories = [
  'Neurológico',
  'Sensorial',
  'Órgãos',
  'Membros',
  'Estrutural',
  'Armamento',
  'Suporte',
  'Outro',
]

export default function CyberneticsInventory({
  sheetDraft,
  setSheetDraft,
  editingSheet,
  canEditSelectedSheet,
  sheetSaving,
}: CyberneticsInventoryProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyImplant)

  const canEdit = editingSheet && canEditSelectedSheet && !sheetSaving

  let sheet: Record<string, any> = {}
  try {
    sheet = JSON.parse(sheetDraft || '{}')
  } catch {
    sheet = {}
  }

  const cybernetics = sheet.cybernetics ?? {}
  const implants: CyberneticImplant[] = Array.isArray(cybernetics.implants)
    ? cybernetics.implants
    : []

  const biologicalLoadRaw = Number(cybernetics.biologicalLoad ?? 0)
  const biologicalLoad = Number.isFinite(biologicalLoadRaw)
    ? Math.max(0, biologicalLoadRaw)
    : 0

  const cyberpsychosis = biologicalLoad > 100

  function updateCybernetics(
    changes: Record<string, unknown>,
  ) {
    let next: Record<string, any> = {}

    try {
      next = JSON.parse(sheetDraft || '{}')
    } catch {
      next = {}
    }

    next.cybernetics = {
      ...(next.cybernetics ?? {}),
      ...changes,
    }

    setSheetDraft(JSON.stringify(next, null, 2))
  }

  function updateBiologicalLoad(value: number) {
    updateCybernetics({
      biologicalLoad: Math.max(0, Number.isFinite(value) ? value : 0),
    })
  }

  function resetForm() {
    setForm(emptyImplant)
    setEditingId(null)
    setShowForm(false)
  }

  function startEditing(implant: CyberneticImplant) {
    setForm({
      name: implant.name ?? '',
      category: implant.category ?? 'Outro',
      description: implant.description ?? '',
      location: implant.location ?? '',
      biologicalLoad: Number(implant.biologicalLoad) || 0,
      cost: implant.cost ?? '',
      effects: implant.effects ?? '',
      status: implant.status === 'installed' ? 'installed' : 'stored',
    })

    setEditingId(implant.id)
    setShowForm(true)
  }

  function saveImplant() {
    if (!canEdit || !form.name.trim()) return

    const implant: CyberneticImplant = {
      ...form,
      id: editingId ?? crypto.randomUUID(),
      name: form.name.trim(),
      biologicalLoad: Math.max(0, Number(form.biologicalLoad) || 0),
    }

    const nextImplants = editingId
      ? implants.map(item => item.id === editingId ? implant : item)
      : [...implants, implant]

    updateCybernetics({ implants: nextImplants })
    resetForm()
  }

  function removeImplant(id: string) {
    if (!canEdit) return

    if (!window.confirm('Deseja remover este implante do inventário?')) {
      return
    }

    updateCybernetics({
      implants: implants.filter(item => item.id !== id),
    })

    if (editingId === id) resetForm()
  }

  function toggleStatus(implant: CyberneticImplant) {
    if (!canEdit) return

    updateCybernetics({
      implants: implants.map(item =>
        item.id === implant.id
          ? {
              ...item,
              status: item.status === 'installed' ? 'stored' : 'installed',
            }
          : item,
      ),
    })
  }

  return (
    <section className="inventory-section cybernetics-section">
      <div className="inventory-heading">
        <div>
          <h3>Cibernética</h3>
          <p>Implantes, modificações e a estabilidade biológica do personagem.</p>
        </div>
        <span className="cybernetics-heading-icon" aria-hidden="true">⌬</span>
      </div>

      <div className={`biological-load-card ${cyberpsychosis ? 'is-cyberpsychosis' : ''}`}>
        <div className="biological-load-heading">
          <div>
            <span className="biological-load-eyebrow">INTEGRIDADE ORGÂNICA</span>
            <strong>Carga Biológica</strong>
          </div>

          <label className="biological-load-value">
            <input
              aria-label="Carga Biológica em porcentagem"
              type="number"
              min="0"
              step="1"
              value={biologicalLoad}
              disabled={!canEdit}
              onChange={event => updateBiologicalLoad(Number(event.target.value))}
            />
            <span>%</span>
          </label>
        </div>

        <div
          className="biological-load-track"
          role="progressbar"
          aria-label="Carga Biológica"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, biologicalLoad)}
          aria-valuetext={`${biologicalLoad}%`}
        >
          <div
            className="biological-load-fill"
            style={{ width: `${Math.min(100, biologicalLoad)}%` }}
          />
        </div>

        <div className="biological-load-scale">
          <span>0%</span>
          <span>100%</span>
        </div>

        {cyberpsychosis ? (
          <div className="cyberpsychosis-indicator" role="status">
            <span className="cyberpsychosis-pulse" />
            <div>
              <strong>CYBERPSICOSE</strong>
              <small>
                Carga biológica excedeu o limite seguro em {biologicalLoad - 100}%.
              </small>
            </div>
          </div>
        ) : (
          <p className="biological-load-note">
            Limite seguro: até 100%. O indicador de Cyberpsicose será ativado acima desse valor.
          </p>
        )}
      </div>

      <div className="cybernetics-inventory-heading">
        <div>
          <h4>Inventário de implantes</h4>
          <p>
            {implants.length} {implants.length === 1 ? 'implante cadastrado' : 'implantes cadastrados'}
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setForm(emptyImplant)
              setEditingId(null)
              setShowForm(value => !value)
            }}
          >
            {showForm && !editingId ? 'Cancelar' : '+ Novo implante'}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="cybernetics-form">
          <h4>{editingId ? 'Editar implante' : 'Cadastrar implante'}</h4>

          <div className="cybernetics-form-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={event => setForm({ ...form, name: event.target.value })}
                placeholder="Nome do implante"
                autoFocus
              />
            </label>

            <label>
              Categoria
              <select
                value={form.category}
                onChange={event => setForm({ ...form, category: event.target.value })}
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>

            <label>
              Localização no corpo
              <input
                value={form.location}
                onChange={event => setForm({ ...form, location: event.target.value })}
                placeholder="Ex.: braço esquerdo"
              />
            </label>

            <label>
              Carga biológica (%)
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.biologicalLoad}
                onChange={event => setForm({
                  ...form,
                  biologicalLoad: Math.max(0, Number(event.target.value) || 0),
                })}
              />
            </label>

            <label>
              Custo
              <input
                value={form.cost}
                onChange={event => setForm({ ...form, cost: event.target.value })}
                placeholder="Ex.: 500 ₰"
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={event => setForm({
                  ...form,
                  status: event.target.value as CyberneticImplant['status'],
                })}
              >
                <option value="installed">Instalado</option>
                <option value="stored">Armazenado</option>
              </select>
            </label>

            <label className="cybernetics-form-full">
              Descrição
              <textarea
                value={form.description}
                onChange={event => setForm({ ...form, description: event.target.value })}
                placeholder="Descreva o implante..."
                rows={3}
              />
            </label>

            <label className="cybernetics-form-full">
              Efeitos e modificações
              <textarea
                value={form.effects}
                onChange={event => setForm({ ...form, effects: event.target.value })}
                placeholder="Bônus, efeitos especiais, limitações..."
                rows={3}
              />
            </label>
          </div>

          <div className="cybernetics-form-actions">
            <button type="button" className="secondary-button" onClick={resetForm}>
              Cancelar
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={saveImplant}
              disabled={!form.name.trim()}
            >
              {editingId ? 'Salvar alterações' : 'Adicionar implante'}
            </button>
          </div>
        </div>
      )}

      {implants.length === 0 ? (
        <div className="cybernetics-empty">
          <span>⌬</span>
          <strong>Nenhum implante cadastrado</strong>
          <p>Os implantes e modificações cibernéticas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="cybernetics-implant-list">
          {implants.map(implant => (
            <article className="cybernetics-implant-card" key={implant.id}>
              <div className="cybernetics-implant-top">
                <div>
                  <span className="cybernetics-implant-category">{implant.category}</span>
                  <h4>{implant.name}</h4>
                </div>

                <span className={`cybernetics-status ${implant.status}`}>
                  {implant.status === 'installed' ? 'Instalado' : 'Armazenado'}
                </span>
              </div>

              {implant.description && <p>{implant.description}</p>}

              <div className="cybernetics-implant-details">
                {implant.location && (
                  <span>⌖ {implant.location}</span>
                )}
                <span>⌬ {Number(implant.biologicalLoad) || 0}% de carga</span>
                {implant.cost && <span>◈ {implant.cost}</span>}
              </div>

              {implant.effects && (
                <div className="cybernetics-implant-effects">
                  <strong>Efeitos</strong>
                  <p>{implant.effects}</p>
                </div>
              )}

              {canEdit && (
                <div className="cybernetics-implant-actions">
                  <button type="button" onClick={() => toggleStatus(implant)}>
                    {implant.status === 'installed' ? 'Armazenar' : 'Instalar'}
                  </button>
                  <button type="button" onClick={() => startEditing(implant)}>
                    Editar
                  </button>
                  <button type="button" className="danger-text" onClick={() => removeImplant(implant.id)}>
                    Remover
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {!editingSheet && (
        <small className="biological-load-readonly">
          Ative “Editar ficha” para cadastrar ou modificar implantes. Salve a ficha para registrar as mudanças.
        </small>
      )}
    </section>
  )
}
