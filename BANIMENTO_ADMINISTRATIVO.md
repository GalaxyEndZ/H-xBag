# HäxBag — Banimento administrativo

## Instalação

1. Faça backup do banco e da pasta do site.
2. Execute `HAXBAG_BANIMENTO_ADMINISTRATIVO.sql` com privilégios de proprietário do banco, **depois** das migrações anteriores da área Social, do painel administrativo e da identificação de denúncias.
3. Substitua `src/App.tsx`, `src/components/SiteAdministrationV234.tsx` e `src/components/SiteAdministrationV234.css` pelos arquivos deste pacote.
4. Execute `npm run build`, publique o site e teste com uma conta administrativa e uma conta de testes não administrativa.

## Como usar

Em **Social → Painel Administrativo → Usuários**, pesquise o @usuário e selecione a conta. Informe um motivo de pelo menos oito caracteres e selecione **Banir conta**. Confirme a decisão. O estado **Banido** aparece na ficha e no filtro da lista. Para reverter, informe a justificativa e pressione **Revogar banimento**.

Denúncias com autoria identificada oferecem **Gerenciar conta do alvo**, que leva à mesma área. Os @usuários no histórico continuam clicáveis quando possuem uma conta válida.

## Segurança e alcance

- Somente contas com papel de **administrador global** podem aplicar ou revogar banimentos. É proibido banir a própria conta ou outra conta administrativa.
- O banco registra motivo, responsável e data. Tanto o banimento quanto a revogação entram no histórico de moderação.
- O app consulta o estado da conta antes de abrir a área autenticada e revalida a cada 30 segundos, ou ao retornar à aba. Ao detectar banimento, apresenta uma tela de bloqueio. Se a verificação falhar, não libera o app até conseguir verificar.
- Uma política restritiva de acesso é adicionada às tabelas **públicas com políticas por linha já habilitadas** no momento em que o script é executado. Ela bloqueia consultas e alterações diretas por contas banidas. Se novas tabelas protegidas forem criadas posteriormente, é necessário aplicar a mesma política a elas.
- **Limitação:** o banimento de aplicação NÃO revoga uma sessão/token de autenticação já emitido. Funções antigas com privilégios elevados podem contornar as políticas de linha; para proibir absolutamente toda operação antiga e revogar sessões, ainda é necessária uma integração de bloqueio na camada de autenticação e revisão das funções legadas. Não considere este pacote, sozinho, uma revogação global de credenciais.
- Suspensão temporária e banimento são medidas distintas. Revogar o banimento não elimina uma suspensão que ainda esteja ativa.

## Verificações realizadas

- Parsing TSX dos componentes alterados: sem erros sintáticos.
- O SQL foi preparado para execução transacional e não foi aplicado a banco remoto.
- Testes reais de RLS, das funções antigas e o build completo ainda precisam ser feitos no ambiente de produção/homologação.
