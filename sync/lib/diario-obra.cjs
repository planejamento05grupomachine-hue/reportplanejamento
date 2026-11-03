// Diário de Obra (web.diariodeobra.app) — API externa oficial, somente leitura.
// Endereço: https://apiexterna.diariodeobra.app/v1/... · autenticação pelo cabeçalho "token" (gerado na conta da empresa).
// Rotas usadas: v1/obras · v1/obras/{id}/relatorios?limite=&ordem= · v1/obras/{id}/relatorios/{relatorio}
// Variável: DIARIO_TOKEN.
'use strict';
const { SomenteLeitura } = require('./somente-leitura.cjs');

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });

function deAmbiente(env = process.env, opts = {}) {
  if (!env.DIARIO_TOKEN) return null; // não configurado: a rotina segue com os RDOs em PDF pela tela Alimentar
  return new DiarioObra({ token: env.DIARIO_TOKEN, ...opts });
}

class DiarioObra {
  constructor({ token, fetch }) {
    if (!token) throw erro('Diário de Obra: falta o DIARIO_TOKEN.', 'CONFIG_DIARIO');
    this.http = new SomenteLeitura({ nome: 'Diário de Obra', base: 'https://apiexterna.diariodeobra.app', cabecalhos: { token }, fetch, prefixoCodigo: 'DIARIO' });
  }
  empresa() { return this.http.get('v1/empresa'); }
  obras() { return this.http.get('v1/obras'); }
  obra(id) { return this.http.get(`v1/obras/${encodeURIComponent(id)}`); }
  relatorios(id, { limite = 50, ordem = 'desc' } = {}) { return this.http.get(`v1/obras/${encodeURIComponent(id)}/relatorios`, { limite, ordem }); }
  relatorio(id, relatorioId) { return this.http.get(`v1/obras/${encodeURIComponent(id)}/relatorios/${encodeURIComponent(relatorioId)}`); }
}
// Lista de obras pode vir como array ou dentro de um objeto ({ obras: [...] } / { data: [...] })
const lista = r => Array.isArray(r) ? r : (r && (r.obras || r.data || r.results || r.relatorios || r.items)) || [];

module.exports = { DiarioObra, deAmbiente, lista };
