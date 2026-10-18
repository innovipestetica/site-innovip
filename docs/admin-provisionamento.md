# Administrador único: provisionamento, MFA e substituição

O painel tem **um** administrador. Não há cadastro público nem endpoint de
bootstrap. A autorização é feita pelo UUID do usuário em
`private.admin_account` (no máximo uma linha), nunca por e-mail ou metadata.

## Provisionar o primeiro administrador

1. Dashboard → **Authentication → Users → Add user**.
   - Prefira **Send invitation** (o administrador define a própria senha pelo
     e-mail; requer SMTP configurado).
   - Alternativa: **Create new user** com **Auto Confirm User**, senha forte
     gerada no momento e entregue por canal seguro. Troque-a no primeiro acesso.
   - Não use senha padrão nem reaproveite senha de outro serviço.
2. Com `DATABASE_URL` em `.env.local`, vincule o usuário ao painel:

   ```bash
   npm run admin:provision -- --email admin@dominio-da-clinica.com.br
   ```

   O script só vincula um usuário que já existe e tem e-mail confirmado. Ele
   grava `admin.provisioned` em `private.audit_logs`.

   Sem a CLI, o equivalente no SQL Editor é:

   ```sql
   insert into private.admin_account (singleton, user_id)
   select 1, id from auth.users where lower(email) = lower('admin@dominio.com.br');
   ```

3. Acesse `/admin/login`. No primeiro login o painel mostra o QR code para
   configurar o aplicativo autenticador (TOTP). Sem o segundo fator, nenhuma
   página ou dado administrativo é liberado.

## Perda do celular / do fator TOTP

Não existe "pular MFA" no painel. Procedimento (feito por quem tem acesso ao
dashboard do Supabase):

1. Confirme a identidade do administrador por um canal fora do site.
2. Dashboard → **Authentication → Users** → usuário → remova o fator MFA
   (ou, via SQL: `delete from auth.mfa_factors where user_id = '<uuid>';`).
3. Encerre as sessões: `delete from auth.sessions where user_id = '<uuid>';`
4. O administrador entra de novo e cadastra um novo autenticador.
5. Registre a ocorrência (data, quem executou, motivo).

Prevenção: depois do primeiro acesso, cadastre o mesmo segredo TOTP em um
segundo dispositivo guardado em local seguro, ou use um gerenciador de senhas
com TOTP. Os *recovery codes* do Supabase Auth ainda são experimentais no SDK
e não foram habilitados.

## Substituir o administrador

1. Crie o novo usuário (passo 1 acima).
2. Execute:

   ```bash
   npm run admin:provision -- --email novo@dominio.com.br --replace
   ```

   O script troca o vínculo numa transação, encerra as sessões do anterior e
   grava `admin.replaced` na auditoria.
3. Opcional: desative ou exclua o usuário antigo em Authentication → Users.

## Recuperação de senha

`/admin/recuperar-senha` envia o link sempre com a mesma resposta (não revela
se o e-mail existe). O link volta para `/auth/confirm` e só permite trocar a
senha **depois** de passar pelo MFA.
