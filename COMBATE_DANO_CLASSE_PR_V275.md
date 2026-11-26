# HäxBag V275 — classificação compartilhada, Dano e PR

A classificação da Forma de Respiração é definida na seção **Dano** e exibida automaticamente no painel **Ações > Crítico** (sem seletor duplicado). Dano puro usa o bônus crítico correspondente a ausência de forma. Formas Raposa, Tigre ou Dragão usam seus bônus de crítico previstos. A fórmula específica de crítico Corvo permanece indefinida; não é inventado um dado automático.

Na seção **Dano**, escolha entre **Dano puro** (não gasta PR) e **Forma de Respiração**. Para a segunda, escolha a classificação e tipo, ajuste opcionalmente a fórmula e informe o custo de PR manualmente. O custo precisa ser inteiro positivo e caber no saldo. O botão desconta PR e persiste na ficha **antes** de rolar os dados. Se o salvamento falhar, a rolagem não ocorre. O custo é apagado ao trocar de classificação/tipo/modo, prevenindo reutilização acidental.

Os resultados mostram valores de dano causado (base, arma, kit, Fluxos, forma e crítico confirmado) e, quando há Respiração, o PR gasto e restante. Não há dano de sanidade causado nem alteração de PV/PS do alvo ou do personagem por meio dessa opção. Os controles já existentes de dano recebido ficam somente em Status.

No ataque, o painel de crítico mostra o bônus previsto, mas não realiza mais uma rolagem duplicada dos dados extras. O cálculo efetivo acontece na seção Dano, com a mesma classificação.

## Aplicação

Extraia a atualização na pasta principal `haxbag`, mantendo os caminhos internos e substituindo os arquivos. Não requer SQL novo. Verificado com `tsc -b` (TypeScript 5.8.3). A compilação completa do Vite não foi executada neste ambiente por dependências nativas de plataforma.
