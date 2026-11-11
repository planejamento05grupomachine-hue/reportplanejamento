// ============================================================
// Painel de Obras Machine — regras da carga (Alimentar): conferência dos arquivos com a obra,
// data de corte e fusão da carga no rascunho.
// O mesmo arquivo serve a tela Alimentar (window.Carga, em js/app.js e js/api.js) e a sincronização
// automática no Node (module.exports, em sync/): as duas aplicam exatamente as mesmas regras.
// Depende de Core (js/core.js) na hora da chamada.
// ============================================================
(function (root) {
  'use strict';
  const core = () => root.Core;
  const clone = x => JSON.parse(JSON.stringify(x));

  // Código da obra pelo nome do arquivo ("Curva S - 207 - ...", "Cronograma_-_208_-_...") ou pelo nome da raiz ("208 - Fibrasa ...")
  const codigoEm = s => { const m = String(s || '').replace(/_/g, ' ').match(/(?:^|[\s-])(\d{3,4})\s+-\s/); return m ? m[1] : null; };

  // imp: { dados, nomes, dataEstimada, corte } — o estado da importação (S.imp na tela)
  function identidade(o, imp) {
    const { pct } = core();
    const out = [], d = imp.dados, nomes = imp.nomes || {}, cod = String(o.codigo);
    const raizObra = norm => { const r = (o.tarefas || []).find(t => t.nivel === 1); return r ? norm(r.tarefa) : null; };
    const n = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const confere = (rotulo, achado, como) => {
      if (achado === null || achado === undefined) return;
      out.push(achado === cod ? ['ok', `${rotulo}: obra ${cod} (${como}).`] : ['er', `${rotulo} é da obra ${achado} (${como}), não da obra ${cod}. Arquivo não aplicado.`]);
    };
    Object.entries(nomes).forEach(([tipo, nome]) => confere({ curva: 'Curva S', mensal: 'Progresso mensal', tarefas: 'Progresso por tarefas', cronograma: 'Cronograma', rdos: 'PDF de RDOs', custoReal: 'Planilha de custo real' }[tipo] || tipo, codigoEm(nome), 'pelo nome do arquivo'));
    const raizT = d.tarefas && d.tarefas.find(t => t.nivel === 1), raizC = d.cronograma && d.cronograma.find(l => l.nivel === 1);
    [['Progresso por tarefas', raizT && raizT.tarefa], ['Cronograma', raizC && raizC.nome]].forEach(([rot, nome]) => {
      if (!nome) return;
      const c = codigoEm(nome + ' ');
      if (c) confere(rot, c, 'pelo nome da tarefa raiz');
      else if (raizObra(n) && n(nome) !== raizObra(n)) out.push(['er', `${rot}: a tarefa raiz "${nome}" não é a da obra ${cod} ("${(o.tarefas || []).find(t => t.nivel === 1).tarefa}"). Arquivo não aplicado.`]);
    });
    if (raizT && raizC && n(raizT.tarefa) !== n(raizC.nome)) out.push(['er', 'Cronograma e Progresso por tarefas têm tarefas raiz diferentes: são de obras ou versões diferentes.']);
    if (d.rdos && d.rdos.length) { const c = codigoEm((d.rdos.at(-1).obra || '').replace(/^(\d{3,4})\s+(?!-)/, '$1 - ')); if (c) confere('PDF de RDOs', c, 'pelo cabeçalho do RDO'); }
    // Progresso mensal não traz identificação: confere com a Curva S (base acumulada mês a mês).
    // O semanal somado em meses reparte as semanas da virada do mês pelos dias: tolerância maior (até ~1,5 ponto na 207).
    const curva = d.curva || o.curva || [];
    if (d.mensal && curva.length) {
      const sem = d.mensal.some(m => m.origem === 'semanal'), tol = sem ? 0.02 : 0.002, nome = sem ? 'Progresso semanal' : 'Progresso mensal';
      let acc = 0, ruins = 0, comp = 0;
      // compara com o último ponto da Curva S no mês: o Prevision exporta a curva diária (um ponto por dia), e só o
      // fim do mês tem o acumulado do mês inteiro; numa curva com um ponto por mês, o último ponto é o único.
      const fimDoMes = mes => curva.filter(x => x.data.slice(0, 7) === mes).at(-1);
      d.mensal.forEach(m => { acc += m.base || 0; const p = fimDoMes(m.mes); if (p) { comp++; if (Math.abs((p.base || 0) - acc) > tol) ruins++; } });
      out.push(comp && !ruins ? ['ok', `${nome} confere com a Curva S (base acumulada ${sem ? 'equivalente' : 'igual'} em ${comp} meses).`] : ['er', `${nome} não confere com a Curva S${d.curva ? ' enviada' : ' da obra'} (${ruins} de ${comp} meses com base diferente): pode ser de outra obra ou de outra linha de base.`]);
    }
    if (d.cronograma && d.tarefas) {
      const rc = raizC, rt = raizT;
      if (rc && rt && Math.abs(rc.realizado - rt.realizado) > 0.001) out.push(['av', `Cronograma (${pct(rc.realizado, 2)}) e Progresso por tarefas (${pct(rt.realizado, 2)}) mostram realizados diferentes: exporte os dois no mesmo dia.`]);
    }
    return out;
  }

  function conferencia(o, imp) {
    const { pct, dBR } = core();
    const out = identidade(o, imp), d = imp.dados;
    if (d.curva) {
      const ult = [...d.curva].reverse().find(p => p.realizado > 0);
      const fim = d.curva.at(-1);
      out.push([Math.abs(fim.base - 1) < 0.001 ? 'ok' : 'av', `Curva S: ${d.curva.length} pontos, de ${dBR(d.curva[0].data)} a ${dBR(fim.data)}. Base fecha em ${pct(fim.base, 2)}. Último realizado ${ult ? pct(ult.realizado, 2) : '—'}.`]);
      const mono = d.curva.every((p, i) => !i || p.base >= d.curva[i - 1].base - 1e-6);
      out.push([mono ? 'ok' : 'er', mono ? 'Curva base sempre crescente.' : 'A curva base diminui em algum mês: confira a exportação.']);
    }
    // Curva S financeira (valor agregado): na empreitada global ela tem de estar na categoria "Recebíveis do projeto" do
    // Dashboard do Prevision (valor de venda = base do contrato); em "Custos do projeto" a base é menor que o contrato.
    // Na administração (custo real ou taxa no cadastro) a categoria certa é a de custos. Só aviso: não bloqueia a carga.
    const finCurva = d.financeiro && d.financeiro.curva;
    const contratoTotal = ((d.medicao || o.medicao || {}).resumo || {}).totalContrato;
    const administracao = !!(o.custoReal || d.custoReal);
    if (finCurva && finCurva.length && contratoTotal > 0 && !administracao) {
      const baseCurva = Math.max(finCurva.at(-1).base || 0, finCurva.at(-1).previsto || 0), r = baseCurva / contratoTotal, m = core().moeda;
      out.push(Math.abs(r - 1) <= 0.02
        ? ['ok', `Curva S financeira na base do contrato (${m(baseCurva)}): categoria Recebíveis do projeto.`]
        : ['av', `A Curva S financeira está em ${m(baseCurva)} e o contrato em ${m(contratoTotal)} (${pct(r, 1)}): em obra de empreitada, exporte o Dashboard do Prevision na categoria "Recebíveis do projeto" (valor de venda), não em "Custos do projeto".`]);
    }
    if (d.mensal) {
      const soma = d.mensal.reduce((s, m) => s + (m.base || 0), 0);
      out.push([Math.abs(soma - 1) < 0.002 ? 'ok' : 'av', `Progresso ${d.mensal.some(m => m.origem === 'semanal') ? 'semanal (somado por mês)' : 'mensal'}: ${d.mensal.length} meses; a base soma ${pct(soma, 2)}.`]);
      if (d.mensal.every(m => !m.idpm)) out.push(['av', 'IDPM veio zerado no arquivo; o painel calcula o IDP.']);
    }
    if (d.tarefas) {
      const raiz = d.tarefas.find(t => t.nivel === 1);
      const folhas = d.tarefas.filter(t => t.folha);
      const soma = folhas.reduce((s, t) => s + (t.previsto || 0), 0);
      out.push(['ok', `Progresso por tarefas: ${d.tarefas.length} linhas, ${folhas.length} tarefas finais, ${Math.max(...d.tarefas.map(t => t.nivel))} níveis de EAP. Realizado total ${raiz ? pct(raiz.realizado, 2) : '—'}.`]);
      out.push([Math.abs(soma - 1) < 0.001 ? 'ok' : 'av', `Pesos das tarefas finais somam ${pct(soma, 2)}${Math.abs(soma - 1) < 0.001 ? '' : ' (arredondamento do Prevision; o painel normaliza)'}.`]);
      if (d.curva && raiz) {
        const ult = [...d.curva].reverse().find(p => p.realizado > 0);
        // obra que ainda não teve medição: a Curva S não traz realizado nenhum e as tarefas estão em 0% — é o mesmo realizado
        const semMedicao = !ult && (raiz.realizado || 0) < 0.0005;
        const ok = semMedicao || (ult && Math.abs(ult.realizado - raiz.realizado) < 0.001);
        out.push([ok ? 'ok' : 'av', semMedicao ? 'Obra ainda sem medição: Curva S e Progresso por tarefas sem realizado.' : ok ? 'Curva S e Progresso por tarefas mostram o mesmo realizado.' : 'Curva S e Progresso por tarefas mostram realizados diferentes: confira se foram exportados no mesmo dia.']);
      }
    }
    if (d.cronograma) {
      const c = d.cronograma, raiz = c.find(l => l.nivel === 1);
      const tar = d.tarefas || o.tarefas || [];
      const casam = c.filter(l => tar[l.linha - 1] && String(tar[l.linha - 1].tarefa).trim().toLowerCase() === l.nome.trim().toLowerCase()).length;
      out.push(['ok', `Cronograma: ${c.length} linhas. Previsto ${raiz ? pct(raiz.previsto, 2) : '—'}, realizado ${raiz ? pct(raiz.realizado, 2) : '—'}; término ${raiz ? dBR(raiz.fim) : '—'} (base ${raiz ? dBR(raiz.fimBase) : '—'}).`]);
      if (imp.dataEstimada) out.push(['av', `Posição estimada em ${dBR(imp.dataEstimada)} a partir do previsto do Prevision; o painel usa ${dBR(imp.corte)}. Ajuste a data de corte abaixo se precisar.`]);
      out.push([casam === c.length ? 'ok' : 'av', `${casam} de ${c.length} linhas ligadas ao Progresso por tarefas (pela posição na árvore e pelo nome).`]);
      if (tar.length && c.length < tar.length * 0.9) out.push(['av', `A exportação veio com a árvore recolhida (${c.length} de ${tar.length} linhas). Exporte com tudo expandido para o Gantt completo.`]);
      const pend = c.filter(l => /pendente de contrata/i.test(l.responsaveis || '') && l.realizado < 0.9995).length;
      if (pend) out.push(['av', `${pend} linhas com responsável "Pendente de contratação"; vão para Atenção no report.`]);
    }
    if (d.custoReal) {
      const c = d.custoReal, soma = (c.etapas || []).reduce((s, e) => s + (e.realizado || 0), 0);
      out.push(['ok', `Custo real (planilha de orçamento): ${c.lancamentos} lançamentos, última baixa em ${dBR(c.ultimaBaixa)}. Realizado ${core().moeda(c.realizadoTotal)} de ${core().moeda(c.total)} previstos (LB2).`]);
      out.push([Math.abs(soma - c.realizadoTotal) < 1 ? 'ok' : 'av', Math.abs(soma - c.realizadoTotal) < 1 ? 'Realizado por etapa soma o mesmo que a curva mensal.' : `Realizado por etapa (${core().moeda(soma)}) difere da curva mensal (${core().moeda(c.realizadoTotal)}): confira as abas PLANILHA GERAL e FÍS X FIN.`]);
      if (o.dataCorte && c.ultimaBaixa && c.ultimaBaixa < core().addDias(o.dataCorte, -10)) out.push(['av', `A última baixa da planilha (${dBR(c.ultimaBaixa)}) é bem anterior ao corte físico (${dBR(o.dataCorte)}): atualize a planilha com as contas pagas recentes.`]);
    }
    if (d.rdos) {
      const r = d.rdos;
      const par = r.at(-1)?.atividades.filter(a => /paralis/i.test(a.situacao)).length || 0;
      out.push(['ok', `RDOs: ${r.length} relatórios (nº ${r[0].numero} a ${r.at(-1).numero}), de ${dBR(r[0].data)} a ${dBR(r.at(-1).data)}. ${r.filter(x => x.status === 'aprovado').length} aprovados, ${r.filter(x => x.status !== 'aprovado').length} em preenchimento.`]);
      // "207/2026" no RDO e "CT/207/2026" no cadastro são o mesmo contrato: compara só os dígitos. A obra já foi
      // conferida pelo cabeçalho do RDO; contrato diferente é aviso, não bloqueia a carga.
      const contr = r.at(-1).contrato, dig = s => String(s || '').replace(/\D/g, '');
      if (dig(contr) && dig(o.contrato) && dig(contr) !== dig(o.contrato)) out.push(['av', `O contrato do RDO (${contr}) não coincide com o do cadastro da obra (${o.contrato}). Confira o cadastro.`]);
      out.push([par ? 'av' : 'ok', par ? `${par} frentes paralisadas no último RDO; vão para Paralisações no RDO (aba Obra).` : 'Nenhuma frente paralisada no último RDO.']);
    }
    return out;
  }

  // Data de corte proposta: a do último RDO; com cronograma, o dia em que o previsto da Curva S alcança o
  // "Previsto (%)" da raiz (o Prevision calcula esse previsto para o dia da exportação), nunca depois de hoje.
  function estimarCorte(dados, obra, hoje, corteAtual) {
    let corte = corteAtual || null, dataEstimada = null;
    if (dados.rdos) corte = dados.rdos.map(x => x.data).filter(Boolean).sort().at(-1);
    if (dados.cronograma) {
      const raiz = dados.cronograma.find(l => l.nivel === 1);
      const tmp = { ...obra, curva: dados.curva || obra.curva, tarefas: dados.tarefas || obra.tarefas };
      const est = raiz ? core().estimaDataRef(tmp, raiz.previsto) : null;
      corte = est ? (est > hoje ? hoje : est) : (corte || hoje);
      dataEstimada = est;
    }
    return { corte, dataEstimada };
  }

  // Pacote da carga a partir dos dados lidos (o cronograma leva o nome do arquivo e a data de referência)
  function montarPacote(dados, corte, arqCrono) {
    return { ...dados, cronograma: dados.cronograma ? { arquivo: arqCrono, linhas: dados.cronograma, dataRef: corte } : undefined };
  }

  // Funde a carga na base (rascunho, ou a posição publicada quando não há rascunho). Fotos ficam com quem chama.
  function aplicarCarga(base, pacote, corte, fontes, hoje, { temRascunho } = {}) {
    const ras = clone(base);
    // indicesPrevision (IDC/IDP da Gestão de Custos do Prevision): tem data de referência própria, não mexe no corte
    // custoReal: planilha de orçamento cliente (FÍS X FIN), substitui a anterior inteira
    ['curva', 'mensal', 'tarefas', 'rdos', 'cronograma', 'medicao', 'indicesPrevision', 'custoReal'].forEach(k => { if (pacote[k]) ras[k] = pacote[k]; });
    // financeiro tem 3 subtipos (curva/mensal/tarefas) em lotes separados: funde em vez de substituir,
    // senão enviar só a Curva S financeira apagaria o Progresso por tarefas financeiro do mês anterior.
    if (pacote.financeiro) ras.financeiro = { ...(ras.financeiro || {}), ...pacote.financeiro };
    if (['curva', 'mensal', 'tarefas', 'rdos', 'cronograma'].some(k => pacote[k])) ras.dataCorte = corte;
    if (['financeiro', 'medicao', 'custoReal'].some(k => pacote[k])) ras.dataCorteFinanceiro = corte;
    ras.atualizadoEm = hoje;
    ras.fontes = { ...(base.fontes || {}), ...fontes };
    delete ras.publicadoEm;
    if (!pacote.fotos && !temRascunho) ras.fotosProprias = false;
    if (['curva', 'mensal', 'tarefas', 'rdos', 'cronograma'].some(k => pacote[k])) registrarHistorico(ras, hoje);
    return ras;
  }

  // Histórico de cortes: a posição de cada carga física fica guardada na obra (um registro por data de corte; recarga
  // da mesma data substitui). Mostra como o atraso e o término projetado evoluíram, mesmo depois de um replanejamento
  // reescrever a Curva S. Até 156 registros (3 anos de cargas semanais). Falha de cálculo não impede a carga.
  const LIMITE_HISTORICO = 156;
  function registrarHistorico(ras, hoje) {
    const C = core();
    const temDados = (ras.curva || []).some(p => p && p.data) && (ras.tarefas || []).some(t => t && t.nivel === 1);
    if (!C || !C.calc || !temDados) return;
    let r;
    try { r = C.calc(ras); } catch (e) { return; }
    const g = r.prazoGanho;
    const item = {
      corte: r.corte, real: r.real, prev: r.prevCorte, idp: r.idp,
      atraso: g ? g.atraso : null, idpT: g ? g.idpT : null, farol: r.sem.e,
      fimCron: r.prazo.fimCron, fimBase: r.crono ? r.crono.fimBase : null,
      projecao: r.projecao, projecaoFaixa: r.projecaoFaixa, registradoEm: hoje,
    };
    const h = (ras.historico || []).filter(x => x.corte !== item.corte);
    h.push(item);
    h.sort((a, b) => a.corte < b.corte ? -1 : 1);
    ras.historico = h.slice(-LIMITE_HISTORICO);
  }

  const api = { codigoEm, identidade, conferencia, estimarCorte, montarPacote, aplicarCarga, registrarHistorico };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Carga = api;
})(typeof window !== 'undefined' ? window : globalThis);
