# HäxBag V216 — Navegação sem botões duplicados

## O que mudou

- Removida a segunda barra de troca de espaços (Social / RPG / Minigames) do cabeçalho superior.
- Mantida a navegação original na barra lateral, com as mesmas ações, indicadores de seleção e acessibilidade.
- Mantido o botão **Menu** no cabeçalho para abrir a barra lateral em telas menores, além dos atalhos do rodapé móvel.
- Removidos os estilos CSS que eram exclusivos da barra superior duplicada.
- O restante do cabeçalho (localização atual, busca, notificações e sair) permanece inalterado.

## Instalação

Extraia o ZIP de correção na raiz do projeto e substitua os dois arquivos:

- `src/App.tsx`
- `src/components/SocialRpgSpacesV159.css`

Não há alterações no banco de dados; **não é necessário SQL**.

## Validação

Execute `npm run build` no ambiente de desenvolvimento antes de publicar.
