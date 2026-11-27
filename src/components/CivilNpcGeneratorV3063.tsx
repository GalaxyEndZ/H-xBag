import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import { CIVIL_JOB_PRESETS, CIVIL_SKILLS, CIVIL_SKILL_LIMIT, civilSkillLabel, civilSuggestedSkills, normalizeCivilSkills } from '../civilProfessions'
import './CivilNpcGeneratorV3063.css'

type CivilNpc = {
  id: string
  campaign_id: string
  name: string
  environment: string
  tier: string
  level: number
  job: string
  job_skills: string[]
  notes: string
  created_at: string
  updated_at: string
}

type Props = {
  campaignId: string
  tierOptions: { value: string; label: string }[]
  onClose: () => void
}

const GIVEN = ['Haru', 'Akio', 'Ren', 'Mio', 'Kaori', 'Nao', 'Sora', 'Yuki', 'Emi', 'Daichi', 'Aoi', 'Shun']
const FAMILY = ['Mori', 'Tanaka', 'Kondo', 'Ito', 'Fujimoto', 'Sato', 'Hayashi', 'Takeda']
const pick = <T,>(array: readonly T[]) => array[Math.floor(Math.random() * array.length)]
const makeName = () => `${pick(GIVEN)} ${pick(FAMILY)}`
const clean = (value: string, length: number) => value.trim().slice(0, length)

export default function CivilNpcGeneratorV3063({ campaignId, tierOptions, onClose }: Props) {
  const [rows, setRows] = useState<CivilNpc[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [name, setName] = useState(makeName)
  const [environment, setEnvironment] = useState('Vila de Kaneyama')
  const [tier, setTier] = useState(tierOptions[0]?.value ?? '5')
  const [level, setLevel] = useState(1)
  const [quantity, setQuantity] = useState(1)
  const [job, setJob] = useState('Agricultor')
  const [skills, setSkills] = useState<string[]>(() => civilSuggestedSkills('Agricultor'))
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [locationFilter, setLocationFilter] = useState('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase.from('hax_v3063_civil_npcs')
      .select('id,campaign_id,name,environment,tier,level,job,job_skills,notes,created_at,updated_at')
      .eq('campaign_id', campaignId).order('environment', { ascending: true }).order('name', { ascending: true })
    if (fetchError) setError(`Não foi possível carregar os NPCs: ${fetchError.message}. Execute o SQL V306.3 no Supabase.`)
    else { setRows((data || []).map(row => ({ ...row, job_skills: normalizeCivilSkills(row.job_skills) })) as CivilNpc[]); setError('') }
    setLoading(false)
  }, [campaignId])

  useEffect(() => { void reload() }, [reload])

  const locations = useMemo(() => [...new Set(rows.map(row => row.environment))].sort((a,b) => a.localeCompare(b, 'pt-BR')), [rows])
  const groups = useMemo(() => {
    const filtered = rows.filter(row => (locationFilter === 'all' || row.environment === locationFilter) &&
      `${row.name} ${row.environment} ${row.job} ${row.notes}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
    return [...new Set(filtered.map(row => row.environment))].sort((a,b) => a.localeCompare(b,'pt-BR'))
      .map(place => ({ place, people: filtered.filter(row => row.environment === place) }))
  }, [rows, locationFilter, search])

  const changeJob = (value: string) => { setJob(value) }
  const reset = () => {
    setEditingId(null); setName(makeName()); setEnvironment(locationFilter !== 'all' ? locationFilter : 'Vila de Kaneyama')
    setTier(tierOptions[0]?.value ?? '5'); setLevel(1); setQuantity(1); changeJob('Agricultor'); setSkills(civilSuggestedSkills('Agricultor')); setNotes(''); setShowForm(true)
  }
  const edit = (row: CivilNpc) => {
    setEditingId(row.id); setName(row.name); setEnvironment(row.environment); setTier(row.tier); setLevel(row.level)
    setJob(row.job); setSkills(normalizeCivilSkills(row.job_skills)); setNotes(row.notes); setShowForm(true)
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const nextName = clean(name,80)
    const nextEnvironment = clean(environment,80)
    const nextJob = clean(job,80)
    if (!nextName || !nextEnvironment || !nextJob || !Number.isInteger(level) || level < 1 || level > 100) {
      setError('Informe nome, ambiente, trabalho e Level entre 1 e 100.'); return
    }
    if (tierOptions.length && !tierOptions.some(option => option.value === tier)) {
      setError('Selecione um Tier válido.'); return
    }
    setSaving(true); setError(''); setNotice('')
    const payload = { name:nextName, environment:nextEnvironment, tier, level, job:nextJob,
      job_skills:normalizeCivilSkills(skills), notes:clean(notes,2000) }
    const amount = Math.max(1, Math.min(10, Math.floor(quantity || 1)))
    const generatedNames = new Set([nextName])
    const batch = Array.from({length: editingId ? 1 : amount}, (_, index) => {
      let generatedName = nextName
      if (index > 0) {
        // Garante nomes distintos dentro do lote, sem bloquear NPCs de nome parecido no acervo.
        for (let attempt = 0; attempt < 30; attempt++) {
          const candidate = makeName()
          if (!generatedNames.has(candidate)) { generatedName = candidate; break }
        }
        if (generatedNames.has(generatedName)) generatedName = `${pick(GIVEN)} ${pick(FAMILY)} ${index + 1}`
        generatedNames.add(generatedName)
      }
      return {...payload, name:generatedName, campaign_id:campaignId}
    })
    const result = editingId
      ? await supabase.from('hax_v3063_civil_npcs').update(payload).eq('id', editingId).eq('campaign_id',campaignId)
      : await supabase.from('hax_v3063_civil_npcs').insert(batch)
    if (result.error) setError(`Não foi possível salvar o NPC: ${result.error.message}`)
    else { setNotice(editingId ? 'NPC atualizado.' : `${batch.length} NPC(s) criado(s) em ${nextEnvironment}.`); setShowForm(false); setEditingId(null); await reload() }
    setSaving(false)
  }
  const remove = async (row: CivilNpc) => {
    if (!window.confirm(`Excluir ${row.name} de ${row.environment}?`)) return
    setError(''); setNotice('')
    const {error: deleteError} = await supabase.from('hax_v3063_civil_npcs').delete().eq('id',row.id).eq('campaign_id',campaignId)
    if (deleteError) setError(`Não foi possível excluir o NPC: ${deleteError.message}`)
    else { setNotice(`${row.name} excluído.`); if (editingId===row.id) { setEditingId(null); setShowForm(false) } await reload() }
  }

  return <section className="hb-civil-npcs" aria-labelledby="hb-civil-npcs-title">
    <header className="hb-civil-head">
      <div><span className="hb-civil-eyebrow">ACERVO DO MESTRE · ARQUÉTIPO CIVIL</span><h3 id="hb-civil-npcs-title">Gerador de NPCs</h3><p>Crie moradores e profissionais, escolha Tier e Level, e organize cada NPC por ambiente da campanha.</p></div>
      <div className="hb-civil-head-actions"><button type="button" className="secondary-button" onClick={onClose}>Fechar</button><button type="button" className="primary-button" onClick={reset}>＋ Novo NPC</button></div>
    </header>
    {error && <p role="alert" className="hb-civil-feedback is-error">{error}</p>}
    {notice && <p role="status" className="hb-civil-feedback">{notice}</p>}
    {showForm && <form className="hb-civil-editor" onSubmit={save}>
      <div className="hb-civil-form-title"><strong>{editingId?'Editar NPC civil':'Novo NPC civil'}</strong><small>O trabalho recomenda até cinco perícias, sem bônus numérico automático.</small></div>
      <div className="hb-civil-fields">
        <label>Nome<div className="hb-civil-name-row"><input required maxLength={80} value={name} onChange={event=>setName(event.target.value)}/><button type="button" className="secondary-button" onClick={()=>setName(makeName())} title="Gerar um novo nome">🎲 Gerar</button></div></label>
        <label>Ambiente / local<input required maxLength={80} list="hb-civil-locations" placeholder="Ex.: Vila de Kaneyama" value={environment} onChange={event=>setEnvironment(event.target.value)}/><datalist id="hb-civil-locations">{locations.map(location=><option key={location} value={location}/>)}</datalist></label>
        <label>Tier<select value={tier} onChange={event=>setTier(event.target.value)}>{(tierOptions.length?tierOptions:[1,2,3,4,5].map(n=>({value:String(n),label:`Tier ${n}`}))).map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
        <label>Level<input type="number" min={1} max={100} step={1} value={level} onChange={event=>setLevel(Math.floor(Number(event.target.value)||1))}/></label>
        {!editingId && <label>Quantidade de NPCs<input type="number" min={1} max={10} step={1} value={quantity} onChange={event=>setQuantity(Math.max(1,Math.min(10,Math.floor(Number(event.target.value)||1))))}/></label>}
        <label>Trabalho<input required list="hb-civil-jobs" maxLength={80} value={job} onChange={event=>changeJob(event.target.value)}/><datalist id="hb-civil-jobs">{CIVIL_JOB_PRESETS.map(item=><option key={item.name} value={item.name}/>)}</datalist></label>
      </div>
      <div className="hb-civil-skills"><div><strong>Perícias da profissão <span>{skills.length}/{CIVIL_SKILL_LIMIT}</span></strong><small>Escolha até cinco perícias existentes no Kisatsutai.</small></div>
        {civilSuggestedSkills(job).length>0 && <button type="button" className="secondary-button hb-civil-recommend" onClick={()=>setSkills(civilSuggestedSkills(job))}>✦ Sugerir perícias para {job}</button>}
        <div className="hb-civil-skill-chips">{skills.map(key=><button type="button" key={key} onClick={()=>setSkills(current=>current.filter(item=>item!==key))} title="Remover perícia">{civilSkillLabel(key)} <span aria-hidden="true">×</span></button>)}</div>
        <select aria-label="Adicionar perícia da profissão" value="" disabled={skills.length>=CIVIL_SKILL_LIMIT} onChange={event=>{const key=event.target.value;if(key)setSkills(current=>normalizeCivilSkills([...current,key]))}}><option value="">＋ Adicionar perícia...</option>{CIVIL_SKILLS.filter(skill=>!skills.includes(skill.key)).map(skill=><option key={skill.key} value={skill.key}>{skill.group} · {skill.name}</option>)}</select>
      </div>
      <label className="hb-civil-notes">Notas do NPC<textarea rows={3} maxLength={2000} placeholder="História, personalidade, rotina, relações..." value={notes} onChange={event=>setNotes(event.target.value)}/></label>
      <div className="hb-civil-form-actions"><button type="button" className="secondary-button" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="primary-button" disabled={saving}>{saving?'Salvando...':editingId?'Salvar alterações':quantity>1?`Gerar ${quantity} NPCs`:'Criar NPC civil'}</button></div>
    </form>}
    <div className="hb-civil-filters"><label>Buscar NPC<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Nome, trabalho ou ambiente"/></label><label>Ambiente<select value={locationFilter} onChange={event=>setLocationFilter(event.target.value)}><option value="all">Todos os ambientes</option>{locations.map(item=><option key={item} value={item}>{item}</option>)}</select></label><button type="button" className="secondary-button" disabled={loading} onClick={()=>void reload()}>↻ Atualizar</button></div>
    {loading && <p role="status" className="hb-civil-empty">Carregando NPCs...</p>}
    {!loading && !groups.length && <div className="hb-civil-empty">{rows.length?'Nenhum NPC corresponde aos filtros.':'Nenhum NPC civil cadastrado. Crie um morador para começar o acervo.'}</div>}
    {!loading && groups.map(group=><section className="hb-civil-location" key={group.place} aria-label={group.place}>
      <div className="hb-civil-location-head"><h4>⌂ {group.place}</h4><span>{group.people.length} {group.people.length===1?'NPC':'NPCs'}</span></div>
      <div className="hb-civil-cards">{group.people.map(npc=><article className="hb-civil-card" key={npc.id}>
        <div className="hb-civil-card-top"><span className="hb-civil-avatar" aria-hidden="true">♙</span><div><strong>{npc.name}</strong><small>{npc.job} · Civil</small></div></div>
        <div className="hb-civil-meta"><span>{tierOptions.find(item=>item.value===npc.tier)?.label||`Tier ${npc.tier}`}</span><span>Level {npc.level}</span></div>
        {npc.job_skills.length>0 && <div className="hb-civil-card-skills">{npc.job_skills.map(key=><span key={key}>{civilSkillLabel(key)}</span>)}</div>}
        {npc.notes && <p>{npc.notes}</p>}
        <div className="hb-civil-card-actions"><button type="button" className="secondary-button" onClick={()=>edit(npc)}>Editar ficha</button><button type="button" className="secondary-button" onClick={()=>void remove(npc)}>Excluir</button></div>
      </article>)}</div>
    </section>)}
  </section>
}
