// Categoria de orçamentos do Dashboard do Prevision: configuração por obra, escolha da fonte e a troca/restauração na
// tela (com uma página fictícia no lugar do Playwright). Só dados fictícios.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Cat = require('../lib/categoria.cjs');
const { _internas: X } = require('../lib/prevision-export.cjs');

const CUSTOS = 'Custos do projeto (Principal)', RECEB = 'Recebíveis do projeto';
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'obras.json'), 'utf8'));
const obra = c => cfg.obras.find(o => o.codigo === c);

test('obras.json: 198 e 208 pedem Recebíveis; 207 não pede categoria; a 198 deixou a API no financeiro', () => {
  assert.equal(Cat.categoriaPedida(obra('198')), RECEB);
  assert.equal(Cat.categoriaPedida(obra('208')), RECEB);
  assert.equal(Cat.categoriaPedida(obra('207')), null, 'administração: o robô não mexe na categoria');
  assert.ok(!((obra('198').api.equivalenciaValidada || {}).conjuntos || []).includes('financeiro'));
  assert.ok(Cat.exigeInterface(obra('198')) && Cat.exigeInterface(obra('208')) && !Cat.exigeInterface(obra('207')));
});

test('categoria: comparação sem acento/caixa, padrão explícito não exige a interface, valor do seletor e números BR', () => {
  assert.ok(Cat.mesmaCategoria('RECEBIVEIS do projeto', RECEB));
  assert.ok(!Cat.mesmaCategoria(CUSTOS, RECEB));
  assert.equal(Cat.categoriaPedida({ exportacao: { financeiro: { categoria: '  ' } } }), null);
  assert.equal(Cat.exigeInterface({ exportacao: { financeiro: { categoria: CUSTOS } } }), false);
  assert.equal(Cat.exigeInterface({ exportacao: { financeiro: { categoria: RECEB } } }), true);
  assert.equal(Cat.exigeInterface({}), false);
  assert.equal(Cat.valorDoSeletor('Categoria de orçamentos\nRecebíveis do projeto'), RECEB);
  assert.equal(Cat.valorDoSeletor(`${CUSTOS}\narrow_drop_down`), CUSTOS);
  assert.equal(Cat.numeroBR('R$ 12.840.711,39'), 12840711.39);
  assert.equal(Cat.numeroBR('sem número'), null);
});

// Página fictícia: só o que definirCategoria/restaurarCategoria usam do Playwright
function paginaFicticia({ categoria = CUSTOS, opcoes = [CUSTOS, RECEB], seletor = true, totais = { [CUSTOS]: 10700000, [RECEB]: 12840711.39 }, trocaNaoPega = false } = {}) {
  const s = { categoria, aberto: false, cliques: [], rotas: [], pressionou: [] };
  const fmt = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const selLoc = () => {
    const l = { filter: () => l, first: () => l, count: async () => (seletor ? 1 : 0), innerText: async () => `Categoria de orçamentos\n${s.categoria}`,
      locator: () => ({ count: async () => 1, first: () => ({ click: async () => { s.aberto = true; } }) }) };
    return l;
  };
  const itens = () => { const l = { filter: () => l, first: () => ({ waitFor: async () => { if (!s.aberto) throw new Error('menu fechado'); } }), allInnerTexts: async () => (s.aberto ? opcoes : []),
    nth: i => ({ click: async () => { if (!trocaNaoPega) s.categoria = opcoes[i]; s.aberto = false; s.cliques.push(opcoes[i]); } }) }; return l; };
  const page = { s,
    locator: q => (q === '.v-select' ? selLoc() : itens()),
    evaluate: async () => `Dashboard\nValor Total\nR$ ${fmt(totais[s.categoria])}\nCurva S`,
    waitForLoadState: async () => {}, waitForTimeout: async () => {}, keyboard: { press: async k => { s.pressionou.push(k); s.aberto = false; } },
    goto: async u => { s.rotas.push(u); }, url: () => 'https://app.prevision.com.br/app/dashboard' };
  return page;
}

test('definirCategoria: troca Custos → Recebíveis, espera e confere o Valor Total', async () => {
  const p = paginaFicticia();
  const r = await X.definirCategoria(p, RECEB);
  assert.equal(r.trocou, true); assert.equal(r.antes, CUSTOS); assert.equal(r.depois, RECEB);
  assert.equal(r.valorTotalAntes, 10700000); assert.equal(r.valorTotalDepois, 12840711.39);
  assert.equal(await X.lerCategoria(p), RECEB);
  assert.deepEqual(p.s.cliques, [RECEB]);
});

test('definirCategoria: já na categoria pedida não clica em nada', async () => {
  const p = paginaFicticia({ categoria: RECEB });
  const r = await X.definirCategoria(p, RECEB);
  assert.equal(r.trocou, false); assert.deepEqual(p.s.cliques, []);
});

test('definirCategoria: seletor ausente, opção inexistente e troca que não pega são erros claros', async () => {
  await assert.rejects(X.definirCategoria(paginaFicticia({ seletor: false }), RECEB), { codigo: 'EXPORTACAO_INTERFACE', message: /seletor/ });
  const p = paginaFicticia({ opcoes: [CUSTOS] });
  await assert.rejects(X.definirCategoria(p, RECEB), { codigo: 'EXPORTACAO_INTERFACE', message: /não está entre as opções/ });
  assert.deepEqual(p.s.pressionou, ['Escape'], 'fecha o menu aberto');
  const t = paginaFicticia({ trocaNaoPega: true });
  await assert.rejects(X.definirCategoria(t, RECEB), { codigo: 'EXPORTACAO_INTERFACE', message: /Não consegui trocar/ });
});

test('restaurarCategoria: devolve a original e registra; se falhar, registra sem lançar', async () => {
  const p = paginaFicticia({ categoria: RECEB });
  const out = { categoria: { pedida: RECEB, original: CUSTOS, trocou: true } };
  await X.restaurarCategoria(p, { codigo: '901' }, RECEB, CUSTOS, out);
  assert.equal(out.categoria.restaurada, true); assert.equal(await X.lerCategoria(p), CUSTOS);
  assert.match(p.s.rotas[0], /\/dashboard$/);

  const ruim = paginaFicticia({ categoria: RECEB, trocaNaoPega: true });
  const out2 = {};
  await X.restaurarCategoria(ruim, { codigo: '901' }, RECEB, CUSTOS, out2);
  assert.equal(out2.categoria.restaurada, false); assert.match(out2.categoria.erroRestaurar, /Não consegui trocar/);
  assert.equal(out2.categoria.original, CUSTOS);
});
