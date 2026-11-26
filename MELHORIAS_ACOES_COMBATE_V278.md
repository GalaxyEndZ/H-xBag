# HäxBag V278 — Central de Ações de Combate

Esta versão continua sobre a V277 e preserva as regras já implementadas em Fluxos, críticos, Reações, Iniciativa e Dano.

## Redesign

- Cabeçalho mais claro, com crítica, classe do ataque e DT do alvo em um só painel.
- Faixa compacta com modo de dano, ações disponíveis, reações e atalho para abrir Dano.
- Cartões de ataque com foco e indicação visual do último teste.
- Área de resultado diretamente após os botões de ataque, separada dos controles das Reações.
- Layout reorganizado para computadores, tablets e celulares; cores seguem o tema.

## Teste de ataque e DT conectados

1. Informe uma DT (opcional) e clique em Ataque Bruto, Ágil, Especial, Tiro ou Disparo.
2. O resultado mostra o dado selecionado, total e situação do acerto.
3. Alterar a DT **não gera outra rolagem**: a conferência utiliza o mesmo d20 registrado no teste anterior.
4. 1 natural continua sendo falha crítica; 20 natural confirma o acerto.
5. Margens críticas intermediárias só confirmam crítico se o ataque acertar a DT.
6. Acertos confirmados oferecem atalho para a seção **Dano**; ela continua sendo o local de rolagem de dano puro ou de Forma de Respiração, com gasto de PR apenas nessa etapa.

A visualização de teste não reduz PV/PS do alvo nem consome PR automaticamente. O gasto de PR continua sendo validado e salvo pelo componente de Dano antes de sua rolagem.

## Arquivos alterados

- `src/App.tsx` — lógica do teste, resultado conectado e layout
- `src/CombatActionsV278.css` — estilos do redesign adicional
- `src/CombatActionsV277.css` — incluído na atualização para compatibilidade

## Validação

- Checagem TypeScript: `tsc -b` — sem erros.
- Prévia HTML: testados cliques, reavaliação de DT e larguras de 1280, 900 e 390 px; sem rolagem horizontal.
- Build Vite completo: indisponível neste ambiente Linux pela ausência de `@rolldown/binding-linux-x64-gnu`; testar `npm run build` no Windows.
