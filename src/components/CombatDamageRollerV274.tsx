import { useMemo, useRef, useState } from 'react'
import { getCriticalBonus, rollCriticalBonus, parseWeaponDice, CRITICAL_ATTRIBUTE_LABEL, type CriticalFormClass, type CriticalAttribute } from '../combatCriticalRules'
import { BREATHING_TIER_LABEL, parseDamageExpression, rollDamageExpression, type BreathingKind, type BreathingTier } from '../damageRollRulesV274'
import { FORM_PROFILES, FORM_KIND_LABEL, FORM_ATTRIBUTE_LABEL, CARPA_KINDS, formAllowedAttributes, formDamageFormula, formDefaultAttribute, formDamageBonus, type FormDelivery, type FormAttribute } from '../breathingFormRulesV282'
import '../CombatDamage.styles.css'

type DamageMode='pure'|'breathing'
type DamagePart={title:string;formula:string;total:number;detail:string}
type RolledConditionEffect={nature:'boa'|'ruim';grade:1|2;quantity:number;rounds:number;duration:string}
type RollResult={total:number;parts:DamagePart[];critical:boolean;modeLabel:string;paidPR?:number;previousPR?:number;effects:string[];conditions:RolledConditionEffect[]}
type Props={
  id:string;baseFormula:string;weaponFormula:string;weaponName?:string;kitBonus:number;
  dragonStrength:boolean;corvoStrength:boolean;tigreStrength:boolean;criticalThreshold:number;
  mode:DamageMode;onModeChange:(mode:DamageMode)=>void;
  tier:BreathingTier;onTierChange:(tier:BreathingTier)=>void;
  kind:BreathingKind;onKindChange:(kind:BreathingKind)=>void;
  delivery:FormDelivery;onDeliveryChange:(delivery:FormDelivery)=>void;
  attribute:FormAttribute;onAttributeChange:(attribute:FormAttribute)=>void;
  confirmedCritical:boolean;testedAttribute:CriticalAttribute|null;
  currentPR:number;resourceLabel:string;canSpendPR:boolean;onSpendPR:(cost:number)=>Promise<boolean>
  /** Navegação informativa: nunca aplica condições automaticamente. */
  isMaster:boolean;onOpenConditions?:()=>void
}

/** Máximo matemático da expressão da forma, sem dano base, arma, kit ou crítico. */
function calculateFormMaximum(expression:string):number {
  return (parseDamageExpression(expression)||[]).reduce((sum,term)=>sum+('flat' in term?term.flat:term.count*term.sides),0)
}
/** Rola somente dano causado. Condições críticas são propostas ao mestre, nunca aplicadas sem confirmação. */
export default function CombatDamageRollerV274(props:Props){
  const {id,baseFormula,weaponFormula,weaponName,kitBonus,dragonStrength,corvoStrength,tigreStrength,criticalThreshold,mode,onModeChange,tier,onTierChange,kind,onKindChange,delivery,onDeliveryChange,attribute,onAttributeChange,confirmedCritical,testedAttribute,currentPR,resourceLabel,canSpendPR,onSpendPR,isMaster,onOpenConditions}=props
  const [customForm,setCustomForm]=useState('')
  const [extraBonus,setExtraBonus]=useState('0')
  const [costInput,setCostInput]=useState('')
  const [result,setResult]=useState<RollResult|null>(null)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const rollingRef=useRef(false)
  const profile=FORM_PROFILES[tier][kind]
  const formPreset=formDamageFormula(tier,kind,delivery)
  const formFormula=customForm.trim()||formPreset
  const base=baseFormula==='—'?'':baseFormula.trim()
  const weapon=weaponFormula==='—'?'':weaponFormula.trim()
  const baseDie=useMemo(()=>parseWeaponDice(base)?.sides??null,[base])
  const dragonDice=dragonStrength&&baseDie?`2d${baseDie}`:''
  const corvoUnspecified=mode==='breathing'&&tier==='corvo'
  const criticalClass:CriticalFormClass=mode==='breathing'&&!corvoUnspecified?tier as CriticalFormClass:'none'
  const effectiveCritical=confirmedCritical&&!corvoUnspecified&&testedAttribute!==null
  const criticalPreview=effectiveCritical?getCriticalBonus({form:criticalClass,weaponFormula:weapon,corvoStrength,attribute:testedAttribute}):null
  const manualBonus=/^[-+]?\d+$/.test(extraBonus.trim())?Number(extraBonus):NaN
  const bonusValid=Number.isSafeInteger(manualBonus)&&Math.abs(manualBonus)<=100000
  const baseValid=Boolean(parseDamageExpression(base))
  const weaponValid=!weapon||Boolean(parseDamageExpression(weapon))
  const formValid=mode==='pure'||Boolean(parseDamageExpression(formFormula))
  const costValid=/^\d+$/.test(costInput.trim())&&Number.isSafeInteger(Number(costInput))&&Number(costInput)>0
  const cost=costValid?Number(costInput):0
  const enoughPR=costValid&&Number.isFinite(currentPR)&&cost<=currentPR
  const canRoll=baseValid&&weaponValid&&formValid&&bonusValid&&!saving&&(mode==='pure'||(costValid&&enoughPR&&canSpendPR))
  const choices=formAllowedAttributes(tier,kind,delivery)
  const formFlatBonus=mode==='breathing'?formDamageBonus(tier,kind,attribute):0
  const omitBase=mode==='breathing'&&kind==='destrutiva'&&delivery==='ranged'&&tier!=='raposa'

  const clear=()=>{setCustomForm('');setResult(null);setError('')}
  const changeMode=(next:DamageMode)=>{if(saving)return;onModeChange(next);setCostInput(next==='breathing'?String(profile.costPR??''):'');clear()}
  const changeTier=(next:BreathingTier)=>{if(saving)return;onTierChange(next);onDeliveryChange('direct');onAttributeChange(formDefaultAttribute(next,kind,'direct'));setCostInput(String(FORM_PROFILES[next][kind].costPR??''));clear()}
  const changeKind=(next:BreathingKind)=>{if(saving)return;onKindChange(next);onDeliveryChange('direct');onAttributeChange(formDefaultAttribute(tier,next,'direct'));setCostInput(String(FORM_PROFILES[tier][next].costPR??''));clear()}
  const changeDelivery=(next:FormDelivery)=>{if(saving)return;onDeliveryChange(next);onAttributeChange(formDefaultAttribute(tier,kind,next));clear()}

  const roll=async()=>{
    if(rollingRef.current)return
    if(!canRoll){setError('Revise as fórmulas e confirme um custo de PR válido antes de rolar esta Forma.');return}
    rollingRef.current=true;setSaving(true);setError('');setResult(null)
    try{
      if(mode==='breathing'){
        const saved=await onSpendPR(cost)
        if(!saved){setError(`Não foi possível descontar ${cost} ${resourceLabel}. Nenhum dano foi rolado.`);return}
      }
      const parts:DamagePart[]=[]
      const add=(title:string,expression:string)=>{
        const rolled=rollDamageExpression(expression);if(!rolled)return false
        const diceText=rolled.dice.map(group=>`${group.values.length}d${group.sides} [${group.values.join(', ')}]`).join(' + ')
        const detail=[diceText,rolled.modifier?`${rolled.modifier>0?'+':''}${rolled.modifier}`:''].filter(Boolean).join(' ')
        parts.push({title,formula:expression,total:rolled.total,detail:detail||String(rolled.total)})
        return true
      }
      if(!omitBase)add('Dano base',base)
      if(weapon)add(weaponName?`Arma · ${weaponName}`:'Arma equipada',weapon)
      if(mode==='breathing'){
        add(`Forma ${BREATHING_TIER_LABEL[tier]} · ${FORM_KIND_LABEL[kind]}${delivery==='ranged'?' · Distância/Área':''}`,formFormula)
        if(formFlatBonus)add(`Bônus ofensivo de ${FORM_ATTRIBUTE_LABEL[attribute]}`,String(formFlatBonus))
      }
      if(kitBonus>0)add('Kit equipado',String(Math.floor(kitBonus)))
      if(dragonDice)add('Fluxo · Ímpeto Certeiro',dragonDice)
      if(corvoStrength)add('Fluxo · Guerreiro Insuperável','10')
      if(manualBonus!==0)parts.push({title:'Modificador adicional',formula:String(manualBonus),total:manualBonus,detail:`${manualBonus>0?'+':''}${manualBonus}`})
      const effects:string[]=[]
      let conditions:RolledConditionEffect[]=[]
      if(effectiveCritical&&testedAttribute){
        const crit=rollCriticalBonus({form:criticalClass,weaponFormula:weapon,corvoStrength,attribute:testedAttribute})
        if(crit.bonusDice>0&&crit.total!==null)add('Bônus de crítico',String(crit.total))
        if(crit.bonusDice>0&&crit.total===null)effects.push('Arma sem dados válidos: nenhum bônus de dado de crítico foi rolado.')
        if(crit.bonusDice>0&&crit.total!==null)parts[parts.length-1]={...parts[parts.length-1],title:`Crítico · ${CRITICAL_ATTRIBUTE_LABEL[testedAttribute]}`,formula:crit.formula||'',detail:`[${crit.rolls.join(', ')}]`}
        // Gera recomendações e duração, mas NÃO escreve na biblioteca/tabelas de condições.
        conditions=crit.conditions.map(({nature,grade,quantity,rounds,duration})=>({nature,grade,quantity,rounds,duration}))
        if(crit.movementPrReduction>0)effects.push(`Redução de ${crit.movementPrReduction}% no PR gasto em movimento — não reduz automaticamente o custo desta Forma.`)
        if(crit.note)effects.push(crit.note)
        if(tigreStrength)effects.push('Força Sobre-Humana (Fluxo Tigre/FOR): mestre pode aplicar Sangrando, Vulnerável ou Atordoado, conforme a descrição do golpe.')
      }
      setResult({total:Math.max(0,parts.reduce((sum,part)=>sum+part.total,0)),parts,critical:effectiveCritical,modeLabel:mode==='pure'?'Dano puro':`Forma ${BREATHING_TIER_LABEL[tier]} · ${FORM_KIND_LABEL[kind]}`,paidPR:mode==='breathing'?cost:undefined,previousPR:mode==='breathing'?currentPR:undefined,effects,conditions})
    }catch{setError('Falha ao salvar o consumo de PR. Rolagem cancelada para evitar gastos duplicados.')}
    finally{rollingRef.current=false;setSaving(false)}
  }

  return <section className="hb-damage-roll-v274" id={id} aria-label="Rolagem de dano causado">
    <div className="hb-damage-roll-v274-heading"><div><span className="combat-eyebrow">ROLAGEM OFENSIVA · KISATSUTAI</span><h3>⚔ Dano</h3><p>Role somente o dano causado. Formas consomem PR antes da rolagem. Efeitos críticos são calculados aqui, mas condições só são aplicadas pelo mestre.</p></div><span className="hb-damage-roll-v274-label">DANO CAUSADO</span></div>
    <div className="hb-damage-roll-v274-modes" role="group" aria-label="Modo de dano"><button type="button" disabled={saving} aria-pressed={mode==='pure'} className={mode==='pure'?'is-selected':''} onClick={()=>changeMode('pure')}>⚔ Dano puro</button><button type="button" disabled={saving} aria-pressed={mode==='breathing'} className={mode==='breathing'?'is-selected':''} onClick={()=>changeMode('breathing')}>✦ Forma de Respiração</button></div>
    {mode==='breathing'&&<>
      <div className="hb-damage-roll-v274-form hb-damage-roll-form-v282">
        <label>Classificação<select disabled={saving} value={tier} onChange={event=>changeTier(event.target.value as BreathingTier)}>{(Object.keys(BREATHING_TIER_LABEL) as BreathingTier[]).map(key=><option value={key} key={key}>{BREATHING_TIER_LABEL[key]}</option>)}</select></label>
        <label>Tipo de forma<select disabled={saving} value={kind} onChange={event=>changeKind(event.target.value as BreathingKind)}>{(Object.keys(FORM_KIND_LABEL) as BreathingKind[]).map(key=><option value={key} key={key}>{FORM_KIND_LABEL[key]}</option>)}</select></label>
        {kind==='destrutiva'&&profile.rangedDamage&&<label>Alcance<select disabled={saving} value={delivery} onChange={event=>changeDelivery(event.target.value as FormDelivery)}><option value="direct">Direto / FOR</option><option value="ranged">À distância ou área / AGI</option></select></label>}
        <label>Atributo da forma<select disabled={saving} value={choices.includes(attribute)?attribute:choices[0]} onChange={event=>{onAttributeChange(event.target.value as FormAttribute);setResult(null)}}>{choices.map(key=><option key={key} value={key}>{FORM_ATTRIBUTE_LABEL[key]}</option>)}</select></label>
        <label>Fórmula da forma<input disabled={saving} aria-label="Fórmula de dano da forma" spellCheck={false} value={customForm||formPreset} onChange={event=>{setCustomForm(event.target.value);setResult(null)}} placeholder="Ex.: 2d6+4" /></label>
        <div className="hb-form-rule-v282"><strong>{FORM_KIND_LABEL[kind]} · {BREATHING_TIER_LABEL[tier]}</strong><span>{profile.description}</span><small>{profile.mechanic}</small>{profile.maximum!==null&&<div className="hb-form-maximum-v283"><span>Dano máximo da Forma: <b>{calculateFormMaximum(formFormula)+formFlatBonus}</b>{formFlatBonus>0?` (inclui +${formFlatBonus} de FOR)`:''}</span><small>Calculado a partir de {formFormula}{formFlatBonus>0?` + ${formFlatBonus}`:''}. Não inclui dano base, arma, kits ou crítico.</small></div>}</div>
        {tier==='corvo'&&<p className="hb-damage-roll-v274-helper">Os valores Corvo existentes foram preservados como referência legada; custos e bônus de classe ainda não foram definidos nas regras enviadas.</p>}
      </div>
      <div className="hb-damage-roll-v274-pr"><div className="hb-damage-roll-v274-pr-balance"><small>{resourceLabel} disponível</small><strong>{currentPR}</strong><span>Saldo atual da ficha.</span></div><label>Custo de {resourceLabel} da Forma<input type="number" min="1" step="1" inputMode="numeric" disabled={saving} value={costInput} onChange={event=>{setCostInput(event.target.value);setError('');setResult(null)}} placeholder="Informe o custo" aria-describedby={`${id}-pr-hint`} /></label><div className="hb-damage-roll-v274-pr-after" id={`${id}-pr-hint`}><small>Saldo após a Forma</small><strong>{costValid&&enoughPR?currentPR-cost:'—'}</strong><span>{!canSpendPR?'Somente quem pode editar a ficha pode consumir PR.':!costInput.trim()?'Informe o custo para liberar a rolagem.':!costValid?'Digite um valor inteiro maior que zero.':!enoughPR?`Saldo insuficiente de ${resourceLabel}.`:`Custo padrão: ${profile.costPR??'não definido'} ${resourceLabel}. Editável se necessário.`}</span></div></div>
      <details className="hb-carpa-info-v282"><summary>Formas Carpa — controle, suporte e cura</summary><div>{Object.entries(CARPA_KINDS).map(([key,value])=><p key={key}><strong>{key[0].toUpperCase()+key.slice(1)}</strong> · {value}</p>)}</div><small>Carpa não utiliza automaticamente a rolagem de dano físico deste painel. Custos e efeitos específicos precisam ser definidos.</small></details>
    </>}
    <div className="hb-damage-roll-v274-parts" aria-label="Componentes da rolagem"><div><small>Dano base · graduação</small><strong>{omitBase?'Omitido à distância':base||'Não definido'}</strong></div><div><small>Arma equipada</small><strong>{weapon||'Sem arma'}</strong></div><div><small>Bônus do kit</small><strong>+{Math.max(0,Math.floor(kitBonus))}</strong></div>{mode==='breathing'&&<div><small>Forma escolhida</small><strong>{formFormula}</strong></div>}{formFlatBonus>0&&<div><small>Ofensiva · FOR</small><strong>+{formFlatBonus} dano</strong></div>}{dragonStrength&&<div><small>Ímpeto Certeiro</small><strong>{dragonDice?`+${dragonDice}`:'Sem dado base'}</strong></div>}{corvoStrength&&<div><small>Guerreiro Insuperável</small><strong>+10</strong></div>}</div>
    <div className="hb-damage-roll-v274-controls"><label>Bônus ou penalidade situacional<input type="number" inputMode="numeric" step="1" disabled={saving} value={extraBonus} onChange={event=>{setExtraBonus(event.target.value);setResult(null)}} /></label><div className={`hb-damage-roll-v274-crit hb-crit-linked-v282${effectiveCritical?' is-confirmed':''}`} role="status" aria-live="polite"><span className="hb-crit-symbol-v282">{effectiveCritical?'✦':'◇'}</span><span><strong>{effectiveCritical?`Crítico ${CRITICAL_ATTRIBUTE_LABEL[testedAttribute!] } confirmado pelo teste`:'Crítico aguardando confirmação do ataque'}</strong><small>{effectiveCritical?`A rolagem de Dano calculará os efeitos da combinação com a classe ${mode==='pure'?'Sem Respiração':BREATHING_TIER_LABEL[tier]}.`:`Role um ataque em Ações e confirme o acerto pela DT · margem ${criticalThreshold}+. Não é necessário marcar manualmente.`}</small></span></div></div>
    {effectiveCritical&&criticalPreview&&<div className="hb-critical-effects-v282"><strong>Crítico de {CRITICAL_ATTRIBUTE_LABEL[testedAttribute!]}</strong><span>{criticalPreview.formula||'Sem dados extras de arma'}</span>{criticalPreview.conditions.map((condition,index)=><small key={index}>{condition.quantity} condição(ões) {condition.nature==='boa'?'boa(s)':'prejudicial(is)'} de grau {condition.grade} durante {condition.duration} rodada(s) · aplicação somente pelo mestre</small>)}{criticalPreview.movementPrReduction>0&&<small>−{criticalPreview.movementPrReduction}% de PR apenas em movimentos</small>}</div>}
    {corvoUnspecified&&<p className="hb-damage-roll-v274-helper">O bônus de crítico específico de Formas Corvo permanece indefinido nesta versão.</p>}
    <button type="button" className="hb-damage-roll-v274-submit" disabled={!canRoll} onClick={()=>{void roll()}}>{saving?'Salvando custo de PR…':mode==='pure'?'🎲 Rolar dano puro':`🎲 Gastar ${costValid?cost:'—'} ${resourceLabel} e rolar dano`}</button>
    {!canRoll&&!saving&&<p className="hb-damage-roll-v274-error" role="status">{!baseValid?'A graduação não possui uma fórmula base válida.':!weaponValid?'A arma possui uma fórmula inválida.':!formValid?'A fórmula da forma é inválida.':!bonusValid?'O bônus situacional deve ser um inteiro.':mode==='breathing'&&!canSpendPR?'Você não tem permissão para gastar PR nesta ficha.':mode==='breathing'&&!costValid?`Informe o custo de ${resourceLabel} da forma.`:mode==='breathing'&&!enoughPR?`${resourceLabel} insuficiente para a forma.`:''}</p>}
    {error&&<p className="hb-damage-roll-v274-error" role="alert">{error}</p>}
    {result&&<div className="hb-damage-roll-v274-result" role="status" aria-live="polite"><div className="hb-damage-roll-v274-result-top"><span>{result.modeLabel}{result.critical?' · Crítico confirmado':''}</span><strong>{result.total} <small>de dano</small></strong></div>{result.paidPR!==undefined&&<p className="hb-damage-roll-v274-pr-receipt">{result.paidPR} {resourceLabel} consumidos · {result.previousPR} → {(result.previousPR??0)-result.paidPR} {resourceLabel} restantes</p>}<div className="hb-damage-roll-v274-result-list">{result.parts.map((part,index)=><div key={`${index}-${part.title}`}><span><b>{part.title}</b><small>{part.formula} · {part.detail}</small></span><strong>{part.total>0?'+':''}{part.total}</strong></div>)}</div>{result.conditions.length>0&&<div className="hb-critical-conditions-v283" aria-label="Condições críticas pendentes de decisão do mestre">
      <div className="hb-critical-conditions-v283-head"><div><span>✦ RESULTADOS DO CRÍTICO</span><strong>Condições a aplicar pelo mestre</strong><small>Graus I e II da regra de crítico não equivalem automaticamente à gravidade da biblioteca. O mestre escolhe as condições e o alvo.</small></div><span className="hb-critical-conditions-v283-status">Não aplicadas</span></div>
      <div className="hb-critical-conditions-v283-list">{result.conditions.map((condition,index)=><div className="hb-critical-condition-v283" key={`${index}-${condition.nature}-${condition.grade}`}>
        <span className={`hb-critical-condition-v283-kind ${condition.nature==='boa'?'is-good':'is-bad'}`}>{condition.nature==='boa'?'Boa':'Prejudicial'}</span>
        <strong>{condition.quantity} × grau {condition.grade===1?'I':'II'}</strong>
        <small>{condition.rounds} {condition.rounds===1?'rodada':'rodadas'} <em>({condition.duration})</em></small>
      </div>)}</div>
      <div className="hb-critical-conditions-v283-footer"><p>{isMaster?'Selecione e aplique as condições pelo painel da campanha. Nenhum efeito é atribuído automaticamente.':'Encaminhe estes resultados ao mestre para que ele escolha as condições e as aplique à ficha do alvo.'}</p>
      {isMaster&&onOpenConditions&&<button type="button" className="hb-critical-conditions-v283-button" onClick={onOpenConditions}>Abrir painel de Condições</button>}</div>
    </div>}{result.effects.length>0&&<div className="hb-critical-effects-v282"><strong>Outros efeitos do crítico</strong>{result.effects.map((effect,index)=><small key={index}>{effect}</small>)}</div>}<small className="hb-damage-roll-v274-helper">Resultado informativo: resistências, armadura e condições são aplicadas separadamente pelo mestre ou alvo.</small></div>}
  </section>
}
