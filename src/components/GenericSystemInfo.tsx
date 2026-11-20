import './GenericSystemInfo.css'

/** Explica o papel do sistema genérico sem alterar regras nem dados salvos. */
export default function GenericSystemInfo({ isCustom = false }: { isCustom?: boolean }) {
  return <aside className="hb-generic-info" aria-label="Sobre o sistema genérico">
    <div className="hb-generic-info-heading"><span aria-hidden="true">✦</span><div>
      <strong>{isCustom ? 'Sistema personalizado' : 'Sistema genérico'}</strong>
      <p>{isCustom ? 'O nome escolhido por você será preservado. As ferramentas comuns do HäxBag continuam disponíveis.' : 'Uma base flexível para construir aventuras sem regras próprias obrigatórias.'}</p>
    </div></div>
    <div className="hb-generic-info-grid">
      <span>◈ Fichas e atributos</span>
      <span>↗ Progressão flexível</span>
      <span>⚔ Inventário e combate</span>
      <span>✧ Regras definidas pelo mestre</span>
    </div>
    <small>Sem graduações, classes ou bônus automáticos de outro sistema.</small>
  </aside>
}
