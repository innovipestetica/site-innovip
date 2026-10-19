# Relatório de testes — 18/10/2026

Ambiente: Windows 11, Node 22.14, Next.js 16.4.2, Supabase (projeto
`nkrqpebfolrbybhaovqy`, usado como desenvolvimento/staging), Playwright 1.64
com Microsoft Edge (perfis desktop e Pixel 7), Vercel (Hobby, deploy de teste
interno em `https://site-innovip.vercel.app`).

## Comandos e resultados

| Comando | O que cobre | Resultado |
|---|---|---|
| `npm run typecheck` | Tipos (TypeScript estrito) | sem erros |
| `npm run lint` | ESLint (Next, React, hooks) | sem erros |
| `npm test` | 78 testes unitários: links seguros, texto rico, blocos x banco, validação por tipo, datas America/Sao_Paulo, centavos, processamento de imagem (EXIF/GPS removido, SVG/HTML/executável recusados), consentimento, Consent Mode, JSON-LD seguro, destino do agendamento | 78/78 |
| `npm run test:db` | 31 testes de banco com papéis reais (anon, autenticado, admin sem/com MFA, service_role), em transação com ROLLBACK | 31/31 |
| `npm run test:e2e` (local, build de produção) | Cabeçalhos, redirecionamentos, 404 reais, login/recuperação sem enumeração, open redirect, formulários sem dados na URL, site público com demonstração, sitemap/robots, acessibilidade (axe), consentimento (build com rastreamento ligado) | 64 passaram (build com rastreamento), 0 falhas |
| `E2E_BASE_URL=https://site-innovip.vercel.app npm run test:e2e` | Mesma suíte contra o deploy | 78 passaram; 1 instável corrigido (ids repetidos durante o streaming do catálogo); pulados: consentimento (rastreamento desligado em produção) e testes que dependem de destino de agendamento |
| `npm run backup:export` + `backup:verify` | Backup lógico e restauração isolada | 86 linhas/16 tabelas e 28 arquivos íntegros; arquivo adulterado detectado |

## Cenários exigidos pela especificação (seção 23)

| Cenário | Evidência |
|---|---|
| Páginas e formulários em celular, desktop e teclado | E2E nos dois perfis; menu móvel com aria-expanded/Escape/foco; axe sem violações; verificação visual em 375 e 1440 px |
| Admin edita Home, cria tratamento, publica promoção/landing sem código | Funções do banco testadas (`cms.test.ts`); **fluxo na interface logada: verificação manual pendente** (login com MFA não é automatizável) |
| Rascunho não altera o publicado nem vaza para anônimo | `cms.test.ts` |
| Publicar/despublicar atualiza páginas e sitemap | `updateTag` nas ações; sitemap testado; demonstração publicada refletida no site |
| Oferta expira com cache e sem cron | Vigência calculada na requisição; E2E "oferta encerrada" e listagem só com vigentes |
| Mídia privada não recuperável por URL pública | Políticas do Storage testadas; originais só no bucket privado; aprovação copia só variantes |
| Anônimo/autenticado comum sem acesso a rascunhos, uploads e APIs administrativas | `cms.test.ts`, `foundation.test.ts`, E2E de rotas do admin |
| RLS/grants com papéis reais | Todos os testes de banco usam `set role` + claims JWT |
| MFA, sessão expirada, recuperação, logout | Login com MFA verificado manualmente em 18/10/2026 (TOTP, `aal2`); recuperação sem enumeração (E2E); **sessão expirada e logout: verificação manual pendente** |
| Reenvio idempotente de lead / erro de banco sem sucesso | **Fora do escopo**: agendamento externo, sem formulário de leads |
| Clique no WhatsApp não é agendamento | `whatsapp_click` é evento de interação (docs/eventos.md) |
| Recusa bloqueia tags; revogação interrompe envios | E2E de consentimento (sem GTM antes/depois de rejeitar; revogação apaga cookies e recarrega) |
| Navegação no cliente não duplica eventos | E2E "um page_view por página" |
| Pixel/CAPI com `event_id` compartilhado; outbox | **Fora do escopo** (sem conversão persistida no site); Pixel via GTM após revisão |
| Nada pessoal em URL, logs, analytics ou bundle | E2E de dataLayer sem query/e-mail; logs só com códigos; segredos só no servidor (`server-only`) |
| Canonical, sitemap, redirecionamentos, noindex, 404 | E2E e smoke test no deploy |
| Build, lint e tipos | Ver tabela acima; build local e na Vercel |
| Restauração de banco e mídia | `backup:verify` |

## Pendências (dependem de pessoa/credencial)

- Teste manual do painel logado: criar/editar/publicar cada tipo, mídia
  (upload real), conflito entre duas abas, histórico/restauração, logout,
  sessão expirada, perda de fator (procedimento).
- Teste com leitor de tela (NVDA/TalkBack) e `prefers-reduced-motion`.
- Medição: validação no DebugView/Tag Assistant com o GTM real.
- Desempenho: Core Web Vitals reais só após tráfego; até lá, apenas
  laboratório (não há afirmação de resultado real).
- SMTP próprio para recuperação de senha.
