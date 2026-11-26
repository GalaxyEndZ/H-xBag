import {useCallback,useEffect,useState} from 'react'
import {supabase} from '../supabase'
import {ARCADE_GAMES} from './ArcadeChallengeCatalog'
import './V304Features.css'
type Tournament={id:string;game_id:string;title:string;season_key:string;starts_at:string;ends_at:string}
type Standing={tournament_id:string;user_id:string;best_score:number;runs_played:number;updated_at:string}
export default function TournamentsV304({userId}:{userId:string}){
 const [items,setItems]=useState<Tournament[]>([]),[selected,setSelected]=useState(''),[scores,setScores]=useState<Standing[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[names,setNames]=useState<Record<string,string>>({})
 const refresh=useCallback(async()=>{
  const provision=await supabase.rpc('hax_v304_ensure_season')
  if(provision.error)throw provision.error
  const {data,error:e}=await supabase.from('hax_v304_tournaments').select('*').order('starts_at',{ascending:false}).limit(60)
  if(e)throw e;const rows=(data||[]) as Tournament[];setItems(rows);setSelected(previous=>rows.some(t=>t.id===previous)?previous:rows[0]?.id||'')
 },[])
 useEffect(()=>{void refresh().catch(e=>setError(`Torneios indisponíveis: ${e.message}. Execute a migração V304.`)).finally(()=>setLoading(false))},[refresh])
 useEffect(()=>{if(!selected)return;let alive=true;void supabase.from('hax_v304_tournament_standings').select('tournament_id,user_id,best_score,runs_played,updated_at').eq('tournament_id',selected).order('best_score',{ascending:false}).limit(30).then(async({data,error:e})=>{
  if(!alive)return;if(e){setError(e.message);return}const rows=(data||[]) as Standing[];setScores(rows)
  const ids=rows.map(x=>x.user_id);if(ids.length){const people=await supabase.from('profiles').select('id,display_name,username').in('id',ids);if(alive&&!people.error)setNames(Object.fromEntries((people.data||[]).map(p=>[p.id,p.display_name||p.username||'Jogador'])))}
 });return()=>{alive=false}},[selected])
 const chosen=items.find(t=>t.id===selected)
 const future=chosen?new Date(chosen.starts_at).getTime()>Date.now():false
 const ended=chosen?new Date(chosen.ends_at).getTime()<Date.now():false
 return <section className="hb-v304-wrap hb-v304-compact" id="hb-arcade-tournaments-v304"><header className="hb-v304-inline"><div><small>ARCADE · COMPETIÇÕES</small><h3>Torneios e temporadas</h3><p className="hb-v304-muted">Recordes de partidas registradas pelo servidor durante cada temporada.</p></div><button type="button" onClick={()=>void refresh().catch(e=>setError(e.message))}>↻ Atualizar</button></header>{error&&<p role="alert" className="hb-v304-error">{error}</p>}
  {loading?<p>Carregando torneios…</p>:items.length?<><label>Competição<select value={selected} onChange={e=>setSelected(e.target.value)}>{items.map(t=><option key={t.id} value={t.id}>{ARCADE_GAMES.find(g=>g.id===t.game_id)?.icon||'🏆'} {t.title}</option>)}</select></label>{chosen&&<p><strong>{future?'Em breve':ended?'Encerrado':'Em andamento'}</strong> · {new Date(chosen.starts_at).toLocaleDateString('pt-BR')} até {new Date(chosen.ends_at).toLocaleDateString('pt-BR')}</p>}
   <ol className="hb-v304-tournament-leaders">{scores.map((row,i)=><li key={row.user_id} className={row.user_id===userId?'is-mine':''}><b>#{i+1} {row.user_id===userId?'Você':names[row.user_id]||'Jogador'}</b><span>{row.best_score.toLocaleString('pt-BR')} pts · {row.runs_played} partida(s)</span></li>)}</ol>{!scores.length&&<p className="hb-v304-muted">Ainda não existem pontuações verificadas para este torneio.</p>}
  </>:<p className="hb-v304-muted">Nenhum torneio disponível.</p>}</section>
}
