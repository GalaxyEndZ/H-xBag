# HäxBag V285 — Redesign da Comunicação

A base é a V284. Esta atualização altera somente o componente da Comunicação e acrescenta seu novo CSS; **não altera** Social, RPG, Minigames, regras Kisatsutai ou permissões existentes.

## Interface

- Cabeçalho com resumo de servidores, membros e canais não lidos.
- Barra de servidores com identidade visual e destaques de seleção.
- Lista de canais com pesquisa local e filtro de não lidos.
- Painel da conversa redesenhado, com foco em legibilidade e elementos mais compactos.
- Separadores por dia (Hoje, Ontem e demais datas), agrupamento visual de mensagens consecutivas do mesmo autor, imagem de perfil quando disponível e prévia de imagens anexadas.
- Atalhos de resposta, copiar mensagem e botão de mensagens recentes.
- Busca nas 100 mensagens carregadas do canal com Ctrl+K / Cmd+K.
- Campo de mensagem mais claro e contador de caracteres.
- Lista de membros com busca e painel lateral acessível também em telas menores.
- Modais e áreas de configuração adaptados ao novo visual.

## Gestão de canais

- A equipe pode **editar** nome, descrição e visibilidade de cada canal, além de criar ou excluir.
- As alterações aproveitam o RLS de atualização de canais já presente no SQL V284. Não exige novas tabelas ou migração.

## Conservação

- Mantidos o Supabase V284, o envio em tempo real (com atualização periódica), reações, fixações, anexos privados, convites, gerenciamento de cargos e autorização de acesso.
- Corrigida uma corrida assíncrona: mensagens de um canal antigo não sobrescrevem o canal recém-selecionado.
- A busca continua restrita às últimas 100 mensagens carregadas; não é uma busca histórica global.
- Canais de voz e videochamadas **não** foram implementados.

## Instalação

Copie `src/components/CommunicationHubV284.tsx` e `src/components/CommunicationHubV285.css` para as pastas correspondentes. O CSS novo já é importado pelo componente.

**SQL:** nenhum SQL novo. O script `HAXBAG_COMUNICACAO_V284.sql` continua necessário caso ainda não tenha sido executado.

**Validação:** TypeScript isolado do componente validado; prévia renderizada em larguras de 1440, 700 e 390 px sem rolagem horizontal e com navegação/teste de busca/abertura do painel de membros. A compilação do projeto completo excedeu o tempo máximo desta execução e permanece pendente.
