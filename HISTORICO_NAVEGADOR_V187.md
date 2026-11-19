# HäxBag V187 — Histórico do navegador

O site agora usa `window.history.pushState`, `replaceState` e o evento `popstate`.
Não foi necessário instalar React Router, alterar o banco de dados ou recarregar a página.

## O que passa a funcionar

- Voltar e Avançar entre as páginas do RPG (Visão geral, Fichas, Campanhas, etc.).
- Voltar e Avançar entre seções do próprio Perfil.
- Navegar entre as abas do Social (Feed, Amigos, Seguindo, Seguidores, Descobrir, Mensagens, Bloqueados e Convite Social).
- Retornar à lista de fichas ou à ficha aberta anteriormente, e à lista de inimigos.
- Os links da barra de endereço restauram as seções correspondentes ao abrir ou atualizar a página, após o login.
- Campanha, temporada e ficha selecionadas podem ser preservadas na URL; permissões continuam sendo conferidas pelo sistema.

## Como testar

1. Execute `npm install` e `npm run build` (ou `npm run dev`).
2. Entre no site e abra **Social → Feed → Mensagens**.
3. Aperte **Voltar** no navegador: a aba Feed deverá reaparecer. Aperte **Avançar**: Mensagens reaparece.
4. Entre em **RPG → Fichas**, abra uma ficha e use Voltar/Avançar para alternar a lista e a ficha.
5. Atualize a página numa seção interna e confirme se a navegação foi restaurada.
6. Confira que URLs de convite com `?invite=...` continuam intactas.

## Alterações

- `src/App.tsx`: estados iniciados pela URL, registro e restauração do histórico de navegação.
- `src/siteNavigation.ts`: leitura/gravação/validação das rotas e detecção de mudanças relevantes.

## Notas

- Sem SQL novo.
- Parâmetros de URL pertencentes a convites, confirmação de conta e âncoras existentes são preservados.
- Caixas de diálogo temporárias, como confirmação de excluir, não geram etapas de histórico.
- A restauração de dados de campanhas/personagens depende do acesso do usuário e do carregamento da conta; histórico não concede permissões extras.
- Alterações não salvas em formulários não são gravadas pelo histórico do navegador.
