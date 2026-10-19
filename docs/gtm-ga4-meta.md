# GTM, GA4 e Meta — configuração

O site carrega **um único container GTM web**, dono das tags de GA4 e do
Pixel da Meta. Não instale GA4 ou Pixel diretamente no código em paralelo.

## 1. Ligar o rastreamento

Variáveis (Vercel → Project → Settings → Environment Variables, **somente
Production**):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_GTM_ID` | `GTM-XXXXXXX` do container de produção |
| `TRACKING_ENABLED` | `true` |

O rastreamento fica desligado automaticamente em previews/desenvolvimento
(`VERCEL_ENV` diferente de `production`), no `/admin`, no login e na prévia.
Elas são lidas no build **e** na execução (páginas regeradas pelo cache):
cadastre-as no ambiente da Vercel (que vale para os dois) e **faça um novo
deploy** após mudar.

Para depurar com o Tag Assistant, adicione temporariamente
`TRACKING_DEBUG=true` (libera as origens do Tag Assistant na CSP) e remova
depois.

## 2. Container GTM

### Consentimento

- Em *Admin → Configurações do contêiner*, ative a **visão geral de
  consentimento**.
- O site já envia `consent default` (tudo negado) e `consent update` com as
  escolhas reais **antes** de qualquer tag. Não crie tags de CMP de terceiros.
- Tags do GA4: consentimento adicional exigido = `analytics_storage`.
- Tags da Meta: consentimento adicional exigido = `ad_storage`.

### Variáveis (Camada de dados)

`page_type`, `page_sensitive`, `page_location`, `page_path`, `page_title`,
`content_type`, `cta_type`, `cta_target`, `cta_location`, `event_id`.

**Não crie "Variáveis JavaScript personalizadas"** nem tags HTML com código
avaliado: a CSP do site não libera `unsafe-eval`.

### Acionadores

| Acionador | Tipo |
|---|---|
| `ev - page_view` | Evento personalizado `page_view` |
| `ev - view_content` | Evento personalizado `view_content` |
| `ev - cta_click` | Evento personalizado `cta_click` |
| `ev - whatsapp_click` | Evento personalizado `whatsapp_click` |
| `ev - page_view (não sensível)` | `page_view` **e** `page_sensitive` igual a `false` |
| `ev - whatsapp_click (não sensível)` | `whatsapp_click` **e** `page_sensitive` igual a `false` |

### Tags GA4

1. **Tag do Google** com o ID `G-XXXXXXX`:
   - parâmetro de configuração `send_page_view` = `false` (o site envia
     `page_view` manualmente; evita duplicar em navegações do Next.js);
   - acionador: *Initialization – All Pages*.
2. **Evento GA4 `page_view`** — acionador `ev - page_view`, parâmetros
   `page_location`, `page_title`, `page_type`.
3. **Eventos GA4** `view_content`, `cta_click`, `whatsapp_click` com os
   parâmetros correspondentes (ver `docs/eventos.md`).

No GA4 (propriedade):

- **Desative a medição otimizada** de *formulários* e *pesquisa no site*
  (podem capturar texto ou parâmetros de URL). Mantenha só o necessário.
- **Não ative Google Signals** nem vincule ao Google Ads até a revisão de
  elegibilidade (dados de saúde/bem-estar).
- `whatsapp_click` **não** deve ser marcado como evento-chave de lead
  (é clique, não agendamento). Se quiser acompanhar, crie um evento-chave
  separado com nome claro, ex.: "Clique para atendimento".
- Validar no **DebugView** com o consentimento de analytics aceito.

## 3. Meta Pixel (desligado até revisão)

1. No Events Manager, revise a elegibilidade da fonte e dos eventos para
   clínica de estética (restrições de saúde/bem-estar). **Consentimento não
   autoriza enviar dados proibidos.**
2. Se aprovado, no GTM crie a tag do Pixel (modelo da galeria da comunidade
   ou tag da Meta) com:
   - consentimento adicional exigido: `ad_storage`;
   - acionador **somente** `ev - page_view (não sensível)` /
     `ev - whatsapp_click (não sensível)`;
   - **desative** a correspondência automática avançada e a coleta automática
     de eventos/cliques (podem capturar texto e dados).
3. Validar no *Test Events* e retirar códigos de teste.

### Conversions API (CAPI)

**Não implementada, por decisão de escopo**: a especificação exige que
conversões enviadas pelo servidor sejam vinculadas a uma ação persistida no
site (ex.: lead gravado). Como o agendamento é externo (WhatsApp/link), o
site não tem esse tipo de ação; enviar cliques como conversão seria
"conversão arbitrária do cliente", o que a especificação proíbe. Se a clínica
voltar a ter formulário próprio, a CAPI entra junto (outbox com `event_id`
compartilhado com o Pixel, retries e deduplicação). As variáveis
`META_CAPI_ACCESS_TOKEN`, `META_GRAPH_API_VERSION` e `META_TEST_EVENT_CODE`
ficam sem uso.

## 4. Checklist de validação

- [ ] Sem escolha: nenhum request a `googletagmanager.com` (DevTools → Rede).
- [ ] Rejeitar: idem; banner não volta na próxima página.
- [ ] Aceitar só analytics: GTM carrega; GA4 recebe `page_view`; Meta não.
- [ ] Navegar entre páginas: um `page_view` por página (sem duplicar).
- [ ] Página de tratamento: `page_sensitive = true`; Pixel não dispara.
- [ ] Revogar em *Preferências de cookies*: página recarrega, cookies `_ga*`
      somem, nenhum novo envio.
- [ ] Nenhum parâmetro com e-mail, telefone, nome, query string ou tratamento.
