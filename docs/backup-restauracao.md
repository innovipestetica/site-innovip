# Backup e restauração

## Proposta inicial (a confirmar com a clínica)

- **RPO** (perda máxima de dados): 24 h. **RTO** (tempo para voltar): 8 h.
- Dependem do plano do Supabase e de quem opera. Confirmar antes do lançamento.

## Camadas de backup

1. **Supabase (banco)**: backups automáticos dependem do plano (no plano
   gratuito não há backups diários acessíveis; no Pro há backups diários e
   opção de PITR). **Confirme no painel do projeto de produção.**
   Os backups do Supabase **não incluem** os arquivos do Storage.
2. **Backup lógico do projeto (este repositório)** — conteúdo + arquivos:

   ```bash
   npm run backup:export
   ```

   Gera `backups/<data-hora>/` com `db.json` (conteúdo, configurações,
   mídias, evidências de licença e vínculo dos administradores),
   `manifest.json` (contagens e checksums) e `storage/` (todos os arquivos
   dos dois buckets). **Não** inclui registros de consentimento nem
   auditoria.

   A pasta fica fora do Git. Guarde uma cópia em local seguro, com acesso
   restrito (contém originais de imagens). Frequência sugerida: semanal e
   antes de mudanças grandes ou migrações.

## Teste de restauração (isolado)

```bash
npm run backup:verify -- backups/<pasta>
```

Cria um schema temporário com a mesma estrutura das tabelas, carrega o
backup, confere contagens, checksums, integridade da versão publicada e
existência de cada arquivo (tamanho e hash) e **desfaz tudo** no fim.
Executado em 18/10/2026: 86 linhas em 16 tabelas e 28 arquivos íntegros; um
teste com arquivo adulterado falhou como esperado.

## Restauração real (procedimento)

1. Pare publicações no painel (avise os administradores).
2. Banco: restaure pelo Supabase (backup/PITR) **ou**, a partir do backup
   lógico, recarregue as tabelas do `db.json` num projeto novo com as
   migrações aplicadas (`npm run db:migrate`), na ordem: categorias,
   objetivos, mídias, evidências, conteúdos, versões, detalhes/relações,
   configurações, redirecionamentos. Faça primeiro num projeto de teste.
3. Storage: reenvie os arquivos de `storage/media-private` e
   `storage/media-public` para os buckets de mesmo nome, nos mesmos caminhos.
4. Reaplique exclusões registradas depois do backup (ex.: mídias ou
   conteúdos removidos a pedido de titulares) para não "ressuscitar" dados.
5. Invalide o cache do site (`POST /api/revalidate`) e faça o smoke test
   (docs/deploy-vercel-locaweb.md).
6. Registre a ocorrência (data, causa, quem executou, dados afetados).

## Retenção

- Registros de consentimento: rodar periodicamente (sem agendador no plano
  atual) com a credencial do dono do banco:
  `select private.purge_consent_receipts(interval '5 years');`
  (prazo a confirmar pela clínica).
- Backups lógicos: manter os últimos [N], apagando os antigos com segurança.
