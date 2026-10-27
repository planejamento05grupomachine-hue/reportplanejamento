// Testes de ponta a ponta com dados fictícios: cofre fictício num GitHub em memória, coleta fictícia, execução completa.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { carregarXLSX, Cofre } = require('../lib/ambiente.cjs');
const { GitHub } = require('../lib/github.cjs');
const { lerConjunto, arquivosDaPasta } = require('../lib/leitura.cjs');
const { executar, lerArgs, verificarSite } = require('../sincronizar.cjs');
const { GitHubFalso, json } = require('./ajuda/github-falso.cjs');
const { criarCofre, abrir } = require('./ajuda/cofre-ficticio.cjs');
const fx = require('./ajuda/exportacoes-ficticias.cjs');

// credenciais fictícias, só deste teste
const ROBO = { nome: 'Automação (teste)', email: 'robo@teste.invalid', senha: 'senha-de-teste-robo', perfil: 'diretoria' };
const ADMIN = { nome: 'Admin (teste)', email: 'admin@teste.invalid', senha: 'senha-de-teste-admin', perfil: 'admin' };
let XLSX;
test.before(async () => { XLSX = await carregarXLSX(); });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sync-e2e-'));
const RAS = id => `data/obras/${id}.rascunho.bin`, PUB = id => `data/obras/${id}.bin`;

function dadosDe(p, comFin = true) {
  const d = tmp(); const pastas = fx.escreverColeta(XLSX, d, p);
  const fis = lerConjunto(XLSX, 'fisico', arquivosDaPasta(pastas.fisico)).dados, fin = lerConjunto(XLSX, 'financeiro', arquivosDaPasta(pastas.financeiro)).dados;
  return { curva: fis.curva, mensal: fis.mensal, tarefas: fis.tarefas, cronograma: { arquivo: 'c.xlsx', linhas: fis.cronograma, dataRef: p.hoje }, ...(comFin ? { financeiro: { curva: fin.curva, mensal: fin.mensal } } : {}) };
}
function pubFicticia(id, p) {
  return { id, codigo: id, nome: `Obra fictícia ${id}`, cliente: 'Cliente fictício', contrato: `CT/${id}/2026`, reportVA: 'auto', criadoEm: '2026-01-02T00:00:00Z', nFotos: 0,
    ...dadosDe(p), dataCorte: p.hoje, dataCorteFinanceiro: p.medicao, fontes: { 'Curva S': 'manual.xls' },
    rdos: [{ numero: 1, data: '2026-06-10', status: 'aprovado', atividades: [] }], mapas: [{ titulo: 'Planta', areas: [] }],
    medicao: { resumo: { totalContrato: 5000000 }, boletins: [] }, destaques: [], publicadoEm: '2026-06-16T10:00:00Z' };
}
function configTeste(obras) {
  const arq = path.join(tmp(), 'obras.json');
  fs.writeFileSync(arq, JSON.stringify({ versao: 1, padroes: JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'obras.json'), 'utf8')).padroes,
    obras: obras.map(o => ({ painelId: o, codigo: o, prevision: { ganttId: 1, apiProjectId: null }, vinculo: 'confirmado', habilitada: true, api: { equivalenciaValidada: null }, ...(typeof o === 'object' ? o : {}) })) }));
  return arq;
}

async function cenario({ obras = ['901'], comRascunho = false } = {}) {
  const antigo = fx.projeto({ medicao: '2026-06-12', hoje: '2026-06-15' });
  const vault = await criarCofre({ usuarios: [ADMIN, ROBO], obras: obras.map(id => ({ id, pub: pubFicticia(id, { ...antigo, codigo: id }), ras: comRascunho ? { ...pubFicticia(id, antigo), mapas: [{ titulo: 'Planta revisada', areas: [] }], publicadoEm: undefined } : null })) });
  const gh = new GitHubFalso({ owner: 'dono', repo: 'repo' });
  gh.escrever(vault.arquivos, 'cofre fictício');
  const coletas = tmp();
  return { gh, vault, coletas, antigo };
}
async function rodar(c, args, { deps = {}, env = {} } = {}) {
  const ant = { ...process.env };
  Object.assign(process.env, { PAINEL_EMAIL: ROBO.email, PAINEL_SENHA: ROBO.senha }, env);
  try {
    const op = { ...lerArgs(args), config: c.config, relatorio: path.join(tmp(), 'rel.bin') };
    const r = await executar(op, { github: new GitHub({ token: 'tk-teste', owner: 'dono', repo: 'repo', fetch: c.gh.fetch, pausaMs: 1 }), hoje: '2026-07-15', agora: () => new Date('2026-07-15T10:15:00Z'), verificarSite: async () => 'atualizado', ...deps });
    return { ...r, arqRel: op.relatorio };
  } finally { process.env = ant; }
}

test('grava o rascunho, preserva publicação, RDOs, mapas e medição, e o relatório público não tem números', async () => {
  const c = await cenario(); c.config = configTeste(['901']);
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  const pubAntes = c.gh.shaDe(PUB('901')), commitsAntes = c.gh.historico().length;
  const r = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
  const o = r.relatorio.obras[0];
  assert.equal(r.codigoSaida, 0, r.resumo);
  assert.equal(o.rascunho, 'atualizado'); assert.equal(o.rascunhoConferido, true); assert.equal(o.site, 'atualizado');
  assert.equal(c.gh.historico().length, commitsAntes + 1);
  assert.match(c.gh.historico()[0].message, /^Carga automática da obra 901 — corte .* \(rascunho\)$/);
  assert.equal(c.gh.shaDe(PUB('901')), pubAntes, 'a posição publicada não muda');
  const ras = await abrir(c.vault.ki, c.gh.ler(RAS('901')));
  const pub = await abrir(c.vault.chaveObra('901'), c.gh.ler(PUB('901')));
  assert.equal(pub.dataCorte, '2026-06-15'); assert.equal(pub.publicadoEm, '2026-06-16T10:00:00Z');
  assert.ok(ras.dataCorte > pub.dataCorte); assert.equal(ras.dataCorteFinanceiro, '2026-07-10');
  assert.equal(ras.publicadoEm, undefined); assert.equal(ras.fotosProprias, false);
  assert.deepEqual([ras.rdos, ras.mapas, ras.medicao, ras.nome, ras.contrato], [pub.rdos, pub.mapas, pub.medicao, pub.nome, pub.contrato]);
  assert.match(ras.fontes['Curva S'], /automático, 2026-07-15/);
  assert.equal(ras.sync.coletaEm, '2026-07-15T10:15:00.000Z');
  assert.equal(ras.sync.conjuntos.fisico.ultimoRealizado, '2026-07-10');
  assert.equal(ras.sync.conjuntos.fisico.arquivos.length, 4);
  assert.ok(ras.sync.conjuntos.fisico.arquivos.every(a => /^[0-9a-f]{64}$/.test(a.sha256)));
  assert.doesNotMatch(r.resumo, /\d+[,.]\d+\s*%|R\$/, 'o resumo vai para o log público do GitHub');
  const rel = await abrir(c.vault.ki, new Uint8Array(fs.readFileSync(r.arqRel)));
  assert.ok(rel.obras[0].conjuntos.fisico.verificacoes.some(v => /%/.test(v.detalhe)), 'o relatório cifrado tem o detalhe');
});

test('simulação não grava nada', async () => {
  const c = await cenario(); c.config = configTeste(['901']);
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  const n = c.gh.historico().length;
  const r = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas, '--simular']);
  assert.equal(r.relatorio.obras[0].rascunho, 'simulado');
  assert.equal(c.gh.historico().length, n);
  assert.ok(!c.gh.chamadas.some(x => x.startsWith('POST') || x.startsWith('PATCH')));
});

test('dados repetidos: a segunda execução não grava de novo', async () => {
  const c = await cenario(); c.config = configTeste(['901']);
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
  const n = c.gh.historico().length;
  const r = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
  assert.equal(r.relatorio.obras[0].rascunho, 'inalterado', r.resumo);
  assert.equal(r.codigoSaida, 0);
  assert.equal(c.gh.historico().length, n);
});

test('obra errada e relatório incompleto bloqueiam e preservam a última carga válida', async () => {
  for (const [p, op, id] of [[fx.projeto({ codigo: '902', nomeObra: 'Outra' }), {}, 'CONFERENCIA'], [fx.projeto(), { faltar: ['tarefas'] }, 'INCOMPLETO']]) {
    const c = await cenario(); c.config = configTeste(['901']);
    fx.escreverColeta(XLSX, c.coletas, p, op);
    // arquivos de outra obra entregues na pasta da 901
    if (p.codigo === '902') fs.renameSync(path.join(c.coletas, '902'), path.join(c.coletas, '901'));
    const rasAntes = c.gh.shaDe(RAS('901')), n = c.gh.historico().length;
    const r = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
    const o = r.relatorio.obras[0];
    assert.equal(o.conjuntos.fisico.status, 'bloqueado');
    assert.ok(o.conjuntos.fisico.verificacoes.some(v => v.nivel === 'bloqueio' && v.id === id), id);
    assert.equal(r.codigoSaida, 1);
    if (id === 'CONFERENCIA') { assert.equal(o.rascunho, 'bloqueado'); assert.equal(c.gh.historico().length, n); assert.equal(c.gh.shaDe(RAS('901')), rasAntes); }
    else assert.equal(o.conjuntos.financeiro.status, 'valido', 'o financeiro, independente, ainda pode entrar');
  }
});

test('sessão do Prevision expirada: para a execução sem gravar e sem tentar as outras obras', async () => {
  const c = await cenario({ obras: ['901', '902'] }); c.config = configTeste(['901', '902']);
  let tentativas = 0; const n = c.gh.historico().length;
  const r = await rodar(c, ['--todas'], { deps: { exportar: async () => { tentativas++; throw Object.assign(new Error('A sessão do Prevision expirou.'), { codigo: 'SESSAO_PREVISION_EXPIRADA' }); } } });
  assert.equal(r.codigoSaida, 2); assert.equal(r.relatorio.erroGeral.codigo, 'SESSAO_PREVISION_EXPIRADA');
  assert.equal(tentativas, 1); assert.equal(c.gh.historico().length, n);
});

test('falha durante a gravação: o repositório fica como estava', async () => {
  const c = await cenario(); c.config = configTeste(['901']);
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  c.gh.quando((m, p) => (m === 'PATCH' ? json(502, { message: 'Bad Gateway' }) : undefined));
  const head = c.gh.head;
  const r = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
  assert.equal(r.relatorio.obras[0].erro.codigo, 'GITHUB_502');
  assert.equal(c.gh.head, head); assert.equal(r.codigoSaida, 1);
});

test('alteração feita durante a coleta não é sobrescrita', async () => {
  const c = await cenario({ comRascunho: true }); c.config = configTeste(['901']);
  const outro = await Cofre.cifrar(c.vault.ki, await Cofre.empacotarJSON({ codigo: '901', editadoPor: 'pessoa' }));
  const exportar = async (obra, pasta) => {
    const pastas = fx.escreverColeta(XLSX, pasta, fx.projeto());
    c.gh.escrever({ [RAS('901')]: outro }, 'Mapa de avanço da obra 901 (rascunho)'); // alguém salvou pelo painel no meio da coleta
    const ls = dir => fs.readdirSync(dir).map(nome => ({ nome, caminho: path.join(dir, nome), coletadoEm: '2026-07-15T10:20:00Z' }));
    return { projeto: { ganttId: 1 }, fisico: ls(pastas.fisico), financeiro: ls(pastas.financeiro) };
  };
  const r = await rodar(c, ['--obra', '901'], { deps: { exportar } });
  assert.equal(r.relatorio.obras[0].erro.codigo, 'ALTERADO_DURANTE_COLETA');
  assert.equal(c.gh.historico()[0].message, 'Mapa de avanço da obra 901 (rascunho)');
  assert.deepEqual(await abrir(c.vault.ki, c.gh.ler(RAS('901'))), { codigo: '901', editadoPor: 'pessoa' });
});

test('corrida no instante da gravação (ref mudou antes do PATCH) também é recusada', async () => {
  const c = await cenario({ comRascunho: true }); c.config = configTeste(['901']);
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  let feito = false;
  c.gh.quando((m) => { if (m === 'PATCH' && !feito) { feito = true; c.gh.escrever({ [RAS('901')]: new Uint8Array([9, 9, 9]) }, 'edição concorrente'); } });
  const r = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
  assert.equal(r.relatorio.obras[0].erro.codigo, 'ALTERADO_DURANTE_COLETA');
  assert.equal(c.gh.historico()[0].message, 'edição concorrente');
});

test('credenciais: senha do painel errada e token do GitHub vencido param tudo', async () => {
  const c = await cenario(); c.config = configTeste(['901']);
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  const a = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas], { env: { PAINEL_SENHA: 'errada' } });
  assert.equal(a.relatorio.erroGeral.codigo, 'CREDENCIAL_PAINEL'); assert.equal(a.codigoSaida, 2);
  c.gh.token = 'outro';
  const b = await rodar(c, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas]);
  assert.equal(b.relatorio.erroGeral.codigo, 'TOKEN_GITHUB');
  const cli = await cenario(); cli.config = configTeste(['901']);
  const d = await rodar(cli, ['--obra', '901', '--fonte', 'arquivos', '--dir', c.coletas], { env: { PAINEL_EMAIL: ADMIN.email, PAINEL_SENHA: ADMIN.senha } });
  assert.equal(d.codigoSaida, 0, 'perfil administrador também serve');
});

test('vínculo pendente não grava; --todas ignora obras desabilitadas; uma obra com falha não impede a outra', async () => {
  const c = await cenario({ obras: ['901', '902', '903'] });
  c.config = configTeste(['901', '902', '903']);
  const cfg = JSON.parse(fs.readFileSync(c.config, 'utf8'));
  cfg.obras[1].vinculo = 'pendente'; cfg.obras[2].habilitada = false; fs.writeFileSync(c.config, JSON.stringify(cfg));
  fx.escreverColeta(XLSX, c.coletas, fx.projeto());
  fx.escreverColeta(XLSX, c.coletas, fx.projeto({ codigo: '902' }));
  const r = await rodar(c, ['--todas', '--fonte', 'arquivos', '--dir', c.coletas]);
  assert.deepEqual(r.relatorio.obras.map(o => o.obra), ['901', '902']);
  assert.equal(r.relatorio.obras[0].rascunho, 'atualizado');
  assert.equal(r.relatorio.obras[1].erro.codigo, 'VINCULO_PENDENTE');
  assert.equal(r.codigoSaida, 1);
});

test('API sem equivalência validada não grava', async () => {
  const c = await cenario(); c.config = configTeste([{ painelId: '901', codigo: '901', prevision: { ganttId: 1, apiProjectId: 77 } }]);
  const n = c.gh.historico().length;
  const r = await rodar(c, ['--obra', '901', '--fonte', 'api'], { deps: { api: () => { throw new Error('não deveria chamar'); } } });
  const cj = r.relatorio.obras[0].conjuntos;
  assert.equal(cj.fisico.erro.codigo, 'API_NAO_VALIDADA'); assert.equal(cj.financeiro.erro.codigo, 'API_NAO_VALIDADA');
  assert.equal(c.gh.historico().length, n); assert.equal(r.codigoSaida, 1);
});

// API fictícia no formato da especificação OpenAPI, gerada do mesmo projeto fictício (valores em R$, não acumulados)
function apiFicticia(p) {
  const dias = []; for (let d = p.inicio; d <= p.fim; d = fx.somaDias(d, 1)) dias.push(d);
  const medicoes = dias.filter(d => d <= p.medicao && (new Date(d + 'T12:00:00Z').getUTCDay() === 5 || d === p.medicao));
  const inc = (f, d) => f(d) - f(fx.somaDias(d, -1));
  const progress = dias.map(d => ({ date: d, base: inc(p.base, d) * p.valor, expected: inc(p.base, d) * p.valor, realized: inc(p.real, d) * p.valor, goal: 0 }));
  const meses = [...new Set(dias.map(d => d.slice(0, 7)))];
  const fimMes = m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0, 12)).toISOString().slice(0, 10); };
  const mensal = meses.map(m => { const f = fimMes(m), a = fx.somaDias(m + '-01', -1); return { end_date: f, base: (p.base(f) - p.base(a)) * p.valor, expected: (p.base(f) - p.base(a)) * p.valor, realized: (p.real(f) - p.real(a)) * p.valor, goal: 0, idpm: 0 }; });
  return {
    progressoDiario: async (id, vt, dt) => { assert.deepEqual([vt, dt], ['monetary', 'economic']); return { lastMeasuredIn: p.medicao, progress }; },
    progressoMensal: async () => ({ lastMeasuredIn: p.medicao, progress: mensal }),
    medicoes: async () => medicoes.map((d, i) => ({ id: i + 1, measured_in: d + 'T00:00:00Z' })),
  };
}

test('fonte automática: com a sessão vencida, o valor agregado entra pela API validada e o físico fica preservado', async () => {
  const c = await cenario();
  c.config = configTeste([{ painelId: '901', codigo: '901', prevision: { ganttId: 1, apiProjectId: 77 }, api: { equivalenciaValidada: { em: '2026-07-15', conjuntos: ['financeiro'] } } }]);
  const p = fx.projeto();
  const r = await rodar(c, ['--obra', '901'], { deps: { api: () => apiFicticia(p), exportar: async () => { throw Object.assign(new Error('A sessão do Prevision expirou.'), { codigo: 'SESSAO_PREVISION_EXPIRADA' }); } } });
  const o = r.relatorio.obras[0];
  assert.equal(o.conjuntos.fisico.status, 'falhou'); assert.equal(o.conjuntos.fisico.erro.codigo, 'SESSAO_PREVISION_EXPIRADA');
  assert.equal(o.conjuntos.financeiro.fonte, 'api'); assert.equal(o.conjuntos.financeiro.status, 'valido', JSON.stringify(o.conjuntos.financeiro.verificacoes));
  assert.equal(o.conjuntos.financeiro.ultimaMedicaoPrevision, '2026-07-10');
  assert.equal(o.rascunho, 'atualizado'); assert.equal(o.coleta, 'parcial');
  const ras = await abrir(c.vault.ki, c.gh.ler(RAS('901')));
  assert.equal(ras.dataCorte, '2026-06-15', 'o corte físico não muda'); assert.equal(ras.dataCorteFinanceiro, '2026-07-10');
  assert.equal(ras.fontes['Curva S financeira (VA)'], 'API oficial do Prevision (automático, 2026-07-15)');
  assert.equal(r.relatorio.erroGeral.codigo, 'SESSAO_PREVISION_EXPIRADA'); assert.equal(r.codigoSaida, 2, 'execução vermelha: a sessão precisa ser renovada');
});

test('conferência do site: espera o GitHub Pages servir exatamente o arquivo gravado', async () => {
  const bytes = Buffer.from('conteudo');
  let n = 0;
  const f = async () => { n++; return new Response(n < 2 ? 'antigo' : bytes); };
  const { sha256 } = require('../lib/ambiente.cjs');
  const t0 = Date.now();
  const orig = global.setTimeout; global.setTimeout = (fn) => orig(fn, 1);
  try { assert.equal(await verificarSite('https://site/', 'x.bin', sha256(bytes), 1, f), 'atualizado'); } finally { global.setTimeout = orig; }
  assert.equal(n, 2); assert.ok(Date.now() - t0 < 5000);
});
