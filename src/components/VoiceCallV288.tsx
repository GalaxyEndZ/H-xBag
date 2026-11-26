import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'
import './VoiceCall.styles.css'

type Room = { id: string; serverId: string; name: string; serverName: string }
type Presence = { userId: string; label: string; muted: boolean; deafened: boolean; sharing?: boolean; joinedAt: string }
type VoiceSignal = {
  from: string; to: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
type VoiceParticipant = Presence & { sessionId: string; connected: boolean }

type Props = {
  room: Room; userId: string; label: string; avatarUrl?:string; compact: boolean;
  onLeave: () => void;
}

// Configuração opcional do TURN para redes restritivas. Nunca inclua credenciais persistentes
// e secretas em variáveis VITE_* de produção: prefira credenciais temporárias entregues por API.
const iceServers: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
]
const MAX_MESH_PEERS = 7

async function getIceServers(accessToken: string): Promise<RTCIceServer[]> {
  const endpoint = String(import.meta.env.VITE_HAXBAG_VOICE_ICE_URL || '').trim()
  if (!endpoint) return iceServers
  const response = await fetch(endpoint,{headers:{Authorization:`Bearer ${accessToken}`},signal:AbortSignal.timeout(8000)})
  if (!response.ok) throw new Error('O serviço de ICE/TURN não respondeu. Confira a configuração da sala de voz.')
  const data:unknown = await response.json()
  if(!data || typeof data!=='object' || !('iceServers' in data) || !Array.isArray(data.iceServers))throw new Error('Configuração ICE/TURN inválida.')
  const extras = data.iceServers.filter((entry:unknown):entry is RTCIceServer =>
    Boolean(entry && typeof entry==='object' && 'urls' in entry &&
      (typeof entry.urls==='string' || (Array.isArray(entry.urls) && entry.urls.every((url:unknown)=>typeof url==='string')))))
  return [...iceServers,...extras]
}


/** A prévia só exibe vídeo, sem reproduzir o áudio do computador compartilhado. */
function SharedDisplay({stream,owner,local=false}:{stream:MediaStream|null;owner:string;local?:boolean}) {
  const videoRef=useRef<HTMLVideoElement>(null)
  const boxRef=useRef<HTMLDivElement>(null)
  useEffect(()=>{
    const video=videoRef.current
    if(!video)return
    video.srcObject=stream
    if(stream)void video.play().catch(()=>{})
    return ()=>{video.pause();video.srcObject=null}
  },[stream])
  return <div className="hb-voice-screen-card-v290" ref={boxRef}>
    <div className="hb-voice-screen-toolbar-v290"><span><i aria-hidden="true"/> {local?'Sua transmissão':`Tela de ${owner}`}</span><button type="button" onClick={()=>{const node=boxRef.current;if(node && document.fullscreenElement!==node && node.requestFullscreen)void node.requestFullscreen().catch(()=>{}) ; else if(document.fullscreenElement)void document.exitFullscreen().catch(()=>{})}} title="Ampliar a transmissão">⛶ Ampliar</button></div>
    {stream?<video ref={videoRef} autoPlay playsInline muted aria-label={`Transmissão de tela de ${owner}`}/>:<div className="hb-voice-screen-wait-v290"><span>▣</span><strong>Conectando à transmissão…</strong><small>O vídeo será exibido quando a conexão entre vocês estiver pronta.</small></div>}
  </div>
}

export default function VoiceCallV288({room,userId,label,avatarUrl,compact,onLeave}:Props) {
  const [status,setStatus] = useState<'connecting'|'ready'|'error'>('connecting')
  const [problem,setProblem] = useState('')
  const [participants,setParticipants] = useState<VoiceParticipant[]>([])
  const [peerAvatarsV304,setPeerAvatarsV304] = useState<Record<string,string>>({})
  const [muted,setMuted] = useState(false)
  const [deafened,setDeafened] = useState(false)
  const [volume,setVolume] = useState(85)
  const [playBlocked,setPlayBlocked] = useState(false)
  const [sharing,setSharing] = useState(false)
  const [startingShare,setStartingShare] = useState(false)
  const [screenStream,setScreenStream] = useState<MediaStream|null>(null)
  const [remoteScreens,setRemoteScreens] = useState<Record<string,MediaStream>>({})
  const [focusedScreen,setFocusedScreen] = useState<string|null>(null)
  const [screenError,setScreenError] = useState('')
  const pipWindowRef=useRef<Window|null>(null)
  const pipVideoRef=useRef<HTMLVideoElement|null>(null)
  const screenStreamRef=useRef<MediaStream|null>(null)
  const videoSendersRef=useRef<Map<string,RTCRtpSender>>(new Map())
  const clientIdRef=useRef('')
  const mountedRef=useRef(false)
  const capturePendingRef=useRef(false)
  const joinedAtRef=useRef(new Date().toISOString())
  const audioHost = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel>|null>(null)
  const streamRef = useRef<MediaStream|null>(null)
  const audioRef = useRef<Map<string,HTMLAudioElement>>(new Map())
  const mutedRef = useRef(muted)
  const deafenedRef = useRef(deafened)
  const volumeRef = useRef(volume)
  mutedRef.current = muted
  deafenedRef.current = deafened
  volumeRef.current = volume

  useEffect(() => {
    let disposed = false
    mountedRef.current=true
    const clientId = crypto.randomUUID()
    clientIdRef.current=clientId
    joinedAtRef.current=new Date().toISOString()
    const peers = new Map<string,RTCPeerConnection>()
    const pendingCandidates = new Map<string,RTCIceCandidateInit[]>()
    const topic = `hax-v288-voice:${room.serverId}:${room.id}`
    const channel = supabase.channel(topic,{config:{private:true,broadcast:{self:false,ack:true},presence:{key:clientId}}})
    channelRef.current=channel
    let trackReady = false
    let resolvedIceServers = iceServers
    const emit = async (payload:VoiceSignal) => {
      if(disposed)return
      const result = await channel.send({type:'broadcast',event:'voice-signal',payload})
      if(result !== 'ok' && !disposed) setProblem('Falha na sinalização da chamada. Verifique a conexão Realtime.')
    }
    const update = () => {
      if(disposed)return
      const state = channel.presenceState<Presence>()
      const next = Object.entries(state).flatMap(([sid, entries]) => (entries||[]).map(p => ({
        sessionId:sid,userId:String(p.userId||''),label:String(p.label||'Participante').slice(0,60),
        muted:Boolean(p.muted),deafened:Boolean(p.deafened),sharing:Boolean(p.sharing),joinedAt:String(p.joinedAt||''),
        connected: sid===clientId || peers.get(sid)?.connectionState==='connected',
      }))).filter(p=>p.sessionId && p.userId)
      setParticipants(next)
      if(next.length>MAX_MESH_PEERS+1){
        setProblem('Esta chamada utiliza conexão direta entre os participantes e suporta até 8 pessoas por sala nesta versão. Para salas maiores, será necessário um servidor de mídia.')
      }
      const online = new Set(next.map(p=>p.sessionId))
      for(const [sid,pc] of peers){
        if(!online.has(sid)){
          pc.close();peers.delete(sid);pendingCandidates.delete(sid);videoSendersRef.current.delete(sid)
          setRemoteScreens(previous=>{if(!(sid in previous))return previous;const next={...previous};delete next[sid];return next})
          const audio=audioRef.current.get(sid);audio?.pause();audio?.remove();audioRef.current.delete(sid)
        }
      }
      if (!trackReady) return
      for(const p of next){
        if(p.sessionId===clientId || peers.has(p.sessionId))continue
        if(peers.size>=MAX_MESH_PEERS)break
        if(clientId < p.sessionId) void initiate(p.sessionId)
      }
    }
    const addPeer = (remoteId:string) => {
      const existing = peers.get(remoteId)
      if(existing)return existing
      if(peers.size>=MAX_MESH_PEERS || !streamRef.current) return null
      const peer = new RTCPeerConnection({iceServers:resolvedIceServers})
      peers.set(remoteId,peer)
      for(const track of streamRef.current.getAudioTracks())peer.addTrack(track,streamRef.current)
      // Reservar a mídia de vídeo desde a primeira negociação evita novos offers
      // quando o participante começa ou interrompe o compartilhamento de tela.
      const shareTrack=screenStreamRef.current?.getVideoTracks()[0]
      const video=shareTrack
        ?peer.addTransceiver(shareTrack,{direction:'sendrecv',streams:[screenStreamRef.current!]})
        :peer.addTransceiver('video',{direction:'sendrecv'})
      videoSendersRef.current.set(remoteId,video.sender)
      peer.onicecandidate = event => {
        if(event.candidate)void emit({from:clientId,to:remoteId,candidate:event.candidate.toJSON()})
      }
      peer.ontrack = event => {
        if(disposed)return
        if(event.track.kind==='video'){
          // A trilha pode começar sem quadros e será ativada depois por replaceTrack.
          const videoStream=new MediaStream([event.track])
          setRemoteScreens(previous=>({...previous,[remoteId]:videoStream}))
          return
        }
        const stream = event.streams[0] || new MediaStream([event.track])
        let audio=audioRef.current.get(remoteId)
        if(!audio){
          audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('aria-hidden','true')
          audioHost.current?.appendChild(audio);audioRef.current.set(remoteId,audio)
        }
        audio.srcObject=stream;audio.muted=deafenedRef.current;audio.volume=volumeRef.current/100
        void audio.play().then(()=>{if(!disposed)setPlayBlocked(false)}).catch(()=>{if(!disposed)setPlayBlocked(true)})
      }
      peer.onconnectionstatechange = () => {
        if(disposed)return
        if(peer.connectionState==='failed'){
          setProblem('Não foi possível conectar a todos os participantes. Um servidor TURN pode ser necessário.')
        }
        update()
      }
      return peer
    }
    const initiate = async (remoteId:string) => {
      if(disposed || !trackReady || peers.has(remoteId))return
      const peer=addPeer(remoteId)
      if(!peer)return
      try {
        const offer=await peer.createOffer()
        if(disposed)return
        await peer.setLocalDescription(offer)
        await emit({from:clientId,to:remoteId,description:peer.localDescription?.toJSON()})
      } catch(err) {if(!disposed)setProblem(`Não foi possível iniciar a conexão: ${String(err)}`)}
    }
    const receive = async (signal:VoiceSignal) => {
      if(disposed || !trackReady || signal.to!==clientId || !signal.from || signal.from===clientId)return
      const peer=addPeer(signal.from)
      if(!peer)return
      try {
        if(signal.description){
          if(signal.description.type==='offer'){
            await peer.setRemoteDescription(signal.description)
            const answer=await peer.createAnswer()
            await peer.setLocalDescription(answer)
            await emit({from:clientId,to:signal.from,description:peer.localDescription?.toJSON()})
          }else if(signal.description.type==='answer'){
            if(peer.signalingState==='have-local-offer')await peer.setRemoteDescription(signal.description)
          }
          const queued=pendingCandidates.get(signal.from)||[]
          pendingCandidates.delete(signal.from)
          for(const c of queued)await peer.addIceCandidate(c)
        }else if(signal.candidate){
          if(peer.remoteDescription)await peer.addIceCandidate(signal.candidate)
          else pendingCandidates.set(signal.from,[...(pendingCandidates.get(signal.from)||[]),signal.candidate])
        }
      }catch(err){if(!disposed)setProblem(`Problema na negociação de áudio: ${String(err)}`)}
    }
    channel.on('broadcast',{event:'voice-signal'},({payload}) => {void receive(payload as VoiceSignal)})
    channel.on('presence',{event:'sync'},update)

    void (async()=>{
      try {
        if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('O microfone exige HTTPS ou localhost e um navegador compatível.')
        const {data:{session}} = await supabase.auth.getSession()
        if(!session?.access_token)throw new Error('Faça login novamente para acessar a chamada.')
        supabase.realtime.setAuth(session.access_token)
        try {resolvedIceServers = await getIceServers(session.access_token)}
        catch(err){ if(!disposed)setProblem(err instanceof Error?`${err.message} Tentando conexão direta por STUN.`:'Tentando conexão direta por STUN.') }
        if(disposed)return
        const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false})
        if(disposed){media.getTracks().forEach(t=>t.stop());return}
        streamRef.current=media
        media.getAudioTracks().forEach(t=>{t.enabled=!mutedRef.current})
        trackReady=true
        channel.subscribe(async state=>{
          if(disposed)return
          if(state==='SUBSCRIBED'){
            const result=await channel.track({userId,label,muted:mutedRef.current,deafened:deafenedRef.current,sharing:Boolean(screenStreamRef.current),joinedAt:joinedAtRef.current} satisfies Presence)
            if(result!=='ok'){
              streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null
              setProblem('Não foi possível registrar sua presença na sala.');setStatus('error')
            }
            else {setStatus('ready');update()}
          }else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'){
            streamRef.current?.getTracks().forEach(track=>track.stop());streamRef.current=null
            for(const peer of peers.values())peer.close()
            setProblem('Conexão Realtime recusada ou interrompida. Verifique o SQL V288 e o acesso ao canal.');setStatus('error')
          }else if(state==='CLOSED')setStatus('error')
        })
      }catch(error){
        if(!disposed){setProblem(error instanceof Error?error.message:String(error));setStatus('error')}
      }
    })()

    return ()=>{
      disposed=true;mountedRef.current=false
      const screen=screenStreamRef.current
      screenStreamRef.current=null
      screen?.getTracks().forEach(track=>{track.onended=null;track.stop()})
      videoSendersRef.current.clear()
      for(const peer of peers.values())peer.close()
      peers.clear();pendingCandidates.clear()
      for(const audio of audioRef.current.values()){audio.pause();audio.srcObject=null;audio.remove()}
      audioRef.current.clear()
      streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null
      if(channelRef.current===channel)channelRef.current=null
      void supabase.removeChannel(channel)
    }
  },[room.id,room.serverId,userId,label])

  const updatePresence = async (nextMuted:boolean,nextDeafened:boolean) => {
    // Atualiza somente os metadados da presença. A captura local nunca é reativada
    // quando o usuário escolhe sair da sala.
    const channel=channelRef.current
    if(channel && status==='ready') await channel.track({userId,label,muted:nextMuted,deafened:nextDeafened,sharing:Boolean(screenStreamRef.current),joinedAt:joinedAtRef.current} satisfies Presence)
  }
  const toggleMicrophone = () => {
    const next=!muted
    streamRef.current?.getAudioTracks().forEach(t=>{t.enabled=!next})
    setMuted(next);void updatePresence(next,deafened)
  }
  const toggleOutput = () => {
    const next=!deafened;setDeafened(next)
    for(const audio of audioRef.current.values())audio.muted=next
    void updatePresence(muted,next)
  }
  const restorePlayback = () => {
    void Promise.all([...audioRef.current.values()].map(audio=>audio.play())).then(()=>setPlayBlocked(false)).catch(()=>setPlayBlocked(true))
  }
  const changeVolume = (value:number) => {
    setVolume(value)
    for(const audio of audioRef.current.values()) audio.volume=value/100
  }
  const stopScreenShare=async()=>{
    const old=screenStreamRef.current
    if(!old)return
    screenStreamRef.current=null
    old.getTracks().forEach(track=>{track.onended=null;track.stop()})
    setScreenStream(null);setSharing(false)
    // replaceTrack(null) cessa o envio de vídeo sem fechar o áudio ou o peer.
    await Promise.allSettled([...videoSendersRef.current.values()].map(sender=>sender.replaceTrack(null)))
    if(mountedRef.current)void updatePresence(mutedRef.current,deafenedRef.current)
  }
  const startScreenShare=async()=>{
    if(status!=='ready'||capturePendingRef.current||screenStreamRef.current)return
    if(!navigator.mediaDevices?.getDisplayMedia){setScreenError('Este navegador não permite compartilhar a tela. Use um navegador desktop compatível em HTTPS ou localhost.');return}
    capturePendingRef.current=true;setStartingShare(true);setScreenError('')
    try{
      // Chamada direta do botão: getDisplayMedia requer uma ação explícita do usuário.
      const media=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:15},audio:false})
      const track=media.getVideoTracks()[0]
      if(!track||!mountedRef.current){media.getTracks().forEach(t=>t.stop());return}
      screenStreamRef.current=media
      track.onended=()=>{void stopScreenShare()}
      setScreenStream(media);setSharing(true);setFocusedScreen(clientIdRef.current)
      const results=await Promise.allSettled([...videoSendersRef.current.values()].map(sender=>sender.replaceTrack(track)))
      if(results.some(result=>result.status==='rejected'))setScreenError('A transmissão começou, mas não foi possível enviar a imagem a todos. Confira as conexões de rede.')
      if(mountedRef.current)void updatePresence(mutedRef.current,deafenedRef.current)
    }catch(error){
      if(!mountedRef.current)return
      const denied=error instanceof DOMException && ['NotAllowedError','AbortError'].includes(error.name)
      if(!denied)setScreenError(error instanceof Error?`Não foi possível iniciar a transmissão: ${error.message}`:'Não foi possível iniciar a transmissão de tela.')
    }finally{capturePendingRef.current=false;if(mountedRef.current)setStartingShare(false)}
  }
  useEffect(()=>{
    const ids=Array.from(new Set(participants.filter(p=>p.userId!==userId).map(p=>p.userId))).slice(0,8)
    if(!ids.length)return
    let active=true
    void supabase.from('hax_profile_showcase').select('user_id,avatar_image').in('user_id',ids).then(({data,error})=>{
      if(active&&!error)setPeerAvatarsV304(Object.fromEntries((data||[]).filter(p=>p.avatar_image).map(p=>[p.user_id,p.avatar_image])))
    })
    return()=>{active=false}
  },[participants.map(p=>p.userId).join(','),userId])
  const remoteShares=participants.filter(p=>p.sharing&&p.sessionId!==clientIdRef.current)
  const screens=[...(sharing&&screenStream?[{id:clientIdRef.current,label,stream:screenStream,local:true}]:[]),
    ...remoteShares.map(p=>({id:p.sessionId,label:p.label,stream:remoteScreens[p.sessionId]||null,local:false}))]
  const selectedScreen=screens.find(s=>s.id===focusedScreen)||screens[0]
  const selfPresent=participants.some(p=>p.sessionId===clientIdRef.current)

  // Document Picture-in-Picture mantém a transmissão sobre outras janelas do Windows,
  // quando disponível no Chromium/Electron. O WebRTC continua nesta página.
  const openNativePip=async()=>{
    type PiPApi={requestWindow:(opts:{width:number;height:number})=>Promise<Window>}
    const api=(window as Window & {documentPictureInPicture?:PiPApi}).documentPictureInPicture
    if(!api){setScreenError('A janela nativa sempre visível não está disponível nesta versão do Electron. Você ainda pode usar o painel flutuante do HäxBag.');return}
    try{
      if(pipWindowRef.current&&!pipWindowRef.current.closed){pipWindowRef.current.focus();return}
      const pip=await api.requestWindow({width:580,height:390})
      pipWindowRef.current=pip
      const style=pip.document.createElement('style')
      style.textContent='*{box-sizing:border-box}body{margin:0;background:#101820;color:#f5eee2;font:13px system-ui;display:flex;flex-direction:column;height:100vh}header{padding:10px 14px;display:flex;gap:9px;align-items:center;background:#1d282e;border-bottom:1px solid #36444b}header b{flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}video{display:block;flex:1;width:100%;height:calc(100vh - 46px);object-fit:contain;background:#05070a}small{padding:20px;text-align:center;color:#bfc6c8}button{background:#2c3539;color:#fff;border:1px solid #5a6769;border-radius:7px;padding:5px 10px;cursor:pointer}'
      pip.document.head.appendChild(style)
      const header=pip.document.createElement('header')
      const title=pip.document.createElement('b')
      title.textContent=`HäxBag · ${room.name}`
      const close=pip.document.createElement('button');close.textContent='Fechar janela';close.onclick=()=>pip.close()
      header.append(title,close);pip.document.body.appendChild(header)
      const video=pip.document.createElement('video');video.autoplay=true;video.playsInline=true;video.muted=true
      pip.document.body.appendChild(video);pipVideoRef.current=video
      pip.addEventListener('pagehide',()=>{if(pipWindowRef.current===pip){pipWindowRef.current=null;pipVideoRef.current=null}},{once:true})
      video.srcObject=selectedScreen?.stream||null
      if(selectedScreen?.stream)void video.play().catch(()=>{})
      else {const hint=pip.document.createElement('small');hint.textContent='Aguardando alguém compartilhar a tela nesta chamada.';pip.document.body.appendChild(hint)}
    }catch(err){setScreenError(err instanceof Error?`Não foi possível abrir a janela: ${err.message}`:'Não foi possível abrir a janela de transmissão.')}
  }
  useEffect(()=>{
    const video=pipVideoRef.current
    if(!video)return
    video.srcObject=selectedScreen?.stream||null
    if(selectedScreen?.stream)void video.play().catch(()=>{})
    const hint=video.parentElement?.querySelector('small')
    if(hint)hint.remove()
  },[selectedScreen?.id,selectedScreen?.stream])
  useEffect(()=>()=>{try{pipWindowRef.current?.close()}catch{/* janela já fechada */}},[])


  return <section className={`hb-voice-v288 hb-voice-v290${compact?' hb-voice-v288--compact':''}${screens.length?' has-screen':''}`} aria-label={`Chamada de áudio ${room.name}`}>
    <header className="hb-voice-header-v288 hb-voice-top-v290">
      <div className="hb-voice-header-title-v288">
        <span className="hb-voice-header-icon-v288" aria-hidden="true">♫</span>
        <div><small>{room.serverName} <span aria-hidden="true">/</span> SALA DE VOZ</small><h2>{room.name}</h2><p>{status==='ready'?'Converse e compartilhe com quem está na sala':status==='connecting'?'Conectando ao microfone…':'Conexão indisponível'}</p></div>
      </div>
      <div className="hb-voice-top-status-v290"><button type="button" className="hb-v302-native-pip-button" title="Abrir transmissão em uma janela sempre visível, quando disponível" onClick={()=>void openNativePip()}>▣ Janela</button><span className="hb-voice-count-v290">◉ {participants.length} {participants.length===1?'participante':'participantes'}</span><span className={`hb-voice-status-v288 hb-voice-status-v288--${status}`}>{status==='ready'?'● Conectado':status==='connecting'?'◌ Conectando':'● Falha'}</span></div>
    </header>
    {problem&&<div className="hb-voice-warning-v288" role="alert">{problem}</div>}
    {screenError&&<div className="hb-voice-warning-v288" role="alert">{screenError}<button type="button" onClick={()=>setScreenError('')} aria-label="Dispensar aviso de transmissão">×</button></div>}
    <div className="hb-voice-workspace-v290">
      <main className="hb-voice-main-v290">
        {screens.length ? <div className="hb-voice-broadcast-v290">
          <div className="hb-voice-section-title-v290"><span>● AO VIVO</span><strong>{screens.length===1?'Transmissão de tela':'Transmissões de tela'}</strong><small>Assista às telas dos participantes sem sair da chamada.</small></div>
          {selectedScreen&&<SharedDisplay key={selectedScreen.id} stream={selectedScreen.stream} owner={selectedScreen.label} local={selectedScreen.local}/>}
          {screens.length>1&&<div className="hb-voice-screen-tabs-v290" aria-label="Escolher transmissão">{screens.map(s=><button type="button" key={s.id} className={selectedScreen?.id===s.id?'active':''} onClick={()=>setFocusedScreen(s.id)} aria-pressed={selectedScreen?.id===s.id}>▣ {s.local?'Sua tela':s.label}</button>)}</div>}
        </div> : <div className="hb-voice-welcome-v290"><div className="hb-voice-welcome-art-v290" aria-hidden="true"><span>♫</span><i/><b/></div><span className="hb-voice-welcome-kicker-v290">VOCÊ ESTÁ EM UMA SALA DE VOZ</span><h3>{room.name}</h3><p>Um espaço para conversar, jogar e acompanhar transmissões. Entre com seus amigos ou compartilhe sua tela quando quiser mostrar algo.</p><div className="hb-voice-welcome-metrics-v290"><span>◉ {participants.length} na chamada</span><span>✦ Áudio em tempo real</span><span>▣ Transmissão de tela</span></div>{status==='ready'&&!sharing&&<button type="button" className="hb-voice-start-shortcut-v290" onClick={()=>void startScreenShare()} disabled={startingShare}>▣ Compartilhar minha tela</button>}</div>}
        <div className="hb-voice-roster-caption-v290"><div><span>NA CONVERSA</span><strong>Quem está por aqui</strong></div><small>{participants.length} {participants.length===1?'pessoa conectada':'pessoas conectadas'}</small></div>
        <div className="hb-voice-participants-v288 hb-voice-people-v290" aria-label="Participantes da chamada">
          {participants.length===0&&<div className="hb-voice-empty-v288">{status==='ready'?'Você está na sala. Convide seus amigos para conversar.':'Preparando a chamada…'}</div>}
          {participants.map(p=><div className={`hb-voice-participant-v288 hb-voice-person-v290${p.connected||p.sessionId===clientIdRef.current?' is-connected':''}`} key={p.sessionId}>
            <div className="hb-voice-avatar-v288">{(p.userId===userId?avatarUrl:peerAvatarsV304[p.userId]) ? <img src={p.userId===userId?avatarUrl:peerAvatarsV304[p.userId]} alt="" loading="lazy" className="hb-v304-account-photo"/> : p.label.slice(0,1).toUpperCase()}</div><div className="hb-voice-person-details-v290"><strong>{p.label}{p.sessionId===clientIdRef.current?' (você)':''}</strong><small>{p.muted?'Microfone desligado':p.sessionId===clientIdRef.current?'Você está na chamada':p.connected?'Áudio conectado':'Conectando áudio…'}</small></div><span className="hb-voice-person-icons-v290">{p.sharing&&<span title="Transmitindo tela">▣</span>}<span title={p.muted?'Microfone desligado':'Microfone ligado'}>{p.muted?'⊘':'♫'}</span></span>
          </div>)}
        </div>
      </main>
      <aside className="hb-voice-aside-v290" aria-label="Informações da sala">
        <div className="hb-voice-aside-heading-v290"><span>✧ NESTA SALA</span><strong>{room.name}</strong><small>{room.serverName}</small></div>
        <div className="hb-voice-aside-stat-v290"><span>Participantes</span><strong>{participants.length}</strong></div>
        <div className="hb-voice-aside-stat-v290"><span>Transmissões</span><strong>{screens.length}</strong></div>
        <div className="hb-voice-aside-note-v290"><strong>▣ Transmissão de tela</strong><p>{sharing?'Você está compartilhando sua tela. Para encerrar, use “Parar transmissão” ou o botão do navegador.':screens.length?'Escolha uma transmissão para assistir. Você também pode compartilhar a sua tela.':'Compartilhe uma aba, janela ou tela inteira. Cada pessoa autoriza o compartilhamento no próprio navegador.'}</p></div>
        <div className="hb-voice-aside-note-v290 hb-voice-aside-note-v290--subtle"><strong>Privacidade</strong><p>O vídeo é enviado apenas às pessoas conectadas à sala. A transmissão não é gravada pelo HäxBag.</p></div>
      </aside>
    </div>
    {playBlocked&&<button type="button" className="hb-voice-activate-v288" onClick={restorePlayback}>▶ Ativar áudio dos participantes</button>}
    <footer className="hb-voice-controls-v288 hb-voice-footer-v290">
      <div className="hb-voice-controls-copy-v290"><span className="hb-voice-controls-indicator-v290"/><div><strong>{sharing?'Você está transmitindo':status==='ready'&&selfPresent?'Chamada conectada':'Chamada de voz'}</strong><small>{sharing?'Sua tela está visível para esta sala':status==='ready'?'Sua conversa está ativa':'Preparando a conexão'}</small></div></div>
      <div className="hb-voice-controls-actions-v290">
        <button type="button" className={muted?'is-off':''} onClick={toggleMicrophone} disabled={!streamRef.current} title={muted?'Ativar microfone':'Silenciar microfone'} aria-pressed={muted}>{muted?'⊘ Microfone':'🎙 Microfone'}</button>
        <button type="button" className={deafened?'is-off':''} onClick={toggleOutput} aria-pressed={deafened} title="Silenciar o som de entrada">{deafened?'◌ Som desligado':'♫ Som'}</button>
        <button type="button" className={`hb-voice-share-button-v290${sharing?' is-sharing':''}`} onClick={()=>void(sharing?stopScreenShare():startScreenShare())} disabled={status!=='ready'||startingShare} aria-pressed={sharing} title={sharing?'Parar compartilhamento de tela':'Compartilhar uma janela ou tela'}>{startingShare?'◌ Preparando…':sharing?'■ Parar transmissão':'▣ Transmitir tela'}</button>
        <label className="hb-voice-volume-v288">Volume <input type="range" min="0" max="100" value={volume} onChange={e=>changeVolume(Number(e.target.value))} aria-label="Volume dos participantes"/><span>{volume}%</span></label>
        <button type="button" className="hb-voice-leave-v288" onClick={onLeave}>✕ Sair</button>
      </div>
    </footer>
    <div ref={audioHost} hidden aria-hidden="true"/>
  </section>
}
