# HäxBag V292 — Correção do login no aplicativo Electron

## Erro diagnosticado

O aplicativo Windows V291 pode incluir o `productName` `HäxBag` no cabeçalho HTTP `User-Agent`, com caracteres não ASCII. O erro de Auth reportado foi `invalid byte sequence for encoding "UTF8": 0xe4 0x78 0x42`, correspondendo a `äxB` em codificação de um byte. O login no navegador funciona e somente o aplicativo falha.

## Correção

- `desktop/main.cjs`: normaliza o User-Agent do Electron para ASCII imprimível antes da inicialização das janelas e requisições.
- Aplica o mesmo identificador à sessão de rede e ao `webContents` principal, antes de `loadURL`.
- Mantém intactos o título HäxBag, o ícone, as configurações visuais, o Supabase e os dados existentes.

## Como instalar

1. Extraia o ZIP de atualização na raiz de `haxbag`, substituindo `desktop/main.cjs`.
2. No Windows, execute `GERAR_HAXBAG_WINDOWS.bat` novamente para gerar o instalador ou portátil corrigido.
3. Feche a versão anterior e execute a nova. Tente entrar com a mesma conta.
4. Se ainda ocorrer erro, compare a mensagem de Auth do novo executável e compartilhe o novo log sem dados sensíveis.

Não precisa executar SQL, apagar usuários, limpar cookies ou remover políticas RLS.

Validação: sintaxe Node e testes de normalização do User-Agent. Integração real depende de teste no Windows/Supabase.
