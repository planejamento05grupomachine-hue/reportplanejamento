
// ============================================================
// Machine · Painel de Obras — motor de cálculo e gráficos SVG.
// Sem DOM fora das funções de gráfico: o mesmo arquivo serve o app,
// o report e a geração no servidor.
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
  const moeda = (v, d = 0) => v === null || v === undefined ? '—' : 'R$ ' + fmtNum(v, d);
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
  // Governança (ver GOVERNANCA.md): cadência semanal para dados físicos, mensal para financeiro.
  const LIMIAR_DIAS_FISICO = 10, LIMIAR_DIAS_FINANCEIRO = 35;
  // Situação de prazo (gestão de projetos: índice de desempenho de prazo, IDP = realizado ÷ planejado).
  // Simétrica: a obra pode estar adiantada, em dia, em atenção ou atrasada. Faixas configuráveis por obra.
  function semaforo(idp, faixas = FAIXAS) {
    if (idp === null || idp === undefined || isNaN(idp)) return { k: 'neutro', t: 'Sem dados', e: 'sem-dados' };
    // compara o índice como ele é mostrado (2 casas): 0,845 aparece "0,85" e não pode acender o vermelho de "< 0,85"
    idp = Math.round(idp * 100) / 100;
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
    // realizado registrado antes do início do cronograma (ex.: mobilização antecipada) não é descartado:
    // o ponto inicial parte do acumulado até essa data
    const realAntes = obra.curva.filter(p => p.data <= ini).reduce((m, p) => Math.max(m, p.realizado || 0), 0);
    const pts = [{ data: ini, base: 0, previsto: 0, realizado: realAntes }, ...obra.curva.filter(p => p.data > ini)];
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

  // ---------- prazo ganho (Earned Schedule, Lipke 2003) ----------
  // O IDP em % (realizado ÷ previsto) converge para 1 no fim de qualquer obra, mesmo atrasada, e no começo transforma
  // diferenças pequenas em índices extremos. O prazo ganho mede o mesmo desvio em tempo:
  //   ES (prazo ganho) = data em que o plano previa o avanço que a obra tem hoje
  //   atraso = corte − ES, em dias (negativo = adiantada)
  //   IDP(t) = (ES − início) ÷ (corte − início)  · 1,00 = no prazo
  // Curva de referência: o previsto (replanejado), a mesma do IDP em %.
  function dataDoPrevisto(pts, alvo) {
    if (!pts.length || alvo === null || alvo === undefined || isNaN(alvo)) return null;
    if (alvo <= (pts[0].previsto || 0)) return pts[0].data;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], va = a.previsto || 0, vb = b.previsto || 0;
      if (vb >= alvo - 1e-9) {
        const f = vb > va ? (alvo - va) / (vb - va) : 1;
        return addDias(a.data, Math.round(diff(a.data, b.data) * Math.max(0, Math.min(1, f))));
      }
    }
    return pts.at(-1).data;
  }
  // idp: o IDP em % da obra no corte. O alvo é o IDP aplicado ao previsto da própria curva no corte, para o sinal do
  // atraso seguir o do IDP mesmo quando o previsto do Cronograma e o da Curva S diferem por arredondamento.
  function prazoGanho(pts, { idp, real, corte, ini }) {
    if (!pts.length || idp === null || idp === undefined || isNaN(idp) || !ini || !corte) return null;
    const prevC = interp(pts, 'previsto', corte);
    if (!(prevC > 0)) return null;
    const topo = Math.max(...pts.map(p => p.previsto || 0));
    const alvo = real >= 0.9995 ? topo : Math.min(idp * prevC, topo);
    const es = dataDoPrevisto(pts, alvo);
    const at = diff(ini, corte);
    const idpT = at > 0 ? Math.max(0, diff(ini, es)) / at : null;
    // confiável depois de 1 mês de obra e 2% de previsto: antes disso um dia de diferença vira índice extremo
    return { es, atraso: diff(es, corte), idpT, confiavel: at >= 30 && prevC >= 0.02 };
  }
  // Tendência do prazo: atraso e IDP(t) no último registro de realizado de cada mês até o corte, pela própria Curva S.
  // Medido contra o previsto atual: depois de um replanejamento, os meses passados são relidos no plano novo
  // (o histórico de cortes, obra.historico, guarda o que foi informado em cada data).
  function tendenciaPrazo(pts, ini, corte) {
    const porMes = new Map();
    pts.filter(p => p.data > ini && p.data <= corte && (p.realizado || 0) > 0).forEach(p => porMes.set(p.data.slice(0, 7), p));
    return [...porMes.values()].map(p => {
      const prev = interp(pts, 'previsto', p.data), idp = prev > 0 ? p.realizado / prev : null;
      const g = prazoGanho(pts, { idp, real: p.realizado, corte: p.data, ini });
      return g ? { data: p.data, real: p.realizado, prev, idp, atraso: g.atraso, idpT: g.idpT, confiavel: g.confiavel } : null;
    }).filter(Boolean);
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
    // Farol pelo prazo ganho (IDP em tempo) quando confiável; o cadastro pode voltar ao IDP em % (indicePrazo = 'percentual')
    const prazoT = prazoGanho(pts, { idp, real, corte, ini: pts[0] && pts[0].data });
    const farolTempo = obra.indicePrazo !== 'percentual' && !!(prazoT && prazoT.confiavel && prazoT.idpT !== null);
    // Início da obra: com menos de 2% previsto na data e sem índice em tempo confiável, o farol não acende
    // (0,8% planejado e nada medido no primeiro dia não é atraso; é a mesma régua do IDP(t) confiável)
    const inicioObra = !farolTempo && (prevCorte || 0) < 0.02 && (real || 0) < 0.02;
    const sem = inicioObra ? { k: 'neutro', t: 'Início da obra', e: 'inicio' } : semaforo(farolTempo ? prazoT.idpT : idp, obra.faixas);

    // Prazo
    // Regra: o prazo contratual é SEMPRE a linha de base do Prevision (linha nível 1 do cronograma:
    // início base → fim base). O cadastro da obra (prazoContratual) só vale se não houver cronograma com base.
    const pcCad = obra.prazoContratual || {};
    const pc = cRaiz && cRaiz.fimBase
      ? { inicio: cRaiz.inicioBase || pcCad.inicio, fim: cRaiz.fimBase, fonte: 'base Prevision' }
      : { ...pcCad, fonte: pcCad.fim ? 'cadastro da obra' : null };
    if (pc.inicio && pc.fim) pc.dias = diff(pc.inicio, pc.fim) + 1;
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
    // projeção só com histórico suficiente: 3 meses fechados com realizado e obra acima de 10% (no começo da obra
    // a média dos primeiros meses não representa o ritmo de produção e jogaria a conclusão para anos depois)
    const histOk = ult3.length >= 3 && ult3.every(m => (m.realizado || 0) > 0) && real >= 0.10;
    const projecaoRitmo = ritmo > 0 && histOk ? addDias(corte, Math.round(restante / ritmo * DIAS_MES)) : null;
    // Projeção pelo prazo ganho, como faixa (a média linear do ritmo ignora o formato em S e tende a ser otimista):
    //  · se o atraso não aumentar: término do cronograma + atraso de hoje
    //  · se o desempenho de prazo se mantiver: início + duração planejada ÷ IDP(t)
    // Só com obra acima de 10% e IDP(t) confiável; nunca antes do corte. Sem isso, fica a projeção pelo ritmo.
    const aposCorte = d => d && d < corte ? corte : d;
    const faixaOk = prazoT && prazoT.confiavel && prazoT.idpT > 0 && real >= 0.10 && real < 0.9995 && fimCron && pts[0];
    const projecaoFaixa = faixaOk ? {
      atrasoMantido: aposCorte(addDias(fimCron, prazoT.atraso)),
      desempenhoMantido: aposCorte(addDias(pts[0].data, Math.round(diff(pts[0].data, fimCron) / prazoT.idpT))),
    } : null;
    const projecao = projecaoFaixa ? projecaoFaixa.desempenhoMantido : projecaoRitmo;
    const tendencia = tendenciaPrazo(pts, pts[0] ? pts[0].data : corte, corte);
    if (prazoT && tendencia.length && tendencia.at(-1).data.slice(0, 7) === corte.slice(0, 7)) tendencia.pop();
    if (prazoT) tendencia.push({ data: corte, real, prev: prevCorte, idp, atraso: prazoT.atraso, idpT: prazoT.idpT, confiavel: prazoT.confiavel });
    // pesos do Progresso por tarefas: só valem se a raiz fecha ~100% (exportação filtrada por período traz o planejado
    // acumulado do período no lugar do peso, ex.: raiz 12,84%)
    const pesoRaiz = raiz ? (raiz.base ?? raiz.previsto ?? 0) : 0;
    const pesosOk = pesoRaiz >= 0.95;
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
    // Linha sem data no Prevision: início = término = início da obra e sem linha de base (escopo condicionado,
    // marco "a definir"). Não é tarefa vencida: fica fora de atrasos, próximos 30 dias e faróis de prazo.
    const tRaizObra = tarefas.find(t => t.nivel === 1) || {};
    const iniObra = [cRaiz && cRaiz.inicio, cRaiz && cRaiz.inicioBase, tRaizObra.inicio].filter(Boolean).sort()[0] || null;
    const semData = (fim, ini, fimBase) => !fimBase && !!fim && !!iniObra && fim <= iniObra && (!ini || ini >= fim);
    const lista = folhas.filter(t => !foraT(t)).map(t => {
      const peso = t.previsto ?? t.base ?? 0;
      const sit = (t.realizado || 0) < peso - 1e-9 && semData(t.fim, t.inicio, t.crono && t.crono.fimBase) ? 'sem-data' : situacaoTarefa(t, corte);
      return { eap: t.eap, nome: nomeBonito(t.tarefa).nome, caminho: caminho(t.eap), inicio: t.inicio, fim: t.fim, peso,
        realizado: t.realizado || 0, falta: Math.max(0, peso - (t.realizado || 0)), pctTarefa: peso > 0 ? (t.realizado || 0) / peso : 0,
        situacao: sit, diasAtraso: sit === 'atrasada' ? diff(t.fim, corte) : 0, atrasoPrevision: t.atrasoPrevision };
    });
    const cont = { concluida: 0, atrasada: 0, andamento: 0, 'a-iniciar': 0, 'sem-peso': 0, 'sem-data': 0 };
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
        const sit = l.realizado >= 0.9995 ? 'concluida' : semData(l.fim, l.inicio, l.fimBase) ? 'sem-data' : (l.fim && l.fim < corte) ? 'atrasada' : (l.inicio && l.inicio <= corte) ? 'andamento' : 'a-iniciar';
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
      // peso de cada linha do cronograma (só quando os pesos do Progresso por tarefas são válidos)
      const porLinhaPeso = new Map(tarefas.filter(t => t.crono).map(t => [t.crono.linha, t.previsto ?? t.base]));
      const porEapPeso = new Map(tarefas.map(t => [t.eap + '|' + normNome(t.tarefa), t.previsto ?? t.base]));
      crono.peso = l => !pesosOk ? null : (porLinhaPeso.get(l.linha) ?? porEapPeso.get(l.eap + '|' + normNome(l.nome)) ?? null);
    }

    // Período do report: do último fechamento de mês até o corte
    const iniPer = (() => { const d = dia(corte); return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0, 12))); })();
    // realizado no fechamento do mês anterior: o último valor medido até ali (a Curva S diária do Prevision traz 0 nos dias
    // sem medição; interpolar no dia do fechamento dava 0 e o "mês" virava o acumulado inteiro)
    const realIni = pts.filter(p => p.data <= iniPer).reduce((mx, p) => Math.max(mx, p.realizado || 0), 0);
    const periodo = { inicio: iniPer, real: real - (realIni ?? 0), prev: prevCorte - interp(pts, 'previsto', iniPer) };
    periodo.aderencia = periodo.prev > 0 ? periodo.real / periodo.prev : null;

    // Fotos (só dos RDOs visíveis para quem está vendo)
    const rdosVis = new Set((obra.rdos || []).filter(x => x.data <= corte).map(x => x.numero));
    const fotos = (obra.fotos || []).filter(f => rdosVis.has(f.rdo)).sort((a, b) => b.rdo - a.rdo || a.idx - b.idx);

    return { corte, real, prevCorte, baseCorte, desvio: real - prevCorte, idp, sem, pts,
      prazo: { decorrido, total: pc.dias, aVencer, fracTempo: pc.dias ? decorrido / pc.dias : null, iniCron, fimCron, contrIni: pc.inicio, contrFim: pc.fim, contrFonte: pc.fonte },
      ritmo, ult3, restante, projecao, projecaoRitmo, projecaoFaixa, projecaoFonte: projecaoFaixa ? 'prazo' : projecaoRitmo ? 'ritmo' : null,
      prazoGanho: prazoT, farolTempo, inicioObra, tendencia, ritmoCron, ritmoContr,
      pacotes, subpacotes, lista, cont, atrasadas, proximas, faltaAtrasadas, piorPacote, piorSub, campo, periodo, fotos, crono, pesosOk, pesoRaiz };
  }

  // ---------- campo (RDO) ----------
  const palavras = s => new Set(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3));
  function parecido(a, b) {
    const A = palavras(a), B = palavras(b);
    if (!A.size || !B.size) return 0;
    let i = 0; A.forEach(w => { if (B.has(w)) i++; });
    return i / Math.min(A.size, B.size);
  }
  // empresa da frente: campo próprio do RDO ou, quando o diário não tem, "Empresa (n)" no fim da descrição (198)
  const empresasFrente = a => a.empresa ? [a.empresa] : [...String(a.descricao || '').matchAll(/([A-Za-zÀ-ú0-9][^.|()]*?)\s*\(\d+\)/g)].map(m => m[1].trim());
  // RDOs gravados antes da correção do leitor: tempo e condição na mesma célula ("Nublado Praticável")
  const climaRdo = c => { const m = !c.condicao && c.tempo && c.tempo.match(/^(.*?)\s*((?:Im)?pratic[aá]vel)$/i); return m ? { ...c, tempo: m[1] || null, condicao: m[2] } : c; };
  // Qualidade do preenchimento dos RDOs (manual interno): quanto de cada campo do padrão aparece nos diários lidos.
  // Frações de 0 a 1, ou médias por RDO para atividades, itens de mão de obra e fotos.
  function qualidadeRdo(rdos, fotos) {
    if (!rdos || !rdos.length) return null;
    const rd = [...rdos].sort((a, b) => a.data < b.data ? -1 : 1);
    const A = rd.flatMap(r => r.atividades || []), par = A.filter(a => /paralis/i.test(a.situacao || ''));
    const F = fotos || [];
    const fr = (arr, f) => arr.length ? arr.filter(f).length / arr.length : null;
    const med = f => rd.reduce((s, r) => s + f(r), 0) / rd.length;
    // um RDO por dia útil (segunda a sexta) entre o primeiro e o último diário lido
    const util = d => { const w = dia(d).getDay(); return w > 0 && w < 6; };
    let uteis = 0; for (let d = rd[0].data; d <= rd.at(-1).data; d = addDias(d, 1)) if (util(d)) uteis++;
    const comRdo = new Set(rd.map(r => r.data).filter(util)).size;
    return { n: rd.length, de: rd[0].data, ate: rd.at(-1).data, nFotos: F.length, nParalisadas: par.length, v: {
      diario: uteis ? Math.min(1, comRdo / uteis) : null,
      aprovado: fr(rd, r => r.status === 'aprovado'),
      clima: fr(rd, r => (r.clima || []).length > 0 && r.clima.every(c => climaRdo(c).condicao)),
      maoDeObra: med(r => (r.maoDeObra || []).filter(m => m.qtd > 0).length),
      equipamentos: fr(rd, r => (r.equipamentos || []).length > 0),
      atividades: med(r => (r.atividades || []).length),
      eap: fr(A, a => a.eap),
      empresa: fr(A, a => empresasFrente(a).length),
      local: fr(A, a => a.local || a.area),
      pct: fr(A, a => a.pct !== null && a.pct !== undefined),
      descricao: fr(A, a => a.descricao && normNome(a.descricao) !== normNome(a.servico || '')),
      motivo: fr(par, a => a.motivo),
      fotos: med(r => r.fotos || 0),
      fotoLegenda: fr(F, f => f.legenda && (f.legenda.servico || f.legenda.texto)),
      fotoEap: fr(F, f => f.legenda && f.legenda.eap),
      fotoLocal: fr(F, f => f.legenda && (f.legenda.local || f.legenda.area)),
    } };
  }
  function calcCampo(rdos, corte) {
    const ate = rdos.filter(r => r.data <= corte).map(r => ({ ...r, clima: (r.clima || []).map(climaRdo) })).sort((a, b) => a.data < b.data ? -1 : 1);
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
      return { ...a, pctIni, avancoPeriodo: pctIni !== null && a.pct !== null && a.pct !== undefined ? a.pct - pctIni : null, paralisadaDesde: desde };
    });
    const paralisadas = frentes.filter(f => /paralis/i.test(f.situacao));
    const efetivoMedio = serie.reduce((s, x) => s + x.propria + x.terceiros, 0) / serie.length;
    return { ultimo: ult, primeiro: prim, serie, frentes, paralisadas, efetivoMedio,
      diasImpraticaveis: serie.filter(s => s.impraticavel).length, rdosPendentes: ate.filter(r => r.status !== 'aprovado').length };
  }

  // ---------- financeiro / valor agregado ----------
  // Motor paralelo ao físico (não altera calc()). Nomenclatura fixa de gestão de valor agregado
  // — PV (valor planejado), EV (valor agregado/realizado), AC (custo real), BAC (valor do
  // contrato), SPI = EV/PV, CPI = EV/AC, EAC = AC + (BAC−EV)/CPI. De onde vem cada termo: ver
  // GOVERNANCA.md. CPI/EAC só existem quando há dado de custo (obra.custo); SPI não depende
  // disso, porque PV/EV já vêm da Curva S financeira (Financeiro VA) do Prevision.
  function serieFinanceira(obra) {
    const fin = obra.financeiro && obra.financeiro.curva;
    if (!fin || !fin.length) return null;
    const ini = inicioCronograma(obra);
    const antes = fin.filter(p => p.data <= ini).reduce((m, p) => Math.max(m, p.realizado || 0), 0);
    return [{ data: ini, base: 0, previsto: 0, realizado: antes }, ...fin.filter(p => p.data > ini)];
  }
  // obra.custo: mesma forma de obra.curva ({ data, realizado } em R$ acumulado) — ainda sem
  // fonte definida (pasta "custo" vazia); fica pronto para quando o arquivo existir.
  function serieCusto(obra) {
    const ini = inicioCronograma(obra);
    const pts = (obra.custo || []).filter(p => p.data >= ini);
    return pts.length ? pts : (obra.custo || []);
  }
  function calcFinanceiro(obra, corte) {
    const pts = serieFinanceira(obra);
    const resumo = obra.medicao && obra.medicao.resumo;
    if (!pts && !resumo) return null;
    const bac = resumo ? resumo.totalContrato : null;
    const pv = pts ? interp(pts, 'previsto', corte) : null;
    const baseVA = pts ? interp(pts, 'base', corte) : null;
    // EV: o Prevision grava o realizado do mês corrente no ponto de fim de mês (posição do dia da exportação).
    // Interpolar até o corte subestimaria o executado; vale o último realizado registrado até o fim do mês do corte.
    const fimMesCorte = fimDoMes(corte.slice(0, 7));
    const comReal = pts ? pts.filter(p => p.data <= fimMesCorte && (p.realizado || 0) > 0) : [];
    const ev = pts ? (comReal.length ? comReal.at(-1).realizado : 0) : null;
    const custo = serieCusto(obra);
    const ac = custo.length ? interp(custo, 'realizado', corte) : null;
    const spi = pv > 0 ? ev / pv : null;
    const cpi = ac > 0 ? ev / ac : null;
    const eac = cpi && bac !== null ? ac + (bac - ev) / cpi : null;
    const vac = eac !== null ? bac - eac : null;
    const sem = spi !== null ? semaforo(spi, obra.faixas) : { k: 'neutro', t: 'Sem dados', e: 'sem-dados' };
    // escala do gráfico (eixo 0–100%): o valor do contrato (BAC) quando a Curva S financeira está na mesma base
    // (198 e 208: total da curva ≈ contrato); senão, o total previsto da própria curva. Na 207 a curva do Prevision
    // é o orçamento da obra (R$ 12 mi) e o contrato Machine é outro valor (R$ 1,15 mi): dividir por ele daria 700%.
    const totalCurva = pts ? Math.max(pts.at(-1).previsto || 0, pts.at(-1).base || 0) : null;
    const mesmaBase = !!(bac && totalCurva && Math.abs(totalCurva / bac - 1) <= 0.15);
    const base100 = (mesmaBase ? bac : totalCurva) || bac || 1;
    // Medido × executado: só com a curva na base do contrato (senão EV e medição estão em bases diferentes).
    // Medido acima do EV = faturamento à frente da execução; abaixo = execução ainda não medida. Até 2% do contrato
    // conta como em linha (a medição fecha no fim do mês e o EV vai até o corte).
    const med = resumo && resumo.medidoAcumulado !== null && resumo.medidoAcumulado !== undefined ? resumo.medidoAcumulado : null;
    const medidoVsExecutado = mesmaBase && ev !== null && med !== null && bac > 0 ? (() => {
      const dif = med - ev, frac = dif / bac;
      return { medido: med, ev, dif, frac, situacao: Math.abs(frac) <= 0.02 ? 'em-linha' : dif > 0 ? 'medido-acima' : 'medido-abaixo' };
    })() : null;
    const ptsFrac = pts ? pts.map(p => ({ data: p.data, base: (p.base || 0) / base100, previsto: (p.previsto || 0) / base100, realizado: (p.realizado || 0) / base100 })) : null;
    return { pv, ev, baseVA, bac, ac, spi, cpi, eac, vac, sem, pts: ptsFrac, pontos$: pts,
      escala: pts ? (mesmaBase ? 'contrato' : 'orcamento') : null, totalCurva,
      pvFrac: pv !== null ? pv / base100 : null, evFrac: ev !== null ? ev / base100 : null, baseFrac: baseVA !== null ? baseVA / base100 : null,
      faturamento: resumo ? { contratual: resumo.totalContrato, medido: resumo.medidoAcumulado, saldo: resumo.saldo, ultimaMedicao: resumo.ultimaMedicao,
        pctMedido: resumo.totalContrato && resumo.medidoAcumulado !== null ? resumo.medidoAcumulado / resumo.totalContrato : null } : null,
      medidoVsExecutado };
  }
  // Valor agregado no report (cadastro da obra: obra.reportVA = 'auto' | 'mostrar' | 'ocultar').
  // Automático: só quando há SPI e a Curva S financeira está na base do contrato — sem isso o quadro vira só faturamento,
  // ou mistura bases (207: curva = orçamento da obra, contrato Machine = outro valor) e confunde cliente e diretoria.
  function vaNoReport(obra, rf) {
    if (!rf || obra.reportVA === 'ocultar') return false;
    if (obra.reportVA === 'mostrar') return true;
    return rf.spi !== null && (rf.escala === 'contrato' || !rf.bac);
  }
  // Custo real (avanço financeiro real): planilha de orçamento cliente da Machine (aba FÍS X FIN), carregada em
  // Alimentar → Dados financeiros. Previsto e realizado em R$ por mês (LB2 = projeção/contratação consolidada); o
  // realizado são as contas pagas em nome do cliente pela data da baixa mais a taxa de administração. Quando a obra
  // tem essa planilha, ela é a fonte dos dados financeiros do report (no lugar da Curva S financeira do Prevision).
  // Sai no formato que chartCurvaS e o PowerPoint já desenham (pts em fração do total, corte, real, prevCorte).
  function calcCustoReal(obra) {
    const c = obra && obra.custoReal;
    if (!c || !(c.meses || []).length || !(c.total > 0)) return null;
    const T = c.total, ms = c.meses;
    const comReal = ms.filter(m => m.realizadoAcum !== null && m.realizadoAcum !== undefined);
    const corte = c.ultimaBaixa || (comReal.length ? fimDoMes(comReal.at(-1).mes) : ms[0].mes + '-01');
    const pts = [{ data: ms[0].mes + '-01', base: 0, previsto: 0, realizado: 0 }]
      .concat(ms.map(m => ({ data: fimDoMes(m.mes), base: m.previstoAcum / T, previsto: m.previstoAcum / T, realizado: (m.realizadoAcum || 0) / T })));
    const realizado = c.realizadoTotal, previsto = interp(pts, 'previsto', corte) * T;
    const mesCorte = corte.slice(0, 7), ultimoMes = ms.at(-1).mes;
    return { fonte: 'planilha', total: T, totalLb1: c.totalLb1, realizado, previsto, saldo: T - realizado, desvio$: realizado - previsto,
      pct: realizado / T, pctPrev: previsto / T, corte, parcial: corte < fimDoMes(mesCorte), lancamentos: c.lancamentos,
      meses: ms, etapas: c.etapas || [], posFim: mesCorte > ultimoMes,
      // compatível com chartCurvaS / PowerPoint (mesmo objeto da Curva S financeira)
      pts, real: realizado / T, prevCorte: previsto / T, baseCorte: previsto / T, desvio: (realizado - previsto) / T, evFrac: realizado / T };
  }
  // R$ compacto para cartões: "R$ 12,84 mi" · "R$ 103,0 mil"
  const moedaCurta = v => v === null || v === undefined || isNaN(v) ? '—' : Math.abs(v) >= 1e6 ? 'R$ ' + fmtNum(v / 1e6, 2) + ' mi' : Math.abs(v) >= 1e3 ? 'R$ ' + fmtNum(v / 1e3, 1) + ' mil' : 'R$ ' + fmtNum(v, 0);

  // ---------- mapa de avanço (plantas demarcadas) ----------
  // Cada zona desenhada na planta tem situação manual ou vinculada a uma linha do cronograma / Progresso por tarefas.
  // Vinculada, a situação sai do realizado da atividade a cada carga: 100% = executado, >0 = executando, 0 = a executar.
  const MAPA_ST = { executado: 'Executado', executando: 'Executando', 'a-executar': 'A executar' };
  function atividadesParaMapa(r) {
    if (r.crono && r.crono.linhas.length) return r.crono.linhas.filter(l => l.nivel > 1).map(l => ({ chave: 'c' + l.linha + '|' + normNome(l.nome), eap: l.eap, nivel: l.nivel, nome: l.nomeExib, feito: l.realizado || 0,
      inicio: l.inicio || null, inicioBase: l.inicioBase || null, fim: l.fim || null, fimBase: l.fimBase || null }));
    const nome = Object.fromEntries((r.lista || []).map(t => [t.eap, t]));
    const vistos = new Set(); const out = [];
    const add = p => { if (vistos.has(p.eap)) return; vistos.add(p.eap); out.push({ chave: 't' + p.eap + '|' + normNome(p.nome), eap: p.eap, nivel: p.nivel || p.eap.split('.').length, nome: p.nome, feito: p.pctPacote ?? p.pctTarefa ?? 0,
      inicio: p.inicio || null, inicioBase: null, fim: p.fim || null, fimBase: p.fimBase || null }); };
    (r.pacotes || []).forEach(p => { add(p); (r.subpacotes(p.eap) || []).forEach(add); });
    Object.values(nome).forEach(add);
    return out.sort((a, b) => a.eap.localeCompare(b.eap, 'pt-BR', { numeric: true }));
  }
  function statusZona(z, ativ) {
    if (z.vinculo) {
      const a = ativ.find(x => x.chave === z.vinculo.chave) || ativ.find(x => normNome(x.nome) === normNome(z.vinculo.nome) && x.eap === z.vinculo.eap) || ativ.find(x => normNome(x.nome) === normNome(z.vinculo.nome));
      if (a) return { st: a.feito >= 0.9995 ? 'executado' : a.feito > 0.0005 ? 'executando' : 'a-executar', feito: a.feito, auto: true, ativ: a };
    }
    return { st: z.status || 'a-executar', feito: null, auto: false, ativ: null };
  }
  // Zona = polígono de vértices em fração da planta (0–1). Mapas antigos guardavam retângulos {x, y, w, h}.
  const ptsZona = z => Array.isArray(z.pts) && z.pts.length >= 3 ? z.pts
    : [[z.x, z.y], [z.x + z.w, z.y], [z.x + z.w, z.y + z.h], [z.x, z.y + z.h]];
  // área (fórmula do laço) e centroide do polígono, nas unidades da planta (w × h)
  function geoZona(pts, w = 1, h = 1) {
    let a = 0, cx = 0, cy = 0;
    pts.forEach(([x0, y0], i) => { const [x1, y1] = pts[(i + 1) % pts.length]; const c = x0 * y1 - x1 * y0; a += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c; });
    if (Math.abs(a) < 1e-9) return { area: 0, cx: pts.reduce((s, p) => s + p[0], 0) / pts.length, cy: pts.reduce((s, p) => s + p[1], 0) / pts.length };
    return { area: Math.abs(a / 2) * w * h, cx: cx / (3 * a), cy: cy / (3 * a) };
  }
  function mapasDaObra(obra, r) {
    const ativ = atividadesParaMapa(r);
    return (obra.mapas || []).filter(m => m.img).map(m => {
      const zonas = (m.zonas || []).map((z, i) => { const pts = ptsZona(z), g = geoZona(pts); return { ...z, pts, area: g.area, cx: g.cx, cy: g.cy, n: i + 1, ...statusZona(z, ativ) }; });
      const area = k => zonas.filter(z => z.st === k).reduce((s, z) => s + z.area, 0);
      const tot = zonas.reduce((s, z) => s + z.area, 0) || 1;
      const resumo = Object.keys(MAPA_ST).map(k => ({ k, t: MAPA_ST[k], n: zonas.filter(z => z.st === k).length, area: area(k) / tot }));
      // Prazo da frente: início e término planejados (base) e término atual, pelas atividades vinculadas às áreas
      // (área sem vínculo não tem data própria). Término atual só aparece quando difere do previsto (há desvio).
      const vinc = zonas.filter(z => z.ativ);
      const inicio = vinc.map(z => z.ativ.inicioBase || z.ativ.inicio).filter(Boolean).sort()[0] || null;
      const fimPrevisto = vinc.map(z => z.ativ.fimBase || z.ativ.fim).filter(Boolean).sort().at(-1) || null;
      const fimAtual = vinc.map(z => z.ativ.fim).filter(Boolean).sort().at(-1) || null;
      const datas = { inicio, fimPrevisto, fimAtual: fimAtual && fimAtual !== fimPrevisto ? fimAtual : null };
      const emExecucao = zonas.filter(z => z.st === 'executando').map(z => z.rotulo).filter(Boolean);
      return { ...m, zonas, resumo, datas, emExecucao };
    });
  }
  // Foto do RDO → frente de serviço do mapa (folha de registro fotográfico: foto ao lado da planta).
  // Pela EAP da legenda contra a atividade vinculada à área (a mesma etapa ou uma de dentro dela) ou, sem EAP, pelo nome do
  // serviço contra a atividade, o rótulo da área ou o título da frente. Devolve a planta e as áreas a destacar.
  function fotoNoMapa(f, mapas) {
    const L = f.legenda || {}, serv = L.servico || L.texto || '';
    if (!L.eap && !serv) return null;
    const mesmaEtapa = (a, b) => a && b && (a === b || a.startsWith(b + '.') || b.startsWith(a + '.'));
    let melhor = null;
    for (const m of mapas) {
      const zonas = m.zonas.map(z => ({ id: z.id, s: z.ativ && mesmaEtapa(L.eap, z.ativ.eap) ? 3 : Math.max(parecido(serv, z.ativ ? z.ativ.nome : ''), parecido(serv, z.rotulo)) >= 0.6 ? 2 : 0 })).filter(z => z.s);
      const s = zonas.length ? Math.max(...zonas.map(z => z.s)) : parecido(serv, m.titulo) >= 0.6 ? 1 : 0;
      if (s && (!melhor || s > melhor.s)) melhor = { m, s, zonas: zonas.filter(z => z.s === s).map(z => z.id) };
    }
    return melhor && { mapa: melhor.m, zonas: melhor.zonas };
  }

  // ---------- qualidade dos documentos que alimentam o painel (manual interno) ----------
  // Por documento, os itens do padrão que dá para medir na carga da obra: true/false, fração de 0 a 1 ou null (não se
  // aplica). Documento não enviado fica null. O RDO tem medida própria (qualidadeRdo). r = calc(obra).
  function qualidadeDocs(obra, r, fotos) {
    const igual = (a, b, tol) => a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(a - b) <= tol;
    const fr = (arr, f) => arr.length ? arr.filter(f).length / arr.length : null;
    const tem = v => !!String(v || '').trim();
    const dig = s => String(s || '').replace(/\D/g, '');
    const tar = obra.tarefas || [], tR = tar.find(t => t.nivel === 1);
    const linhas = (obra.cronograma && obra.cronograma.linhas) || [], cR = linhas.find(l => l.nivel === 1);
    const eaps = linhas.map(l => l.eap), folhas = linhas.filter(l => l.nivel > 1 && !eaps.some(e => e.startsWith(l.eap + '.')));
    const porLinha = new Map(tar.map(t => [t.linha, t]));
    const curva = obra.curva || [], mm = obra.mensal || [];
    const pCurva = curva.find(x => x.data >= r.corte && x.realizado > 0) || [...curva].reverse().find(x => x.realizado > 0);
    const fimObra = (cR && cR.fim) || (tR && tR.fim) || null;
    const contrRdo = (obra.rdos || []).map(x => x.contrato).filter(Boolean).at(-1);
    const pz = obra.prazoContratual || {};
    // Progresso mensal × Curva S: base acumulada mês a mês (o semanal somado em meses reparte a semana da virada)
    const confereCurva = () => {
      if (!curva.length) return null;
      const tol = mm.some(m => m.origem === 'semanal') ? 0.02 : 0.002;
      let acc = 0, comp = 0, ruins = 0;
      mm.forEach(m => { acc += m.base || 0; const p = curva.find(x => x.data.slice(0, 7) === m.mes); if (p) { comp++; if (Math.abs((p.base || 0) - acc) > tol) ruins++; } });
      return comp ? !ruins : null;
    };
    const fin = obra.financeiro && obra.financeiro.curva, rf = fin && fin.length ? calcFinanceiro(obra, r.corte) : null;
    const res = obra.medicao && obra.medicao.resumo, bol = (obra.medicao && obra.medicao.boletins) || [];
    const meses = res ? res.meses || [] : [], iUlt = meses.map(m => (m.realizadoCT || m.medicaoRealizada || 0) > 0).lastIndexOf(true);
    const medidos = iUlt >= 0 ? meses.slice(0, iUlt + 1) : [];
    const nMedidos = medidos.filter(m => (m.realizadoCT || m.medicaoRealizada || 0) > 0).length;
    const mapas = mapasDaObra(obra, r), zonas = mapas.flatMap(m => m.zonas);
    const it = (t, v) => ({ t, v: v === undefined ? null : v });
    return {
      cadastro: [
        it('Cliente, contratante e cidade', fr(['cliente', 'contratante', 'cidade'], k => tem(obra[k]))),
        it('Endereço da obra', tem(obra.local)),
        it('Responsável em campo', tem(obra.responsavel)),
        it('Número do contrato', !!dig(obra.contrato)),
        it('Contrato igual ao do RDO', dig(obra.contrato) && dig(contrRdo) ? dig(obra.contrato) === dig(contrRdo) : null),
        it('Prazo contratual (início e fim)', !!(pz.inicio && pz.fim)),
      ],
      cronograma: linhas.length ? [
        it('Árvore toda expandida', tar.length ? linhas.length >= tar.length * 0.9 : null),
        it('Linha de base salva nas tarefas', fr(folhas, l => l.inicioBase && l.fimBase)),
        it('Tarefas com predecessora', fr(folhas, l => l.predecessoras)),
        it('Tarefas com responsável', fr(folhas, l => l.responsaveis)),
        it('Linhas ligadas ao Progresso por tarefas', tar.length ? fr(linhas, l => { const t = porLinha.get(l.linha); return t && normNome(t.tarefa) === normNome(l.nome); }) : null),
        it('Mesmo realizado do Progresso por tarefas', cR && tR ? igual(cR.realizado, tR.realizado, 0.001) : null),
      ] : null,
      tarefas: tR ? [
        it('Sem filtro de período (raiz com 100% de peso)', r.pesosOk),
        it('Linha de base da obra fecha em 100%', igual(tR.base, 1, 0.002)),
        it('Mesmo realizado da Curva S', pCurva ? igual(pCurva.realizado, tR.realizado, 0.001) : null),
      ] : null,
      curva: curva.length ? [
        it('Linha de base fecha em 100%', igual(curva.at(-1).base, 1, 0.001)),
        it('Linha de base sempre crescente', curva.every((p, i) => !i || p.base >= curva[i - 1].base - 1e-6)),
        it('Vai até o término da obra', fimObra ? curva.at(-1).data.slice(0, 7) >= fimObra.slice(0, 7) : null),
      ] : null,
      mensal: mm.length ? [
        it('Linha de base soma 100%', igual(mm.reduce((s, m) => s + (m.base || 0), 0), 1, 0.002)),
        it('Confere com a Curva S', confereCurva()),
        it('Cobre o mês da data de corte', obra.dataCorte ? mm.some(m => m.mes === obra.dataCorte.slice(0, 7)) : null),
      ] : null,
      mapas: mapas.length ? [
        it('Áreas demarcadas nas plantas', zonas.length > 0),
        it('Áreas vinculadas a uma atividade', fr(zonas, z => z.auto)),
        it('Fotos do período que acham a frente no mapa', fotos && fotos.length ? fr(fotos, f => fotoNoMapa(f, mapas)) : null),
      ] : null,
      financeiro: rf ? [
        it('Curva na base do contrato (±15%)', rf.bac ? rf.escala === 'contrato' : null),
        it('Linha de base sempre crescente', fin.every((p, i) => !i || (p.base || 0) >= (fin[i - 1].base || 0) - 0.01)),
        it('Valor agregado registrado no mês do corte', rf.ev > 0),
      ] : null,
      custoReal: obra.custoReal ? (() => { const c = obra.custoReal, soma = (c.etapas || []).reduce((s, e) => s + (e.realizado || 0), 0);
        return [
          it('Realizado por etapa soma o total da curva', Math.abs(soma - (c.realizadoTotal || 0)) < 1),
          it('Previsto fecha na projeção total (LB2)', c.meses && c.meses.length ? igual(c.meses.at(-1).previstoAcum, c.total, 1) : null),
          it('Última baixa a até 10 dias do corte físico', c.ultimaBaixa && obra.dataCorte ? c.ultimaBaixa >= addDias(obra.dataCorte, -10) : null),
        ]; })() : null,
      medicao: res ? [
        it('Valor total do contrato', res.totalContrato > 0),
        it('Medido acumulado e saldo', res.medidoAcumulado !== null && res.saldo !== null),
        it('Contrato e obra identificados', !!(res.contrato && res.obra)),
        it('Meses com previsto e realizado', fr(medidos, m => m.previstoCT !== null && m.realizadoCT !== null)),
        it('Situação de cada medição', fr(medidos, m => tem(m.status))),
        it('Boletim por item de EAP de cada medição', nMedidos ? Math.min(1, bol.length / nMedidos) : null),
      ] : null,
    };
  }

  // ---------- projeção de término em texto ----------
  // Pelo prazo ganho: faixa entre as duas hipóteses (ou um mês só, quando coincidem). Sem ela, pelo ritmo dos 3 últimos meses.
  function fraseProjecao(r, html = false) {
    const b = s => html ? `<b>${s}</b>` : s;
    if (r.projecaoFonte === 'prazo') {
      const f = r.projecaoFaixa, atr = r.prazoGanho.atraso;
      const h = [[f.atrasoMantido, atr > 0 ? 'se o atraso de hoje não aumentar' : 'se a diferença de hoje se mantiver'], [f.desempenhoMantido, 'se o desempenho de prazo se mantiver']]
        .sort((x, y) => x[0] < y[0] ? -1 : 1);
      if (h[0][0].slice(0, 7) === h[1][0].slice(0, 7)) return `pelo desempenho de prazo até aqui, a conclusão fica por volta de ${b(mesLongo(h[0][0]))}`;
      return `pelo desempenho de prazo até aqui, a conclusão fica entre ${b(mesLongo(h[0][0]))} (${h[0][1]}) e ${b(mesLongo(h[1][0]))} (${h[1][1]})`;
    }
    if (r.projecaoFonte === 'ritmo') return `no ritmo médio dos últimos 3 meses (${b(pct(r.ritmo) + ' ao mês')}), a conclusão fica por volta de ${b(mesLongo(r.projecao))}`;
    return '';
  }
  // Atraso em dias em linguagem comum: "23 dias de atraso" · "5 dias adiantada" · "no prazo"
  // sem (opcional): com o farol verde, alguns dias atrás do plano não são "atraso" (seria "Em dia" e "4 dias de atraso"
  // lado a lado): o texto diz que está na tolerância.
  function textoAtraso(g, sem) {
    if (!g) return '—';
    const n = Math.abs(g.atraso);
    if (n < 1) return 'no prazo';
    if (g.atraso > 0 && sem && sem.k === 'ok') return `${n} ${n === 1 ? 'dia' : 'dias'}, na tolerância`;
    return g.atraso > 0 ? `${n} ${n === 1 ? 'dia' : 'dias'} de atraso` : `${n} ${n === 1 ? 'dia' : 'dias'} adiantada`;
  }

  // ---------- narrativa automática (painel e report) ----------
  function narrativa(obra, r) {
    const out = [];
    const cp = comparaPlano(r.desvio);
    // os números do avanço e do desvio já estão nos indicadores logo acima: a leitura começa onde eles param
    if (r.inicioObra) out.push(`Obra em início: ${pct(r.prevCorte)} previsto até ${dBR(r.corte)}${r.real > 0 ? ` e ${pct(r.real)} realizado` : ', ainda sem medição'}. O farol de prazo acende a partir de 2% previsto.`);
    else if (cp.dir >= 0) out.push(`Avanço ${cp.longo} na data de corte (${dBR(r.corte)}).`);
    if (r.inicioObra) { /* diferença de frente no primeiro mês é ruído: fica de fora da leitura */ }
    else if (!r.pesosOk) {
      // pesos inválidos (Progresso por tarefas filtrado por período): diferença lida no avanço da própria atividade
      const m = atividades(r).filter(a => a.plan - a.feito >= 0.05).sort((a, b) => (b.plan - b.feito) - (a.plan - a.feito))[0];
      if (m) out.push(`A maior diferença para o plano está em <b>${esc(m.nome)}</b>: ${pct(m.feito, 0)} feito de ${pct(m.plan, 0)} planejado na data.`);
    } else if (r.piorPacote && r.piorPacote.desvio < -0.005) {
      let t = `A maior diferença para o plano está em <b>${esc(r.piorPacote.nome)}</b> (${pp(r.piorPacote.desvio)}): ${pct(r.piorPacote.realizado)} realizados de ${pct(r.piorPacote.peso)} do peso total`;
      if (r.piorSub && r.piorSub.desvio < -0.005) t += `, puxado por ${esc(r.piorSub.nome)} (${pct(r.piorSub.realizado)} de ${pct(r.piorSub.peso)})`;
      out.push(t + '.');
    }
    // prazos (cronograma, base e contrato) e ritmo necessário já estão nos indicadores e na linha do tempo: aqui só a projeção
    const fp = fraseProjecao(r, true);
    if (fp) out.push(capital(fp) + '.');
    if (r.crono && r.crono.usado && r.crono.pendentes.length) {
      const k = r.crono.pendentes;
      out.push(`${k.length === 1 ? '1 serviço segue' : k.length + ' serviços seguem'} <b>pendente${k.length > 1 ? 's' : ''} de contratação</b>: ${k.map(l => esc(l.nomeExib)).join('; ')}.`);
    }
    if (r.atrasadas.length && r.pesosOk) out.push(`${r.atrasadas.length} tarefas com término vencido somam ${pct(r.faltaAtrasadas)} do avanço da obra.`);
    if (r.campo) {
      const c = r.campo, u = c.ultimo;
      const ef = u.maoDeObra.reduce((s, m) => s + m.qtd, 0);
      let t = `Em campo (RDO nº ${u.numero}, ${dBR(u.data)}): ${ef} pessoas e ${c.frentes.length} frentes`;
      if (c.paralisadas.length) t += `, <b>${c.paralisadas.length} ${c.paralisadas.length === 1 ? 'paralisada' : 'paralisadas'}</b>`;
      out.push(t + '.');
    }
    return out;
  }

  // ---------- report executivo: formato fixo ----------
  // Mesmos blocos e os mesmos limites a cada atualização, para o leitor achar tudo no mesmo lugar:
  // manchete (1 frase) · 4 indicadores · período · 3 pontos-chave · até 5 frentes · até 3 atenções ·
  // próximos 30 dias (3) · 12 fotos.
  const LIM = { frentes: 5, atencao: 3, proximas: 3, fotos: 12, marcos: 5 };
  const capital = t => t.charAt(0).toUpperCase() + t.slice(1);
  function motivoCurto(m) {
    if (!m) return null;
    let t = m.replace(/^[^:]{0,60}:\s*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
    t = t.replace(/^servi[cç]o paralisado\s*(devido (ao|à|a)\s*)?/, '').replace(/^para dar continuidade ao servi[cç]o\s*/, '');
    return capital(t.length > 140 ? t.slice(0, 137).replace(/\s\S*$/, '') + '…' : t);
  }
  // ---------- auditoria das fontes ----------
  // Fontes, períodos de referência e conflitos de conciliação. Nada aqui altera os dados: só informa.
  // k: 'av' = conflito que afeta a leitura; 'info' = regra de cálculo aplicada.
  function auditoria(obra, r) {
    const al = [], fontes = [], corte = r.corte;
    const cron = obra.cronograma && obra.cronograma.linhas && obra.cronograma.linhas.length ? obra.cronograma : null;
    const cR = cron ? cron.linhas.find(l => l.nivel === 1) : null;
    const tar = obra.tarefas || [], tR = tar.find(t => t.nivel === 1);
    const curva = obra.curva || [], mm = obra.mensal || [], mc = corte.slice(0, 7);
    if (cR) fontes.push({ t: 'Cronograma (Prevision)', p: `posição de ${dBR(cron.dataRef || corte)}${r.crono && !r.crono.completo ? ' · exportado com a árvore recolhida' : ''}${r.crono && !r.crono.usado ? ' · anterior ao corte, não usado' : ''}` });
    if (tR) fontes.push({ t: 'Progresso por tarefas', p: `${tar.length} linhas · realizado ${pct(tR.realizado, 2)}` });
    if (tR && !r.pesosOk) al.push({ k: 'av', t: `Progresso por tarefas exportado com filtro de período: a linha raiz soma ${pct(r.pesoRaiz, 2)} em vez de 100%, então os pesos das frentes não valem. O painel mostra o avanço de cada atividade pelo cronograma (sem coluna de peso). Para ter os pesos, exporte o Progresso por tarefas sem filtro de datas e com a árvore toda aberta.` });
    if (curva.length) fontes.push({ t: 'Curva S', p: `${mesCurto(curva[0].data)} a ${mesCurto(curva.at(-1).data)} · realizado exibido até ${dCurto(corte)}` });
    const fech = mm.filter(m => m.mes < mc);
    if (mm.length) fontes.push({ t: 'Progresso mensal', p: `${fech.length ? 'fechado até ' + mesCurto(fech.at(-1).mes + '-01') : 'sem mês fechado'}${mm.some(m => m.mes === mc) ? ` · ${MES_L[+mc.slice(5, 7) - 1]} parcial até ${dCurto(corte)}` : ''}` });
    const rd = (obra.rdos || []).filter(x => x.data <= corte).sort((a, b) => a.data < b.data ? -1 : 1);
    if (rd.length) {
      const a = rd[0], b = rd.at(-1), np = rd.filter(x => x.status !== 'aprovado').length, nums = rd.map(x => x.numero);
      fontes.push({ t: 'Relatórios diários (RDO)', p: `${rd.length} relatórios, nº ${Math.min(...nums)} a ${Math.max(...nums)} · ${dCurto(a.data)} a ${dCurto(b.data)}${np ? ` · ${np} em preenchimento` : ''}` });
      const porNum = [...rd].sort((x, y) => x.numero - y.numero);
      const fora = porNum.filter((x, i) => i && x.data < porNum[i - 1].data);
      if (fora.length) al.push({ k: 'info', t: `A numeração dos RDOs não segue a ordem das datas (ex.: nº ${porNum[porNum.indexOf(fora[0]) - 1].numero} de ${dCurto(porNum[porNum.indexOf(fora[0]) - 1].data)} e nº ${fora[0].numero} de ${dCurto(fora[0].data)}). O painel ordena pela data do relatório.` });
      if (rd.length && rd.every(x => !(x.atividades || []).length)) al.push({ k: 'av', t: 'Os RDOs foram lidos sem a lista de atividades; a leitura de campo não está disponível.' });
      const lag = diff(b.data, corte);
      if (lag > 3) al.push({ k: 'av', t: `O último RDO é de ${dBR(b.data)}, ${lag} dias antes da data de corte: o registro de campo não cobre todo o período.` });
    }
    // mesma posição em todas as fontes de avanço?
    const ultCurva = (() => { const p = curva.find(x => x.data >= corte && x.realizado > 0) || [...curva].reverse().find(x => x.realizado > 0); return p ? p.realizado : null; })();
    const vals = [['Cronograma', cR && r.crono && r.crono.usado ? cR.realizado : null], ['Progresso por tarefas', tR ? tR.realizado : null], ['Curva S', ultCurva]].filter(v => v[1] !== null && v[1] !== undefined);
    if (vals.length > 1) {
      const nums = vals.map(v => v[1]);
      if (Math.max(...nums) - Math.min(...nums) > 0.001) al.push({ k: 'av', t: `O realizado difere entre as fontes (${vals.map(v => `${v[0]} ${pct(v[1], 2)}`).join(', ')}): exportações de datas diferentes. O painel usa ${r.crono && r.crono.usado ? 'o Cronograma' : 'o Progresso por tarefas'}.` });
    }
    if (tR && tR.base !== null && tR.base !== undefined && Math.abs(tR.base - 1) > 0.002) al.push({ k: 'av', t: `No Progresso por tarefas, a linha de base da raiz soma ${pct(tR.base, 2)} (esperado 100%): os pesos de base não fecham o total da obra.` });
    const ini = r.prazo.iniCron;
    const pre = curva.filter(p => ini && p.data < ini && p.realizado > 0);
    if (pre.length) al.push({ k: 'info', t: `A Curva S registra ${pct(Math.max(...pre.map(p => p.realizado)), 2)} de realizado antes do início do cronograma (${dBR(ini)}); a curva parte desse valor.` });
    if (mm.length && mm.every(m => !m.idpm)) al.push({ k: 'info', t: 'O IDPM do Progresso mensal veio zerado e não é usado. O índice de prazo é calculado pelo painel (realizado ÷ planejado na data).' });
    const mAtual = mm.find(m => m.mes === mc);
    if (mAtual && r.periodo) al.push({ k: 'info', t: `${MES_L[+mc.slice(5, 7) - 1].replace(/^./, c => c.toUpperCase())} está em andamento: o realizado do mês (${pct(r.periodo.real)}) vai até ${dCurto(corte)} e é comparado com o planejado até a mesma data (${pct(r.periodo.prev)}), não com o mês inteiro (${pct(mAtual.previsto)}). Zeros de meses futuros não são exibidos como medição.` });
    if (cron && tar.length) {
      const porLinha = new Map(tar.map(t => [t.linha, t]));
      let lig = 0, eapDif = 0;
      cron.linhas.forEach(l => { const t = porLinha.get(l.linha); if (t && normNome(t.tarefa) === normNome(l.nome)) { lig++; if (t.eap !== l.eap) eapDif++; } });
      const sem = cron.linhas.length - lig;
      if (sem) al.push({ k: 'av', t: `${sem} de ${cron.linhas.length} linhas do Cronograma não foram ligadas ao Progresso por tarefas (posição na árvore ou nome diferentes); essas linhas ficam fora da leitura por pacote.` });
      if (eapDif) al.push({ k: 'info', t: `${eapDif} linhas têm código EAP diferente entre o Cronograma e o Progresso por tarefas (o Prevision renumera a EAP). A ligação é feita pela posição na árvore e pelo nome, nunca só pelo código.` });
    }
    // governança (GOVERNANCA.md): cadência semanal para dados físicos, mensal para financeiro
    const hojeIso = iso(new Date());
    if (obra.dataCorte) {
      const atraso = diff(obra.dataCorte, hojeIso);
      if (atraso > LIMIAR_DIAS_FISICO) al.push({ k: 'av', t: `Dados físicos desatualizados: a última carga é de ${dBR(obra.dataCorte)}, ${atraso} dias atrás (governança: atualização semanal).` });
    }
    if (obra.dataCorteFinanceiro) {
      const atrasoFin = diff(obra.dataCorteFinanceiro, hojeIso);
      if (atrasoFin > LIMIAR_DIAS_FINANCEIRO) al.push({ k: 'av', t: `Dados financeiros desatualizados: a última carga é de ${dBR(obra.dataCorteFinanceiro)}, ${atrasoFin} dias atrás (governança: atualização mensal).` });
    }
    return { fontes, alertas: al.sort((a, b) => (a.k === 'av' ? 0 : 1) - (b.k === 'av' ? 0 : 1)) };
  }

  // ---------- restrições (Last Planner System) ----------
  // Restrição = o que precisa estar resolvido para uma atividade começar (projeto, contratação, material, aprovação...).
  // O farol sai da data limite, sem pintura manual:
  //   vencida (data limite passou) · vence em até 7 dias · sem data (ou condicionada a outro evento) · no prazo · removida
  // IRR (índice de remoção de restrições) da semana = removidas até a data prevista ÷ restrições previstas para a semana.
  // A data prevista é a ORIGINAL (a primeira data limite informada): reprogramar a data não melhora o índice.
  // PPC mede o cumprimento da programação semanal de tarefas, que o painel não recebe; para restrições vale o IRR.
  const ST_RESTR = { pendente: 'Pendente', andamento: 'Em andamento', aprovacao: 'Em aprovação', removida: 'Removida' };
  const TIPOS_RESTR = ['Projeto', 'Contratação', 'Material', 'Serviço', 'Mão de obra', 'Equipamento', 'Aprovação', 'Cliente', 'Outros'];
  const JANELA_RESTR = 7, META_IRR = 0.8;
  const prazoOriginal = x => x.dataOriginal || x.dataLimite || null;
  function farolRestricao(x, hoje) {
    if (x.status === 'removida') return { k: 'ok', t: 'Removida', ordem: 4 };
    if (!x.dataLimite) return { k: 'atencao', t: x.condicao ? 'Condicionada' : 'Sem data', ordem: 2 };
    const d = diff(hoje, x.dataLimite);
    if (d < 0) return { k: 'critico', t: `Vencida há ${-d} d`, ordem: 0, dias: d };
    if (d <= JANELA_RESTR) return { k: 'atencao', t: d === 0 ? 'Vence hoje' : `Vence em ${d} d`, ordem: 1, dias: d };
    return { k: 'info', t: 'No prazo', ordem: 3, dias: d };
  }
  // "Bruno / Maikon" · "André + Gisele" · "Maria, Gisele" → uma pessoa por nome
  const pessoasDe = s => String(s || '').split(/\s*(?:\/|\+|,|;|&|\se\s)\s*/).map(t => t.trim()).filter(Boolean);
  const segundaDe = d => { const w = (dia(d).getUTCDay() + 6) % 7; return addDias(d, -w); };
  // Ordem da lista: vencidas (mais antigas primeiro), vencem em 7 dias, sem data, no prazo, removidas (mais recentes primeiro)
  function ordenarRestricoes(itens, hoje) {
    return [...itens].map(x => ({ x, f: farolRestricao(x, hoje) })).sort((a, b) => a.f.ordem - b.f.ordem
      || (a.f.ordem === 4 ? String(b.x.removidaEm || '').localeCompare(String(a.x.removidaEm || '')) : String(a.x.dataLimite || '9').localeCompare(String(b.x.dataLimite || '9')))
      || String(a.x.frente || '').localeCompare(String(b.x.frente || ''), 'pt-BR')).map(v => v.x);
  }
  function indicadoresRestricoes(itens, hoje, semanas = 8) {
    const lista = itens || [];
    const abertas = lista.filter(x => x.status !== 'removida');
    const far = abertas.map(x => farolRestricao(x, hoje));
    const s0 = segundaDe(hoje);
    const serie = [];
    for (let i = semanas - 1; i >= 0; i--) {
      const ini = addDias(s0, -7 * i), fim = addDias(ini, 6), ate = fim < hoje ? fim : hoje;
      const prev = lista.filter(x => { const p = prazoOriginal(x); return p && p >= ini && p <= ate; });
      const ok = prev.filter(x => x.status === 'removida' && x.removidaEm && x.removidaEm <= prazoOriginal(x)).length;
      serie.push({ ini, fim, previstas: prev.length, noPrazo: ok, irr: prev.length ? ok / prev.length : null, atual: i === 0 });
    }
    // índice de referência: últimas 4 semanas somadas (uma semana com 2 restrições oscila demais)
    const u4 = serie.slice(-4), p4 = u4.reduce((a, w) => a + w.previstas, 0), ok4 = u4.reduce((a, w) => a + w.noPrazo, 0);
    const porPessoa = {};
    abertas.forEach((x, i) => pessoasDe(x.responsavel).forEach(n => {
      const r = porPessoa[n] || (porPessoa[n] = { nome: n, abertas: 0, vencidas: 0 });
      r.abertas++; if (far[i].k === 'critico') r.vencidas++;
    }));
    const semanaAtual = serie.at(-1);
    return {
      total: lista.length, abertas: abertas.length,
      vencidas: far.filter(f => f.k === 'critico').length,
      vencem7: far.filter(f => f.ordem === 1).length,
      semData: far.filter(f => f.ordem === 2).length,
      removidasSemana: lista.filter(x => x.status === 'removida' && x.removidaEm && x.removidaEm >= semanaAtual.ini && x.removidaEm <= hoje).length,
      reprogramadas: abertas.filter(x => (x.reprogramacoes || 0) > 0).length,
      serie, irr4: p4 ? ok4 / p4 : null, previstas4: p4, noPrazo4: ok4, meta: META_IRR,
      porPessoa: Object.values(porPessoa).sort((a, b) => b.vencidas - a.vencidas || b.abertas - a.abertas || a.nome.localeCompare(b.nome, 'pt-BR')),
    };
  }
  // Atividade vinculada que começa antes de a restrição sair: a restrição está no caminho da obra
  function restricaoImpede(x, linhas) {
    if (!x.atividade || x.status === 'removida') return null;
    const l = (linhas || []).find(v => v.linha === x.atividade.linha && normNome(v.nome) === normNome(x.atividade.nome))
      || (linhas || []).find(v => normNome(v.nome) === normNome(x.atividade.nome));
    if (!l) return { linha: null, nome: x.atividade.nome, inicio: null, conflito: false, achou: false };
    const conflito = !!(l.inicio && (!x.dataLimite || x.dataLimite >= l.inicio) && (l.realizado || 0) < 0.9995);
    return { linha: l.linha, nome: l.nome, inicio: l.inicio, conflito, achou: true };
  }
  // Data de restrição escrita à mão: "27/out", "28-out", "29/10/2026", "05/11", número de série do Excel ou ISO.
  // Ano ausente: o mais próximo da data de referência (o mapa de 29/10/2026 com "04/jan" é janeiro de 2027).
  const MES_N = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12 };
  function dataRestricao(v, ref) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number' && v > 20000 && v < 80000) return iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5 + 12 * 36e5));
    const t = String(v).trim().toLowerCase();
    let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[0];
    let d, mes, ano;
    if ((m = t.match(/^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?:\s*[\/.\-]\s*(\d{2,4}))?$/))) { d = +m[1]; mes = +m[2]; ano = m[3]; }
    else if ((m = t.match(/^(\d{1,2})\s*[\/.\-\s]\s*([a-zç]{3})[a-zç]*\.?(?:\s*[\/.\-\s]\s*(\d{2,4}))?$/)) && MES_N[m[2]]) { d = +m[1]; mes = MES_N[m[2]]; ano = m[3]; }
    else return null;
    if (!(mes >= 1 && mes <= 12 && d >= 1 && d <= 31)) return null;
    const pad = n => String(n).padStart(2, '0');
    if (ano) return `${ano.length === 2 ? '20' + ano : ano}-${pad(mes)}-${pad(d)}`;
    const r = ref || iso(new Date()), y = +r.slice(0, 4);
    const cands = [y - 1, y, y + 1].map(a => `${a}-${pad(mes)}-${pad(d)}`);
    return cands.sort((a, b) => Math.abs(diff(r, a)) - Math.abs(diff(r, b)))[0];
  }

  // ---------- marcos ----------
  // Marcos explícitos do cronograma ("MARCO ...") ou, na falta deles, entregas de 1 dia (entrega, aceite, vistoria,
  // liberação, comissionamento, testes). Variação só quando a linha tem data de base.
  const RE_MARCO = /^\s*marco\b/i;
  const RE_ENTREGA = /\b(entrega|aceite|vistoria|libera[cç](ao|ão|oes|ões)|comissionamento|habite|avcb|inaugura|teste hidrost|testes el[eé]tricos)/i;
  function marcos(r) {
    if (!r.crono) return [];
    const L = r.crono.linhas;
    const temFilho = l => L.some(x => x.eap.startsWith(l.eap + '.'));
    const grupos = L.filter(l => /^\s*marcos\b/i.test(l.nome));
    const doGrupo = l => grupos.find(g => l.eap.startsWith(g.eap + '.'));
    const expl = L.filter(l => !temFilho(l) && (RE_MARCO.test(l.nome) || doGrupo(l)));
    const cand = expl.length ? expl : L.filter(l => l.nivel > 1 && !temFilho(l) && (l.duracao ?? 99) <= 1 && RE_ENTREGA.test(l.nome));
    // data igual ao início da obra e sem base = linha ainda sem data definida no cronograma
    const semData = l => !l.fimBase && l.fim && l.fim <= r.prazo.iniCron;
    return cand.map(l => {
      const g = doGrupo(l);
      const m = l.nome.match(/^\s*marco\s*(de\s+interface)?\s*(M\d+)?\s*[-–—:]\s*/i);
      return { nome: m ? l.nome.slice(m[0].length) : l.nomeExib, codigo: m && m[2] ? m[2].toUpperCase() : null,
        data: l.fim, base: l.fimBase, slip: l.fimBase && l.fim ? diff(l.fimBase, l.fim) : null,
        situacao: l.realizado >= 0.9995 ? 'concluido' : semData(l) ? 'a-definir' : (l.fim && l.fim < r.corte ? 'vencido' : 'previsto'),
        interface: /interface|contratante|\bcliente\b/i.test(l.nome + ' ' + (l.responsaveis || '') + ' ' + (g ? g.nome : '')), realizado: l.realizado, explicito: true && !!(RE_MARCO.test(l.nome) || g) };
    }).map(m => m.situacao === 'a-definir' ? { ...m, data: null, slip: null } : m)
      .sort((a, b) => (a.data === null) - (b.data === null) || ((a.data || '') < (b.data || '') ? -1 : 1));
  }

  // Atividades do report: frentes da EAP (nível 2/3) abrindo até o pacote executável. Fonte: o cronograma do Prevision,
  // quando veio completo (avanço da própria linha); senão, os pacotes do Progresso por tarefas. Se o nível 2 tem
  // menos de 4 itens (ex.: Fase 1 / Fase 2), desce um nível para as frentes ficarem comparáveis.
  function atividades(r) {
    const k = r.crono;
    if (k && k.usado && k.completo) {
      // grupos de marcos ficam no bloco "Próximos marcos", não aqui
      const L = k.linhas.filter(l => !/^\s*marcos?\b/i.test(l.nome));
      const filhos = l => L.filter(x => x.nivel === l.nivel + 1 && x.eap.startsWith(l.eap + '.'));
      const nomeAt = n => { const b = n.length > 50 ? n.replace(/\s*\([^)]*\)\s*$/, '') : n; return nomeBonito(b).nome; };
      const peso = l => k.peso ? k.peso(l) : null;
      const no = l => { const fs = filhos(l); return { eap: l.eap, nome: nomeAt(l.nome), peso: peso(l), feito: l.realizado || 0, plan: l.previsto || 0, temFilhos: fs.length > 0, filhos: () => fs.map(no) }; };
      const raiz = k.linhas.find(l => l.nivel === 1) || k.linhas[0];
      let nos = filhos(raiz);
      // um item com mais da metade do peso (ex.: "Execução de Obra"): abre nos filhos, como nas frentes da aba Obra
      for (let i = 0; i < 3; i++) {
        const tot = nos.reduce((s, l) => s + (peso(l) || 0), 0);
        const dom = tot > 0 && nos.find(l => (peso(l) || 0) / tot > 0.5 && filhos(l).length > 1);
        if (!dom) break;
        const j = nos.indexOf(dom); nos = [...nos.slice(0, j), ...filhos(dom), ...nos.slice(j + 1)];
      }
      // poucos itens no nível 2 (ex.: Fase 1 / Fase 2): desce um nível
      for (let i = 0; i < 3 && nos.length < 4 && nos.some(l => filhos(l).length); i++) nos = nos.flatMap(l => filhos(l).length ? filhos(l) : [l]);
      return nos.map(no);
    }
    const no = p => ({ eap: p.eap, nome: p.nome, peso: p.peso, feito: p.pctPacote || 0, plan: p.peso > 0 ? Math.min(1, p.prevCorte / p.peso) : 0, temFilhos: p.temFilhos,
      filhos: () => r.subpacotes(p.eap).filter(x => x.peso > 0.00005).map(no) });
    return r.pacotes.filter(p => p.peso > 0.0005).map(no);
  }

  function resumoExecutivo(obra, r, destaques = []) {
    const P = r.prazo, c = r.campo;
    const relProj = !r.projecao ? '' : r.projecao <= P.fimCron ? 'dentro do cronograma' : (P.contrFim && r.projecao <= P.contrFim) ? 'após o cronograma e dentro do prazo contratual' : 'após o prazo contratual';
    const cp = comparaPlano(r.desvio);
    // Manchete (regra 18/10/2026): o farol do cabeçalho já diz a situação e os cartões já mostram realizado × planejado.
    // A frase só acrescenta o que não está à vista (projeção e onde está a maior diferença), sem repetir o juízo da obra.
    const frases = [];
    const fp = fraseProjecao(r);
    if (fp) frases.push(fp);
    if (r.inicioObra) frases.push(`obra em início, com ${pct(r.prevCorte)} previsto até ${dBR(r.corte)}${r.real > 0 ? ` e ${pct(r.real)} realizado` : ' e ainda sem medição'}; término do cronograma em ${dBR(r.prazo.fimCron)}`);
    else if (r.pesosOk) {
      const maior = r.piorPacote && r.piorPacote.desvio <= -TOLERANCIA ? r.piorPacote : null;
      frases.push(maior ? `a maior diferença para o plano está em ${maior.nome} (${pp(maior.desvio)})` : 'todas as frentes em linha com o plano ou acima dele');
    } else {
      // sem pesos válidos, a diferença é lida no avanço da própria atividade (feito × planejado na data)
      const m = atividades(r).filter(a => a.plan - a.feito >= 0.05).sort((a, b) => (b.plan - b.feito) - (a.plan - a.feito))[0];
      if (m) frases.push(`a maior diferença para o plano está em ${m.nome} (${pct(m.feito, 0)} feito de ${pct(m.plan, 0)} planejado na data)`);
    }
    const manchete = frases.length ? capital(frases.join('; ')) + '.' : '';

    const kpis = [
      { k: 'Avanço da obra', v: pct(r.real), s: `planejado para a data: ${pct(r.prevCorte)}` },
      { k: 'Comparado ao plano', v: `${cp.seta ? cp.seta + ' ' : ''}${cp.curto}`, s: r.prazoGanho ? `${textoAtraso(r.prazoGanho)} · índice de prazo ${fmtNum(r.farolTempo ? r.prazoGanho.idpT : r.idp, 2)}` : `índice de prazo ${fmtNum(r.idp, 2)} (1,00 = no ritmo)`, cls: cp.dir < 0 ? (r.sem.e === 'atrasada' ? 'crit' : 'warn') : 'ok' },
      { k: 'Término projetado', v: r.projecao ? mesCurto(r.projecao) : '—', s: `cronograma ${dCurto(P.fimCron)}${r.crono && r.crono.slip ? ` (${r.crono.slip > 0 ? '+' : ''}${r.crono.slip} d vs base)` : ''} · contrato ${P.contrFim ? dBR(P.contrFim).slice(0, 6) + P.contrFim.slice(2, 4) : '—'}`, cls: r.projecao && r.projecao > P.fimCron ? 'crit' : '' },
    ];

    const pontos = [];
    const melhor = [...r.pacotes].sort((a, b) => b.desvio - a.desvio)[0];
    if (r.piorPacote && r.piorPacote.desvio <= -TOLERANCIA) pontos.push({ t: 'Onde está o atraso', x: `${esc(r.piorPacote.nome)}, ${comparaPlano(r.piorPacote.desvio).longo}${r.piorSub && r.piorSub.desvio <= -TOLERANCIA ? `; o item que mais pesa é ${esc(r.piorSub.nome)} (${pct(r.piorSub.pctPacote, 0)} executado)` : ''}.` });
    else if (melhor && melhor.desvio >= TOLERANCIA) pontos.push({ t: 'Destaque', x: `${esc(melhor.nome)} está ${comparaPlano(melhor.desvio).longo}; nenhuma frente abaixo do plano.` });
    else pontos.push({ t: 'Avanço', x: 'todas as frentes em linha com o planejado.' });
    if (r.ritmo) pontos.push({ t: 'Prazo', x: !r.ritmoCron ? `a obra avança ${pct(r.ritmo)} por mês; o término do cronograma (${dBR(P.fimCron)}) já passou.`
      : r.ritmoCron > r.ritmo * 1.05 ? `para terminar em ${dBR(P.fimCron)}, a obra precisa avançar ${pct(r.ritmoCron)} por mês; hoje avança ${pct(r.ritmo)} (precisa de ${fmtNum(r.ritmoCron / r.ritmo, 1)} vezes o ritmo atual).`
      : r.ritmoCron > r.ritmo ? `para terminar em ${dBR(P.fimCron)}, a obra precisa avançar ${pct(r.ritmoCron)} por mês; hoje avança ${pct(r.ritmo)}, no limite do necessário.`
      : `a obra avança ${pct(r.ritmo)} por mês, acima dos ${pct(r.ritmoCron)} necessários para terminar até ${dBR(P.fimCron)}.` });
    if (c) { const emP = c.ultimo.status && c.ultimo.status !== 'aprovado' ? ' (relatório em preenchimento)' : '';
      pontos.push({ t: 'Registro de campo', x: !c.frentes.length ? `o RDO nº ${c.ultimo.numero} (${dCurto(c.ultimo.data)}) não registra atividades${emP}.` : c.paralisadas.length ? `o RDO nº ${c.ultimo.numero} (${dCurto(c.ultimo.data)}) registra ${c.paralisadas.length} de ${c.frentes.length} frentes como paralisadas${emP}.` : `o RDO nº ${c.ultimo.numero} (${dCurto(c.ultimo.data)}) registra ${c.frentes.length} frentes ativas, nenhuma paralisada${emP}.` }); }

    const neg = r.pacotes.filter(p => p.peso > 0.0005 && p.desvio < -0.0005).sort((a, b) => a.desvio - b.desvio);
    const top = neg.slice(0, LIM.frentes);
    const demais = r.pacotes.filter(p => p.peso > 0.0005 && !top.includes(p));
    const frentes = { top, demais: { n: demais.length, desvio: demais.reduce((s, p) => s + p.desvio, 0), peso: demais.reduce((s, p) => s + p.peso, 0) } };

    // Ordem fixa: uma de cada tipo primeiro (paralisada com motivo, pendente de contratação, atrasada),
    // depois completa com as demais paralisadas
    const par = c ? [...c.paralisadas].sort((a, b) => (b.motivo ? 1 : 0) - (a.motivo ? 1 : 0)).map(f => ({ tag: 'Paralisada', titulo: `${f.servico}${f.empresa ? ' · ' + f.empresa : ''}`, det: motivoCurto(f.motivo) || `Motivo não informado no RDO. Parada desde ${dCurto(f.paralisadaDesde)}.`, fonte: `RDO nº ${c.ultimo.numero}${c.ultimo.status && c.ultimo.status !== 'aprovado' ? ' · em preenchimento' : ''}` })) : [];
    const pen = r.crono ? r.crono.pendentes.map(l => ({ tag: 'Contratação', titulo: l.nomeExib, det: [(l.responsaveis || '').replace(/,?\s*Pendente de contratação/i, '').trim(), `término ${dBR(l.fim)}`, `${pct(l.realizado, 0)} feito`].filter(Boolean).join(' · '), fonte: 'Cronograma · responsável pendente de contratação' })) : [];
    const jaCitadas = new Set(pen.map(x => normNome(x.titulo)));
    const ta = r.atrasadas.find(t => !jaCitadas.has(normNome(t.nome)));
    const atr = ta ? [{ tag: 'Atrasada', titulo: ta.nome, det: [ta.caminho[0], `venceu em ${dBR(ta.fim)} (${ta.diasAtraso} dias)`, `${pct(ta.pctTarefa, 0)} feito`].filter(Boolean).join(' · '), fonte: 'Cronograma · término vencido sem 100%' }] : [];
    const atencao = [par[0], pen[0], atr[0], ...par.slice(1), ...pen.slice(1)].filter(Boolean);
    const atencaoMais = Math.max(0, atencao.length - LIM.atencao);

    const proximas = { n: r.proximas.length, top: [...r.proximas].sort((a, b) => b.falta - a.falta).slice(0, LIM.proximas).sort((a, b) => a.fim < b.fim ? -1 : 1) };

    // Fotos do report (regra 17/10/2026), janela = últimos 30 dias até o corte:
    // · 1 foto por serviço em execução; as LIM.fotos do mesmo serviço só quando ele é o único citado nos RDOs da janela;
    // · linha do tempo: foto 1 = a mais antiga do período, última foto = a mais recente (pela data do RDO).
    // Serviço da foto = EAP/legenda do RDO; sem legenda, cada RDO conta como um registro distinto.
    const fotos = (() => {
      const n = LIM.fotos, ord = (a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 : (a.rdo - b.rdo || a.idx - b.idx);
      const marcadas = destaques.map(k => r.fotos.find(f => f.id === k || f.src === k)).filter(Boolean).slice(0, n);
      if (marcadas.length >= n) return marcadas.sort(ord);
      const ini = addDias(r.corte, -30);
      const naoServ = /precipita|chuva|chuvoso|clima|tempo bom|nublado/i;
      const chave = f => {
        const L = f.legenda;
        if (L && L.eap) return 'eap:' + L.eap;
        const s = L && L.servico ? L.servico.replace(/\s+Anexos\s*\(.*$/i, '').replace(/\s+\d+([.,]\d+)?\s*[KM]B\s*$/i, '').trim() : '';
        if (s && !naoServ.test(s)) return 's:' + normNome(s);
        return L && L.servico ? null : 'rdo:' + f.rdo;
      };
      let cand = r.fotos.filter(f => f.data > ini && f.data <= r.corte && chave(f)).sort(ord);
      if (!cand.length) cand = r.fotos.filter(f => chave(f)).sort(ord).slice(-24);
      if (!cand.length) return marcadas.sort(ord);
      // serviços em execução citados nos RDOs da janela
      const servRdo = new Set((obra.rdos || []).filter(x => x.data > ini && x.data <= r.corte)
        .flatMap(x => x.atividades.filter(a => !/paralis|conclu/i.test(a.situacao || '')).map(a => normNome(a.servico || a.descricao || ''))).filter(Boolean));
      const servFotos = new Set(cand.map(chave));
      const unico = servRdo.size <= 1 && servFotos.size === 1;
      const escolhidas = [...marcadas];
      const usadas = new Set(unico ? [] : escolhidas.map(chave));
      const livre = f => !escolhidas.includes(f) && (unico ? !escolhidas.some(e => e.rdo === f.rdo) || cand.every(c => escolhidas.includes(c) || escolhidas.some(e => e.rdo === c.rdo)) : !usadas.has(chave(f)));
      const pega = f => { if (f && escolhidas.length < n) { escolhidas.push(f); usadas.add(chave(f)); } };
      const t0 = dia(cand[0].data).getTime(), t1 = dia(cand.at(-1).data).getTime();
      const alvo = i => t0 + (t1 - t0) * i / (n - 1);
      // extremos primeiro (mais antiga e mais recente), depois o meio da linha do tempo
      pega(cand.find(livre)); pega([...cand].reverse().find(livre));
      for (let i = 1; i < n - 1 && escolhidas.length < n; i++) {
        const t = alvo(i);
        pega(cand.filter(livre).sort((a, b) => Math.abs(dia(a.data) - t) - Math.abs(dia(b.data) - t))[0]);
      }
      return escolhidas.sort(ord);
    })();

    const ms = marcos(r);
    const msAbertos = ms.filter(m => m.situacao !== 'concluido');
    const marcosSel = { lista: msAbertos.slice(0, LIM.marcos), mais: Math.max(0, msAbertos.length - LIM.marcos), concluidos: ms.length - msAbertos.length, explicitos: ms.some(m => m.explicito), semData: msAbertos.filter(m => m.situacao === 'a-definir').length };
    return { manchete, kpis, pontos, frentes, atencao: atencao.slice(0, LIM.atencao), atencaoMais, proximas, fotos, fotosEscolhidas: destaques.length > 0, LIM, marcos: marcosSel, auditoria: auditoria(obra, r) };
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
    const m = { t: 16, r: opts.rotulos ? 52 : (estreito ? 14 : 92), b: 30, l: 40 };
    const pts = r.pts;
    const x0 = dia(pts[0].data).getTime(), x1 = dia(pts.at(-1).data).getTime();
    const X = d => m.l + (dia(d).getTime() - x0) / (x1 - x0) * (W - m.l - m.r);
    const Y = v => H - m.b - v * (H - m.t - m.b);
    // Curva diária do Prevision (física e financeira): o realizado só vem nos dias de medição e é 0 nos demais. O
    // realizado acumulado é o último valor medido até cada data; a linha liga só os dias com medição (antes ligava os
    // zeros e "subia e descia"). Curva mensal (um ponto por mês) continua igual.
    const medido = pts.filter(p => p.data <= r.corte && (p.realizado || 0) > 0);
    const acumAte = d => { let v = 0; for (const p of medido) { if (p.data > d) break; v = Math.max(v, p.realizado); } return v; };
    const realPts = [[pts[0].data, 0], ...medido.map(p => [p.data, p.realizado])];
    if (realPts.at(-1)[0] !== r.corte) realPts.push([r.corte, r.real]);
    let g = '';
    for (const v of [0, 0.25, 0.5, 0.75, 1]) {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`;
      g += `<text x="${m.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v * 100}%</text>`;
    }
    // eixo X: um rótulo por mês (no meio do mês), espaçados para não encostar — antes saía um por ponto da curva,
    // e na curva diária isso dava um rótulo por dia
    const mesesX = []; for (let k = pts[0].data.slice(0, 7); k <= pts.at(-1).data.slice(0, 7);) { mesesX.push(k); const [y, mo] = k.split('-').map(Number); k = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
    const meioMes = k => { const md = `${k}-15`; return md < pts[0].data ? pts[0].data : md > pts.at(-1).data ? pts.at(-1).data : md; };
    const slotX = (W - m.l - m.r) / Math.max(1, mesesX.length);
    rotulosMeses(mesesX, slotX, r.corte.slice(0, 7)).forEach(l => { g += `<text x="${X(meioMes(l.k)).toFixed(1)}" y="${H - 10}" class="ax${l.forte ? ' ax-strong' : ''}" text-anchor="middle">${l.t}</text>`; });
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
    if (!estreito || opts.rotulos) {
      g += `<text x="${fim[0] + 9}" y="${fim[1] + 4}" class="lbl lbl-real">${pct(r.real)}</text>`;
      g += `<text x="${X(r.corte) + 9}" y="${Y(r.prevCorte) - 6}" class="lbl">${pct(r.prevCorte)}</text>`;
    }
    if (!estreito) {
      const ul = pts.at(-1);
      g += `<text x="${X(ul.data) + 8}" y="${Y(ul.previsto) + 4}" class="lbl-s">Previsto</text>`;
    }
    g += `<g class="hover" visibility="hidden"><line class="xh" y1="${m.t}" y2="${H - m.b}"/></g>`;
    g += `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="transparent" class="hit"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Curva S física: realizado ${pct(r.real)} contra previsto ${pct(r.prevCorte)} em ${dBR(r.corte)}">${g}</svg><div class="tip" hidden></div>`;
    // hover: ponto mais próximo
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), hv = svg.querySelector('.hover'), xh = svg.querySelector('.xh');
    const alvo = pts.map(p => ({ ...p, realizado: p.data <= r.corte ? acumAte(p.data) : null })).filter((p, i) => i > 0);
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

  // Custo real por mês (planilha de orçamento cliente): previsto × realizado em R$, mês do corte parcial.
  // cr = calcCustoReal(obra). Mesmo desenho das barras do avanço mensal; rótulo do realizado em cima de cada barra.
  function chartCustoMensal(el, cr, opts = {}) {
    const W = Math.max(300, el.clientWidth || 640), H = opts.altura || 240;
    const m = { t: 20, r: 8, b: 30, l: 52 };
    const dados = cr.meses, mesCorte = cr.corte.slice(0, 7);
    const max = niceMax(Math.max(...dados.map(d => Math.max(d.previsto || 0, d.realizado || 0))));
    const n = dados.length, slot = (W - m.l - m.r) / n, bw = Math.max(4, Math.min(22, slot / 2 - 4));
    const Y = v => H - m.b - v / max * (H - m.t - m.b);
    const mi = v => fmtNum(v / 1e6, v >= 1e7 ? 0 : 1);
    let g = '';
    [0, max / 2, max].forEach(v => { g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${m.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v ? 'R$ ' + fmtNum(v / 1e6, Math.round(v / 1e5) % 1 || Math.round(v / 1e4) % 10 ? 2 : 1) + ' mi' : '0'}</text>`; });
    dados.forEach((d, i) => {
      const cx = m.l + slot * i + slot / 2, futuro = d.realizado === null || d.realizado === undefined, parcial = d.mes === mesCorte && cr.parcial;
      const bar = (x, v, cls) => { if (!v) return ''; const y = Y(v), h = H - m.b - y; const rr = Math.min(4, h); return `<path d="M${x} ${H - m.b} V${y + rr} Q${x} ${y} ${x + rr} ${y} H${x + bw - rr} Q${x + bw} ${y} ${x + bw} ${y + rr} V${H - m.b} Z" class="${cls}"/>`; };
      g += bar(cx - bw - 1, d.previsto, 'bar-prev');
      if (!futuro) { g += bar(cx + 1, d.realizado, 'bar-real' + (parcial ? ' parcial' : ''));
        if (d.realizado) g += `<text x="${cx + 1 + bw / 2}" y="${Y(d.realizado) - 5}" class="lbl-s" text-anchor="middle">${mi(d.realizado)}</text>`; }
      g += `<text x="${cx}" y="${H - 10}" class="ax${d.mes === mesCorte ? ' ax-strong' : ''}" text-anchor="middle">${MES[+d.mes.slice(5, 7) - 1]}${parcial ? '*' : ''}</text>`;
    });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Custo por mês, previsto e realizado, em milhões de reais">${g}</svg>`;
  }

  // Rótulos de mês sem sobrepor: um a cada "passo" meses (o bastante para ~38 px entre rótulos), sempre o mês do corte;
  // o ano aparece no primeiro mês e em janeiro.
  function rotulosMeses(meses, slot, mesCorte) {
    const passo = Math.max(1, Math.ceil(38 / Math.max(1, slot)));
    return meses.map((k, i) => {
      const forte = k === mesCorte;
      if (!forte && i % passo) return null;
      if (!forte && Math.abs(meses.indexOf(mesCorte) - i) < passo && meses.includes(mesCorte)) return null; // abre espaço para o mês do corte
      const ano = i === 0 || k.slice(5) === '01';
      return { i, k, t: MES[+k.slice(5, 7) - 1] + (ano ? '/' + k.slice(2, 4) : ''), forte };
    }).filter(Boolean);
  }
  // Avanço físico (report): dois painéis alinhados no mesmo eixo de tempo, cada um com a sua escala
  //   em cima: curva S acumulada (realizado · planejado · base) e a diferença até o corte
  //   embaixo: avanço de cada mês, planejado (contorno) × realizado (cheio); mês do corte parcial
  // Antes as barras do mês dividiam o quadro com a curva em dois eixos Y (0–100% e 0–20%), o que fazia as barras
  // parecerem comparáveis à curva. Notação IBCS: realizado = cheio escuro · planejado = contorno · base = tracejado claro.
  function chartCombo(el, obra, r, opts = {}) {
    const W = Math.max(300, el.clientWidth || 760), estreito = W < 560;
    const H = Math.max(240, opts.altura || (estreito ? 300 : 340));
    const m = { t: 22, r: 16, b: 26, l: 44 }, gap = 22;
    const hTop = Math.round((H - m.t - m.b - gap) * 0.68), hBot = H - m.t - m.b - gap - hTop;
    const yT0 = m.t + hTop, yB1 = yT0 + gap, yB0 = yB1 + hBot; // base do painel de cima · topo e base do de baixo
    const pts = r.pts, mesCorte = r.corte.slice(0, 7);
    const ini = pts[0].data.slice(0, 7), fim = [pts.at(-1).data, r.prazo.fimCron].sort().at(-1).slice(0, 7);
    const meses = []; for (let k = ini; k <= fim;) { meses.push(k); const [y, mo] = k.split('-').map(Number); k = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; }
    const porMes = Object.fromEntries((obra.mensal || []).map(d => [d.mes, d]));
    const n = meses.length, slot = (W - m.l - m.r) / n;
    const X = d => { const i = Math.max(0, Math.min(n - 1, meses.indexOf(d.slice(0, 7)))); const dim = +fimDoMes(d.slice(0, 7)).slice(8, 10); return m.l + slot * (i + Math.min(1, +d.slice(8, 10) / dim)); };
    const Y = v => yT0 - v * hTop;
    const realMes = d => d.mes > mesCorte ? null : d.mes === mesCorte ? Math.max(0, r.periodo.real) : d.realizado;
    const maxBar = Math.max(0.01, ...meses.map(k => porMes[k]).filter(Boolean).map(d => Math.max(d.base || 0, d.previsto || 0, realMes(d) || 0)));
    const topoR = niceMax(maxBar * 1.1);
    const YR = v => yB0 - v / topoR * hBot;
    const fmtP = v => fmtNum(v * 100, Number.isInteger(Math.round(v * 1000) / 10) ? 0 : 1) + '%';
    let g = '';
    // painel de cima: grade e escala acumulada
    [0, 0.25, 0.5, 0.75, 1].forEach(v => {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/>`;
      g += `<text x="${m.l - 8}" y="${Y(v) + 4}" class="ax" text-anchor="end">${v * 100}%</text>`;
    });
    g += `<text x="${m.l}" y="${m.t - 9}" class="ax ax-t">Acumulado</text>`;
    // painel de baixo: grade e escala do mês
    [0, topoR / 2, topoR].forEach(v => {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${YR(v)}" y2="${YR(v)}" class="grid"/>`;
      g += `<text x="${m.l - 8}" y="${YR(v) + 4}" class="ax" text-anchor="end">${fmtP(v)}</text>`;
    });
    g += `<text x="${m.l}" y="${yB1 - 7}" class="ax ax-t">No mês</text>`;
    // três barras por mês, na ordem da legenda: base (clara) · planejado (contorno) · realizado (cheio, com o valor)
    const bw = Math.max(3, Math.min(11, slot * 0.24));
    const bar = (x, v, cls) => { if (!v || v <= 0) return ''; const y = YR(v), h = yB0 - y; return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0.5, h).toFixed(1)}" rx="1.5" class="${cls}"/>`; };
    meses.forEach((k, i) => {
      const d = porMes[k], cx = m.l + slot * i + slot / 2;
      if (!d) return;
      const rv = realMes(d);
      g += bar(cx - 1.5 * bw - 1.5, d.base, 'cb-base'); g += bar(cx - bw / 2, d.previsto, 'cb-plan'); g += bar(cx + bw / 2 + 1.5, rv, 'cb-real' + (k === mesCorte ? ' parcial' : ''));
      if (rv > 0.0005 && slot >= 34) g += `<text x="${(cx + bw + 1.5).toFixed(1)}" y="${(YR(rv) - 4).toFixed(1)}" class="lbl-m" text-anchor="middle">${fmtNum(rv * 100, rv >= 0.1 ? 1 : 2)}</text>`;
    });
    rotulosMeses(meses, slot, mesCorte).forEach(l => { g += `<text x="${(m.l + slot * l.i + slot / 2).toFixed(1)}" y="${H - 8}" class="ax${l.forte ? ' ax-strong' : ''}" text-anchor="middle">${l.t}</text>`; });
    // curvas acumuladas e a diferença até o corte. O realizado acumulado vem dos fechamentos de mês (último valor medido
    // até o fim de cada mês) e do corte: a Curva S diária do Prevision traz 0 nos dias sem medição, e ligar esses pontos
    // desenhava "dentes" até o zero.
    const medido = pts.filter(p => p.data <= r.corte && (p.realizado || 0) > 0);
    const acumAte = d => { const q = medido.filter(p => p.data <= d); return q.length ? q.at(-1).realizado : 0; };
    const realPts = [[pts[0].data, 0]];
    meses.filter(k => k < mesCorte).forEach(k => { const fm = fimDoMes(k); if (fm >= pts[0].data) realPts.push([fm, acumAte(fm)]); });
    realPts.push([r.corte, r.real]);
    const realXY = realPts.map(p => [X(p[0]), Y(p[1])]);
    const prevAte = pts.filter(p => p.data <= r.corte).map(p => [X(p.data), Y(p.previsto)]).concat([[X(r.corte), Y(r.prevCorte)]]);
    g += `<path d="${linhaPath(prevAte)} ${realXY.slice().reverse().map(p => 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')}Z" class="gap-area${r.desvio >= 0 ? ' pos' : ''}"/>`;
    const xc = X(r.corte);
    g += `<line x1="${xc}" x2="${xc}" y1="${m.t}" y2="${yB0}" class="corte"/>`;
    g += `<path d="${linhaPath(pts.map(p => [X(p.data), Y(p.base)]))}" class="ln ln-base"/>`;
    g += `<path d="${linhaPath(pts.map(p => [X(p.data), Y(p.previsto)]))}" class="ln ln-prev"/>`;
    g += `<path d="${linhaPath(realXY)}" class="ln ln-real"/>`;
    // fechamentos de mês: ponto e valor acumulado (como no relatório mensal); o do corte tem rótulo próprio
    realPts.slice(1, -1).forEach((p, i) => { const [x, y] = realXY[i + 1]; if (p[1] <= 0) return;
      g += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.6" class="dot-real-m"/>`;
      if (slot >= 34 && X(r.corte) - x > 26) g += `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" class="lbl-m lbl-m-real" text-anchor="middle">${fmtNum(p[1] * 100, 1)}%</text>`; });
    const f = realXY.at(-1), yp = Y(r.prevCorte);
    g += `<circle cx="${f[0]}" cy="${f[1]}" r="4.5" class="dot-real"/><circle cx="${xc}" cy="${yp}" r="3.5" class="dot-prev"/>`;
    // rótulos do corte: realizado à direita (ou à esquerda, sem espaço); planejado acima do ponto, ou abaixo quando o
    // ponto está colado no topo; "corte dd/mm" na faixa entre os painéis, longe dos valores
    const dir = f[0] + 56 < W - m.r, sep = Math.abs(f[1] - yp) < 16;
    g += `<text x="${f[0] + (dir ? 8 : -8)}" y="${f[1] + (sep && f[1] >= yp ? 16 : 4)}" class="lbl lbl-real" text-anchor="${dir ? 'start' : 'end'}">${pct(r.real)}</text>`;
    const ypl = yp - 7 < m.t + 4 ? yp + 15 : yp - 7;
    g += `<text x="${xc - 8}" y="${ypl}" class="lbl" text-anchor="end">${pct(r.prevCorte)}</text>`;
    // corte perto do início do eixo: o rótulo passa para depois de "No mês" (senão os dois se sobrepõem)
    const dirC = xc + 70 < W - m.r, xRot = dirC ? Math.max(xc + 5, m.l + 52) : xc - 5;
    g += `<text x="${xRot}" y="${yB1 - 7}" class="ax" text-anchor="${dirC ? 'start' : 'end'}">corte ${dCurto(r.corte)}</text>`;
    meses.forEach((k, i) => { g += `<rect x="${m.l + slot * i}" y="${m.t}" width="${slot}" height="${yB0 - m.t}" fill="transparent" class="hit" data-i="${i}"/>`; });
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Avanço físico: acumulado realizado ${pct(r.real)} contra planejado ${pct(r.prevCorte)} em ${dBR(r.corte)}; abaixo, o avanço de cada mês">${g}</svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('pointerenter', () => {
        const k = meses[+h.dataset.i], d = porMes[k] || {}, fimM = fimDoMes(k);
        const ate = k === mesCorte ? r.corte : fimM, fut = k > mesCorte;
        tip.innerHTML = `<b>${mesLongo(k)}${k === mesCorte ? ' · parcial até ' + dCurto(r.corte) : ''}</b>
          <span class="tip-g">Acumulado</span>
          <span><i class="sw sw-base"></i>Base <em>${pct(interp(pts, 'base', ate))}</em></span>
          <span><i class="sw sw-prev"></i>Planejado <em>${pct(k === mesCorte ? r.prevCorte : interp(pts, 'previsto', ate))}</em></span>
          <span><i class="sw sw-real"></i>Realizado <em>${fut ? '—' : pct(k === mesCorte ? r.real : acumAte(ate))}</em></span>
          <span class="tip-g">No mês</span>
          <span><i class="sw sw-bplan"></i>Planejado <em>${pct(d.previsto)}</em></span>
          <span><i class="sw sw-breal"></i>Realizado <em>${fut ? '—' : pct(realMes(d.mes ? d : { mes: k, realizado: null }))}</em></span>`;
        tip.hidden = false;
        const bb = svg.getBoundingClientRect(), px = (+h.getAttribute('x') + slot / 2) / W * bb.width;
        tip.style.left = (px > bb.width - 190 ? px - 182 : px + 12) + 'px'; tip.style.top = '8px';
      });
      h.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  // Efetivo diário (empilhado: próprio + terceiros)
  function chartEfetivo(el, campo, opts = {}) {
    // altura até 220 px: no report o quadro sobra na folha e barras de 300 px não acrescentam leitura
    const W = Math.max(260, el.clientWidth || 400), H = Math.min(220, opts.altura || 120), m = { t: 14, r: 4, b: 22, l: 26 };
    const s = campo.serie, max = niceMax(Math.max(...s.map(x => x.propria + x.terceiros)) * 1.1);
    const media = s.reduce((a, x) => a + x.propria + x.terceiros, 0) / Math.max(1, s.length);
    const slot = (W - m.l - m.r) / s.length, bw = Math.max(4, Math.min(22, slot - 6));
    const Y = v => H - m.b - v / max * (H - m.t - m.b);
    let g = `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(0)}" y2="${Y(0)}" class="grid"/><line x1="${m.l}" x2="${W - m.r}" y1="${Y(max)}" y2="${Y(max)}" class="grid"/><text x="${m.l - 6}" y="${Y(max) + 4}" class="ax" text-anchor="end">${max}</text><text x="${m.l - 6}" y="${Y(0) + 4}" class="ax" text-anchor="end">0</text>`;
    // dia com clima impraticável no RDO: faixa de fundo (base para pleito de prazo por chuva)
    s.forEach((d, i) => { if (d.impraticavel) g += `<rect x="${(m.l + slot * i).toFixed(1)}" y="${m.t}" width="${slot.toFixed(1)}" height="${H - m.t - m.b}" class="dia-chuva"/>`; });
    s.forEach((d, i) => {
      const x = m.l + slot * i + (slot - bw) / 2;
      const yT = Y(d.terceiros), yP = Y(d.terceiros + d.propria);
      g += `<rect x="${x}" y="${yT}" width="${bw}" height="${H - m.b - yT}" class="bar-terc"/>`;
      g += `<rect x="${x}" y="${yP}" width="${bw}" height="${Math.max(0, yT - yP - 2)}" rx="2" class="bar-prop"/>`;
      if (s.length <= 16 || i % 2 === 0) g += `<text x="${x + bw / 2}" y="${H - 6}" class="ax" text-anchor="middle">${d.data.slice(8, 10)}</text>`;
      g += `<rect x="${m.l + slot * i}" y="${m.t}" width="${slot}" height="${H - m.t - m.b}" fill="transparent" class="hit" data-i="${i}"/>`;
    });
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(media).toFixed(1)}" y2="${Y(media).toFixed(1)}" class="media"/><text x="${W - m.r}" y="${(Y(media) - 4).toFixed(1)}" class="ax ax-strong" text-anchor="end">média ${fmtNum(media, 0)}</text>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Efetivo diário em campo, média ${fmtNum(media, 0)} pessoas${campo.diasImpraticaveis ? `, ${campo.diasImpraticaveis} dias impraticáveis` : ''}">${g}</svg><div class="tip" hidden></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('pointerenter', () => {
        const d = s[+h.dataset.i];
        tip.innerHTML = `<b>RDO ${d.numero} · ${dBR(d.data)}</b><span><i class="sw sw-prop"></i>Próprios <em>${d.propria}</em></span><span><i class="sw sw-terc"></i>Terceiros <em>${d.terceiros}</em></span><span>Paralisadas <em>${d.paralisadas}</em></span>${d.impraticavel ? '<span>Clima impraticável em algum turno</span>' : ''}`;
        tip.hidden = false; const bb = svg.getBoundingClientRect(); const px = (+h.getAttribute('x')) / W * bb.width;
        tip.style.left = Math.min(bb.width - 170, Math.max(0, px + 10)) + 'px'; tip.style.top = '0px';
      });
      h.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  // Tendência do prazo: atraso em dias no fim de cada mês (barra para cima = atraso, para baixo = adiantada).
  // Meses em que o índice ainda não é confiável (início da obra) ficam esmaecidos.
  function chartTendencia(el, serie, opts = {}) {
    const W = Math.max(300, el.clientWidth || 640), estreito = W < 520, H = opts.altura || (estreito ? 190 : 220);
    const m = { t: 16, r: 8, b: 30, l: 48 };
    const dados = (serie || []).slice(-(estreito ? 12 : 24));
    if (!dados.length) { el.innerHTML = ''; return; }
    const maxA = niceMax(Math.max(5, ...dados.map(d => Math.abs(d.atraso))));
    const temNeg = dados.some(d => d.atraso <= -1), temPos = dados.some(d => d.atraso >= 1);
    const top = temPos || !temNeg ? maxA : 0, bot = temNeg ? -maxA : 0;
    const Y = v => m.t + (top - v) / (top - bot) * (H - m.t - m.b);
    const n = dados.length, slot = (W - m.l - m.r) / n, bw = Math.max(4, Math.min(26, slot - 6));
    let g = '';
    [...new Set([top, 0, bot])].forEach(v => { g += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="' + (v === 0 ? 'zero' : 'grid') + '"/><text x="' + (m.l - 8) + '" y="' + (Y(v) + 4).toFixed(1) + '" class="ax" text-anchor="end">' + (v === 0 ? '0' : (v > 0 ? '+' : '−') + fmtNum(Math.abs(v), 0) + ' d') + '</text>'; });
    dados.forEach((d, i) => {
      const cx = m.l + slot * i + slot / 2, y0 = Y(0), y1 = Y(d.atraso), ult = i === n - 1;
      const cls = (d.atraso > 0 ? 'bar-atr' : 'bar-adi') + (d.confiavel ? '' : ' fraco');
      if (Math.abs(d.atraso) >= 1) g += '<rect x="' + (cx - bw / 2).toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" rx="1.5" class="' + cls + '"/>';
      if (!estreito || ult || (n - 1 - i) % 2 === 0) g += '<text x="' + cx.toFixed(1) + '" y="' + (H - 10) + '" class="ax' + (ult ? ' ax-strong' : '') + '" text-anchor="middle">' + MES[+d.data.slice(5, 7) - 1] + (ult ? '*' : '') + '</text>';
      g += '<rect x="' + (cx - slot / 2).toFixed(1) + '" y="' + m.t + '" width="' + slot.toFixed(1) + '" height="' + (H - m.t - m.b) + '" fill="transparent" class="hit" data-i="' + i + '"/>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Atraso em dias no fim de cada mês">' + g + '</svg><div class="tip" hidden></div>';
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip');
    svg.querySelectorAll('.hit').forEach(h => {
      h.addEventListener('pointerenter', () => {
        const i = +h.dataset.i, d = dados[i];
        tip.innerHTML = '<b>' + dBR(d.data) + (i === n - 1 ? ' · corte' : '') + '</b>'
          + '<span>Prazo <em>' + textoAtraso(d) + '</em></span>'
          + '<span>IDP(t) <em>' + fmtNum(d.idpT, 2) + '</em></span>'
          + '<span>Realizado <em>' + pct(d.real) + '</em> · previsto <em>' + pct(d.prev) + '</em></span>'
          + (d.confiavel ? '' : '<span>início da obra: índice pouco estável</span>');
        tip.hidden = false;
        const bb = svg.getBoundingClientRect(); const px = (+h.getAttribute('x') + slot / 2) / W * bb.width;
        tip.style.left = Math.min(bb.width - 190, Math.max(0, px + 10)) + 'px'; tip.style.top = '8px';
      });
      h.addEventListener('pointerleave', () => { tip.hidden = true; });
    });
  }

  root.Core = { esc, fmtNum, pct, pp, dBR, dCurto, mesCurto, mesLongo, diaSemana, diff, addDias, semaforo, FAIXAS,
    calc, atividades, comparaPlano, TOLERANCIA, estimaDataRef, dataDoPrevisto, prazoGanho, tendenciaPrazo, textoAtraso, fraseProjecao, chartTendencia, narrativa, resumoExecutivo, ST_RESTR, TIPOS_RESTR, META_IRR, JANELA_RESTR, farolRestricao, indicadoresRestricoes, ordenarRestricoes, restricaoImpede, dataRestricao, pessoasDe, prazoOriginal, chartCurvaS, chartMensal, chartCustoMensal, chartCombo, chartEfetivo,
    LIM_FOTOS: LIM.fotos, calcFinanceiro, calcCustoReal, moeda, moedaCurta, vaNoReport, empresasFrente, qualidadeRdo, qualidadeDocs, LIMIAR_DIAS: { fisico: LIMIAR_DIAS_FISICO, financeiro: LIMIAR_DIAS_FINANCEIRO }, MAPA_ST, atividadesParaMapa, ptsZona, geoZona, mapasDaObra, fotoNoMapa };
})(typeof window !== 'undefined' ? window : globalThis);

