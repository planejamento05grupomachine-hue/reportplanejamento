// Boletim de medição no formato do Sienge (aba "M<n>" do Controle de Medição) — dados fictícios.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Parsers, carregarXLSX } = require('../lib/ambiente.cjs');

let XLSX;
test.before(async () => { XLSX = await carregarXLSX(); });

const V = (...c) => c; // linha da planilha
function planilha() {
  const m1 = [
    V(null, null, null, null, null, 'Boletim de Medições'),
    V('Contrato', null, 'CT/901/2026', null, null, null, null, null, null, null, null, null, 'Total do contrato', null, null, '1,000,000.00'),
    V('Obra', null, '901 - Obra Exemplo', null, null, null, null, null, null, null, null, null, 'Total da obra', null, null, '1,000,000.00'),
    V('Unidade construtiva', null, '1 - CONSTRUÇÃO CIVIL', null, null, null, null, null, null, null, null, null, 'Cliente', null, null, '10 - CLIENTE EXEMPLO S.A.'),
    V('Número da medição', null, '2', null, null, null, null, null, null, null, null, null, 'Data da medição', null, null, '10/2/26'),
    V('Data de vencimento', null, '10/10/26'),
    V(null, null, null, null, null, null, null, null, null, 'Quantidades', null, null, null, null, null, null, null, null, 'Valores'),
    V('Referência', 'Descrição', null, null, 'Un.', null, 'Ad.', null, null, 'Contratada', 'Acum. anterior', null, null, null, 'Medida', '%Exe.', null, null, 'Preço unitário', 'Acum. anterior', null, 'Medição'),
    V('01', 'ETAPAS', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'R$ 1,000,000.00', 'R$ 300,000.00', null, 'R$ 100,000.00'),
    V('01.001', 'FUNDAÇÃO', null, null, null, null, null, null, null, '1', '30.00%', null, null, null, '10.00%', '40.00%', null, null, 'R$ 1,000,000.00', 'R$ 300,000.00', null, 'R$ 100,000.00'),
    V('01.001.001', 'Estacas', null, null, 'm', null, null, null, null, '100', '30.00', null, null, null, '10.00', '40.00%', null, null, 'R$ 10,000.00', 'R$ 300,000.00', null, 'R$ 100,000.00'),
    V('Total', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'R$ 300,000.00', null, 'R$ 100,000.00'),
    V('Total da medição'),
    V('Total dos itens', null, null, 'R$ 100,000.00', null, null, null, null, 'Total reajuste', null, null, null, null, 'R$ -', null, null, 'Total bruto', null, null, null, 'R$ 100,000.00'),
    V('Retenções', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'Subtotal', null, null, null, 'R$ 100,000.00'),
    V('Imposto', null, null, null, null, null, null, null, null, null, null, 'Retenção', null, null, null, null, 'Descontos', null, null, null, 'R$ 20,000.00'),
    V('5 - ISS', null, null, null, null, null, null, null, null, null, null, 'R$ 1,500.00', null, null, null, null, 'Caução', null, null, null, 'R$ -'),
    V(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'Total líquido', null, null, null, 'R$ 78,500.00'),
    V('Desconto', null, 'Faturamento direto do período - R$ 20.000,00'),
  ];
  const resumo = [V('Mês', 'Previsto (CT)', 'Realizado (CT)'), V('Setembro', '500,000.00', '100,000.00'), V('Total', '1,000,000.00', '100,000.00')];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumo), 'VISÃO GERAL');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(m1), 'M2');
  return Parsers.wbDe(XLSX, XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

test('boletim: as duas colunas "Acum. anterior" (quantidade em % e valor em R$) saem separadas', () => {
  const b = Parsers.parseMedicaoContrato(XLSX, planilha()).boletins[0];
  const f = b.itens.find(i => i.eap === '01.001');
  assert.equal(f.acumuladoAnterior, 0.3);
  assert.equal(f.acumuladoAnteriorValor, 300000);
  assert.deepEqual([f.medida, f.pctExec, f.precoUnitario, f.medicao], [0.1, 0.4, 1000000, 100000]);
});

test('boletim: cabeçalho, datas no formato padrão do Excel e fechamento do Sienge', () => {
  const R = Parsers.parseMedicaoContrato(XLSX, planilha()).boletins[0].resumo;
  assert.deepEqual([R.contrato, R.unidadeConstrutiva, R.numero, R.cliente], ['CT/901/2026', '1 - CONSTRUÇÃO CIVIL', '2', '10 - CLIENTE EXEMPLO S.A.']);
  assert.deepEqual([R.dataMedicao, R.vencimento, R.totalContrato], ['2026-10-02', '2026-10-10', 1000000]);
  assert.deepEqual([R.totalItens, R.totalBruto, R.subtotal, R.descontos, R.totalLiquido], [100000, 100000, 100000, 20000, 78500]);
  assert.deepEqual(R.retencoes, [{ imposto: '5 - ISS', valor: 1500 }]);
  assert.match(R.observacao, /Faturamento direto do período/);
});
