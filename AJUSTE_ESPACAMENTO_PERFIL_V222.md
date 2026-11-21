# HäxBag V222 — Espaçamento das ações no perfil público

## Arquivo alterado
- `src/components/ProfileSocialV164.css`

## Ajustes
- Aumenta a distância horizontal entre **Seguindo**, **Enviar mensagem** e **Publicações e fotos** para 16 px no desktop, com 12 px entre linhas.
- Aplica uma área de respiro acima e abaixo dos botões, mantendo os três alinhados ao início do conteúdo.
- Unifica a altura mínima de 44 px e melhora a centralização dos textos.
- Em telas até 620 px, organiza os três botões em duas colunas com **Publicações e fotos** ocupando a segunda linha inteira. Se houver apenas um ou dois botões, o layout continua proporcional.
- Em telas de até 380 px, apresenta um botão por linha para não cortar o texto.
- Mantém as ações, permissões e regras de seguimento/mensagens inalteradas.

## Instalação
Extraia o ZIP de correção na raiz do HäxBag V221, substituindo o CSS correspondente, e recarregue a página com Ctrl+F5.

Não requer SQL. Alteração apenas visual.
