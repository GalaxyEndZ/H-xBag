# HäxBag V218 — Manter a ficha aberta após F5

## Correção

Ao atualizar a página, o aplicativo limpava a campanha e o personagem selecionados antes de concluir a recuperação da sessão de usuário. Assim que os personagens carregavam novamente, o sistema abria a primeira ficha da lista.

Agora as rotinas de carregamento de campanhas, temporadas e personagens aguardam o fim da autenticação antes de validar ou zerar as seleções existentes. A URL da ficha continua guardando a campanha, a temporada e o personagem, permitindo recarregamento e links diretos.

## Instalação

Extraia este patch na raiz do projeto V217, substituindo `src/App.tsx`. A versão completa V218 pode ser usada como alternativa.

## Testes sugeridos

1. Abra a segunda ou terceira ficha de uma campanha e confira que a URL contém `hb_page=sheets`, `hb_character=...` e `hb_sheet=1`.
2. Pressione F5 e confirme que a mesma ficha e temporada continuam abertas.
3. Teste uma campanha diferente, a navegação Voltar/Avançar e o botão Voltar à lista.
4. No computador de desenvolvimento, execute `npm run build` antes de publicar.

Não há alterações de SQL, de dados das fichas ou de permissões.
