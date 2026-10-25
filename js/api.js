// ============================================================
// Painel de Obras Machine — cofre de dados e publicação no GitHub.
//
// O site é estático (GitHub Pages) e o repositório é público, então nada sai em claro:
//   data/acesso.json            chaveiros dos usuários (sem nomes nem e-mails em claro)
//   data/diretorio.bin          cadastro de usuários e chaves das obras  (chave-mestra, só administradores)
//   data/obras/<id>.bin         posição publicada da obra               (chave da obra: equipe interna + clientes da obra)
//   data/obras/<id>.rascunho.bin  carga ainda não publicada              (chave interna: administradores e diretoria)
//   data/fotos/<id>.bin / .rascunho.bin   fotos dos RDOs, com a mesma regra
// Cifra AES-256-GCM; a senha de cada pessoa vira chave por PBKDF2-SHA256 (600 mil iterações).
// Cada pessoa tem uma chave própria (UK), guardada duas vezes: cifrada pela senha dela e pela chave-mestra
// (assim o administrador refaz o chaveiro de qualquer um sem conhecer a senha).
// Gravação: commits pela API do GitHub com o token do administrador (fica só no navegador dele).
// ============================================================
(function () {
  'use strict';
  const CFG = window.MP_CONFIG || {};
  const ITER = CFG.iteracoes || 600000;
  const subtle = crypto.subtle;
  const te = new TextEncoder(), td = new TextDecoder();

  // ---------- utilidades ----------
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const aleatorio = n => crypto.getRandomValues(new Uint8Array(n));
  const hoje = () => new Date().toISOString().slice(0, 10);
  const agora = () => new Date().toISOString();
  const clone = x => JSON.parse(JSON.stringify(x));
  const idSeguro = s => String(s || '').trim().replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const temDados = o => !!(o && o.curva && o.curva.length && o.tarefas && o.tarefas.length);
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* sem armazenamento */ } };
  const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });

  // ---------- criptografia ----------
  const importar = raw => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function cifrar(chave, bytes) {
    const k = chave instanceof CryptoKey ? chave : await importar(chave);
    const iv = aleatorio(12);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
  }
  async function decifrar(chave, buf) {
    const k = chave instanceof CryptoKey ? chave : await importar(chave);
    const u = new Uint8Array(buf);
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, k, u.subarray(12)));
  }
  async function chaveDaSenha(senha, salt, iter) {
    const base = await subtle.importKey('raw', te.encode(String(senha).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function idDoEmail(email) {
    const h = new Uint8Array(await subtle.digest('SHA-256', te.encode('mp-painel|' + String(email).trim().toLowerCase())));
    return [...h.subarray(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // senha gerada: 12 caracteres sem ambíguos, em 3 blocos de 4 — 60 bits
  function gerarSenha() {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 símbolos, sem 0/O e 1/I
    const r = aleatorio(12); let s = '';
    for (let i = 0; i < 12; i++) { s += A[r[i] % 32]; if (i === 3 || i === 7) s += '-'; }
    return s;
  }

  // ---------- empacotamento ----------
  // byte 1 = JSON comprimido (gzip) · 2 = JSON puro · 3 = pacote de fotos
  async function gzip(bytes, modo) {
    const s = new Blob([bytes]).stream().pipeThrough(modo === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function empacotarJSON(obj) {
    const raw = te.encode(JSON.stringify(obj));
    const ok = typeof CompressionStream !== 'undefined';
    const corpo = ok ? await gzip(raw, 'c') : raw;
    const out = new Uint8Array(corpo.length + 1); out[0] = ok ? 1 : 2; out.set(corpo, 1); return out;
  }
  async function desempacotarJSON(u8) {
    if (u8[0] === 1) return JSON.parse(td.decode(await gzip(u8.subarray(1), 'd')));
    if (u8[0] === 2) return JSON.parse(td.decode(u8.subarray(1)));
    throw erro('Formato de arquivo desconhecido.');
  }
  function empacotarFotos(fotos) {
    const meta = fotos.map(f => { const { bytes, src, ...m } = f; return { ...m, tam: bytes.length }; });
    const cab = te.encode(JSON.stringify(meta));
    const total = 5 + cab.length + fotos.reduce((s, f) => s + f.bytes.length, 0);
    const out = new Uint8Array(total); out[0] = 3;
    new DataView(out.buffer).setUint32(1, cab.length); out.set(cab, 5);
    let p = 5 + cab.length; for (const f of fotos) { out.set(f.bytes, p); p += f.bytes.length; }
    return out;
  }
  function desempacotarFotos(u8) {
    if (u8[0] !== 3) throw erro('Pacote de fotos inválido.');
    const n = new DataView(u8.buffer, u8.byteOffset).getUint32(1);
    const meta = JSON.parse(td.decode(u8.subarray(5, 5 + n)));
    let p = 5 + n;
    return meta.map(m => { const { tam, ...f } = m; const bytes = u8.slice(p, p + tam); p += tam; return comSrc({ ...f, bytes }); });
  }
  const idFoto = f => f.id || `r${f.rdo}-${String(f.idx).padStart(2, '0')}`;
  function comSrc(f) { f.id = idFoto(f); f.src = URL.createObjectURL(new Blob([f.bytes], { type: 'image/jpeg' })); return f; }
  async function bytesDaFoto(src) {
    if (String(src).startsWith('data:')) return unb64(src.split(',')[1]);
    const r = await fetch(src); if (!r.ok) throw erro('Não consegui ler a foto ' + src); return new Uint8Array(await r.arrayBuffer());
  }

  // ---------- GitHub ----------
  const GHCFG = CFG.github || {};
  const GH = {
    get token() { return ssGet('mp_gh') || lsGet('mp_gh'); },
    temToken() { return !!this.token; },
    definirToken(t, lembrar) { ssSet('mp_gh', null); lsSet('mp_gh', null); (lembrar ? lsSet : ssSet)('mp_gh', String(t).trim()); this._branch = null; },
    limparToken() { ssSet('mp_gh', null); lsSet('mp_gh', null); },
    async req(metodo, caminho, corpo, aceitar) {
      const r = await fetch('https://api.github.com' + caminho, {
        method: metodo, cache: 'no-store',
        headers: { Authorization: 'Bearer ' + this.token, Accept: aceitar || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
      if (r.status === 404 && aceitar) return null;
      if (!r.ok) {
        let m = ''; try { m = (await r.json()).message || ''; } catch (e) { /* sem corpo */ }
        if (r.status === 401) throw erro('O token do GitHub é inválido ou expirou. Gere um novo e informe em Publicação.', 'TOKEN');
        if (r.status === 403 || r.status === 404) throw erro('O token do GitHub não tem permissão de escrita neste repositório (Contents: Read and write).', 'TOKEN');
        if (r.status === 409 || r.status === 422) throw erro('O repositório mudou durante a gravação' + (m ? ` (${m})` : '') + '.', 'CONFLITO');
        throw erro(`GitHub respondeu ${r.status}${m ? ': ' + m : ''}.`);
      }
      return aceitar ? r.arrayBuffer() : r.status === 204 ? null : r.json();
    },
    repo() { return `/repos/${GHCFG.owner}/${GHCFG.repo}`; },
    async verificar() {
      if (!this.token) throw erro('Informe o token do GitHub.', 'SEM_TOKEN');
      const info = await this.req('GET', this.repo());
      if (!info.permissions || !info.permissions.push) throw erro('Este token só lê o repositório. Ele precisa de Contents: Read and write.', 'TOKEN');
      this._branch = GHCFG.branch || info.default_branch;
      return { repo: info.full_name, branch: this._branch };
    },
    async branch() { if (!this._branch) await this.verificar(); return this._branch; },
    async head() { const b = await this.branch(); return (await this.req('GET', `${this.repo()}/git/ref/heads/${encodeURIComponent(b)}`)).object.sha; },
    async ler(caminho, ref) {
      return this.req('GET', `${this.repo()}/contents/${caminho.split('/').map(encodeURIComponent).join('/')}?ref=${ref}`, null, 'application/vnd.github.raw');
    },
    // arquivos: { caminho: Uint8Array | string | null (apagar) }
    async commit(arquivos, mensagem, { orfao = false, apagarPrefixos = [], progresso } = {}) {
      const b = await this.branch();
      const lista = Object.entries(arquivos);
      const novos = lista.filter(([, c]) => c != null);
      const apagar = new Set(lista.filter(([, c]) => c == null).map(([p]) => p));
      // blobs (4 por vez)
      const entradas = [];
      for (let i = 0; i < novos.length; i += 4) {
        if (progresso) progresso(`Enviando arquivos ao GitHub (${Math.min(i + 4, novos.length)} de ${novos.length})…`);
        const lote = await Promise.all(novos.slice(i, i + 4).map(async ([p, c]) => {
          const bytes = typeof c === 'string' ? te.encode(c) : c;
          const bl = await this.req('POST', `${this.repo()}/git/blobs`, { content: b64(bytes), encoding: 'base64' });
          return { path: p, mode: '100644', type: 'blob', sha: bl.sha };
        }));
        entradas.push(...lote);
      }
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const headSha = await this.head();
        const head = await this.req('GET', `${this.repo()}/git/commits/${headSha}`);
        let arvore;
        if (orfao || apagar.size || apagarPrefixos.length) {
          const t = await this.req('GET', `${this.repo()}/git/trees/${head.tree.sha}?recursive=1`);
          if (t.truncated) throw erro('Repositório grande demais para regravar a árvore inteira.');
          const ja = new Set(entradas.map(e => e.path));
          const manter = t.tree.filter(e => e.type === 'blob' && !ja.has(e.path) && !apagar.has(e.path) && !apagarPrefixos.some(px => e.path.startsWith(px)))
            .map(e => ({ path: e.path, mode: e.mode, type: 'blob', sha: e.sha }));
          arvore = await this.req('POST', `${this.repo()}/git/trees`, { tree: manter.concat(entradas) });
        } else {
          arvore = await this.req('POST', `${this.repo()}/git/trees`, { base_tree: head.tree.sha, tree: entradas });
        }
        const c = await this.req('POST', `${this.repo()}/git/commits`, { message: mensagem, tree: arvore.sha, parents: orfao ? [] : [headSha] });
        try {
          await this.req('PATCH', `${this.repo()}/git/refs/heads/${encodeURIComponent(b)}`, { sha: c.sha, force: !!orfao });
          return c.sha;
        } catch (e) { if (e.codigo !== 'CONFLITO' || tentativa) throw e; }
      }
    },
  };

  // ---------- leitura dos arquivos publicados ----------
  // Com token: lê do GitHub na versão exata do último commit (sem esperar o Pages atualizar).
  // Sem token: lê do próprio site.
  let refAtual = null;
  async function ler(caminho) {
    if (GH.temToken()) {
      try { if (!refAtual) refAtual = await GH.head(); return await GH.ler(caminho, refAtual); }
      catch (e) { if (e.codigo !== 'TOKEN') throw e; /* token ruim: cai para o site */ }
    }
    const r = await fetch(caminho + '?t=' + Date.now(), { cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw erro(`Não consegui ler ${caminho} (${r.status}).`);
    return r.arrayBuffer();
  }
  async function lerJSON(caminho) { const b = await ler(caminho); return b ? JSON.parse(td.decode(b)) : null; }
  async function lerCifrado(caminho, chave) { const b = await ler(caminho); return b ? desempacotarJSON(await decifrar(chave, b)) : null; }
  async function lerFotos(caminho, chave) { const b = await ler(caminho); return b ? desempacotarFotos(await decifrar(chave, b)) : null; }

  const P = {
    acesso: 'data/acesso.json', dir: 'data/diretorio.bin',
    obra: id => `data/obras/${id}.bin`, ras: id => `data/obras/${id}.rascunho.bin`,
    fotos: id => `data/fotos/${id}.bin`, fotosRas: id => `data/fotos/${id}.rascunho.bin`,
  };

  // ---------- estado da sessão ----------
  let ACESSO = null;        // data/acesso.json
  let CH = null;            // chaveiro da pessoa logada (chaves em base64)
  let DIR = null;           // diretório (só administrador): { usuarios, chaves, ki }
  let MK = null;            // chave-mestra (só administrador)
  const OB = {};            // id → { pub, ras, fotos: { pub, ras } } (fotos: null = não carregadas; [] = sem fotos)
  const chave = s => unb64(s);
  const ehInterno = () => !!(CH && CH.ki);
  const ehAdmin = () => !!(CH && CH.mk);

  function usuarioDaSessao() { return CH ? { id: CH.uid, nome: CH.nome, email: CH.email, perfil: CH.perfil } : null; }
  function guardarSessao() { ssSet('mp_sessao', CH ? JSON.stringify(CH) : null); }

  async function abrirDiretorio() {
    if (!CH || !CH.mk) { DIR = null; MK = null; return; }
    MK = chave(CH.mk);
    DIR = await lerCifrado(P.dir, MK);
    if (!DIR) throw erro('Diretório de acessos não encontrado.');
  }

  // ---------- chaveiros ----------
  function chaveiroDe(uid) {
    const u = DIR.usuarios[uid]; const interno = u.perfil !== 'cliente';
    const obras = Object.fromEntries(Object.entries(DIR.chaves).filter(([id]) => interno || (u.obras || []).includes(id)));
    const c = { uid, nome: u.nome, email: u.email, perfil: u.perfil, obras };
    if (interno) c.ki = DIR.ki;
    if (u.perfil === 'admin') c.mk = b64(MK);
    return c;
  }
  async function ukDe(uid, mk = MK) { return decifrar(mk, unb64(ACESSO.usuarios[uid].a)); }
  async function gravarChaveiro(uid, uk) {
    ACESSO.usuarios[uid].c = b64(await cifrar(uk || await ukDe(uid), te.encode(JSON.stringify(chaveiroDe(uid)))));
  }
  async function regravarChaveiros() { for (const uid of Object.keys(ACESSO.usuarios)) await gravarChaveiro(uid); }
  async function novaEntrada(uid, senha) {
    const uk = aleatorio(32), s = aleatorio(16);
    const pk = await chaveDaSenha(senha, s, ITER);
    ACESSO.usuarios[uid] = { s: b64(s), i: ITER, p: b64(await cifrar(pk, uk)), a: b64(await cifrar(MK, uk)), c: '' };
    await gravarChaveiro(uid, uk);
  }
  async function redefinirEntrada(uid, senha) {
    const uk = await ukDe(uid), s = aleatorio(16);
    const pk = await chaveDaSenha(senha, s, ITER);
    Object.assign(ACESSO.usuarios[uid], { s: b64(s), i: ITER, p: b64(await cifrar(pk, uk)) });
  }
  // depois de qualquer mudança no diretório, o chaveiro de quem está logado acompanha
  function atualizarMinhaSessao() { if (DIR && CH && DIR.usuarios[CH.uid]) { CH = chaveiroDe(CH.uid); guardarSessao(); } }

  // ---------- arquivos de saída ----------
  const textoAcesso = () => JSON.stringify({ ...ACESSO, atualizadoEm: agora() }, null, 1);
  const arqDir = async () => cifrar(MK, await empacotarJSON(DIR));
  const arqObra = async (id, obj) => cifrar(chave(DIR.chaves[id]), await empacotarJSON(obj));
  const arqRas = async obj => cifrar(chave(DIR.ki), await empacotarJSON(obj));
  const arqFotos = async (k, fotos) => cifrar(k, empacotarFotos(fotos));

  // ---------- fila de gravação (um commit por vez) ----------
  let fila = Promise.resolve();
  function gravar(fn) {
    const p = fila.then(async () => {
      if (!ehAdmin()) throw erro('Só o administrador grava alterações.');
      if (!GH.temToken()) throw erro('Para publicar, informe o token do GitHub.', 'SEM_TOKEN');
      await sincronizar();
      return fn();
    });
    fila = p.catch(() => {});
    return p;
  }
  // Antes de gravar: se o repositório mudou desde a última leitura (outra aba, outro computador, ou dados
  // lidos do site antes de o Pages atualizar), relê tudo na versão atual para não sobrescrever nada.
  let mudouFora = false;
  async function sincronizar() {
    const h = await GH.head();
    if (h === refAtual) return;
    refAtual = h;
    ACESSO = await lerJSON(P.acesso);
    try { DIR = await lerCifrado(P.dir, MK); } catch (e) { throw erro('As chaves do painel foram trocadas em outra sessão. Saia e entre novamente.'); }
    if (!DIR || !ACESSO || !ACESSO.usuarios[CH.uid]) throw erro('Seu acesso foi alterado em outra sessão. Saia e entre novamente.');
    atualizarMinhaSessao();
    for (const id of Object.keys(OB)) { if (!DIR.chaves[id]) { revogarUrls(OB[id]); delete OB[id]; } }
    await Promise.all(Object.keys(DIR.chaves).map(carregarObra));
    mudouFora = true;
  }
  async function commit(arquivos, msg, opts) { const sha = await GH.commit(arquivos, msg, opts); refAtual = sha; return sha; }

  // ---------- obras para o app ----------
  function fotosVigentes(id) {
    const e = OB[id]; if (!e) return null;
    if (ehInterno() && e.ras && e.ras.fotosProprias) return e.fotos.ras;
    return e.fotos.pub;
  }
  function paraApp(id) {
    const e = OB[id]; const ras = ehInterno() ? e.ras : null; const pub = e.pub || {};
    const base = ras || pub;
    const o = clone(base);
    o.id = id;
    const fotos = fotosVigentes(id);
    o.fotos = fotos || [];
    o.fotosPendentes = fotos === null && (ras ? (ras.fotosProprias ? ras.nFotos : pub.nFotos) : pub.nFotos) > 0;
    o.destaques = base.destaques || [];
    o.publicadoAte = temDados(pub) ? pub.dataCorte : null;
    o.publicadoEm = pub.publicadoEm || null;
    o.publicado = !ras && temDados(pub);
    o.cargaId = ehInterno() && temDados(base) ? (ras ? 'rascunho' : 'publicado') : null;
    if (!temDados(base)) o.semDados = true;
    return o;
  }
  function ordenar(ids) { return ids.sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true })); }

  async function carregarObra(id) {
    const k = CH.obras[id]; if (!k) return;
    const pub = await lerCifrado(P.obra(id), chave(k));
    const ras = ehInterno() ? await lerCifrado(P.ras(id), chave(CH.ki)) : null;
    const antes = OB[id];
    OB[id] = { pub, ras, fotos: { pub: null, ras: null } };
    if (antes) revogarUrls(antes);
  }
  function revogarUrls(e) { for (const l of [e.fotos.pub, e.fotos.ras]) (l || []).forEach(f => { try { URL.revokeObjectURL(f.src); } catch (x) { /* ok */ } }); }

  async function garantirFotos(id, qual) {
    const e = OB[id];
    if (qual === 'ras') { if (e.fotos.ras === null) e.fotos.ras = e.ras && e.ras.fotosProprias ? (await lerFotos(P.fotosRas(id), chave(CH.ki))) || [] : []; return e.fotos.ras; }
    if (e.fotos.pub === null) e.fotos.pub = e.pub && e.pub.nFotos ? (await lerFotos(P.fotos(id), chave(CH.obras[id]))) || [] : [];
    return e.fotos.pub;
  }

  // ---------- API usada pelo app ----------
  const API = {
    ativo: true,
    gerarSenha,
    emailAcesso: CFG.emailAcesso,
    github: {
      temToken: () => GH.temToken(),
      lembrado: () => !!lsGet('mp_gh'),
      async definir(token, lembrar) { GH.definirToken(token, lembrar); try { const r = await GH.verificar(); refAtual = null; return r; } catch (e) { GH.limparToken(); throw e; } },
      limpar() { GH.limparToken(); refAtual = null; },
      repo: () => `${GHCFG.owner}/${GHCFG.repo}`,
    },

    // 'configurar' quando o painel ainda não tem acessos; 'login' nos demais casos
    async estado() {
      ACESSO = await lerJSON(P.acesso);
      return ACESSO && ACESSO.usuarios && Object.keys(ACESSO.usuarios).length ? 'login' : 'configurar';
    },

    async entrar(email, senha) {
      if (!ACESSO) ACESSO = await lerJSON(P.acesso);
      const falha = () => erro('E-mail ou senha não conferem. Se você ainda não tem acesso, solicite abaixo.');
      const uid = await idDoEmail(email);
      const e = ACESSO && ACESSO.usuarios[uid];
      if (!e) { await chaveDaSenha(senha, aleatorio(16), ITER); throw falha(); } // mesmo tempo de resposta
      let uk;
      try { uk = await decifrar(await chaveDaSenha(senha, unb64(e.s), e.i || ITER), unb64(e.p)); } catch (x) { throw falha(); }
      CH = JSON.parse(td.decode(await decifrar(uk, unb64(e.c))));
      guardarSessao();
      await abrirDiretorio();
      return usuarioDaSessao();
    },
    async sessao() {
      const s = ssGet('mp_sessao'); if (!s) return null;
      try { CH = JSON.parse(s); if (!ACESSO) ACESSO = await lerJSON(P.acesso); await abrirDiretorio(); return usuarioDaSessao(); }
      catch (e) { CH = null; guardarSessao(); return null; }
    },
    sair() { CH = null; DIR = null; MK = null; Object.keys(OB).forEach(id => { revogarUrls(OB[id]); delete OB[id]; }); guardarSessao(); },

    async carregarObras() {
      if (!CH) return [];
      const ids = ordenar(Object.keys(CH.obras));
      try { await Promise.all(ids.map(carregarObra)); }
      catch (e) { if (e.name === 'OperationError') { API.sair(); throw erro('Seu acesso foi atualizado. Entre novamente com a sua senha.'); } throw e; }
      return ids.filter(id => OB[id] && OB[id].pub).map(paraApp);
    },
    async carregarFotos(id) {
      const e = OB[id]; if (!e) return [];
      return garantirFotos(id, ehInterno() && e.ras && e.ras.fotosProprias ? 'ras' : 'pub');
    },
    obra: id => OB[id] ? paraApp(id) : null,
    // obras já carregadas (depois de gravar, sem reler do servidor)
    listar: () => ordenar(Object.keys(OB)).filter(id => OB[id].pub).map(paraApp),
    usuario: usuarioDaSessao,

    // ----- obras -----
    salvarObra(d) {
      return gravar(async () => {
        const id = idSeguro(d.id || d.codigo);
        if (!id) throw erro('Código da obra inválido.');
        const novo = !DIR.chaves[id];
        if (novo && d.novo === false) throw erro('Obra não encontrada.');
        if (!novo && d.novo) throw erro(`Já existe a obra ${id}.`);
        const meta = {
          codigo: String(d.codigo || id).trim(), nome: d.nome, cliente: d.cliente || '', contratante: d.contratante || '', cidade: d.cidade || '',
          contrato: d.contrato || '', local: d.local || '', responsavel: d.responsavel || '',
          prazoContratual: d.prazo_inicio && d.prazo_fim ? { inicio: d.prazo_inicio, fim: d.prazo_fim, dias: d.prazo_dias } : (d.prazo_inicio || d.prazo_fim ? { inicio: d.prazo_inicio, fim: d.prazo_fim, dias: null } : null),
        };
        const arq = {};
        if (novo) {
          DIR.chaves[id] = b64(aleatorio(32));
          const pub = { id, ...meta, criadoEm: agora(), nFotos: 0 };
          OB[id] = { pub, ras: null, fotos: { pub: [], ras: null } };
          arq[P.obra(id)] = await arqObra(id, pub);
          await regravarChaveiros();
          arq[P.dir] = await arqDir();
          arq[P.acesso] = textoAcesso();
        } else {
          const e = OB[id];
          e.pub = { ...e.pub, ...meta };
          arq[P.obra(id)] = await arqObra(id, e.pub);
          if (e.ras) { e.ras = { ...e.ras, ...meta }; arq[P.ras(id)] = await arqRas(e.ras); }
        }
        await commit(arq, `${novo ? 'Cadastra' : 'Atualiza cadastro da'} obra ${meta.codigo}`);
        atualizarMinhaSessao();
        return paraApp(id);
      });
    },

    // carga do período (Prevision + RDOs) → rascunho
    salvarCarga(id, pacote, corte, fontes, progresso) {
      return gravar(async () => {
        const e = OB[id]; if (!e) throw erro('Obra não encontrada.');
        const base = e.ras || e.pub;
        const ras = clone(base);
        ['curva', 'mensal', 'tarefas', 'rdos', 'cronograma', 'medicao'].forEach(k => { if (pacote[k]) ras[k] = pacote[k]; });
        // financeiro tem 3 subtipos (curva/mensal/tarefas) em lotes separados: funde em vez de substituir,
        // senão enviar só a Curva S financeira apagaria o Progresso por tarefas financeiro do mês anterior.
        if (pacote.financeiro) ras.financeiro = { ...(ras.financeiro || {}), ...pacote.financeiro };
        if (['curva', 'mensal', 'tarefas', 'rdos', 'cronograma'].some(k => pacote[k])) ras.dataCorte = corte;
        if (['financeiro', 'medicao'].some(k => pacote[k])) ras.dataCorteFinanceiro = corte;
        ras.atualizadoEm = hoje();
        ras.fontes = { ...(base.fontes || {}), ...fontes };
        delete ras.publicadoEm;
        const arq = {};
        if (pacote.fotos) {
          progresso && progresso('Preparando as fotos…');
          const fotos = [];
          for (const f of pacote.fotos) { const bytes = await bytesDaFoto(f.src); const { src, ...m } = f; fotos.push(comSrc({ ...m, bytes })); }
          if (e.fotos.ras) revogarUrls({ fotos: { ras: e.fotos.ras } });
          e.fotos.ras = fotos;
          ras.fotosProprias = true; ras.nFotos = fotos.length; ras.destaques = [];
          arq[P.fotosRas(id)] = await arqFotos(chave(DIR.ki), fotos);
        } else if (!e.ras) {
          ras.fotosProprias = false;
        }
        progresso && progresso('Cifrando os dados…');
        arq[P.ras(id)] = await arqRas(ras);
        await commit(arq, `Carga da obra ${ras.codigo || id} — corte ${corte} (rascunho)`, { progresso });
        e.ras = ras;
        return paraApp(id);
      });
    },

    // publicar (sim) copia o rascunho para o cliente; recolher (não) volta a posição publicada para rascunho
    publicar(id, sim) {
      return gravar(async () => {
        const e = OB[id]; if (!e) throw erro('Obra não encontrada.');
        const arq = {}; const kObra = chave(DIR.chaves[id]);
        if (sim) {
          if (!e.ras) throw erro('Não há rascunho para publicar.');
          const pub = clone(e.ras);
          if (e.ras.fotosProprias) {
            const fotos = await garantirFotos(id, 'ras');
            arq[P.fotos(id)] = await arqFotos(kObra, fotos);
            arq[P.fotosRas(id)] = null;
            pub.nFotos = fotos.length;
          } else pub.nFotos = e.pub.nFotos || 0;
          delete pub.fotosProprias;
          pub.publicadoEm = agora();
          arq[P.obra(id)] = await arqObra(id, pub);
          arq[P.ras(id)] = null;
          await commit(arq, `Publica a obra ${pub.codigo || id} — corte ${pub.dataCorte}`);
          if (e.ras.fotosProprias) { if (e.fotos.pub) revogarUrls({ fotos: { pub: e.fotos.pub } }); e.fotos.pub = e.fotos.ras; }
          e.fotos.ras = null; e.pub = pub; e.ras = null;
        } else {
          if (!temDados(e.pub)) throw erro('Esta obra não tem posição publicada.');
          const fotos = await garantirFotos(id, 'pub');
          const ras = { ...clone(e.pub), fotosProprias: true, nFotos: fotos.length }; delete ras.publicadoEm;
          const meta = {}; ['id', 'codigo', 'nome', 'cliente', 'contratante', 'cidade', 'contrato', 'local', 'responsavel', 'prazoContratual', 'criadoEm'].forEach(k => { if (k in e.pub) meta[k] = e.pub[k]; });
          const pub = { ...meta, nFotos: 0 };
          arq[P.ras(id)] = await arqRas(ras);
          arq[P.fotosRas(id)] = await arqFotos(chave(DIR.ki), fotos);
          arq[P.obra(id)] = await arqObra(id, pub);
          arq[P.fotos(id)] = null;
          await commit(arq, `Recolhe a publicação da obra ${e.pub.codigo || id}`);
          e.ras = ras; e.fotos.ras = fotos; e.pub = pub; e.fotos.pub = [];
        }
        return paraApp(id);
      });
    },

    // fotos marcadas para o report (até 4)
    destacar(id, destaques) {
      return gravar(async () => {
        const e = OB[id]; const alvo = ehInterno() && e.ras ? 'ras' : 'pub';
        e[alvo] = { ...e[alvo], destaques: destaques.slice(0, 4) };
        const arq = { [alvo === 'ras' ? P.ras(id) : P.obra(id)]: alvo === 'ras' ? await arqRas(e.ras) : await arqObra(id, e.pub) };
        await commit(arq, `Fotos do report da obra ${e[alvo].codigo || id}`);
      });
    },

    // mapas de avanço (plantas demarcadas): sempre no rascunho — o cliente só vê depois de "Publicar para o cliente"
    salvarMapas(id, mapas) {
      return gravar(async () => {
        const e = OB[id]; if (!e) throw erro('Obra não encontrada.');
        if (!e.ras) { e.ras = { ...clone(e.pub), fotosProprias: false }; delete e.ras.publicadoEm; }
        e.ras.mapas = mapas;
        await commit({ [P.ras(id)]: await arqRas(e.ras) }, `Mapa de avanço da obra ${e.ras.codigo || id} (rascunho)`);
        return paraApp(id);
      });
    },

    // ----- acessos -----
    listarAcessos() {
      if (!DIR) return [];
      return Object.entries(DIR.usuarios).map(([id, u]) => ({ id, ...u, eu: CH && id === CH.uid }))
        .sort((a, b) => ({ admin: 0, diretoria: 1, cliente: 2 }[a.perfil] - { admin: 0, diretoria: 1, cliente: 2 }[b.perfil]) || a.nome.localeCompare(b.nome, 'pt-BR'));
    },
    criarAcesso({ nome, email, perfil, obras }) {
      return gravar(async () => {
        email = String(email || '').trim().toLowerCase(); nome = String(nome || '').trim();
        if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw erro('Informe nome e um e-mail válido.');
        if (!['admin', 'diretoria', 'cliente'].includes(perfil)) throw erro('Perfil inválido.');
        const uid = await idDoEmail(email);
        if (DIR.usuarios[uid]) throw erro('Este e-mail já tem acesso. Use "Nova senha" na lista.');
        const senha = gerarSenha();
        DIR.usuarios[uid] = { nome, email, perfil, obras: perfil === 'cliente' ? (obras || []).filter(o => DIR.chaves[o]) : [], criadoEm: agora(), senhaEm: agora() };
        await novaEntrada(uid, senha);
        await commit({ [P.dir]: await arqDir(), [P.acesso]: textoAcesso() }, `Novo acesso (${perfil})`);
        return { senha, usuario: { id: uid, ...DIR.usuarios[uid] } };
      });
    },
    redefinirSenha(uid) {
      return gravar(async () => {
        const u = DIR.usuarios[uid]; if (!u) throw erro('Acesso não encontrado.');
        const senha = gerarSenha();
        await redefinirEntrada(uid, senha);
        u.senhaEm = agora();
        await commit({ [P.dir]: await arqDir(), [P.acesso]: textoAcesso() }, 'Nova senha emitida');
        return { senha, usuario: { id: uid, ...u } };
      });
    },
    trocarMinhaSenha(nova) {
      return gravar(async () => {
        if (String(nova).length < 12) throw erro('A senha precisa ter pelo menos 12 caracteres.');
        await redefinirEntrada(CH.uid, nova);
        DIR.usuarios[CH.uid].senhaEm = agora();
        await commit({ [P.dir]: await arqDir(), [P.acesso]: textoAcesso() }, 'Administrador trocou a própria senha');
      });
    },
    // mudança de perfil/obras; se alguém perde acesso a algo, as chaves são trocadas
    atualizarAcesso(uid, { nome, perfil, obras }, progresso) {
      return gravar(async () => {
        const u = DIR.usuarios[uid]; if (!u) throw erro('Acesso não encontrado.');
        if (uid === CH.uid && perfil && perfil !== u.perfil) throw erro('Você não pode mudar o próprio perfil.');
        const antes = { perfil: u.perfil, obras: [...(u.obras || [])] };
        if (nome) u.nome = String(nome).trim();
        if (perfil) u.perfil = perfil;
        u.obras = u.perfil === 'cliente' ? (obras || u.obras || []).filter(o => DIR.chaves[o]) : [];
        const nivel = { cliente: 0, diretoria: 1, admin: 2 };
        const perdeu = nivel[u.perfil] < nivel[antes.perfil] || (u.perfil === 'cliente' && antes.perfil === 'cliente' && antes.obras.some(o => !u.obras.includes(o)));
        if (perdeu) return rotacionar(`Acesso reduzido — chaves trocadas`, progresso);
        await gravarChaveiro(uid);
        await commit({ [P.dir]: await arqDir(), [P.acesso]: textoAcesso() }, 'Acesso atualizado');
      });
    },
    removerAcesso(uid, progresso) {
      return gravar(async () => {
        if (uid === CH.uid) throw erro('Você não pode remover o próprio acesso.');
        if (!DIR.usuarios[uid]) throw erro('Acesso não encontrado.');
        delete DIR.usuarios[uid]; delete ACESSO.usuarios[uid];
        return rotacionar('Acesso removido — chaves trocadas', progresso);
      });
    },

    // ----- manutenção -----
    // Uma única versão no histórico (apaga as versões antigas cifradas com chaves já trocadas)
    compactarHistorico(progresso) {
      return gravar(async () => { await commit({}, 'Painel de Obras Machine — versão compactada', { orfao: true, progresso }); });
    },

    // ----- configuração inicial -----
    // Cifra a carga atual (legado/), cria o primeiro administrador e apaga os arquivos em claro.
    async configurar({ nome, email, senha, limparHistorico }, progresso) {
      const p = m => progresso && progresso(m);
      if (!GH.temToken()) throw erro('Informe o token do GitHub.', 'SEM_TOKEN');
      await GH.verificar();
      if (await this.estado() === 'login') throw erro('O painel já está configurado.');
      if (String(senha).length < 12) throw erro('A senha precisa ter pelo menos 12 caracteres.');
      email = String(email).trim().toLowerCase();
      p('Lendo a carga atual do painel…');
      const leg = await lerJSON('legado/seed.json');
      MK = aleatorio(32);
      DIR = { usuarios: {}, chaves: {}, ki: b64(aleatorio(32)), criadoEm: agora() };
      ACESSO = { versao: 1, cifra: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', usuarios: {} };
      const arq = {};
      for (const o of (leg ? leg.obras : [])) {
        const id = idSeguro(o.id || o.codigo);
        DIR.chaves[id] = b64(aleatorio(32));
        p(`Cifrando a obra ${o.codigo}…`);
        const fotos = [];
        for (const f of (o.fotos || [])) { const { src, ...m } = f; fotos.push(comSrc({ ...m, bytes: await bytesDaFoto(src) })); }
        const { fotos: _f, ...resto } = o;
        const pub = { ...resto, id, destaques: (o.destaques || []).map(s => { const f = (o.fotos || []).find(x => x.src === s); return f ? idFoto(f) : null; }).filter(Boolean),
          nFotos: fotos.length, publicadoEm: temDados(o) ? agora() : undefined };
        if (temDados(o)) pub.dataCorte = o.publicadoAte || o.dataCorte;
        delete pub.publicadoAte;
        arq[P.obra(id)] = await arqObra(id, pub);
        if (fotos.length) arq[P.fotos(id)] = await arqFotos(chave(DIR.chaves[id]), fotos);
        OB[id] = { pub, ras: null, fotos: { pub: fotos, ras: null } };
      }
      const uid = await idDoEmail(email);
      DIR.usuarios[uid] = { nome: String(nome).trim(), email, perfil: 'admin', obras: [], criadoEm: agora(), senhaEm: agora() };
      p('Criando o acesso do administrador…');
      await novaEntrada(uid, senha);
      arq[P.dir] = await arqDir();
      arq[P.acesso] = textoAcesso();
      p('Publicando no GitHub…');
      await commit(arq, 'Painel de Obras Machine — dados cifrados e acesso por senha', { orfao: !!limparHistorico, apagarPrefixos: ['legado/', 'assets/fotos/', 'js/seed.js', 'local.html', 'tools/limitar-fotos.cjs'], progresso });
      CH = chaveiroDe(uid); guardarSessao();
      return usuarioDaSessao();
    },
  };

  // Troca todas as chaves (mestra, interna e de cada obra) e recifra tudo. Usado quando alguém perde acesso.
  async function rotacionar(msg, progresso) {
    const p = m => progresso && progresso(m);
    const ids = Object.keys(DIR.chaves);
    p('Lendo todos os dados para trocar as chaves…');
    for (const id of ids) {
      if (!OB[id]) { CH.obras[id] = DIR.chaves[id]; await carregarObra(id); }
      await garantirFotos(id, 'pub'); if (OB[id].ras) await garantirFotos(id, 'ras');
    }
    const uks = {}; for (const uid of Object.keys(ACESSO.usuarios)) uks[uid] = await ukDe(uid);
    MK = aleatorio(32); DIR.ki = b64(aleatorio(32)); ids.forEach(id => { DIR.chaves[id] = b64(aleatorio(32)); });
    const arq = {};
    for (const id of ids) {
      p(`Recifrando a obra ${OB[id].pub.codigo || id}…`);
      const e = OB[id];
      arq[P.obra(id)] = await arqObra(id, e.pub);
      if (e.fotos.pub && e.fotos.pub.length) arq[P.fotos(id)] = await arqFotos(chave(DIR.chaves[id]), e.fotos.pub);
      if (e.ras) { arq[P.ras(id)] = await arqRas(e.ras); if (e.ras.fotosProprias && e.fotos.ras) arq[P.fotosRas(id)] = await arqFotos(chave(DIR.ki), e.fotos.ras); }
    }
    for (const [uid, uk] of Object.entries(uks)) { ACESSO.usuarios[uid].a = b64(await cifrar(MK, uk)); await gravarChaveiro(uid, uk); }
    arq[P.dir] = await arqDir(); arq[P.acesso] = textoAcesso();
    await commit(arq, msg, { progresso });
    atualizarMinhaSessao();
  }

  window.API = API;
})();
