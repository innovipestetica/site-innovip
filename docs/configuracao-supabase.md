# Configuração do Supabase

Projeto atual: `nkrqpebfolrbybhaovqy`. Ele é tratado como **desenvolvimento/staging**.
Para produção, crie um projeto separado e repita este roteiro.

O arquivo `supabase/config.toml` registra a configuração desejada. Ele vale para
o Supabase local. No projeto hospedado, aplique pelo dashboard (abaixo) ou com
`npx supabase config push` depois de revisar o diff que a CLI mostra.

## 1. Chaves e `.env.local`

Dashboard → **Project Settings → API Keys**:

| Variável | Onde achar | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) | pública, depende do RLS |
| `SUPABASE_SECRET_KEY` | Secret key (`sb_secret_...`) | **ignora RLS**, só servidor |
| `DATABASE_URL` | botão **Connect** → *Session pooler* | só scripts/testes locais |

Copie `.env.example` para `.env.local` e preencha. `.env.local` está no `.gitignore`.

Na `DATABASE_URL`, substitua `[YOUR-PASSWORD]` **inclusive os colchetes**
pela senha do banco. Se a senha tiver `@ # / ? % :`, codifique esses
caracteres (ex.: `@` → `%40`) ou gere uma senha só com letras e números.

## 2. Aplicar as migrações

Opção A — script do projeto (usa `DATABASE_URL`, sem Docker nem login na CLI):

```bash
npm run db:migrate -- --dry-run
```

```bash
npm run db:migrate
```

O ensaio roda tudo e desfaz (ROLLBACK). O controle fica em
`supabase_migrations.schema_migrations`, a mesma tabela da CLI.

Opção B — CLI:

```bash
npx supabase login
npx supabase link --project-ref nkrqpebfolrbybhaovqy
npx supabase db push
npm run db:types
```

Opção C — SQL Editor do dashboard: cole e execute cada arquivo de
`supabase/migrations/` em ordem. Depois rode `npm run db:types` com a CLI
vinculada (ou mantenha o arquivo de tipos atualizado à mão).

Depois de aplicar, rode `npm run test:db` (usa `DATABASE_URL`; cada teste roda
em transação com ROLLBACK).

## 3. Authentication → Sign In / Providers

- **Allow new users to sign up**: **desligado**.
- **Allow anonymous sign-ins**: **desligado**.
- **Email**: ligado. **Confirm email**: ligado.
- **Secure password change**: ligado.
- **Minimum password length**: 12. **Leaked password protection**: ligar se o plano permitir.
- Demais provedores (Google, etc.): desligados.

## 4. Authentication → Multi-Factor

- **TOTP (App Authenticator)**: enroll e verify **habilitados**.
- O painel exige `aal2` em todas as páginas protegidas e o banco exige `aal2`
  em `private.is_admin()`.

## 5. Authentication → URL Configuration

- **Site URL**: a URL do ambiente (dev: `http://localhost:3000`; produção: o domínio confirmado).
- **Redirect URLs**: somente URLs exatas de retorno, por ambiente, por exemplo:
  - `http://localhost:3000/auth/confirm`
  - `https://<preview-protegido>.vercel.app/auth/confirm` (staging, se usado)
  - `https://<dominio-confirmado>/auth/confirm` (produção)
- O app envia exatamente `<origem>/auth/confirm`, sem query string. Uma
  entrada só com o domínio (`https://dominio.com.br`) **não** cobre esse
  caminho: o Supabase cairia na Site URL e o link de recuperação quebraria.
- Não usar curingas amplos (`https://*.vercel.app/**`) em produção.

Estado atual (18/10/2026): Site URL `http://localhost:3000`; Redirect URLs
`http://localhost:3000/auth/confirm` e `https://innovip.com.br`. A segunda
precisa virar `https://innovip.com.br/auth/confirm` (e `www`, se for o
canônico) antes do lançamento.

## 6. SMTP (obrigatório antes de produção)

O SMTP padrão do Supabase só envia para membros da equipe do projeto e tem
limite baixo. Configure **Authentication → Emails → SMTP Settings** com o
provedor da clínica (pode ser o e-mail da Locaweb ou um serviço transacional),
remetente do domínio e SPF/DKIM válidos. Revise os templates em português.

## 7. Rate limits (Authentication → Rate Limits)

O login e o MFA são chamados direto do navegador, então os limites por IP do
Supabase valem para o IP real do visitante. Mantenha os padrões ou reduza
*sign-in* e *token verifications*. O limite de envio de e-mail só é
configurável com SMTP próprio.

## 8. API

- **Exposed schemas**: apenas `public` (e `graphql_public` se usado). O schema
  `private` **não** deve ser exposto.
- Tabelas novas no `public` nascem sem grants para `anon`/`authenticated`
  (migração da etapa 1). Cada tabela precisa de GRANT e políticas explícitas.
