import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { supabase } from '../supabase'
import './IdentityCardCustomizer.css'

export type IdentityCardPreferences = {
  image: string
  position: number
  portrait: 'photo' | 'symbol'
}

export const DEFAULT_IDENTITY_CARD: IdentityCardPreferences = {
  image: '', position: 50, portrait: 'photo',
}

const MAX_UPLOAD = 6_000_000
const MAX_STORED = 1_250_000

function imageToCardBackground(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Escolha uma imagem PNG, JPG ou WebP.'))
  }
  if (file.size > MAX_UPLOAD) return Promise.reject(new Error('Escolha uma imagem de até 6 MB.'))
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Não foi possível abrir a imagem.')) }
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      try {
        const ratio = Math.min(1, 1200 / img.naturalWidth, 1500 / img.naturalHeight)
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio))
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Não foi possível processar a imagem.')
        context.drawImage(img, 0, 0, canvas.width, canvas.height)
        let data = canvas.toDataURL('image/webp', 0.83)
        if (data.length > MAX_STORED) data = canvas.toDataURL('image/webp', 0.66)
        if (data.length > MAX_STORED) throw new Error('A imagem continua muito grande. Escolha uma com menos detalhes.')
        resolve(data)
      } catch (err) { reject(err) }
    }
    img.src = objectUrl
  })
}

export default function IdentityCardCustomizer({ userId, hasProfilePhoto, profileCoverImage, onPreviewChange }: {
  userId: string
  hasProfilePhoto: boolean
  profileCoverImage: string
  onPreviewChange: (value: IdentityCardPreferences) => void
}) {
  const [draft, setDraft] = useState<IdentityCardPreferences>(DEFAULT_IDENTITY_CARD)
  const [saved, setSaved] = useState<IdentityCardPreferences>(DEFAULT_IDENTITY_CARD)
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const onPreviewRef = useRef(onPreviewChange)
  onPreviewRef.current = onPreviewChange

  useEffect(() => {
    let canceled = false
    setLoaded(false)
    setDraft(DEFAULT_IDENTITY_CARD)
    onPreviewRef.current(DEFAULT_IDENTITY_CARD)
    void supabase.from('hax_profile_showcase')
      .select('identity_card_image,identity_card_position,identity_card_portrait')
      .eq('user_id', userId).maybeSingle()
      .then(({ data, error: failure }) => {
        if (canceled) return
        if (failure) setError(`Não foi possível carregar a carta: ${failure.message}. Execute o SQL da V133.`)
        else {
          const normalized: IdentityCardPreferences = {
            image: typeof data?.identity_card_image === 'string' ? data.identity_card_image : '',
            position: typeof data?.identity_card_position === 'number' ? data.identity_card_position : 50,
            portrait: data?.identity_card_portrait === 'symbol' ? 'symbol' : 'photo',
          }
          setDraft(normalized)
          setSaved(normalized)
          setError('')
        }
        setLoaded(true)
      })
    return () => { canceled = true }
  }, [userId])

  useEffect(() => { onPreviewRef.current(draft) }, [draft])

  const dirty = draft.image !== saved.image || draft.position !== saved.position || draft.portrait !== saved.portrait
  const hasExclusiveImage = Boolean(draft.image)
  const backgroundIsProfileCover = !hasExclusiveImage

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true); setError(''); setNotice('')
    try {
      const image = await imageToCardBackground(file)
      setDraft(previous => ({ ...previous, image }))
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)) }
    finally { setUploading(false) }
  }

  async function save() {
    if (!dirty || saving || uploading || !loaded) return
    setSaving(true); setError(''); setNotice('')
    const payload = {
      identity_card_image: draft.image,
      identity_card_position: draft.position,
      identity_card_portrait: draft.portrait,
    }
    const { data: existing, error: checkFailure } = await supabase.from('hax_profile_showcase')
      .select('user_id').eq('user_id', userId).maybeSingle()
    if (checkFailure) { setError(checkFailure.message); setSaving(false); return }
    const result = existing
      ? await supabase.from('hax_profile_showcase').update(payload).eq('user_id',userId)
      : await supabase.from('hax_profile_showcase').insert({ user_id:userId, ...payload })
    setSaving(false)
    if (result.error) setError(`Não foi possível salvar a carta: ${result.error.message}`)
    else { setSaved(draft); setNotice('Carta de Identidade salva.'); }
  }

  return <section className="hb-identity-card-editor" aria-labelledby="hb-identity-card-editor-title">
    <div className="hb-identity-card-editor-header">
      <span className="hb-v130-studio-index" aria-hidden="true">03</span>
      <div><span className="hb-kicker">SUA CARTA, SUA MARCA</span><h3 id="hb-identity-card-editor-title">Carta de Identidade</h3>
        <p>A carta usa a capa do seu perfil por padrão. Se preferir, escolha uma imagem exclusiva aqui, sem alterar sua capa pública.</p></div>
    </div>
    <div className="hb-identity-card-editor-grid">
      <div className="hb-identity-card-editor-upload">
        <div className={`hb-identity-card-background-source ${backgroundIsProfileCover?'is-profile-cover':'is-exclusive'}`}>
          <span aria-hidden="true">{backgroundIsProfileCover?'✧':'▧'}</span>
          <div><strong>{backgroundIsProfileCover?'Usando a capa do perfil':'Fundo exclusivo da carta'}</strong>
            <small>{backgroundIsProfileCover
              ? profileCoverImage?'A mesma imagem da sua capa será usada automaticamente.':'Sem capa personalizada: será mantido o fundo do tema escolhido.'
              : 'Esta imagem é aplicada apenas à Carta de Identidade.'}</small></div>
        </div>
        <label className="hb-identity-card-upload-choice"><span aria-hidden="true">▧</span><strong>{hasExclusiveImage?'Trocar fundo exclusivo':'Escolher fundo exclusivo'}</strong><small>PNG, JPG ou WebP · até 6 MB</small>
          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || saving || !loaded} onChange={event=>void chooseImage(event)} /></label>
        <div className="hb-identity-card-settings">
          <label>Posição da imagem <strong>{draft.position}%</strong>
            <input type="range" min={0} max={100} value={draft.position} disabled={!loaded || !hasExclusiveImage} onChange={event=>setDraft(previous=>({...previous,position:Number(event.target.value)}))}/></label>
          <div className="hb-identity-card-portrait-group" role="group" aria-label="Retrato da Carta de Identidade">
            <span>Retrato na carta</span>
            <button type="button" className={draft.portrait==='photo'?'selected':''} aria-pressed={draft.portrait==='photo'} disabled={!loaded} onClick={()=>setDraft(previous=>({...previous,portrait:'photo'}))}>Foto do perfil</button>
            <button type="button" className={draft.portrait==='symbol'?'selected':''} aria-pressed={draft.portrait==='symbol'} disabled={!loaded} onClick={()=>setDraft(previous=>({...previous,portrait:'symbol'}))}>Símbolo</button>
            {!hasProfilePhoto && <small>Envie uma foto em Identidade e Legado → Aparência para usá-la no retrato. Até lá, aparece seu símbolo.</small>}
          </div>
        </div>
        <div className="hb-identity-card-editor-actions">
          <button type="button" disabled={!loaded || uploading || saving || !hasExclusiveImage} onClick={()=>setDraft(previous=>({...previous,image:'',position:50}))}>Usar capa do perfil</button>
          <button type="button" disabled={!loaded || !dirty || uploading || saving} onClick={()=>setDraft(saved)}>Descartar</button>
          <button type="button" className="hb-identity-card-save" disabled={!loaded || !dirty || uploading || saving} onClick={()=>void save()}>{saving?'Salvando…':uploading?'Preparando…':'Salvar carta'}</button>
        </div>
      </div>
      <div className="hb-identity-card-editor-note"><span aria-hidden="true">✦</span><strong>Prévia ao lado</strong><p>A Carta usa a capa do perfil automaticamente enquanto não houver fundo exclusivo. O Ateliê é o único lugar para trocar esse fundo; a visibilidade pública é definida em Identidade e Legado → Privacidade.</p>
        <small>{!loaded?'Carregando…':dirty?'● Carta com alterações não salvas':'✓ Carta atualizada'}</small></div>
    </div>
    {error && <p role="alert" className="hb-identity-card-message error">{error}</p>}
    {notice && <p role="status" className="hb-identity-card-message">{notice}</p>}
  </section>
}
