// IDC da Gestão de Custos do Prevision (API oficial): escolha do projeto, da versão e leitura da linha-resumo.
// Dados fictícios. Rodar: node --test sync/test/
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const api = require('../lib/prevision-api.cjs');
const { Carga } = require('../lib/ambiente.cjs');

function apiFicticia({ projetos, versoes = {}, tabelas = {} }) {
  const chamadas = [];
  return { chamadas,
    projetosCusto: async () => { chamadas.push('projetos'); return projetos; },
    versoesCusto: async id => { chamadas.push('versoes ' + id); return versoes[id] || []; },
    tabelaTendencia: async (id, v) => { chamadas.push(`tendencia ${id}/${v}`); return tabelas[v]; } };
}
const PROJ = [{ id: 'c-1', name: 'Obra 901', constructionProjectId: 901, isArchived: false }, { id: 'c-2', name: 'Arquivada', constructionProjectId: 902, isArchived: true }];

test('IDC: projeto de custos pelo id do cronograma, versão mais recente e linha-resumo da tabela de tendência', async () => {
  const a = apiFicticia({ projetos: PROJ,
    versoes: { 'c-1': [{ id: 'v-ant', name: 'Setembro', referenceDate: '2026-09-30T00:00:00Z' }, { id: 'v-nova', name: 'Outubro', referenceDate: '2026-10-31T00:00:00Z' }] },
    tabelas: { 'v-nova': { referenceDate: '2026-10-31T00:00:00Z', lastMeasurementDate: '2026-10-28T00:00:00Z', itemSummary: { idc: 0.97, idp: 1.02 } } } });
  const r = await api.indicesDeCusto(a, '901');
  assert.deepEqual(r, { situacao: 'ok', idc: 0.97, idp: 1.02, versao: 'Outubro', dataReferencia: '2026-10-31', ultimaMedicao: '2026-10-28' });
  assert.ok(a.chamadas.includes('tendencia c-1/v-nova') && !a.chamadas.includes('tendencia c-1/v-ant'));
});

test('IDC: obra sem Gestão de Custos, projeto arquivado, sem versão e IDC zerado ficam sem valor', async () => {
  assert.equal((await api.indicesDeCusto(apiFicticia({ projetos: PROJ }), 999)).situacao, 'sem-projeto-de-custos');
  assert.equal((await api.indicesDeCusto(apiFicticia({ projetos: PROJ }), 902)).situacao, 'sem-projeto-de-custos');
  assert.equal((await api.indicesDeCusto(apiFicticia({ projetos: PROJ }), 901)).situacao, 'sem-versao');
  const zerado = apiFicticia({ projetos: PROJ, versoes: { 'c-1': [{ id: 'v', name: 'X', referenceDate: '2026-10-31' }] }, tabelas: { v: { itemSummary: { idc: 0, idp: 0 } } } });
  assert.equal((await api.indicesDeCusto(zerado, 901)).situacao, 'sem-idc');
});

test('IDC: a lista de projetos de custos é reaproveitada entre obras', async () => {
  const a = apiFicticia({ projetos: PROJ });
  await api.indicesDeCusto(a, 999, PROJ);
  assert.ok(!a.chamadas.includes('projetos'));
});

test('IDC: a carga grava indicesPrevision sem mexer nas datas de corte', () => {
  const base = { codigo: '901', dataCorte: '2026-11-06', dataCorteFinanceiro: '2026-11-06' };
  const ras = Carga.aplicarCarga(base, { indicesPrevision: { idc: 0.97 } }, base.dataCorte, {}, '2026-11-07', { temRascunho: true });
  assert.deepEqual([ras.dataCorte, ras.dataCorteFinanceiro, ras.indicesPrevision.idc], ['2026-11-06', '2026-11-06', 0.97]);
});
