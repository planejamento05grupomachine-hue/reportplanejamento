// Cliente HTTP SOMENTE LEITURA para as fontes externas do painel (Sienge, Diário de Obra).
// Regra da automação: colher dados, nunca alterar nada nas ferramentas. Por isso este cliente só sabe fazer GET:
// qualquer outro método é recusado aqui, antes de sair da máquina, mesmo que o usuário da API tenha mais permissões.
// Credenciais só nos cabeçalhos; nunca em URL, log ou mensagem de erro.
'use strict';

const erro = (msg, codigo, extra) => Object.assign(new Error(msg), { codigo }, extra);
const espera = ms => new Promise(r => setTimeout(r, ms));

class SomenteLeitura {
  // nome: rótulo da fonte nas mensagens · base: URL até a raiz da API · cabecalhos: autenticação
  constructor({ nome, base, cabecalhos = {}, fetch = globalThis.fetch, tentativas = 3, timeoutMs = 30000, pausaMs = 1500, prefixoCodigo }) {
    if (!/^https:\/\//.test(base || '')) throw erro(`${nome}: endereço da API inválido.`, 'CONFIG_' + prefixoCodigo);
    Object.assign(this, { nome, base: base.replace(/\/+$/, ''), cabecalhos, fetch, tentativas, timeoutMs, pausaMs, prefixo: prefixoCodigo });
    this.chamadas = 0;
  }

  // Única porta de saída. metodo existe só para ser recusado com uma mensagem clara.
  async requisicao(metodo, caminho, query = {}) {
    if (String(metodo).toUpperCase() !== 'GET') throw erro(`${this.nome}: a automação é somente leitura; o método ${metodo} foi bloqueado.`, 'SOMENTE_LEITURA');
    const q = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)])).toString();
    const url = `${this.base}/${String(caminho).replace(/^\/+/, '')}${q ? '?' + q : ''}`;
    let ultimo;
    for (let t = 0; t < this.tentativas; t++) {
      let r;
      this.chamadas++;
      try {
        r = await this.fetch(url, { method: 'GET', headers: { Accept: 'application/json', 'User-Agent': 'painel-obras-machine-sync', ...this.cabecalhos }, signal: AbortSignal.timeout(this.timeoutMs) });
      } catch (e) { ultimo = erro(`${this.nome}: falha de rede (${e.name}).`, 'REDE_' + this.prefixo); await espera(this.pausaMs * (t + 1)); continue; }
      if (r.ok) {
        const txt = await r.text();
        try { return txt ? JSON.parse(txt) : null; } catch (e) { throw erro(`${this.nome}: a resposta de ${caminho.split('?')[0]} não é JSON.`, 'RESPOSTA_' + this.prefixo); }
      }
      if (r.status === 401) throw erro(`${this.nome}: credencial recusada (401). Confira usuário/senha ou token.`, 'CREDENCIAL_' + this.prefixo, { status: 401 });
      if (r.status === 403) throw erro(`${this.nome}: sem permissão para ${caminho.split('?')[0]} (403). Libere o recurso para o usuário da API.`, 'PERMISSAO_' + this.prefixo, { status: 403 });
      if (r.status === 404) throw erro(`${this.nome}: recurso não encontrado (${caminho.split('?')[0]}).`, 'NAO_ENCONTRADO_' + this.prefixo, { status: 404 });
      ultimo = erro(`${this.nome}: resposta ${r.status} em ${caminho.split('?')[0]}.`, `HTTP_${this.prefixo}_${r.status}`, { status: r.status });
      if (r.status < 500 && r.status !== 429) throw ultimo; // 400 (parâmetro faltando) não melhora tentando de novo
      await espera(this.pausaMs * (t + 1) * (r.status === 429 ? 3 : 1));
    }
    throw ultimo;
  }
  get(caminho, query) { return this.requisicao('GET', caminho, query); }
}

// Estrutura de uma resposta sem os valores: nomes dos campos e tipos (para calibrar a leitura sem expor dados no log)
function esqueleto(v, prof = 0) {
  if (prof > 5) return '…';
  if (Array.isArray(v)) return v.length ? [esqueleto(v[0], prof + 1)] : [];
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).slice(0, 40).map(k => [k, esqueleto(v[k], prof + 1)]));
  return v === null ? 'null' : typeof v;
}
// Código de obra Machine num nome: "208 - Fibrasa…", "Obra 211 SOTREQ", "… (obra 207)". Número solto ("Galpão 2026") não conta:
// é proposta de vínculo, confirmada à mão em sync/obras.json.
const codigoNoNome = s => { const t = String(s || '').trim(); const m = t.match(/^(\d{3,4})\s*[-–]/) || t.match(/\bobra\s*(\d{3,4})\b/i); return m ? m[1] : null; };

module.exports = { SomenteLeitura, esqueleto, codigoNoNome };
