import type { Dispatch, SetStateAction } from 'react'
import {
  KIT_DEFINITIONS, SCARCITY_DICE,
  kitAvailableScarcityLevels, kitDefinition, kitFixedSkillBonuses, kitSlots, kitUniqueSlots, kitRestType, KIT_UNIQUE_FEATURES, KIT_MAIN_SKILLS, kitWeight,
  type KitBenefitMode, type KitEffect, type KitType, type KitUniqueFeature,
} from '../kitRules'
import { KIT_SKILL_CATALOG } from '../kitSkillCatalog'
import './KitEditor.css'

export type KitEditorProps = {
  type: KitType | null
  onTypeChange: (type: KitType | null) => void
  benefitMode: KitBenefitMode
  onBenefitModeChange: (mode: KitBenefitMode) => void
  skills: string[]
  setSkills: Dispatch<SetStateAction<string[]>>
  skillBonus: string
  onSkillBonusChange: (value: string) => void
  uniqueEffect: string
  uniqueFeatures: KitUniqueFeature[]
  onUniqueFeaturesChange: (value: KitUniqueFeature[]) => void
  onUniqueEffectChange: (value: string) => void
  effect: KitEffect | null
  onEffectChange: (value: KitEffect | null) => void
  effectNotes: string
  onEffectNotesChange: (value: string) => void
  scarcityLevel: string
  onScarcityLevelChange: (value: string) => void
  exhausted: boolean
  onExhaustedChange: (value: boolean) => void
}

export default function KitEditor({
  type, onTypeChange, benefitMode, onBenefitModeChange, skills, setSkills, skillBonus, onSkillBonusChange,
  uniqueEffect, onUniqueEffectChange, uniqueFeatures, onUniqueFeaturesChange, effect, onEffectChange,
  effectNotes, onEffectNotesChange, scarcityLevel, onScarcityLevelChange,
  exhausted, onExhaustedChange,
}: KitEditorProps) {
  void onSkillBonusChange // A propriedade permanece na interface durante a transição do bônus antigo.
  const definition = kitDefinition(type)
  const slots = type ? kitSlots(type, benefitMode) : []
  const fixedBonuses = kitFixedSkillBonuses(type, benefitMode)
  const uniqueCount = kitUniqueSlots(type, benefitMode)
  const selectedRest = kitRestType(type, benefitMode)
  const changeFeature = (index: number, patch: Partial<KitUniqueFeature>) => {
    const next = Array.from({length: uniqueCount}, (_, i) => uniqueFeatures[i] ?? {key:'',amount:'',details:'',mainSkill:''} as KitUniqueFeature)
    next[index] = {...next[index],...patch}
    onUniqueFeaturesChange(next)
  }
  const levels = kitAvailableScarcityLevels(type)
  const weight = kitWeight(type, Number(scarcityLevel), exhausted)
  const effectPlaceholder = effect === 'damage'
    ? 'Descreva o dano adicional concedido, quando se aplica e suas limitações...'
    : effect === 'resistance'
      ? 'Explique a resistência concedida, quando funciona e suas limitações...'
      : effect === 'combat_point'
        ? 'Explique como o ponto de combate temporário pode ser utilizado e suas restrições...'
        : 'Descreva o benefício deste kit, como ele funciona e em quais situações pode ser utilizado...'
  return <section className="hb-kit-editor" aria-label="Tipos de kits">
    <header className="hb-kit-editor-head">
      <span className="hb-kit-editor-emblem" aria-hidden="true">🧰</span>
      <div><strong>Classificação do kit</strong><p>Escolha o tipo e configure suas regras sem alterar os demais itens.</p></div>
    </header>
    <label>Tipo de kit
      <select value={type ?? ''} onChange={event => onTypeChange(event.target.value ? event.target.value as KitType : null)}>
        <option value="">Kit sem subtipo definido</option>
        <optgroup label="Equipáveis">
          {Object.values(KIT_DEFINITIONS).filter(entry => entry.family === 'equippable').map(entry =>
            <option key={entry.type} value={entry.type}>{entry.name} · {entry.fixedWeight} kg</option>)}
        </optgroup>
        <optgroup label="Consumíveis">
          {Object.values(KIT_DEFINITIONS).filter(entry => entry.family === 'consumable').map(entry =>
            <option key={entry.type} value={entry.type}>{entry.name}</option>)}
        </optgroup>
      </select>
    </label>
    {definition && <>
      <div className="hb-kit-summary"><strong>{definition.name}</strong><p>{definition.description}</p>
        {selectedRest && definition.exampleItem && <span>🛏️ <b>{definition.exampleItem}</b> · Descanso {selectedRest === 'precario' ? 'precário' : selectedRest === 'mediano' ? 'mediano' : 'completo'}</span>}
        <span>Peso: <b>{weight === null ? 'Selecione um nível válido' : `${weight.toLocaleString('pt-BR', {maximumFractionDigits:2})} kg`}</b></span>
      </div>
      {definition.family === 'equippable' && <>
        {type === 'equip_simple' && <label>Escolha uma das duas opções do kit simples
          <select value={benefitMode==='rest'?'rest':'skills'} onChange={event=>onBenefitModeChange(event.target.value as KitBenefitMode)}>
            <option value="rest">Item de descanso · Saco de dormir (Descanso Precário)</option>
            <option value="skills">Duas perícias extras · +10 e +10</option>
          </select>
        </label>}
        {type === 'equip_standard' && <label>Escolha uma das três opções do kit padrão
          <select value={benefitMode} onChange={event=>onBenefitModeChange(event.target.value as KitBenefitMode)}>
            <option value="rest">Item de descanso · Futon (Descanso Mediano)</option>
            <option value="skills_unique">Duas perícias de arquétipo (+15/+10) e uma funcionalidade única</option>
            <option value="unique_pair">Duas funcionalidades únicas</option>
            {(benefitMode==='skills'||benefitMode==='protection')&&<option value={benefitMode}>Configuração antiga (mantida)</option>}
          </select>
        </label>}
        {type === 'equip_rare' && <>
          <label>Escolha uma das três opções do kit raro
            <select value={benefitMode==='rare_skills_two_unique'||benefitMode==='rare_mixed_two_unique'?'skill_features':benefitMode} onChange={event=>onBenefitModeChange((event.target.value==='skill_features'?'rare_skills_two_unique':event.target.value) as KitBenefitMode)}>
              <option value="rest">Item de descanso · Barraca (Descanso Completo)</option>
              <option value="skill_features">Três perícias (+15/+15/+10) e duas funcionalidades únicas</option>
              <option value="unique_triple">Três funcionalidades únicas</option>
              {(['three_archetype','general_and_archetype','main_and_archetype'] as KitBenefitMode[]).includes(benefitMode)&&<option value="main_and_archetype">Configuração antiga (mantida)</option>}
            </select>
          </label>
          {(benefitMode==='rare_skills_two_unique'||benefitMode==='rare_mixed_two_unique')&&<label>Distribuição dos três bônus
            <select value={benefitMode} onChange={event=>onBenefitModeChange(event.target.value as KitBenefitMode)}>
              <option value="rare_skills_two_unique">Três perícias de arquétipo (+15/+15/+10)</option>
              <option value="rare_mixed_two_unique">Duas de arquétipo e uma extra (+15/+15/+10)</option>
            </select>
          </label>}
        </>}
        {selectedRest && <p className="hb-kit-editor-note">🛏️ Esta opção concede somente Descanso {selectedRest==='precario'?'Precário':selectedRest==='mediano'?'Mediano':'Completo'}. Não concede bônus de perícia nem funcionalidades únicas.</p>}
        {slots.length > 0 && <div className="hb-kit-skill-grid">
          {slots.map((slot, index) => <label key={`${type}-${benefitMode}-${index}`}>{slot.label} <strong className="hb-kit-fixed-bonus">+{fixedBonuses[index]}</strong>
            <select value={skills[index] || ''} onChange={event => setSkills(current => { const next = [...current]; next[index] = event.target.value; return next })}>
              <option value="">Selecione uma perícia cadastrada...</option>
              {(KIT_SKILL_CATALOG[slot?.group] ?? []).map(group => <optgroup key={group.group} label={group.group}>
                {group.options.map(option => <option key={option.value} value={option.value}
                  disabled={skills.some((value,slotIndex)=>slotIndex!==index && value===option.value)}>{option.label}</option>)}
              </optgroup>)}
            </select>
          </label>)}
          <p className="hb-kit-skill-bonus">Bônus oficiais: {fixedBonuses.map(value=>`+${value}`).join(' · ')}. Aplicados apenas enquanto o kit estiver equipado.
            {skillBonus.trim() && <small> Este item possuía bônus antigo de +{skillBonus}; ao salvar a edição, passa a seguir a regra atual.</small>}
          </p>
        </div>}
        {benefitMode === 'protection' && type === 'equip_standard' && <p className="hb-kit-editor-note">Kit antigo: concede proteção moderada de Resistência, usando as mesmas regras dos equipamentos.</p>}
        {uniqueCount>0 && <div className="hb-kit-unique-grid">
          <strong>Funcionalidades únicas ({uniqueCount})</strong>
          {Array.from({length:uniqueCount}, (_,index)=>{
            const feature=uniqueFeatures[index]??{key:'',amount:'',details:'',mainSkill:''} as KitUniqueFeature
            const spec=KIT_UNIQUE_FEATURES.find(entry=>entry.key===feature.key)
            return <div className="hb-kit-unique-entry" key={`${type}-${benefitMode}-${index}`}>
              <label>Funcionalidade {index+1}
                <select value={feature.key} onChange={event=>changeFeature(index,{key:event.target.value as KitUniqueFeature['key'],amount:'',mainSkill:'',details:'',protectionTier:'basica',protectionMode:'resistencia'})}>
                  <option value="">Escolha uma funcionalidade...</option>
                  {KIT_UNIQUE_FEATURES.filter(entry=>type==='equip_rare'||!entry.rareOnly).map(entry=><option key={entry.key} value={entry.key} disabled={uniqueFeatures.some((other,i)=>i!==index&&other.key===entry.key)}>{entry.label}</option>)}
                </select>
              </label>
              {spec?.needsAmount && <label>Valor do benefício definido pelo mestre
                <input type="number" min="0.01" step="any" max="100000" value={feature.amount} onChange={event=>changeFeature(index,{amount:event.target.value})} placeholder="Ex.: 1, 2, 5..."/>
              </label>}
              {feature.key==='protection' && <>
                <label>Nível de proteção
                  <select value={feature.protectionTier??'basica'} onChange={event=>changeFeature(index,{protectionTier:event.target.value as NonNullable<KitUniqueFeature['protectionTier']>})}>
                    <option value="basica">Básica · ¼ do atributo</option>
                    <option value="moderada">Moderada · ½ do atributo</option>
                    <option value="avancada">Avançada · atributo integral</option>
                  </select>
                </label>
                <label>Tipo de proteção
                  <select value={feature.protectionMode??'resistencia'} onChange={event=>changeFeature(index,{protectionMode:event.target.value as NonNullable<KitUniqueFeature['protectionMode']>})}>
                    <option value="resistencia">Resistência · dano especial e bruto</option>
                    <option value="sanidade">Sanidade · pontos mentais</option>
                  </select>
                </label>
                <p className="hb-kit-editor-note">Usa o mesmo cálculo da proteção dos equipamentos. Só funciona enquanto o kit estiver equipado.</p>
              </>}
              {feature.key==='main_skill' && <label>Perícia principal
                <select value={feature.mainSkill||''} onChange={event=>changeFeature(index,{mainSkill:event.target.value})}>
                  <option value="">Selecione a perícia...</option>
                  {KIT_MAIN_SKILLS.map(skill=><option key={skill} value={skill}>{skill}</option>)}
                </select>
              </label>}
              {feature.key && <label>Descrição e condições da funcionalidade
                <textarea rows={2} maxLength={600} value={feature.details} onChange={event=>changeFeature(index,{details:event.target.value})} placeholder={feature.key==='remove_condition'?'Quais condições podem ser retiradas? A retirada permanece sob controle do mestre.':'Descreva as situações e limitações do benefício...'}/>
              </label>}
            </div>
          })}
          <p className="hb-kit-editor-note">Valores numéricos são definidos pelo mestre. Habilidades de retirar condições exigem decisão do mestre; não removem condições automaticamente.</p>
        </div>}
        {(benefitMode==='protection'||(benefitMode==='main_and_archetype'&&Boolean(uniqueEffect)))&&<label>Descrição de kit antigo
          <textarea value={uniqueEffect} onChange={event=>onUniqueEffectChange(event.target.value)} maxLength={1000} rows={2}/>
        </label>}
        <p className="hb-kit-editor-note">As perícias vêm do catálogo do RPG. Os bônus agora são fixos por posição, conforme o tipo de kit.</p>
      </>}
      {definition.family === 'consumable' && <>
        <div className="hb-kit-scarcity-row">
          <label>Nível de escassez
            <select value={levels.includes(Number(scarcityLevel) as 1|2|3|4) ? scarcityLevel : String(levels[0])} onChange={event => onScarcityLevelChange(event.target.value)} disabled={exhausted}>
              {levels.map(level => <option key={level} value={level}>Nível {level} · 1d{SCARCITY_DICE[level]} · {definition.weights?.[level]?.toLocaleString('pt-BR')} kg</option>)}
            </select>
          </label>
          <label className="hb-kit-scarcity-check"><input type="checkbox" checked={exhausted} onChange={event => onExhaustedChange(event.target.checked)}/> Esgotado</label>
        </div>
        {type !== 'prolonged' && <label>Benefício temporário
          <select value={effect ?? ''} onChange={event => onEffectChange(event.target.value ? event.target.value as KitEffect : null)}>
            <option value="">Escolha o efeito...</option>
            <option value="damage">Dano</option>
            <option value="resistance">Resistência</option>
            <option value="combat_point">Um ponto de combate</option>
          </select>
        </label>}
        {type !== 'prolonged' && <label>Detalhes do efeito (opcional)
          <textarea value={effectNotes} rows={2} maxLength={500} onChange={event => onEffectNotesChange(event.target.value)} placeholder={effectPlaceholder}/>
        </label>}
        <p className="hb-kit-editor-note">{type === 'immediate' ? 'Duração: até 1d6 rodadas.' : type === 'preparation' ? 'Duração: uma cena.' : 'Os efeitos e a duração do uso prolongado ainda não foram definidos.'} O dado de escassez continua sendo rolado na utilização do item.</p>
      </>}
    </>}
  </section>
}
