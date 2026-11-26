import { lazy, Suspense, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { VoiceRoomV302 } from './voiceTypesV302'
import './VoiceDockV302.css'

// A instância WebRTC pertence ao dock global, não ao canal selecionado.
const VoiceCallV288=lazy(()=>import('./VoiceCallV288'))
type Props={room:VoiceRoomV302;userId:string;label:string;avatarUrl?:string;activeSpace:string;onLeave:()=>void}
type Position={x:number;y:number}
function readPin(){try{return localStorage.getItem('haxbag:v302:voice-pin')!=='false'}catch{return true}}
function readPosition():Position|null{
  try {const data=JSON.parse(localStorage.getItem('haxbag:v302:voice-position')||'null') as Position|null
    return data&&Number.isFinite(data.x)&&Number.isFinite(data.y)?data:null
  }catch{return null}
}
export default function VoiceDockV302({room,userId,label,avatarUrl,activeSpace,onLeave}:Props){
  const root=useRef<HTMLElement>(null)
  const drag=useRef<{id:number;startX:number;startY:number;left:number;top:number}|null>(null)
  const [pinned,setPinned]=useState(readPin)
  const [minimized,setMinimized]=useState(false)
  const [position,setPosition]=useState<Position|null>(readPosition)
  const lastSpace=useRef(activeSpace)
  useEffect(()=>{
    if(lastSpace.current!==activeSpace){lastSpace.current=activeSpace;if(!pinned)setMinimized(true)}
  },[activeSpace,pinned])
  useEffect(()=>{
    if(!position)return
    const onResize=()=>setPosition(old=>old?{x:Math.min(Math.max(8,old.x),Math.max(8,window.innerWidth-310)),y:Math.min(Math.max(8,old.y),Math.max(8,window.innerHeight-100))}:null)
    window.addEventListener('resize',onResize)
    return ()=>window.removeEventListener('resize',onResize)
  },[position!==null])
  const startDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0 || !(event.target instanceof Element) || event.target.closest('button'))return
    const rect=root.current?.getBoundingClientRect();if(!rect)return
    drag.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,left:rect.left,top:rect.top}
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const current=drag.current;if(!current||current.id!==event.pointerId)return
    const width=root.current?.offsetWidth||480
    const height=root.current?.offsetHeight||200
    setPosition({x:Math.min(Math.max(8,current.left+event.clientX-current.startX),Math.max(8,window.innerWidth-width-8)),y:Math.min(Math.max(8,current.top+event.clientY-current.startY),Math.max(8,window.innerHeight-height-8))})
  }
  const stopDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(drag.current?.id!==event.pointerId)return
    drag.current=null
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId)
    setPosition(value=>{
      try{if(value)localStorage.setItem('haxbag:v302:voice-position',JSON.stringify(value))}catch{/* falha de persistência */}
      return value
    })
  }
  return <section ref={root} className={`hb-v302-call-dock${minimized?' is-minimized':''}`} style={position?{left:position.x,top:position.y,right:'auto',bottom:'auto'}:undefined} aria-label={`Chamada ativa: ${room.name}`}>
    <div className="hb-v302-dock-top" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} title="Arraste para mover a chamada">
      <span aria-hidden="true">◉</span><strong>{room.name}</strong><small>{room.serverName}</small><span className="hb-v302-dock-grip" aria-hidden="true">⠿</span>
      <button type="button" aria-pressed={pinned} title={pinned?'Não fixar a janela':'Manter janela visível ao navegar'} onClick={()=>{setPinned(v=>{try{localStorage.setItem('haxbag:v302:voice-pin',String(!v))}catch{/* persistência indisponível */}return !v})}}>{pinned?'⌁ Fixada':'⌁ Fixar'}</button>
      <button type="button" onClick={()=>setMinimized(v=>!v)} title={minimized?'Expandir chamada':'Minimizar chamada'}>{minimized?'▢':'—'}</button>
    </div>
    {/* O áudio e a negociação continuam montados mesmo quando a janela é minimizada. */}
    <div className="hb-v302-dock-media" aria-hidden={minimized}>
      <Suspense fallback={<div className="hb-v302-dock-loading">Preparando chamada…</div>}>
        <VoiceCallV288 room={room} userId={userId} label={label} avatarUrl={avatarUrl} compact onLeave={onLeave}/>
      </Suspense>
    </div>
    {minimized&&<div className="hb-v302-dock-min-actions"><button type="button" onClick={()=>setMinimized(false)}>Mostrar chamada</button><button type="button" onClick={onLeave}>Sair</button></div>}
  </section>
}
