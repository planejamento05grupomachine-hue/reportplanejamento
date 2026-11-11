# Notas de versão — Painel de Obras Machine

## 2026-11-10g · PowerPoint segue o corte do custo real; governança da taxa

- PowerPoint: a Curva S financeira e as barras do desembolso mensal usam o corte do custo real (fim do mês do report).
  A curva para no mês do report e o mês só leva asterisco quando é parcial.
- GOVERNANCA.md: regras de custo real e taxa de administração (obras por administração) fixadas em 10/11/2026.
## 2026-11-10g · PowerPoint segue o corte do custo real; governança da taxa

- PowerPoint: a Curva S financeira e as barras do desembolso mensal usam o corte do custo real (fim do mês do report).
  A curva para no mês do report e o mês só leva asterisco quando é parcial.
- GOVERNANCA.md: regras de custo real e taxa de administração (obras por administração) fixadas em 10/11/2026.
## 2026-11-10f · Taxa de administração pela regra do contrato

- Cadastro da obra: **Taxa de administração · % do valor agregado** e mobilização (obras por administração; 207: 8% e
  R$ 460.000).
- Dashboard: o previsto da linha da taxa é o teto acumulado da regra (mobilização + % do valor agregado das obras no
  Prevision, limitado ao contrato); a nota mostra quanto o saldo do contrato cobre da taxa da obra restante (saúde do
  contrato). Sem a regra no cadastro, o previsto continua sendo o avanço físico da obra.
## 2026-11-10f · Taxa de administração pela regra do contrato

- Cadastro da obra: **Taxa de administração · % do valor agregado** e mobilização (obras por administração; 207: 8% e
  R$ 460.000).
- Dashboard: o previsto da linha da taxa é o teto acumulado da regra (mobilização + % do valor agregado das obras no
  Prevision, limitado ao contrato); a nota mostra quanto o saldo do contrato cobre da taxa da obra restante (saúde do
  contrato). Sem a regra no cadastro, o previsto continua sendo o avanço físico da obra.
## 2026-11-10e · Revisão do report (obra 207): corte do mês, IDC, taxa e itens sem base

- **Custo real no fim do mês do report:** o report de outubro usa as baixas até 31/10, inclusive o realizado por etapa
  (a planilha passa a ser lida também pela CONC.APROP com a data da baixa). A aba Obra continua até a última baixa.
  Reenviar a planilha de custo real para gravar o realizado por etapa e mês.
- **IDC = valor agregado ÷ custo real** na mesma data, quando a Curva S financeira do Prevision está na base da
  planilha (±2%). Sem planilha, vale o IDC da Gestão de Custos do Prevision.
- **Taxa de administração** no dashboard: medido ÷ contrato (Controle de Medição), com o avanço físico da obra como
  previsto (base da medição).
- **Itens sem linha de base** vão para o bloco de acompanhamento, sem seta de desvio.
## 2026-11-10e · Revisão do report (obra 207): corte do mês, IDC, taxa e itens sem base

- **Custo real no fim do mês do report:** o report de outubro usa as baixas até 31/10, inclusive o realizado por etapa
  (a planilha passa a ser lida também pela CONC.APROP com a data da baixa). A aba Obra continua até a última baixa.
  Reenviar a planilha de custo real para gravar o realizado por etapa e mês.
- **IDC = valor agregado ÷ custo real** na mesma data, quando a Curva S financeira do Prevision está na base da
  planilha (±2%). Sem planilha, vale o IDC da Gestão de Custos do Prevision.
- **Taxa de administração** no dashboard: medido ÷ contrato (Controle de Medição), com o avanço físico da obra como
  previsto (base da medição).
- **Itens sem linha de base** vão para o bloco de acompanhamento, sem seta de desvio.
## 2026-11-10d · Custo real pela planilha de orçamento (obra 207)

O avanço financeiro real de obra administrada passa a vir da **planilha de orçamento cliente da Machine**
("REVISAO DE ORCAMENTO REVnn (Cliente)", abas FÍS X FIN e LANÇ.FIN), no lugar da Curva S financeira do Prevision.

- Novo documento em Alimentar: **Custo real (planilha de orçamento)**. O painel reconhece a planilha pelas abas, lê
  previsto e realizado mês a mês (LB2), o realizado por etapa e a data da última baixa, e confere se as etapas somam o
  mesmo que a curva. Vale nos dois tipos de envio; lote só financeiro propõe a última baixa como data de corte.
- Report: com a planilha, as folhas de valor agregado dão lugar a **Financeiro (previsto x realizado)** (cartões e
  Curva S financeira em % da projeção) e **Financeiro — mês a mês e por etapa** (tabelas e desembolso mensal em R$).
  O PowerPoint sai com os dois gráficos nativos.
- Dashboard: o cartão "Avanço financeiro (acum.)" usa o custo real, com o previsto para a mesma data.
- Aba Obra: quadro "Financeiro — previsto × realizado".
- Manual de alimentação: documento novo e passo na rotina semanal. Obras sem a planilha não mudam.
## 2026-11-10c · Report coerente com as ferramentas

Revisão completa feita com Sienge, Prevision, Diário de Obra e o próprio painel. A régua do avanço da obra é sempre a
**perspectiva física (duração) do Prevision**.

**Números e regras**
- Farol de prazo compara o índice como ele aparece (2 casas): o mesmo número nunca tem duas cores.
- Prazo com dois números, cada um com o seu nome: *Hoje: N dias de atraso* (prazo ganho) e *Variação do término*
  (cronograma × contrato). Farol verde com alguns dias atrás do plano aparece como "N dias, na tolerância".
- Contrato vencido aparece como "Vencido há N dias" (antes, "A vencer 0 dias").
- Dashboard mostra a data da última medição física quando ela é anterior ao corte.
- Tabela Previsto × Realizado: marcos, aditivos condicionados e taxa de administração num bloco à parte, sem setas de
  desvio; nome da obra pelo cadastro; a tabela compacta sozinha até caber na folha (nada cortado no PDF).
- Medições: nota explicando que a "Medição Machine realizada" é antes dos impostos; entrada de mobilização identificada;
  boletim de medição em análise com selo; "Total da obra" só quando difere do contrato.
- Mês da capa automático (corte até o dia 15 = mês anterior), com a escolha manual mantida.

**Desenho**
- Fotos das frentes na largura da coluna, sem moldura.
- Portfólio na paleta da marca; linha de restrições só quando o mapa de restrições está em uso; "Obras em dia" no lugar.
- Desvio positivo em verde na tabela da EAP.

**Funcionamento**
- Login tenta de novo quando o GitHub Pages devolve erro passageiro (5xx); o arquivo de restrições é opcional.
- README e GOVERNANCA atualizados (sincronização na sexta 14:00, PowerPoint nativo, regras de coerência).

**Dados atualizados em rascunho no mesmo dia** (pelo próprio painel, sem publicar)
- 208: Controle de Medição REV4 (medição de setembro liberada no Sienge) e carga do Prevision de 10/11.
- 198: planta do porcelanato sem a barra de rolagem e carga do Prevision de 10/11 (nova linha de base).

**Pendências conhecidas**
- Token do GitHub do robô de sincronização (segredo `PAINEL_GH_TOKEN`) expirado: a rotina de sexta falha até renovar.
- RDOs no painel até meados de outubro: falta enviar o PDF exportado do Diário de Obra.
- Leitura direta do Sienge e do Diário de Obra depende dos usuários de API.
