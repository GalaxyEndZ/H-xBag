import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './SiteAdministrationV234.css'

type Role = 'admin' | 'moderator' | 'user' | 'visitor'
type Pane = 'reports' | 'users' | 'staff' | 'history'
type Report = {id:string;reporter_id:string;target_id:string;target_type:string;reason:string;details:string;status:'pending'|'reviewed'|'dismissed';created_at:string;reviewer_id?:string|null}
type StaffUser = {user_id:string;username:string;display_name:string;is_admin:boolean;is_moderator:boolean;suspended_until:string|null;reason:string;warning_count:number}
type Audit = {id:string;actor_id:string|null;action:string;target_id:string|null;report_id:string|null;reason:string;created_at:string;context:Record<string,unknown>}
type Preview = {found:boolean;type:string;summary?:string;author_id?:string;display_name?:string}
const safeError = (err:unknown):string => err instanceof Error ? err.message : String(err)
const shortId = (id:string|null|undefined) => id ? id.slice(0,8) : '—'
const formatDate = (date:string) => new Date(date).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})
const targetLabels:Record<string,string> = {post:'Publicação',comment:'Comentário',group:'Comunidade',user:'Usuário',legacy_post:'Publicação antiga'}
const actionLabels:Record<string,string> = {warn:'Advertência',suspend:'Suspensão',unsuspend:'Suspensão encerrada',remove_post:'Publicação removida',remove_comment:'Comentário removido',remove_group:'Grupo removido',review_report:'Denúncia analisada',dismiss_report:'Denúncia dispensada',grant_moderator:'Moderador nomeado',revoke_moderator:'Permissão revogada'}
const current = (until:string|null|undefined) => !!until && new Date(until).getTime()>Date.now()
const toId = (input:string) => input.trim()
const isUuid=(v:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)

export default function SiteAdministrationV234({userId,onViewProfile}:{userId:string;onViewProfile?:(userId:string)=>void}) {
 const [role,setRole]=useState<Role>('user')
 const [pane,setPane]=useState<Pane>('reports')
 const [loading,setLoading]=useState(true)
 const [working,setWorking]=useState(false)
 const [error,setError]=useState('')
 const [success,setSuccess]=useState('')
 const [reports,setReports]=useState<Report[]>([])
 const [audit,setAudit]=useState<Audit[]>([])
 const [search,setSearch]=useState('')
 const [users,setUsers]=useState<StaffUser[]>([])
 const [selectedUser,setSelectedUser]=useState<StaffUser|null>(null)
 const [reason,setReason]=useState('')
 const [days,setDays]=useState('3')
 const [statusFilter,setStatusFilter]=useState<'pending'|'all'|'reviewed'|'dismissed'>('pending')
 const [selectedReport,setSelectedReport]=useState<Report|null>(null)
 const [preview,setPreview]=useState<Preview|null>(null)
 const [previewBusy,setPreviewBusy]=useState(false)
 const [confirmation,setConfirmation]=useState<{label:string;action:()=>Promise<void>}|null>(null)

 const reload=useCallback(async()=>{
   if(!userId)return
   const rights=await supabase.rpc('hax_v234_role')
   if(rights.error)throw rights.error
   const nextRole=String(rights.data||'user') as Role
   setRole(nextRole)
   if(nextRole!=='admin'){
     setReports([]);setAudit([]);setSelectedReport(null);setSelectedUser(null)
     return
   }
   const [reps,logs]=await Promise.all([
     supabase.from('hax_v231_reports').select('id,reporter_id,target_id,target_type,reason,details,status,created_at,reviewer_id').order('created_at',{ascending:false}).limit(200),
     supabase.from('hax_v234_audit').select('id,actor_id,action,target_id,report_id,reason,created_at,context').order('created_at',{ascending:false}).limit(150),
   ])
   if(reps.error)throw reps.error
   if(logs.error)throw logs.error
   setReports((reps.data||[]) as Report[])
   setAudit((logs.data||[]) as Audit[])
 },[userId])
 useEffect(()=>{
   let live=true
   setLoading(true)
   void reload().catch(e=>{if(live)setError(`Não foi possível carregar a central. Confira se HAXBAG_ADMIN_V234.sql foi executado. ${safeError(e)}`)}).finally(()=>{if(live)setLoading(false)})
   return()=>{live=false}
 },[reload])

 const transact=async(operation:()=>Promise<void>,message:string)=>{
   if(working)return
   setWorking(true);setError('');setSuccess('')
   try{await operation();await reload();setSuccess(message)}catch(e){setError(safeError(e))}finally{setWorking(false);setConfirmation(null)}
 }
 const requestConfirm=(label:string,action:()=>Promise<void>)=>setConfirmation({label,action})
 const searchUsers=async(e?:FormEvent)=>{
   e?.preventDefault()
   if(search.trim().length<2){setError('Informe pelo menos 2 caracteres ou um UUID completo.');return}
   setError('');setWorking(true)
   try{const {data,error:err}=await supabase.rpc('hax_v234_find_users',{p_search:search.trim(),p_limit:30});if(err)throw err;setUsers((data||[]) as StaffUser[])}
   catch(e){setError(safeError(e))}finally{setWorking(false)}
 }
 const locate=async(uuid:string)=>{
   if(!isUuid(uuid)){setError('Identificador inválido.');return}
   setPane('users');setSearch(uuid);setSelectedUser(null);setUsers([]);setWorking(true);setError('')
   try{const {data,error:err}=await supabase.rpc('hax_v234_find_users',{p_search:uuid,p_limit:5});if(err)throw err;const result=(data||[]) as StaffUser[];setUsers(result);setSelectedUser(result.find(item=>item.user_id===uuid)||null)}
   catch(e){setError(safeError(e))}finally{setWorking(false)}
 }
 const moderate=async(action:string,target:string,p_report_id?:string|null)=>{
   const {error:err}=await supabase.rpc('hax_v234_moderate',{
     p_action:action,p_target:target,p_reason:reason.trim(),p_days:action==='suspend'?Number(days):null,p_report_id:p_report_id||null,
   });if(err)throw err
   setReason('')
   setSelectedReport(null);setPreview(null)
   if(selectedUser){
     const {data}=await supabase.rpc('hax_v234_find_users',{p_search:selectedUser.user_id,p_limit:2})
     setSelectedUser(((data||[]) as StaffUser[]).find(u=>u.user_id===selectedUser.user_id)||null)
   }
 }
 const handleUserAction=(action:'warn'|'suspend'|'unsuspend')=>{
   if(!selectedUser)return
   if(action!=='unsuspend'&&reason.trim().length<8){setError('Explique o motivo em pelo menos 8 caracteres.');return}
   if(action==='suspend'&&(!Number.isInteger(Number(days))||Number(days)<1||Number(days)>365)){setError('Selecione uma duração entre 1 e 365 dias.');return}
   requestConfirm(`${action==='warn'?'Enviar advertência':action==='suspend'?'Suspender acesso ao Social':'Encerrar suspensão'} de ${selectedUser.display_name}?`,async()=>{
     await transact(()=>moderate(action,selectedUser.user_id),actionLabels[action]+' registrada no histórico.')
   })
 }
 const openPreview=async(item:Report)=>{
   setSelectedReport(item);setPreview(null);setPreviewBusy(true);setError('')
   try{
     const {data,error:err}=await supabase.rpc('hax_v234_report_preview',{p_report_id:item.id});if(err)throw err
     setPreview(data as Preview)
   }catch(e){setError(safeError(e))}finally{setPreviewBusy(false)}
 }
 const reportAction=(action:'review_report'|'dismiss_report'|'remove_post'|'remove_comment'|'remove_group')=>{
   if(!selectedReport)return
   const isRemoval=action.startsWith('remove_')
   if(isRemoval&&reason.trim().length<8){setError('Informe a justificativa da remoção (mínimo de 8 caracteres).');return}
   const target= isRemoval ? selectedReport.target_id:selectedReport.id
   requestConfirm(`${isRemoval?'Remover definitivamente o conteúdo':'Encerrar a denúncia'}? Esta decisão será registrada no histórico.`,async()=>{
     await transact(()=>moderate(action,target,isRemoval?selectedReport.id:null),isRemoval?'Conteúdo removido e denúncia analisada.':'Denúncia atualizada.')
   })
 }
 const setModerator=(person:StaffUser,enabled:boolean)=>{
   requestConfirm(`${enabled?'Nomear':'Destituir'} ${person.display_name} ${enabled?'como moderador':'da moderação'}?`,async()=>{
     await transact(async()=>{const {error:err}=await supabase.rpc('hax_v234_set_moderator',{p_user:person.user_id,p_enabled:enabled});if(err)throw err;setUsers(old=>old.map(u=>u.user_id===person.user_id?{...u,is_moderator:enabled}:u));setSelectedUser(old=>old?.user_id===person.user_id?{...old,is_moderator:enabled}:old)},'Permissão de moderação atualizada.')
   })
 }
 const filtered=reports.filter(r=>statusFilter==='all'||r.status===statusFilter)
 const pending=reports.filter(r=>r.status==='pending').length
 if(loading)return <section className="hb-admin-v234 hb-admin-status" role="status">Carregando central administrativa…</section>
 if(error&&role!=='admin')return <section className="hb-admin-v234 hb-admin-status"><h3>Administração indisponível</h3><p role="alert">{error}</p></section>
 if(role!=='admin')return <section className="hb-admin-v234 hb-admin-status"><h3>Acesso restrito</h3><p>Este painel é exclusivo das contas administradoras globais do site.</p></section>
 return <section className="hb-admin-v234" aria-label="Painel administrativo exclusivo do HäxBag">
   <header className="hb-admin-hero"><div><span className="hb-admin-eyebrow">HÄXBAG · CENTRAL DE CONFIANÇA</span><h3>Painel Administrativo</h3><p>Gerencie denúncias, medidas e equipe com decisões justificadas e registradas.</p></div><span className="hb-admin-role">✦ Administrador</span></header>
   <div className="hb-admin-metrics">
     <div><span>Denúncias pendentes</span><strong>{pending}</strong><small>Das últimas {reports.length} carregadas</small></div>
     <div><span>Ações registradas</span><strong>{audit.length}</strong><small>Histórico recente</small></div>
     <div><span>Seu nível de acesso</span><strong className="hb-admin-role-big">Total</strong><small>Pode nomear moderadores</small></div>
   </div>
   <nav className="hb-admin-nav" aria-label="Seções administrativas">
     {([['reports','⚑ Denúncias'],['users','♙ Usuários'],['staff','♜ Equipe'],['history','◷ Histórico']] as const).map(([key,label])=><button key={key} type="button" aria-current={pane===key?'page':undefined} className={pane===key?'is-active':''} onClick={()=>{setPane(key);setError('');setSuccess('')}}>{label}</button>)}
     <button className="hb-admin-refresh" type="button" disabled={working} onClick={()=>void transact(async()=>{},'Dados atualizados.')}>↻ Atualizar</button>
   </nav>
   {error&&<p className="hb-admin-alert" role="alert">{error}<button type="button" onClick={()=>setError('')} aria-label="Fechar erro">×</button></p>}
   {success&&<p className="hb-admin-success" role="status">{success}</p>}
   {pane==='reports'&&<section className="hb-admin-section">
     <div className="hb-admin-section-title"><div><h4>Fila de denúncias</h4><p>Analise o relato antes de tomar uma decisão. Remoções são permanentes.</p></div><label>Exibir<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}><option value="pending">Pendentes</option><option value="all">Todas</option><option value="reviewed">Analisadas</option><option value="dismissed">Dispensadas</option></select></label></div>
     <div className="hb-admin-report-grid">
       <div className="hb-admin-report-list">{filtered.map(item=><button type="button" className={`hb-admin-report-card ${selectedReport?.id===item.id?'selected':''}`} key={item.id} onClick={()=>void openPreview(item)}><span className="hb-admin-report-meta">{targetLabels[item.target_type]||item.target_type} · {formatDate(item.created_at)}</span><strong>{item.reason}</strong><small>{item.details||'Sem detalhes adicionais.'}</small><span className={`hb-admin-state ${item.status}`}>{item.status==='pending'?'Pendente':item.status==='reviewed'?'Analisada':'Dispensada'}</span></button>)}{!filtered.length&&<div className="hb-admin-empty">Nenhuma denúncia para este filtro.</div>}</div>
       <div className="hb-admin-inspection">{selectedReport?<><div className="hb-admin-inspection-title"><strong>Inspecionar denúncia</strong><button onClick={()=>{setSelectedReport(null);setPreview(null);setReason('')}} type="button" aria-label="Fechar inspeção">✕</button></div>
       <div className="hb-admin-data"><span>Alvo</span><code>{selectedReport.target_id}</code><span>Denunciante</span><code>{selectedReport.reporter_id}</code><span>Motivo</span><p>{selectedReport.reason}</p><span>Informações adicionais</span><p>{selectedReport.details||'Nenhuma.'}</p></div>
       {previewBusy?<p>Carregando conteúdo…</p>:preview&&<div className="hb-admin-preview"><strong>Prévia do conteúdo denunciado</strong><p>{preview.found?preview.summary:'Conteúdo indisponível ou já removido.'}</p>{preview.author_id&&<button type="button" onClick={()=>void locate(preview.author_id!)}>Gerenciar autor ({shortId(preview.author_id)})</button>}</div>}
       {selectedReport.target_type==='user'&&<button className="hb-admin-secondary" type="button" onClick={()=>void locate(selectedReport.target_id)}>Gerenciar usuário denunciado</button>}
       {selectedReport.status==='pending'&&<><label className="hb-admin-label">Justificativa da decisão<textarea value={reason} maxLength={1000} rows={3} placeholder="Explique a remoção ou registre observações da análise…" onChange={e=>setReason(e.target.value)}/></label><div className="hb-admin-actions"><button disabled={working} onClick={()=>reportAction('review_report')}>✓ Marcar analisada</button><button disabled={working} onClick={()=>reportAction('dismiss_report')}>Dispensar</button>{(['post','comment','group'] as string[]).includes(selectedReport.target_type)&&<button disabled={working} className="danger" onClick={()=>reportAction(selectedReport.target_type==='post'?'remove_post':selectedReport.target_type==='comment'?'remove_comment':'remove_group')}>Remover {targetLabels[selectedReport.target_type]?.toLowerCase()}</button>}</div></>}
       {selectedReport.target_type==='legacy_post'&&<p className="hb-admin-footnote">Publicações do feed clássico podem ser analisadas, mas a remoção direta exige integração com a função antiga do banco.</p>}
       </>:<div className="hb-admin-empty">Selecione uma denúncia para inspecionar detalhes e decidir.</div>}</div>
     </div>
   </section>}
   {(pane==='users'||pane==='staff')&&<section className="hb-admin-section"><div className="hb-admin-section-title"><div><h4>{pane==='staff'?'Gestão de moderadores':'Gerenciamento de usuários'}</h4><p>Pesquise pelo @usuário, nome ou UUID. Dados de login e e-mail não são expostos.</p></div></div>
      <form className="hb-admin-search" onSubmit={e=>void searchUsers(e)}><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, @usuário ou UUID" minLength={2} aria-label="Pesquisar usuários"/><button type="submit" disabled={working}>⌕ Pesquisar</button></form>
      <div className="hb-admin-users-layout"><div className="hb-admin-users-list">{users.map(person=><button key={person.user_id} type="button" className={selectedUser?.user_id===person.user_id?'selected':''} onClick={()=>{setSelectedUser(person);setReason('')}}><span className="hb-admin-person-avatar">{person.display_name.charAt(0).toUpperCase()}</span><span><strong>{person.display_name}</strong><small>@{person.username||shortId(person.user_id)} {person.is_admin?'· Admin':person.is_moderator?'· Moderador':''}</small></span>{current(person.suspended_until)&&<span className="hb-admin-mini-warning">Suspenso</span>}</button>)}{!users.length&&<div className="hb-admin-empty">Pesquise para encontrar contas. Os resultados não são listados automaticamente.</div>}</div>
      <div className="hb-admin-inspection">{selectedUser?<><strong className="hb-admin-person-title">{selectedUser.display_name}</strong><p>@{selectedUser.username||'aventureiro'} · {shortId(selectedUser.user_id)}</p><div className="hb-admin-data"><span>Permissão</span><p>{selectedUser.is_admin?'Administrador do site':selectedUser.is_moderator?'Moderador do site':'Jogador'}</p><span>Advertências</span><p>{selectedUser.warning_count}</p><span>Situação no Social</span><p>{current(selectedUser.suspended_until)?`Suspenso até ${formatDate(selectedUser.suspended_until!)}`:'Acesso sem suspensão ativa'}</p>{selectedUser.reason&&<><span>Última justificativa</span><p>{selectedUser.reason}</p></>}</div>
      {onViewProfile&&<button className="hb-admin-secondary" type="button" onClick={()=>onViewProfile(selectedUser.user_id)}>Ver perfil público</button>}
      {pane==='users'&&<><label className="hb-admin-label">Motivo da medida<textarea rows={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Justifique a advertência ou suspensão…"/></label><label className="hb-admin-label">Duração da suspensão<select value={days} onChange={e=>setDays(e.target.value)}>{[1,3,7,14,30,90,365].map(d=><option key={d} value={d}>{d} {d===1?'dia':'dias'}</option>)}</select></label><div className="hb-admin-actions"><button type="button" disabled={working||selectedUser.is_admin||selectedUser.user_id===userId} onClick={()=>handleUserAction('warn')}>⚑ Advertir</button><button type="button" className="danger" disabled={working||selectedUser.is_admin||selectedUser.user_id===userId} onClick={()=>handleUserAction('suspend')}>⊘ Suspender Social</button>{current(selectedUser.suspended_until)&&<button type="button" disabled={working||selectedUser.is_admin} onClick={()=>handleUserAction('unsuspend')}>Liberar acesso</button>}</div></>}
      {pane==='staff'&&<div className="hb-admin-actions">{!selectedUser.is_admin&&selectedUser.user_id!==userId&&<button type="button" disabled={working} onClick={()=>setModerator(selectedUser,!selectedUser.is_moderator)}>{selectedUser.is_moderator?'Remover moderação':'♜ Nomear moderador'}</button>}</div>}
      </>:<div className="hb-admin-empty">Selecione uma conta para visualizar informações e ações disponíveis.</div>}</div></div>
   </section>}
   {pane==='history'&&<section className="hb-admin-section"><div className="hb-admin-section-title"><div><h4>Histórico de moderação</h4><p>Decisões realizadas pelo painel com responsável, justificativa e data. Não podem ser editadas pelo navegador.</p></div></div><div className="hb-admin-history">{audit.map(entry=><article key={entry.id}><span className="hb-admin-action-icon">✦</span><div><strong>{actionLabels[entry.action]||entry.action}</strong><p>{entry.reason||'Sem observação adicional.'}</p><small>Responsável: {shortId(entry.actor_id)} · Alvo: {shortId(entry.target_id)}{entry.report_id?` · Denúncia: ${shortId(entry.report_id)}`:''}</small></div><time>{formatDate(entry.created_at)}</time></article>)}{!audit.length&&<div className="hb-admin-empty">Nenhuma ação registrada.</div>}</div></section>}
   <p className="hb-admin-footnote">A suspensão bloqueia gravações no módulo Social V231 e seu acesso pela interface. Ela não revoga uma sessão Supabase nem substitui a moderação das funções do feed e chat clássicos. Administradores são definidos pelo SQL Editor.</p>
   {confirmation&&<div className="hb-admin-dialog-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setConfirmation(null)}}><div role="alertdialog" aria-modal="true" aria-label="Confirmar ação administrativa" className="hb-admin-dialog"><strong>Confirmar ação</strong><p>{confirmation.label}</p><div className="hb-admin-actions"><button type="button" disabled={working} onClick={()=>setConfirmation(null)}>Cancelar</button><button type="button" className="danger" disabled={working} onClick={()=>void confirmation.action()}>{working?'Registrando…':'Confirmar e registrar'}</button></div></div></div>}
 </section>
}
