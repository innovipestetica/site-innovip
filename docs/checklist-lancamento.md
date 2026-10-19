# Checklist de lançamento

Marque cada item com evidência (print, data, quem conferiu). O site só está
"pronto para o público" com todos os itens obrigatórios marcados.

## Conteúdo e dados da clínica (obrigatório)

- [ ] `npm run demo:remove` executado (nenhum "[DEMONSTRAÇÃO]" no site).
- [ ] Configurações públicas reais: nome, razão social, CNPJ, telefone,
      WhatsApp, e-mail, endereço, horários, mapa, redes, responsável técnico.
- [ ] **Destino do "Agendar avaliação"** configurado (WhatsApp ou link).
- [ ] Home real publicada.
- [ ] Tratamentos reais, com **revisão clínica** registrada.
- [ ] Equipe com registros profissionais corretos (sem credenciais inventadas).
- [ ] Depoimentos só com autorização registrada; imagens com licença.
- [ ] Promoções com preços e condições aprovados.
- [ ] Páginas `privacidade` e `cookies` publicadas a partir de
      `docs/rascunho-politicas.md`, **revisadas pelo responsável da clínica**.
- [ ] Prazo de retenção definido (consentimentos, backups).

## Contas e infraestrutura (obrigatório)

- [ ] Vercel em plano compatível com uso comercial.
- [ ] Supabase de produção em plano adequado (backups), separado do de testes.
- [ ] Migrações aplicadas em produção; `npm run test:db` rodado contra staging.
- [ ] Administradores provisionados em produção, com MFA; fator reserva
      cadastrado (segundo dispositivo ou gerenciador).
- [ ] Supabase Auth: cadastro aberto **desligado**, anônimo desligado, MFA
      TOTP ligado, senha mínima 12, Site URL e Redirect URLs exatas do
      domínio, **SMTP próprio** testado (recuperação de senha).
- [ ] Variáveis de ambiente na Vercel (docs/deploy-vercel-locaweb.md);
      segredos marcados como *Sensitive*; `DATABASE_URL` fora da Vercel.
- [ ] Previews protegidos (Deployment Protection).
- [ ] Domínio ligado sem tocar em MX/SPF/DKIM/DMARC; www/raiz/https testados;
      e-mail da clínica funcionando depois da mudança.
- [ ] Backup lógico feito e `backup:verify` aprovado; RPO/RTO confirmados.

## Medição (se for usar)

- [ ] GTM/GA4 configurados conforme docs/gtm-ga4-meta.md; DebugView ok.
- [ ] Elegibilidade Meta revisada antes de ligar o Pixel; nunca em páginas
      sensíveis.
- [ ] `TRACKING_ENABLED=true` e `NEXT_PUBLIC_GTM_ID` só em Production; novo deploy.
- [ ] Checklist de validação do consentimento (docs/gtm-ga4-meta.md §4).

## Virada

- [ ] `SITE_INDEXING_ENABLED=true` (libera robots e sitemap) e novo deploy.
- [ ] Revisar conteúdos que devem continuar `noindex` (campanhas).
- [ ] Smoke test completo (docs/deploy-vercel-locaweb.md §6) em produção.
- [ ] Search Console: verificar domínio e enviar o sitemap.
- [ ] Medir Core Web Vitals reais após alguns dias (meta p75: LCP ≤ 2,5 s,
      INP ≤ 200 ms, CLS ≤ 0,1); antes disso, só laboratório.
