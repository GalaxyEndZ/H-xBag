
import { supabase } from '../../supabase'
import { useEffect, useState } from 'react'

type Item = {
  id: string
  character_id: string
  name: string
  description: string | null
  category: string
  quantity: number
  weight: number
  unit_price: number
  currency_id: string | null
  metadata: Record<string, unknown> | null
  sale_blocked: boolean
}

type CyberneticImplant = {
  id: string
  inventoryItemId?: string
  name: string
  category: string
  description: string
  location: string
  biologicalLoad: number
  cost: string
  effects: string
  status?: 'installed' | 'stored'
}

type CyberneticsInventoryProps = {
  sheetDraft: string
  setSheetDraft: React.Dispatch<React.SetStateAction<string>>
  characterId: string
  seasonId: string
  canManageCybernetics: boolean
  sheetSaving: boolean
  inventoryItems: Item[]
  onInventoryItemsChange: React.Dispatch<React.SetStateAction<Item[]>>
  onSaveCybernetics?: (
    cybernetics: Record<string, unknown>
  ) => Promise<void>
}

const emptyImplant: Omit<CyberneticImplant, 'id'> = {
  name: '',
  category: 'Outro',
  description: '',
  location: '',
  biologicalLoad: 0,
  cost: '',
  effects: '',
  status: 'installed',
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
  characterId,
  seasonId,
  canManageCybernetics,
  sheetSaving,
  inventoryItems,
  onInventoryItemsChange,
  onSaveCybernetics,
}: CyberneticsInventoryProps) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyImplant)
  const [savingCybernetics, setSavingCybernetics] = useState(false)
  const [migrationLoading, setMigrationLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  const canEdit =
    canManageCybernetics &&
    !sheetSaving &&
    !savingCybernetics &&
    Boolean(onSaveCybernetics)

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

  const availableImplants = inventoryItems.filter(item =>
    item.metadata?.cybernetic === true &&
    item.metadata?.cyberneticEquipped !== true
  )

  const biologicalLoad = implants.reduce((total, implant) => {
    const load = Number(implant.biologicalLoad)

    return total + (
      Number.isFinite(load)
        ? Math.max(0, load)
        : 0
    )
  }, 0)

  const cyberpsychosis = biologicalLoad > 100

  async function refreshSheet() {
    const { data, error } = await supabase
      .from('character_sheets')
      .select('sheet_data')
      .eq('character_id', characterId)
      .eq('season_id', seasonId)
      .maybeSingle()

    if (error) throw error
    if (!data) throw new Error('Ficha da temporada não encontrada.')

    setSheetDraft(JSON.stringify(data.sheet_data ?? {}))
  }

  async function refreshInventory() {
    const { data, error } = await supabase
      .from('inventory_items')
      .select(
        'id, character_id, name, description, category, quantity, weight, metadata, unit_price, currency_id, sale_blocked'
      )
      .eq('character_id', characterId)
      .order('created_at', { ascending: true })

    if (error) throw error

    onInventoryItemsChange(
      ((data ?? []) as Item[]).filter(
        item =>
          item.metadata?.cybernetic !== true ||
          item.metadata?.cyberneticEquipped !== true
      )
    )
  }

  async function refreshAll() {
    await Promise.all([
      refreshSheet(),
      refreshInventory(),
    ])
  }

  // Migra implantes antigos que ainda não possuem registro no inventário.
  useEffect(() => {
    if (!canManageCybernetics || !characterId || !seasonId) return

    let cancelled = false

    async function migrateLegacyImplants() {
      setMigrationLoading(true)
      setSaveError('')

      try {
        const { error } = await supabase.rpc(
          'migrate_legacy_cybernetic_implants',
          {
            p_character_id: characterId,
            p_season_id: seasonId,
          }
        )

        if (error) throw error

        if (!cancelled) {
          await refreshAll()
        }
      } catch (error) {
        if (!cancelled) {
          setSaveError(
            error instanceof Error
              ? error.message
              : 'Não foi possível migrar os implantes antigos.'
          )
        }
      } finally {
        if (!cancelled) setMigrationLoading(false)
      }
    }

    void migrateLegacyImplants()

    return () => {
      cancelled = true
    }
  }, [characterId, seasonId, canManageCybernetics])

  async function updateCybernetics(
    changes: Record<string, unknown>
  ): Promise<boolean> {
    if (!canEdit || !onSaveCybernetics) return false

    const nextCybernetics = {
      ...cybernetics,
      ...changes,
    }

    setSavingCybernetics(true)
    setSaveError('')

    try {
      await onSaveCybernetics(nextCybernetics)
      return true
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar os implantes.'
      )
      return false
    } finally {
      setSavingCybernetics(false)
    }
  }

  function resetForm() {
    setForm(emptyImplant)
    setEditingId(null)
    setShowForm(false)
  }

  function startEditing(implant: CyberneticImplant) {
    if (!canEdit) return

    setForm({
      name: implant.name ?? '',
      category: implant.category ?? 'Outro',
      description: implant.description ?? '',
      location: implant.location ?? '',
      biologicalLoad: Number(implant.biologicalLoad) || 0,
      cost: implant.cost ?? '',
      effects: implant.effects ?? '',
      status: 'installed',
    })

    setEditingId(implant.id)
    setShowForm(true)
  }

  async function saveImplant() {
    if (!canEdit || !form.name.trim()) return

    const implant: CyberneticImplant = {
      ...form,
      id: editingId ?? crypto.randomUUID(),
      name: form.name.trim(),
      biologicalLoad: Math.max(
        0,
        Number(form.biologicalLoad) || 0
      ),
      status: 'installed',
    }

    const existingImplant = implants.find(
      item => item.id === editingId
    )

    const nextImplants = editingId
      ? implants.map(item =>
          item.id === editingId
            ? {
                ...implant,
                inventoryItemId: existingImplant?.inventoryItemId,
              }
            : item
        )
      : [...implants, implant]

    const saved = await updateCybernetics({
      implants: nextImplants,
    })

    if (!saved) return

    try {
      if (editingId && existingImplant?.inventoryItemId) {
        const inventoryItem = inventoryItems.find(
          item => item.id === existingImplant.inventoryItemId
        )

        if (inventoryItem) {
          const { error } = await supabase
            .from('inventory_items')
            .update({
              name: implant.name,
              description: implant.description || null,
              metadata: {
                ...inventoryItem.metadata,
                cybernetic: true,
                cyberneticEquipped: true,
                biologicalLoad: implant.biologicalLoad,
                cyberneticData: implant,
              },
            })
            .eq('id', existingImplant.inventoryItemId)
            .eq('character_id', characterId)

          if (error) throw error
        }
      } else if (!editingId) {
        // Cria o registro correspondente no inventário.
        const { error } = await supabase.rpc(
          'migrate_legacy_cybernetic_implants',
          {
            p_character_id: characterId,
            p_season_id: seasonId,
          }
        )

        if (error) throw error
      }

      await refreshAll()
      resetForm()
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'O implante foi salvo, mas houve um erro ao sincronizar o inventário.'
      )
    }
  }

  async function unequipImplant(implant: CyberneticImplant) {
    if (!canEdit) return

    if (!implant.inventoryItemId) {
      setSaveError(
        'Este implante ainda não possui registro no inventário. Atualize a migração antes de desequipá-lo.'
      )
      return
    }

    if (!window.confirm(
      `Deseja desequipar "${implant.name}" e transferi-lo para o inventário normal?`
    )) {
      return
    }

    setSavingCybernetics(true)
    setSaveError('')

    try {
      const { error } = await supabase.rpc(
        'unequip_cybernetic_implant',
        {
          p_character_id: characterId,
          p_season_id: seasonId,
          p_inventory_item_id: implant.inventoryItemId,
        }
      )

      if (error) throw error

      await refreshAll()

      if (editingId === implant.id) resetForm()
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Não foi possível desequipar o implante.'
      )
    } finally {
      setSavingCybernetics(false)
    }
  }

  async function equipImplant(item: Item) {
    if (!canEdit) return

    setSavingCybernetics(true)
    setSaveError('')

    try {
      const { error } = await supabase.rpc(
        'equip_cybernetic_implant',
        {
          p_character_id: characterId,
          p_season_id: seasonId,
          p_inventory_item_id: item.id,
        }
      )

      if (error) throw error

      await refreshAll()
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : 'Não foi possível equipar o implante.'
      )
    } finally {
      setSavingCybernetics(false)
    }
  }

  return (
    <section className="inventory-section cybernetics-section">
      <div className="inventory-heading">
        <div>
          <h3>Cibernética</h3>
          <p>
            Implantes, modificações e a estabilidade biológica do personagem.
          </p>
        </div>

        <span className="cybernetics-heading-icon" aria-hidden="true">
          ⌬
        </span>
      </div>

      {canManageCybernetics && (
        <div
          className={`biological-load-card ${
            cyberpsychosis ? 'is-cyberpsychosis' : ''
          }`}
        >
          <div className="biological-load-heading">
            <div>
              <span className="biological-load-eyebrow">
                INTEGRIDADE ORGÂNICA
              </span>
              <strong>Carga Biológica</strong>
            </div>

            <div className="biological-load-value">
              <strong>{biologicalLoad}</strong>
              <span>%</span>
            </div>
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
              style={{
                width: `${Math.min(100, biologicalLoad)}%`,
              }}
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
                  Carga biológica excedeu o limite seguro em{' '}
                  {biologicalLoad - 100}%.
                </small>
              </div>
            </div>
          ) : (
            <p className="biological-load-note">
              Limite seguro: até 100%. O indicador de Cyberpsicose será ativado
              acima desse valor.
            </p>
          )}
        </div>
      )}

      {migrationLoading && (
        <p role="status">Sincronizando implantes antigos...</p>
      )}

      {savingCybernetics && (
        <p role="status">Processando transferência de implantes...</p>
      )}

      {saveError && (
        <p role="alert" className="cybernetics-save-error">
          {saveError}
        </p>
      )}

      <div className="cybernetics-inventory-heading">
        <div>
          <h4>Implantes equipados</h4>
          <p>
            {implants.length}{' '}
            {implants.length === 1
              ? 'implante instalado'
              : 'implantes instalados'}
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (showForm && !editingId) {
                resetForm()
                return
              }

              setForm(emptyImplant)
              setEditingId(null)
              setShowForm(true)
            }}
          >
            {showForm && !editingId ? 'Cancelar' : '+ Novo implante'}
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div className="cybernetics-form">
          <h4>
            {editingId ? 'Editar implante' : 'Cadastrar implante equipado'}
          </h4>

          <div className="cybernetics-form-grid">
            <label>
              Nome
              <input
                value={form.name}
                onChange={event =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Nome do implante"
                autoFocus
              />
            </label>

            <label>
              Categoria
              <select
                value={form.category}
                onChange={event =>
                  setForm({ ...form, category: event.target.value })
                }
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Localização no corpo
              <input
                value={form.location}
                onChange={event =>
                  setForm({ ...form, location: event.target.value })
                }
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
                onChange={event =>
                  setForm({
                    ...form,
                    biologicalLoad: Math.max(
                      0,
                      Number(event.target.value) || 0
                    ),
                  })
                }
              />
            </label>

            <label>
              Custo
              <input
                value={form.cost}
                onChange={event =>
                  setForm({ ...form, cost: event.target.value })
                }
                placeholder="Ex.: 500 ₰"
              />
            </label>

            <label className="cybernetics-form-full">
              Descrição
              <textarea
                value={form.description}
                onChange={event =>
                  setForm({ ...form, description: event.target.value })
                }
                placeholder="Descreva o implante..."
                rows={3}
              />
            </label>

            <label className="cybernetics-form-full">
              Efeitos e modificações
              <textarea
                value={form.effects}
                onChange={event =>
                  setForm({ ...form, effects: event.target.value })
                }
                placeholder="Bônus, efeitos especiais, limitações..."
                rows={3}
              />
            </label>
          </div>

          <div className="cybernetics-form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={resetForm}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="primary-button"
              onClick={() => void saveImplant()}
              disabled={!form.name.trim() || !canEdit}
            >
              {editingId ? 'Salvar alterações' : 'Adicionar implante'}
            </button>
          </div>
        </div>
      )}

      {implants.length === 0 ? (
        <div className="cybernetics-empty">
          <span>⌬</span>
          <strong>Nenhum implante equipado</strong>
          <p>
            Os implantes instalados aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="cybernetics-implant-list">
          {implants.map(implant => (
            <article
              className="cybernetics-implant-card"
              key={implant.id}
            >
              <div className="cybernetics-implant-top">
                <div>
                  <span className="cybernetics-implant-category">
                    {implant.category}
                  </span>
                  <h4>{implant.name}</h4>
                </div>

                <span className="cybernetics-status installed">
                  Equipado
                </span>
              </div>

              {implant.description && (
                <p>{implant.description}</p>
              )}

              <div className="cybernetics-implant-details">
                {implant.location && (
                  <span>⌖ {implant.location}</span>
                )}

                {canManageCybernetics && (
                  <span>
                    ⌬ {Number(implant.biologicalLoad) || 0}% de carga
                  </span>
                )}

                {implant.cost && (
                  <span>◈ {implant.cost}</span>
                )}
              </div>

              {implant.effects && (
                <div className="cybernetics-implant-effects">
                  <strong>Efeitos</strong>
                  <p>{implant.effects}</p>
                </div>
              )}

              {canEdit && (
                <div className="cybernetics-implant-actions">
                  <button
                    type="button"
                    onClick={() => void unequipImplant(implant)}
                    disabled={savingCybernetics || !implant.inventoryItemId}
                  >
                    Desequipar
                  </button>

                  <button
                    type="button"
                    onClick={() => startEditing(implant)}
                  >
                    Editar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <div className="cybernetics-inventory-heading" style={{ marginTop: 28 }}>
        <div>
          <h4>Implantes no inventário normal</h4>
          <p>
            {availableImplants.length}{' '}
            {availableImplants.length === 1
              ? 'implante disponível'
              : 'implantes disponíveis'}
          </p>
        </div>
      </div>

      {availableImplants.length === 0 ? (
        <div className="cybernetics-empty">
          <span>⌬</span>
          <strong>Nenhum implante disponível</strong>
          <p>
            Implantes desequipados aparecerão aqui para serem equipados novamente.
          </p>
        </div>
      ) : (
        <div className="cybernetics-implant-list">
          {availableImplants.map(item => {
            const data = item.metadata?.cyberneticData as
              | Partial<CyberneticImplant>
              | undefined

            return (
              <article
                className="cybernetics-implant-card"
                key={item.id}
              >
                <div className="cybernetics-implant-top">
                  <div>
                    <span className="cybernetics-implant-category">
                      {data?.category ?? 'Cibernética'}
                    </span>
                    <h4>{item.name}</h4>
                  </div>

                  <span className="cybernetics-status stored">
                    No inventário
                  </span>
                </div>

                {item.description && (
                  <p>{item.description}</p>
                )}

                {data?.location && (
                  <div className="cybernetics-implant-details">
                    <span>⌖ {data.location}</span>

                    {canManageCybernetics && (
                      <span>
                        ⌬ {Number(data.biologicalLoad) || 0}% de carga
                      </span>
                    )}
                  </div>
                )}

                {data?.effects && (
                  <div className="cybernetics-implant-effects">
                    <strong>Efeitos</strong>
                    <p>{data.effects}</p>
                  </div>
                )}

                {canEdit && (
                  <div className="cybernetics-implant-actions">
                    <button
                      type="button"
                      onClick={() => void equipImplant(item)}
                      disabled={savingCybernetics}
                    >
                      Equipar
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
