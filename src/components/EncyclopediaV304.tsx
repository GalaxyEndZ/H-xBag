import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './V304Features.css'
import './EncyclopediaV3058.css'
import './EncyclopediaV3059.css'

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
type EncyclopediaImage = {
  id: string
  page_id: string
  campaign_id: string
  storage_path: string
  caption: string
  is_cover: boolean
  created_at: string
}
type PendingImage = { id: string; file: File }
const IMAGE_BUCKET = 'hax-v3059-encyclopedia'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_IMAGES_PER_PAGE = 12
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function PendingImagePreview({ file }: { file: File }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const preview = URL.createObjectURL(file)
    setUrl(preview)
    return () => URL.revokeObjectURL(preview)
  }, [file])
  return url ? <img src={url} alt={`Prévia de ${file.name}`} /> : <span>Carregando imagem…</span>
}

const describeError = (error: unknown) => error instanceof Error ? error.message : String(error)
const dateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

/** Enciclopédia por campanha: páginas e imagens privadas, com acesso verificado por RLS. */
export default function EncyclopediaV304({ campaignId, userId, canManage }: { campaignId: string; userId: string; canManage: boolean }) {
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
  const [images, setImages] = useState<EncyclopediaImage[]>([])
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [imageError, setImageError] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [lightboxId, setLightboxId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const current = pages.find(page => page.id === selectedId)
  const imagesFor = (pageId: string) => images.filter(image => image.page_id === pageId).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.created_at.localeCompare(b.created_at))
  const currentImages = current ? imagesFor(current.id) : []
  const draftImages = draftId ? imagesFor(draftId) : []
  const imageUrlsKey = useMemo(() => {
    const covers = new Map<string, string>()
    for (const image of images) {
      if (!covers.has(image.page_id) || image.is_cover) covers.set(image.page_id, image.storage_path)
    }
    const paths = [...covers.values(), ...images.filter(image => image.page_id === selectedId).map(image => image.storage_path)]
    return [...new Set(paths)].sort().join('|')
  }, [images, selectedId])

  // Uma URL temporária não torna um bucket público. A leitura é autorizada pelas políticas do Storage.
  useEffect(() => {
    if (!imageUrlsKey) { setImageUrls({}); return }
    let active = true
    const paths = imageUrlsKey.split('|')
    void (async () => {
      const result: Record<string, string> = {}
      for (let start = 0; start < paths.length; start += 40) {
        const batch = paths.slice(start, start + 40)
        const { data, error: signingError } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(batch, 3600)
        if (signingError) throw signingError
        for (let i = 0; i < (data || []).length; i++) {
          const item = data![i]
          if (item && 'signedUrl' in item && typeof item.signedUrl === 'string') result[batch[i]] = item.signedUrl
        }
      }
      if (active) setImageUrls(result)
    })().catch(cause => { if (active) setImageError(`Não foi possível abrir as imagens: ${describeError(cause)}`) })
    return () => { active = false }
  }, [imageUrlsKey, campaignId])

  useEffect(() => {
    if (!lightboxId) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setLightboxId(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [lightboxId])

  const loadImages = useCallback(async () => {
    const { data, error: mediaError } = await supabase.from('hax_v3059_encyclopedia_images')
      .select('id,page_id,campaign_id,storage_path,caption,is_cover,created_at')
      .eq('campaign_id', campaignId).order('created_at', { ascending: true }).limit(3000)
    if (mediaError) {
      setImageError('Galeria indisponível. Execute HAXBAG_V3059_ENCICLOPEDIA_IMAGENS.sql no Supabase. ' + mediaError.message)
      setImages([])
      return
    }
    setImageError('')
    setImages((data || []) as EncyclopediaImage[])
  }, [campaignId])

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    const available = MAX_IMAGES_PER_PAGE - draftImages.length - pendingImages.length
    if (files.length > available) { setError(`Cada artigo aceita até ${MAX_IMAGES_PER_PAGE} imagens. Restam ${Math.max(available, 0)} espaços.`); return }
    const invalid = files.find(file => !IMAGE_EXTENSIONS[file.type] || file.size > MAX_IMAGE_BYTES || file.size === 0)
    if (invalid) { setError(`Use PNG, JPG ou WebP com até 5 MB por imagem. Arquivo inválido: ${invalid.name}`); return }
    setError('')
    setPendingImages(previous => [...previous, ...files.map(file => ({ id: crypto.randomUUID(), file }))])
  }

  const changeCover = async (imageId: string) => {
    if (!canManage || busy) return
    setBusy(true); setError('')
    try {
      const { error: coverError } = await supabase.rpc('hax_v3059_set_encyclopedia_cover', { p_image: imageId })
      if (coverError) throw coverError
      await loadImages()
      setNotice('Imagem de capa atualizada.')
    } catch (cause) { setError(describeError(cause)) }
    finally { setBusy(false) }
  }

  const removeImage = async (image: EncyclopediaImage) => {
    if (!canManage || busy || !window.confirm('Remover esta imagem do artigo?')) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { error: deleteError } = await supabase.from('hax_v3059_encyclopedia_images').delete().eq('id', image.id)
      if (deleteError) throw deleteError
      setLightboxId(null)
      await loadImages()
      const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove([image.storage_path])
      setNotice(storageError ? 'Imagem removida do artigo. Não foi possível excluir o arquivo do armazenamento.' : 'Imagem removida.')
    } catch (cause) { setError(describeError(cause)) }
    finally { setBusy(false) }
  }

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
    try { await Promise.all([load(), loadImages()]) }
    catch (cause) { setError(`Não foi possível carregar a Enciclopédia: ${describeError(cause)}. Confira a migração V304 e a conexão.`) }
    finally { setLoading(false) }
  }, [load, loadImages])

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
    setImages([])
    setImageUrls({})
    setPendingImages([])
    setLightboxId(null)
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
    setPendingImages([])
    setShowHistory(false)
    setNotice('')
    setError('')
    setEditing(true)
  }

  const choosePage = (id: string) => {
    setSelectedId(id)
    setEditing(false)
    setDraftId(null)
    setPendingImages([])
    setShowHistory(false)
    setLightboxId(null)
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
      const pageId = typeof data === 'string' ? data : original?.id
      if (!pageId) throw new Error('O servidor não retornou o identificador da página salva.')
      // Salva o artigo primeiro, como no Bestiário; as imagens pertencem a uma página existente.
      let uploaded = 0
      const failed: string[] = []
      for (const entry of pendingImages) {
        const extension = IMAGE_EXTENSIONS[entry.file.type]
        if (!extension) { failed.push(entry.file.name); continue }
        const path = `${campaignId}/${pageId}/${crypto.randomUUID()}.${extension}`
        const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, entry.file, { contentType: entry.file.type, upsert: false })
        if (uploadError) { failed.push(entry.file.name); continue }
        const { error: imageInsertError } = await supabase.from('hax_v3059_encyclopedia_images').insert({
          campaign_id: campaignId,
          page_id: pageId,
          storage_path: path,
          caption: entry.file.name.replace(/\.[^.]+$/, '').slice(0, 160),
          is_cover: !draftImages.length && uploaded === 0,
          uploaded_by: userId,
        })
        if (imageInsertError) {
          failed.push(entry.file.name)
          await supabase.storage.from(IMAGE_BUCKET).remove([path])
          continue
        }
        uploaded += 1
      }
      await Promise.all([load(), loadImages()])
      setSelectedId(pageId)
      setEditing(false)
      setDraftId(null)
      setPendingImages([])
      setShowHistory(false)
      setNotice(failed.length
        ? `Artigo salvo; ${uploaded} imagem(ns) enviada(s), mas ${failed.length} falharam (${failed.join(', ')}). Abra Editar para tentar novamente.`
        : `Artigo salvo${uploaded ? ` com ${uploaded} imagem(ns)` : ''}. O histórico do texto foi preservado.`)
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
            <span className="hb-ency-entry-icon" aria-hidden="true">{(() => { const cover = imagesFor(page.id)[0]; return cover && imageUrls[cover.storage_path] ? <img src={imageUrls[cover.storage_path]} alt="" loading="lazy" /> : '▤' })()}</span>
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
          <section className="hb-ency-editor-media" aria-label="Imagens do artigo">
            <div className="hb-ency-section-heading"><div><strong>Imagens e capa</strong><small>Como no Bestiário: a primeira foto será a capa. Você pode alterá-la depois.</small></div><span>{draftImages.length + pendingImages.length}/{MAX_IMAGES_PER_PAGE}</span></div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={addImages} aria-label="Selecionar imagens da Enciclopédia" />
            <button type="button" className="hb-ency-upload" disabled={busy || draftImages.length + pendingImages.length >= MAX_IMAGES_PER_PAGE} onClick={() => fileInputRef.current?.click()}>＋ Adicionar imagens <small>PNG, JPG ou WebP · até 5 MB cada</small></button>
            {(draftImages.length > 0 || pendingImages.length > 0) && <div className="hb-ency-upload-grid">
              {draftImages.map((image, index) => <div className="hb-ency-upload-item" key={image.id}>
                {imageUrls[image.storage_path] ? <img src={imageUrls[image.storage_path]} alt={image.caption || `Imagem ${index + 1}`} /> : <span>Imagem salva</span>}
                <div><small>{image.caption || `Imagem ${index + 1}`}{image.is_cover ? ' · Capa' : ''}</small><button type="button" disabled={busy} onClick={() => void removeImage(image)}>Remover</button></div>
              </div>)}
              {pendingImages.map(entry => <div className="hb-ency-upload-item" key={entry.id}>
                <PendingImagePreview file={entry.file} />
                <div><small>{entry.file.name} · Nova</small><button type="button" disabled={busy} onClick={() => setPendingImages(list => list.filter(item => item.id !== entry.id))}>Remover</button></div>
              </div>)}
            </div>}
          </section>
          <label className="hb-ency-body-label">Conteúdo<textarea rows={13} maxLength={20000} value={body} onChange={event => setBody(event.target.value)} placeholder="Escreva a história, a descrição ou os registros deste artigo..." /></label>
          <div className="hb-ency-editor-bottom"><small>{body.length.toLocaleString('pt-BR')} / 20.000 caracteres</small><div><button type="button" onClick={() => { setEditing(false); setDraftId(null) }}>Cancelar</button><button className="hb-ency-primary" type="submit" disabled={busy || title.trim().length < 3}>{busy ? 'Salvando...' : 'Salvar artigo'}</button></div></div>
        </form> : current ? <article className="hb-ency-article">
          <div className="hb-ency-reader-topline"><span>ENCICLOPÉDIA / {current.category || 'SEM CATEGORIA'}</span><span>REVISÃO {current.revision}</span></div>
          <div className="hb-ency-article-heading"><div><div className="hb-ency-article-tags"><span>{current.category || 'Sem categoria'}</span>{current.visibility === 'master' && <span className="hb-ency-tag-private">♙ Apenas mestres</span>}</div><h3>{current.title}</h3><p>Atualizado em {new Date(current.updated_at).toLocaleString('pt-BR')}</p></div><div className="hb-ency-article-actions"><button type="button" aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>◷ Revisões</button>{canManage && <button type="button" className="hb-ency-primary" onClick={() => startEdit(current)}>✎ Editar</button>}</div></div>
          {currentImages.length > 0 && <section className="hb-ency-article-images" aria-label="Galeria do artigo">
            {currentImages[0] && imageUrls[currentImages[0].storage_path] && <button type="button" className="hb-ency-cover" onClick={() => setLightboxId(currentImages[0].id)} title="Ampliar imagem de capa">
              <img src={imageUrls[currentImages[0].storage_path]} alt={currentImages[0].caption || `Capa de ${current.title}`} />
              <span>⌕ Ampliar capa</span>
            </button>}
            {currentImages.length > 1 && <div className="hb-ency-gallery">
              {currentImages.map((image, index) => imageUrls[image.storage_path] ? <div className="hb-ency-gallery-item" key={image.id}>
                <button type="button" className="hb-ency-gallery-image" onClick={() => setLightboxId(image.id)} title={`Ver ${image.caption || `imagem ${index + 1}`}`}><img src={imageUrls[image.storage_path]} loading="lazy" alt={image.caption || `Imagem ${index + 1}`} /></button>
                <div><small>{image.caption || `Imagem ${index + 1}`}{image.is_cover ? ' · Capa' : ''}</small>{canManage && !image.is_cover && <button type="button" disabled={busy} onClick={() => void changeCover(image.id)}>Usar como capa</button>}</div>
              </div> : null)}
            </div>}
            {currentImages.length === 1 && <div className="hb-ency-image-caption">{currentImages[0].caption || ''}</div>}
            {canManage && <small className="hb-ency-image-tip">Para adicionar ou remover imagens, selecione “Editar”.</small>}
          </section>}
          <div className="hb-ency-article-rule" />
          <div className="hb-ency-article-body">{current.body || 'Este artigo ainda não tem conteúdo.'}</div>
          {showHistory && <section className="hb-ency-history" aria-label="Histórico de revisões"><div className="hb-ency-history-heading"><strong>Histórico de revisões</strong><small>Somente leitura</small></div>{loadingHistory && <p>Carregando revisões...</p>}{!loadingHistory && history.map(item => <details key={item.id}><summary>Revisão {item.revision} · {new Date(item.edited_at).toLocaleString('pt-BR')}</summary><div className="hb-ency-revision-text">{item.body || 'Sem conteúdo'}</div></details>)}{!loadingHistory && history.length === 0 && <p>Não há revisões anteriores para este artigo.</p>}</section>}
        </article> : <div className="hb-ency-welcome"><div className="hb-ency-welcome-icon" aria-hidden="true">✧</div><h3>Explore a Enciclopédia</h3><p>{loading ? 'Carregando seus registros...' : 'Escolha um artigo na biblioteca para começar a leitura.'}</p>{canManage && !loading && <button className="hb-ency-primary" type="button" onClick={() => startEdit()}>＋ Criar primeiro artigo</button>}</div>}
      </div>
    </div>
    {imageError && <div className="hb-ency-image-warning" role="status">{imageError}</div>}
    {lightboxId && (() => {
      const image = images.find(item => item.id === lightboxId && item.page_id === current?.id)
      const url = image && imageUrls[image.storage_path]
      return url && image ? <div className="hb-ency-lightbox" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setLightboxId(null) }}>
        <div className="hb-ency-lightbox-dialog" role="dialog" aria-modal="true" aria-label={`Imagem ampliada: ${image.caption || current?.title}`}>
          <button className="hb-ency-lightbox-close" type="button" onClick={() => setLightboxId(null)} aria-label="Fechar imagem ampliada">✕</button>
          <img src={url} alt={image.caption || current?.title || 'Imagem da Enciclopédia'} />
          <div><span>{image.caption || current?.title}</span>{canManage && !image.is_cover && <button type="button" disabled={busy} onClick={() => { void changeCover(image.id); setLightboxId(null) }}>Usar como capa</button>}</div>
        </div>
      </div> : null
    })()}
  </section>
}
