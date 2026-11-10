// Custo real pela planilha de orçamento cliente (FÍS X FIN) — só dados fictícios.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require(path.join(__dirname, '..', '..', 'js', 'core.js'));
const Core = globalThis.Core;
const Carga = require(path.join(__dirname, '..', '..', 'js', 'carga.js'));

// 4 meses de 100 previstos cada; realizado de 80, 120 e 30 (último mês parcial, baixa em 10/04)
const custoReal = {
  ultimaBaixa: '2026-04-10', lancamentos: 12, total: 400, totalLb1: 300, realizadoTotal: 230,
  meses: [
    { mes: '2026-01', previsto: 100, realizado: 80, previstoAcum: 100, realizadoAcum: 80 },
    { mes: '2026-02', previsto: 100, realizado: 120, previstoAcum: 200, realizadoAcum: 200 },
    { mes: '2026-03', previsto: 100, realizado: 0, previstoAcum: 300, realizadoAcum: 200 },
    { mes: '2026-04', previsto: 100, realizado: 30, previstoAcum: 400, realizadoAcum: 230 },
  ],
  etapas: [{ ordem: 1, nome: 'Etapa A', projecao: 250, realizado: 150 }, { ordem: 2, nome: 'Etapa B', projecao: 150, realizado: 80 }],
};

test('custo real: realizado, previsto na data da última baixa e curva em fração do total', () => {
  const cr = Core.calcCustoReal({ custoReal });
  assert.equal(cr.realizado, 230);
  assert.equal(cr.pct, 230 / 400);
  // previsto em 10/04: 300 + 100 × 10/30
  assert.ok(Math.abs(cr.previsto - (300 + 100 * 10 / 30)) < 0.01, 'previsto interpolado no mês');
  assert.equal(cr.corte, '2026-04-10');
  assert.equal(cr.parcial, true);
  assert.equal(cr.saldo, 170);
  assert.equal(cr.pts[0].data, '2026-01-01');
  assert.equal(cr.pts.at(-1).data, '2026-04-30');
  assert.equal(cr.pts.at(-1).previsto, 1);
  assert.equal(cr.real, cr.evFrac);
});

test('custo real: corte no fim do mês do report tira as baixas seguintes, inclusive por etapa', () => {
  const comMes = { ...custoReal, etapas: [
    { ordem: 1, nome: 'Etapa A', projecao: 250, realizado: 150, porMes: { '2026-03': 0, '2026-04': 20 } },
    { ordem: 2, nome: 'Taxa de Administração', projecao: 150, realizado: 80, porMes: { '2026-04': 10 } }] };
  const cr = Core.calcCustoReal({ custoReal: comMes }, '2026-03-31');
  assert.equal(cr.corte, '2026-03-31');
  assert.equal(cr.realizado, 200);
  assert.equal(cr.parcial, false);
  assert.equal(cr.previsto, 300);
  assert.equal(cr.meses.at(-1).realizado, null, 'abril fica sem realizado');
  assert.deepEqual(cr.etapas.map(e => e.realizado), [130, 70]);
  assert.equal(cr.taxa, 70);
  // corte depois da última baixa não muda nada
  assert.equal(Core.calcCustoReal({ custoReal: comMes }, '2026-12-31').corte, '2026-04-10');
});

test('custo real: sem planilha não há cálculo', () => {
  assert.equal(Core.calcCustoReal({}), null);
  assert.equal(Core.calcCustoReal({ custoReal: { ...custoReal, total: 0 } }), null);
});

test('carga: planilha de custo real substitui a anterior e marca o corte financeiro', () => {
  const base = { id: '900', custoReal: { total: 1 }, dataCorte: '2026-04-08' };
  const ras = Carga.aplicarCarga(base, { custoReal }, '2026-04-10', { 'Custo real': 'x.xlsx' }, '2026-04-11');
  assert.equal(ras.custoReal.total, 400);
  assert.equal(ras.dataCorteFinanceiro, '2026-04-10');
  assert.equal(ras.dataCorte, '2026-04-08', 'corte físico não muda');
});

test('conferência: etapas somam o total da curva', () => {
  const ok = Carga.conferencia({ codigo: '900', dataCorte: '2026-04-10' }, { dados: { custoReal } });
  assert.ok(ok.some(([k, t]) => k === 'ok' && /Realizado por etapa soma/.test(t)));
  const ruim = Carga.conferencia({ codigo: '900', dataCorte: '2026-06-30' }, { dados: { custoReal: { ...custoReal, etapas: [{ nome: 'X', projecao: 1, realizado: 1 }] } } });
  assert.ok(ruim.some(([k, t]) => k === 'av' && /difere da curva/.test(t)));
  assert.ok(ruim.some(([k, t]) => k === 'av' && /última baixa/.test(t)));
});
