# Governança de dados — Painel de Obras Machine

Receita fixa de onde vem cada número do painel e com que frequência ele deve ser atualizado.
Quem alimenta os dados (Alimentar dados) não precisa mudar nada aqui todo mês — só subir os
arquivos atualizados, no modo certo (Físico ou Financeiro).

## Nomenclatura (gestão de valor agregado)

| Termo | Nome | Significado | Fonte no painel |
|---|---|---|---|
| **PV** | Valor Planejado | Quanto deveria ter sido entregue até a data de corte, em R$ | Curva S financeira (pasta `Financeiro VA` do Prevision) — coluna "Previsto" |
| **EV** | Valor Agregado | Quanto foi efetivamente entregue até a data de corte, em R$ (avanço físico × custo do item) | Curva S financeira — coluna "Realizado" |
| **AC** | Custo Real | Quanto foi efetivamente gasto para entregar isso | Pasta `custo/` — **ainda sem arquivo definido**; enquanto não existir, CPI/EAC ficam "sem dados" |
| **BAC** | Orçamento no Término | Valor total do contrato (com aditivos) | Controle de Medição (xlsx) — "Total do contrato" |
| **SPI** | Índice de Desempenho de Prazo (em valor) | EV ÷ PV — 1,00 = em linha com o plano | Calculado (`Core.calcFinanceiro`) |
| **CPI** | Índice de Desempenho de Custo | EV ÷ AC — 1,00 = gastando conforme planejado | Calculado, só quando há AC |
| **EAC** | Estimativa no Término | AC + (BAC − EV) ÷ CPI | Calculado, só quando há AC |
| **VAC** | Variação no Término | BAC − EAC | Calculado, só quando há AC |

O avanço **físico** (IDP, % de obra) é um motor separado, documentado em `js/core.js`
(`Core.calc`) — este documento só cobre o lado financeiro/valor agregado, que é aditivo e não
muda os cálculos físicos existentes.

## De onde vem cada dado, por pasta

A estrutura de pastas é sempre a mesma por obra (`<obra>/contrato`, `<obra>/custo`,
`<obra>/planejamento/{Físico, Financeiro VA, Diário}`):

- **`planejamento/Físico/`** → avanço físico (%). O `progresso-semanal.xls` (cabeçalho "Mês", linhas
  "16/Fev/2026") é somado por mês, repartindo a semana da virada pelos dias de cada mês; entra no lugar
  do Progresso mensal (ritmo dos últimos 3 meses, barras do mês).
- **`planejamento/Financeiro VA/`** → mesma Curva S / Progresso por tarefas / progresso semanal
  do Prevision, só que em R$ (PV/EV). No upload, escolha o modo **"Dados financeiros"** — o
  cabeçalho é idêntico ao físico, então o painel não adivinha; quem decide é quem sobe o arquivo.
  O EV na data de corte é o último realizado registrado até o fim do mês do corte (o Prevision grava
  a posição do dia da exportação no ponto de fim de mês). O gráfico usa o valor do contrato como 100%
  quando o total da curva bate com ele (±15%, caso da 198 e 208); senão, o total previsto da própria
  curva (caso da 207, em que a curva é o orçamento da obra e o contrato Machine é outro valor). O
  SPI não depende disso: é sempre EV ÷ PV na mesma curva.
- **`contrato/Controle de Medição ... .xlsx`** → BAC, saldo de contrato, medição mensal e
  boletim por item de EAP. Sempre tratado como contrato, nos dois modos de upload. Layouts
  reconhecidos: aba "Controle Mensal" (198), "VISÃO GERAL" (208) e "SÉRIE DE MEDIÇÕES" + "RESUMO" (207).
  Cada campo vem da primeira aba que o traz (série → visão geral/controle mensal → resumo); a
  última medição, quando não há rótulo, é o último mês medido da tabela (boletim · mês · situação).
- **`contrato/Relatório de Medição CLIENTE.pdf`** e **`contrato/Relatório de Contas Pagas.pdf`**
  → **ainda não lidos pelo painel** (o xlsx acima já cobre contrato e medição de forma
  estruturada; o layout tabular denso desses PDFs não é confiável para extração por texto —
  precisaria de leitura por posição, como já é feito para os RDOs). Próximo passo, não desta
  entrega.
- **`custo/`** → **vazia hoje nas três obras**. Quando existir um arquivo de custo real (AC), ele
  deve ter o mesmo formato de `obra.curva`: pontos `{ data, realizado }` em R$ acumulado. A partir
  da hora que existir, CPI/EAC/VAC passam a ser calculados automaticamente — não precisa mudar
  código, só o parser de leitura desse arquivo quando o formato for definido.
- **`planejamento/Diário/`** → RDOs. Todos os relatórios do PDF entram (texto); das fotos, só as dos
  últimos 35 dias do PDF (o report usa 30). O contrato do RDO ("207/2026") é comparado ao do
  cadastro ("CT/207/2026") só pelos dígitos, e diferença é aviso, não bloqueio.
- **Plantas da obra (`3_Projetos`)** → base do **Mapa de avanço** (aba Obra). A planta é enviada
  no próprio painel (PDF, escolhendo a página, ou PNG/JPG) e guardada no rascunho da obra como
  imagem de até 2000 px. Cada área demarcada tem situação manual (Executado / Executando / A
  executar) ou vínculo com uma atividade do cronograma (100% = executado, >0 = executando,
  0 = a executar), recalculada a cada carga. As áreas são polígonos (vértices em fração da planta, `pts`); mapas
  antigos com retângulos `{x, y, w, h}` são convertidos ao abrir no editor.

## Valor agregado no report

O cadastro da obra define se o quadro de valor agregado entra no report (`reportVA`): **Automático** (padrão) mostra
só quando há SPI e a Curva S financeira está na base do contrato (198 e 208); **Mostrar sempre**; **Não mostrar**.
Na 207, a curva do Prevision é o orçamento da obra e não o contrato Machine, então no automático o quadro fica fora do
report. O cliente segue a mesma regra na aba Obra; administradores e diretoria sempre veem os números lá.

## Cadência de atualização

| Dado | Frequência | Campo no painel |
|---|---|---|
| Físico (Curva S, Progresso, Cronograma, RDO) | Semanal | `obra.dataCorte` |
| Financeiro (Curva S VA, Controle de Medição) | Mensal | `obra.dataCorteFinanceiro` |
| Custo (quando existir) | Mensal, junto com o financeiro | — |

A sincronização automática (`sync/README.md`) segue esta mesma receita: físico na perspectiva **Física (Duração)** em
percentual (a que bate com o realizado do Cronograma), financeiro na **Econômica** em R$, Progresso por tarefas sem filtro
de datas, tudo exportado junto e gravado como rascunho. A Curva S que o Prevision exporta hoje tem um ponto por dia; a
conferência com o Progresso mensal usa o último ponto de cada mês.

O painel avisa quando um dado está desatualizado além da cadência esperada (aba Obra →
Conferência dos dados): mais de 10 dias sem corte físico, ou mais de 35 dias sem corte
financeiro (`LIMIAR_DIAS_FISICO`/`LIMIAR_DIAS_FINANCEIRO` em `js/core.js`).

## Prazo ganho (Earned Schedule): farol de prazo em dias

O IDP em % (realizado ÷ previsto) converge para 1,00 no fim de qualquer obra, mesmo atrasada, e no começo transforma
diferenças pequenas em índices extremos. Desde a revisão de 11/2026 o painel mede o mesmo desvio em **tempo**
(`Core.prazoGanho`):

| Termo | Cálculo | Leitura |
|---|---|---|
| **ES** (prazo ganho) | data em que o previsto da Curva S alcança o avanço realizado de hoje | até onde o plano chegaria com o que já foi feito |
| **Atraso** | data de corte − ES, em dias | "23 dias de atraso" · "5 dias adiantada" |
| **IDP(t)** | (ES − início) ÷ (corte − início) | 1,00 = no prazo; mesmas faixas do farol (0,95 / 0,85) |

- Curva de referência: o **previsto (replanejado)**, a mesma do IDP em %. O alvo é o IDP aplicado ao previsto da própria
  curva no corte, para o sinal do atraso acompanhar o do IDP mesmo quando Cronograma e Curva S diferem por arredondamento.
- O farol usa o IDP(t) quando ele é confiável: **30 dias ou mais de obra e pelo menos 2% previsto**. Antes disso vale o IDP em %.
- Cadastro da obra → *Índice que acende o farol de prazo*: `indicePrazo = 'tempo'` (padrão) ou `'percentual'` (regra anterior).
- **Projeção de término em faixa** (com obra acima de 10% e IDP(t) confiável), nunca antes do corte:
  - *se o atraso de hoje não aumentar*: término do cronograma + atraso;
  - *se o desempenho de prazo se mantiver*: início + duração do cronograma ÷ IDP(t).

  Sem essas condições, fica a projeção anterior pelo ritmo médio dos 3 últimos meses fechados.

## Tendência do prazo e histórico de cargas

- **Tendência** (aba Obra): atraso em dias no último realizado de cada mês, pela própria Curva S, até o corte. Medida
  contra o cronograma atual: depois de um replanejamento os meses passados são relidos no plano novo.
- **Histórico de cargas** (`obra.historico`, gravado por `Carga.aplicarCarga` em toda carga física, manual ou automática):
  um registro por data de corte com realizado, previsto, IDP, atraso, IDP(t), farol, término do cronograma e projeção.
  Recarga da mesma data substitui o registro; guarda até 156 cortes. É o que o painel mostrava em cada data, mesmo que a
  Curva S mude depois. O cliente só vê registros até a posição publicada.

## Medido × executado (interno)

Com a Curva S financeira na base do contrato (±15%), o painel compara o **medido acumulado** (Controle de Medição) com o
**EV** no corte. Diferença de até 2% do contrato = em linha; acima = medição à frente da execução; abaixo = execução ainda
não medida. Aparece só para administradores e diretoria, na aba Obra (não vai para o report nem para o cliente).

## Acesso e compartilhamento

- **Links diretos**: o endereço acompanha a tela (`#portfolio`, `#obra-208`, `#obra-208/report`, `#manual`); quem abre o
  link faz login e cai na mesma tela. Botão *Copiar link* na aba Obra. O Voltar do navegador volta à tela anterior.
- **Aviso de publicação**: depois de *Publicar para o cliente*, o painel oferece um e-mail pronto para os clientes com
  acesso à obra (cópia oculta, link direto para o report). O envio sai do programa de e-mail de quem publicou.
- **Report no celular**: em tela estreita, um resumo legível (situação, avanço, prazo, projeção, atenções e marcos) vem
  antes das folhas A4. Não entra no PDF nem na impressão.
- **Token do GitHub**: por padrão fica só até fechar o navegador; *Lembrar neste computador* vale 7 dias. Use token
  fine-grained, só deste repositório, com validade de até 90 dias.

## Mapa de restrições (aba Restrições, uso interno)

Registro e gestão das restrições revisadas na reunião semanal, no padrão do Last Planner System: restrição é o que
precisa estar resolvido para uma frente avançar (projeto, contratação, material, mão de obra, aprovação, cliente...).

- **Quem vê**: administradores registram e atualizam; diretoria consulta; cliente não vê a aba nem recebe os dados.
- **Onde fica**: `data/restricoes/<obra>.bin`, cifrado com a chave interna (a mesma do rascunho), fora do arquivo publicado
  ao cliente. Entra na troca de chaves. A gravação é item a item sobre a versão mais recente do repositório.
- **Campos**: frente/item, tipo, ação para remover, responsável (aceita "Ana / Bia", "André + Gisele"), data limite ou
  condição ("3 dias após envio da carta"), status (Pendente, Em andamento, Em aprovação, Removida), observação e, opcional,
  a atividade do cronograma que a restrição libera.
- **Farol automático** (`Core.farolRestricao`), pela data de hoje: vencida (data limite passou) · vence em até 7 dias ·
  sem data ou condicionada · no prazo · removida. "Atrasado" não é status: é calculado.
- **IRR, índice de remoção de restrições** (`Core.indicadoresRestricoes`): por semana (segunda a domingo), restrições
  removidas até a data prevista ÷ restrições previstas para a semana. O cartão mostra as 4 últimas semanas somadas;
  referência de 80%, a mesma usada para o PPC no Last Planner. A data prevista é a **original** (a primeira data limite
  informada): reprogramar a data conta como reprogramação, aparece na linha e não melhora o índice.
- **Por que IRR e não PPC**: o PPC mede o cumprimento da programação semanal de tarefas (o compromisso do planejamento de
  curto prazo), que o painel não recebe. Para o mapa de restrições, o indicador correspondente é o IRR.
- **Vínculo com o cronograma**: quando a atividade vinculada começa antes da data limite da restrição (e ainda não está
  concluída), a linha mostra o alerta; é a restrição no caminho da obra.
- **Importar planilha**: aceita os mapas atuais em .xlsx (cabeçalho com Status e Ação; Frente/Item, Disciplina,
  Responsável, Data limite e Observação em qualquer ordem). Células mescladas valem para o bloco; faixas de título
  ("ADITIVOS DE ESCOPO") são puladas; datas "27/out", "28-out", "29/10/2026" e datas do Excel são lidas. *Somar* atualiza
  as restrições já existentes (mesma frente, tipo e ação) e acrescenta as novas; *Substituir* apaga as atuais. Se o nome
  do arquivo indica outra obra, o painel avisa antes de importar.
- **Imprimir**: a aba imprime o mapa (indicadores, IRR e a lista no filtro escolhido) para a reunião.
- **Portfólio**: para a equipe interna, "Restrições vencidas" entra nos pontos de atenção de cada obra.

## Revisão visual e de operação (11/2026)

- **Report, Curva S física e avanço mensal**: dois painéis alinhados no mesmo eixo de tempo (acumulado em cima, mês a mês embaixo), cada um com a sua escala. Antes as barras do mês dividiam o quadro com a curva em dois eixos Y, o que sugeria comparação entre escalas diferentes. Rótulos de mês com espaçamento automático.
- **Report, folha de andamento**: quando todas as etapas cabem e sobra espaço, entra o gráfico de atraso em dias (prazo ganho) mês a mês. Obra com muitas etapas segue como antes.
- **Efetivo diário**: dias com clima impraticável no RDO marcados no fundo do gráfico e linha da média do período (base para pleito de prazo por chuva).
- **Cronograma (Gantt)**: meses rotulados por trimestre ou semestre em obras longas, com o ano.
- **Aba Obra**: atalhos fixos para as seções; resumo das restrições (equipe interna); a menos de 30 dias do fim do cronograma, o "ritmo necessário" dá lugar ao "para concluir" (o que falta e em quantos dias); corte com mais de 10 dias aparece em destaque; avanço por mês com a mesma notação do report (planejado em contorno).
- **Portfólio**: avanço físico numa célula (número e barra com a marca do planejado), no lugar da rosca e das barras que repetiam os mesmos dois números; linha de restrições por obra (equipe interna); corte de cada obra no cabeçalho, com aviso quando desatualizado; para a equipe interna, "Restrições vencidas" no lugar de "Avanço médio" (média simples de obras de portes diferentes não é indicador).

## Report ao cliente (aba Report, modelo de 11/2026)
O report é o documento enviado ao cliente: enxuto, igual em todas as obras, em folhas A4 paisagem (tela, PDF e impressão).
O detalhe interno (campo/RDO, marcos, pontos de atenção, tarefas, restrições, conferência) fica na aba Obra.

| Folha | Conteúdo | De onde vem |
|---|---|---|
| Capa | "Relatório mensal de contrato", obra, logos Machine e cliente, mês/ano de referência, local, cliente, revisão | Cadastro da obra → *Capa do report*; o mês, em *Mês da capa* na tela do report (vale para a carga em que foi escolhido) |
| Dashboard – status geral | Avanço físico e financeiro acumulados, IDP, IDC, variação do término, prazo contratual, Previsto × Realizado pela EAP (nível 2; na tela abre até o pacote executável) | Prevision (robô de sexta): Curva S, cronograma e IDC da Gestão de Custos |
| Físico (previsto × realizado) | Curva física acumulada e avanço de cada mês no mesmo quadro; barras Base / Previsto / Realizado | Prevision (Curva S e progresso mensal) |
| Físico · avanço da frente + Fotos · registros | Para cada frente: a planta marcada (executado · em execução · a executar) e, em seguida, as fotos do período, duas por folha, com legenda | Obra → Mapa de avanço: planta (já marcada ou com áreas desenhadas e vinculadas ao cronograma) e as fotos da frente |
| Valor agregado | SPI, EV, PV e Curva S financeira | Prevision (perspectiva econômica); cadastro → *Valor agregado no report* |
| Medições / faturamento — controle | Contrato, medido, saldo, última medição; histórico mês a mês; boletim da última medição no desenho do Sienge (cabeçalho, Quantidades e Valores até o 2º nível da EAP, fechamento com descontos, retenções e total líquido) | Controle de Medição (Alimentar; as abas M1, M2… são os boletins exportados do Sienge); depois, direto do Sienge |

**Rotina do mês** (o que é manual): 1) conferir o rascunho que o robô gravou na sexta; 2) enviar o Controle de Medição
do mês em Alimentar; 3) em Obra → Mapa de avanço, *Limpar fotos de todas as frentes* (botão no topo do report) e
carregar a planta atualizada e as duas fotos com legenda de cada frente do mês; 4) escolher o *Mês da capa*; 5) conferir
as folhas e **Publicar para o cliente**; 6) *Baixar PDF* ou enviar o link. *Baixar PowerPoint* gera o mesmo report em slides editáveis (cada folha vira um slide com textos, tabelas, gráficos e formas nativos do PowerPoint; imagem só para fotos, plantas e logos), para ajustes pontuais fora do painel. Sem fotos escolhidas nas frentes, o report usa
a seleção automática das fotos dos RDOs. O topo do report (só administrador) avisa quando há foto com mais de 40 dias.

## Regras de coerência (revisão de 10/11/2026)

- **Avanço da obra = perspectiva física (duração) do Prevision**, a mesma do Cronograma e do Progresso por tarefas. É a régua
  de todos os cartões, do farol, do Portfólio e do report. O dashboard do Prevision abre na visão ponderada por custo, que dá
  outro número; no painel o custo aparece só como **valor agregado** (EV, PV, SPI), com esse nome.
- **Farol pelo índice como ele aparece**: o índice é arredondado a 2 casas antes de comparar com as faixas (0,845 aparece
  "0,85" e fica em atenção, não em vermelho). Vale para tela, PDF e PowerPoint.
- **Dois números de prazo, cada um com o seu nome**: *Atraso hoje* (prazo ganho, em dias, na data de corte) e *Variação do
  término* (término do cronograma × término contratual). Com o farol verde, alguns dias atrás do plano aparecem como
  "N dias, na tolerância", nunca "Em dia" ao lado de "N dias de atraso".
- **Prazo contratual** continua sendo a linha de base do Prevision (nível 1 do cronograma), como desde 10/2026. As datas de
  vigência do contrato no Sienge (CT) são administrativas e podem diferir. Contrato
  vencido aparece como "Vencido há N dias".
- **Última medição física**: o corte é a data da exportação; quando a última medição lançada no Prevision é anterior,
  o dashboard mostra a data da medição.
- **EAP do dashboard**: marcos (liberações, entregas), aditivos condicionados e taxa de administração ficam num bloco à parte,
  sem setas de desvio. A tabela compacta sozinha até caber na folha. A raiz leva o nome da obra do cadastro.
- **Medições**: a coluna "Medição Machine realizada" é o medido menos faturamento direto e descontos, **antes dos impostos**
  (nota de rodapé na folha); o total líquido do boletim já desconta os impostos. Mês só com entrada de mobilização aparece
  como "Entrada de mobilização (adiantamento)". Boletim de medição em análise leva o selo "valores sujeitos aos impostos da
  liberação". "Total da obra" só aparece quando difere do total do contrato.
- **Mês da capa automático**: corte até o dia 15 = report do mês anterior (06/11 → outubro); depois do dia 15, o mês do
  corte. A escolha manual em *Mês da capa* continua valendo para a carga em que foi feita.
- **Login**: leitura com nova tentativa em falha passageira do GitHub Pages (5xx); o arquivo de restrições é opcional e não
  impede a entrada.
