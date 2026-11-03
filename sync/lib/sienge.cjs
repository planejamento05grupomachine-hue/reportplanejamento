// Sienge (API REST oficial) — somente leitura.
// Endereço: https://api.sienge.com.br/{subdominio}/public/api/v1/... e /public/api/bulk-data/v1/...
// Autenticação Basic com o usuário de API cadastrado no Painel de Integrações do Sienge (não é um usuário de pessoa).
// Variáveis: SIENGE_SUBDOMINIO, SIENGE_USUARIO, SIENGE_SENHA.
'use strict';
const { SomenteLeitura } = require('./somente-leitura.cjs');

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });

// Recursos que a automação pretende ler. A lista serve ao diagnóstico (quais o usuário da API alcança) e à
// documentação do que liberar no Sienge. Ver sync/README.md → Fontes externas.
const RECURSOS = [
  { id: 'obras', caminho: 'v1/enterprises', uso: 'lista de obras/empreendimentos para o vínculo com o painel' },
  { id: 'solicitacoes', caminho: 'v1/purchase-requests', uso: 'solicitações de compra por obra (restrições de Material/Contratação)' },
  { id: 'pedidos', caminho: 'v1/purchase-orders', uso: 'pedidos de compra por obra e situação de entrega' },
  { id: 'contratos', caminho: 'v1/supply-contracts', uso: 'contratos de suprimentos/serviços por obra' },
  { id: 'medicoesContratos', caminho: 'v1/supply-contracts/measurements', uso: 'medições dos contratos de suprimentos' },
  { id: 'notasCompra', caminho: 'v1/purchase-invoices', uso: 'notas fiscais de compra e apropriação por obra (custo realizado)' },
  { id: 'aPagar', caminho: 'bulk-data/v1/outcome', uso: 'parcelas a pagar e pagas por centro de custo (custo realizado)', exige: 'período' },
  { id: 'orcamento', caminho: 'v1/building-cost-estimations/{obra}/sheets', uso: 'orçamento da obra (planilhas)', porObra: true },
  { id: 'medicaoObra', caminho: 'v1/building-projects/{obra}/progress-logs', uso: 'medições de avanço da obra no Sienge', porObra: true },
];

function deAmbiente(env = process.env, opts = {}) {
  const { SIENGE_SUBDOMINIO: sub, SIENGE_USUARIO: usuario, SIENGE_SENHA: senha } = env;
  if (!sub && !usuario && !senha) return null; // não configurado: a rotina segue sem o Sienge
  if (!sub || !usuario || !senha) throw erro('Sienge: faltam SIENGE_SUBDOMINIO, SIENGE_USUARIO ou SIENGE_SENHA.', 'CONFIG_SIENGE');
  if (!/^[a-z0-9-]+$/i.test(sub)) throw erro('Sienge: SIENGE_SUBDOMINIO deve ser só o nome da empresa na URL (ex.: machine).', 'CONFIG_SIENGE');
  return new Sienge({ subdominio: sub, usuario, senha, ...opts });
}

class Sienge {
  constructor({ subdominio, usuario, senha, fetch }) {
    const auth = 'Basic ' + Buffer.from(`${usuario}:${senha}`).toString('base64');
    this.http = new SomenteLeitura({ nome: 'Sienge', base: `https://api.sienge.com.br/${subdominio}/public/api`, cabecalhos: { Authorization: auth }, fetch, prefixoCodigo: 'SIENGE' });
  }
  get(caminho, query) { return this.http.get(caminho, query); }
  // Listas do Sienge vêm como { resultSetMetadata: { count, offset, limit }, results: [...] }; pagina por offset/limit
  async todos(caminho, query = {}, { limite = 200, maxPaginas = 50 } = {}) {
    const out = [];
    for (let p = 0, offset = 0; p < maxPaginas; p++) {
      const r = await this.get(caminho, { ...query, limit: limite, offset });
      const itens = Array.isArray(r) ? r : (r && (r.results || r.data)) || [];
      out.push(...itens);
      const total = r && r.resultSetMetadata && r.resultSetMetadata.count;
      offset += itens.length;
      if (!itens.length || itens.length < limite || (total !== undefined && offset >= total) || Array.isArray(r)) break;
    }
    return out;
  }
}

module.exports = { Sienge, deAmbiente, RECURSOS };
