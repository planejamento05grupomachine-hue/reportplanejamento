# Sincronização semanal Prevision → Painel de Obras Machine

Toda quarta-feira às 07:15 (America/Sao_Paulo) a rotina coleta no Prevision os **Dados físicos (%)** e os **Dados
financeiros — Valor Agregado** das obras configuradas, confere com as mesmas regras da tela **Alimentar** (mais estritas,
porque ninguém revisa) e grava a carga como **rascunho**. **Publicar para o cliente continua manual**, na tela da obra.

RDOs, fotos, mapas de avanço e Controle de Medição ficam fora: a carga automática não mexe neles nem nas suas datas, e
também não altera cadastro, prazos contratuais ou textos.

## Estado em 27/10/2026

| | Situação |
|---|---|
| Implementado | Coleta pela API oficial e pela exportação da interface, leitura com os parsers do painel, validação, gravação condicional do rascunho, releitura do rascunho, conferência do site, workflow semanal, testes |
| Testado com dados fictícios | 24 testes automatizados (`node --test "sync/test/*.test.cjs"`) e, no navegador, o painel abrindo o rascunho gravado pela rotina (cofre fictício, contas Administrador e Diretoria) |
| Testado com dados reais (obra 198) | Exportações reais coletadas e **simulação** dos dois conjuntos sem bloqueio · navegador e Node leem os mesmos arquivos com o mesmo resultado (SHA-256 dos dados, data de corte e conferência iguais) · **API oficial**: projetos e ids confirmados, equivalência API × exportação comprovada (ver abaixo) e simulação do Valor Agregado pela API sem bloqueio |
| **Não testado** | Gravação real no painel (faltam os segredos do GitHub e da conta da automação) · exportação automática por Playwright contra o Prevision (falta a sessão salva; os seletores foram conferidos na página real, o roteiro não rodou) |
| **Agendamento** | **Inativo.** O workflow só roda agendado com a variável `SYNC_ATIVO = true`. Não ative antes de uma execução manual real concluída e conferida |

## Arquitetura e por quê

- **Executor: GitHub Actions** (`.github/workflows/sync-prevision.yml`). O painel já grava pelo GitHub (cada gravação é
  um commit que o GitHub Pages publica); a rotina usa o mesmo caminho, com um token só deste repositório.
- **Reaproveitamento:** a rotina roda no Node os mesmos arquivos do painel — `js/parsers.js` (leitura das planilhas),
  `js/core.js` (cálculo), `js/carga.js` (conferência, data de corte e fusão da carga no rascunho) e `js/cofre.js`
  (criptografia). `js/carga.js` e `js/cofre.js` saíram de `js/app.js` e `js/api.js` sem mudança de comportamento (salvo
  a correção em "Mudanças no painel"), e o SheetJS é o mesmo arquivo que a tela Alimentar baixa (cdnjs 0.18.5, conferido
  por SHA-256).
- **Fonte `auto` (padrão), por conjunto:**
  - **Valor Agregado → API oficial** (`https://api.prevision.com.br`, token Bearer), nas obras em que a equivalência com
    a exportação foi comprovada (`api.equivalenciaValidada` em `sync/obras.json`; hoje, a 198). Não depende de navegador
    nem de sessão.
  - **Dados físicos → exportação pela interface** (Playwright), porque a API não tem o Progresso por tarefas nem o
    Cronograma com EAP e "Linha", que o painel exige. Os arquivos são os mesmos da alimentação manual, lidos pelos mesmos
    parsers.
  - Obras sem equivalência comprovada usam a exportação nos dois conjuntos.
- **Login do Prevision na exportação:** a tela de login tem **reCAPTCHA Enterprise**. A rotina **não** digita senha e
  não tenta passar pelo captcha: reaproveita uma sessão aberta por uma pessoa (`node sync/sessao.cjs`), guardada como
  segredo. Quando a sessão vence, o conjunto físico falha com `SESSAO_PREVISION_EXPIRADA` (nada dele é gravado) e o
  Valor Agregado pela API segue normalmente. **Ainda não se sabe quanto tempo a sessão dura**: o funcionamento semanal
  desassistido do físico só pode ser afirmado depois de algumas semanas de execução real.

### O que vem de onde

| Relatório | Uso no painel | Obrigatório | Exportação | API oficial |
|---|---|---|---|---|
| Curva S física | Curva S, avanço, IDP | sim | Dashboard · Física (Duração) · Percentual | `daily-progress` physical/percentage + `measurement_tasks` — **equivalente na 198** |
| Progresso mensal físico | barras por mês, ritmo, projeção | sim na rotina¹ | Dashboard · Progresso Mensal | `monthly-progress` — **idêntico na 198** |
| Progresso por tarefas | avanço por frente e etapa, pesos | sim | Dashboard · período da obra inteira | **não existe** |
| Cronograma | Gantt, atrasos, mapa de avanço | sim na rotina¹ | Cronograma · Exportar · Excel · data de referência hoje | **não existe** |
| Curva S financeira (VA) | PV, EV, SPI | sim | Dashboard · Econômica · Moeda (R$) | `daily-progress` economic/monetary + `measurement_tasks` — **equivalente na 198** |
| Progresso mensal financeiro | guardado | opcional | idem | `monthly-progress` — **idêntico na 198** |
| Progresso por tarefas financeiro | guardado | fora da rotina | — | não existe |

¹ Na tela Alimentar são opcionais; a rotina exige os quatro físicos juntos (a rotina semanal do Manual de alimentação
manda exportar os quatro no mesmo dia), para nunca misturar arquivos de datas diferentes. Como a física vem toda da
exportação, curva e mensal físicos não são misturados com a API.

## Evidências da coleta real (obra 198, 27/10/2026)

1. **Perspectiva física.** Na perspectiva Econômica, a Curva S e o Progresso por tarefas dão 80,19% de realizado, mas o
   Cronograma (Gantt, ponderado por duração) dá 63,54%, e só 192 de 410 linhas do Cronograma ligam às tarefas. Na
   perspectiva **Física (Duração)** tudo fecha: 63,54% nos três e 410 de 410 linhas ligadas. Por isso
   `exportacao.fisico.perspectiva = physical`. O financeiro é Econômica + Moeda (a Física fica desabilitada em R$).
2. **Período das tarefas.** O Progresso por tarefas vem filtrado pelo mês corrente: a raiz soma 9,8% em vez de 100%
   (o próprio Manual de alimentação manda exportar sem filtro). A rotina define o período da obra inteira e a validação
   recusa tarefas cuja raiz não some 100%. Trocar Percentual ↔ Moeda volta o filtro para o mês corrente, então o
   período é definido depois de escolher a visão.
3. **Curva S diária.** O Prevision exporta a Curva S com um ponto por dia (535 pontos), qualquer que seja o botão
   Diária/Mensal do gráfico. A conferência "Progresso mensal × Curva S" comparava com o **primeiro** ponto de cada mês e
   recusava 12 de 18 meses de uma exportação correta; passou a comparar com o **último** ponto do mês.
4. **Realizado da Curva S.** Na exportação, o realizado acumulado aparece só nos dias de medição (0 nos demais). Os 68
   dias com realizado são exatamente as 68 datas `measured_in` da API, inclusive medições sem avanço; o adaptador da
   API reproduz isso.
5. **Equivalência API × exportação (mesmo dia):** 535 datas iguais nas duas curvas, diferença máxima de 3,7e-7 (fração)
   e R$ 0,0000002 (a exportação arredonda na 8ª casa); Progresso mensal físico e financeiro idênticos (18 meses); data
   da última medição igual (23/10/2026). Comando: `node sync/comparar-api.cjs --obra 198 --dir <exportações do dia>`.
6. **Natureza.** Os arquivos físicos e financeiros têm o mesmo nome e o mesmo cabeçalho (o segundo download vira
   "(1)"). A natureza vem do modo de coleta (pasta `fisico`/`financeiro`, ou parâmetros da API), e a validação confere a
   unidade (fração × R$).
7. **Datas registradas à parte:** coleta (hora da execução), corte físico 27/10/2026 (regra do painel: o dia em que o
   previsto da Curva S alcança o previsto do Cronograma, que o Prevision calcula para o dia da exportação), última medição
   no Prevision 23/10/2026, corte financeiro 23/10/2026 (último valor agregado).

## Vínculo das obras (`sync/obras.json`)

Vínculo explícito: id no painel, código, id do projeto no Prevision (o mesmo na interface e na API — conferido),
SHA-256 do nome do projeto (o repositório é público: nomes de obra e cliente não entram em claro), habilitada,
relatórios, parâmetros de exportação e a equivalência da API. Na execução, o projeto aberto no Prevision tem de ter o id
configurado, e a tarefa raiz exportada tem de ser a mesma da carga atual do painel.

| Painel | Prevision (interface = API) | Vínculo | Habilitada | Fonte no `auto` | Observação |
|---|---|---|---|---|---|
| 198 | 32419 | confirmado | sim | físico: exportação · VA: API | exportações e API conferidas com dados reais |
| 207 | 37748 | confirmado | sim | exportação | exportação automática simulada sem bloqueio em 28/10/2026 |
| 208 | 40210 | confirmado | sim | exportação | exportação automática simulada sem bloqueio em 28/10/2026 |
| 211 | 41940 | confirmado | sim (só físico) | exportação | VA desligado: no Prevision a visão econômica está sem dados (orçamento não vinculado ao cronograma) |
| — | 42195 (210), 42528 (212) | fora | — | — | projetos do Prevision sem obra no painel: não são importados |

Para habilitar 207/208/211: exportar no mesmo dia os arquivos da obra (com os parâmetros acima), simular com
`--fonte arquivos`, rodar `comparar-api.cjs` e, com diferenças nulas, registrar `api.equivalenciaValidada` e
`"habilitada": true`. Conferência local com nomes: `PAINEL_EMAIL=… PAINEL_SENHA=… PREVISION_API_TOKEN=… node sync/vinculos.cjs`.

### Como a exportação anda pela interface (conferido em 28/10/2026)

- `/app/projects` abre a tela inicial; a lista de obras vem do cartão da etapa "Obra" (o "Executar" é desenho).
- Se o Dashboard avisar "A sua dashboard está desatualizada", o robô clica em **Atualizar** antes de exportar (só
  recalcula o painel do Prevision). Sem isso, o Dashboard pode ficar atrás do Cronograma (211: 5,80% × 5,93%).
- O calendário do Progresso por tarefas é limitado ao período do projeto: no limite, o robô fica com a data extrema
  permitida e confere o período aplicado (até 3 tentativas). A validação ainda exige a raiz somando 100%.
- Cada conjunto falha sozinho: projeto sem a visão econômica (`SEM_DADOS_PREVISION`) não impede o físico.
- Para diagnosticar localmente: `SYNC_CAPTURAS=<pasta>` grava uma captura da tela onde a exportação parou (nunca no
  GitHub Actions); `node sync/diagnostico-tela.cjs` mostra o que a sessão salva enxerga.

## O que é validado antes de gravar

Tudo o que a tela Alimentar confere (obra pelo nome do arquivo e pela tarefa raiz, Progresso mensal × Curva S, base
crescente fechando em 100%, pesos das tarefas, Curva S × tarefas × Cronograma, árvore expandida…), com uma diferença: na
tela um aviso deixa o administrador decidir; aqui **todo aviso bloqueia**, salvo três informativos (IDPM zerado, posição
estimada do cronograma, responsável "Pendente de contratação"). Além disso:

- relatórios obrigatórios presentes; tipo de cada arquivo pelo cabeçalho; nada duplicado; arquivo financeiro com o
  código de outra obra no nome é recusado;
- unidade: físico em fração (0–1), financeiro em reais; valor em branco ≠ zero;
- Progresso por tarefas sem filtro de datas (raiz e pesos somando 100%);
- todos os arquivos de um conjunto coletados juntos (até 90 minutos);
- nada mais antigo que a carga atual (último realizado e data de corte);
- mesma linha de base da carga atual (senão bloqueia: nova linha de base, outra perspectiva ou outra obra — aceitar só
  com `aceitar_nova_base` numa execução manual, depois de conferir no Prevision);
- dados iguais aos da carga atual (a menos de arredondamento) = **inalterado**, sem commit.

Conjunto bloqueado ou com falha = a última carga válida daquele conjunto fica como está; o outro conjunto pode entrar
sozinho. Cada obra é processada à parte: a falha de uma não impede as outras.

## Gravação, publicação e o que cada situação quer dizer

- **Coleta concluída / parcial / falhou**: os dados de cada conjunto foram (ou não) obtidos e lidos.
- **Rascunho atualizado**: commit `Carga automática da obra N — corte AAAA-MM-DD (rascunho)`, relido do GitHub e
  conferido; depois a rotina espera o site (GitHub Pages) servir exatamente o arquivo gravado. O painel mostra nas
  fontes "… (automático, data)" e guarda em `sync` a origem de cada arquivo (nome, SHA-256, hora da coleta) ou da
  resposta da API.
- **Posição publicada**: não muda nunca pela rotina. O cliente continua vendo a última publicação até alguém clicar em
  **Publicar para o cliente**.
- **Inalterado / bloqueado / simulado**: nada gravado.

Proteções: uma execução por vez (`concurrency`); o commit só sai se a posição publicada, o rascunho, as chaves e os
acessos da obra continuarem iguais aos lidos no início (se alguém salvou pelo painel durante a coleta, a obra fica para a
próxima execução: `ALTERADO_DURANTE_COLETA`); a atualização da branch não é forçada; tempo limite e até 3 tentativas
em falhas de rede/servidor; sessão vencida ou token recusado param aquela fonte para todas as obras da execução.

## Segurança

- Nada sai em claro: o rascunho é cifrado com a chave interna do painel (AES-256-GCM, `js/cofre.js`), como na gravação
  manual. Planilhas e respostas da API só existem na pasta temporária do executor, apagada no fim.
- Log público do GitHub: só códigos de obra, situação e o nome das verificações, **sem números**. O relatório detalhado
  sai cifrado com a chave interna (artefato `relatorio-sync`, 30 dias); para ler:
  `PAINEL_EMAIL=… PAINEL_SENHA=… node sync/sincronizar.cjs --ler-relatorio relatorio-sync.bin`.
- Credenciais só em **segredos do GitHub Actions**; nada no JavaScript do site. O `GITHUB_TOKEN` do job só lê.

### Segredos (Settings → Secrets and variables → Actions → New repository secret)

| Segredo | O que é | Como obter |
|---|---|---|
| `PREVISION_API_TOKEN` | token da API oficial (Valor Agregado e conferências) | Prevision → Configurações → Token de API (perfil Administrador do Prevision). Já gerado em 27/10/2026: cole o valor no segredo |
| `PAINEL_GH_TOKEN` | token para gravar no repositório | GitHub → Settings → Developer settings → Fine-grained tokens: só este repositório, *Contents: Read and write*, validade curta (ex.: 90 dias) |
| `PAINEL_EMAIL` / `PAINEL_SENHA` | conta da automação no painel | No painel, **Acessos → criar acesso** com perfil **Diretoria** (lê tudo, inclusive rascunhos; não publica nem mexe em acessos). Use um e-mail próprio da automação |
| `PREVISION_SESSAO` | sessão do Prevision para a exportação (não é a senha) | Num computador com a conta do Prevision: `cd sync && npm install && npx playwright install chromium`, depois `node sync/sessao.cjs` e `gh secret set PREVISION_SESSAO < arquivo` |

Variáveis (aba *Variables*): `SYNC_ATIVO` = `true` liga o agendamento; `SYNC_MODO` = `simular` mantém o agendamento só
simulando (bom para as primeiras semanas).

## Operação

- **Executar agora:** Actions → *Sincronização Prevision* → *Run workflow* (obra vazia = todas as habilitadas;
  "Simulação" vem marcada; fonte `auto`).
- **Localmente**, com arquivos já exportados (`<pasta>/<obra>/fisico` e `<pasta>/<obra>/financeiro`):
  `node sync/sincronizar.cjs --obra 198 --fonte arquivos --dir <pasta> --simular` (com `--sem-painel`, simula sem
  credenciais do painel, sem comparar com a carga atual; `--detalhar` mostra os números, só no seu terminal).
- **Consultar falhas:** a execução fica vermelha quando algo foi bloqueado ou falhou (código 1) ou quando uma credencial
  ou a sessão precisa de atenção (código 2); o resumo diz a obra, o conjunto, a fonte e a verificação. O GitHub avisa
  por e-mail quem configurou o agendamento.
- **Desativar:** variável `SYNC_ATIVO` diferente de `true` (ou Actions → *Disable workflow*). Para tirar uma obra:
  `"habilitada": false`; para voltar o Valor Agregado à exportação: `api.equivalenciaValidada: null`.
- **Recuperar:**
  - `SESSAO_PREVISION_EXPIRADA` / `SEM_SESSAO_PREVISION`: renovar com `node sync/sessao.cjs` e atualizar o segredo;
  - `TOKEN_PREVISION`: gerar novo token no Prevision e atualizar `PREVISION_API_TOKEN`;
  - `TOKEN_GITHUB` / `PERMISSAO_GITHUB`: gerar novo token e atualizar `PAINEL_GH_TOKEN`;
  - `CREDENCIAL_PAINEL` / `PERFIL_SEM_ACESSO_INTERNO`: conferir a conta da automação (perfil Diretoria) e os segredos;
  - `LINHA_DE_BASE_DIFERENTE`: conferir no Prevision; se for uma nova linha de base legítima, executar manualmente com
    "Aceitar nova linha de base";
  - `ALTERADO_DURANTE_COLETA`: só executar de novo;
  - `EXPORTACAO_INTERFACE`: a tela do Prevision mudou; ajustar `sync/lib/prevision-export.cjs` ou alimentar à mão;
  - qualquer bloqueio: a tela **Alimentar** continua funcionando igual, com os mesmos arquivos.
- Desfazer uma carga automática: uma nova carga manual substitui o rascunho; a posição publicada nunca foi alterada.

Observações do GitHub: horários agendados podem atrasar alguns minutos; em repositório público sem atividade por 60 dias
o agendamento é suspenso (as cargas mantêm o repositório ativo).

## Testes

`node --test "sync/test/*.test.cjs"` (Node 22). Só dados fictícios: exportações geradas no formato real, API fictícia no
formato da especificação, cofre fictício no formato do painel e um GitHub em memória. Cobrem: rascunho gravado e
relido, publicação intacta, RDOs/mapas/medição preservados, simulação sem gravação, dados repetidos, obra errada,
relatório incompleto, tarefas com filtro, escala trocada, valores em branco, linha de base nova, dados mais antigos,
arquivos de coletas diferentes, sessão vencida (com e sem a API cobrindo o Valor Agregado), falha no meio da gravação,
alteração concorrente (na coleta e no instante da gravação), senha/token inválidos, vínculo pendente, isolamento entre
obras, API não validada, adaptador da API (escala, medições sem avanço, fechamento mensal) e verificação do site. O
workflow *Testes* roda a cada mudança em `js/` ou `sync/`.

## Mudanças no painel feitas para a rotina

- `js/cofre.js` (criptografia) e `js/carga.js` (conferência, data de corte e fusão da carga) saíram de `js/api.js` e
  `js/app.js`, para o navegador e a rotina usarem o mesmo código; `index.html` carrega os dois.
- Correção na conferência "Progresso mensal × Curva S": compara com o último ponto da Curva S em cada mês (antes: o
  primeiro). Com a curva diária que o Prevision exporta hoje, a conferência antiga recusava arquivos corretos; com uma
  curva de um ponto por mês, o resultado é o mesmo de antes.
