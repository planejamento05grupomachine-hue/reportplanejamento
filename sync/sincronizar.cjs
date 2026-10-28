#!/usr/bin/env node
// ============================================================
// Painel de Obras Machine — sincronização semanal com o Prevision.
// Coleta os dados físicos (%) e financeiros (Valor Agregado) das obras de sync/obras.json, valida com as regras da
// tela Alimentar (mais estritas, porque ninguém revisa) e grava como RASCUNHO. Publicar para o cliente continua manual.
//
//   node sync/sincronizar.cjs --todas [--simular]
//   node sync/sincronizar.cjs --obra 198 --fonte arquivos --dir <pasta> --simular
//   node sync/sincronizar.cjs --ler-relatorio relatorio-sync.bin
//
// Fontes (--fonte): auto (padrão: API oficial nos conjuntos com equivalência comprovada, exportação nos demais) ·
// exportacao (Playwright + sessão salva) · api · arquivos (<dir>/<obra>/fisico|financeiro).
// Variáveis: PAINEL_GH_TOKEN, PAINEL_EMAIL, PAINEL_SENHA, PREVISION_SESSAO (conteúdo do storageState) ou
// PREVISION_SESSAO_ARQUIVO, PREVISION_API_TOKEN. Ver sync/README.md.
// ============================================================
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { RAIZ, Cofre, Carga, carregarXLSX, configPublica, sha256 } = require('./lib/ambiente.cjs');
const { GitHub } = require('./lib/github.cjs');
const painel = require('./lib/painel.cjs');
const { lerConjunto, arquivosDaPasta, lerPlanilha } = require('./lib/leitura.cjs');
const { validarFisico, validarFinanceiro } = require('./lib/validacao.cjs');
const prevApi = require('./lib/prevision-api.cjs');

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });
const NATUREZAS = ['fisico', 'financeiro'];
const ROTULO = { fisico: { curva: 'Curva S', mensal: 'Progresso mensal ou semanal', tarefas: 'Progresso por tarefas', cronograma: 'Cronograma' },
  financeiro: { curva: 'Curva S financeira (VA)', mensal: 'Progresso mensal/semanal financeiro', tarefas: 'Progresso por tarefas financeiro' } };
// falhas que valem para todas as obras daquela fonte: não adianta tentar de novo nesta execução
const FALHA_DA_FONTE = ['SESSAO_PREVISION_EXPIRADA', 'SEM_SESSAO_PREVISION', 'TOKEN_PREVISION', 'SEM_TOKEN_PREVISION', 'DEPENDENCIA'];

function lerArgs(argv) {
  const o = { obras: [], todas: false, simular: false, fonte: 'auto', dir: null, aceitarNovaBase: false, verificarPages: true, relatorio: 'relatorio-sync.bin', config: path.join(__dirname, 'obras.json'), lerRelatorio: null, esperaPagesMin: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => argv[++i];
    if (a === '--obra') o.obras.push(...String(v()).split(',').map(s => s.trim()).filter(Boolean));
    else if (a === '--todas') o.todas = true;
    else if (a === '--simular') o.simular = true;
    else if (a === '--fonte') o.fonte = v();
    else if (a === '--dir') o.dir = v();
    else if (a === '--aceitar-nova-base') o.aceitarNovaBase = true;
    else if (a === '--sem-verificar-pages') o.verificarPages = false;
    else if (a === '--relatorio') o.relatorio = v();
    else if (a === '--config') o.config = v();
    else if (a === '--ler-relatorio') o.lerRelatorio = v();
    else if (a === '--espera-pages-min') o.esperaPagesMin = Number(v());
    else if (a === '--sem-painel') o.semPainel = true;
    else if (a === '--detalhar') o.detalhar = true;
    else throw erro(`Opção desconhecida: ${a}`, 'USO');
  }
  if (!['auto', 'exportacao', 'arquivos', 'api'].includes(o.fonte)) throw erro('--fonte deve ser auto, exportacao, api ou arquivos.', 'USO');
  if (o.fonte === 'arquivos' && !o.dir) throw erro('--fonte arquivos precisa de --dir.', 'USO');
  if (o.semPainel && !o.simular) throw erro('--sem-painel só vale com --simular (sem o painel não há como gravar).', 'USO');
  if (!o.lerRelatorio && !o.todas && !o.obras.length) throw erro('Informe --obra <código> ou --todas.', 'USO');
  return o;
}

const hojeSP = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);

function comPadroes(cfg) {
  const p = cfg.padroes || {};
  return cfg.obras.map(o => ({ ...o,
    fisico: { ...p.fisico, ...o.fisico, relatorios: { ...(p.fisico || {}).relatorios, ...((o.fisico || {}).relatorios) } },
    financeiro: { ...p.financeiro, ...o.financeiro, relatorios: { ...(p.financeiro || {}).relatorios, ...((o.financeiro || {}).relatorios) } },
    exportacao: { ...p.exportacao, ...o.exportacao } }));
}
function escolherObras(cfg, op) {
  const todas = comPadroes(cfg);
  if (op.todas) return todas.filter(o => o.habilitada);
  return op.obras.map(c => { const o = todas.find(x => x.codigo === c || x.painelId === c); if (!o) throw erro(`A obra ${c} não está em sync/obras.json.`, 'USO'); return o; });
}

// A API só entra num conjunto da obra depois de comparada com a exportação do mesmo dia (sync/comparar-api.cjs)
const apiValidada = (obra, nat) => !!(obra.api && obra.api.equivalenciaValidada && (obra.api.equivalenciaValidada.conjuntos || []).includes(nat));
// físico pela API fica incompleto (sem Progresso por tarefas e Cronograma): no automático, só o financeiro vai pela API
const fonteDe = (obra, nat, op) => (op.fonte !== 'auto' ? op.fonte : nat === 'financeiro' && apiValidada(obra, nat) ? 'api' : 'exportacao');

// ---------- coleta de uma obra: { fisico: { fonte, arquivos | dados | erro }, financeiro: … } ----------
async function coletar(obra, ctx) {
  const { op, deps, XLSX, tmp, estado } = ctx;
  const nats = NATUREZAS.filter(n => obra[n] && obra[n].ativo);
  const out = {}, porFonte = f => nats.filter(n => fonteDe(obra, n, op) === f);
  for (const n of porFonte('arquivos')) out[n] = { fonte: 'arquivos', arquivos: arquivosDaPasta(path.join(op.dir, obra.codigo, n)) };
  for (const n of porFonte('api')) {
    try {
      if (estado.falha.api) throw estado.falha.api;
      if (!obra.prevision.apiProjectId) throw erro(`A obra ${obra.codigo} não tem o id do projeto na API do Prevision.`, 'VINCULO_API_PENDENTE');
      if (!apiValidada(obra, n) && !op.simular) throw erro(`A API ainda não foi comparada com a exportação (${n}) da obra ${obra.codigo}.`, 'API_NAO_VALIDADA');
      const x = await prevApi.coletarAPI(deps.api(), obra.prevision.apiProjectId, n, obra.exportacao.fisico.perspectiva);
      out[n] = { fonte: 'api', ...x, coletadoEm: new Date().toISOString() };
    } catch (e) { if (FALHA_DA_FONTE.includes(e.codigo)) estado.falha.api = e; out[n] = { fonte: 'api', erro: e }; }
  }
  const exp = porFonte('exportacao');
  if (exp.length) {
    try {
      if (estado.falha.exportacao) throw estado.falha.exportacao;
      const pasta = fs.mkdtempSync(path.join(tmp, `obra-${obra.codigo}-`));
      const r = await (await deps.exportar())(obra, pasta, arq => lerPlanilha(XLSX, new Uint8Array(fs.readFileSync(arq))).dado, exp);
      const ler = lista => lista.map(x => ({ nome: x.nome, bytes: new Uint8Array(fs.readFileSync(x.caminho)), coletadoEm: x.coletadoEm }));
      const extra = n => ({ fonte: 'exportacao', projeto: r.projeto, periodoTarefas: (r.periodoTarefas || {})[n] || null, dashboardAtualizado: !!r.dashboardAtualizado });
      exp.forEach(n => { out[n] = (r.erros || {})[n] ? { ...extra(n), erro: r.erros[n] } : { ...extra(n), arquivos: ler(r[n] || []) }; });
    } catch (e) { if (FALHA_DA_FONTE.includes(e.codigo)) estado.falha.exportacao = e; exp.forEach(n => { out[n] = { fonte: 'exportacao', erro: e }; }); }
  }
  return out;
}

function conjuntoDe(entrada, nat, XLSX) {
  if (entrada.dados) return { natureza: nat, dados: entrada.dados, nomes: {}, problemas: [], ultimaMedicaoPrevision: entrada.ultimaMedicaoPrevision,
    origem: Object.keys(entrada.dados).map(t => ({ tipo: t, nome: `API ${entrada.parametros.view_type}/${entrada.parametros.dashboard_type}`, sha256: (entrada.respostas || {})[t] || null, coletadoEm: entrada.coletadoEm })) };
  return entrada.arquivos.length ? lerConjunto(XLSX, nat, entrada.arquivos) : { natureza: nat, dados: {}, nomes: {}, origem: [], problemas: [] };
}

// ---------- uma obra: coleta → validação → rascunho → gravação ----------
async function processarObra(obra, ctx) {
  const { op, deps, gh, sessao, retrato, XLSX, hoje, agoraISO } = ctx;
  const id = obra.painelId;
  const res = { obra: obra.codigo, coleta: 'nao-iniciada', rascunho: 'nao-gravado', publicacao: 'inalterada (publicar é manual)', conjuntos: {}, mensagens: [] };
  // --sem-painel: simulação sem ler o painel (compara só os arquivos entre si, não com a carga atual)
  const { pub, ras } = op.semPainel ? { pub: { codigo: obra.codigo }, ras: null } : await painel.lerObra(sessao, retrato.arquivos, id);
  if (op.semPainel) res.mensagens.push('Simulação sem o painel: não comparada com a carga atual (linha de base, datas e dados repetidos não conferidos).');
  const base = ras || pub;
  res.publicadoAte = pub && pub.dataCorte ? pub.dataCorte : null;
  if (String(base.codigo) !== String(obra.codigo)) throw erro(`A obra ${id} do painel tem código ${base.codigo}, não ${obra.codigo}.`, 'IDENTIDADE_PAINEL');
  if (obra.vinculo !== 'confirmado' && !op.simular) throw erro(`O vínculo da obra ${obra.codigo} com o Prevision está pendente de confirmação.`, 'VINCULO_PENDENTE');

  const coleta = await coletar(obra, ctx);
  const entradas = Object.entries(coleta);
  res.coleta = entradas.every(([, e]) => !e.erro) ? 'concluida' : entradas.some(([, e]) => !e.erro) ? 'parcial' : 'falhou';
  res.coletaEm = agoraISO;
  const proj = entradas.map(([, e]) => e.projeto).find(Boolean);
  if (proj) res.projetoPrevision = proj.ganttId;

  let novo = null;
  for (const [nat, e] of entradas) {
    if (e.erro) { res.conjuntos[nat] = { status: 'falhou', fonte: e.fonte, erro: { codigo: e.erro.codigo || null, msg: e.erro.message }, verificacoes: [], arquivos: [] }; continue; }
    const cfg = obra[nat], conj = conjuntoDe(e, nat, XLSX);
    const v = (nat === 'fisico' ? validarFisico : validarFinanceiro)(conj, base, cfg, { hoje, aceitarNovaBase: op.aceitarNovaBase });
    const c = res.conjuntos[nat] = { status: v.bloqueado ? 'bloqueado' : v.inalterado ? 'inalterado' : 'valido', fonte: e.fonte, corte: v.corte || null, ultimoRealizado: v.ultimoRealizado || null,
      periodoTarefas: e.periodoTarefas || null, dashboardAtualizado: e.dashboardAtualizado || false,
      ultimaMedicaoPrevision: conj.ultimaMedicaoPrevision || null, hash: v.hash || null, verificacoes: v.verificacoes,
      arquivos: conj.origem.map(o => ({ tipo: o.tipo, nome: o.nome, sha256: o.sha256 || null, bytes: o.bytes || null, coletadoEm: o.coletadoEm })) };
    if (c.status !== 'valido') continue;
    const dados = nat === 'fisico' ? conj.dados : { financeiro: conj.dados };
    const pacote = nat === 'fisico' ? Carga.montarPacote(dados, v.corte, conj.nomes.cronograma) : dados;
    const fontes = Object.fromEntries(Object.keys(conj.dados).map(t => [ROTULO[nat][t], `${conj.nomes[t] || 'API oficial do Prevision'} (automático, ${hoje})`]));
    novo = Carga.aplicarCarga(novo || base, pacote, v.corte, fontes, hoje, { temRascunho: !!ras || !!novo });
  }
  const sts = Object.values(res.conjuntos).map(c => c.status);
  if (sts.some(s => s === 'bloqueado' || s === 'falhou')) res.mensagens.push('Parte da carga não entrou: a última carga válida desse conjunto foi preservada.');
  if (!novo) { res.rascunho = sts.length && sts.every(s => s === 'inalterado') ? 'inalterado' : 'bloqueado'; return res; }

  novo.sync = { versao: 1, coletaEm: agoraISO, conjuntos: Object.fromEntries(Object.entries(res.conjuntos).map(([k, c]) => [k, { status: c.status, fonte: c.fonte, corte: c.corte || null, ultimoRealizado: c.ultimoRealizado || null, ultimaMedicaoPrevision: c.ultimaMedicaoPrevision || null, hash: c.hash || null, arquivos: c.arquivos }])) };
  if (op.simular) { res.rascunho = 'simulado'; res.seria = { dataCorte: novo.dataCorte, dataCorteFinanceiro: novo.dataCorteFinanceiro }; return res; }

  const bytes = await painel.cifrarRascunho(sessao, novo);
  const P = painel.P;
  const esperado = Object.fromEntries([P.acesso, P.dir, P.obra(id), P.ras(id)].map(p => [p, retrato.arquivos[p] ? retrato.arquivos[p].sha : null]));
  const corteMsg = [novo.dataCorte !== base.dataCorte ? novo.dataCorte : null, novo.dataCorteFinanceiro !== base.dataCorteFinanceiro ? `financeiro ${novo.dataCorteFinanceiro}` : null].filter(Boolean).join(' · ') || novo.dataCorte;
  const w = await gh.commitCondicional({ esperado, arquivos: { [P.ras(id)]: bytes }, mensagem: `Carga automática da obra ${obra.codigo} — corte ${corteMsg} (rascunho)` });
  res.rascunho = 'atualizado'; res.commit = w.commit;
  // reabre o rascunho gravado, na versão do commit, com a chave interna
  const relido = await painel.abrir(sessao.ki, await gh.blob(w.blobs[P.ras(id)]));
  res.rascunhoConferido = JSON.stringify(relido) === JSON.stringify(novo);
  if (!res.rascunhoConferido) res.mensagens.push('O rascunho relido do GitHub não é idêntico ao gravado.');
  if (op.verificarPages) res.site = await deps.verificarSite(P.ras(id), sha256(Buffer.from(bytes)), op.esperaPagesMin);
  return res;
}

// GitHub Pages publica a branch padrão; confere se o site já serve exatamente o arquivo gravado
async function verificarSite(siteBase, caminho, hashEsperado, minutos, fetchFn = globalThis.fetch) {
  const fim = Date.now() + minutos * 60000;
  while (Date.now() < fim) {
    try {
      const r = await fetchFn(`${siteBase}${caminho}?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
      if (r.ok && sha256(Buffer.from(await r.arrayBuffer())) === hashEsperado) return 'atualizado';
    } catch (e) { /* tenta de novo */ }
    await new Promise(r => setTimeout(r, 20000));
  }
  return `não refletiu em ${minutos} min`;
}

// ---------- relatório ----------
function resumoPublico(r) {
  const linhas = [`Sincronização Prevision → painel · ${r.inicio} · ${r.simulacao ? 'SIMULAÇÃO (nada gravado)' : 'gravação em rascunho'} · fonte ${r.fonte}`];
  if (r.erroGeral) linhas.push(`FALHA GERAL [${r.erroGeral.codigo || 'ERRO'}]: ${r.erroGeral.msg}`);
  for (const o of r.obras) {
    if (o.erro) { linhas.push(`- Obra ${o.obra}: FALHA [${o.erro.codigo || 'ERRO'}] ${o.erro.msg} · rascunho não alterado`); continue; }
    const cj = Object.entries(o.conjuntos || {}).map(([k, c]) => `${k} (${c.fonte}): ${c.status}${c.status === 'bloqueado' ? ' [' + [...new Set(c.verificacoes.filter(v => v.nivel === 'bloqueio').map(v => v.id))].join(', ') + ']' : c.status === 'falhou' ? ` [${c.erro.codigo || 'ERRO'}]` : ''}`).join(' · ');
    linhas.push(`- Obra ${o.obra}: coleta ${o.coleta} · rascunho ${o.rascunho}${o.rascunhoConferido === false ? ' (CONFERÊNCIA FALHOU)' : o.rascunhoConferido ? ' e conferido' : ''}${o.site ? ` · site ${o.site}` : ''} · posição publicada ${o.publicacao}${cj ? ` · ${cj}` : ''}`);
    for (const c of Object.values(o.conjuntos || {})) {
      for (const v of c.verificacoes.filter(x => x.nivel === 'bloqueio')) linhas.push(`    × ${v.publico}`);
      if (c.erro) linhas.push(`    × ${c.erro.msg}`);
    }
  }
  return linhas.join('\n');
}

async function salvarRelatorio(r, sessao, arquivo) {
  if (!sessao) return null;
  fs.writeFileSync(arquivo, await Cofre.cifrar(sessao.ki, await Cofre.empacotarJSON(r)));
  return arquivo;
}

// ---------- execução ----------
async function executar(op, deps = {}) {
  const cfgPub = configPublica();
  const cfg = JSON.parse(fs.readFileSync(op.config, 'utf8'));
  const agora = deps.agora ? deps.agora() : new Date();
  const r = { inicio: agora.toISOString(), simulacao: op.simular, fonte: op.fonte, obras: [] };
  const tmp = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'sync-prevision-'));
  let sessao = null, navegador = null;
  const estado = { falha: {} };
  try {
    const obras = escolherObras(cfg, op);
    const owner = process.env.SYNC_OWNER || cfgPub.github.owner, repo = process.env.SYNC_REPO || cfgPub.github.repo;
    let gh = null, retrato = null;
    if (!op.semPainel) {
      gh = deps.github || new GitHub({ token: process.env.PAINEL_GH_TOKEN, owner, repo, branch: cfgPub.github.branch });
      await gh.verificar();
      const P = painel.P;
      retrato = await gh.retrato([P.acesso, P.dir, ...obras.flatMap(o => [P.obra(o.painelId), P.ras(o.painelId)])]);
      if (!retrato.arquivos[P.acesso]) throw erro('O painel ainda não tem acessos configurados.', 'PAINEL_SEM_ACESSOS');
      sessao = await painel.entrar(new TextDecoder().decode(retrato.arquivos[P.acesso].bytes), process.env.PAINEL_EMAIL, process.env.PAINEL_SENHA, cfgPub.iteracoes);
    }
    const XLSX = await carregarXLSX();
    const siteBase = process.env.SYNC_SITE_URL || `https://${owner.toLowerCase()}.github.io/${repo}/`;
    let api = null;
    const d = {
      api: deps.api || (() => (api = api || new prevApi.PrevisionAPI({ token: process.env.PREVISION_API_TOKEN }))),
      verificarSite: deps.verificarSite || ((c, h, m) => verificarSite(siteBase, c, h, m)),
      // o navegador só abre se alguma obra precisar da exportação
      exportar: async () => {
        if (deps.exportar) return deps.exportar;
        if (!navegador) {
          const exp = require('./lib/prevision-export.cjs');
          let arq = process.env.PREVISION_SESSAO_ARQUIVO;
          if (!arq && process.env.PREVISION_SESSAO) { arq = path.join(tmp, 'sessao.json'); fs.writeFileSync(arq, process.env.PREVISION_SESSAO, { mode: 0o600 }); }
          const nav = await exp.abrirNavegador(arq);
          navegador = { fechar: () => nav.browser.close(), exportar: (obra, pasta, lerCurva, nats) => exp.exportarObra(nav.context, obra, pasta, lerCurva, nats) };
        }
        return navegador.exportar;
      },
    };
    const ctx = { op, deps: d, gh, sessao, retrato, XLSX, hoje: deps.hoje || hojeSP(agora), agoraISO: agora.toISOString(), tmp, estado };
    for (const obra of obras) {
      try { r.obras.push(await processarObra(obra, ctx)); }
      catch (e) { r.obras.push({ obra: obra.codigo, erro: { codigo: e.codigo || null, msg: e.message } }); }
    }
    // sessão do Prevision vencida ou token recusado: vale para a execução inteira daquela fonte
    const f = estado.falha.exportacao || estado.falha.api;
    if (f) r.erroGeral = { codigo: f.codigo, msg: f.message };
  } catch (e) {
    r.erroGeral = { codigo: e.codigo || null, msg: e.message };
  } finally {
    if (navegador) await navegador.fechar().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  r.fim = new Date().toISOString();
  r.arquivoRelatorio = await salvarRelatorio(r, sessao, op.relatorio).catch(() => null);
  const falhou = r.obras.some(o => o.erro || o.rascunho === 'bloqueado' || o.rascunhoConferido === false || Object.values(o.conjuntos || {}).some(c => c.status === 'bloqueado' || c.status === 'falhou'));
  return { relatorio: r, resumo: resumoPublico(r), codigoSaida: r.erroGeral ? 2 : falhou ? 1 : 0 };
}

async function lerRelatorio(arquivo) {
  const acesso = fs.readFileSync(path.join(RAIZ, 'data', 'acesso.json'), 'utf8');
  const sessao = await painel.entrar(acesso, process.env.PAINEL_EMAIL, process.env.PAINEL_SENHA, configPublica().iteracoes);
  return painel.abrir(sessao.ki, new Uint8Array(fs.readFileSync(arquivo)));
}

if (require.main === module) {
  (async () => {
    const op = lerArgs(process.argv.slice(2));
    if (op.lerRelatorio) { console.log(JSON.stringify(await lerRelatorio(op.lerRelatorio), null, 2)); return; }
    if (op.detalhar && process.env.GITHUB_ACTIONS) throw erro('--detalhar mostra números da obra: não use no GitHub Actions (o log é público).', 'USO');
    const { resumo, codigoSaida, relatorio } = await executar(op);
    console.log(resumo);
    if (op.detalhar) for (const o of relatorio.obras) console.log(JSON.stringify({ obra: o.obra, seria: o.seria, mensagens: o.mensagens, conjuntos: Object.fromEntries(Object.entries(o.conjuntos || {}).map(([k, c]) => [k, { status: c.status, fonte: c.fonte, corte: c.corte, ultimoRealizado: c.ultimoRealizado, ultimaMedicaoPrevision: c.ultimaMedicaoPrevision, erro: c.erro, periodoTarefas: c.periodoTarefas, dashboardAtualizado: c.dashboardAtualizado, verificacoes: c.verificacoes.map(v => `${v.nivel} ${v.id}: ${v.detalhe}`), arquivos: c.arquivos.map(a => `${a.tipo} ${a.nome} ${(a.sha256 || '').slice(0, 12)} ${a.coletadoEm}`) }])) }, null, 1));
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```\n' + resumo + '\n```\n');
    process.exitCode = codigoSaida;
  })().catch(e => { console.error(`[${e.codigo || 'ERRO'}] ${e.message}`); process.exitCode = 2; });
}

module.exports = { executar, lerArgs, resumoPublico, verificarSite, hojeSP, fonteDe, apiValidada };
