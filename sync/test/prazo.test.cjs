// Prazo ganho (Earned Schedule), projeção em faixa e histórico de cortes — só dados fictícios.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
require(path.join(__dirname, '..', '..', 'js', 'core.js'));
const Core = globalThis.Core;
const Carga = require(path.join(__dirname, '..', '..', 'js', 'carga.js'));

// Obra de 1 ano com previsto linear (fim de cada mês) e realizado informado até o corte
function obraFicticia({ corte, realPorMes }) {
  const curva = [];
  for (let m = 1; m <= 12; m++) {
    const fim = new Date(Date.UTC(2026, m, 0, 12)).toISOString().slice(0, 10);
    const real = realPorMes[m - 1];
    curva.push({ data: fim, base: m / 12, previsto: m / 12, realizado: real === undefined ? null : real });
  }
  const realHoje = realPorMes.filter(v => v !== undefined).at(-1) || 0;
  const tarefas = [
    { linha: 1, eap: '1', nivel: 1, tarefa: '900 - Obra fictícia', folha: false, inicio: '2026-01-01', fim: '2026-12-31', previsto: 1, base: 1, realizado: realHoje },
    { linha: 2, eap: '1.1', nivel: 2, tarefa: 'Estrutura', folha: true, inicio: '2026-01-01', fim: '2026-12-31', previsto: 1, base: 1, realizado: realHoje },
  ];
  const mensal = curva.map((p, i) => ({ mes: p.data.slice(0, 7), previsto: 1 / 12, base: 1 / 12, realizado: realPorMes[i] === undefined ? null : realPorMes[i] - (realPorMes[i - 1] || 0) }));
  return { id: '900', codigo: '900', nome: 'Obra fictícia', dataCorte: corte, curva: [{ data: '2026-01-01', base: 0, previsto: 0, realizado: 0 }, ...curva], tarefas, mensal };
}

test('prazo ganho: obra atrasada mede o atraso em dias e o IDP(t)', () => {
  // no fim de junho o plano previa 50%; a obra tem 40% → o plano previa 40% por volta de 26/05
  const o = obraFicticia({ corte: '2026-06-30', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35, 0.40] });
  const r = Core.calc(o);
  assert.ok(Math.abs(r.idp - 0.8) < 0.01, 'IDP em % = 0,80');
  assert.ok(r.prazoGanho.atraso >= 33 && r.prazoGanho.atraso <= 38, `atraso ${r.prazoGanho.atraso} d`);
  assert.ok(Math.abs(r.prazoGanho.idpT - 0.80) < 0.02, `IDP(t) ${r.prazoGanho.idpT}`);
  assert.equal(r.farolTempo, true);
  assert.equal(r.sem.e, 'atrasada');
  assert.equal(Core.textoAtraso(r.prazoGanho), `${r.prazoGanho.atraso} dias de atraso`);
});

test('prazo ganho: projeção em faixa, nunca antes do corte, e frase com as duas hipóteses', () => {
  const o = obraFicticia({ corte: '2026-06-30', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35, 0.40] });
  const r = Core.calc(o);
  assert.equal(r.projecaoFonte, 'prazo');
  const f = r.projecaoFaixa;
  assert.ok(f.atrasoMantido > r.prazo.fimCron, 'atraso mantido termina depois do cronograma');
  assert.ok(f.desempenhoMantido > f.atrasoMantido, 'desempenho mantido (0,80) termina depois de atraso mantido');
  assert.equal(r.projecao, f.desempenhoMantido);
  assert.match(Core.fraseProjecao(r), /entre .* e .*desempenho de prazo se mantiver/);
});

test('prazo ganho: obra adiantada tem atraso negativo e não converge para 1 no fim', () => {
  const o = obraFicticia({ corte: '2026-06-30', realPorMes: [0.10, 0.20, 0.30, 0.40, 0.50, 0.58] });
  const r = Core.calc(o);
  assert.ok(r.prazoGanho.atraso < -10, `atraso ${r.prazoGanho.atraso}`);
  assert.equal(r.sem.e, 'adiantada');
  assert.match(Core.textoAtraso(r.prazoGanho), /adiantada/);
  // fim de obra atrasada: IDP em % já perto de 1, IDP(t) ainda mostra o atraso
  const fim = obraFicticia({ corte: '2026-12-31', realPorMes: [0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.50, 0.58, 0.66, 0.74, 0.82, 0.90] });
  const rf = Core.calc(fim);
  assert.ok(rf.idp >= 0.89, `IDP em % ${rf.idp}`);
  assert.ok(rf.prazoGanho.atraso >= 30, `atraso no fim ${rf.prazoGanho.atraso}`);
});

test('prazo ganho: início da obra não usa o índice em tempo; cadastro pode voltar ao IDP em %', () => {
  const ini = obraFicticia({ corte: '2026-01-20', realPorMes: [] });
  ini.curva[1].realizado = null;
  const r = Core.calc(ini);
  assert.equal(r.farolTempo, false, 'menos de 30 dias de obra: farol pelo IDP em %');
  const o = obraFicticia({ corte: '2026-06-30', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35, 0.40] });
  o.indicePrazo = 'percentual';
  assert.equal(Core.calc(o).farolTempo, false);
});

test('tendência do prazo: um ponto por mês até o corte, o último é o próprio corte', () => {
  const o = obraFicticia({ corte: '2026-06-15', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35, 0.38] });
  const r = Core.calc(o);
  const t = r.tendencia;
  assert.equal(t.at(-1).data, '2026-06-15');
  assert.deepEqual(t.map(x => x.data.slice(0, 7)), ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']);
  assert.ok(t.at(-1).atraso > t[0].atraso, 'atraso cresce ao longo dos meses');
});

test('histórico de cortes: cada carga física grava a posição; a mesma data é substituída', () => {
  const base = obraFicticia({ corte: '2026-05-31', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35] });
  const pac1 = { curva: base.curva, tarefas: base.tarefas, mensal: base.mensal };
  const ras1 = Carga.aplicarCarga(base, pac1, '2026-05-31', {}, '2026-06-01');
  assert.equal(ras1.historico.length, 1);
  assert.equal(ras1.historico[0].corte, '2026-05-31');
  assert.ok(ras1.historico[0].atraso > 0);
  const o2 = obraFicticia({ corte: '2026-06-30', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35, 0.40] });
  const ras2 = Carga.aplicarCarga(ras1, { curva: o2.curva, tarefas: o2.tarefas, mensal: o2.mensal }, '2026-06-30', {}, '2026-07-01');
  assert.deepEqual(ras2.historico.map(h => h.corte), ['2026-05-31', '2026-06-30']);
  const ras3 = Carga.aplicarCarga(ras2, { curva: o2.curva, tarefas: o2.tarefas, mensal: o2.mensal }, '2026-06-30', {}, '2026-07-02');
  assert.equal(ras3.historico.length, 2, 'recarga do mesmo corte não duplica');
  assert.equal(ras3.historico[1].registradoEm, '2026-07-02');
  // carga só financeira não mexe no histórico físico
  const ras4 = Carga.aplicarCarga(ras3, { financeiro: { curva: [] } }, '2026-07-10', {}, '2026-07-10');
  assert.equal(ras4.historico.length, 2);
});

test('medido × executado: só na base do contrato, com tolerância de 2%', () => {
  const o = obraFicticia({ corte: '2026-06-30', realPorMes: [0.08, 0.15, 0.22, 0.29, 0.35, 0.40] });
  o.financeiro = { curva: o.curva.map(p => ({ data: p.data, base: p.base * 1e6, previsto: p.previsto * 1e6, realizado: p.realizado === null ? null : p.realizado * 1e6 })) };
  o.medicao = { resumo: { totalContrato: 1e6, medidoAcumulado: 470000, saldo: 530000, ultimaMedicao: 'jun/26' } };
  const rf = Core.calcFinanceiro(o, '2026-06-30');
  assert.equal(rf.medidoVsExecutado.situacao, 'medido-acima');
  assert.ok(Math.abs(rf.medidoVsExecutado.dif - 70000) < 1);
  o.medicao.resumo.medidoAcumulado = 410000;
  assert.equal(Core.calcFinanceiro(o, '2026-06-30').medidoVsExecutado.situacao, 'em-linha');
  o.medicao.resumo.totalContrato = 3e6; // curva em outra base (orçamento × contrato): não compara
  assert.equal(Core.calcFinanceiro(o, '2026-06-30').medidoVsExecutado, null);
});

test('início da obra: com menos de 2% previsto o farol fica neutro ("Início da obra"), não "Atrasada"', () => {
  const o = obraFicticia({ corte: '2026-01-05', realPorMes: [] });
  o.curva[1].realizado = null;
  const r = Core.calc(o);
  assert.ok(r.prevCorte < 0.02);
  assert.equal(r.sem.e, 'inicio');
  assert.equal(r.inicioObra, true);
  assert.match(Core.narrativa(o, r)[0], /Obra em início/);
});

test('conferência: obra sem medição (Curva S sem realizado, tarefas em 0%) não acusa realizados diferentes', () => {
  const o = obraFicticia({ corte: '2026-01-05', realPorMes: [] });
  const curva = o.curva.map(p => ({ ...p, realizado: 0 }));
  const tarefas = o.tarefas.map(t => ({ ...t, realizado: 0 }));
  const out = Carga.conferencia({ codigo: '900', tarefas: [], curva: [] }, { dados: { curva, tarefas }, nomes: {} });
  assert.ok(out.some(([k, t]) => k === 'ok' && /sem medição/.test(t)));
  assert.ok(!out.some(([, t]) => /realizados diferentes/.test(t)));
});
