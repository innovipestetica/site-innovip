# Manual do painel (CMS)

Endereço: `/admin`. Exige login e verificação em duas etapas (MFA).

## Como o conteúdo funciona

- Cada conteúdo (página, tratamento, promoção…) tem **revisões**. Cada
  **Salvar** cria uma revisão nova. Nada muda no site ao salvar.
- **Publicar** coloca no ar a revisão atual. Em até 1 minuto o site mostra a
  versão nova. A revisão que estava no ar continua guardada no histórico.
- **Despublicar** tira do site sem apagar nada. **Arquivar** tira do site e da
  lista principal. Nada é apagado de verdade pelo painel.
- **Histórico** mostra todas as revisões. **Restaurar** cria uma revisão nova
  com o conteúdo antigo (precisa publicar depois).
- **Prévia** abre a última revisão salva como ficará no site. Só
  administradores conseguem ver, e ela não aparece em buscadores.

## Regras que o sistema confere ao publicar

O botão Publicar mostra a lista do que falta. Exemplos:

| Conteúdo | Exigência |
|---|---|
| Tratamento | Revisão clínica registrada (responsável habilitado e data) |
| Promoção | Início, fim no futuro e condições completas |
| Depoimento | Registro da autorização da pessoa |
| FAQ | Resposta preenchida |
| Equipe | Função preenchida |
| Qualquer um | Itens referenciados (tratamentos, FAQs, imagens…) já publicados/aprovados |

Não publique preços, resultados, depoimentos ou credenciais que não foram
fornecidos e aprovados pela clínica. Seções sem conteúdo ficam ocultas.

## Duas abas ou duas pessoas editando

Se outra aba (ou o outro administrador) salvar antes, o seu **Salvar** avisa
"Outra edição foi salva antes desta". Nada é perdido: copie o que precisar,
recarregue e aplique de novo sobre a versão mais nova.

Ao sair da página com alterações não salvas, o navegador pede confirmação.

## Blocos

Páginas, Home, tratamentos, promoções, landing pages e blog são montados com
blocos de uma lista fechada (destaque, texto, imagem, chamada, diferenciais,
passo a passo, aviso, FAQs, tratamentos, categorias, objetivos, promoções
vigentes, depoimentos, equipe, galeria, contato). Não é possível inserir HTML
ou scripts.

No campo de texto:

```
## Subtítulo
Parágrafo com **negrito**, *itálico* e [link](/contato).

- item de lista
- outro item
```

Links aceitos: `https://…`, `tel:`, `mailto:` e caminhos do site (`/contato`).

Botões usam **ações**, sem número fixo: "Agendar avaliação", "WhatsApp"
(número de Configurações públicas) ou um link.

### Destino do "Agendar avaliação"

O agendamento é **externo** (decisão da clínica): o site não tem formulário
próprio nem guarda dados de quem quer ser atendido. Em **Configurações
públicas → Botão "Agendar avaliação"** você escolhe para onde vão TODOS os
botões de agendamento (cabeçalho, menu do celular, blocos, páginas de
tratamento, "Quero aproveitar" das promoções e contato):

- **WhatsApp**: abre o WhatsApp da clínica com a mensagem genérica. A mensagem
  nunca cita o tratamento (pode ser dado de saúde).
- **Link externo**: qualquer endereço `https://` (formulário ou plataforma de
  agendamento).

Também dá para trocar o texto do botão. Tudo abre em nova aba. **Sem destino
configurado, os botões ficam ocultos** (nada de link quebrado).

O endereço **`/agendar-avaliacao`** redireciona para o destino escolhido. Use
esse endereço na bio do Instagram, em QR codes e campanhas: se a plataforma
mudar, basta trocar no painel. Clicar não é agendamento confirmado: a equipe
confirma o horário.

## Endereços (slug)

Minúsculos, sem acentos, com hífens. Ao **alterar o endereço** de um conteúdo
que já foi publicado, o endereço antigo passa a redirecionar (301) para o
novo. Veja em **Redirecionamentos**.

## Promoções

Datas são digitadas no horário de Brasília. Fora do prazo, a promoção some das
listagens automaticamente, mesmo sem nenhuma ação manual. Na lista do painel,
cada promoção mostra a situação da versão no ar: **vigente**, **agendada**,
**encerrada** ou **sem datas**. Preço é opcional;
publique valores só quando aprovados.

Landing pages começam como **noindex** (não aparecem no Google) até decisão
editorial. Associe a landing a uma promoção para que a oferta tenha uma única
fonte.

## Mídia

1. **Enviar**: JPEG, PNG, WebP ou AVIF, até 10 MB. O sistema confere o tipo
   real do arquivo, remove metadados (inclusive localização GPS) e cria
   versões otimizadas. O nome do arquivo original não é guardado.
2. A imagem fica **privada** até ser **aprovada**.
3. **Aprovar** exige texto alternativo e o registro da licença ou autorização
   de uso (fica guardado como evidência).
4. Imagem em uso não pode ser excluída. Com registro de licença, "Excluir"
   arquiva (a evidência é mantida).

Retirar uma imagem do site não apaga cópias que alguém já tenha baixado ou que
estejam em caches externos por algum tempo.

## Categorias e objetivos

Categorias organizam o catálogo (ex.: Faciais, Corporais). Objetivos alimentam
"O que você deseja tratar?". Precisam estar **publicados** para aparecer e para
que tratamentos ligados a eles possam ser publicados.

## Configurações públicas

Nome, contatos, WhatsApp (formato `55` + DDD + número), endereço, horários,
redes, menu, rodapé e SEO padrão. Campo vazio = item oculto no site. Nunca
coloque senhas ou tokens aqui.
