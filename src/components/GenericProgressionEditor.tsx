import type { ReactNode } from 'react'
import './GenericProgressionEditor.css'

type Props = {
  read: (path: string, fallback?: any) => any
  write: (path: string, value: any) => void
  renderField: (path: string, label: string) => ReactNode
  resource: string
}

/** Editor comum de progressão para sistemas sem graduação própria.
 * Preserva os caminhos JSON de todas as fichas existentes. */
export default function GenericProgressionEditor({ read, write, renderField, resource }: Props) {
  const input = (key: 'model' | 'currentStage' | 'experience' | 'nextRequirement', label: string, hint: string) => (
    <label className="hb-generic-field" key={key}>
      <span>{label}</span>
      <input
        type={key === 'experience' ? 'number' : 'text'}
        min={key === 'experience' ? 0 : undefined}
        value={String(read(`progression.${key}`, ''))}
        onChange={event => write(`progression.${key}`, key === 'experience' ? Number(event.target.value) : event.target.value)}
        placeholder={hint}
      />
    </label>
  )

  return <div className="hb-generic-progression" aria-label="Progressão flexível">
    <header className="hb-generic-progression-head">
      <span className="hb-generic-kicker">PROGRESSÃO FLEXÍVEL</span>
      <h4>Organize a evolução do personagem</h4>
      <p>Registre a progressão conforme as regras da sua mesa. Nada é promovido automaticamente: o mestre define os avanços.</p>
    </header>
    <div className="hb-generic-progression-grid">
      <section className="hb-generic-progression-card">
        <div className="hb-generic-step"><span>01</span><strong>Modelo e estágio</strong></div>
        {input('model', 'Modelo de progressão', 'Níveis, patentes, XP, marcos…')}
        {input('currentStage', 'Estágio atual', 'Ex.: nível 3, veterano, grau II')}
      </section>
      <section className="hb-generic-progression-card">
        <div className="hb-generic-step"><span>02</span><strong>Experiência e objetivo</strong></div>
        {input('experience', 'Experiência atual', '0')}
        {input('nextRequirement', 'Próximo avanço', 'Ex.: 100 XP ou missão concluída')}
      </section>
    </div>
    <section className="hb-generic-progression-card">
      <div className="hb-generic-step"><span>03</span><strong>Bônus da progressão</strong></div>
      <p className="hb-generic-note">Ajustes de PV, PS e {resource} concedidos pelo mestre ou pelo sistema escolhido.</p>
      <div className="hb-generic-bonuses">
        {renderField('progression.statusBonuses.pv', 'Bônus de PV')}
        {renderField('progression.statusBonuses.ps', 'Bônus de PS')}
        {renderField('progression.statusBonuses.pr', `Bônus de ${resource}`)}
      </div>
    </section>
    <section className="hb-generic-progression-card">
      <div className="hb-generic-step"><span>04</span><strong>Regras e anotações</strong></div>
      <label className="hb-generic-field">
        <span>Regras da progressão</span>
        <textarea rows={3} value={String(read('progression.rules', ''))} onChange={event => write('progression.rules', event.target.value)} placeholder="Descreva quando e como o personagem evolui." />
      </label>
    </section>
  </div>
}
