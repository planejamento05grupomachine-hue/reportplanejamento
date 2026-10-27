// Leitura e gravação no repositório pela API REST do GitHub (o mesmo caminho da gravação manual do painel).
// A gravação é condicional: só acontece se os arquivos da obra continuam iguais aos lidos no início da coleta.
'use strict';

const erro = (msg, codigo, extra) => Object.assign(new Error(msg), { codigo }, extra);
const espera = ms => new Promise(r => setTimeout(r, ms));
const b64 = u8 => Buffer.from(u8).toString('base64');

class GitHub {
  constructor({ token, owner, repo, branch = null, fetch = globalThis.fetch, tentativas = 3, timeoutMs = 30000, pausaMs = 2000 }) {
    if (!token) throw erro('Falta o token do GitHub (PAINEL_GH_TOKEN).', 'SEM_TOKEN_GITHUB');
    Object.assign(this, { token, owner, repo, branch, fetch, tentativas, timeoutMs, pausaMs });
  }

  async req(metodo, caminho, corpo) {
    let ultimo;
    for (let t = 0; t < this.tentativas; t++) {
      let r;
      try {
        r = await this.fetch('https://api.github.com' + caminho, {
          method: metodo,
          headers: { Authorization: 'Bearer ' + this.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'painel-sync-prevision', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
          body: corpo ? JSON.stringify(corpo) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) { ultimo = erro(`Falha de rede com o GitHub (${e.name}).`, 'REDE_GITHUB'); await espera(this.pausaMs * (t + 1)); continue; }
      if (r.ok) return r.status === 204 ? null : r.json();
      let m = ''; try { m = (await r.json()).message || ''; } catch (e) { /* sem corpo */ }
      if (r.status === 401) throw erro('O token do GitHub é inválido ou expirou.', 'TOKEN_GITHUB');
      if (r.status === 403 && !/rate limit/i.test(m)) throw erro('O token do GitHub não tem permissão neste repositório (Contents: Read and write).', 'PERMISSAO_GITHUB');
      if (r.status === 404) throw erro(`GitHub: não encontrado (${caminho.split('?')[0]}).`, 'NAO_ENCONTRADO');
      if (r.status === 409 || r.status === 422) throw erro(`O repositório mudou durante a gravação${m ? ` (${m})` : ''}.`, 'CONFLITO');
      ultimo = erro(`GitHub respondeu ${r.status}${m ? ': ' + m : ''}.`, 'GITHUB_' + r.status);
      if (r.status < 500 && r.status !== 429 && r.status !== 403) throw ultimo;
      await espera(this.pausaMs * (t + 1));
    }
    throw ultimo;
  }

  base() { return `/repos/${this.owner}/${this.repo}`; }
  async verificar() {
    const info = await this.req('GET', this.base());
    if (!info.permissions || !info.permissions.push) throw erro('O token do GitHub só lê o repositório; precisa de Contents: Read and write.', 'PERMISSAO_GITHUB');
    this.branch = this.branch || info.default_branch;
    return { repo: info.full_name, branch: this.branch };
  }
  async head() {
    if (!this.branch) await this.verificar();
    return (await this.req('GET', `${this.base()}/git/ref/heads/${encodeURIComponent(this.branch)}`)).object.sha;
  }
  // caminho → sha do blob, na versão do commit
  async arvore(commitSha) {
    const c = await this.req('GET', `${this.base()}/git/commits/${commitSha}`);
    const t = await this.req('GET', `${this.base()}/git/trees/${c.tree.sha}?recursive=1`);
    if (t.truncated) throw erro('Repositório grande demais para listar a árvore inteira.', 'ARVORE_TRUNCADA');
    return { treeSha: c.tree.sha, blobs: new Map(t.tree.filter(e => e.type === 'blob').map(e => [e.path, e.sha])) };
  }
  async blob(sha) {
    const b = await this.req('GET', `${this.base()}/git/blobs/${sha}`);
    return new Uint8Array(Buffer.from(b.content, 'base64'));
  }
  // Retrato do repositório: commit, árvore e o conteúdo dos caminhos pedidos (null quando não existem)
  async retrato(caminhos) {
    const commit = await this.head();
    const { blobs } = await this.arvore(commit);
    const arquivos = {};
    for (const p of caminhos) arquivos[p] = blobs.has(p) ? { sha: blobs.get(p), bytes: await this.blob(blobs.get(p)) } : null;
    return { commit, blobs, arquivos };
  }

  // Grava `arquivos` ({caminho: Uint8Array}) num commit sobre a ponta atual da branch, desde que cada caminho de
  // `esperado` ({caminho: sha | null}) continue como estava no retrato. Senão: ALTERADO_DURANTE_COLETA, sem gravar.
  async commitCondicional({ esperado, arquivos, mensagem }) {
    for (let t = 0; t < 2; t++) {
      const headSha = await this.head();
      const { treeSha, blobs } = await this.arvore(headSha);
      const mudou = Object.entries(esperado).filter(([p, sha]) => (blobs.get(p) || null) !== (sha || null)).map(([p]) => p);
      if (mudou.length) throw erro(`Arquivos alterados depois do início da coleta: ${mudou.join(', ')}.`, 'ALTERADO_DURANTE_COLETA', { caminhos: mudou });
      const entradas = [];
      for (const [p, bytes] of Object.entries(arquivos)) {
        const bl = await this.req('POST', `${this.base()}/git/blobs`, { content: b64(bytes), encoding: 'base64' });
        entradas.push({ path: p, mode: '100644', type: 'blob', sha: bl.sha });
      }
      const arvore = await this.req('POST', `${this.base()}/git/trees`, { base_tree: treeSha, tree: entradas });
      const c = await this.req('POST', `${this.base()}/git/commits`, { message: mensagem, tree: arvore.sha, parents: [headSha] });
      try {
        await this.req('PATCH', `${this.base()}/git/refs/heads/${encodeURIComponent(this.branch)}`, { sha: c.sha, force: false });
        return { commit: c.sha, blobs: Object.fromEntries(entradas.map(e => [e.path, e.sha])) };
      } catch (e) { if (e.codigo !== 'CONFLITO' || t) throw e; }
    }
  }
}

module.exports = { GitHub };
