# Deploy: Vercel, Supabase e domínio (Locaweb)

Arquitetura: **Domínio/DNS (Locaweb) → Vercel → Next.js → Supabase**. A
Locaweb continua com domínio, DNS e e-mails; o site **não** vai para a
hospedagem compartilhada.

## 1. Plano da Vercel

A Vercel restringe o plano **Hobby** a uso pessoal/não comercial. Para o site
da clínica no ar, use um plano compatível com uso comercial (ex.: **Pro**).
Confirme preço e limites na contratação (não use valores antigos como
orçamento). Testes internos podem rodar no Hobby, mas o lançamento depende do
plano correto.

## 2. Ambientes

| Ambiente | Vercel | Supabase | Rastreamento |
|---|---|---|---|
| Desenvolvimento | `npm run dev` local | projeto de desenvolvimento | desligado |
| Staging | Preview (protegido) | projeto separado recomendado | desligado (automático) |
| Produção | Production | projeto de produção | conforme `TRACKING_ENABLED` |

O projeto Supabase atual (`nkrqpebfolrbybhaovqy`) é usado como
desenvolvimento/staging. **Recomendado:** projeto Supabase separado para
produção (aplicar migrações com `npm run db:migrate` apontando para ele,
provisionar administradores e configurar Auth). Nunca copie dados de
demonstração para produção.

## 3. Criar o projeto na Vercel

1. *Add New → Project → Import* `innovipestetica/site-innovip`.
2. Framework: Next.js (detectado). Build: `npm run build`. Node: 22.x.
3. **Environment Variables** (Production; para Preview use valores de
   staging):

| Variável | Valor | Tipo |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://<domínio confirmado>` (ou a URL `.vercel.app` até ligar o domínio) | público |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<projeto>.supabase.co` | público |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` | público |
| `SUPABASE_SECRET_KEY` | `sb_secret_...` | **secreto** (marcar *Sensitive*) |
| `REVALIDATE_SECRET` | 32+ caracteres aleatórios | **secreto** |
| `SITE_INDEXING_ENABLED` | `false` até o lançamento | — |
| `TRACKING_ENABLED` | `false` até configurar GTM | — |
| `NEXT_PUBLIC_GTM_ID` | vazio até configurar | público |

`DATABASE_URL` **não** vai para a Vercel (só scripts locais).

4. **Deployment Protection**: ative *Vercel Authentication* para Previews
   (staging não fica público).
5. Deploy e smoke test (seção 6).

## 4. Supabase Auth para o domínio

Em *Authentication → URL Configuration*:

- **Site URL**: `https://<domínio confirmado>`.
- **Redirect URLs** (exatas, sem curingas amplos):
  - `https://<domínio confirmado>/auth/confirm`
  - `https://www.<domínio>/auth/confirm` (se o www for usado)
  - `https://<projeto>.vercel.app/auth/confirm` (só enquanto necessário)
- **SMTP próprio** configurado (recuperação de senha).

## 5. Domínio na Locaweb (sem quebrar e-mails)

> `innovip.com.br` é exemplo até a propriedade ser confirmada.

1. **Antes de mexer**, exporte/anote **toda** a zona DNS atual na Locaweb
   (especialmente `MX`, `SPF` (TXT), `DKIM`, `DMARC`, `autodiscover`, etc.).
2. Na Vercel: *Project → Settings → Domains → Add* `<domínio>` e
   `www.<domínio>`. Defina qual é o canônico (ex.: raiz) e o outro como
   redirecionamento 308.
3. Copie **exatamente** os registros que a Vercel mostrar (normalmente um
   `A` para a raiz e um `CNAME` para o `www`; os valores vêm do painel da
   Vercel — não use valores de memória).
4. Na Locaweb, edite **somente** esses registros. **Não troque os
   nameservers** e **não apague** `MX`/`SPF`/`DKIM`/`DMARC`.
5. Aguarde a verificação e o HTTPS automático na Vercel.
6. Ajuste `NEXT_PUBLIC_SITE_URL` para o domínio final e faça novo deploy.
7. Teste: `https://<domínio>`, `https://www.<domínio>` (redireciona),
   `http://` (vai para https), e envio/recebimento de e-mail da clínica.

## 6. Smoke test após cada deploy

- [ ] `/` abre; sem rolagem horizontal no celular.
- [ ] `/admin` redireciona para o login; login com MFA funciona.
- [ ] Publicar uma alteração simples aparece no site em até 1 minuto.
- [ ] `/agendar-avaliacao` leva ao destino configurado (ou 404 sem destino).
- [ ] `robots.txt` bloqueia tudo antes do lançamento.
- [ ] Cabeçalhos: `content-security-policy`, `x-frame-options: DENY`,
      `strict-transport-security`.
- [ ] Previews exigem login da Vercel.

## 7. Rollback

- *Deployments → (deploy anterior) → Promote to Production* desfaz o código.
- **Não desfaz o banco.** As migrações são expansivas (compatíveis com a
  versão anterior); para reverter dados, use o backup (docs/backup-restauracao.md).
