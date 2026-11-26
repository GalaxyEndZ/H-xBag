# HäxBag V270 — Correção de cartões de Fluxos ao clicar

Problema: o App.css define `button:active:not(:disabled) { transform: translateY(1px); }`.
A regra sobrescrevia temporariamente o `translate(-50%, -50%)` dos 20 nós
posicionados de forma absoluta na árvore e fazia o cartão saltar para a direita,
com sobreposição dos cartões vizinhos.

Correção: o arquivo `src/components/KisatsutaiFlows.css` mantém o posicionamento
original dos nós tanto em repouso quanto durante o clique. Em layout compacto,
os nós permanecem em fluxo normal sem transformação. A animação do transform
foi retirada só desses cartões; borda e brilho continuam a indicar a seleção.

Instalação: extraia o ZIP de atualização na raiz do projeto haxbag e substitua
`src/components/KisatsutaiFlows.css`. Não altera SQL, dados nem regras dos Fluxos.
