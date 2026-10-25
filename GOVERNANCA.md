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
  0 = a executar), recalculada a cada carga.

## Cadência de atualização

| Dado | Frequência | Campo no painel |
|---|---|---|
| Físico (Curva S, Progresso, Cronograma, RDO) | Semanal | `obra.dataCorte` |
| Financeiro (Curva S VA, Controle de Medição) | Mensal | `obra.dataCorteFinanceiro` |
| Custo (quando existir) | Mensal, junto com o financeiro | — |

O painel avisa quando um dado está desatualizado além da cadência esperada (aba Obra →
Conferência dos dados): mais de 10 dias sem corte físico, ou mais de 35 dias sem corte
financeiro (`LIMIAR_DIAS_FISICO`/`LIMIAR_DIAS_FINANCEIRO` em `js/core.js`).
