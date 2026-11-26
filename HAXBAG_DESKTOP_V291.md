# HäxBag V291 — App Windows (Electron)

## O que foi adicionado

- Aplicativo Windows com janela própria, logo e ícone, menu nativo oculto e instância única.
- Os arquivos da interface são incluídos no aplicativo; não é apenas uma janela que abre o site.
- O projeto web React/Vite/Supabase continua funcionando e usando o mesmo banco.
- Sessão de login persistida localmente no aplicativo (origem `haxbag://app`), independente da sessão do navegador.
- Chamadas de voz WebRTC e tela compartilhada via seletor explícito de telas/janelas, com sandbox e permissões restritas à interface local.
- Links externos abrem o navegador padrão; não há Node.js disponível ao React.
- Scripts para instalar dependências e produzir instalador NSIS `.exe` e versão portátil `.exe` no Windows x64.

## Início rápido (Windows)

1. Instale **Node.js 22 LTS**.
2. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` com os valores **públicos** já usados no seu site.
3. Opcional, mas recomendado: defina `VITE_HAXBAG_PUBLIC_URL` para o HTTPS do site. Isso garante links compartilháveis de campanhas, comunidades e convites.
4. Execute `TESTAR_HAXBAG_DESKTOP.bat` para testar com Vite, ou `GERAR_HAXBAG_WINDOWS.bat` para criar os executáveis.
5. O instalador e o executável portátil surgirão em `dist-desktop/`.

### Linha de comando alternativa

```powershell
npm install
npm run desktop:dev
npm run desktop:installer
npm run desktop:portable
```

- `npm run desktop:unpacked`: gera uma pasta com o aplicativo, sem criar instalador.
- `npm run build`: compila somente o site original.

## Segurança, autenticação e dados

- **Não inclua `service_role`, senhas ou chaves secretas** em variáveis VITE. As variáveis VITE são compiladas no JavaScript e ficam visíveis ao cliente. Use apenas chave `anon`/`publishable` com RLS no Supabase.
- O `.env.local` permanece na sua máquina e não foi incluído nos ZIPs fornecidos. Porém, os valores `VITE_*` usados durante a compilação do site ficam no executável, o que é normal para chaves públicas.
- O login por e-mail/senha continua. Links de confirmação/recuperação por e-mail abrem o website público configurado no Supabase; não são interceptados automaticamente pelo aplicativo.
- O usuário precisa permitir microfone no Windows/navegador e escolher uma janela/tela para transmissão; não há captura automática.
- O sistema de Comunicação mantém os SQLs V284/V286/V288/V289 já instalados. **Nenhum SQL novo para desktop.**
- A interface empacotada pode abrir sem internet, mas login, chat, fichas, campanhas, voz e sincronização continuam exigindo conexão com o Supabase.
- A versão usa Electron com isolamento de contexto, sandbox, sem integração Node no React e acesso a links externos apenas via navegador padrão.

## Notas para distribuição

- O `.exe` gerado localmente **não é assinado digitalmente**. O Windows SmartScreen pode exibir um aviso até que o projeto use certificado de assinatura.
- Cada novo release do site que precisar atualizar a versão desktop exige recompilar o aplicativo e distribuir outro instalador. Atualizações automáticas não estão habilitadas nesta versão.
- A chamada de voz e a transmissão entre duas contas ainda precisam ser testadas no aplicativo real. Algumas redes exigem TURN já configurado no HäxBag.
- O instalador só pode ser gerado quando Electron, electron-builder e as dependências estão instalados em um computador com internet. Os artefatos disponibilizados aqui são código-fonte pronto para compilação, **não o `.exe` já compilado**.
- `package-lock.json` é atualizado por `npm install`, pois o projeto original não tinha as dependências Electron no lockfile. Use `npm install` na primeira vez, não `npm ci`.

## Principais arquivos

- `desktop/main.cjs` — janela Electron, protocolo local seguro, permissões, seletor de captura.
- `desktop/preload.cjs` — ponte somente leitura de ambiente (sem APIs privilegiadas).
- `desktop/screen-picker.*` — janela para escolha explícita da tela/janela a transmitir.
- `desktop/dev.cjs` — inicialização conjunta Vite + Electron.
- `src/desktopPublicLinks.ts` — convites apontam para o site HTTPS, nunca para `haxbag://`.
- `build/haxbag.ico` — ícone Windows.
- `GERAR_HAXBAG_WINDOWS.bat`, `TESTAR_HAXBAG_DESKTOP.bat` — scripts Windows.
