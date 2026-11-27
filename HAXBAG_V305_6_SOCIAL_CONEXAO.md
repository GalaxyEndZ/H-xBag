# HäxBag V305.6 — Navegação Social e recuperação de temporadas

## Social no desktop
- As áreas principais (Feed, Mensagens, Amigos, Comunidades e Explorar) continuam acessíveis pela faixa de ícones à esquerda.
- As ferramentas complementares ficam em grupos recolhíveis: Sua rede, Biblioteca, Minha identidade e Mais opções.
- O menu completo continua disponível no navegador e em janelas compactas.

## Mensagem "Erro ao carregar temporadas: TypeError: Failed to fetch"
- Uma requisição HTTP do Supabase pode falhar por rede, indisponibilidade, bloqueio ou configuração de destino; o erro por si só não indica perda de dados no banco.
- Uma falha temporária não apaga mais as temporadas carregadas nem a seleção da temporada atual.
- Em falhas de rede, o aplicativo tenta recuperar a consulta com intervalos limitados; também tenta novamente ao voltar a ter conexão ou ao focar a janela.
- O aviso tem a ação **Tentar novamente**.
- Ao trocar de campanha, temporadas da campanha anterior são limpas para não serem exibidas no contexto errado.

## Se a falha persistir
1. Confirme a conexão com a internet e se o projeto Supabase está acessível.
2. Verifique se `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` correspondem ao projeto correto (no GitHub Actions os valores são lidos dos Secrets do repositório do código). Nunca envie a chave de serviço `service_role` ao aplicativo.
3. Abra DevTools na versão de desenvolvimento e veja a requisição que falhou na aba Network (DNS, TLS, CORS, 401, 5xx ou bloqueio de rede).
4. Corrija a causa de conexão: a tentativa automática não substitui um endpoint ou credencial incorreta.

Não exige SQL adicional. Testes locais: validação sintática TS/TSX e CSS, quatro testes do atualizador, versão do pacote. Compilação Electron completa não foi executada neste ambiente.
