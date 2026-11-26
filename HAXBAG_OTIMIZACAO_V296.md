# HäxBag V296 — Otimização conservadora de desempenho

Base: HäxBag Desktop V295. Versão de release: **0.296.0**.

## Melhorias efetivamente implementadas

1. **Evita atualizações de estado sem mudanças** na Comunicação: respostas idênticas de servidores, canais, membros, convites, perfis, leituras, atividades, mensagens e reações não provocam novas renderizações dos componentes.
2. **Economiza consultas de reações repetidas**: quando a lista de IDs das mensagens não mudou, o polling de mensagens não repete a mesma consulta de reações. O polling independente de reações a cada 10 segundos permanece ativo quando a interface está visível, e a consulta inicial ao mudar de canal continua imediata. No chat ocioso, isso elimina aproximadamente cinco consultas redundantes por minuto, sem contar chamadas acionadas por eventos.
3. **Menos trabalho ao procurar canais e membros**: o texto de pesquisa normalizado é memorizado, em vez de ser normalizado diversas vezes para cada item; grupos de canais são calculados apenas quando a lista muda.
4. **Resolução rápida de mensagens respondidas**: um mapa por ID substitui buscas lineares repetidas na lista de mensagens.
5. **Chamadas de voz sob demanda**: o componente WebRTC é importado de maneira assíncrona apenas quando a pessoa entra em uma chamada. Todas as opções de voz e compartilhamento de tela são mantidas.
6. **Consultas em segundo plano pausadas**: o polling periódico da Comunicação, notificações sociais e itens da mesa do mestre deixa de fazer pedidos quando a janela está oculta/minimizada, retomando e sincronizando imediatamente quando volta a ser visível. As assinaturas de tempo real continuam configuradas. A verificação de banimento/controle de acesso (a cada 30 s) não foi alterada.
7. **Formatadores reutilizados** para datas/horários, em vez de recriar instâncias de configuração do `Intl` por mensagem.

## O que NÃO foi alterado

- Fórmulas ou regras do RPG, combate, fichas, ações, kits ou inventários.
- Schema, SQL, permissões RLS ou validações do Supabase.
- Autenticação e navegação web/desktop.
- Funcionalidades de voz, vídeo, tela compartilhada, mensagens, anexos e convites.
- Política e repositório do atualizador automático (`GalaxyEndZ/H-xBagReleases`).
- Arquivos CSS e a identidade visual V295.

## Verificações realizadas neste ambiente

- Parsing de `src/App.tsx` e `src/components/CommunicationHubV284.tsx` sem erros.
- Transpilação sintática de ambos os componentes e `VoiceCallV288.tsx` sem erros.
- Typecheck isolado da Comunicação com `tsc` 5.8.3 e tipos Vite: sucesso.
- Verificação das versões `package.json` e `package-lock.json` em `0.296.0`.
- Testes de integridade dos arquivos ZIP e de preservação dos arquivos não alterados.

**Limitação:** não foi possível compilar todo o aplicativo neste ambiente; a instalação de Vite/Rolldown aqui não possui os binários nativos necessários e a checagem global TypeScript não terminou no tempo disponível. O pipeline Windows do GitHub Actions é a validação integral da build. Não existem métricas reais de FPS/CPU/MB medidas no Windows; os ganhos descritos são estruturais ou deduzidos da quantidade de requisições programadas.

## Instalação incremental e lançamento

1. Extraia `HaxBag_Otimizacao_V296.zip` na **raiz do projeto local `haxbag`** (aquele conectado a `GalaxyEndZ/H-xBag`), substituindo os cinco arquivos indicados.
2. Confirme que o código V295 está presente; não extraia sobre versões muito antigas.
3. Execute:

```powershell
git add package.json package-lock.json src/App.tsx src/components/CommunicationHubV284.tsx HAXBAG_OTIMIZACAO_V296.md
git diff --cached --stat
git commit -m "Otimizar desempenho do HaxBag V296"
git push origin HEAD
git tag v0.296.0
git push origin v0.296.0
```

4. Confira a execução no repositório **H-xBag / Actions** e a release **v0.296.0** no **H-xBagReleases**. Não crie a tag antes de verificar o commit.
5. Para quem ainda não recebeu atualizações pelo aplicativo automaticamente, valide o mecanismo de atualização em separado. A publicação da V296 não garante, por si só, que um cliente V294/V295 com erro no atualizador instale a nova versão sozinho.

Não há SQL novo.
