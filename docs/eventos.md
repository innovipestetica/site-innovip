# Dicionário de eventos (dataLayer)

Os eventos só entram no `dataLayer` **depois** do consentimento de analytics
ou marketing, e o GTM só é carregado depois disso (modo básico do Consent
Mode, sem pings sem cookies). Implementação:
`src/lib/consent/tracking-client.ts` e `src/components/consent/consent-manager.tsx`.

## Regras gerais

- **Nunca** entram: nome, telefone, e-mail, texto digitado, query strings,
  UTMs, nomes de tratamentos ou condições de saúde em parâmetros.
- Todo evento tem `event_id` aleatório (UUID gerado no navegador).
- `page_sensitive: true` marca páginas que podem revelar interesse de saúde
  (`treatment`, `category`, `promotion`, `landing`). **Tags de marketing
  (Meta) não devem disparar com `page_sensitive = true`** até a revisão de
  elegibilidade no Events Manager.
- Não existem `form_start` nem `generate_lead`: o agendamento é externo
  (WhatsApp ou link), então o site não tem conversão persistida para medir.

## Eventos

| Evento | Quando | Parâmetros |
|---|---|---|
| `page_view` | Uma vez por navegação (inclusive transições no cliente), após consentimento | `page_type`, `page_sensitive`, `page_location` (origem + caminho, sem query), `page_path`, `page_title` (genérico em páginas sensíveis) |
| `view_content` | Páginas de conteúdo genérico: `promotion`, `landing`, `blog_post` | `content_type`, `page_sensitive` |
| `cta_click` | Clique em botão de chamada (exceto botões só de WhatsApp) | `cta_type` (`evaluation` ou `link`), `cta_target` (`whatsapp` ou `link`), `cta_location`, `page_type`, `page_sensitive` |
| `whatsapp_click` | Clique que leva ao WhatsApp (botão de WhatsApp ou agendamento configurado para WhatsApp) | `cta_location`, `page_type`, `page_sensitive` |

`whatsapp_click` e `cta_click` são **interações**, não agendamento nem lead:
não configure como conversão de "Lead"/"Schedule".

### Valores de `page_type`

`home`, `page`, `catalog`, `category`, `treatment`, `promotions`, `promotion`,
`landing`, `blog_list`, `blog_post`, `not_found`.

### Valores de `cta_location`

`header`, `mobile_menu`, `treatment_intro`, `treatment_footer`,
`promotion_page`, `landing`, `contact_block`, `promotions_empty`, `footer`,
`content` (blocos de conteúdo).

## Consentimento

| Escolha | `analytics_storage` | `ad_storage` | `ad_user_data` | `ad_personalization` |
|---|---|---|---|---|
| Sem escolha / Rejeitar | não carrega GTM | — | — | — |
| Só analytics | granted | denied | denied | denied |
| Só marketing | denied | granted | granted | granted |
| Aceitar tudo | granted | granted | granted | granted |

Revogar (Preferências de cookies no rodapé) grava a nova escolha, envia
`consent update` negando, apaga `_ga*`, `_gid`, `_fbp`, `_fbc`, `_gcl_*` e
recarrega a página para descarregar as tags. Cada escolha é registrada em
`private.consent_receipts` (identificador pseudônimo, sem dados pessoais).

Mudar `CONSENT_VERSION` (`src/lib/consent/consent.ts`) pede o consentimento
de novo a todos — faça isso ao mudar política, finalidade ou ferramentas.

## Diferenças esperadas entre ferramentas

Contagens de GA4, Meta e da plataforma de agendamento **não vão bater**:
quem rejeita cookies ou usa bloqueadores não é medido, cliques não são
agendamentos, e cada ferramenta tem sua própria atribuição. Relatórios devem
explicar essas perdas.
