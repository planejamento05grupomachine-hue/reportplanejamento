// Categoria de orçamentos do Dashboard do Prevision ("Custos do projeto (Principal)" × "Recebíveis do projeto").
// Descoberta em 11/11/2026: o seletor "Categoria de orçamentos" muda a base do Valor Agregado (198: custo R$ 10,70 mi ×
// recebíveis/valor de venda R$ 12,84 mi). Regra do Carlos: empreitada global (198, 208) → Recebíveis; administração
// (207) → Custos. A configuração é por obra: `exportacao.financeiro.categoria` em sync/obras.json (sem o campo, o robô
// não mexe na categoria do Dashboard).
// Funções puras (sem navegador): usadas pela exportação, pela escolha da fonte e pelos testes.
'use strict';

const CATEGORIA_PADRAO = 'Custos do projeto (Principal)';
const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

// Categoria pedida para o financeiro da obra (texto da opção na tela) ou null quando a obra não pede nenhuma
function categoriaPedida(obra) {
  const c = obra && obra.exportacao && obra.exportacao.financeiro && obra.exportacao.financeiro.categoria;
  return typeof c === 'string' && c.trim() ? c.trim() : null;
}
const mesmaCategoria = (a, b) => norm(a) === norm(b);
// Fora da categoria principal, a API oficial não serve (ela só entrega a categoria principal — ver README)
const exigeInterface = obra => { const c = categoriaPedida(obra); return !!c && !mesmaCategoria(c, CATEGORIA_PADRAO); };

// Texto do seletor (rótulo + valor) → valor escolhido; null se não der para separar
function valorDoSeletor(texto) {
  const linhas = String(texto || '').split('\n').map(s => s.trim()).filter(s => s && !/^categoria de or[cç]amentos?$/i.test(norm(s)) && !/^(arrow_drop_down|expand_more)$/i.test(s));
  return linhas[0] || null;
}

// "R$ 12.840.711,39" → 12840711.39 (null se não for número)
function numeroBR(s) {
  const m = String(s || '').match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, '').replace(',', '.'));
  return isFinite(n) ? n : null;
}

module.exports = { CATEGORIA_PADRAO, norm, categoriaPedida, mesmaCategoria, exigeInterface, valorDoSeletor, numeroBR };
