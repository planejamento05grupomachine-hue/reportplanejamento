// Testes de unidade com dados fictícios. Rodar: node --test sync/test/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Cofre, Carga, Parsers, carregarXLSX } = require('../lib/ambiente.cjs');
const { lerConjunto, arquivosDaPasta } = require('../lib/leitura.cjs');
const { validarFisico, validarFinanceiro } = require('../lib/validacao.cjs');
const api = require('../lib/prevision-api.cjs');
const fx = require('./ajuda/exportacoes-ficticias.cjs');

const CFG_FIS = { relatorios: { curva: 'obrigatorio', tarefas: 'obrigatorio', cronograma: 'obrigatorio', mensal: 'obrigatorio' } };
const CFG_FIN = { relatorios: { curva: 'obrigatorio', mensal: 'opcional', tarefas: 'opcional' } };
let XLSX;
test.before(async () => { XLSX = await carregarXLSX(); });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sync-teste-'));
function coleta(p, opcoes) { const d = tmp(); const pastas = fx.escreverColeta(XLSX, d, p, opcoes); return { fis: lerConjunto(XLSX, 'fisico', arquivosDaPasta(pastas.fisico)), fin: lerConjunto(XLSX, 'financeiro', arquivosDaPasta(pastas.financeiro)) }; }
// obra como está no painel: carga anterior feita com a mesma obra (medição de junho)
function obraAtual() {
  const c = coleta(fx.projeto({ medicao: '2026-06-12', hoje: '2026-06-15' }));
  return { codigo: '901', dataCorte: '2026-06-15', dataCorteFinanceiro: '2026-06-12', curva: c.fis.dados.curva, mensal: c.fis.dados.mensal, tarefas: c.fis.dados.tarefas, cronograma: { linhas: c.fis.dados.cronograma, dataRef: '2026-06-15' }, financeiro: { curva: c.fin.dados.curva, mensal: c.fin.dados.mensal } };
}
const ids = v => v.verificacoes.filter(x => x.nivel === 'bloqueio').map(x => x.id);

test('cofre: cifra e decifra no formato do painel (byte 1 = gzip)', async () => {
  const k = Cofre.aleatorio(32);
  const ct = await Cofre.cifrar(k, await Cofre.empacotarJSON({ a: 1, texto: 'obra' }));
  assert.equal((await Cofre.decifrar(k, ct))[0], 1);
  assert.deepEqual(await Cofre.desempacotarJSON(await Cofre.decifrar(k, ct)), { a: 1, texto: 'obra' });
  await assert.rejects(Cofre.decifrar(Cofre.aleatorio(32), ct));
});

// a regra que estava dentro de API.salvarCarga (js/api.js antes da extração), copiada aqui como referência
function salvarCargaAntigo(e, pacote, corte, fontes, hoje) {
  const base = e.ras || e.pub; const ras = JSON.parse(JSON.stringify(base));
  ['curva', 'mensal', 'tarefas', 'rdos', 'cronograma', 'medicao'].forEach(k => { if (pacote[k]) ras[k] = pacote[k]; });
  if (pacote.financeiro) ras.financeiro = { ...(ras.financeiro || {}), ...pacote.financeiro };
  if (['curva', 'mensal', 'tarefas', 'rdos', 'cronograma'].some(k => pacote[k])) ras.dataCorte = corte;
  if (['financeiro', 'medicao'].some(k => pacote[k])) ras.dataCorteFinanceiro = corte;
  ras.atualizadoEm = hoje; ras.fontes = { ...(base.fontes || {}), ...fontes }; delete ras.publicadoEm;
  if (!pacote.fotos && !e.ras) ras.fotosProprias = false;
  return ras;
}
test('carga: aplicarCarga dá o mesmo rascunho que o código anterior de salvarCarga', () => {
  const pub = { codigo: '901', curva: [1], rdos: [{ n: 1 }], mapas: [{ m: 1 }], financeiro: { tarefas: [9] }, fontes: { RDO: 'a.pdf' }, publicadoEm: 'x', dataCorte: '2026-01-01' };
  const casos = [
    [{ pub, ras: null }, { curva: [2], tarefas: [3], cronograma: { linhas: [] } }],
    [{ pub, ras: { ...pub, mapas: [{ m: 2 }] } }, { financeiro: { curva: [5] } }],
    [{ pub, ras: null }, { medicao: { resumo: {} } }],
  ];
  for (const [e, pac] of casos) assert.deepEqual(Carga.aplicarCarga(e.ras || e.pub, pac, '2026-02-02', { C: 'c.xls' }, '2026-02-03', { temRascunho: !!e.ras }), salvarCargaAntigo(e, pac, '2026-02-02', { C: 'c.xls' }, '2026-02-03'));
  const r = Carga.aplicarCarga(pub, { financeiro: { curva: [5] } }, '2026-02-02', {}, '2026-02-03', {});
  assert.deepEqual(r.financeiro, { tarefas: [9], curva: [5] }, 'financeiro funde: a curva nova não apaga as tarefas financeiras anteriores');
  assert.deepEqual(r.rdos, pub.rdos); assert.deepEqual(r.mapas, pub.mapas);
});

test('conferência: progresso mensal confere com curva diária (fim do mês) e continua igual com curva mensal', () => {
  const c = coleta(fx.projeto());
  const imp = d => ({ dados: d, nomes: {} });
  const linha = d => Carga.identidade({ codigo: '901' }, imp(d)).find(([, t]) => /Progresso mensal/.test(t));
  assert.equal(linha({ curva: c.fis.dados.curva, mensal: c.fis.dados.mensal })[0], 'ok');
  // curva com um ponto por mês, no último dia (formato antigo): mesmo resultado
  const porMes = Object.values(c.fis.dados.curva.reduce((a, p) => { a[p.data.slice(0, 7)] = p; return a; }, {}));
  assert.equal(linha({ curva: porMes, mensal: c.fis.dados.mensal })[0], 'ok');
  // outra linha de base: recusa
  const outra = c.fis.dados.mensal.map((m, i) => ({ ...m, base: i === 3 ? m.base + 0.05 : m.base }));
  assert.equal(linha({ curva: c.fis.dados.curva, mensal: outra })[0], 'er');
});

test('leitura: a natureza vem da pasta; o tipo, do cabeçalho; duplicados e tipos fora do lugar são recusados', () => {
  const c = coleta(fx.projeto());
  assert.deepEqual(Object.keys(c.fis.dados).sort(), ['cronograma', 'curva', 'mensal', 'tarefas']);
  assert.deepEqual(Object.keys(c.fin.dados).sort(), ['curva', 'mensal']);
  assert.ok(c.fin.dados.curva.at(-1).base > 1000, 'financeiro em R$');
  const d = tmp(); fx.escreverColeta(XLSX, d, fx.projeto());
  fs.copyFileSync(path.join(d, '901', 'fisico', 'Cronograma - 901 - Obra Teste.xlsx'), path.join(d, '901', 'financeiro', 'Cronograma - 901 - Obra Teste.xlsx'));
  fs.copyFileSync(path.join(d, '901', 'fisico', 'progresso-mensal.xls'), path.join(d, '901', 'fisico', 'progresso-semanal.xls'));
  assert.deepEqual(lerConjunto(XLSX, 'financeiro', arquivosDaPasta(path.join(d, '901', 'financeiro'))).problemas.map(p => p.id), ['TIPO_NAO_ESPERADO']);
  assert.deepEqual(lerConjunto(XLSX, 'fisico', arquivosDaPasta(path.join(d, '901', 'fisico'))).problemas.map(p => p.id), ['TIPO_DUPLICADO']);
});

test('validação física: conjunto coerente passa, com corte, última medição e data de coleta separados', () => {
  const v = validarFisico(coleta(fx.projeto()).fis, obraAtual(), CFG_FIS, { hoje: '2026-07-15' });
  assert.deepEqual(ids(v), []);
  assert.equal(v.bloqueado, false);
  assert.equal(v.ultimoRealizado, '2026-07-10', 'última medição = último realizado da curva, não a data da coleta');
  assert.ok(v.corte <= '2026-07-15' && v.corte >= '2026-07-10');
  assert.equal(v.inalterado, false);
});

test('validação física: casos que bloqueiam e preservam a última carga', () => {
  const atual = obraAtual(), hoje = '2026-07-15';
  const caso = (p, op, obra = atual, opts = {}) => ids(validarFisico(coleta(p, op).fis, obra, CFG_FIS, { hoje, ...opts }));
  assert.ok(caso(fx.projeto(), { filtroPeriodo: true }).includes('TAREFAS_FILTRADAS'), 'tarefas com filtro de datas');
  assert.ok(caso(fx.projeto(), { faltar: ['cronograma'] }).includes('INCOMPLETO'), 'relatório incompleto');
  assert.ok(caso(fx.projeto({ codigo: '902' }), {}).includes('CONFERENCIA'), 'arquivo de outra obra (código no nome)');
  assert.ok(caso(fx.projeto({ raiz: 'CONTRATO OUTRA OBRA' }), {}).includes('CONFERENCIA'), 'tarefa raiz de outra obra');
  // Curva S em R$ coletada como física (mesmo cabeçalho): a unidade denuncia
  const d = tmp(), p = fx.projeto(), pastas = fx.escreverColeta(XLSX, d, p);
  fs.writeFileSync(path.join(pastas.fisico, 'Curva S - 901 - Obra Teste.xls'), fx.curvaS(p, p.valor));
  assert.ok(ids(validarFisico(lerConjunto(XLSX, 'fisico', arquivosDaPasta(pastas.fisico)), atual, CFG_FIS, { hoje })).includes('ESCALA'), 'curva financeira na coleta física');
  assert.ok(caso(fx.projeto({ medicao: '2026-05-29', hoje: '2026-06-01' }), {}).includes('DADOS_MAIS_ANTIGOS'), 'coleta mais antiga que a carga atual');
  assert.ok(caso(fx.projeto({ pesoExtra: 0.05 }), {}).includes('LINHA_DE_BASE_DIFERENTE'), 'linha de base mudou');
  assert.ok(!caso(fx.projeto({ pesoExtra: 0.05 }), {}, atual, { aceitarNovaBase: true }).includes('LINHA_DE_BASE_DIFERENTE'), 'nova base aceita por quem disparou');
  // valores em branco: ausente não é zero
  const c = coleta(fx.projeto()).fis; c.dados.curva[10].realizado = null;
  assert.ok(ids(validarFisico(c, atual, CFG_FIS, { hoje })).includes('VALOR_AUSENTE'));
  // arquivos de coletas diferentes
  const c2 = coleta(fx.projeto()).fis; c2.origem[0].coletadoEm = '2026-07-14T08:00:00Z'; c2.origem[1].coletadoEm = '2026-07-15T08:00:00Z';
  assert.ok(ids(validarFisico(c2, atual, CFG_FIS, { hoje })).includes('COLETAS_DIFERENTES'));
});

test('dados mais antigos: compara o avanço acumulado, não a data (carga antiga com realizado até o fim do mês)', () => {
  const atual = obraAtual();
  // formato antigo: o realizado aparece em todos os dias até o fim do mês, depois da última medição (12/06)
  const ult = [...atual.curva].reverse().find(p => p.realizado > 0);
  atual.curva = atual.curva.map(p => (p.data > ult.data && p.data <= '2026-07-31' ? { ...p, realizado: ult.realizado } : p));
  atual.financeiro.curva = atual.financeiro.curva.map(p => (p.data > ult.data && p.data <= '2026-07-31' ? { ...p, realizado: ult.realizado * 5000000 } : p));
  const c = coleta(fx.projeto());
  assert.ok(!ids(validarFisico(c.fis, atual, CFG_FIS, { hoje: '2026-07-15' })).includes('DADOS_MAIS_ANTIGOS'), 'coleta mais nova não pode ser bloqueada pela data');
  assert.ok(!ids(validarFinanceiro(c.fin, { ...atual, dataCorteFinanceiro: '2026-07-31' }, CFG_FIN, { hoje: '2026-07-15' })).some(x => /DADOS_MAIS_ANTIGOS|CORTE_ANTERIOR/.test(x)));
  const velha = coleta(fx.projeto({ medicao: '2026-05-29', hoje: '2026-06-01' }));
  assert.ok(ids(validarFinanceiro(velha.fin, atual, CFG_FIN, { hoje: '2026-07-15' })).includes('DADOS_MAIS_ANTIGOS'), 'valor agregado menor bloqueia');
});

test('validação física: dados iguais aos da carga atual não contam como nova produção', () => {
  const c = coleta(fx.projeto()).fis;
  const obra = { ...obraAtual(), curva: c.dados.curva, mensal: c.dados.mensal, tarefas: c.dados.tarefas, cronograma: { linhas: c.dados.cronograma, dataRef: '2026-07-01' }, dataCorte: '2026-07-15' };
  const v = validarFisico(c, obra, CFG_FIS, { hoje: '2026-07-15' });
  assert.equal(v.inalterado, true);
});

test('validação financeira: R$ coerente passa; percentual e mensal que não fecha bloqueiam', () => {
  const atual = obraAtual(), hoje = '2026-07-15';
  const c = coleta(fx.projeto(), { tarefasFinanceiro: true });
  const v = validarFinanceiro(c.fin, atual, CFG_FIN, { hoje });
  assert.deepEqual(ids(v), []);
  assert.equal(v.corte, '2026-07-10', 'corte financeiro = data do último valor agregado');
  const pct = coleta(fx.projeto()).fis; // arquivos físicos lidos como financeiros
  assert.ok(ids(validarFinanceiro({ ...pct, dados: { curva: pct.dados.curva, mensal: pct.dados.mensal } }, atual, CFG_FIN, { hoje })).includes('ESCALA'));
  const m = coleta(fx.projeto()).fin; m.dados.mensal[2].base += 50000;
  assert.ok(ids(validarFinanceiro(m, atual, CFG_FIN, { hoje })).includes('MENSAL_FINANCEIRO'));
  assert.ok(ids(validarFinanceiro({ ...m, dados: { mensal: m.dados.mensal } }, atual, CFG_FIN, { hoje })).includes('INCOMPLETO'));
});

test('API: adaptador acumula o diário, detecta a escala e mostra o realizado só nos dias de medição (como a exportação)', () => {
  const diario = { lastMeasuredIn: '2026-01-04', progress: [
    { date: '2026-01-01', base: 25, expected: 20, realized: 10, goal: 0 }, { date: '2026-01-02', base: 25, expected: 30, realized: 20, goal: 0 },
    { date: '2026-01-03', base: 25, expected: 25, realized: 5, goal: 0 }, { date: '2026-01-04', base: 25, expected: 25, realized: 0, goal: 0 },
    { date: '2026-01-05', base: 0, expected: 0, realized: 0, goal: 0 }] };
  // medição em 04/01 sem avanço: aparece com o acumulado, como na exportação
  const c = api.curvaDeDiario(diario, 'percentage', new Set(['2026-01-02', '2026-01-04']));
  assert.deepEqual(c.map(p => p.base), [0.25, 0.5, 0.75, 1, 1]);
  assert.deepEqual(c.map(p => +p.realizado.toFixed(10)), [0, 0.3, 0, 0.35, 0]);
  assert.throws(() => api.curvaDeDiario(diario, 'percentage'), /datas de medição/);
  assert.equal(api.escalaPercentual([{ base: 0.6 }, { base: 0.4 }]), 1);
  assert.throws(() => api.escalaPercentual([{ base: 3 }]), /escala/);
  const mensal = { lastMeasuredIn: '2026-02-10', progress: [{ end_date: '2026-01-31', base: 0.4, expected: 0.4, realized: 0.3, goal: 0, idpm: 0.75 }, { end_date: '2026-02-28', base: 0.6, expected: 0.6, realized: 0.1, goal: 0, idpm: 0 }] };
  assert.deepEqual(api.mensalDeMensal(mensal, 'percentage').map(m => m.mes), ['2026-01', '2026-02']);
  assert.throws(() => api.mensalDeMensal({ progress: [{ end_date: '2026-01-25', base: 1, expected: 1, realized: 0, idpm: 0 }] }, 'percentage'), /último dia do mês/);
  const cmp = api.comparar({ curva: c, mensal: [] }, { curva: c.map(p => ({ ...p, realizado: p.realizado + 0.01 })), mensal: [] });
  assert.equal(cmp.curva.comuns, 5); assert.ok(Math.abs(cmp.curva.maxDif.realizado - 0.01) < 1e-9);
});

test('API: token recusado vira TOKEN_PREVISION, sem novas tentativas', async () => {
  let n = 0;
  const cli = new api.PrevisionAPI({ token: 'x', pausaMs: 1, fetch: async () => { n++; return new Response('{}', { status: 401 }); } });
  await assert.rejects(cli.projetos(), e => e.codigo === 'TOKEN_PREVISION');
  assert.equal(n, 1);
});

test('parsers: percentuais em fração e R$ em reais, zero diferente de ausente', () => {
  assert.equal(Parsers.num('0,0300'), 0.03); assert.equal(Parsers.num('76.79%'), 0.7679);
  assert.equal(Parsers.num('R$ 10.678.787,43'), 10678787.43); assert.equal(Parsers.num('0'), 0); assert.equal(Parsers.num(''), null);
});
