// ============================================================
// Machine · Painel de Obras — motor de cálculo e gráficos SVG.
// Sem DOM fora das funções de gráfico: o mesmo arquivo serve o app,
// o report e (na fase 2) a geração no servidor.
// Percentuais internos sempre em fração (0–1).
// ============================================================
(function (root) {
  'use strict';

  // ---------- formatação pt-BR (feita à mão, previsível em qualquer ambiente) ----------
  const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const MES_L = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fmtNum(v, d = 1) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    const neg = v < 0; const a = Math.abs(v).toFixed(d);
    let [i, f] = a.split('.');
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  const pct = (v, d = 1) => v === null || v === undefined ? '—' : fmtNum(v * 100, d) + '%';
  const pp = (v, d = 1) => v === null || v === undefined ? '—' : (v > 0.00005 ? '+' : '') + fmtNum(v * 100, d) + ' p.p.';
  const dia = iso => new Date(iso + 'T12:00:00');
  const iso = d => d.toISOString().slice(0, 10);
  const diff = (a, b) => Math.round((dia(b) - dia(a)) / 864e5); // b − a, em dias
  const addDias = (a, n) => iso(new Date(dia(a).getTime() + n * 864e5));
  const dBR = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—';
  const dCurto = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) : '—';
  const mesCurto = s => MES[+s.slice(5, 7) - 1] + '/' + s.slice(2, 4);
  const mesLongo = s => MES_L[+s.slice(5, 7) - 1] + ' de ' + s.slice(0, 4);
  const fimDoMes = m => { const [y, mo] = m.split('-').map(Number); return iso(new Date(Date.UTC(y, mo, 0, 12))); };
  const SEM = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const diaSemana = s => SEM[dia(s).getDay()];

  // "ARMAZÉM COSTA DO SAUÍPE  - 18.474,00 m²" → { nome: "Armazém Costa do Sauípe", area: "18.474,00 m²" }
  const MINUSC = new Set(['de', 'do', 'da', 'dos', 'das', 'e', 'em', 'a', 'o', 'para', 'com']);
  function nomeBonito(s) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    let area = null;
    const m = s.match(/\s*-\s*([\d.,]+\s*m²)\s*$/);
    if (m) { area = m[1]; s = s.slice(0, m.index); }
    const letras = s.replace(/[^A-Za-zÀ-ú]/g, '');
    if (letras && letras === letras.toUpperCase()) {
      s = s.toLowerCase().split(' ').map((w, i) => (i > 0 && MINUSC.has(w)) ? w : w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      s = s.replace(/\bSpci\b/g, 'SPCI').replace(/\bSpk\b/g, 'SPK').replace(/\bSpda\b/g, 'SPDA').replace(/\bArmazem\b/g, 'Armazém').replace(/\bItapua\b/g, 'Itapuã');
    }
    return { nome: s, area };
  }

  // ---------- semáforo ----------
  // IDP = realizado ÷ previsto na data de corte. Faixas configuráveis por obra.
  const FAIXAS = { ok: 0.95, atencao: 0.85 };
  // Situação de prazo (gestão de projetos: índice de desempenho de prazo, IDP = realizado ÷ planejado).
  // Simétrica: a obra pode estar adiantada, em dia, em atenção ou atrasada. Faixas configuráveis por obra.
  function semaforo(idp, faixas = FAIXAS) {
    if (idp === null || isNaN(idp)) return { k: 'neutro', t: 'Sem dados', e: 'sem-dados' };
    if (idp >= (faixas.adiantada || 1.05)) return { k: 'ok', t: 'Adiantada', e: 'adiantada' };
    if (idp >= faixas.ok) return { k: 'ok', t: 'Em dia', e: 'em-dia' };
    if (idp >= faixas.atencao) return { k: 'atencao', t: 'Atenção', e: 'atencao' };
    return { k: 'critico', t: 'Atrasada', e: 'atrasada' };
  }
  // Diferença para o planejado em linguagem comum (pontos percentuais do avanço total da obra).
  // Dentro da tolerância conta como "em linha", para não chamar de desvio um arredondamento.
  const TOLERANCIA = 0.005; // 0,5 ponto
  function comparaPlano(d) {
    const a = Math.abs(d || 0);
    if (a < TOLERANCIA) return { dir: 0, curto: 'Em linha', longo: 'em linha com o planejado', seta: '', cls: 'ok' };
    const n = fmtNum(a * 100, 1) + (a * 100 >= 1.95 ? ' pontos' : ' ponto');
    return d < 0
      ? { dir: -1, curto: `${fmtNum(a * 100, 1)} pts abaixo`, longo: `${n} abaixo do planejado`, seta: '▼', cls: 'crit' }
      : { dir: 1, curto: `${fmtNum(a * 100, 1)} pts acima`, longo: `${n} acima do planejado`, seta: '▲', cls: 'ok' };
  }

  // ---------- curva S ----------
  // Pontos de fim de mês + ponto zero no início do cronograma.
  function serieCurva(obra) {
    const ini = inicioCronograma(obra);
    const pts = [{ data: ini, base: 0, previsto: 0, realizado: 0 }, ...obra.curva.filter(p => p.data > ini)];
    return pts;
  }
  function inicioCronograma(obra) {
    const raiz = (obra.tarefas || []).find(t => t.nivel === 1);
    return raiz?.inicio || obra.curva[0]?.data;
  }
  function fimCronograma(obra) {
    const raiz = (obra.tarefas || []).find(t => t.nivel === 1);
    return raiz?.fim || obra.curva.at(-1)?.data;
  }
  // Interpola linearmente entre os pontos da curva
  function interp(pts, campo, data) {
    if (!pts.length) return null;
    if (data <= pts[0].data) return pts[0][campo];
    for (let i = 1; i < pts.length; i++) {
      if (data <= pts[i].data) {
        const a = pts[i - 1], b = pts[i];
        const f = diff(a.data, data) / Math.max(1, diff(a.data, b.data));
        return a[campo] + (b[campo] - a[campo]) * f;
      }
    }
    return pts.at(-1)[campo];
  }

  // ---------- EAP ----------
  // Fração do prazo da tarefa decorrida na data de corte (distribuição linear)
  function fracTempo(t, corte) {
    if (!t.inicio || !t.fim) return 0;
    const tot = diff(t.inicio, t.fim) + 1;
    const el = diff(t.inicio, corte) + 1;
    return Math.max(0, Math.min(1, el / tot));
  }
  const filhosDe = (tarefas, eap) => tarefas.filter(t => t.eap.startsWith(eap + '.') && t.nivel === eap.split('.').length + 1);
  const folhasDe = (tarefas, eap) => tarefas.filter(t => t.folha && (t.eap === eap || t.eap.startsWith(eap + '.')));

  function situacaoTarefa(t, corte) {
    const peso = t.previsto ?? t.base ?? 0;
    if (peso <= 0) return 'sem-peso';
    if ((t.realizado || 0) >= peso - 1e-6) return 'concluida';
    if (t.fim && t.fim < corte) return 'atrasada';
    if (t.inicio && t.inicio <= corte) return 'andamento';
    return 'a-iniciar';
  }

  // ---------- motor principal ----------
  // Data de referência de um cronograma exportado: o dia em que o previsto da curva S
  // alcança o "Previsto (%)" da linha raiz (o Prevision calcula esse previsto para o dia da exportação).
  function estimaDataRef(obra, previsto) {
    const pts = serieCurva(obra);
    if (!pts.length || previsto === null || previsto === undefined) return null;
    let d = pts[0].data;
    const fim = pts.at(-1).data;
    while (d <= fim) { if (interp(pts, 'previsto', d) >= previsto - 0.0005) return d; d = addDias(d, 1); }
    return fim;
  }
  const EXCLUIR_PADRAO = ['Indiretos', 'Taxa de administração'];
  const normNome = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Nome para exibir: tira o detalhamento entre parênteses quando é longo
  const nomeCurto = s => { const n = nomeBonito(s).nome; const i = n.indexOf(' ('); return i > 20 && n.length > 70 ? n.slice(0, i) : n; };

  function calc(obra) {
    // Cronograma (Gantt do Prevision), quando carregado e mais recente, manda no avanço e nas datas
    const cron = obra.cronograma && obra.cronograma.linhas && obra.cronograma.linhas.length ? obra.cronograma : null;
    const cRaiz = cron ? cron.linhas.find(l => l.nivel === 1) : null;
    const usaCron = !!(cRaiz && cron.dataRef && cron.dataRef >= obra.dataCorte);
    const corte = usaCron ? cron.dataRef : obra.dataCorte;
    const pts = serieCurva(obra);
    const porLinha = new Map((cron ? cron.linhas : []).map(l => [l.linha, l]));
    const casa = t => { const l = usaCron ? porLinha.get(t.linha) : null; return l && normNome(l.nome) === normNome(t.tarefa) ? l : null; };
    const tarefas = (obra.tarefas || []).map(t => {
      const l = casa(t); if (!l) return t;
      const peso = t.previsto ?? t.base ?? 0;
      return { ...t, realizado: peso * l.realizado, inicio: l.inicio || t.inicio, fim: l.fim || t.fim, crono: l };
    });
    const raiz = tarefas.find(t => t.nivel === 1);
    // Linhas fora da análise (padrão: Indiretos e Taxa de administração): somem das frentes, tarefas,
    // cronograma e report. O % total continua o do Prevision (o peso delas é desprezível).
    const EXCL = (obra.excluir || EXCLUIR_PADRAO).map(normNome);
    const ehExcl = nome => EXCL.some(x => normNome(nome).startsWith(x));
    const prefExcl = tarefas.filter(t => t.nivel > 1 && ehExcl(t.tarefa)).map(t => t.eap);
    const foraT = t => prefExcl.some(e => t.eap === e || t.eap.startsWith(e + '.'));
    const ultimoReal = [...obra.curva].reverse().find(p => p.realizado > 0);
    const real = usaCron ? cRaiz.realizado : (raiz?.realizado ?? ultimoReal?.realizado ?? 0);
    const prevCorte = usaCron ? cRaiz.previsto : interp(pts, 'previsto', corte);
    const baseCorte = usaCron ? cRaiz.base : interp(pts, 'base', corte);
    const idp = prevCorte > 0 ? real / prevCorte : null;
    const sem = semaforo(idp, obra.faixas);

    // Prazo
    const pc = obra.prazoContratual || {};
    const decorrido = pc.inicio ? diff(pc.inicio, corte) + 1 : null;
    const aVencer = pc.fim ? diff(corte, pc.fim) : null;
    const fimCron = usaCron ? cRaiz.fim : fimCronograma(obra);
    const iniCron = usaCron ? cRaiz.inicio : inicioCronograma(obra);

    // Ritmo: média do realizado nos últimos 3 meses fechados antes do corte
    const mesCorte = corte.slice(0, 7);
    const fechados = (obra.mensal || []).filter(m => m.mes < mesCorte && m.realizado !== null);
    const ult3 = fechados.slice(-3);
    const ritmo = ult3.length ? ult3.reduce((s, m) => s + m.realizado, 0) / ult3.length : null; // por mês
    const restante = Math.max(0, 1 - real);
    const DIAS_MES = 30.44;
    const projecao = ritmo > 0 ? addDias(corte, Math.round(restante / ritmo * DIAS_MES)) : null;
    const mesesAteCron = Math.max(0.01, diff(corte, fimCron) / DIAS_MES);
    const mesesAteContr = pc.fim ? Math.max(0.01, diff(corte, pc.fim) / DIAS_MES) : null;
    const ritmoCron = diff(corte, fimCron) > 0 ? restante / mesesAteCron : null;
    const ritmoContr = mesesAteContr ? restante / mesesAteContr : null;

    // Pacotes (nível 2 e 3): previsto no corte = soma das folhas pela distribuição linear,
    // normalizada para o total do cronograma (as folhas somam 100,44% por arredondamento do Prevision)
    const folhas = tarefas.filter(t => t.folha);
    const somaFolhas = folhas.reduce((s, t) => s + (t.previsto || 0), 0) || 1;
    const k = (raiz?.previsto ?? 1) / somaFolhas;
    const prevNoCorte = t => folhasDe(tarefas, t.eap).reduce((s, f) => s + (f.previsto || 0) * fracTempo(f, corte), 0) * k;
    const pacote = t => {
      const peso = t.previsto ?? t.base ?? 0;
      // com cronograma: previsto da própria linha no Prevision; sem ele: distribuição linear das folhas
      const pc_ = t.crono ? peso * t.crono.previsto : Math.min(prevNoCorte(t), peso);
      const n = nomeBonito(t.tarefa);
      return { eap: t.eap, nivel: t.nivel, nome: n.nome, area: n.area, inicio: t.inicio, fim: t.fim,
        peso, realizado: t.realizado || 0, prevCorte: pc_, desvio: (t.realizado || 0) - pc_,
        pctPacote: peso > 0 ? (t.realizado || 0) / peso : null, temFilhos: !t.folha, linha: t.linha,
        fimBase: t.crono ? t.crono.fimBase : null, slip: t.crono && t.crono.fimBase ? diff(t.crono.fimBase, t.crono.fim) : null };
    };
    // Frentes = filhos da raiz; se um deles concentra mais da metade do peso (ex.: "Execução de Obra"),
    // ele é aberto nos próprios filhos, até as frentes ficarem comparáveis entre si.
    let nos = raiz ? filhosDe(tarefas, raiz.eap).filter(t => !foraT(t)) : [];
    for (let i = 0; i < 3; i++) {
      const tot = nos.reduce((s, t) => s + (t.previsto ?? t.base ?? 0), 0) || 1;
      const dom = nos.find(t => !t.folha && (t.previsto ?? t.base ?? 0) / tot > 0.5 && filhosDe(tarefas, t.eap).length > 1);
      if (!dom) break;
      const k = nos.indexOf(dom);
      nos = [...nos.slice(0, k), ...filhosDe(tarefas, dom.eap).filter(t => !foraT(t)), ...nos.slice(k + 1)];
    }
    const pacotes = nos.map(pacote);
    const subpacotes = eap => filhosDe(tarefas, eap).filter(t => !foraT(t)).map(pacote);

    // Tarefas (folhas) com situação e caminho
    const nomePorEap = Object.fromEntries(tarefas.map(t => [t.eap, nomeBonito(t.tarefa).nome]));
    const caminho = eap => { const p = eap.split('.'); const out = []; for (let i = 2; i < p.length; i++) out.push(nomePorEap[p.slice(0, i).join('.')]); return out.filter(Boolean); };
    const lista = folhas.filter(t => !foraT(t)).map(t => {
      const peso = t.previsto ?? t.base ?? 0;
      const sit = situacaoTarefa(t, corte);
      return { eap: t.eap, nome: nomeBonito(t.tarefa).nome, caminho: caminho(t.eap), inicio: t.inicio, fim: t.fim, peso,
        realizado: t.realizado || 0, falta: Math.max(0, peso - (t.realizado || 0)), pctTarefa: peso > 0 ? (t.realizado || 0) / peso : 0,
        situacao: sit, diasAtraso: sit === 'atrasada' ? diff(t.fim, corte) : 0, atrasoPrevision: t.atrasoPrevision };
    });
    const cont = { concluida: 0, atrasada: 0, andamento: 0, 'a-iniciar': 0, 'sem-peso': 0 };
    lista.forEach(t => cont[t.situacao]++);
    const atrasadas = lista.filter(t => t.situacao === 'atrasada').sort((a, b) => b.falta - a.falta || b.diasAtraso - a.diasAtraso);
    const proximas = lista.filter(t => t.situacao !== 'concluida' && t.fim >= corte && t.fim <= addDias(corte, 30)).sort((a, b) => a.fim < b.fim ? -1 : 1);
    const faltaAtrasadas = atrasadas.reduce((s, t) => s + t.falta, 0);

    // Campo (RDO)
    const campo = calcCampo(obra.rdos || [], corte);

    const piorPacote = [...pacotes].sort((a, b) => a.desvio - b.desvio)[0];
    const piorSub = piorPacote ? [...subpacotes(piorPacote.eap)].sort((a, b) => a.desvio - b.desvio)[0] : null;

    // Cronograma: linhas para o Gantt, pendências de contratação e linhas vencidas
    let crono = null;
    if (cron) {
      const raizL = cRaiz || cron.linhas[0];
      const prefExclC = cron.linhas.filter(l => l.nivel > 1 && ehExcl(l.nome)).map(l => l.eap);
      const linhas = cron.linhas.filter(l => !prefExclC.some(e => l.eap === e || l.eap.startsWith(e + '.'))).map(l => {
        const sit = l.realizado >= 0.9995 ? 'concluida' : (l.fim && l.fim < corte) ? 'atrasada' : (l.inicio && l.inicio <= corte) ? 'andamento' : 'a-iniciar';
        const t = tarefas.find(x => x.crono === l);
        return { ...l, nomeExib: nomeCurto(l.nome), area: nomeBonito(l.nome).area, situacao: sit,
          slip: l.fimBase && l.fim ? diff(l.fimBase, l.fim) : null, diasAtraso: sit === 'atrasada' ? diff(l.fim, corte) : 0,
          peso: t ? (t.previsto ?? t.base) : null,
          pendente: /pendente de contrata/i.test(l.responsaveis || '') && l.realizado < 0.9995 };
      });
      const ini = linhas.map(l => [l.inicio, l.inicioBase]).flat().filter(Boolean).sort()[0];
      const fimMax = [...linhas.map(l => [l.fim, l.fimBase]).flat(), pc.fim].filter(Boolean).sort().at(-1);
      crono = { dataRef: cron.dataRef, arquivo: cron.arquivo, usado: usaCron, linhas, ini, fim: fimMax,
        fimAtual: raizL.fim, fimBase: raizL.fimBase, slip: raizL.fimBase ? diff(raizL.fimBase, raizL.fim) : null,
        pendentes: linhas.filter(l => l.pendente), vencidas: linhas.filter(l => l.situacao === 'atrasada' && l.nivel >= 3),
        completo: (obra.tarefas || []).length ? linhas.length >= (obra.tarefas || []).length * 0.9 : true, total: (obra.tarefas || []).length };
    }

    // Período do report: do último fechamento de mês até o corte
    const iniPer = (() => { const d = dia(corte); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, 12))); })();
    const realIni = interp(pts.filter(p => p.data <= iniPer).concat([]), 'realizado', iniPer);
    const periodo = { inicio: iniPer, real: real - (realIni ?? 0), prev: prevCorte - interp(pts, 'previsto', iniPer) };
    periodo.aderencia = periodo.prev > 0 ? periodo.real / periodo.prev : null;

    // Fotos (só dos RDOs visíveis para quem está vendo)
    const rdosVis = new Set((obra.rdos || []).filter(x => x.data <= corte).map(x => x.numero));
    const fotos = (obra.fotos || []).filter(f => rdosVis.has(f.rdo)).sort((a, b) => b.rdo - a.rdo || a.idx - b.idx);

    return { corte, real, prevCorte, baseCorte, desvio: real - prevCorte, idp, sem, pts,
      prazo: { decorrido, total: pc.dias, aVencer, fracTempo: pc.dias ? decorrido / pc.dias : null, iniCron, fimCron, contrIni: pc.inicio, contrFim: pc.fim },
      ritmo, ult3, restante, projecao, ritmoCron, ritmoContr,
      pacotes, subpacotes, lista, cont, atrasadas, proximas, faltaAtrasadas, piorPacote, piorSub, campo, periodo, fotos, crono };
  }

  // ---------- campo (RDO) ----------
  const palavras = s => new Set(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
  function parecido(a, b) {
    const A = palavras(a), B = palavras(b);
    if (!A.size || !B.size) return 0;
    let i = 0; A.forEach(w => { if (B.has(w)) i++; });
    return i / Math.min(A.size, B.size);
  }
  function calcCampo(rdos, corte) {
    const ate = rdos.filter(r => r.data <= corte).sort((a, b) => a.data < b.data ? -1 : 1);
    if (!ate.length) return null;
    const ult = ate.at(-1);
    const serie = ate.map(r => ({ data: r.data, numero: r.numero, status: r.status,
      propria: r.maoDeObra.filter(m => m.tipo === 'propria').reduce((s, m) => s + m.qtd, 0),
      terceiros: r.maoDeObra.filter(m => m.tipo === 'terceiros').reduce((s, m) => s + m.qtd, 0),
      impraticavel: r.clima.some(c => /impratic/i.test(c.condicao || '')),
      paralisadas: r.atividades.filter(a => /paralis/i.test(a.situacao)).length }));
    // Para cada frente do último RDO: avanço no período e desde quando está paralisada
    const prim = ate[0];
    const frentes = ult.atividades.map(a => {
      const chave = a.servico || a.descricao;
      const ini = prim.atividades.map(b => ({ b, s: parecido(chave, b.servico || b.descricao) })).sort((x, y) => y.s - x.s)[0];
      const pctIni = ini && ini.s >= 0.6 ? ini.b.pct : null;
      let desde = null;
      if (/paralis/i.test(a.situacao)) {
        desde = ult.data;
        for (let i = ate.length - 2; i >= 0; i--) {
          const m = ate[i].atividades.find(b => parecido(chave, b.servico || b.descricao) >= 0.6);
          if (m && /paralis/i.test(m.situacao)) desde = ate[i].data; else break;
        }
      }
      return { ...a, pctIni, avancoPeriodo: pctIni !== null ? a.pct - pctIni : null, paralisadaDesde: desde };
    });
    const paralisadas = frentes.filter(f => /paralis/i.test(f.situacao));
    const efetivoMedio = serie.reduce((s, x) => s + x.propria + x.terceiros, 0) / serie.length;
    return { ultimo: ult, primeiro: prim, serie, frentes, paralisadas, efetivoMedio,
      diasImpraticaveis: serie.filter(s => s.impraticavel).length, rdosPendentes: ate.filter(r => r.status !== 'aprovado').length };
  }

  // ---------- narrativa automática (painel e report) ----------
  function narrativa(obra, r) {
    const out = [];
    const cp = comparaPlano(r.desvio);
    out.push(`Avanço físico de <b>${pct(r.real)}</b> contra <b>${pct(r.prevCorte)}</b> planejados para ${dBR(r.corte)}: <b>${cp.longo}</b> (índice de prazo ${fmtNum(r.idp, 2)}).`);
    if (r.piorPacote && r.piorPacote.desvio < -0.005) {
      let t = `O atraso se concentra em <b>${esc(r.piorPacote.nome)}</b> (${pp(r.piorPacote.desvio)}): ${pct(r.piorPacote.realizado)} realizados de ${pct(r.piorPacote.peso)} do peso total`;
      if (r.piorSub && r.piorSub.desvio < -0.005) t += `, puxado por ${esc(r.piorSub.nome)} (${pct(r.piorSub.realizado)} de ${pct(r.piorSub.peso)})`;
      out.push(t + '.');
    }
    if (r.ritmo) {
      let t = `No ritmo dos últimos 3 meses (<b>${pct(r.ritmo)} ao mês</b>), a conclusão fica por volta de <b>${mesLongo(r.projecao)}</b>`;
      if (r.projecao > r.prazo.fimCron) t += `, depois do fim do cronograma (${dBR(r.prazo.fimCron)})`;
      if (r.prazo.contrFim) t += r.projecao <= r.prazo.contrFim ? ` e antes do prazo contratual (${dBR(r.prazo.contrFim)})` : ` e <b>depois do prazo contratual</b> (${dBR(r.prazo.contrFim)})`;
      out.push(t + '.');
      if (r.ritmoCron && r.ritmoCron > r.ritmo * 1.05) out.push(`Para terminar no cronograma seriam necessários ${pct(r.ritmoCron)} ao mês, ${fmtNum(r.ritmoCron / r.ritmo, 1)} vezes o ritmo atual.`);
    }
    if (r.crono && r.crono.usado) {
      const k = r.crono;
      let t = `O cronograma atual termina em <b>${dBR(k.fimAtual)}</b>${k.slip ? `, ${Math.abs(k.slip)} dias ${k.slip > 0 ? 'depois' : 'antes'} da base (${dBR(k.fimBase)})` : ', igual à base'}`;
      if (k.pendentes.length) t += `; ${k.pendentes.length === 1 ? '1 serviço segue' : k.pendentes.length + ' serviços seguem'} <b>pendente${k.pendentes.length > 1 ? 's' : ''} de contratação</b> (${k.pendentes.map(l => esc(l.nomeExib)).join('; ')})`;
      out.push(t + '.');
    }
    if (r.atrasadas.length) out.push(`${r.atrasadas.length} tarefas passaram da data de término sem concluir; juntas, somam ${pct(r.faltaAtrasadas)} do avanço da obra.`);
    if (r.campo) {
      const c = r.campo, u = c.ultimo;
      const ef = u.maoDeObra.reduce((s, m) => s + m.qtd, 0);
      let t = `Em campo (RDO nº ${u.numero}, ${dBR(u.data)}): ${ef} pessoas e ${c.frentes.length} frentes`;
      if (c.paralisadas.length) t += `, <b>${c.paralisadas.length} paralisadas</b>`;
      out.push(t + '.');
    }
    return out;
  }

  // ---------- report executivo: formato fixo ----------
  // Mesmos blocos e os mesmos limites a cada atualização, para o leitor achar tudo no mesmo lugar:
  // manchete (1 frase) · 4 indicadores · período · 3 pontos-chave · até 5 frentes · até 3 atenções ·
  // próximos 30 dias (3) · 4 fotos.
  const LIM = { frentes: 5, atencao: 3, proximas: 3, fotos: 4 };
  const capital = t => t.charAt(0).toUpperCase() + t.slice(1);
  function motivoCurto(m) {
    if (!m) return null;
    let t = m.replace(/^[^:]{0,60}:\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    t = t.replace(/^servi[cç]o paralisado\s*(devido (ao|à|a)\s*)?/, '').replace(/^para dar continuidade ao servi[cç]o\s*/, '');
    return capital(t.length > 140 ? t.slice(0, 137).replace(/\s\S*$/, '') + '…' : t);
  }
  function resumoExecutivo(obra, r, destaques = []) {
    const P = r.prazo, c = r.campo;
    const relProj = !r.projecao ? '' : r.projecao <= P.fimCron ? 'dentro do cronograma' : (P.contrFim && r.projecao <= P.contrFim) ? 'após o cronograma e dentro do prazo contratual' : 'após o prazo contratual';
    const cp = comparaPlano(r.desvio);
    const estado = { adiantada: 'Obra adiantada', 'em-dia': 'Obra em dia', atencao: 'Obra pede atenção', atrasada: 'Obra atrasada' }[r.sem.e] || 'Obra';
    const manchete = `${estado}: ${pct(r.real)} executado, ${cp.dir === 0 ? `em linha com os ${pct(r.prevCorte)} planejados para a data` : `${cp.longo} para a data (${pct(r.prevCorte)})`}.` +
      (r.projecao ? ` No ritmo atual, termina em ${mesLongo(r.projecao)}, ${relProj}.` : '');

    const kpis = [
      { k: 'Avanço da obra', v: pct(r.real), s: `planejado para a data: ${pct(r.prevCorte)}` },
      { k: 'Comparado ao plano', v: `${cp.seta ? cp.seta + ' ' : ''}${cp.curto}`, s: `índice de prazo ${fmtNum(r.idp, 2)} (1,00 = no ritmo)`, cls: cp.dir < 0 ? (r.sem.e === 'atrasada' ? 'crit' : 'warn') : 'ok' },
      { k: 'Término projetado', v: r.projecao ? mesCurto(r.projecao) : '—', s: `cronograma ${dCurto(P.fimCron)}${r.crono && r.crono.slip ? ` (${r.crono.slip > 0 ? '+' : ''}${r.crono.slip} d vs base)` : ''} · contrato ${P.contrFim ? dBR(P.contrFim).slice(0, 6) + P.contrFim.slice(2, 4) : '—'}`, cls: r.projecao && r.projecao > P.fimCron ? 'crit' : '' },
    ];

    const pontos = [];
    const melhor = [...r.pacotes].sort((a, b) => b.desvio - a.desvio)[0];
    if (r.piorPacote && r.piorPacote.desvio <= -TOLERANCIA) pontos.push({ t: 'Onde está o atraso', x: `${esc(r.piorPacote.nome)}, ${comparaPlano(r.piorPacote.desvio).longo}${r.piorSub && r.piorSub.desvio <= -TOLERANCIA ? `; o item que mais pesa é ${esc(r.piorSub.nome)} (${pct(r.piorSub.pctPacote, 0)} executado)` : ''}.` });
    else if (melhor && melhor.desvio >= TOLERANCIA) pontos.push({ t: 'Destaque', x: `${esc(melhor.nome)} está ${comparaPlano(melhor.desvio).longo}; nenhuma frente abaixo do plano.` });
    else pontos.push({ t: 'Avanço', x: 'todas as frentes em linha com o planejado.' });
    if (r.ritmo) pontos.push({ t: 'Prazo', x: r.ritmoCron && r.ritmoCron > r.ritmo * 1.05 ? `para terminar em ${dBR(P.fimCron)}, a obra precisa avançar ${pct(r.ritmoCron)} por mês; hoje avança ${pct(r.ritmo)} (precisa de ${fmtNum(r.ritmoCron / r.ritmo, 1)} vezes o ritmo atual).` : `a obra avança ${pct(r.ritmo)} por mês, o suficiente para terminar até ${dBR(P.fimCron)}.` });
    if (c) pontos.push({ t: 'Campo', x: c.paralisadas.length ? `${c.paralisadas.length} de ${c.frentes.length} frentes paralisadas no RDO nº ${c.ultimo.numero} (${dCurto(c.ultimo.data)}).` : `${c.frentes.length} frentes ativas, nenhuma paralisada no RDO nº ${c.ultimo.numero}.` });

    const neg = r.pacotes.filter(p => p.peso > 0.0005 && p.desvio < -0.0005).sort((a, b) => a.desvio - b.desvio);
    const top = neg.slice(0, LIM.frentes);
    const demais = r.pacotes.filter(p => p.peso > 0.0005 && !top.includes(p));
    const frentes = { top, demais: { n: demais.length, desvio: demais.reduce((s, p) => s + p.desvio, 0), peso: demais.reduce((s, p) => s + p.peso, 0) } };

    // Ordem fixa: uma de cada tipo primeiro (paralisada com motivo, pendente de contratação, atrasada),
    // depois completa com as demais paralisadas
    const par = c ? [...c.paralisadas].sort((a, b) => (b.motivo ? 1 : 0) - (a.motivo ? 1 : 0)).map(f => ({ tag: 'Paralisada', titulo: `${f.servico}${f.empresa ? ' · ' + f.empresa : ''}`, det: motivoCurto(f.motivo) || `Motivo não informado no RDO. Parada desde ${dCurto(f.paralisadaDesde)}.` })) : [];
    const pen = r.crono ? r.crono.pendentes.map(l => ({ tag: 'Contratação', titulo: l.nomeExib, det: `${(l.responsaveis || '').replace(/,?\s*Pendente de contratação/i, '')} · término ${dBR(l.fim)} · ${pct(l.realizado, 0)} feito` })) : [];
    const jaCitadas = new Set(pen.map(x => normNome(x.titulo)));
    const ta = r.atrasadas.find(t => !jaCitadas.has(normNome(t.nome)));
    const atr = ta ? [{ tag: 'Atrasada', titulo: ta.nome, det: `${ta.caminho[0] || ''} · venceu em ${dBR(ta.fim)} (${ta.diasAtraso} dias) · ${pct(ta.pctTarefa, 0)} feito` }] : [];
    const atencao = [par[0], pen[0], atr[0], ...par.slice(1), ...pen.slice(1)].filter(Boolean);
    const atencaoMais = Math.max(0, atencao.length - LIM.atencao);

    const proximas = { n: r.proximas.length, top: [...r.proximas].sort((a, b) => b.falta - a.falta).slice(0, LIM.proximas).sort((a, b) => a.fim < b.fim ? -1 : 1) };

    // Fotos: as escolhidas pelo planejamento; sem escolha, 1 foto por dia dos últimos RDOs
    // (as vagas que sobram são completadas com a 1ª foto de cada RDO mais recente)
    const fotos = destaques.map(src => r.fotos.find(f => f.src === src)).filter(Boolean).slice(0, LIM.fotos);
    const vistos = new Set(fotos.map(f => f.rdo));
    for (const f of r.fotos) { if (fotos.length >= LIM.fotos) break; if (!vistos.has(f.rdo) && !fotos.includes(f)) { fotos.push(f); vistos.add(f.rdo); } }

    return { manchete, kpis, pontos, frentes, atencao: atencao.slice(0, LIM.atencao), atencaoMais, proximas, fotos, fotosEscolhidas: destaques.length > 0, LIM };
  }

  // ============================================================
  // Gráficos — SVG à mão. Cores vêm de variáveis CSS do tema.
  // ============================================================
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function linhaPath(pts) { return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '); }

  // Curva S: base (tracejada), previsto (cobre), realizado (azul, até o corte)
  function chartCurvaS(el, obra, r, opts = {}) {
    const W = Math.max(300, el.clientWidth || 640), estreito = W < 520 || !!opts.compacto;
    const H = opts.altura || (estreito ? 230 : 290);
    const m = { t: 16, r: estreito ? 14 : 92, b: 30, l: 40 };
    const pts = r.pts;
    const x0 = dia(pts[0].data).getTime(), x1 = dia(pts.at(-1).data).getTime();
    const X = d => m.l + (dia(d).getTime() - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => H - m.b - v * (H - m.t - m.b);
    const realPts = pts.filter(p => p.data <= r.corte).map(p => [p.data, p.realizado]);
    if (!realPts.length || realPts.at(-1)[0] !== r.corte) realPts.push([r.corte, r.real]);
    let g = '';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`;
      g += `<text x="${m.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v * 100}%</text>`;
    }
    const meses = pts.slice(1).map(p => p.data);
    const passo = estreito ? 2 : 1;
    meses.forEach((d, i) => { if (i % passo === 0) g += `<text x="${X(d)}" y="${H - 10}" class="ax" text-anchor="middle">${MES[+d.slice(5, 7) - 1]}</text>`; });
    // área entre previsto e realizado até o corte (o desvio)
    const prevAteCorte = pts.filter(p => p.data <= r.corte).map(p => [X(p.data), Y(p.previsto)]).concat([[X(r.corte), Y(r.prevCorte)]]);
    const realXY = realPts.map(p => [X(p[0]), Y(p[1])]);
    const area = linhaPath(prevAteCorte) + ' ' + realXY.slice().reverse().map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + 'Z';
    g += `<path d="${area}" class="gap-area${r.desvio >= 0 ? ' pos' : ''}"/>`;
    g += `<line x1="${X(r.corte)}" x2="${X(r.corte)}" y1="${m.t}" y2="${H - m.b}" class="corte"/>`;
    g += `<text x="${X(r.corte) - 5}" y="${H - m.b - 6}" class="ax" text-anchor="end">corte ${dCurto(r.corte)}</text>`;
    g += `<path d="${linhaPath(pts.map(p => [X(p.data), Y(p.base)]))}" class="ln ln-base"/>`;
    g += `<path d="${linhaPath(pts.map(p => [X(p.data), Y(p.previsto)]))}" class="ln ln-prev"/>`;
    g += `<path d="${linhaPath(realXY)}" class="ln ln-real"/>`;
    const fim = realXY.at(-1);
    g += `<circle cx="${fim[0]}" cy="${fim[1]}" r="5" class="dot-real"/>`;
    g += `<circle cx="${X(r.corte)}" cy="${Y(r.prevCorte)}" r="4" class="dot-prev"/>`;
    if (!estreito) {
      g += `<text x="${fim[0] + 9}" y="${fim[1] + 4}" class="lbl lbl-real">${pct(r.real)}</text>`;
      g += `<text x="${X(r.corte) + 9}" y="${Y(r.prevCorte) - 6}" class="lbl">${pct(r.prevCorte)}</text>`;
      const ul = pts.at(-1);
      g += `<text x="${X(ul.data) + 8}" y="${Y(ul.previsto) + 4}" class="lbl-s">Previsto</text>`;
    }
    g += `<g class="hover" visibility="hidden"><line class="xh" y1="${m.t}" y2="${H - m.b}"/></g>`;
    g += `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" class="hit"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Curva S física: realizado ${pct(r.real)} contra previsto ${pct(r.prevCorte)} em ${dBR(r.corte)}">${g}</svg><div class="tip" hidden></div>`;
    // hover: ponto mais próximo
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), hv = svg.querySelector('.hover'), xh = svg.querySelector('.xh');
    const alvo = pts.map(p => ({ ...p, realizado: p.data <= r.corte ? p.realizado : null })).filter((p, i) => i > 0);
    alvo.push({ data: r.corte, base: r.baseCorte, previsto: r.prevCorte, realizado: r.real, corte: true });
    alvo.sort((a, b) => a.data < b.data ? -1 : 1);
    svg.querySelector('.hit').addEventListener('pointermove', ev => {
      const bb = svg.getBoundingClientRect(); const sx = (ev.clientX - bb.left) / bb.width * W;
      const p = alvo.reduce((a, b) => Math.abs(X(b.data) - sx) < Math.abs(X(a.data) - sx) ? b : a);
      xh.setAttribute('x1', X(p.data)); xh.setAttribute('x2', X(p.data)); hv.setAttribute('visibility', 'visible');
      tip.innerHTML = `<b>${p.corte ? 'Corte · ' + dBR(p.data) : dBR(p.data)}</b>
        <span><i class="sw sw-base"></i>Base <em>${pct(p.base)}</em></span>
        <span><i class="sw sw-prev"></i>Previsto <em>${pct(p.previsto)}</em></span>
        <span><i class="sw sw-real"></i>Realizado <em>${p.realizado === null ? '—' : pct(p.realizado)}</em></span>`;
      tip.hidden = false;
      const px = X(p.data) / W * bb.width;
      tip.style.left = Math.min(bb.width - 170, Math.max(0, px + 12)) + 'px';
      tip.style.top = '8px';
    });
    svg.querySelector('.hit').addEventListener('pointerleave', () => { tip.hidden = true; hv.setAttribute('visibility', 'hidden'); });
  }

  // Avanço mensal: previsto × realizado lado a lado; mês do corte marcado como parcial
  function chartMensal(el, obra, r) {
    const W = Math.max(300, el.clientWidth || 640), estreito = W < 520, H = estreito ? 210 : 240;
    const m = { t: 18, r: 8, b: 30, l: 40 };
    const dados = (obra.mensal || []).filter(d => d.mes <= r.prazo.fimCron.slice(0, 7));
    const mesCorte = r.corte.slice(0, 7);
    const max = niceMax(Math.max(...dados.map(d => Math.max(d.previsto || 0, d.mes <= mesCorte ? d.realizado || 0 : 0))));
    const n = dados.length, slot = (W - m.l - m.r) / n, bw = Math.max(4, Math.min(18, slot / 2 - 4));
    const Y = v => H - m.b - v / max * (H - m.t - m.b);
    let g = '';
    const ticks = [0, max / 2, max];
    ticks.forEach(v => { g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${m.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${fmtNum(v * 100, Number.isInteger(Math.round(v * 1000) / 10) ? 0 : 1)}%</text>`; });
    dados.forEach((d, i) => {
      const cx = m.l + slot * i + slot / 2;
      const futuro = d.mes > mesCorte, parcial = d.mes === mesCorte;
      const bar = (x, v, cls) => { if (!v) return ''; const y = Y(v), h = H - m.b - y; const rr = Math.min(4, h); return `<path d="M${x} ${H - m.b} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + bw - rr} Q${x + bw} ${y} ${x + bw} ${y + rr} V${H - m.b} Z" class="${cls}"/>`; };
      g += bar(cx - bw - 1, d.previsto, 'bar-prev');
      if (!futuro) g += bar(cx + 1, parcial ? Math.max(0, r.periodo.real) : d.realizado, 'bar-real' + (parcial ? ' parcial' : ''));
      g += `<text x="${cx}" y="${H - 10}" class="ax${parcial ? ' ax-strong' : ''}" text-anchor="middle">${MES[+d.mes.slice(5, 7) - 1]}${parcial && !estreito ? '*' : ''}</text>`;
      g += `<rect x="${cx - slot / 2}" y="${m.t}" width="${slot}" height="${H - m.t - m.b}" fill="transparent" class="hit" data-i="${i}"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Avanço físico por mês, previsto e realizado">${g}</svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('pointerenter', () => {
        const d = dados[+h.dataset.i]; const futuro = d.mes > mesCorte, parcial = d.mes === mesCorte;
        tip.innerHTML = `<b>${mesLongo(d.mes)}${parcial ? ' · parcial até ' + dCurto(r.corte) : ''}</b>
          <span><i class="sw sw-prev"></i>Previsto <em>${pct(d.previsto)}</em></span>
          <span><i class="sw sw-real"></i>Realizado <em>${futuro ? '—' : pct(parcial ? r.periodo.real : d.realizado)}</em></span>
          ${!futuro && !parcial && d.previsto ? `<span>Aderência <em>${fmtNum((d.realizado || 0) / d.previsto * 100, 0)}%</em></span>` : ''}`;
        tip.hidden = false;
        const bb = svg.getBoundingClientRect(); const px = (+h.getAttribute('x') + slot / 2) / W * bb.width;
        tip.style.left = Math.min(bb.width - 170, Math.max(0, px + 10)) + 'px'; tip.style.top = '8px';
      });
      h.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  // Efetivo diário (empilhado: próprio + terceiros)
  function chartEfetivo(el, campo) {
    const W = Math.max(260, el.clientWidth || 400), H = 120, m = { t: 10, r: 4, b: 22, l: 26 };
    const s = campo.serie, max = niceMax(Math.max(...s.map(x => x.propria + x.terceiros)) * 1.1);
    const slot = (W - m.l - m.r) / s.length, bw = Math.max(4, Math.min(22, slot - 6));
    const Y = v => H - m.b - v / max * (H - m.t - m.b);
    let g = `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" class="grid"/><line x1="${m.l}" x2="${W - m.r}" y1="${Y(max)}" y2="${Y(max)}" class="grid"/><text x="${m.l - 6}" y="${Y(max) + 4}" class="ax" text-anchor="end">${max}</text><text x="${m.l - 6}" y="${Y(0) + 4}" class="ax" text-anchor="end">0</text>`;
    s.forEach((d, i) => {
      const x = m.l + slot * i + (slot - bw) / 2;
      const yT = Y(d.terceiros), yP = Y(d.terceiros + d.propria);
      g += `<rect x="${x}" y="${yT}" width="${bw}" height="${H - m.b - yT}" class="bar-terc"/>`;
      g += `<rect x="${x}" y="${yP}" width="${bw}" height="${Math.max(0, yT - yP - 2)}" rx="2" class="bar-prop"/>`;
      if (s.length <= 16 || i % 2 === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" class="ax" text-anchor="middle">${d.data.slice(8, 10)}</text>`;
      g += `<rect x="${m.l + slot * i}" y="${m.t}" width="${slot}" height="${H - m.t - m.b}" fill="transparent" class="hit" data-i="${i}"/>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Efetivo diário em campo">${g}</svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('pointerenter', () => {
        const d = s[+h.dataset.i];
        tip.innerHTML = `<b>RDO ${d.numero} · ${dBR(d.data)}</b><span><i class="sw sw-prop"></i>Próprios <em>${d.propria}</em></span><span><i class="sw sw-terc"></i>Terceiros <em>${d.terceiros}</em></span><span>Paralisadas <em>${d.paralisadas}</em></span>`;
        tip.hidden = false; const bb = svg.getBoundingClientRect(); const px = (+h.getAttribute('x')) / W * bb.width;
        tip.style.left = Math.min(bb.width - 170, Math.max(0, px + 10)) + 'px'; tip.style.top = '0px';
      });
      h.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  root.Core = { esc, fmtNum, pct, pp, dBR, dCurto, mesCurto, mesLongo, diaSemana, diff, addDias, nomeBonito, semaforo, FAIXAS,
    calc, comparaPlano, TOLERANCIA, estimaDataRef, nomeCurto, narrativa, resumoExecutivo, motivoCurto, chartCurvaS, chartMensal, chartEfetivo, interp, fracTempo };
})(typeof window !== 'undefined' ? window : globalThis);
