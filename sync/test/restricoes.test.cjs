// Mapa de restrições: farol, IRR, vínculo com o cronograma e leitura da planilha — só dados fictícios.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Parsers, carregarXLSX } = require('../lib/ambiente.cjs');
const Core = globalThis.Core;

let XLSX;
test.before(async () => { XLSX = await carregarXLSX(); });

const HOJE = '2026-11-04'; // quarta-feira; semana de 02/11 a 08/11
const r = (o) => ({ frente: 'Frente', status: 'pendente', ...o });

test('farol da restrição: vencida, vence em 7 dias, sem data/condicionada, no prazo, removida', () => {
  assert.deepEqual(Core.farolRestricao(r({ dataLimite: '2026-11-01' }), HOJE).k, 'critico');
  assert.match(Core.farolRestricao(r({ dataLimite: '2026-11-01' }), HOJE).t, /3 d/);
  assert.equal(Core.farolRestricao(r({ dataLimite: '2026-11-04' }), HOJE).t, 'Vence hoje');
  assert.equal(Core.farolRestricao(r({ dataLimite: '2026-11-11' }), HOJE).k, 'atencao');
  assert.equal(Core.farolRestricao(r({ dataLimite: '2026-11-12' }), HOJE).k, 'info');
  assert.equal(Core.farolRestricao(r({ dataLimite: null, condicao: '3 dias após a carta' }), HOJE).t, 'Condicionada');
  assert.equal(Core.farolRestricao(r({ dataLimite: '2026-10-01', status: 'removida' }), HOJE).k, 'ok');
});

test('IRR: removidas até a data ORIGINAL ÷ previstas na semana; reprogramar não melhora o índice', () => {
  const itens = [
    // semana de 26/10: 2 previstas, 1 removida no prazo, 1 removida depois (reprogramada)
    r({ dataLimite: '2026-10-28', status: 'removida', removidaEm: '2026-10-27' }),
    r({ dataLimite: '2026-11-05', dataOriginal: '2026-10-29', reprogramacoes: 1, status: 'removida', removidaEm: '2026-11-03' }),
    // semana atual (até hoje): 1 prevista e vencida
    r({ dataLimite: '2026-11-03' }),
    // semana atual, depois de hoje: não entra ainda
    r({ dataLimite: '2026-11-06' }),
  ];
  const I = Core.indicadoresRestricoes(itens, HOJE);
  const sem = d => I.serie.find(w => w.ini === d);
  assert.equal(sem('2026-10-26').previstas, 2);
  assert.equal(sem('2026-10-26').noPrazo, 1);
  assert.equal(sem('2026-10-26').irr, 0.5);
  assert.equal(sem('2026-11-02').previstas, 1);
  assert.equal(sem('2026-11-02').irr, 0);
  assert.equal(I.irr4, 1 / 3);
  assert.equal(I.abertas, 2);
  assert.equal(I.vencidas, 1);
  assert.equal(I.vencem7, 1);
  assert.equal(I.removidasSemana, 1);
});

test('responsáveis compostos contam para cada pessoa, vencidas primeiro', () => {
  const I = Core.indicadoresRestricoes([
    r({ responsavel: 'Ana / Bia', dataLimite: '2026-11-01' }),
    r({ responsavel: 'Bia + Caio', dataLimite: '2026-12-01' }),
    r({ responsavel: 'Caio', status: 'removida', removidaEm: '2026-11-01' }),
  ], HOJE);
  assert.deepEqual(I.porPessoa.map(p => [p.nome, p.abertas, p.vencidas]), [['Bia', 2, 1], ['Ana', 1, 1], ['Caio', 1, 0]], 'mais vencidas primeiro; empate: mais abertas');
});

test('ordem da lista: vencidas, 7 dias, sem data, no prazo, removidas', () => {
  const o = Core.ordenarRestricoes([
    r({ frente: 'E', status: 'removida', removidaEm: '2026-11-01' }), r({ frente: 'D', dataLimite: '2026-12-20' }),
    r({ frente: 'C' }), r({ frente: 'B', dataLimite: '2026-11-06' }), r({ frente: 'A', dataLimite: '2026-10-20' }),
  ], HOJE).map(x => x.frente);
  assert.deepEqual(o, ['A', 'B', 'C', 'D', 'E']);
});

test('vínculo com o cronograma: avisa quando a atividade começa antes da data limite', () => {
  const linhas = [{ linha: 7, nome: 'Fundação rasa', inicio: '2026-11-10', realizado: 0 }];
  const x = r({ dataLimite: '2026-11-17', atividade: { linha: 7, nome: 'Fundação rasa' } });
  assert.equal(Core.restricaoImpede(x, linhas).conflito, true);
  assert.equal(Core.restricaoImpede({ ...x, dataLimite: '2026-11-05' }, linhas).conflito, false);
  assert.equal(Core.restricaoImpede({ ...x, status: 'removida' }, linhas), null);
});

test('datas escritas à mão: "27/out", "28-out", ano pelo mapa, série do Excel e condição', () => {
  assert.equal(Core.dataRestricao('27/out', '2026-10-29'), '2026-10-27');
  assert.equal(Core.dataRestricao('28-out', '2026-10-29'), '2026-10-28');
  assert.equal(Core.dataRestricao('04/jan', '2026-10-29'), '2027-01-04');
  assert.equal(Core.dataRestricao('30/10/2026'), '2026-10-30');
  assert.equal(Core.dataRestricao(46324), '2026-10-29');
  assert.equal(Core.dataRestricao('3 dias após envio da carta', '2026-10-29'), null);
});

test('planilha do mapa: frente mesclada, faixa de título, bloco mesclado e status da planilha', () => {
  const aoa = [
    ['Mapeamento Restrições - OBRA TESTE (obra 900) - 29.10.2026'], [],
    ['Frente', 'Disciplina', 'Responsável', 'Data limite', 'Status', 'Ação', 'Observação:'],
    ['Drenagem', 'Projeto', 'Ana', '29/out', 'Atrasado', 'Atualizar edital', 'falta insumo'],
    [null, 'Contratação', 'Bia', '04/nov', 'Pendente', 'Apresentação BID', null],
    ['Terraplenagem', 'Projeto', 'Ana', null, 'OK', null, null],
    ['Elétrica', 'Material', 'Caio', '3 dias após envio da carta', 'Pendente', 'Acompanhar entrega', null],
    ['ADITIVOS DE ESCOPO', null, null, null, null, null, null],
    ['Guarita', 'Aditivo', 'Dani', '30/10/2026', 'Em aprovação.', 'Aditivos em pleito.', '-'],
    ['Auditório', null, null, null, null, null, null],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [{ s: { r: 3, c: 0 }, e: { r: 4, c: 0 } }, { s: { r: 7, c: 0 }, e: { r: 7, c: 6 } },
    ...[1, 2, 3, 4, 5, 6].map(c => ({ s: { r: 8, c }, e: { r: 9, c } }))];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Mapa');
  const buf = new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  const m = Parsers.parseRestricoes(XLSX, Parsers.wbDe(XLSX, buf), { arquivo: 'mapa.xlsx', hoje: HOJE, dataRestricao: Core.dataRestricao });
  assert.equal(m.dataMapa, '2026-10-29');
  assert.deepEqual(m.itens.map(x => x.frente), ['Drenagem', 'Drenagem', 'Terraplenagem', 'Elétrica', 'Guarita', 'Auditório']);
  const [a, b, c, d, e, f] = m.itens;
  assert.equal(a.status, 'pendente'); assert.equal(a.atrasadoNoMapa, true); assert.equal(a.dataLimite, '2026-10-29'); assert.equal(a.obs, 'falta insumo');
  assert.equal(b.tipo, 'Contratação'); assert.equal(b.dataLimite, '2026-11-04');
  assert.equal(c.status, 'removida'); assert.equal(c.removidaEm, '2026-10-29');
  assert.equal(d.dataLimite, null); assert.equal(d.condicao, '3 dias após envio da carta');
  assert.equal(e.status, 'aprovacao'); assert.equal(f.status, 'aprovacao'); assert.equal(f.acao, 'Aditivos em pleito.'); assert.equal(f.responsavel, 'Dani');
});
