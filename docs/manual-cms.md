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
blocos de uma lista fechada (destaque, carrossel de banners, texto, imagem, chamada, diferenciais,
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

### Imagens clicáveis

As imagens dos blocos **Imagem**, **Destaque**, **Galeria** e **Carrossel de
banners** podem levar a um link: preencha o campo "Link ao clicar…" logo abaixo
da imagem (na Galeria, um campo por imagem). Vazio = imagem sem link.

- Aceita `https://…` (abre em nova aba), caminhos do site (`/tratamentos`,
  `/promocoes/…`, `/agendar-avaliacao`), `tel:` e `mailto:`.
- No banner **sem botão**, o banner inteiro vira o link; **com botão**, só a
  imagem leva ao link e o botão continua com o destino dele.
- Quem usa leitor de tela ouve o texto alternativo da imagem como nome do link:
  escreva em Mídia um texto que faça sentido (ex.: "Promoção de drenagem").

### Carrossel de banners

Para colocar vários banners que passam sozinhos (ou que a pessoa troca pelas
setas, pelos pontinhos, pelo teclado ou deslizando o dedo):

1. **Conteúdo → Home** (ou qualquer página/landing) → **Adicionar bloco →
   Carrossel de banners**. Para ele abrir a página, use a seta **↑** do bloco até
   ficar em primeiro.
2. Em cada banner escolha a **imagem (computador)** (sugestão: 1600×584,
   formato largo) e, se quiser, uma **imagem para celular** (sugestão:
   800×1000, em pé). Sem imagem de celular, a de computador é usada.
3. **Título, texto e botão** são opcionais. Aparecem num painel verde sobre a
   imagem (no celular com imagem larga, logo abaixo dela).
4. **Passar automaticamente** e o **intervalo** (5, 6, 8 ou 10 segundos).
   Até 8 banners; dá para reordenar e remover.

Regras de acessibilidade aplicadas sozinhas: há botão de pausar; o carrossel
para enquanto o mouse ou o foco estão nele e quando a aba fica oculta; quem
pede "reduzir movimento" no aparelho não vê troca automática. Só imagens
**aprovadas** aparecem no site.

Dica: não deixe informação essencial (preço, condição de promoção) **só** no
carrossel — muita gente não vê os banners seguintes. Repita em outro bloco ou
na página da promoção. Escreva o texto importante nos campos de título/texto,
não dentro da imagem (leitores de tela e buscadores não leem texto em imagem).

## Endereços (slug)

Minúsculos, sem acentos, com hífens. Ao **alterar o endereço** de um conteúdo
que já foi publicado, o endereço antigo passa a redirecionar (301) para o
novo. Veja em **Redirecionamentos**.

## Tratamentos em lote (rascunhos)

Para cadastrar muitos tratamentos de uma vez, sem foto, existe um script no
computador do projeto. Ele só cria **rascunhos**; revisar e publicar continua
sendo pelo painel.

1. Crie um arquivo de texto com um tratamento por linha:
   `Título | Categorias | Objetivos | Resumo` (só o título é obrigatório;
   vários itens separados por `;`). Modelo: `scripts/exemplos/tratamentos.txt`.
2. Simule: `npm run tratamentos:importar -- lista.txt` (mostra o que seria
   criado e aponta nomes de categoria/objetivo que não existem).
3. Grave: repita com `--aplicar`. Endereços que já existem são pulados; se
   houver qualquer erro, nada é gravado.

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
