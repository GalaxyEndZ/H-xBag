# HäxBag V212 — mensagem de entrada inclusiva

A V211 usava "Que bom ter você de volta." na aba Entrar, mesmo para pessoas que nunca haviam acessado o site.

Na V212, a tela de login usa a saudação neutra "O portal está aberto." e explica que é possível entrar com uma conta existente **ou criar uma nova**. O rótulo também passou a ser "SEU ACESSO AO HÄXBAG".

As telas de Criar conta e Recuperar acesso continuam com mensagens próprias. Nenhuma rotina de autenticação ou estilo visual foi alterado.

## Aplicação da correção

Copie `src/Auth.tsx` para a mesma pasta do seu projeto, preservando `.git` e `.env`. Não é necessário SQL. Execute `npm run build` no seu ambiente.
