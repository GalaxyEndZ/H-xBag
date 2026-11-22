# HäxBag V233 — Redesign dos perfis

Base: HäxBag V232 (Social redesenhado). Atualização exclusivamente de interface.

## O que mudou

### Perfil público de outros jogadores
- Composição do perfil alinhada à linguagem de cartões, superfícies e tipografia do Social V232.
- Cabeçalho com capa livre de ornamentos quando há imagem personalizada, avatar sobreposto de forma consistente, nome, status e indicação da relação com o jogador.
- Ações sociais (seguir, enviar mensagem, visitar posts, ver apresentação, copiar @) agrupadas e acessíveis.
- Estatísticas de personagens, campanhas, insígnias e crônicas em uma grade responsiva com atalhos existentes.
- Abas com estilo de seleção mais claro e rolagem horizontal no celular.
- Introdução ao mural, seções e cartões públicos com hierarquia visual uniforme.

### Ateliê: identidade e legado
- Cabeçalho e ações de salvar/visualizar mais compactos e consistentes com o Social.
- Área da capa e avatar harmonizada com a apresentação pública, preservando o deslocamento de imagem salvo pelo jogador.
- Nenhum texto ou ornamento sobre a capa personalizada do Ateliê.
- Estatísticas em cartões, vitrine lateral mais organizada, progresso de personalização e navegação refinados.
- Nota contextual explica que a prévia editável pode estar diferente do perfil público já salvo.
- Responsividade ajustada para telas menores e foco de teclado visível.

## Arquivos alterados
- `src/components/PublicAdventurerProfile.tsx`
- `src/components/ProfileLegacy.tsx`
- `src/components/ProfileRedesignV233.css` (novo)

## Instalação
1. Faça backup dos arquivos modificados localmente.
2. No ZIP de atualização, extraia os arquivos na pasta raiz `haxbag` preservando a estrutura `src/components/`.
3. Execute `npm run build` em seu ambiente e recarregue a página com Ctrl+F5.

Nenhum SQL adicional é necessário e não são realizadas migrações ou atualizações dos dados salvos.
Se a V231 Social ainda não foi instalada, a migração de banco `HAXBAG_SOCIAL_V231.sql` continua necessária para as funcionalidades da V231.

## Validação
- Parsing/transpilação TSX dos dois componentes com TypeScript 5.8.3, sem erro sintático.
- Parsing estrutural do CSS com tinycss2, sem erro.
- Prévia estática carregada em Chromium nas larguras 1440, 760 e 390 px, sem rolagem horizontal da página; capa personalizada com elementos decorativos ocultos e avatar sobreposto conforme esperado.
- Conteúdo da prévia estático e fictício, sem conexões com o Supabase. Pode ser aberto em navegador pelo arquivo `PREVIA_REDESIGN_PERFIS_V233.html`.
- Build integral e testes end-to-end com Supabase não realizados neste ambiente. Devem ser executados após instalar as dependências do projeto.
