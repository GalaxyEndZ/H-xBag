import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './V304Features.css'
import './EncyclopediaV3058.css'

type EncyclopediaPage = {
  id: string
  campaign_id: string
  title: string
  category: string
  body: string
  visibility: 'campaign' | 'master'
  author_id: string
  updated_at: string
  revision: number
}
type Revision = { id: string; page_id: string; revision: number; body: string; title: string; edited_at: string }
type Visibility = EncyclopediaPage['visibility']

const describeError = (error: unknown) => error instanceof Error ? error.message : String(error)
const dateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

/** Enciclopédia por campanha: conteúdo apenas textual, acesso verificado por RLS. */
export default function EncyclopediaV304({ campaignId, canManage }: { campaignId: string; userId: string; canManage: boolean }) {
  const [pages, setPages] = useState<EncyclopediaPage[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('Mundo')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('campaign')
  const [history, setHistory] = useState<Revision[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const current = pages.find(page => page.id === selectedId)
  const categories = useMemo(() => [...new Set(pages.map(page => page.category.trim() || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [pages])
  const filtered = useMemo(() => pages.filter(page => {
    const categoryName = page.category.trim() || 'Sem categoria'
    return (categoryFilter === 'all' || categoryFilter === categoryName) && `${page.title} ${page.category} ${page.body}`.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  }), [pages, categoryFilter, search])

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('hax_v304_encyclopedia')
      .select('*').eq('campaign_id', campaignId).order('updated_at', { ascending: false }).limit(250)
    if (loadError) throw loadError
    const next = (data || []) as EncyclopediaPage[]
    setPages(next)
    setSelectedId(previous => next.some(page => page.id === previous) ? previous : next[0]?.id || '')
    return next
  }, [campaignId])

  const refresh = useCallback(async () => {
    setError('')
    setLoading(true)
    try { await load() }
    catch (cause) { setError(`Não foi possível carregar a Enciclopédia: ${describeError(cause)}. Confira a migração V304 e a conexão.`) }
    finally { setLoading(false) }
  }, [load])

  useEffect(() => {
    setPages([])
    setSelectedId('')
    setEditing(false)
    setDraftId(null)
    setCategoryFilter('all')
    setSearch('')
    setNotice('')
    setHistory([])
    setShowHistory(false)
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!showHistory || !current) { setHistory([]); return }
    let active = true
    setHistory([])
    setLoadingHistory(true)
    void supabase.from('hax_v304_encyclopedia_history')
      .select('id,page_id,revision,body,title,edited_at')
      .eq('page_id', current.id).order('revision', { ascending: false }).limit(30)
      .then(({ data, error: historyError }) => {
        if (!active) return
        if (historyError) setError(describeError(historyError))
        else setHistory((data || []) as Revision[])
        setLoadingHistory(false)
      })
    return () => { active = false }
  }, [showHistory, current?.id])

  const startEdit = (page?: EncyclopediaPage) => {
    if (!canManage) return
    setDraftId(page?.id || null)
    setTitle(page?.title || '')
    setCategory(page?.category || 'Mundo')
    setBody(page?.body || '')
    setVisibility(page?.visibility || 'campaign')
    setShowHistory(false)
    setNotice('')
    setError('')
    setEditing(true)
  }

  const choosePage = (id: string) => {
    setSelectedId(id)
    setEditing(false)
    setDraftId(null)
    setShowHistory(false)
    setNotice('')
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy || !canManage || title.trim().length < 3) return
    const original = pages.find(page => page.id === draftId)
    if (draftId && !original) { setError('A página mudou. Atualize a lista antes de salvar.'); return }
    setBusy(true)
    setError('')
    setNotice('')
    void (async () => {
      const { data, error: saveError } = await supabase.rpc('hax_v304_save_encyclopedia', {
        p_id: original?.id || null,
        p_campaign: campaignId,
        p_title: title.trim(),
        p_category: category.trim(),
        p_body: body.trim(),
        p_visibility: visibility,
        p_expected_revision: original?.revision || 0,
      })
      if (saveError) throw saveError
      await load()
      if (typeof data === 'string') setSelectedId(data)
      setEditing(false)
      setDraftId(null)
      setShowHistory(false)
      setNotice('Página salva. O histórico de revisões foi preservado.')
    })().catch(cause => setError(describeError(cause))).finally(() => setBusy(false))
  }

  return <section className="hb-v304-wrap hb-v304-encyclopedia hb-ency-workspace" aria-label="Enciclopédia da campanha">
    <header className="hb-ency-hero">
      <div className="hb-ency-hero-symbol" aria-hidden="true">📖</div>
      <div className="hb-ency-hero-copy">
        <span className="hb-ency-eyebrow">RPG <span aria-hidden="true">/</span> ARQUIVO DA CAMPANHA</span>
        <h2>Enciclopédia</h2>
        <p>Histórias, lugares e descobertas reunidos em um só lugar.</p>
      </div>
      <div className="hb-ency-hero-actions">
        <span className="hb-ency-page-count">{pages.length} {pages.length === 1 ? 'artigo' : 'artigos'}</span>
        <button type="button" className="hb-ency-refresh" disabled={loading} onClick={() => void refresh()} title="Atualizar artigos" aria-label="Atualizar artigos">↻</button>
        {canManage && <button type="button" className="hb-ency-primary" onClick={() => startEdit()}>＋ Nova página</button>}
      </div>
    </header>

    {error && <div className="hb-ency-feedback is-error" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}>Tentar novamente</button></div>}
    {notice && <div className="hb-ency-feedback is-success" role="status">{notice}</div>}

    <div className="hb-ency-layout">
      <aside className="hb-ency-explorer" aria-label="Explorar artigos">
        <div className="hb-ency-explorer-head"><strong>Biblioteca</strong><span>{filtered.length}</span></div>
        <label className="hb-ency-search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar artigos..." aria-label="Buscar artigos da Enciclopédia" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="hb-ency-categories" role="group" aria-label="Filtrar por categoria">
          <button type="button" className={categoryFilter === 'all' ? 'active' : ''} aria-pressed={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')}>Todos</button>
          {categories.map(name => <button key={name} type="button" className={categoryFilter === name ? 'active' : ''} aria-pressed={categoryFilter === name} onClick={() => setCategoryFilter(name)}>{name}</button>)}
        </div>
        <div className="hb-ency-explorer-list" aria-label="Lista de artigos">
          {loading && <p className="hb-ency-list-empty">Carregando artigos...</p>}
          {!loading && filtered.map(page => <button key={page.id} type="button" className={`hb-ency-entry${selectedId === page.id && !editing ? ' is-selected' : ''}`} aria-current={selectedId === page.id && !editing ? 'page' : undefined} onClick={() => choosePage(page.id)}>
            <span className="hb-ency-entry-icon" aria-hidden="true">▤</span>
            <span className="hb-ency-entry-text"><strong>{page.title}</strong><small>{page.category || 'Sem categoria'} · {dateLabel(page.updated_at)}</small></span>
            {page.visibility === 'master' && <span className="hb-ency-private" title="Somente mestres" aria-label="Somente mestres">♙</span>}
          </button>)}
          {!loading && filtered.length === 0 && <div className="hb-ency-list-empty"><strong>Nenhum artigo encontrado</strong><p>{pages.length ? 'Altere a busca ou a categoria.' : 'A Enciclopédia ainda está vazia.'}</p></div>}
        </div>
      </aside>

      <div className="hb-ency-reader" role="region" aria-label={editing ? 'Editor da Enciclopédia' : 'Conteúdo do artigo'}>
        {editing ? <form className="hb-ency-editor" onSubmit={save}>
          <div className="hb-ency-reader-topline"><span>ENCICLOPÉDIA / {draftId ? 'EDITAR ARTIGO' : 'NOVO ARTIGO'}</span><button type="button" onClick={() => { setEditing(false); setDraftId(null) }}>✕ Fechar</button></div>
          <h3>{draftId ? 'Editar artigo' : 'Novo artigo'}</h3>
          <p className="hb-ency-reader-sub">Registre o conhecimento compartilhado com a campanha.</p>
          <label>Título do artigo<input autoFocus required minLength={3} maxLength={100} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex.: A cidade de Valenor" /></label>
          <div className="hb-ency-editor-fields">
            <label>Categoria<input maxLength={60} value={category} onChange={event => setCategory(event.target.value)} placeholder="Locais, História, Personagens..." /></label>
            <label>Visibilidade<select value={visibility} onChange={event => setVisibility(event.target.value as Visibility)}><option value="campaign">Todos da campanha</option><option value="master">Somente mestres</option></select></label>
          </div>
          <label className="hb-ency-body-label">Conteúdo<textarea rows={13} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} placeholder="Escreva a história, a descrição ou os registros deste artigo..." /></label>
          <div className="hb-ency-editor-bottom"><small>{body.length.toLocaleString('pt-BR')} / 20.000 caracteres</small><div><button type="button" onClick={() => { setEditing(false); setDraftId(null) }}>Cancelar</button><button className="hb-ency-primary" type="submit" disabled={busy || title.trim().length < 3}>{busy ? 'Salvando...' : 'Salvar artigo'}</button></div></div>
        </form> : current ? <article className="hb-ency-article">
          <div className="hb-ency-reader-topline"><span>ENCICLOPÉDIA / {current.category || 'SEM CATEGORIA'}</span><span>REVISÃO {current.revision}</span></div>
          <div className="hb-ency-article-heading"><div><div className="hb-ency-article-tags"><span>{current.category || 'Sem categoria'}</span>{current.visibility === 'master' && <span className="hb-ency-tag-private">♙ Apenas mestres</span>}</div><h3>{current.title}</h3><p>Atualizado em {new Date(current.updated_at).toLocaleString('pt-BR')}</p></div><div className="hb-ency-article-actions"><button type="button" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>◷ Revisões</button>{canManage && <button type="button" className="hb-ency-primary" onClick={() => startEdit(current)}>✎ Editar</button>}</div></div>
          <div className="hb-ency-article-rule" />
          <div className="hb-ency-article-body">{current.body || 'Este artigo ainda não tem conteúdo.'}</div>
          {showHistory && <section className="hb-ency-history" aria-label="Histórico de revisões"><div className="hb-ency-history-heading"><strong>Histórico de revisões</strong><small>Somente leitura</small></div>{loadingHistory && <p>Carregando revisões...</p>}{!loadingHistory && history.map(item => <details key={item.id}><summary>Revisão {item.revision} · {new Date(item.edited_at).toLocaleString('pt-BR')}</summary><div className="hb-ency-revision-text">{item.body || 'Sem conteúdo'}</div></details>)}{!loadingHistory && history.length === 0 && <p>Não há revisões anteriores para este artigo.</p>}</section>}
        </article> : <div className="hb-ency-welcome"><div className="hb-ency-welcome-icon" aria-hidden="true">✧</div><h3>Explore a Enciclopédia</h3><p>{loading ? 'Carregando seus registros...' : 'Escolha um artigo na biblioteca para começar a leitura.'}</p>{canManage && !loading && <button className="hb-ency-primary" type="button" onClick={() => startEdit()}>＋ Criar primeiro artigo</button>}</div>}
      </div>
    </div>
  </section>
}
