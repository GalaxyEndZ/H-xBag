import {useEffect,useState,type FormEvent} from 'react'
import {supabase} from '../supabase'
import './SocialExpansionV245.css'

type Gate = {userId:string;status:'checking'|'allowed'|'required'|'error';factorId:string|null;message:string}
export function useSocialV245MfaGate(userId:string|undefined){
 const [state,setState]=useState<Gate>({userId:'',status:'checking',factorId:null,message:''})
 const [retry,setRetry]=useState(0)
 useEffect(()=>{if(!userId){setState({userId:'',status:'allowed',factorId:null,message:''});return}
  let live=true;setState({userId,status:'checking',factorId:null,message:''})
  void (async()=>{try{
   const [factors,assurance]=await Promise.all([supabase.auth.mfa.listFactors(),supabase.auth.mfa.getAuthenticatorAssuranceLevel()])
   if(factors.error)throw factors.error;if(assurance.error)throw assurance.error
   if(!live)return
   const verified=factors.data.totp.find(f=>f.status==='verified')
   setState({userId,status:verified&&assurance.data.currentLevel!=='aal2'?'required':'allowed',factorId:verified?.id||null,message:''})
  }catch(e){if(live)setState({userId,status:'error',factorId:null,message:e instanceof Error?e.message:'Não foi possível verificar a proteção da conta.'})}})()
  return()=>{live=false}
 },[userId,retry])
 return {gate:state,retry:()=>setRetry(v=>v+1)}
}
export function SocialV245MfaPrompt({factorId,onVerified}:{factorId:string;onVerified:()=>void}){
 const [code,setCode]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false)
 async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('')
  try{const result=await supabase.auth.mfa.challengeAndVerify({factorId,code:code.trim()});if(result.error)throw result.error;onVerified()}
  catch(e){setError(e instanceof Error?e.message:'Não foi possível verificar o código.')}
  finally{setBusy(false)}
 }
 return <main className="hb-v245-mfa-gate"><section className="hb-v245-panel"><span>HÄXBAG / SEGURANÇA</span><h1>Confirme sua identidade</h1><p>Esta conta possui autenticação em duas etapas. Insira o código do seu aplicativo autenticador para continuar.</p><form onSubmit={e=>void submit(e)}><label>Código de 6 dígitos<input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={e=>setCode(e.target.value)}/></label><button type="submit" disabled={busy||code.trim().length<6}>{busy?'Verificando…':'Verificar e entrar'}</button></form>{error&&<p role="alert">{error}</p>}<button type="button" onClick={()=>void supabase.auth.signOut()}>Usar outra conta</button></section></main>
}
