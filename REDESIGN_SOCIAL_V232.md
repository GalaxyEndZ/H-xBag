# HäxBag V232 — Redesign da área Social

**Base:** HäxBag V231 / Social Expandido. Atualização de interface sem mudanças no esquema de dados.

## Alterações

- Navegação local reorganizada em **Descobrir**, **Conexões** e **Sua conta**, com acesso direto a **Privacidade** e ao painel de moderação.
- Identidade visual **HäxBag Social** no menu local, respeitando os temas de temporada existentes.
- Cabeçalho, atalhos e métricas redesenhados para leitura rápida.
- Feed clássico e publicações especiais da V231 com espaçamento, tipografia, estados, cartões e ações padronizados.
- Composer, enquetes, coleções salvas, descoberta de jogadores, comunidades, eventos, notificações e mensagens com acabamento visual unificado.
- Barra de atalhos agora oferece acesso direto a **Explorar, Comunidades, Eventos, Salvos e Mensagens** — útil no desktop quando o menu local é substituído pela navegação global do HäxBag.
- Layout adaptável e foco acessível; respeito a `prefers-reduced-motion`.
- Nada foi alterado nos fluxos de autenticação, permissões, armazenamento ou dados pessoais.

## Instalação rápida (ZIP de atualização)

1. Faça backup dos seus arquivos modificados.
2. Extraia o ZIP na raiz do projeto `haxbag`, preservando a estrutura de pastas.
3. Substitua `src/components/FriendsPanel.tsx` e adicione `src/components/SocialRedesignV232.css`.
4. Execute `npm install` (caso necessário) e `npm run build` no seu ambiente.
5. Verifique as telas Social em desktop e celular e recarregue o navegador com `Ctrl + F5`.

**SQL:** não é necessário SQL novo para a V232. Se a V231 ainda não foi instalada, aplique a migração `HAXBAG_SOCIAL_V231.sql` existente no pacote completo.

**Prévia:** `PREVIA_VISUAL_SOCIAL_V232.html` contém uma demonstração visual estática com dados fictícios. Não executa as funcionalidades do site e não requer acesso ao Supabase.

## Validação realizada

- TSX de `FriendsPanel.tsx` analisado com TypeScript (sem erros de sintaxe).
- CSS analisado com parser CSS (sem erros estruturais).
- Layout demonstrativo renderizado em Chromium nas larguras 1440px, 760px e 390px, sem rolagem horizontal no documento.
- Verificada a visibilidade do cartão de perfil no menu lateral na prévia e o funcionamento dos breakpoints.

**Não verificado:** build integral do projeto e os fluxos end-to-end conectados ao Supabase. O ambiente não tem `node_modules`, e `npm ci --offline` não encontrou os pacotes no cache.
