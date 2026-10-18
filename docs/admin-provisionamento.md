# Administradores: provisionamento, MFA e remoção

A especificação previa um administrador único. Por decisão da clínica em
18/10/2026, **duas pessoas** acessam o painel (migração
`20261018200000_multiple_admins.sql`). Regras que continuam valendo:

- Não há cadastro público nem endpoint de bootstrap.
- A autorização é feita pelo UUID do usuário em `private.admin_accounts`,
  nunca por e-mail ou metadata. Nenhum papel da aplicação lê ou altera essa
  tabela; só o dono do banco.
- Cada administrador tem login e MFA (TOTP) próprios; sem `aal2`, nada do
  painel é liberado.
- A auditoria (`private.audit_logs`) registra o autor de cada ação.
- Teto de segurança: no máximo 5 administradores (trigger no banco).

Administradores atuais: `gustavoro1809@gmail.com` e `ericdacostacruz@gmail.com`.
Para conferir a qualquer momento:

```bash
npm run admin:provision -- --list
```

## Adicionar um administrador

1. Dashboard → **Authentication → Users → Add user → Create new user**.
   - Senha forte (mínimo 12 caracteres), definida pela própria pessoa ou
     entregue por canal seguro e trocada no primeiro acesso.
   - Marque **Auto Confirm User**.
   - Não use senha padrão nem reaproveite senha de outro serviço.
   - *Send invitation* só depois de configurar SMTP próprio.
2. Com `DATABASE_URL` em `.env.local`:

   ```bash
   npm run admin:provision -- --email pessoa@dominio.com.br
   ```

   O script só vincula um usuário que já existe e tem e-mail confirmado, e
   grava `admin.provisioned` na auditoria.
3. A pessoa acessa `/admin/login`. No primeiro login o painel mostra o QR code
   para configurar o aplicativo autenticador.

## Remover um administrador

```bash
npm run admin:provision -- --email pessoa@dominio.com.br --remove
```

Remove o vínculo, encerra as sessões abertas da pessoa e grava
`admin.removed` na auditoria. O script não deixa remover o último
administrador. Depois, se a conta não tiver outro uso, desative ou exclua o
usuário em Authentication → Users.

## Perda do celular / do fator TOTP

Não existe "pular MFA" no painel. Procedimento (feito por quem tem acesso ao
dashboard do Supabase):

1. Confirme a identidade da pessoa por um canal fora do site.
2. Dashboard → **Authentication → Users** → usuário → remova o fator MFA
   (ou, via SQL: `delete from auth.mfa_factors where user_id = '<uuid>';`).
3. Encerre as sessões: `delete from auth.sessions where user_id = '<uuid>';`
4. A pessoa entra de novo e cadastra um novo autenticador.
5. Registre a ocorrência (data, quem executou, motivo).

Com dois administradores, o outro continua conseguindo operar o painel
enquanto isso. Prevenção: cadastre o mesmo segredo TOTP em um segundo
dispositivo ou num gerenciador de senhas com TOTP. Os *recovery codes* do
Supabase Auth ainda são experimentais no SDK e não foram habilitados.

## Recuperação de senha

`/admin/recuperar-senha` envia o link sempre com a mesma resposta (não revela
se o e-mail existe). O link volta para `/auth/confirm` e só permite trocar a
senha **depois** de passar pelo MFA.
