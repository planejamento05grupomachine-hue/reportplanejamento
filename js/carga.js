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
    Object.entries(nomes).forEach(([tipo, nome]) => confere({ curva: 'Curva S', mensal: 'Progresso mensal', tarefas: 'Progresso por tarefas', cronograma: 'Cronograma', rdos: 'PDF de RDOs' }[tipo] || tipo, codigoEm(nome), 'pelo nome do arquivo'));
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
        const ok = ult && Math.abs(ult.realizado - raiz.realizado) < 0.001;
        out.push([ok ? 'ok' : 'av', ok ? 'Curva S e Progresso por tarefas mostram o mesmo realizado.' : 'Curva S e Progresso por tarefas mostram realizados diferentes: confira se foram exportados no mesmo dia.']);
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
    if (d.rdos) {
      const r = d.rdos;
      const par = r.at(-1)?.atividades.filter(a => /paralis/i.test(a.situacao)).length || 0;
      out.push(['ok', `RDOs: ${r.length} relatórios (nº ${r[0].numero} a ${r.at(-1).numero}), de ${dBR(r[0].data)} a ${dBR(r.at(-1).data)}. ${r.filter(x => x.status === 'aprovado').length} aprovados, ${r.filter(x => x.status !== 'aprovado').length} em preenchimento.`]);
      // "207/2026" no RDO e "CT/207/2026" no cadastro são o mesmo contrato: compara só os dígitos. A obra já foi
      // conferida pelo cabeçalho do RDO; contrato diferente é aviso, não bloqueia a carga.
      const contr = r.at(-1).contrato, dig = s => String(s || '').replace(/\D/g, '');
      if (dig(contr) && dig(o.contrato) && dig(contr) !== dig(o.contrato)) out.push(['av', `O contrato do RDO (${contr}) não coincide com o do cadastro da obra (${o.contrato}). Confira o cadastro.`]);
      out.push([par ? 'av' : 'ok', par ? `${par} frentes paralisadas no último RDO; vão para Paralisações e restrições.` : 'Nenhuma frente paralisada no último RDO.']);
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
    ['curva', 'mensal', 'tarefas', 'rdos', 'cronograma', 'medicao'].forEach(k => { if (pacote[k]) ras[k] = pacote[k]; });
    // financeiro tem 3 subtipos (curva/mensal/tarefas) em lotes separados: funde em vez de substituir,
    // senão enviar só a Curva S financeira apagaria o Progresso por tarefas financeiro do mês anterior.
    if (pacote.financeiro) ras.financeiro = { ...(ras.financeiro || {}), ...pacote.financeiro };
    if (['curva', 'mensal', 'tarefas', 'rdos', 'cronograma'].some(k => pacote[k])) ras.dataCorte = corte;
    if (['financeiro', 'medicao'].some(k => pacote[k])) ras.dataCorteFinanceiro = corte;
    ras.atualizadoEm = hoje;
    ras.fontes = { ...(base.fontes || {}), ...fontes };
    delete ras.publicadoEm;
    if (!pacote.fotos && !temRascunho) ras.fotosProprias = false;
    return ras;
  }

  const api = { codigoEm, identidade, conferencia, estimarCorte, montarPacote, aplicarCarga };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Carga = api;
})(typeof window !== 'undefined' ? window : globalThis);
