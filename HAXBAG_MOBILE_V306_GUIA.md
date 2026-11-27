# HäxBag Mobile V306 — Base Android com Capacitor

Esta atualização mantém o **site** (React/Vite), o **aplicativo Windows** (Electron) e introduz um **projeto mobile separado** em `mobile/`. O mesmo Supabase e as mesmas contas são utilizados.

## O que esta versão já traz

- Configuração Capacitor 8 independente do Electron, na pasta `mobile/`.
- Scripts que criam e sincronizam `mobile/android/` quando executados em um computador com acesso ao npm.
- Ícones nativos derivados do símbolo oficial do HäxBag (não utilizam a arte genérica do Capacitor).
- Navegação inferior nativa com Social, RPG, Conversas, Arcade e Menu, sem alterar a versão web.
- Suporte a áreas seguras (recorte da tela e barra inferior), inputs para toque e rolagem mobile.
- Links de convite gerados a partir do endereço público HTTPS, não de `https://localhost` dentro do aplicativo.
- Links de recuperação de senha enviados para o site público, quando configurado.
- Workflow manual GitHub Actions para criar um APK **de testes** (não é uma release na Play Store).

## Instalação local (Windows)

**Pré-requisitos**: Node.js 22+, Android Studio compatível com Capacitor 8, Android SDK e Java 21 (Android Studio pode oferecer o JDK necessário). Tenha o `.env.local` com:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_HAXBAG_PUBLIC_URL=https://SEU-SITE-PUBLICADO
```

Não coloque `service_role` nem outras credenciais de servidor no Vite ou no aplicativo.

Você também pode executar `GERAR_HAXBAG_ANDROID.bat` (gera o APK debug quando Android Studio/SDK e `.env.local` estiverem configurados). Ou execute manualmente na **raiz do projeto**:

```powershell
npm install
npm run mobile:deps
npm run mobile:check
npm run build
npm run mobile:android:sync
npm run mobile:android:open
```

No Android Studio, conecte um Android com depuração USB ativada ou crie um emulador e execute o aplicativo.

Para gerar um APK de teste:

```powershell
npm run mobile:apk
```

O arquivo será gerado em `mobile/output/HaxBag-0.306.0-android-debug.apk`, se Gradle/SDK estiverem corretamente instalados. O APK **não está incluído** neste pacote porque a compilação nativa requer dependências e o Android SDK.

Em cada alteração da interface, rode `npm run build` e depois `npm run mobile:android:sync` para copiar os arquivos atualizados ao Android. Após `npm run mobile:deps`, o npm cria o lockfile dentro de `mobile/`; é recomendável adicionar esse lockfile ao Git para builds reproduzíveis.

## Gerar APK no GitHub sem Android Studio

O projeto inclui `.github/workflows/mobile-android-debug.yml`, executado manualmente pelo GitHub Actions:

1. Envie os arquivos ao repositório do código-fonte (não ao repositório de releases do Electron).
2. Confirme os secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Defina `VITE_HAXBAG_PUBLIC_URL` em **Settings → Secrets and variables → Actions → Variables** como o HTTPS do site publicado, para convites e recuperação.
3. Vá em **Actions → HäxBag Mobile — APK de teste (Android) → Run workflow**.
4. Ao terminar, abra a execução e baixe **HaxBag-Mobile-Android-Debug** na seção *Artifacts*. Extraia o ZIP para instalar o `.apk` no Android.

O workflow não publica versões automaticamente nem precisa de token de release. Não publique APK debug na Play Store. Para a Play Store, será necessário configurar assinatura de release, versão do Android, política de privacidade e AAB.

## Autenticação, permissões e segurança

O login por e-mail/senha reutiliza o Supabase existente. O app mobile usa a mesma configuração **pública** do site, porém o WebView possui seu próprio armazenamento de sessão; será necessário entrar pelo menos uma vez no celular.

A autenticação com link por e-mail e a recuperação de senha devem continuar no **site HTTPS publicado** nesta primeira etapa. No painel do Supabase, mantenha o domínio público entre os URLs permitidos para redirecionamento. Não adicione `https://localhost` à lista de redirecionamentos de produção apenas para o aplicativo.

O projeto Android solicita permissões de **microfone e câmera** no manifest como preparação. Isso **não significa** que chamadas em segundo plano, captura de tela, notificações push ou chamadas VoIP nativas estejam prontas; elas requerem testes e integrações móveis específicas. Permissões de câmera/microfone devem ser solicitadas somente quando usadas.

## Escopo atual e próximo passo

V306 é a **base Android com navegação touch**. A interface React/Vite e o Supabase foram reaproveitados. Ainda é preciso testar no dispositivo real: formulários longos, Mesa de Investigação, fichas, voz WebRTC, anexos, upload de imagens e teclado virtual. Em especial, compartilhamento de tela móvel e notificações push ficam para V307/V308; não estão prometidos como funcionais nesta base.

O identificador `com.haxbag.mobile` em `mobile/capacitor.config.ts` é provisório; defina o ID definitivo antes de qualquer publicação na Play Store. O projeto iOS poderá ser adicionado no futuro em um Mac.

**Nenhum SQL novo é exigido** pelo Capacitor; o aplicativo usa o banco existente.
