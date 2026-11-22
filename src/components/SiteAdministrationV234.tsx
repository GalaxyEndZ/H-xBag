import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../supabase'
import './SiteAdministrationV234.css'

type Role = 'admin' | 'moderator' | 'user' | 'visitor'
type Pane = 'overview' | 'reports' | 'users' | 'staff' | 'history'
type ReportStatus = 'pending' | 'reviewed' | 'dismissed'
type Report = {
  id: string; reporter_id: string; target_id: string; target_type: string;
  reason: string; details: string; status: ReportStatus; created_at: string; reviewer_id?: string | null
}
type StaffUser = {
  user_id: string; username: string; display_name: string; is_admin: boolean;
  is_moderator: boolean; suspended_until: string | null; reason: string; warning_count: number
}
type Audit = {
  id: string; actor_id: string | null; action: string; target_id: string | null;
  report_id: string | null; reason: string; created_at: string; context: Record<string, unknown>
}
type Preview = { found: boolean; type: string; summary?: string; author_id?: string; display_name?: string }
type Identity = {
  kind: 'audit' | 'report'; record_id: string; actor_username: string | null;
  target_username: string | null; reporter_username: string | null; target_user_id: string | null
}
type IdentityMap = Record<string, Identity>
type Confirmation = { title: string; description: string; danger: boolean; run: () => Promise<void>; success: string }

const targetLabels: Record<string, string> = {
  post: 'Publicação', comment: 'Comentário', group: 'Comunidade', user: 'Usuário', legacy_post: 'Publicação clássica',
}
const actionLabels: Record<string, string> = {
  warn: 'Advertência', suspend: 'Suspensão aplicada', unsuspend: 'Suspensão encerrada',
  remove_post: 'Publicação removida', remove_comment: 'Comentário removido', remove_group: 'Comunidade removida',
  review_report: 'Denúncia analisada', dismiss_report: 'Denúncia dispensada',
  grant_moderator: 'Moderador nomeado', revoke_moderator: 'Permissão revogada',
}
const statusLabels: Record<ReportStatus, string> = { pending: 'Pendente', reviewed: 'Analisada', dismissed: 'Dispensada' }
const shortId = (id: string | null | undefined) => id ? id.slice(0, 8) : '—'
const handle = (username: string | null | undefined, fallback = 'Conta indisponível') => username?.trim() ? `@${username.trim().replace(/^@+/, '')}` : fallback
const safeError = (err: unknown): string => err instanceof Error ? err.message : String(err)
const formatDate = (date: string) => {
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}
const isCurrent = (until: string | null | undefined) => !!until && new Date(until).getTime() > Date.now()
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
const fold = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
const textIncludes = (search: string, ...values: (string | null | undefined)[]) => !search || values.some(value => fold(value || '').includes(fold(search)))
const exportCell = (value: unknown): string => {
  const raw = String(value ?? '')
  // Neutralize spreadsheet formulas when exporting untrusted reports/reasons.
  const safe = /^[\s]*[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/g, '""')}"`
}
function downloadAudit(items: Audit[], identities: IdentityMap) {
  const cols = ['Data', 'Ação', 'Responsável', 'Alvo', 'Denúncia', 'Justificativa', 'ID do responsável', 'ID do conteúdo ou conta']
  const rows = items.map(item => [item.created_at, actionLabels[item.action] || item.action,
    handle(identities[item.id]?.actor_username), handle(identities[item.id]?.target_username, 'Autor não identificado'),
    item.report_id, item.reason, item.actor_id, item.target_id])
  const csv = '\uFEFF' + [cols, ...rows].map(row => row.map(exportCell).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'haxbag-historico-moderacao.csv'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export default function SiteAdministrationV234({ userId, onViewProfile }: {
  userId: string; onViewProfile?: (userId: string) => void
}) {
  const [role, setRole] = useState<Role>('visitor')
  const [pane, setPane] = useState<Pane>('overview')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [reports, setReports] = useState<Report[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [identities, setIdentities] = useState<IdentityMap>({})
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null)
  const [statusFilter, setStatusFilter] = useState<ReportStatus | 'all'>('pending')
  const [typeFilter, setTypeFilter] = useState('all')
  const [reportSearch, setReportSearch] = useState('')
  const [reportOrder, setReportOrder] = useState<'recent' | 'oldest'>('recent')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewBusy, setPreviewBusy] = useState(false)
  const previewSequence = useRef(0)
  const loadSequence = useRef(0)
  const [userSearch, setUserSearch] = useState('')
  const [users, setUsers] = useState<StaffUser[]>([])
  const [selectedUser, setSelectedUser] = useState<StaffUser | null>(null)
  const [userFilter, setUserFilter] = useState<'all' | 'admin' | 'moderator' | 'suspended'>('all')
  const [reason, setReason] = useState('')
  const [days, setDays] = useState('3')
  const [historySearch, setHistorySearch] = useState('')
  const [historyAction, setHistoryAction] = useState('all')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current
    if (!userId) { setRole('visitor'); return }
    const rights = await supabase.rpc('hax_v234_role')
    if (sequence !== loadSequence.current) return
    if (rights.error) { setRole('visitor'); throw rights.error }
    const nextRole = String(rights.data || 'user') as Role
    setRole(nextRole)
    if (nextRole !== 'admin') {
      setReports([]); setAudit([]); setIdentities({}); setUsers([]); setSelectedReport(null); setSelectedUser(null)
      return
    }
    const [reps, logs, people] = await Promise.all([
      supabase.from('hax_v231_reports')
        .select('id,reporter_id,target_id,target_type,reason,details,status,created_at,reviewer_id')
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('hax_v234_audit')
        .select('id,actor_id,action,target_id,report_id,reason,created_at,context')
        .order('created_at', { ascending: false }).limit(150),
      supabase.rpc('hax_v237_admin_people'),
    ])
    if (sequence !== loadSequence.current) return
    if (reps.error || logs.error || people.error) {
      // Do not keep showing privileged data if permissions or retrieval fail.
      setRole('visitor'); setReports([]); setAudit([]); setIdentities({})
      throw reps.error || logs.error || people.error
    }
    const nextReports = (reps.data || []) as Report[]
    setReports(nextReports)
    setAudit((logs.data || []) as Audit[])
    const nextIdentities: IdentityMap = {}
    for (const person of (people.data || []) as Identity[]) {
      if (person.kind === 'audit' || person.kind === 'report') nextIdentities[person.record_id] = person
    }
    setIdentities(nextIdentities)
    setLastLoaded(new Date())
    setSelectedReport(old => old ? nextReports.find(report => report.id === old.id) || null : null)
  }, [userId])

  useEffect(() => {
    let live = true
    previewSequence.current += 1
    setRole('visitor'); setLoading(true); setError(''); setSuccess('')
    void reload().catch(err => {
      if (live) setError(`Não foi possível carregar o painel. Verifique suas permissões de acesso. ${safeError(err)}`)
    }).finally(() => { if (live) setLoading(false) })
    return () => { live = false; previewSequence.current += 1; loadSequence.current += 1 }
  }, [reload])

  const perform = async (operation: () => Promise<void>, message: string) => {
    if (working) return
    setWorking(true); setError(''); setSuccess('')
    try { await operation(); await reload(); setSuccess(message) }
    catch (err) { setError(safeError(err)) }
    finally { setWorking(false); setConfirmation(null) }
  }
  const changePane = (next: Pane) => {
    setPane(next); setError(''); setSuccess(''); setReason(''); setConfirmation(null)
  }
  const inspect = async (item: Report) => {
    const sequence = ++previewSequence.current
    setSelectedReport(item); setPreview(null); setPreviewBusy(true); setReason(''); setError('')
    try {
      const result = await supabase.rpc('hax_v234_report_preview', { p_report_id: item.id })
      if (result.error) throw result.error
      if (sequence === previewSequence.current) setPreview(result.data as Preview)
    } catch (err) { if (sequence === previewSequence.current) setError(safeError(err)) }
    finally { if (sequence === previewSequence.current) setPreviewBusy(false) }
  }
  const locateUser = async (id: string) => {
    if (!isUuid(id)) { setError('Identificador de usuário inválido.'); return }
    changePane('users'); setUserSearch(id); setUsers([]); setSelectedUser(null); setWorking(true)
    try {
      const result = await supabase.rpc('hax_v234_find_users', { p_search: id, p_limit: 5 })
      if (result.error) throw result.error
      const found = (result.data || []) as StaffUser[]
      setUsers(found)
      setSelectedUser(found.find(person => person.user_id === id) || null)
    } catch (err) { setError(safeError(err)) }
    finally { setWorking(false) }
  }
  const searchUsers = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const term = userSearch.trim()
    if (term.length < 2) { setError('Digite pelo menos 2 caracteres ou um UUID completo.'); return }
    setError(''); setWorking(true); setSelectedUser(null)
    try {
      const result = await supabase.rpc('hax_v234_find_users', { p_search: term, p_limit: 50 })
      if (result.error) throw result.error
      setUsers((result.data || []) as StaffUser[])
    } catch (err) { setError(safeError(err)) }
    finally { setWorking(false) }
  }
  const refreshUser = async (id: string) => {
    const result = await supabase.rpc('hax_v234_find_users', { p_search: id, p_limit: 5 })
    if (result.error) throw result.error
    const updated = ((result.data || []) as StaffUser[]).find(person => person.user_id === id)
    setSelectedUser(updated || null)
    if (updated) setUsers(old => old.map(person => person.user_id === id ? updated : person))
  }
  const request = (next: Confirmation) => { setError(''); setConfirmation(next) }
  const moderationRpc = async (action: string, target: string, motive: string, duration?: number, reportId?: string) => {
    const result = await supabase.rpc('hax_v234_moderate', {
      p_action: action, p_target: target, p_reason: motive,
      p_days: duration ?? null, p_report_id: reportId || null,
    })
    if (result.error) throw result.error
  }
  const userAction = (action: 'warn' | 'suspend' | 'unsuspend') => {
    if (!selectedUser || working) return
    const person = selectedUser
    const motive = reason.trim()
    const duration = Number(days)
    if (action !== 'unsuspend' && motive.length < 8) { setError('Informe uma justificativa de pelo menos 8 caracteres.'); return }
    if (action === 'suspend' && (!Number.isInteger(duration) || duration < 1 || duration > 365)) {
      setError('Escolha uma suspensão entre 1 e 365 dias.'); return
    }
    if (person.is_admin || person.user_id === userId) { setError('Esta conta não pode receber essa medida.'); return }
    request({
      title: action === 'warn' ? 'Registrar advertência' : action === 'suspend' ? 'Confirmar suspensão' : 'Encerrar suspensão',
      description: `${person.display_name} (@${person.username || shortId(person.user_id)})${action === 'suspend' ? ` ficará temporariamente impedido de interagir em áreas da comunidade por ${duration} dia(s).` : '.'} ${motive ? `Motivo: ${motive}` : ''}`,
      danger: action === 'suspend', success: `${actionLabels[action]} registrada no histórico.`,
      run: async () => { await moderationRpc(action, person.user_id, motive, action === 'suspend' ? duration : undefined); await refreshUser(person.user_id); setReason('') },
    })
  }
  const reportAction = (action: 'review_report' | 'dismiss_report' | 'remove_post' | 'remove_comment' | 'remove_group') => {
    if (!selectedReport || selectedReport.status !== 'pending' || working) return
    const report = selectedReport
    const motive = reason.trim()
    const removal = action.startsWith('remove_')
    if (removal && motive.length < 8) { setError('Para remover conteúdo, explique o motivo em pelo menos 8 caracteres.'); return }
    request({
      title: removal ? 'Remover conteúdo permanentemente?' : action === 'dismiss_report' ? 'Dispensar denúncia?' : 'Marcar como analisada?',
      description: `${targetLabels[report.target_type] || report.target_type} · ${report.reason}. ${removal ? 'Esta remoção não pode ser desfeita pelo painel.' : 'O conteúdo não será removido.'}${motive ? ` Justificativa: ${motive}` : ''}`,
      danger: removal,
      success: removal ? 'Conteúdo removido e denúncia analisada.' : 'Denúncia atualizada.',
      run: async () => {
        await moderationRpc(action, removal ? report.target_id : report.id, motive, undefined, removal ? report.id : undefined)
        setReason(''); setPreview(null)
      },
    })
  }
  const moderatorAction = (person: StaffUser) => {
    if (person.is_admin || person.user_id === userId || working) return
    const enable = !person.is_moderator
    request({
      title: enable ? 'Nomear moderador?' : 'Revogar acesso de moderador?',
      description: `${person.display_name} (@${person.username || shortId(person.user_id)}). Moderadores não têm acesso ao Painel Administrativo e não se tornam administradores globais.`,
      danger: !enable, success: 'Permissão de moderação atualizada.',
      run: async () => {
        const result = await supabase.rpc('hax_v234_set_moderator', { p_user: person.user_id, p_enabled: enable })
        if (result.error) throw result.error
        await refreshUser(person.user_id)
      },
    })
  }

  const pending = useMemo(() => reports.filter(report => report.status === 'pending'), [reports])
  const reviewedCount = reports.filter(report => report.status === 'reviewed').length
  const dismissedCount = reports.filter(report => report.status === 'dismissed').length
  const filteredReports = useMemo(() => reports.filter(report =>
    (statusFilter === 'all' || report.status === statusFilter) &&
    (typeFilter === 'all' || report.target_type === typeFilter) &&
    textIncludes(reportSearch.trim(), report.reason, report.details, report.target_id, report.reporter_id, identities[report.id]?.target_username, identities[report.id]?.reporter_username, handle(identities[report.id]?.target_username, ''), handle(identities[report.id]?.reporter_username, ''))
  ).sort((a, b) => reportOrder === 'recent'
    ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  [reports, statusFilter, typeFilter, reportSearch, reportOrder, identities])
  const filteredUsers = users.filter(person => userFilter === 'all' ||
    (userFilter === 'admin' && person.is_admin) ||
    (userFilter === 'moderator' && person.is_moderator) ||
    (userFilter === 'suspended' && isCurrent(person.suspended_until)))
  const filteredAudit = useMemo(() => audit.filter(entry =>
    (historyAction === 'all' || entry.action === historyAction) &&
    textIncludes(historySearch.trim(), entry.action, actionLabels[entry.action], entry.reason, entry.actor_id, entry.target_id, entry.report_id, identities[entry.id]?.actor_username, identities[entry.id]?.target_username, handle(identities[entry.id]?.actor_username, ''), handle(identities[entry.id]?.target_username, ''))
  ), [audit, historySearch, historyAction, identities])
  const inspection = selectedReport && reports.some(item => item.id === selectedReport.id) ? selectedReport : null

  if (loading) return <section className="hb-admin-v234 hb-admin-status" role="status">Validando acesso administrativo e carregando dados…</section>
  if (role !== 'admin') return <section className="hb-admin-v234 hb-admin-status"><h3>Acesso restrito</h3><p>Este painel é exclusivo de administradores globais do HäxBag.</p>{error && <p role="alert">{error}</p>}</section>
  // Open the existing public profile viewer only for a resolved, real account.
  // Historic records can reference removed content or accounts without a username.
  const personLink = (username: string | null | undefined, profileId: string | null | undefined, fallback = 'Conta indisponível') => {
    const text = handle(username, fallback)
    if (!onViewProfile || !username?.trim() || !isUuid(profileId || '')) {
      return <span className="hb-admin-person-handle">{text}</span>
    }
    return <button
      type="button"
      className="hb-admin-person-handle hb-admin-person-link"
      title={`Abrir perfil de ${text}`}
      aria-label={`Abrir perfil de ${text}`}
      onClick={() => onViewProfile(profileId!)}
    >{text}<span className="hb-admin-person-link-arrow" aria-hidden="true">↗</span></button>
  }
  const goToReport = (item: Report) => { changePane('reports'); setStatusFilter('all'); setTypeFilter('all'); setReportSearch(''); void inspect(item) }

  return <section className="hb-admin-v234 hb-admin-v236" aria-label="Painel Administrativo exclusivo do HäxBag">
    <header className="hb-admin-hero">
      <div className="hb-admin-hero-copy"><span className="hb-admin-eyebrow">HÄXBAG / CONTROLE E SEGURANÇA</span><h3>Painel Administrativo</h3><p>Um espaço reservado para analisar denúncias, proteger a comunidade e registrar decisões de moderação.</p><div className="hb-admin-hero-tags"><span>● Acesso validado pelo servidor</span><span>◈ Histórico auditável</span></div></div>
      <div className="hb-admin-hero-side"><span className="hb-admin-role">✦ Administração global</span><small>{lastLoaded ? `Atualizado ${lastLoaded.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Sem atualização'}</small><button type="button" disabled={working} onClick={() => void perform(async () => {}, 'Dados atualizados.')}>↻ Atualizar dados</button></div>
    </header>

    <div className="hb-admin-metrics" aria-label="Resumo da amostra carregada">
      <button type="button" onClick={() => { setStatusFilter('pending'); changePane('reports') }}><span>Denúncias pendentes</span><strong>{pending.length}</strong><small>Exigem análise <span aria-hidden="true">↗</span></small></button>
      <button type="button" onClick={() => { setStatusFilter('reviewed'); changePane('reports') }}><span>Denúncias analisadas</span><strong>{reviewedCount}</strong><small>Na amostra carregada <span aria-hidden="true">↗</span></small></button>
      <button type="button" onClick={() => { setStatusFilter('dismissed'); changePane('reports') }}><span>Denúncias dispensadas</span><strong>{dismissedCount}</strong><small>Na amostra carregada <span aria-hidden="true">↗</span></small></button>
      <button type="button" onClick={() => changePane('history')}><span>Decisões registradas</span><strong>{audit.length}</strong><small>Eventos recentes <span aria-hidden="true">↗</span></small></button>
    </div>
    <p className="hb-admin-sample-note">Resumo dos últimos {reports.length} registros de denúncias (limite de 200) e {audit.length} eventos de auditoria (limite de 150). Estes números não representam necessariamente os totais históricos do site.</p>

    <nav className="hb-admin-nav" aria-label="Seções administrativas">
      {([['overview', '◈ Visão geral'], ['reports', '⚑ Denúncias'], ['users', '♙ Usuários'], ['staff', '♜ Equipe'], ['history', '◷ Histórico']] as const).map(([key, label]) => <button key={key} type="button" aria-current={pane === key ? 'page' : undefined} className={pane === key ? 'is-active' : ''} onClick={() => changePane(key)}>{label}{key === 'reports' && pending.length > 0 && <span className="hb-admin-nav-count">{pending.length}</span>}</button>)}
    </nav>
    {error && <div className="hb-admin-alert" role="alert"><span>{error}</span><button type="button" onClick={() => setError('')} aria-label="Fechar aviso de erro">×</button></div>}
    {success && <div className="hb-admin-success" role="status"><span>✓ {success}</span><button type="button" onClick={() => setSuccess('')} aria-label="Dispensar aviso">×</button></div>}

    {pane === 'overview' && <div className="hb-admin-overview-grid">
      <section className="hb-admin-section hb-admin-overview-queue">
        <div className="hb-admin-section-title"><div><span className="hb-admin-section-eyebrow">EM FOCO</span><h4>Próximas denúncias</h4><p>Comece pelas pendências mais antigas para reduzir o tempo de espera.</p></div><button type="button" onClick={() => { setStatusFilter('pending'); setReportOrder('oldest'); changePane('reports') }}>Ver fila completa</button></div>
        <div className="hb-admin-mini-list">{[...pending].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, 5).map(item => <button key={item.id} type="button" onClick={() => goToReport(item)}><span className="hb-admin-mini-icon">⚑</span><span><strong>{item.reason}</strong><small>{targetLabels[item.target_type] || item.target_type} · {formatDate(item.created_at)}</small></span><span className="hb-admin-mini-arrow">›</span></button>)}{pending.length === 0 && <div className="hb-admin-empty">Nenhuma denúncia pendente entre os registros carregados.</div>}</div>
      </section>
      <section className="hb-admin-section hb-admin-overview-history">
        <div className="hb-admin-section-title"><div><span className="hb-admin-section-eyebrow">TRANSPARÊNCIA</span><h4>Últimas decisões</h4><p>Rastreabilidade das ações realizadas pela administração.</p></div><button type="button" onClick={() => changePane('history')}>Ver histórico</button></div>
        <div className="hb-admin-mini-list">{audit.slice(0, 5).map(entry => <div className="hb-admin-mini-entry" key={entry.id}><span className="hb-admin-mini-icon">◷</span><span><strong>{actionLabels[entry.action] || entry.action}</strong><small>{formatDate(entry.created_at)} · Responsável: {personLink(identities[entry.id]?.actor_username, entry.actor_id)} · Alvo: {personLink(identities[entry.id]?.target_username, identities[entry.id]?.target_user_id, 'Autor não identificado')}</small></span></div>)}{audit.length === 0 && <div className="hb-admin-empty">Nenhuma decisão registrada nesta amostra.</div>}</div>
      </section>
      <aside className="hb-admin-overview-advice"><strong>Escopo de proteção</strong><p>As suspensões limitam a participação em determinadas áreas da comunidade, mas não desconectam automaticamente a conta nem impedem todas as interações por mensagens. Considere esse alcance antes de aplicar uma medida.</p><span>O acesso à administração é reservado às contas autorizadas.</span></aside>
    </div>}

    {pane === 'reports' && <section className="hb-admin-section">
      <div className="hb-admin-section-title"><div><span className="hb-admin-section-eyebrow">CENTRAL DE ANÁLISE</span><h4>Denúncias da comunidade</h4><p>Veja o contexto antes de decidir. Exclusões de conteúdo são permanentes.</p></div><span className="hb-admin-results-count">{filteredReports.length} de {reports.length} carregadas</span></div>
      <div className="hb-admin-filters hb-admin-filters-reports">
        <label className="hb-admin-filter-search">Pesquisar denúncias<input type="search" value={reportSearch} onChange={e => setReportSearch(e.target.value)} placeholder="Motivo, @usuário ou referência" /></label>
        <label>Situação<select value={statusFilter} onChange={e => setStatusFilter(e.target.value as ReportStatus | 'all')}><option value="pending">Pendentes</option><option value="all">Todas</option><option value="reviewed">Analisadas</option><option value="dismissed">Dispensadas</option></select></label>
        <label>Conteúdo<select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="all">Todos os tipos</option>{Object.entries(targetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Ordem<select value={reportOrder} onChange={e => setReportOrder(e.target.value as 'recent' | 'oldest')}><option value="recent">Mais recentes</option><option value="oldest">Mais antigas</option></select></label>
      </div>
      <div className="hb-admin-report-grid">
        <div className="hb-admin-report-list" aria-label="Lista de denúncias">{filteredReports.map(item => <button type="button" className={`hb-admin-report-card ${inspection?.id === item.id ? 'selected' : ''}`} aria-pressed={inspection?.id === item.id} key={item.id} onClick={() => void inspect(item)}><span className="hb-admin-report-meta">{targetLabels[item.target_type] || item.target_type} · {formatDate(item.created_at)}</span><strong>{item.reason}</strong><small>{item.details || 'Sem detalhes adicionais.'}</small><span className={`hb-admin-state ${item.status}`}>{statusLabels[item.status] || item.status}</span></button>)}{!filteredReports.length && <div className="hb-admin-empty">Nenhuma denúncia corresponde aos filtros atuais.</div>}</div>
        <div className="hb-admin-inspection">{inspection ? <>
          <div className="hb-admin-inspection-title"><div><span className="hb-admin-section-eyebrow">DETALHES</span><strong>Denúncia selecionada</strong></div><button type="button" onClick={() => { previewSequence.current++; setSelectedReport(null); setPreview(null); setReason('') }} aria-label="Fechar denúncia">✕</button></div>
          <div className="hb-admin-data"><span>Estado</span><p><span className={`hb-admin-state ${inspection.status}`}>{statusLabels[inspection.status]}</span></p><span>Conteúdo denunciado</span><p>{targetLabels[inspection.target_type] || inspection.target_type}</p><span>Motivo</span><p>{inspection.reason}</p><span>Relato do denunciante</span><p>{inspection.details || 'Não foram enviados detalhes adicionais.'}</p><span>Alvo</span><p>{personLink(identities[inspection.id]?.target_username, identities[inspection.id]?.target_user_id, 'Autor não identificado')}</p><span>Denunciante</span><p>{personLink(identities[inspection.id]?.reporter_username, inspection.reporter_id)}</p><span>Referência do conteúdo</span><code>{inspection.target_id}</code><span>Recebida em</span><p>{formatDate(inspection.created_at)}</p></div>
          {previewBusy ? <p role="status">Buscando prévia do conteúdo…</p> : preview && <div className="hb-admin-preview"><strong>Prévia do conteúdo</strong><p>{preview.found ? preview.summary : 'O conteúdo não está disponível ou já foi removido.'}</p>{preview.author_id && <div className="hb-admin-preview-actions"><button type="button" disabled={working} onClick={() => void locateUser(preview.author_id!)}>Gerenciar autor</button>{personLink(identities[inspection.id]?.target_username, preview.author_id)}</div>}</div>}
          {inspection.target_type === 'user' && <button type="button" className="hb-admin-secondary" disabled={working} onClick={() => void locateUser(inspection.target_id)}>Gerenciar usuário denunciado</button>}
          {inspection.status === 'pending' && <><label className="hb-admin-label">Justificativa da decisão<textarea rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Registre o motivo da decisão (obrigatório para exclusões)." /><small>{reason.length}/1000 caracteres</small></label><div className="hb-admin-actions"><button type="button" disabled={working} onClick={() => reportAction('review_report')}>✓ Marcar analisada</button><button type="button" disabled={working} onClick={() => reportAction('dismiss_report')}>Dispensar</button>{(['post', 'comment', 'group'] as string[]).includes(inspection.target_type) && <button type="button" className="danger" disabled={working || previewBusy} onClick={() => reportAction(inspection.target_type === 'post' ? 'remove_post' : inspection.target_type === 'comment' ? 'remove_comment' : 'remove_group')}>Remover conteúdo</button>}</div></>}
          {inspection.target_type === 'legacy_post' && <p className="hb-admin-footnote">O feed clássico permite análise, mas não remoção por esta central. Use o processo específico do sistema antigo.</p>}
          {inspection.status !== 'pending' && <p className="hb-admin-footnote">Esta denúncia já foi encerrada. A decisão permanece no histórico administrativo.</p>}
        </> : <div className="hb-admin-empty">Selecione uma denúncia na lista para visualizar os detalhes e as ações possíveis.</div>}</div>
      </div>
    </section>}

    {(pane === 'users' || pane === 'staff') && <section className="hb-admin-section">
      <div className="hb-admin-section-title"><div><span className="hb-admin-section-eyebrow">{pane === 'staff' ? 'PERMISSÕES' : 'SEGURANÇA DE CONTAS'}</span><h4>{pane === 'staff' ? 'Equipe de moderação' : 'Gerenciamento de usuários'}</h4><p>{pane === 'staff' ? 'Pesquise contas para nomear ou revogar moderadores. A atribuição de administrador global não está disponível neste painel.' : 'Consulte advertências e gerencie restrições de participação na comunidade.'}</p></div></div>
      <form className="hb-admin-search" onSubmit={e => void searchUsers(e)}><label className="hb-admin-filter-search">Localizar conta<input type="search" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Nome, @usuário ou UUID" minLength={2} /></label><button type="submit" disabled={working}>{working ? 'Pesquisando…' : '⌕ Pesquisar'}</button></form>
      <div className="hb-admin-user-toolbar"><label>Filtrar resultados<select value={userFilter} onChange={e => setUserFilter(e.target.value as typeof userFilter)}><option value="all">Todos encontrados</option><option value="admin">Administradores</option><option value="moderator">Moderadores</option><option value="suspended">Suspensos</option></select></label><span>{filteredUsers.length} resultado(s) visíveis · até 50 por pesquisa</span></div>
      <div className="hb-admin-users-layout"><div className="hb-admin-users-list">{filteredUsers.map(person => <div key={person.user_id} className="hb-admin-user-row"><button type="button" className={selectedUser?.user_id === person.user_id ? 'selected' : ''} aria-pressed={selectedUser?.user_id === person.user_id} onClick={() => { setSelectedUser(person); setReason('') }}><span className="hb-admin-person-avatar">{(person.display_name || 'A').charAt(0).toUpperCase()}</span><span><strong>{person.display_name || 'Aventureiro'}</strong><small>{person.is_admin ? 'Admin' : person.is_moderator ? 'Moderador' : 'Jogador'}</small></span>{isCurrent(person.suspended_until) && <span className="hb-admin-mini-warning">Suspenso</span>}</button><div className="hb-admin-user-row-link">{personLink(person.username, person.user_id, 'Sem @usuário')}</div></div>)}{filteredUsers.length === 0 && <div className="hb-admin-empty">{users.length ? 'Nenhum resultado corresponde ao filtro.' : 'Pesquise uma conta para começar. Não existe uma listagem pública de todos os usuários.'}</div>}</div>
        <div className="hb-admin-inspection">{selectedUser ? <>
          <div className="hb-admin-person-heading"><span className="hb-admin-person-avatar hb-admin-person-avatar-lg">{(selectedUser.display_name || 'A').charAt(0).toUpperCase()}</span><div><strong>{selectedUser.display_name || 'Aventureiro'}</strong><small>{personLink(selectedUser.username, selectedUser.user_id, 'Sem @usuário')}</small></div></div>
          <div className="hb-admin-data"><span>Permissão global</span><p>{selectedUser.is_admin ? 'Administrador do site' : selectedUser.is_moderator ? 'Moderador do site' : 'Jogador'}</p><span>Advertências registradas</span><p>{selectedUser.warning_count}</p><span>Situação da conta na comunidade</span><p>{isCurrent(selectedUser.suspended_until) ? `Suspenso até ${formatDate(selectedUser.suspended_until!)}` : 'Sem suspensão ativa'}</p>{selectedUser.reason && <><span>Última justificativa registrada</span><p>{selectedUser.reason}</p></>}<span>Identificador</span><code>{selectedUser.user_id}</code></div>
          {onViewProfile && <button type="button" className="hb-admin-secondary" onClick={() => onViewProfile(selectedUser.user_id)}>Ver perfil público</button>}
          {selectedUser.is_admin && <p className="hb-admin-footnote">Contas administrativas não podem receber sanções por este painel, nem ter sua função global alterada pela interface.</p>}
          {pane === 'users' && !selectedUser.is_admin && selectedUser.user_id !== userId && <><label className="hb-admin-label">Justificativa da medida<textarea rows={3} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} placeholder="Informe os fatos que fundamentam esta medida…" /><small>{reason.length}/1000 caracteres</small></label><label className="hb-admin-label hb-admin-duration">Duração da suspensão<select value={days} onChange={e => setDays(e.target.value)}>{[1, 3, 7, 14, 30, 90, 365].map(day => <option key={day} value={day}>{day} {day === 1 ? 'dia' : 'dias'}</option>)}</select></label><div className="hb-admin-actions"><button type="button" disabled={working} onClick={() => userAction('warn')}>⚑ Advertir</button><button type="button" disabled={working} className="danger" onClick={() => userAction('suspend')}>⊘ Suspender Social</button>{isCurrent(selectedUser.suspended_until) && <button type="button" disabled={working} onClick={() => userAction('unsuspend')}>Liberar acesso</button>}</div></>}
          {pane === 'staff' && !selectedUser.is_admin && selectedUser.user_id !== userId && <div className="hb-admin-actions"><button type="button" disabled={working} className={selectedUser.is_moderator ? 'danger' : ''} onClick={() => moderatorAction(selectedUser)}>{selectedUser.is_moderator ? 'Revogar moderação' : '♜ Nomear moderador'}</button></div>}
        </> : <div className="hb-admin-empty">Selecione uma conta encontrada para consultar seu estado e as ações disponíveis.</div>}</div>
      </div>
      {pane === 'staff' && <p className="hb-admin-footnote">Por segurança, localize moderadores pela pesquisa de contas. A lista completa da equipe não está disponível nesta página.</p>}
    </section>}

    {pane === 'history' && <section className="hb-admin-section">
      <div className="hb-admin-section-title"><div><span className="hb-admin-section-eyebrow">AUDITORIA</span><h4>Histórico de moderação</h4><p>Decisões registradas com responsável, alvo e justificativa.</p></div><button type="button" disabled={!filteredAudit.length} onClick={() => downloadAudit(filteredAudit, identities)}>↓ Exportar CSV filtrado</button></div>
      <div className="hb-admin-filters hb-admin-history-filters"><label className="hb-admin-filter-search">Pesquisar no histórico<input type="search" value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Ação, motivo ou @usuário…" /></label><label>Tipo de ação<select value={historyAction} onChange={e => setHistoryAction(e.target.value)}><option value="all">Todas as ações</option>{Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><span>{filteredAudit.length} registro(s) · até 150 carregados</span></div>
      <div className="hb-admin-history">{filteredAudit.map(entry => <article key={entry.id}><span className="hb-admin-action-icon">◷</span><div><strong>{actionLabels[entry.action] || entry.action}</strong><p>{entry.reason || 'Nenhuma justificativa adicional registrada.'}</p><small>Responsável: {personLink(identities[entry.id]?.actor_username, entry.actor_id)} · Alvo: {personLink(identities[entry.id]?.target_username, identities[entry.id]?.target_user_id, 'Autor não identificado')}{entry.report_id ? ` · Denúncia: ${shortId(entry.report_id)}` : ''}</small></div><time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time></article>)}{!filteredAudit.length && <div className="hb-admin-empty">Nenhum evento corresponde à pesquisa.</div>}</div>
      <p className="hb-admin-footnote">A exportação inclui apenas as linhas atualmente carregadas e filtradas. As ações originais não podem ser editadas pelo navegador.</p>
    </section>}

    <footer className="hb-admin-footer"><span>HäxBag · Administração segura</span><p>O acesso é exclusivo de administradores globais e todas as operações críticas são verificadas pelas permissões de acesso. Moderadores de campanha ou da comunidade não têm acesso a esta central.</p></footer>

    {confirmation && <div className="hb-admin-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !working) setConfirmation(null) }}><div role="alertdialog" aria-modal="true" aria-labelledby="hb-admin-confirm-title" aria-describedby="hb-admin-confirm-desc" className="hb-admin-dialog"><span className="hb-admin-dialog-symbol">{confirmation.danger ? '⚠' : '✦'}</span><h4 id="hb-admin-confirm-title">{confirmation.title}</h4><p id="hb-admin-confirm-desc">{confirmation.description}</p><div className="hb-admin-actions"><button type="button" disabled={working} onClick={() => setConfirmation(null)}>Cancelar</button><button type="button" className={confirmation.danger ? 'danger' : ''} disabled={working} onClick={() => void perform(confirmation.run, confirmation.success)}>{working ? 'Registrando…' : 'Confirmar ação'}</button></div></div></div>}
  </section>
}
