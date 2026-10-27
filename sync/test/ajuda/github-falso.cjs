// GitHub em memória com os endpoints da API REST que a sincronização usa (git data API).
// Permite simular token vencido, falha no meio da gravação e alteração concorrente.
'use strict';
const crypto = require('crypto');

const sha1Blob = bytes => crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), Buffer.from(bytes)])).digest('hex');
const novoId = () => crypto.randomBytes(20).toString('hex');

class GitHubFalso {
  constructor({ owner = 'dono', repo = 'repo', token = 'tk-teste' } = {}) {
    Object.assign(this, { owner, repo, token });
    this.blobs = new Map(); this.trees = new Map(); this.commits = new Map();
    this.ganchos = []; this.chamadas = [];
    const t = novoId(); this.trees.set(t, new Map());
    const c = novoId(); this.commits.set(c, { tree: t, parents: [], message: 'inicial' });
    this.head = c;
  }
  // grava direto, como faria outra pessoa pelo painel
  escrever(arquivos, message = 'externo') {
    const arv = new Map(this.trees.get(this.commits.get(this.head).tree));
    for (const [p, bytes] of Object.entries(arquivos)) {
      if (bytes === null) { arv.delete(p); continue; }
      const sha = sha1Blob(bytes); this.blobs.set(sha, Buffer.from(bytes)); arv.set(p, sha);
    }
    const t = novoId(); this.trees.set(t, arv);
    const c = novoId(); this.commits.set(c, { tree: t, parents: [this.head], message });
    this.head = c; return c;
  }
  ler(p, commit = this.head) { const sha = this.trees.get(this.commits.get(commit).tree).get(p); return sha ? new Uint8Array(this.blobs.get(sha)) : null; }
  shaDe(p, commit = this.head) { return this.trees.get(this.commits.get(commit).tree).get(p) || null; }
  historico() { const out = []; let c = this.head; while (c) { const x = this.commits.get(c); out.push({ sha: c, message: x.message }); c = x.parents[0]; } return out; }
  // gancho(metodo, caminho, corpo) → Response | undefined
  quando(fn) { this.ganchos.push(fn); }

  get fetch() {
    return async (url, init = {}) => {
      const metodo = init.method || 'GET';
      const u = new URL(url); const caminho = u.pathname; const corpo = init.body ? JSON.parse(init.body) : null;
      this.chamadas.push(`${metodo} ${caminho}`);
      for (const g of this.ganchos) { const r = await g(metodo, caminho, corpo); if (r) return r; }
      if ((init.headers || {}).Authorization !== 'Bearer ' + this.token) return json(401, { message: 'Bad credentials' });
      const base = `/repos/${this.owner}/${this.repo}`;
      if (metodo === 'GET' && caminho === base) return json(200, { full_name: `${this.owner}/${this.repo}`, default_branch: 'main', permissions: { push: true } });
      if (metodo === 'GET' && caminho === `${base}/git/ref/heads/main`) return json(200, { object: { sha: this.head } });
      let m;
      if (metodo === 'GET' && (m = caminho.match(/\/git\/commits\/(\w+)$/))) { const c = this.commits.get(m[1]); return c ? json(200, { sha: m[1], tree: { sha: c.tree } }) : json(404, {}); }
      if (metodo === 'GET' && (m = caminho.match(/\/git\/trees\/(\w+)$/))) { const t = this.trees.get(m[1]); return json(200, { truncated: false, tree: [...t].map(([path, sha]) => ({ path, sha, type: 'blob', mode: '100644' })) }); }
      if (metodo === 'GET' && (m = caminho.match(/\/git\/blobs\/(\w+)$/))) { const b = this.blobs.get(m[1]); return b ? json(200, { content: b.toString('base64'), encoding: 'base64' }) : json(404, {}); }
      if (metodo === 'POST' && caminho === `${base}/git/blobs`) { const bytes = Buffer.from(corpo.content, 'base64'); const sha = sha1Blob(bytes); this.blobs.set(sha, bytes); return json(201, { sha }); }
      if (metodo === 'POST' && caminho === `${base}/git/trees`) { const arv = new Map(corpo.base_tree ? this.trees.get(corpo.base_tree) : []); for (const e of corpo.tree) arv.set(e.path, e.sha); const t = novoId(); this.trees.set(t, arv); return json(201, { sha: t }); }
      if (metodo === 'POST' && caminho === `${base}/git/commits`) { const c = novoId(); this.commits.set(c, { tree: corpo.tree, parents: corpo.parents, message: corpo.message }); return json(201, { sha: c }); }
      if (metodo === 'PATCH' && caminho === `${base}/git/refs/heads/main`) {
        const c = this.commits.get(corpo.sha);
        if (!corpo.force && c.parents[0] !== this.head) return json(422, { message: 'Update is not a fast forward' });
        this.head = corpo.sha; return json(200, { object: { sha: corpo.sha } });
      }
      return json(404, { message: 'não simulado: ' + caminho });
    };
  }
}

function json(status, obj) { return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } }); }

module.exports = { GitHubFalso, json };
