// Regra única do financeiro (faturamento do contrato × custo real, IDC = VA ÷ realizado) — só dados fictícios.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require(path.join(__dirname, '..', '..', 'js', 'core.js'));
const Core = globalThis.Core;

const dtFim = (y, m) => new Date(Date.UTC(y, m, 0, 12)).toISOString().slice(0, 10);

// Empreitada global fictícia: contrato de 1.000, 5 meses (jun a out/2026) de 200 previstos; medido 150, 250, 200 (set em análise)
function obraEmpreitada() {
  const mes = (nome, prev, real, st) => ({ mes: nome, previstoCT: prev, realizadoCT: real, status: st });
  const meses = [mes('Junho', 200, 150, 'Ok'), mes('Julho', 200, 250, 'Ok'), mes('Agosto', 200, 200, 'Em análise'), mes('Setembro', 200, null, null), mes('Outubro', 200, null, null)];
  // Curva S financeira do Prevision na mesma base do contrato (R$ 1.000): EV 560 em agosto
  const curva = [{ data: '2026-05-31', base: 0, previsto: 0, realizado: 0 }, { data: dtFim(2026, 6), base: 200, previsto: 200, realizado: 150 }, { data: dtFim(2026, 7), base: 400, previsto: 400, realizado: 380 },
    { data: dtFim(2026, 8), base: 600, previsto: 600, realizado: 560 }, { data: dtFim(2026, 9), base: 800, previsto: 800, realizado: 0 }, { data: dtFim(2026, 10), base: 1000, previsto: 1000, realizado: 0 }];
  const boletim = { aba: 'M3', resumo: { dataMedicao: '2026-09-02' }, itens: [
    { eap: '01', descricao: 'OBRA', precoUnitario: 1000, contratada: null, acumuladoAnteriorValor: 400, medicao: 200 },
    { eap: '01.001', descricao: 'ESTRUTURA', precoUnitario: 700, contratada: 1, acumuladoAnteriorValor: 300, medicao: 150 },
    { eap: '01.002', descricao: 'ACABAMENTO', precoUnitario: 300, contratada: 1, acumuladoAnteriorValor: 100, medicao: 50 }] };
  return { codigo: '901', curva: [{ data: '2026-05-31', base: 0, previsto: 0, realizado: 0 }, { data: dtFim(2026, 10), base: 1, previsto: 1, realizado: 0.5 }], financeiro: { curva },
    dataCorte: '2026-09-05', dataCorteFinanceiro: '2026-09-05', medicao: { resumo: { totalContrato: 1000, medidoAcumulado: 600, saldo: 400, meses }, boletins: [boletim] } };
}

test('faturamento: meses sem ano ancorados no último mês medido, realizado e previsto acumulados', () => {
  const fr = Core.calcRealFinanceiro(obraEmpreitada(), '2026-08-31');
  assert.equal(fr.tipo, 'faturamento');
  assert.equal(fr.fonte, 'medicao');
  assert.deepEqual(fr.meses.map(m => m.mes), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.equal(fr.realizado, 600);
  assert.equal(fr.previsto, 600);
  assert.equal(fr.total, 1000);
  assert.equal(fr.corte, '2026-08-31');
  assert.equal(fr.meses[3].realizado, null, 'meses seguintes ficam sem realizado');
  assert.equal(fr.pts.at(-1).previsto, 1, 'a curva fecha em 100% do contrato');
});

test('faturamento: etapas vêm do boletim e só valem quando fecham com o realizado', () => {
  const o = obraEmpreitada();
  const fr = Core.calcRealFinanceiro(o, '2026-08-31');
  assert.deepEqual(fr.etapas.map(e => [e.nome, e.projecao, e.realizado]), [['ESTRUTURA', 700, 450], ['ACABAMENTO', 300, 150]]);
  // corte em julho: o boletim (de agosto) não fecha com o realizado da data → tabela por etapa omitida
  assert.deepEqual(Core.calcRealFinanceiro(o, '2026-07-31').etapas, []);
});

test('faturamento: virada de ano no Controle de Medição', () => {
  const o = obraEmpreitada();
  const m = (nome, prev, real) => ({ mes: nome, previstoCT: prev, realizadoCT: real });
  o.medicao.resumo.meses = [m('Novembro', 100, 100), m('Dezembro', 100, 100), m('Janeiro', 100, 100), m('Fevereiro', 100, null)];
  o.dataCorteFinanceiro = '2027-01-20'; o.dataCorte = '2027-01-20';
  const fr = Core.calcFinanceiro && Core.calcRealFinanceiro(o);
  assert.deepEqual(fr.meses.map(x => x.mes), ['2026-11', '2026-12', '2027-01', '2027-02']);
});

test('IDC = valor agregado ÷ financeiro realizado, na mesma data e base', () => {
  const idc = Core.calcIDC(obraEmpreitada(), '2026-08-31');
  assert.equal(idc.ev, 560);
  assert.equal(idc.ac, 600);
  assert.ok(Math.abs(idc.v - 560 / 600) < 1e-9);
  assert.equal(idc.tipo, 'faturamento');
});

test('IDC: curva do valor agregado em outra base (custo × venda) usa os percentuais', () => {
  const o = obraEmpreitada();
  // o Prevision exportou a categoria de custos: base de 800 em vez dos 1.000 do contrato, mesmos percentuais
  o.financeiro.curva = o.financeiro.curva.map(p => ({ ...p, base: p.base * 0.8, previsto: p.previsto * 0.8, realizado: p.realizado * 0.8 }));
  const idc = Core.calcIDC(o, '2026-08-31');
  assert.equal(idc.mesmaBase, false);
  assert.ok(Math.abs(idc.v - 560 / 600) < 1e-9, 'o índice é o mesmo da base de venda');
  assert.ok(Math.abs(idc.evPct - 0.56) < 1e-9 && Math.abs(idc.acPct - 0.6) < 1e-9);
});

test('conferência: empreitada com a curva financeira fora da base do contrato avisa para usar Recebíveis', () => {
  const Carga = require(path.join(__dirname, '..', '..', 'js', 'carga.js'));
  const o = obraEmpreitada();
  const fim = { data: '2026-10-31', base: 1000, previsto: 1000, realizado: 0 };
  const ok = Carga.conferencia({ codigo: '901', medicao: o.medicao }, { dados: { financeiro: { curva: [fim] } } });
  assert.ok(ok.some(([k, t]) => k === 'ok' && /Recebíveis do projeto/.test(t)));
  const custo = { ...fim, base: 800, previsto: 800 };
  const av = Carga.conferencia({ codigo: '901', medicao: o.medicao }, { dados: { financeiro: { curva: [custo] } } });
  assert.ok(av.some(([k, t]) => k === 'av' && /Recebíveis do projeto/.test(t) && /Custos do projeto/.test(t)));
  // administração (taxa no cadastro): a categoria de custos é a certa, sem aviso
  const adm = Carga.conferencia({ codigo: '207', taxaAdm: { pct: 0.08, mobilizacao: 0 }, medicao: o.medicao }, { dados: { financeiro: { curva: [custo] } } });
  assert.ok(!adm.some(([, t]) => /Recebíveis do projeto/.test(t)));
});

test('administração (custo real da planilha) usa o mesmo IDC', () => {
  const o = obraEmpreitada(); delete o.medicao;
  o.custoReal = { ultimaBaixa: '2026-08-20', lancamentos: 3, total: 1000, totalLb1: 800, realizadoTotal: 500,
    meses: [{ mes: '2026-06', previsto: 300, realizado: 100, previstoAcum: 300, realizadoAcum: 100 }, { mes: '2026-07', previsto: 300, realizado: 200, previstoAcum: 600, realizadoAcum: 300 },
      { mes: '2026-08', previsto: 400, realizado: 200, previstoAcum: 1000, realizadoAcum: 500 }], etapas: [] };
  const fr = Core.calcRealFinanceiro(o, '2026-08-31');
  assert.equal(fr.tipo, 'desembolso');
  assert.equal(fr.realizado, 500);
  assert.ok(Math.abs(Core.calcIDC(o, '2026-08-31').v - 560 / 500) < 1e-9);
});

test('valor agregado aparece em toda obra com a Curva S financeira, na própria base', () => {
  const o = obraEmpreitada();
  const rf = Core.calcFinanceiro(o, '2026-08-31');
  assert.equal(Core.vaNoReport(o, rf), true);
  assert.equal(Core.vaNoReport({ ...o, reportVA: 'ocultar' }, rf), false);
  const o2 = { ...o, financeiro: undefined };
  assert.equal(Core.vaNoReport(o2, Core.calcFinanceiro(o2, '2026-08-31')), false);
  // base diferente do contrato (administração): continua aparecendo
  const o3 = { ...o, medicao: { resumo: { ...o.medicao.resumo, totalContrato: 100 }, boletins: [] } };
  assert.equal(Core.vaNoReport(o3, Core.calcFinanceiro(o3, '2026-08-31')), true);
});
