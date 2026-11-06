// Remoção de Restrições em PDF (Departamento de Operações): leitura no formato do mapa de restrições.
// Itens de texto fictícios, no formato de Parsers.pdfItens. Rodar: node --test sync/test/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Parsers } = require('../lib/ambiente.cjs');
const Core = globalThis.Core;

// Página deitada (842 de altura). No PDF y cresce para cima; aqui informo a distância do topo.
const H = 842;
const it = (x, topo, s) => ({ x, y: H - topo, w: s.length * 4.5, s });
const cabTabela = topo => [it(50, topo, 'Nº'), it(90, topo, 'AÇÃO / ENTREGA'), it(501, topo, 'RESPONSÁVEL / TITULAR'), it(696, topo, 'PRAZO'), it(798, topo, 'STATUS'), it(907, topo, 'OBSERVAÇÕES, EVIDÊNCIA E RESTRIÇÕES')];
const topoPagina = time => [it(984, 48, 'DEPARTAMENTO DE OPERAÇÕES'), it(55, 50, 'MACHINE'), it(173, 50, '/'), it(194, 50, time),
  it(55, 70, 'CONTROLE DE AÇÕES E RESTRIÇÕES'), it(250, 70, '•'), it(265, 70, '05 NOV 2026'), it(341, 70, '•'), it(357, 70, 'ORDENAÇÃO POR DATA-META')];
const rodape = pg => [it(42, 820, 'MACHINE'), it(92, 820, 'corte 05/11/2026'), it(174, 820, 'prazos originais preservados'), it(1117, 820, `PÁG. 0${pg}`)];
// uma ação: Nº na altura da 1ª linha; observações começam um pouco acima do Nº e descem várias linhas
const acao = (topo, n, a, resp, prazo, st, obs) => [it(53, topo + 4, n), it(90, topo, a), it(501, topo, resp[0]), ...(resp[1] ? [it(501, topo + 12, resp[1])] : []),
  it(696, topo + 4, prazo), it(820, topo + 8, st), ...obs.map((o, k) => it(907, topo - 2 + 12 * k, o))];

function pdfFicticio(time = 'ACME (901)') {
  const p1 = [...topoPagina(time),
    it(54, 132, 'AÇÕES'), it(278, 132, 'EXIGÍVEIS'), it(503, 132, 'PONTUAIS'), it(727, 132, 'ATRASADAS ABERTAS'), it(952, 132, 'IRR'),
    it(54, 166, '4'), it(278, 166, '2'), it(503, 166, '0'), it(727, 166, '1'), it(952, 166, '12.5%'),
    it(45, 212, 'GESTOR DA OBRA: Fulano. O GC conduz e cobra todas as frentes.'),
    ...cabTabela(244),
    ...acao(272, '01', 'Aprovar cotação de exemplo', ['Fulano (GC)', 'Beltrano (exec.)'], '03/11/2026', 'ATRASADO', ['Linha 1 da observação', 'linha 2', 'linha 3', 'linha 4', 'linha 5 que desce']),
    ...acao(400, '02', 'Validar projeto fictício', ['Fulano (GC)'], '28/10/2026', 'EXECUTADO', ['Concluído em 28/10.']),
    ...rodape(1)];
  const p2 = [...topoPagina(time), ...cabTabela(130),
    ...acao(158, '03', 'Emitir pedido de compra', ['Ciclano (GC)'], '13/11/2026', 'PREVISTO', ['Aguardando mapa.', 'Segunda linha.']),
    ...acao(260, '04', 'Confirmar entrega de material', ['Ciclano (GC)'], 'SEM DATA', 'EM EXECUÇÃO', ['Fornecedor sem previsão.']),
    ...rodape(2)];
  return [p1, p2];
}

test('restrições em PDF: título, código, data, gestor e indicadores do documento', () => {
  const pags = pdfFicticio();
  assert.equal(Parsers.ehRestricoesPdf(pags), true);
  const R = Parsers.parseRestricoesPdf(pags);
  assert.deepEqual([R.equipe, R.codigo, R.dataMapa, R.gestor], ['ACME (901)', '901', '2026-11-05', 'Fulano']);
  assert.deepEqual(R.indicadores, { acoes: 4, exigiveis: 2, pontuais: 0, atrasadasAbertas: 1, irr: 0.125 });
  assert.deepEqual(R.avisos, []);
});

test('restrições em PDF: cada ação vira uma restrição do mapa, nas duas páginas, sem a observação vazar para a seguinte', () => {
  const R = Parsers.parseRestricoesPdf(pdfFicticio());
  assert.equal(R.itens.length, 4);
  assert.deepEqual(R.itens[0], { frente: 'Aprovar cotação de exemplo', tipo: '', responsavel: 'Fulano (GC) / Beltrano (exec.)', dataLimite: '2026-11-03', dataOriginal: '2026-11-03',
    condicao: '', acao: '', obs: 'Linha 1 da observação linha 2 linha 3 linha 4 linha 5 que desce', status: 'pendente', removidaEm: null, reprogramacoes: 0, atrasadoNoMapa: true, numero: 1 });
  assert.equal(R.itens[1].obs, 'Concluído em 28/10.');
  assert.deepEqual([R.itens[1].status, R.itens[1].removidaEm], ['removida', '2026-10-28'], 'executada antes do documento: removida na data do prazo');
  assert.deepEqual([R.itens[2].status, R.itens[2].dataLimite, R.itens[2].atrasadoNoMapa], ['pendente', '2026-11-13', false]);
  assert.deepEqual([R.itens[3].status, R.itens[3].dataLimite, R.itens[3].condicao], ['andamento', null, 'SEM DATA']);
  // o farol do painel trata a ação como qualquer restrição: vencida pela data limite
  assert.equal(Core.farolRestricao(R.itens[0], '2026-11-06').k, 'critico');
  assert.deepEqual(Core.pessoasDe(R.itens[0].responsavel), ['Fulano (GC)', 'Beltrano (exec.)']);
});

test('restrições em PDF: título sem código, contagem diferente do indicador e PDF de RDO', () => {
  const sem = Parsers.parseRestricoesPdf(pdfFicticio('ACME / FILIAL'));
  assert.deepEqual([sem.equipe, sem.codigo], ['ACME / FILIAL', null]);
  const pags = pdfFicticio(); pags[1] = pags[1].filter(i => !/^(04|Confirmar entrega de material)$/.test(i.s));
  assert.match(Parsers.parseRestricoesPdf(pags).avisos[0], /indica 4 ações e foram lidas 3/);
  assert.equal(Parsers.ehRestricoesPdf([[it(40, 40, 'Relatório 05/11/2026 n° 12'), it(40, 60, 'Obra 901 - Exemplo')]]), false);
});
