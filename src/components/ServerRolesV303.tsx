import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './V303Features.css'

export type ServerRoleV303={id:string;server_id:string;name:string;color:string;position:number;permissions:string[]}
type Assignment={server_id:string;user_id:string;role_id:string}
const PERMS=[
  {key:'manage_channels',label:'Gerenciar canais',detail:'Criar, editar e remover canais de texto e voz'},
  {key:'manage_messages',label:'Moderar mensagens',detail:'Fixar e excluir mensagens de outros membros'},
  {key:'manage_invites',label:'Gerenciar convites',detail:'Criar e revogar convites'},
  {key:'read_private_channels',label:'Acessar canais reservados',detail:'Ler canais marcados como privados'},
] as const
const err=(cause:unknown)=>cause instanceof Error?cause.message:String(cause)
export default function ServerRolesV303({serverId,userId,isOwner,members,nameFor,onChanged,onClose}:{
 serverId:string;userId:string;isOwner:boolean;members:{user_id:string;role:string}[];nameFor:(id:string)=>string;onChanged:()=>void;onClose:()=>void
}){
 const [roles,setRoles]=useState<ServerRoleV303[]>([])
 const [assignments,setAssignments]=useState<Assignment[]>([])
 const [selected,setSelected]=useState('')
 const [name,setName]=useState('')
 const [color,setColor]=useState('#D9BD8B')
 const [position,setPosition]=useState(0)
 const [permissions,setPermissions]=useState<string[]>([])
 const [busy,setBusy]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const load=useCallback(async()=>{
  const [r,a]=await Promise.all([
   supabase.from('hax_v303_server_roles').select('id,server_id,name,color,position,permissions').eq('server_id',serverId).order('position',{ascending:false}),
   supabase.from('hax_v303_member_roles').select('server_id,user_id,role_id').eq('server_id',serverId),
  ])
  if(r.error)throw r.error
  if(a.error)throw a.error
  setRoles((r.data||[]) as ServerRoleV303[])
  setAssignments((a.data||[]) as Assignment[])
 },[serverId])
 useEffect(()=>{let active=true;setLoading(true);void load().catch(e=>{if(active)setError(`Não foi possível carregar cargos: ${err(e)}. Execute a migração V303.`)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[load])
 const chosen=roles.find(role=>role.id===selected)
 useEffect(()=>{
  setName(chosen?.name||'');setColor(chosen?.color||'#D9BD8B');setPosition(chosen?.position||0);setPermissions(chosen?.permissions||[])
 },[selected,chosen?.id])
 const mutate=async(action:()=>Promise<void>)=>{
  if(busy)return;setBusy(true);setError('');setNotice('')
  try {await action();await load();onChanged();setNotice('Alterações salvas com sucesso.')}
  catch(e){setError(err(e))} finally {setBusy(false)}
 }
 const save=(event:FormEvent)=>{event.preventDefault();if(!isOwner)return;void mutate(async()=>{
  const payload={name:name.trim(),color,permissions,position}
  if(payload.name.length<2||payload.name.length>32)throw new Error('Informe um nome de 2 a 32 caracteres.')
  if(chosen){const {error:e}=await supabase.from('hax_v303_server_roles').update(payload).eq('server_id',serverId).eq('id',chosen.id);if(e)throw e}
  else {const {data,error:e}=await supabase.from('hax_v303_server_roles').insert({...payload,server_id:serverId}).select('id').single();if(e)throw e;setSelected(data.id)}
 })}
 const remove=()=>{if(!chosen||!isOwner||!window.confirm(`Excluir o cargo “${chosen.name}”? As atribuições serão removidas.`))return;void mutate(async()=>{
  const {error:e}=await supabase.from('hax_v303_server_roles').delete().eq('server_id',serverId).eq('id',chosen.id)
  if(e)throw e;setSelected('')
 })}
 const assign=(targetId:string,roleId:string,shouldAssign:boolean)=>void mutate(async()=>{
  const {error:e}=await supabase.rpc('hax_v303_assign_role',{p_server:serverId,p_user:targetId,p_role:roleId,p_assign:shouldAssign})
  if(e)throw e
 })
 return <div className="hb-v303-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <section className="hb-v303-dialog" role="dialog" aria-modal="true" aria-label="Cargos e permissões do servidor">
   <header className="hb-v303-dialog-head"><div><small>HÄXBAG / SERVIDOR</small><h2>Cargos e permissões</h2><p>Os cargos personalizados complementam Dono, Administrador, Moderador e Membro.</p></div><button onClick={onClose} type="button" aria-label="Fechar">×</button></header>
   {error&&<p role="alert" className="hb-v303-error">{error}</p>}{notice&&<p role="status" className="hb-v303-success">{notice}</p>}
   {loading?<p>Carregando cargos…</p>:<div className="hb-v303-role-grid">
    <nav className="hb-v303-role-list" aria-label="Cargos personalizados"><button type="button" className={!selected?'is-selected':''} onClick={()=>setSelected('')}>＋ Novo cargo</button>
     {roles.map(role=><button key={role.id} type="button" className={selected===role.id?'is-selected':''} onClick={()=>setSelected(role.id)}><span className="hb-v303-role-color" style={{backgroundColor:role.color}}/>{role.name}<small>{assignments.filter(a=>a.role_id===role.id).length}</small></button>)}
     {!roles.length&&<p>Crie um cargo para organizar sua equipe.</p>}
    </nav>
    <div className="hb-v303-role-details"><form onSubmit={save} className="hb-v303-form"><label>Nome do cargo<input disabled={!isOwner||busy} value={name} onChange={e=>setName(e.target.value)} maxLength={32} placeholder="Ex.: Organizador" required/></label>
     <label>Cor <input type="color" disabled={!isOwner||busy} value={color} onChange={e=>setColor(e.target.value)}/></label><label>Prioridade visual (0–100) <input type="number" min={0} max={100} value={position} disabled={!isOwner||busy} onChange={e=>setPosition(Math.max(0,Math.min(100,Number(e.target.value)||0)))}/></label><strong>Permissões</strong>
     {PERMS.map(p=><label className="hb-v303-permission" key={p.key}><input type="checkbox" disabled={!isOwner||busy} checked={permissions.includes(p.key)} onChange={e=>setPermissions(before=>e.target.checked?[...before,p.key]:before.filter(k=>k!==p.key))}/><span><b>{p.label}</b><small>{p.detail}</small></span></label>)}
     {isOwner?<div className="hb-v303-actions"><button type="submit" disabled={busy||name.trim().length<2}>{chosen?'Salvar cargo':'Criar cargo'}</button>{chosen&&<button className="is-danger" type="button" disabled={busy} onClick={remove}>Excluir cargo</button>}</div>:<p className="hb-v303-muted">Somente o dono administra cargos personalizados.</p>}
    </form>
    {chosen&&<section className="hb-v303-assignment"><h3>Membros com este cargo</h3>{members.filter(m=>m.role!=='owner').map(member=>{const checked=assignments.some(a=>a.role_id===chosen.id&&a.user_id===member.user_id);return <label key={member.user_id} className="hb-v303-permission"><input type="checkbox" disabled={!isOwner||busy} checked={checked} onChange={e=>assign(member.user_id,chosen.id,e.target.checked)}/><span><b>{nameFor(member.user_id)}{member.user_id===userId?' (você)':''}</b><small>Cargo básico: {member.role}</small></span></label>})}{!members.some(m=>m.role!=='owner')&&<p>Nenhum membro disponível para atribuição.</p>}</section>}
    </div>
   </div>}
  </section>
 </div>
}
