import { useState } from 'react'
import type { PresenceSettingsV302,PresenceStatusV302 } from './usePresenceV302'
import './PresenceControlsV302.css'

type Props={settings:PresenceSettingsV302;connected:boolean;onChange:(change:Partial<PresenceSettingsV302>)=>void}
const statuses:{value:PresenceStatusV302;label:string}[]=[
  {value:'available',label:'Disponível'}, {value:'busy',label:'Ocupado'}, {value:'invisible',label:'Invisível'}]
/** Preferências locais por conta: em modo Invisível não existe linha pública de presença. */
export default function PresenceControlsV302({settings,connected,onChange}:Props){
  const [open,setOpen]=useState(false)
  return <div className="hb-v302-presence-control">
    <button type="button" className="hb-v302-presence-trigger" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={`Presença: ${statuses.find(s=>s.value===settings.status)?.label}`} title="Definir presença e atividade">
      <span className={`hb-v302-presence-dot is-${settings.status}`} aria-hidden="true"/><span>Presença</span>
    </button>
    {open&&<div className="hb-v302-presence-menu" role="group" aria-label="Configurações de presença">
      <div className="hb-v302-presence-menu-head"><strong>Minha presença</strong><button type="button" onClick={()=>setOpen(false)} aria-label="Fechar painel">×</button></div>
      {statuses.map(item=><button key={item.value} type="button" aria-pressed={settings.status===item.value} onClick={()=>onChange({status:item.value})}><span className={`hb-v302-presence-dot is-${item.value}`} aria-hidden="true"/>{item.label}{settings.status===item.value&&<span aria-hidden="true">✓</span>}</button>)}
      <label className="hb-v302-presence-share"><input type="checkbox" checked={settings.showActivity} onChange={e=>onChange({showActivity:e.target.checked})}/>Mostrar atividade atual</label>
      <small>Somente pessoas em servidores em comum podem ver seu status. A atividade mostra apenas a área geral, nunca personagens ou mensagens. Invisível oculta sua presença.</small>
      {settings.status!=='invisible'&&!connected&&<small className="hb-v302-presence-warning">Presença indisponível. Confira a conexão e a instalação do SQL V302 no Supabase.</small>}
    </div>}
  </div>
}
