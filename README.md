# Innovip — site e painel

Site comercial da Innovip Clínica de Estética, com CMS e painel `/admin` para um
único administrador. Especificação: *Innovip — Especificação técnica v1.0 (18/10/2026)*.

Arquitetura: **Domínio/DNS (Locaweb) → Vercel → Next.js → Supabase**.

## Status

| Etapa | Situação |
|---|---|
| 1. Fundação e segurança | **Concluída (18/10/2026).** Migração aplicada no projeto `nkrqpebfolrbybhaovqy`; testes unitários, E2E e de RLS (banco real, papéis reais) passando; administrador provisionado e login com MFA (TOTP, `aal2`) verificado ponta a ponta |
| 2. Banco e CMS | pendente |
| 3. Páginas públicas | pendente |
| 4. Leads e promoções | pendente |
| 5. Integrações (consentimento, GTM/GA4, Meta) | pendente |
| 6. Testes finais e deploy | pendente |

### O que a etapa 1 entrega

- Next.js (App Router, Cache Components) com TypeScript estrito, Tailwind e tokens de design provisórios a partir da logo.
- Clientes Supabase separados: navegador (`client.ts`), servidor com a sessão (`server.ts`) e privilegiado (`privileged.ts`, só servidor).
- Migração `20261018120000_foundation.sql`: schema `private`, `admin_account` singleton, `is_admin()` exigindo MFA (`aal2`), auditoria e grants mínimos por padrão.
- Login do administrador, MFA TOTP (inscrição por QR code e verificação), recuperação de senha sem enumeração, logout no servidor.
- Autorização reavaliada em cada página/ação (`requireAdmin`/`assertAdmin`) e no banco; o proxy faz só checagem otimista e renovação de sessão.
- Cabeçalhos de segurança (CSP, frame, nosniff, referrer, HSTS em produção), `/admin` e `/auth` com `no-store` e `noindex`, robots bloqueado até o lançamento.

## Versões

| Pacote | Versão |
|---|---|
| Node.js | 22.14 (mínimo 22.12) |
| Next.js | 16.4.2 |
| React | 19.3.0 |
| TypeScript | 5.9.3 |
| Tailwind CSS | 4.3.3 |
| @supabase/supabase-js | 2.118.0 |
| @supabase/ssr | 0.12.7 |
| Supabase CLI | 2.121.0 |
| Zod | 4.3.3 |
| Vitest | 5.0.5 |
| Playwright | 1.64.1 |

Todas as dependências estão fixadas em versão exata no `package.json`, com `package-lock.json`.

## Primeiros passos

```bash
npm install
cp .env.example .env.local   # preencha (ver docs/configuracao-supabase.md)
npm run dev
```

Depois: aplicar a migração, provisionar o administrador e configurar o Auth.
Veja [docs/configuracao-supabase.md](docs/configuracao-supabase.md) e
[docs/admin-provisionamento.md](docs/admin-provisionamento.md).

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm start` | build e servidor de produção |
| `npm run typecheck` | gera os tipos de rota e roda `tsc` |
| `npm run lint` | ESLint |
| `npm test` | testes unitários |
| `npm run test:db` | testes de RLS/grants com papéis reais (`DATABASE_URL`, rollback) |
| `npm run test:e2e` | E2E contra o build (`PW_CHANNEL=msedge` usa o Edge instalado) |
| `npm run check` | typecheck + lint + unitários |
| `npm run db:push` | aplica migrações no projeto vinculado |
| `npm run db:types` | regenera `src/lib/supabase/database.types.ts` |
| `npm run admin:provision -- --email X` | vincula o administrador único |

## Estrutura

```
src/app/(public)        páginas públicas
src/app/admin           login, MFA, recuperação e painel (admin/(painel))
src/app/auth/confirm    retorno dos e-mails do Supabase Auth
src/app/api             endpoints (etapa 4+)
src/components          interface (ui, brand, admin)
src/lib/supabase        clientes navegador / servidor / privilegiado / proxy
src/lib/auth            camada de acesso do administrador
src/lib/env             variáveis públicas e de servidor (validadas com Zod)
src/lib/security        redirecionamento seguro etc.
src/lib/validation      regras compartilhadas cliente/servidor
src/proxy.ts            renovação de sessão em /admin e /auth
supabase/migrations     esquema, funções, grants e políticas
scripts                 operações administrativas locais
tests/unit|db|e2e       testes
docs                    operação
```

## Variáveis de ambiente

Ver [.env.example](.env.example).

- `NEXT_PUBLIC_*` são embutidas no bundle **no build**: mudar exige novo deploy. Nunca contêm segredo.
- As demais são lidas **em runtime** no servidor (`src/lib/env/server.ts`, protegido por `server-only`).
- `DATABASE_URL` é só para scripts e testes locais; não configurar na Vercel.

## Decisões e limitações conhecidas

- **CSP sem nonce.** Nonce obriga renderização dinâmica em todas as páginas e é incompatível com o *static shell* do Cache Components. Por isso `script-src` tem `'unsafe-inline'` (scripts de hidratação do Next). Mitigação: o React escapa a saída, o CMS não aceita HTML/JS e as demais diretivas restringem origens. `'unsafe-eval'` só em desenvolvimento. Evolução possível: SRI experimental do Next.
- **Login pelo navegador.** `signInWithPassword` e o MFA rodam no navegador para que os limites por IP do Supabase valham para o IP real. O servidor revalida tudo com `getClaims()` e o banco.
- **Recuperação do MFA** é manual e documentada; os *recovery codes* do Supabase ainda são experimentais.
- **Tipos do banco** foram escritos à mão na etapa 1. Regenerar com `npm run db:types` depois de vincular a CLI.
- **`npm audit`** acusa `braces` (DoS por padrão aninhado) via `eslint-config-next`, uma dependência só de desenvolvimento. Não vai para o bundle; acompanhar a correção upstream. O `npm audit fix --force` sugerido rebaixaria o eslint-config-next para a versão 14 e não deve ser usado.
