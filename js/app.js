
// ============================================================
// Machine · Painel de Obras — app (telas e navegação).
// Dados cifrados no próprio repositório (js/api.js); acesso só com e-mail e senha.
// ============================================================
(function () {
  'use strict';
  const { esc, fmtNum, pct, pp, dBR, dCurto, mesLongo, diaSemana, diff, nomeBonito, moeda } = Core;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- estado ----------
  const DB = { obras: [] };
  const ROTULO = { admin: 'Planejamento · Administrador', diretoria: 'Diretoria · todas as obras', cliente: 'Cliente' };
  const PERFIL = { admin: 'Administrador', diretoria: 'Diretoria', cliente: 'Cliente' };
  const EMAIL = API.emailAcesso || 'planejamento05@grupomachine.com.br';
  const iniciais = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const temDados = o => !!(o && !o.semDados && o.curva && o.curva.length && o.tarefas && o.tarefas.length);
  const S = { user: null, view: 'login', carregando: true, loginMsg: null, loginErro: null, obraId: null, filtroTarefas: 'atrasada', verTodas: false, abertos: {}, menu: false, imp: null, impModo: 'fisico', fotoRdo: null, fotosTodas: false, lb: null, modal: null, ocupado: null, editAcesso: null };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem lembrar */ } };

  const obrasDoUsuario = () => DB.obras;
  const ehAdmin = () => S.user && S.user.perfil === 'admin';
  const ehCliente = () => S.user && S.user.perfil === 'cliente';
  // Cliente vê só RDO aprovado e só até a data publicada
  function visaoDaObra(o) {
    if (!ehCliente()) return o;
    return { ...o, dataCorte: o.publicadoAte || o.dataCorte, rdos: (o.rdos || []).filter(r => r.status === 'aprovado') };
  }

  // ---------- ícones ----------
  const IC = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
    obra: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V8l7-4 7 4v13"/><path d="M9 21v-6h6v6"/></svg>',
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m6 10 6-6 6 6"/><path d="M4 20h16"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/></svg>',
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5Z" fill="currentColor"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m21 21-4.3-4.3"/></svg>',
    rflag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4"/><path d="M5 4h13l-3 4.5L18 13H5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 3.8 2.3 18a1.6 1.6 0 0 0 1.4 2.4h16.6a1.6 1.6 0 0 0 1.4-2.4L13.4 3.8a1.6 1.6 0 0 0-2.8 0Z"/><path d="M12 9v4.5"/><path d="M12 17h.01"/></svg>',
    photo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="10" r="1.75"/><path d="m3 17 5.5-5.5a2 2 0 0 1 2.8 0L21 19"/></svg>',
    rlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6h12M9 12h12M9 18h12"/><path d="m3 6 1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2"/></svg>',
  };
  const LOGO = 'assets/logo_machine_claro.png';

  // ---------- tema ----------
  const TEMAS = ['auto', 'light', 'dark'];
  function aplicaTema(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  let tema = lsGet('mp_tema') || 'auto';
  aplicaTema(tema);

  // ---------- moldura ----------
  function shell(conteudo) {
    const u = S.user;
    const o = S.obraId ? DB.obras.find(x => x.id === S.obraId) : null;
    const crumb = S.view === 'obra' && o ? `<b>${esc(o.codigo)} · ${esc(o.nome)}</b>` : S.view === 'alimentar' ? '<b>Alimentar dados</b>' : S.view === 'report' ? `<b>Report${o ? ' · ' + esc(o.codigo) : ''}</b>` : S.view === 'acessos' ? '<b>Acessos</b>' : S.view === 'nova-obra' ? '<b>Nova obra</b>' : S.view === 'editar-obra' ? '<b>Cadastro da obra</b>' : S.view === 'senha' ? '<b>Senha</b>' : S.view === 'github' ? '<b>Publicação</b>' : '<b>Portfólio</b>';
    const itens = [
      ['portfolio', 'Portfólio', IC.home, !ehCliente() || obrasDoUsuario().length > 1],
      ['obra', 'Obra', IC.obra, true],
      ['alimentar', 'Alimentar', IC.up, ehAdmin()],
      ['report', 'Report', IC.doc, true],
      ['acessos', 'Acessos', IC.users, ehAdmin()],
    ].filter(i => i[3]);
    return `
      <header class="mast"><div class="mast-in">
        <img src="${LOGO}" alt="Machine · Realizações com base sólida">
        <span class="ttl">Painel de Obras</span><span class="crumb">${crumb}</span>
        <span class="sp"></span>
        ${S.ocupado ? `<span class="sync" role="status"><i></i>${esc(S.ocupado)}</span>` : ''}
        <button class="iconbtn" id="bt-tema" aria-label="Tema: ${tema === 'auto' ? 'automático' : tema === 'light' ? 'claro' : 'escuro'}">${tema === 'auto' ? IC.auto : tema === 'light' ? IC.sun : IC.moon}</button>
        <button class="avatar" id="bt-user" aria-haspopup="menu" aria-expanded="${S.menu}" aria-label="Conta: ${esc(u.nome)}">${esc(u.ini)}</button>
      </div></header>
      ${S.menu ? `<div class="menu" role="menu"><div class="who"><b>${esc(u.nome)}</b><small>${esc(u.rotulo)}</small></div>
        ${ehAdmin() ? `<button role="menuitem" data-go="senha">Trocar minha senha</button><button role="menuitem" data-go="github">Publicação (GitHub)</button>` : `<a role="menuitem" href="${mailtoSenha(u.email)}">Solicitar nova senha</a>`}<button role="menuitem" data-act="sair">Sair</button></div>` : ''}
      <main class="page" id="main">${conteudo}</main>
      <nav class="nav" aria-label="Navegação principal"><div class="nav-in">
        ${itens.map(([k, t, ic]) => `<button data-go="${k}" ${S.view === k ? 'aria-current="page"' : ''}>${ic}<span>${t}</span></button>`).join('')}
      </div></nav>`;
  }

  const sec = (id, titulo, direita, corpo, aberto = true) => {
    const open = S.abertos[id] ?? aberto;
    return `<details class="sec" data-sec="${id}" ${open ? 'open' : ''}><summary><span class="mk"></span><h2>${titulo}</h2><span class="rt"><span class="rtxt">${direita || ''}</span><span class="chev">${IC.chev}</span></span></summary><div class="sec-body">${corpo}</div></details>`;
  };
  const pill = (k, t) => `<span class="pill ${k}">${esc(t)}</span>`;

  // ---------- e-mails (pedido de acesso e de senha) ----------
  const SITE = () => location.origin + location.pathname;
  const mailto = (para, assunto, corpo) => `mailto:${para}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  const mailtoSenha = email => mailto(EMAIL, 'Painel de Obras Machine · Redefinição de senha',
    `Solicito a redefinição da minha senha de acesso ao Painel de Obras Machine.\n\nE-mail de acesso: ${email || ''}\n\nAtenciosamente,`);

  // ---------- telas de acesso ----------
  const cartaoLogin = corpo => `<div class="login"><div class="login-card"><div class="lm"><img src="${LOGO}" alt="Machine · Realizações com base sólida"></div><div class="lgb">${corpo}</div></div></div>`;
  const avisos = () => `${S.loginErro ? `<div class="note-box err" role="alert">${esc(S.loginErro)}</div>` : ''}${S.loginMsg ? `<div class="note-box" role="status">${esc(S.loginMsg)}</div>` : ''}`;
  function viewLoginProd() {
    return cartaoLogin(`
      <div><div class="kicker">Painel de Obras · Planejamento</div><h1 class="h1" style="font-size:28px">Entrar</h1>
        <p class="sub" style="margin-top:8px">Acesso restrito. Informe o e-mail cadastrado e a senha recebida do Planejamento.</p></div>
      <form id="f-login" class="steps" novalidate>
        <div class="field"><label for="l-email">E-mail</label><input class="inp" id="l-email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="l-senha">Senha</label><input class="inp" id="l-senha" type="password" autocomplete="current-password" required></div>
        ${avisos()}
        <div class="bar-actions"><button class="btn" type="submit">Entrar</button><a class="more" id="l-esqueci" href="${mailtoSenha('')}">Esqueci a senha</a></div>
      </form>
      <div class="pedido-box"><b>Não tem senha?</b><span>O acesso é concedido pelo Planejamento da Machine após avaliação do pedido.</span>
        <button class="btn sec2" type="button" data-go="pedido">Solicitar acesso</button></div>`);
  }
  function viewPedido() {
    return cartaoLogin(`
      <div><div class="kicker">Painel de Obras · Planejamento</div><h1 class="h1" style="font-size:28px">Solicitar acesso</h1>
        <p class="sub" style="margin-top:8px">O pedido é enviado para <b>${esc(EMAIL)}</b>. Após avaliação, se aprovado, a senha é enviada ao e-mail informado.</p></div>
      <form id="f-pedido" class="steps" novalidate>
        <div class="field"><label for="p-nome">Nome completo</label><input class="inp" id="p-nome" autocomplete="name" required></div>
        <div class="field"><label for="p-email">E-mail corporativo</label><input class="inp" id="p-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="p-empresa">Empresa</label><input class="inp" id="p-empresa" autocomplete="organization" required></div>
        <div class="field"><label for="p-vinculo">Vínculo</label><select class="inp" id="p-vinculo"><option>Cliente / contratante</option><option>Diretoria Machine</option><option>Equipe Machine</option><option>Outro</option></select></div>
        <div class="field"><label for="p-obras">Obra(s) de interesse</label><input class="inp" id="p-obras" placeholder="código ou nome da obra"></div>
        <div class="field"><label for="p-motivo">Justificativa</label><textarea class="inp" id="p-motivo" rows="3"></textarea></div>
        ${avisos()}
        <div class="bar-actions"><button class="btn" type="submit">Enviar pedido</button><button class="btn sec2" type="button" data-go="login">Voltar</button></div>
      </form>
      <p class="sec-lead" style="margin:0">O botão abre o seu programa de e-mail com o pedido preenchido. Se preferir, escreva diretamente para ${esc(EMAIL)}.</p>`);
  }
  function viewConfigurar() {
    return cartaoLogin(`
      <div><div class="kicker">Painel de Obras · Configuração inicial</div><h1 class="h1" style="font-size:28px">Proteger o painel</h1>
        <p class="sub" style="margin-top:8px">Cria o primeiro administrador e cifra os dados das obras. Depois disso, o painel só abre com senha.</p></div>
      <form id="f-config" class="steps" novalidate>
        <div class="field"><label for="c-nome">Nome do administrador</label><input class="inp" id="c-nome" autocomplete="name" required></div>
        <div class="field"><label for="c-email">E-mail</label><input class="inp" id="c-email" type="email" autocomplete="username" value="${esc(EMAIL)}" required></div>
        <div class="field"><label for="c-senha">Senha (mínimo 12 caracteres)</label><input class="inp" id="c-senha" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="field"><label for="c-conf">Repita a senha</label><input class="inp" id="c-conf" type="password" autocomplete="new-password" required></div>
        <div class="field"><label for="c-token">Token do GitHub</label><input class="inp" id="c-token" type="password" autocomplete="off" spellcheck="false" required>
          <small class="hint">${dicaToken()}</small></div>
        <label class="chk"><input type="checkbox" id="c-lembrar" checked> Lembrar o token neste computador</label>
        <label class="chk"><input type="checkbox" id="c-limpar" checked> Apagar o histórico antigo do repositório (remove as versões sem criptografia)</label>
        ${avisos()}
        <div class="bar-actions"><button class="btn" type="submit">Configurar</button></div>
      </form>`);
  }
  const dicaToken = () => `Crie em <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Fine-grained tokens</a>: acesso só ao repositório <b>${esc(API.github.repo())}</b>, permissão <b>Contents: Read and write</b>. O token fica só neste navegador.`;
  function viewSenha() {
    return `<div><div class="kicker">Conta</div><h1 class="h1">Trocar minha senha</h1><p class="sub">Mínimo de 12 caracteres. A senha nova vale a partir do próximo acesso.</p></div>
      <form id="f-senha" class="card card-pad steps" novalidate style="max-width:520px">
        <div class="field"><label for="s-nova">Nova senha</label><input class="inp" id="s-nova" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="field"><label for="s-conf">Repita a senha</label><input class="inp" id="s-conf" type="password" autocomplete="new-password" required></div>
        <div class="bar-actions"><button class="btn" type="submit">Salvar senha</button><button class="btn sec2" type="button" data-go="portfolio">Cancelar</button></div>
      </form>`;
  }
  function viewGithub() {
    const tem = API.github.temToken();
    return `<div><div class="kicker">Administração</div><h1 class="h1">Publicação</h1><p class="sub">As alterações feitas no painel (obras, cargas, publicações e acessos) são gravadas no repositório <b>${esc(API.github.repo())}</b> e o site atualiza em cerca de um minuto.</p></div>
      <div class="card card-pad steps" style="max-width:640px">
        <div class="meta" style="margin:0"><span>Token <b>${tem ? (API.github.lembrado() ? 'configurado neste computador' : 'configurado até fechar o navegador') : 'não configurado'}</b></span></div>
        <form id="f-token" class="steps" novalidate>
          <div class="field"><label for="g-token">${tem ? 'Substituir token' : 'Token do GitHub'}</label><input class="inp" id="g-token" type="password" autocomplete="off" spellcheck="false"><small class="hint">${dicaToken()}</small></div>
          <label class="chk"><input type="checkbox" id="g-lembrar" checked> Lembrar neste computador</label>
          <div class="bar-actions"><button class="btn" type="submit">Salvar token</button>${tem ? '<button class="btn sec2" type="button" id="g-limpar">Remover token deste navegador</button>' : ''}</div>
        </form>
      </div>
      <div class="card card-pad steps" style="max-width:640px">
        <div class="step-t">Manutenção</div>
        <p class="sub" style="margin:0">Mantém só a versão atual no histórico do repositório. Use depois de remover um acesso, para que versões antigas (cifradas com as chaves anteriores) deixem de existir.</p>
        <div class="bar-actions"><button class="btn sec2" type="button" id="g-compactar">Compactar histórico</button></div>
      </div>`;
  }
  const viewCarregando = () => cartaoLogin(`<div class="kicker">Painel de Obras</div><p class="sub" role="status">${esc(S.ocupado || 'Carregando…')}</p>`);

  // ---------- janelas ----------
  function modalHTML() {
    const m = S.modal; if (!m) return '';
    if (m.tipo === 'token') return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-t"><div class="modal-card">
      <h2 id="md-t">Token do GitHub</h2><p class="sub">Para gravar esta alteração no painel, informe o token de publicação.${m.erro ? '' : ''}</p>
      ${m.erro ? `<div class="note-box err" role="alert">${esc(m.erro)}</div>` : ''}
      <form id="f-mtoken" class="steps" novalidate>
        <div class="field"><input class="inp" id="m-token" type="password" autocomplete="off" spellcheck="false" aria-label="Token do GitHub"><small class="hint">${dicaToken()}</small></div>
        <label class="chk"><input type="checkbox" id="m-lembrar" checked> Lembrar neste computador</label>
        <div class="bar-actions"><button class="btn" type="submit">Continuar</button><button class="btn sec2" type="button" data-fecha="1">Cancelar</button></div>
      </form></div></div>`;
    if (m.tipo === 'senha') {
      const u = m.usuario;
      const corpo = `Prezado(a) ${u.nome},\n\nSeu acesso ao Painel de Obras Machine foi aprovado.\n\nEndereço: ${SITE()}\nE-mail: ${u.email}\nSenha: ${m.senha}\n\nPerfil: ${PERFIL[u.perfil]}${u.perfil === 'cliente' ? ` · obra(s) ${(u.obras || []).join(', ')}` : ''}\n\nGuarde esta senha em local seguro. Para redefini-la, escreva para ${EMAIL}.\n\nAtenciosamente,\nPlanejamento · Machine`;
      return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-t"><div class="modal-card">
        <h2 id="md-t">${m.nova ? 'Acesso criado' : 'Nova senha emitida'}</h2>
        <p class="sub">${esc(u.nome)} · ${esc(u.email)} · ${PERFIL[u.perfil]}</p>
        <div class="senha-box"><code id="m-senha">${esc(m.senha)}</code><button class="btn sec2" type="button" data-copia="${esc(m.senha)}">Copiar</button></div>
        <div class="note-box">A senha aparece só agora; ela não fica guardada em lugar nenhum. O acesso passa a valer em cerca de um minuto, quando o site atualizar.</div>
        <div class="bar-actions"><a class="btn" href="${mailto(u.email, 'Acesso ao Painel de Obras Machine', corpo)}">Enviar por e-mail</a><button class="btn sec2" type="button" data-fecha="1">Fechar</button></div>
      </div></div>`;
    }
    if (m.tipo === 'confirma') return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-t"><div class="modal-card">
      <h2 id="md-t">${esc(m.titulo)}</h2><p class="sub">${m.texto}</p>
      <div class="bar-actions"><button class="btn ${m.perigo ? 'danger' : ''}" type="button" id="m-ok">${esc(m.ok || 'Confirmar')}</button><button class="btn sec2" type="button" data-fecha="1">Cancelar</button></div>
    </div></div>`;
    return '';
  }
  // Executa uma gravação; sem token (ou com token inválido) pede o token e tenta de novo.
  async function gravando(rotulo, fn) {
    if (S.ocupado) { toast('Aguarde a gravação em andamento.'); return null; }
    S.ocupado = rotulo; render();
    try { return await fn(m => { S.ocupado = m; const el = $('.sync'); if (el) el.lastChild.textContent = m; else render(); }); }
    catch (e) {
      // a ação continua de onde parou depois que o token for informado (ou termina em null se cancelar)
      if (e.codigo === 'SEM_TOKEN' || e.codigo === 'TOKEN') return new Promise(fim => { S.modal = { tipo: 'token', erro: e.codigo === 'TOKEN' ? e.message : null, repetir: () => fim(gravando(rotulo, fn)), cancelar: () => fim(null) }; });
      toast('Não foi possível gravar: ' + e.message); return null;
    } finally { S.ocupado = null; if (S.user) DB.obras = API.listar(); render(); }
  }
  async function recarregar() { DB.obras = API.listar(); render(); }

  // ---------- portfólio ----------
  function viewPortfolio() {
    const vazias = obrasDoUsuario().filter(o => !temDados(visaoDaObra(o)));
    const obras = obrasDoUsuario().filter(o => temDados(visaoDaObra(o))).map(o => ({ o, r: Core.calc(visaoDaObra(o)) }));
    if (!obras.length) return `<div><div class="kicker">Planejamento · Portfólio</div><h1 class="h1">Olá</h1></div>
      <div class="card card-pad"><p class="sub" style="margin:0">${ehAdmin() ? 'Nenhuma obra com dados ainda. Cadastre a obra e alimente os arquivos do Prevision.' : 'Ainda não há relatório publicado. A posição aparece aqui assim que o Planejamento publicar.'}</p>
      ${ehAdmin() ? `<div class="bar-actions" style="margin-top:12px"><button class="btn" data-go="nova-obra">Cadastrar obra</button>${vazias.length ? '<button class="btn sec2" data-go="alimentar">Alimentar dados</button>' : ''}</div>` : ''}</div>`;
    const atrasadas = obras.filter(x => x.r.sem.k === 'critico').length;
    const paralis = obras.reduce((s, x) => s + (x.r.campo ? x.r.campo.paralisadas.length : 0), 0);
    const corte = obras.map(x => x.r.corte).sort().at(-1);
    const pesoTot = obras.length;
    const realMed = obras.reduce((s, x) => s + x.r.real, 0) / (pesoTot || 1);
    const prevMed = obras.reduce((s, x) => s + x.r.prevCorte, 0) / (pesoTot || 1);
    return `
      <div><div class="kicker">Planejamento · Portfólio</div><h1 class="h1">Olá</h1>
      <p class="sub">Posição física das obras com dados até ${dBR(corte)}.</p></div>
      <div class="card kpi-strip">
        <div class="kpi"><span>Obras ativas</span><b>${obras.length}</b><small>com cronograma carregado</small></div>
        <div class="kpi"><span>Atrasadas</span><b class="${atrasadas ? 'crit' : 'ok'}">${atrasadas}</b><small>IDP abaixo de ${fmtNum(Core.FAIXAS.atencao, 2)}</small></div>
        <div class="kpi"><span>Avanço médio</span><b>${pct(realMed)}</b><small>previsto ${pct(prevMed)}</small></div>
        <div class="kpi"><span>Frentes paralisadas</span><b class="${paralis ? 'crit' : ''}">${paralis}</b><small>no último RDO de cada obra</small></div>
      </div>
      <div><h2 style="font-size:24px">Obras</h2></div>
      <div class="obras">
        ${obras.map(({ o, r }) => `
          <button class="card obra-card" data-obra="${o.id}">
            <div class="top"><span class="code">${esc(o.codigo)}</span><h3>${esc(o.nome)}</h3><span class="cl">${esc(o.cliente)} · ${esc(o.cidade)}</span>
              <div class="chips" style="margin-top:6px">${pill(r.sem.k, r.sem.t)}<span class="pill plain">IDP ${fmtNum(r.idp, 2)}</span></div></div>
            <div class="mid">${bulletBar(r.real, r.prevCorte, 1)}
              <div class="bullet-cap"><span>Realizado <b style="color:var(--ink)">${pct(r.real)}</b></span><span>Previsto ${pct(r.prevCorte)}</span></div>
              ${miniLinha(r)}</div>
            <div class="bot">
              <div><span>Vs. plano</span><b style="color:${r.sem.k === 'critico' ? 'var(--crit)' : r.sem.k === 'atencao' ? 'var(--warn, #8F6A12)' : r.desvio >= Core.TOLERANCIA ? 'var(--ok)' : 'var(--ink)'}">${Core.comparaPlano(r.desvio).dir === 0 ? 'Em linha' : pp(r.desvio)}</b></div>
              <div><span>Término crono.</span><b>${dCurto(r.prazo.fimCron)}${r.crono && r.crono.slip ? ` <small class="${r.crono.slip > 0 ? 'neg' : 'pos'}">${r.crono.slip > 0 ? '+' : ''}${r.crono.slip}d</small>` : ''}</b></div>
              <div><span>Projeção</span><b>${r.projecao ? Core.mesCurto(r.projecao) : '—'}</b></div>
            </div>
          </button>`).join('')}
        ${vazias.map(o => `<button class="add-card" style="border-style:solid" data-obra="${o.id}"><span><b style="font-size:16px;color:var(--ink)">${esc(o.codigo)} · ${esc(o.nome)}</b>${ehAdmin() ? 'Sem dados ainda. Use Alimentar.' : 'Sem relatório publicado.'}</span></button>`).join('')}
        ${ehAdmin() ? `<button class="add-card" data-go="nova-obra"><span><b>+</b>Cadastrar obra</span></button>` : ''}
      </div>`;
  }

  // Linha do tempo do cartão: início → fim contratual, com corte, fim do cronograma e projeção
  function miniLinha(r) {
    const P = r.prazo, t0 = P.contrIni || P.iniCron, t1 = [P.contrFim, r.projecao, P.fimCron].filter(Boolean).sort().at(-1);
    const X = d => Math.max(0, Math.min(100, diff(t0, d) / Math.max(1, diff(t0, t1)) * 100));
    const pend = r.crono ? r.crono.pendentes.length : 0;
    return `<div class="mini-tl" aria-label="Prazo: ${P.aVencer} dias a vencer"><div class="mt-bar"><i class="mt-done" style="width:${X(r.corte)}%"></i><i class="mk-cron" style="left:${X(P.fimCron)}%"></i>${r.projecao ? `<i class="mk-proj" style="left:${X(r.projecao)}%"></i>` : ''}${P.contrFim ? `<i class="mk-contr" style="left:${X(P.contrFim)}%"></i>` : ''}</div>
      <div class="bullet-cap"><span>${P.aVencer ?? '—'} dias a vencer no contrato</span>${pend ? `<span class="pill atencao">${pend} pendente${pend > 1 ? 's' : ''} de contratação</span>` : ''}</div></div>`;
  }
  function bulletBar(real, prev, peso) {
    const w = v => Math.max(0, Math.min(100, v / peso * 100));
    return `<div class="bullet" role="img" aria-label="Realizado ${pct(real)}, previsto ${pct(prev)}"><div class="peso" style="width:100%"></div><div class="real ${w(real) >= 99.5 ? 'full' : ''}" style="width:${w(real)}%"></div><div class="prev" style="left:${w(prev)}%"></div></div>`;
  }

  // ---------- obra ----------
  function viewObra() {
    const base = DB.obras.find(x => x.id === S.obraId);
    if (!base) return `<div class="card card-pad">Escolha uma obra no portfólio.</div>`;
    const o = visaoDaObra(base);
    if (!temDados(o)) return `<div class="head-row"><div><div class="kicker">Obra ${esc(base.codigo)}${base.cidade ? ' · ' + esc(base.cidade) : ''}</div><h1 class="h1">${esc(base.nome)}</h1>${base.cliente ? `<p class="sub">${esc(base.cliente)}</p>` : ''}</div>${ehAdmin() ? '<div class="bar-actions"><button class="btn sec2" data-go="editar-obra">Editar cadastro</button></div>' : ''}</div>
      <div class="card card-pad"><p class="sub" style="margin:0">${ehAdmin() ? 'Esta obra ainda não tem dados. Vá em Alimentar e envie os arquivos do Prevision e dos RDOs.' : 'Ainda não há relatório publicado desta obra.'}</p>${ehAdmin() ? '<div class="bar-actions" style="margin-top:12px"><button class="btn" data-go="alimentar">Alimentar dados</button></div>' : ''}</div>`;
    const r = Core.calc(o);
    const P = r.prazo;
    const tempoCron = Math.max(0, Math.min(1, diff(P.iniCron, r.corte) / Math.max(1, diff(P.iniCron, P.fimCron))));
    const narr = Core.narrativa(o, r);
    const c = r.campo;

    // linha do tempo: início contratual → fim contratual
    const t0 = P.contrIni || P.iniCron, t1 = [P.contrFim, r.projecao, P.fimCron].filter(Boolean).sort().at(-1);
    const X = d => Math.max(0, Math.min(100, diff(t0, d) / Math.max(1, diff(t0, t1)) * 100));
        const marcos = [
      ['corte', r.corte, 'Data de corte', dBR(r.corte)],
      ['cron', P.fimCron, 'Fim do cronograma', dBR(P.fimCron)],
      r.projecao ? ['proj', r.projecao, 'Projeção no ritmo atual', '~' + Core.mesCurto(r.projecao)] : null,
      P.contrFim ? ['contr', P.contrFim, 'Fim contratual', dBR(P.contrFim)] : null,
    ].filter(Boolean);
    const tl = `<div class="tl" aria-label="Linha do tempo de prazos">
        <div class="tl-bar"><div class="axis"></div><div class="done" style="width:${X(r.corte)}%"></div>
          ${marcos.map(([k, d]) => `<i class="mk mk-${k}" style="left:${X(d)}%"></i>`).join('')}</div>
        <div class="tl-ends"><span>${dBR(t0)}</span><span>${dBR(t1)}</span></div>
        <div class="tl-leg">${marcos.map(([k, d, t, v]) => `<span><i class="mk-${k}"></i>${t} <b>${v}</b></span>`).join('')}</div>
      </div>`;

    const situacao = `
      <div class="card" style="overflow:hidden">
        <div class="sit">
          <div>
            <div class="chips">${pill(r.sem.k, r.sem.t)}<span class="pill plain">Corte ${dBR(r.corte)}</span>${ehCliente() ? '' : (c && c.rdosPendentes ? `<span class="pill atencao">${c.rdosPendentes} RDO em preenchimento</span>` : '')}</div>
            <div style="margin-top:14px" class="kicker">Avanço físico realizado</div>
            <div class="hero-n num">${fmtNum(r.real * 100, 1)}<small>%</small></div>
            <div class="hero-sub">previsto para a data: <b>${pct(r.prevCorte)}</b> · base original ${pct(r.baseCorte)}</div>
            <div class="dual">
              <div class="row"><span>Cronograma decorrido</span><div class="track"><div class="fill" style="width:${tempoCron * 100}%;background:var(--plan)"></div></div><b class="num">${pct(tempoCron, 0)}</b></div>
              <div class="row"><span>Avanço físico</span><div class="track"><div class="fill" style="width:${r.real * 100}%;background:var(--real)"></div></div><b class="num">${pct(r.real, 0)}</b></div>
            </div>
          </div>
          <div style="display:grid;gap:18px;align-content:start">
            <div class="kpis">
              <div class="kpi"><span>Comparado ao plano</span><b class="${r.sem.k === 'critico' ? 'crit' : r.sem.k === 'atencao' ? 'warn' : r.desvio >= Core.TOLERANCIA ? 'ok' : ''}">${Core.comparaPlano(r.desvio).dir === 0 ? 'Em linha' : pp(r.desvio)}</b><small>planejado ${pct(r.prevCorte)} na data</small></div>
              <div class="kpi"><span>IDP</span><b>${fmtNum(r.idp, 2)}</b><small>realizado ÷ previsto</small></div>
              <div class="kpi"><span>Ritmo atual</span><b>${pct(r.ritmo)}</b><small>média/mês · últimos 3 meses</small></div>
              <div class="kpi"><span>Ritmo necessário</span><b class="${r.ritmoCron > r.ritmo * 1.05 ? 'crit' : ''}">${r.ritmoCron ? pct(r.ritmoCron) : '—'}</b><small>para fechar em ${dCurto(P.fimCron)}</small></div>
            </div>
            ${tl}
          </div>
        </div>
        <div class="leitura">${narr.map(p => `<p>${p}</p>`).join('')}</div>
      </div>`;

    const curva = sec('curva', 'Curva S física', `${pct(r.real)} × ${pct(r.prevCorte)}`, `
      <p class="sec-lead">Avanço físico acumulado. A área entre as linhas é a diferença para o planejado até a data de corte (vermelha quando abaixo, verde quando acima).</p>
      <div class="legend"><span><i class="sw sw-real"></i>Realizado</span><span><i class="sw sw-prev"></i>Previsto (replanejado)</span><span><i class="sw sw-base"></i>Base (original)</span></div>
      <div class="chart" id="ch-curva"></div>`);

    const mesAtual = (o.mensal || []).find(m => m.mes === r.corte.slice(0, 7));
    const mensal = sec('mensal', 'Avanço por mês', mesAtual ? `${mesLongo(mesAtual.mes)}: ${pct(mesAtual.realizado)} de ${pct(mesAtual.previsto)}` : '', `
      <div class="legend"><span><i class="sw sw-prev" style="height:8px;width:8px"></i>Previsto no mês</span><span><i class="sw sw-real" style="height:8px;width:8px"></i>Realizado no mês</span><span class="note">* mês do corte, parcial até ${dCurto(r.corte)}</span></div>
      <div class="chart" id="ch-mensal"></div>`, true);

    const rf = Core.calcFinanceiro(o, r.corte);
    const financeiro = rf ? sec('financeiro', 'Financeiro — Valor Agregado', rf.spi !== null ? `SPI ${fmtNum(rf.spi, 2)}` : (rf.faturamento ? moeda(rf.faturamento.medido) : ''), `
      <p class="sec-lead">Valor agregado (EV) e valor planejado (PV) da Curva S financeira do Prevision; valor do contrato, medido e saldo do Controle de Medição.</p>
      <div class="kpis">
        ${rf.faturamento ? `<div class="kpi"><span>Valor do contrato</span><b>${moeda(rf.faturamento.contratual)}</b><small>BAC</small></div>
        <div class="kpi"><span>Medido acumulado</span><b>${moeda(rf.faturamento.medido)}</b><small>${rf.faturamento.pctMedido !== null ? pct(rf.faturamento.pctMedido, 1) + ' do contrato · ' : ''}última medição ${esc(rf.faturamento.ultimaMedicao || '—')}</small></div>
        <div class="kpi"><span>Saldo de contrato</span><b>${moeda(rf.faturamento.saldo)}</b><small>a medir</small></div>` : ''}
        <div class="kpi"><span>SPI</span><b>${rf.spi !== null ? fmtNum(rf.spi, 2) : '—'}</b><small>${rf.spi !== null ? `EV ${Core.moedaCurta(rf.ev)} ÷ PV ${Core.moedaCurta(rf.pv)}` : 'EV ÷ PV'}</small></div>
        <div class="kpi"><span>CPI</span><b>${rf.cpi !== null ? fmtNum(rf.cpi, 2) : '—'}</b><small>${rf.cpi !== null ? 'EV ÷ AC' : 'sem dado de custo real (AC)'}</small></div>
      </div>
      <div class="rx-tok">${GLOSSARIO_VA}</div>
      ${rf.pts ? `<div class="legend"><span><i class="sw sw-real"></i>Realizado (EV)</span><span><i class="sw sw-prev"></i>Planejado (PV)</span><span><i class="sw sw-base"></i>Base</span><span class="note">${notaEscalaVA(rf)}</span></div>
      <div class="chart" id="ch-fin"></div>` : '<p class="sub" style="margin:0">Ainda sem Curva S financeira (Financeiro VA) carregada.</p>'}`) : '';

    const frentes = !r.pesosOk && r.crono && r.crono.completo ? sec('frentes', 'Avanço por frente', `${Core.atividades(r).length} frentes da EAP`, `
      <p class="sec-lead">Avanço de cada atividade no cronograma do Prevision: barra = realizado da atividade; traço = planejado na data. Farol = realizado ÷ planejado. Toque numa frente para abrir as etapas.</p>
      ${ehAdmin() ? `<div class="note-box">O Progresso por tarefas veio filtrado por período (raiz ${pct(r.pesoRaiz, 2)}), então o peso de cada frente na obra não aparece. Exporte sem filtro de datas para ter os pesos.</div>` : ''}
      <div class="rx-tok">${atividadesHTML(Core.atividades(r), o)}</div>`) : sec('frentes', 'Avanço por frente', `${r.pacotes.length} frentes da EAP`, `
      <p class="sec-lead">Barra azul: realizado. Traço cobre: previsto na data de corte. Fundo: peso da frente na obra. Toque numa frente para abrir as etapas.</p>
      <div class="frentes">${r.pacotes.filter(p => p.peso > 0.0005).map(p => linhaFrente(p, r, 0)).join('')}</div>`);

    const tarefas = sec('tarefas', 'Tarefas', `${r.cont.atrasada} atrasadas`, blocoTarefas(r));

    const campo = c ? sec('campo', 'Campo · RDO', `nº ${c.ultimo.numero} · ${dCurto(c.ultimo.data)}`, blocoCampo(o, r, c)) : '';
    const cronoSec = r.crono ? sec('cronograma', 'Cronograma', `término ${dBR(r.crono.fimAtual)}${r.crono.slip ? ` · ${r.crono.slip > 0 ? '+' : ''}${r.crono.slip} d vs base` : ''}`, `
      <p class="sec-lead">Linhas do cronograma do Prevision${r.crono.dataRef ? `, posição de ${dBR(r.crono.dataRef)}` : ''}. Toque numa frente para abrir as etapas.${r.crono.pendentes.length ? ` <b>${r.crono.pendentes.length} ${r.crono.pendentes.length === 1 ? 'serviço pendente' : 'serviços pendentes'} de contratação.</b>` : ''}</p>
      ${!r.crono.completo && ehAdmin() ? `<div class="note-box">A exportação trouxe ${r.crono.linhas.length} de ${r.crono.total} linhas (árvore recolhida no Prevision). Para ver o cronograma inteiro aqui, exporte com todas as linhas expandidas.</div>` : ''}
      ${ganttHTML(r)}`) : '';
    const fotosSec = base.fotosPendentes ? sec('fotos', 'Fotos do diário de obra', 'carregando…', '<p class="sub" role="status" style="margin:0">Carregando as fotos…</p>') : r.fotos.length ? sec('fotos', 'Fotos do diário de obra', `${r.fotos.length} fotos · ${new Set(r.fotos.map(f => f.rdo)).size} RDOs`, blocoFotos(base, r)) : '';
    const nMapas = (o.mapas || []).filter(m => m.img).length;
    const mapaSec = ehAdmin() || nMapas ? sec('mapa', 'Mapa de avanço', S.mapaEd ? 'editando' : nMapas ? `${nMapas} ${nMapas === 1 ? 'planta' : 'plantas'}` : 'nenhum mapa', blocoMapas(base, o, r), !!S.mapaEd || nMapas > 0) : '';
    const restr = c ? sec('restricoes', 'Paralisações e restrições', c.paralisadas.length ? `<span class="pill critico">${c.paralisadas.length} abertas</span>` : 'nenhuma', blocoRestricoes(c)) : '';
    const conf = ehAdmin() ? sec('conferencia', 'Conferência dos dados', 'só administrador', blocoConferencia(o, r), false) : '';

    return `
      ${ehAdmin() && base.cargaId ? barraPublicacao(base) : ''}
      <div class="head-row"><div style="min-width:0">
        <div class="kicker">Obra ${esc(o.codigo)} · ${esc(o.cidade)}</div>
        <h1 class="h1">${esc(o.nome)}</h1>
        <p class="sub">${esc(o.cliente)} · contratante ${esc(o.contratante)}</p>
        <div class="meta">${o.contrato ? `<span>Contrato <b>${esc(o.contrato)}</b></span>` : ''}<span>Prazo contratual <b>${dBR(P.contrIni)} a ${dBR(P.contrFim)}</b> (${P.total} dias${P.contrFonte ? ' · ' + P.contrFonte : ''})</span><span>Decorridos <b>${P.decorrido}</b> · a vencer <b>${P.aVencer}</b></span>${o.responsavel ? `<span>Responsável <b>${esc(o.responsavel)}</b></span>` : ''}</div>
      </div>${ehAdmin() ? '<div class="bar-actions no-print"><button class="btn sec2" data-go="editar-obra">Editar cadastro</button></div>' : ''}</div>
      ${situacao}${cronoSec}${curva}${mensal}${financeiro}${frentes}${tarefas}${campo}${fotosSec}${mapaSec}${restr}${conf}`;
  }

  // Admin: o que o cliente está vendo e o botão de publicar
  function barraPublicacao(o) {
    return o.publicado
      ? `<div class="pub ok"><span>${pill('ok', 'Publicado')} Posição de <b>${dBR(o.dataCorte)}</b> visível ao cliente${o.publicadoEm ? ` desde ${new Date(o.publicadoEm).toLocaleDateString('pt-BR')}` : ''}.</span><button class="btn sec2" data-publicar="0">Recolher publicação</button></div>`
      : `<div class="pub"><span>${pill('atencao', 'Rascunho')} Carga de <b>${dBR(o.dataCorte)}</b> ainda não publicada. ${o.publicadoAte ? `O cliente vê a posição de <b>${dBR(o.publicadoAte)}</b>.` : 'Nenhuma posição publicada ao cliente.'}</span><button class="btn" data-publicar="1">Publicar para o cliente</button></div>`;
  }

  function linhaFrente(p, r, nivel) {
    const id = 'f' + p.eap;
    const aberto = !!S.abertos[id];
    const dvCls = p.desvio < -0.0005 ? 'neg' : p.desvio > 0.0005 ? 'pos' : 'zero';
    const conc = p.pctPacote !== null ? pct(p.pctPacote, 0) + ' da frente' : '';
    const filhos = aberto && p.temFilhos ? r.subpacotes(p.eap).filter(s => s.peso > 0.0001).map(s => linhaFrente(s, r, nivel + 1)).join('') : '';
    const nome = `<b>${esc(p.nome)}</b><small>${p.area ? esc(p.area) + ' · ' : ''}peso ${pct(p.peso, 2)} · ${dCurto(p.inicio)}–${dCurto(p.fim)}</small>`;
    return `<div class="fr ${nivel ? 'sub' : ''}" style="${nivel > 1 ? 'padding-left:' + (18 * nivel) + 'px' : ''}">
        <div class="nm">${p.temFilhos ? `<button data-abre="${id}" aria-expanded="${aberto}">${IC.right}<span>${nome}</span></button>` : `<div style="padding-left:20px">${nome}</div>`}</div>
        <div class="bwrap">${bulletBar(p.realizado, p.prevCorte, p.peso)}<div class="bullet-cap"><span>${pct(p.realizado, 2)} · ${conc}</span><span>prev. ${pct(p.prevCorte, 2)}</span></div></div>
        <div class="dv ${dvCls}">${pp(p.desvio, 2).replace(' p.p.', '')}<small>p.p.</small></div>
      </div>${filhos}`;
  }

  function blocoTarefas(r) {
    const F = [['atrasada', 'Atrasadas', r.cont.atrasada], ['andamento', 'Em andamento', r.cont.andamento], ['proximas', 'Terminam em 30 dias', r.proximas.length], ['a-iniciar', 'A iniciar', r.cont['a-iniciar']], ['concluida', 'Concluídas', r.cont.concluida], ...(r.cont['sem-data'] ? [['sem-data', 'Sem data no cronograma', r.cont['sem-data']]] : [])];
    let lista = S.filtroTarefas === 'proximas' ? r.proximas : r.lista.filter(t => t.situacao === S.filtroTarefas);
    if (S.filtroTarefas === 'atrasada') lista = r.atrasadas;
    if (S.filtroTarefas === 'andamento' || S.filtroTarefas === 'a-iniciar') lista = [...lista].sort((a, b) => a.fim < b.fim ? -1 : 1);
    const N = 10, mostra = S.verTodas ? lista : lista.slice(0, N);
    const lead = S.filtroTarefas === 'atrasada' ? `Tarefas com término previsto antes de ${dBR(r.corte)} e ainda incompletas, ordenadas pelo quanto falta. Somam ${pct(r.faltaAtrasadas)} do avanço da obra.` : S.filtroTarefas === 'sem-data' ? 'Linhas que o Prevision ainda não programou (início e término iguais ao início da obra, sem linha de base): escopo condicionado ou data a definir. Não contam como atraso.' : '';
    return `
      <div class="seg" role="group" aria-label="Filtrar tarefas">${F.map(([k, t, n]) => `<button data-filtro="${k}" aria-pressed="${S.filtroTarefas === k}">${t}<b>${n}</b></button>`).join('')}</div>
      ${lead ? `<p class="sec-lead" style="margin:0">${lead}</p>` : ''}
      ${lista.length ? `<div class="tw"><table class="t"><thead><tr><th>Tarefa</th><th class="n">Término</th>${S.filtroTarefas === 'atrasada' ? '<th class="n">Atraso</th>' : ''}<th class="n">Feito</th><th class="n">Falta</th></tr></thead><tbody>
        ${mostra.map(t => `<tr><td><b style="font-weight:600">${esc(t.nome)}</b><small>${esc(t.eap)} · ${esc(t.caminho.join(' › '))}</small></td>
          <td class="n">${dBR(t.fim)}</td>${S.filtroTarefas === 'atrasada' ? `<td class="n" style="color:var(--crit);font-weight:600">${t.diasAtraso} d</td>` : ''}
          <td class="n">${pct(t.pctTarefa, 0)}</td><td class="n">${pct(t.falta, 2)}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="sec-lead" style="margin:0">Nenhuma tarefa nesta situação.</p>`}
      ${lista.length > N ? `<button class="more" data-vertodas="1">${S.verTodas ? 'Mostrar só as 10 primeiras' : `Mostrar todas as ${lista.length}`}</button>` : ''}`;
  }

  function blocoCampo(o, r, c) {
    const u = c.ultimo;
    const prop = u.maoDeObra.filter(m => m.tipo === 'propria').reduce((s, m) => s + m.qtd, 0);
    const terc = u.maoDeObra.filter(m => m.tipo === 'terceiros').reduce((s, m) => s + m.qtd, 0);
    const clima = u.clima.map(x => `${x.turno.toLowerCase()} ${x.tempo?.toLowerCase() || ''}`).join(' · ');
    const pratic = u.clima.every(x => /pratic/i.test(x.condicao || '') && !/impratic/i.test(x.condicao || ''));
    const empresas = [...new Set(u.atividades.map(a => a.empresa).filter(Boolean))];
    return `
      <p class="sec-lead">Último relatório diário ${ehCliente() ? 'aprovado' : ''}: nº ${u.numero}, ${diaSemana(u.data)}, ${dBR(u.data)} · ${u.status === 'aprovado' ? 'aprovado' : 'em preenchimento'} · responsável ${esc(u.responsavel || '—')}.</p>
      <div class="rdo-head">
        <div class="mini"><span>Efetivo</span><b class="num">${prop + terc}</b><small>${prop} próprios · ${terc} terceiros</small></div>
        <div class="mini"><span>Frentes</span><b class="num">${u.atividades.length}</b><small>${empresas.length} empresas</small></div>
        <div class="mini"><span>Paralisadas</span><b class="num" style="color:${c.paralisadas.length ? 'var(--crit)' : 'inherit'}">${c.paralisadas.length}</b><small>no último RDO</small></div>
        <div class="mini"><span>Clima</span><b style="font-size:17px">${pratic ? 'Praticável' : 'Impraticável'}</b><small>${esc(clima)}</small></div>
      </div>
      <div class="two">
        <div style="min-width:0"><div class="step-t" style="margin-bottom:6px">Efetivo por dia · ${c.serie.length} RDOs</div>
          <div class="legend" style="margin-bottom:4px"><span><i class="sw sw-terc"></i>Terceiros</span><span><i class="sw sw-prop"></i>Próprios</span></div>
          <div class="chart" id="ch-efetivo"></div></div>
        <div style="min-width:0"><div class="step-t" style="margin-bottom:6px">Mão de obra no RDO ${u.numero}</div>
          <div class="tw"><table class="t" style="min-width:0"><thead><tr><th>Função / empresa</th><th>Tipo</th><th class="n">Qtd</th></tr></thead><tbody>
          ${u.maoDeObra.map(m => `<tr><td>${esc(m.funcao)}</td><td>${m.tipo === 'propria' ? 'Própria' : 'Terceiro'}</td><td class="n">${m.qtd}</td></tr>`).join('')}
          </tbody></table></div></div>
      </div>
      <div><div class="step-t" style="margin-bottom:6px">Frentes de serviço no RDO ${u.numero}</div>
      <div class="tw"><table class="t"><thead><tr><th>Serviço</th><th>Empresa</th><th>Local</th><th class="n">Avanço</th><th class="n">No período</th><th>Situação</th></tr></thead><tbody>
        ${c.frentes.map(f => `<tr><td><b style="font-weight:600">${esc(f.servico)}</b>${f.acumulado !== null ? `<small>${f.acumulado} de ${f.total}${f.unidade ? ' ' + esc(f.unidade) : ''}</small>` : ''}</td>
          <td>${esc(f.empresa || '—')}</td><td>${esc([f.local, f.area].filter(Boolean).join(' · ') || '—')}</td>
          <td class="n">${pct(f.pct, 0)}</td><td class="n">${f.avancoPeriodo === null ? '—' : pp(f.avancoPeriodo, 0)}</td>
          <td>${/paralis/i.test(f.situacao) ? pill('critico', 'Paralisada') : /conclu/i.test(f.situacao) ? pill('ok', 'Concluída') : pill('info', 'Em andamento')}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="sec-lead" style="margin:6px 0 0">"No período" compara com o primeiro RDO carregado (nº ${c.primeiro.numero}, ${dBR(c.primeiro.data)}).</p></div>`;
  }

  // Galeria: filtro por RDO (dia), ampliação, e ★ para escolher as fotos do report (só administrador)
  // Legenda da foto: o serviço quando o RDO traz; sem legenda, só a origem (RDO, dia, número)
  const legendaCurta = f => f.legenda && f.legenda.servico ? f.legenda.servico : null;
  const legendaDet = f => f.legenda ? [f.legenda.empresa, f.legenda.local, f.legenda.area, f.legenda.acumulado].filter(Boolean).join(' · ') : '';
  function fotosFiltradas(r) {
    const dias = [...new Set(r.fotos.map(f => f.rdo))];
    const sel = S.fotoRdo === 'todos' ? 'todos' : (dias.includes(S.fotoRdo) ? S.fotoRdo : dias[0]);
    return { dias, sel, lista: sel === 'todos' ? r.fotos : r.fotos.filter(f => f.rdo === sel) };
  }
  function blocoFotos(o, r) {
    const { dias, sel, lista } = fotosFiltradas(r);
    const dataDe = n => r.fotos.find(f => f.rdo === n).data;
    const N = 24, mostra = S.fotosTodas ? lista : lista.slice(0, N);
    const dest = new Set(o.destaques || []);
    return `
      <p class="sec-lead">Fotos extraídas do PDF dos RDOs, separadas por dia. A legenda mostra o serviço quando o RDO traz a descrição da foto.${ehAdmin() ? ' Marque com ★ até 4 fotos para o report; sem marcação, o report usa 1 foto por serviço dos últimos 30 dias, em ordem cronológica (foto 1 = mais antiga, última = mais recente).' : ''}</p>
      <div class="seg" role="group" aria-label="Filtrar fotos por dia">
        ${dias.map(n => `<button data-fotordo="${n}" aria-pressed="${sel === n}">${dCurto(dataDe(n))}<b>${r.fotos.filter(f => f.rdo === n).length}</b></button>`).join('')}
        <button data-fotordo="todos" aria-pressed="${sel === 'todos'}">Todas<b>${r.fotos.length}</b></button>
      </div>
      <div class="galeria">${mostra.map(f => `
        <figure class="foto">
          <button class="foto-abre" data-lb="${lista.indexOf(f)}" aria-label="Ampliar foto ${f.idx} do RDO ${f.rdo}"><img src="${f.src}" alt="${esc(legendaCurta(f) || `Foto ${f.idx} do RDO nº ${f.rdo}, ${dBR(f.data)}`)}" loading="lazy" width="${f.w}" height="${f.h}"></button>
          <figcaption>${legendaCurta(f) ? `<b>${esc(legendaCurta(f))}</b>${legendaDet(f) ? `<span>${esc(legendaDet(f))}</span>` : ''}` : ''}<span class="src">RDO ${f.rdo} · ${dCurto(f.data)} · foto ${f.idx}</span></figcaption>
          ${ehAdmin() ? `<button class="estrela" data-estrela="${f.id}" aria-pressed="${dest.has(f.id)}" aria-label="${dest.has(f.id) ? 'Tirar do report' : 'Usar no report'}">★</button>` : ''}
        </figure>`).join('')}</div>
      ${lista.length > N ? `<button class="more" data-fotostodas="1">${S.fotosTodas ? 'Mostrar menos' : `Mostrar as ${lista.length} fotos`}</button>` : ''}`;
  }
  function lightbox() {
    if (S.lb === null) return '';
    const base = DB.obras.find(x => x.id === S.obraId); const r = Core.calc(visaoDaObra(base));
    const { lista } = fotosFiltradas(r); const f = lista[S.lb]; if (!f) return '';
    return `<div class="lb" role="dialog" aria-modal="true" aria-label="Foto ampliada">
      <div class="lb-top"><span>${legendaCurta(f) ? `<b>${esc(legendaCurta(f))}</b>${legendaDet(f) ? ' · ' + esc(legendaDet(f)) : ''}<br>` : ''}RDO nº ${f.rdo} · ${diaSemana(f.data)}, ${dBR(f.data)} · foto ${f.idx}</span><span class="tn">${S.lb + 1} / ${lista.length}</span><button class="lb-x" data-lbx="1" aria-label="Fechar">×</button></div>
      <div class="lb-img"><img src="${f.src}" alt="Foto ${f.idx} do RDO nº ${f.rdo}"></div>
      <div class="lb-nav"><button data-lbnav="-1" ${S.lb === 0 ? 'disabled' : ''}>‹ Anterior</button><button data-lbnav="1" ${S.lb >= lista.length - 1 ? 'disabled' : ''}>Próxima ›</button></div>
    </div>`;
  }

  // ---------- cronograma (Gantt) ----------
  // Barra cheia = datas atuais; fio abaixo = base. O preenchimento é o realizado da linha.
  // Linhas vencidas e incompletas ficam marcadas; tracejado = data de corte; fio escuro = fim contratual.
  function ganttHTML(r, opts = {}) {
    const k = r.crono; if (!k) return '';
    const comp = !!opts.compacto;
    const t0 = k.ini, t1 = k.fim, tot = Math.max(1, diff(t0, t1));
    const X = d => Math.max(0, Math.min(100, diff(t0, d) / tot * 100));
    const W = (a, b) => Math.max(0.6, X(b) - X(a));
    const meses = []; { let d = t0.slice(0, 7) + '-01'; while (d <= t1) { if (d >= t0) meses.push(d); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; } }
    const filhos = l => k.linhas.filter(x => x.nivel === l.nivel + 1 && x.eap.startsWith(l.eap + '.'));
    // no report, as mesmas frentes do motor (com peso), ligadas pela posição na árvore
    const frentesLinhas = new Set(r.pacotes.filter(p => p.peso >= 0.005).map(p => p.linha)); // no report: frentes com pelo menos 0,5% do peso
    const visivel = l => {
      if (comp) return l.nivel === 1 || frentesLinhas.has(l.linha);
      if (l.nivel <= 2) return true;
      const p = l.eap.split('.'); for (let i = 2; i < p.length; i++) if (!S.abertos['g' + p.slice(0, i).join('.')]) return false; return true;
    };
    const linhas = k.linhas.filter(visivel);
    const corteX = X(r.corte), contrX = r.prazo.contrFim ? X(r.prazo.contrFim) : null;
    const grade = `<div class="gt-grid">${meses.map(m => `<i style="left:${X(m)}%"></i>`).join('')}<b class="gt-corte" style="left:${corteX}%"></b>${contrX !== null ? `<b class="gt-contr" style="left:${contrX}%"></b>` : ''}</div>`;
    const cab = `<div class="gt-row gt-head"><div class="gt-nm">${comp ? 'Frente' : 'Linha do cronograma'}</div><div class="gt-tl">${meses.map((m, i) => X(m) > 93 ? '' : `<span style="left:${X(m)}%">${(comp && meses.length > 9 && i % 2) ? '' : Core.mesCurto(m).slice(0, 3)}</span>`).join('')}</div><div class="gt-pc">Real / prev.</div><div class="gt-sl">Término</div></div>`;
    const row = l => {
      const tem = !comp && l.nivel >= 2 && filhos(l).length > 0, ab = !!S.abertos['g' + l.eap];
      const nome = l.nivel === 1 ? esc(String(l.nome || '').replace(/\s+/g, ' ').trim()) : `${esc(l.nomeExib)}${l.area && !comp ? ` <small class="gt-area">${esc(l.area)}</small>` : ''}`;
      const sub = comp ? (l.nivel > 1 && l.peso ? `<small>${pct(l.peso, 0)} da obra</small>` : '') : `<small>${dCurto(l.inicio)}–${dCurto(l.fim)} · ${l.duracao ?? '—'} d${l.responsaveis ? ' · ' + esc(l.responsaveis.replace(/,?\s*Pendente de contratação/i, '')) : ''}</small>`;
      const flags = `${l.pendente ? '<span class="pill atencao">Pendente de contratação</span>' : ''}${l.situacao === 'atrasada' && !comp ? `<span class="pill critico">Venceu há ${l.diasAtraso} d</span>` : ''}`;
      const gap = l.realizado - l.previsto;
      const pcCls = gap < -0.05 ? 'neg' : gap > 0.05 ? 'pos' : '';
      const sl = l.slip === null ? '—' : l.slip === 0 ? (comp ? '' : 'na base') : `${l.slip > 0 ? '+' : '−'}${Math.abs(l.slip)} d`;
      return `<div class="gt-row n${Math.min(l.nivel, 4)} s-${l.situacao}" title="${esc(l.nome)}">
        <div class="gt-nm" style="padding-left:${comp ? 0 : (l.nivel - 1) * 14}px">${tem ? `<button class="gt-tg" data-abre="g${l.eap}" aria-expanded="${ab}" aria-label="${ab ? 'Recolher' : 'Abrir'} ${esc(l.nomeExib)}">${IC.right}</button>` : '<span class="gt-sp"></span>'}<span class="gt-tx"><b>${nome}</b>${sub}${flags ? `<span class="gt-fl">${flags}</span>` : ''}</span></div>
        <div class="gt-tl">${l.inicioBase && l.fimBase ? `<i class="gb-base" style="left:${X(l.inicioBase)}%;width:${W(l.inicioBase, l.fimBase)}%"></i>` : ''}${l.situacao === 'sem-data' ? '' : `<i class="gb-at" style="left:${X(l.inicio)}%;width:${W(l.inicio, l.fim)}%"><i class="gb-fill" style="width:${Math.min(100, l.realizado * 100)}%"></i></i>`}</div>
        <div class="gt-pc ${pcCls}"><b>${pct(l.realizado, 0)}</b><small>${pct(l.previsto, 0)}</small></div>
        <div class="gt-sl ${l.slip > 0 ? 'neg' : l.slip < 0 ? 'pos' : ''}"><b>${l.situacao === 'sem-data' ? 'a definir' : dCurto(l.fim)}</b><small>${l.situacao === 'sem-data' ? '' : sl}</small></div>
      </div>`;
    };
    const leg = `<div class="legend gt-leg"><span><i class="lg-at"></i>Atual, preenchido pelo realizado</span><span><i class="lg-base"></i>Base</span><span><i class="lg-corte"></i>Corte ${dCurto(r.corte)}</span>${contrX !== null ? `<span><i class="lg-contr"></i>Fim contratual ${dCurto(r.prazo.contrFim)}</span>` : ''}</div>`;
    return `<div class="gantt ${comp ? 'gantt-c' : ''}">${leg}<div class="gt-wrap"><div class="gt">${cab}<div class="gt-body">${grade}${linhas.map(row).join('')}</div></div></div></div>`;
  }

  // ---------- mapa de avanço (aba Obra) ----------
  // Planta da obra (imagem ou página de PDF) com áreas demarcadas: Executado · Executando · A executar.
  // Área vinculada a uma atividade do cronograma muda de cor sozinha a cada carga; sem vínculo, a situação é a escolhida aqui.
  // O mapa salvo vai para o rascunho da obra e entra no report (folha A4 retrato, ou duas plantas numa folha paisagem).
  const PAGINA_MAPA = { retrato: 'A4 retrato · 1 planta por folha', paisagem: 'A4 paisagem · 2 plantas por folha' };
  const novoId = () => Math.random().toString(36).slice(2, 9);
  function blocoMapas(base, o, r) {
    const ed = S.mapaEd;
    if (ed && ehAdmin()) return editorMapa(ed, r);
    const mapas = Core.mapasDaObra(o, r);
    return `<p class="sec-lead">Planta da obra com as áreas de cada frente de serviço classificadas em <b>Executado</b>, <b>Executando</b> e <b>A executar</b>. Área vinculada a uma atividade do cronograma muda de cor sozinha a cada carga.${ehAdmin() ? ' O mapa salvo vai para o rascunho e entra no report depois de publicado.' : ''}</p>
      ${mapas.length ? `<div class="mp-lista">${mapas.map((m, i) => `<figure class="mp-card"><figcaption><b>${esc(m.titulo || 'Sem título')}</b><small>${PAGINA_MAPA[m.pagina || 'retrato']} · ${m.zonas.length} ${m.zonas.length === 1 ? 'área' : 'áreas'}</small></figcaption>
        ${plantaHTML(m)}${legMapa(m)}
        ${ehAdmin() ? `<div class="bar-actions"><button class="btn sec2" data-mapaed="${i}">Editar</button><button class="more neg" data-mapadel="${i}">Remover</button></div>` : ''}</figure>`).join('')}</div>`
      : `<p class="sub" style="margin:0">${ehAdmin() ? 'Nenhum mapa ainda. Envie a planta (PDF ou imagem) e demarque as áreas.' : 'Nenhum mapa de avanço publicado.'}</p>`}
      ${ehAdmin() ? '<div class="bar-actions"><button class="btn" data-mapaed="novo">+ Novo mapa de avanço</button></div>' : ''}`;
  }
  function editorMapa(ed, r) {
    const ativ = Core.atividadesParaMapa(r), m = ed.m;
    const vis = m.img ? Core.mapasDaObra({ mapas: [m] }, r)[0] : { ...m, zonas: [], resumo: [] }, zonas = vis.zonas;
    const z = zonas.find(x => x.id === ed.sel);
    const painel = z ? `<div class="mp-painel card-pad">
        <div class="step-t">Área ${z.n}</div>
        <div class="field"><label for="mp-rot">Nome da área</label><input class="inp" id="mp-rot" value="${esc(z.rotulo || '')}" placeholder="ex.: Galpão A · eixo 1–5"></div>
        <div class="field"><label for="mp-vinc">Atividade do cronograma</label><select class="inp" id="mp-vinc"><option value="">— sem vínculo (situação escolhida abaixo) —</option>
          ${ativ.map(a => `<option value="${esc(a.chave)}" ${z.vinculo && z.vinculo.chave === a.chave ? 'selected' : ''}>${'  '.repeat(Math.max(0, a.nivel - 2))}${esc(a.eap)} · ${esc(a.nome)} (${pct(a.feito, 0)})</option>`).join('')}</select>
          <small class="hint">${z.auto ? `Situação automática: <b>${Core.MAPA_ST[z.st]}</b> (${pct(z.feito, 0)} realizado).` : 'Sem vínculo, a situação é a escolhida abaixo e não muda sozinha.'}</small></div>
        <div class="seg" role="group" aria-label="Situação da área">${Object.entries(Core.MAPA_ST).map(([k, t]) => `<button data-mpst="${k}" aria-pressed="${z.st === k}" ${z.auto ? 'disabled' : ''}><i class="mp-sw ${COR_MAPA[k]}"></i>${t}</button>`).join('')}</div>
        <div class="bar-actions"><button class="more neg" data-mpzdel="1">Remover área</button><button class="more" data-mpsel="">Fechar</button></div>
      </div>` : `<p class="hint" style="margin:0">${m.img ? 'Arraste sobre a planta para demarcar uma área. Toque numa área para editar.' : ''}</p>`;
    return `<div class="mp-editor steps">
      <div class="two"><div class="field"><label for="mp-titulo">Frente de serviço</label><input class="inp" id="mp-titulo" value="${esc(m.titulo || '')}" placeholder="ex.: Cobertura · Armazém Praia do Forte"></div>
        <div class="field"><label for="mp-pagina">Folha no report</label><select class="inp" id="mp-pagina">${Object.entries(PAGINA_MAPA).map(([k, t]) => `<option value="${k}" ${(m.pagina || 'retrato') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          ${m.img && m.w / m.h >= 1.6 && (m.pagina || 'retrato') === 'retrato' ? '<small class="hint">Planta larga: a folha paisagem (duas plantas, uma sobre a outra) aproveita melhor o papel.</small>' : ''}</div></div>
      <div class="field"><label for="mp-arq">Planta (PDF ou imagem)</label><input class="inp" type="file" id="mp-arq" accept=".pdf,image/png,image/jpeg">
        ${ed.pdfPaginas > 1 ? `<div class="bar-actions" style="margin-top:6px"><label for="mp-pag" class="hint">O PDF tem ${ed.pdfPaginas} páginas. Página:</label><input class="inp" id="mp-pag" type="number" min="1" max="${ed.pdfPaginas}" value="${ed.pdfPagina || 1}" style="width:90px"><button class="btn sec2" type="button" id="mp-usapag">Usar esta página</button></div>` : ''}
        ${ed.lendo ? `<small class="hint" role="status">${esc(ed.lendo)}</small>` : ''}</div>
      ${m.img ? `<div class="mp-edit">${plantaHTML(vis, { sel: ed.sel })}</div>${legMapa(vis)}` : ''}
      ${painel}
      ${zonas.length ? `<div class="tw">${tabelaMapa(vis, false).replace(/<tr><td class="mp-n">/g, '<tr class="mp-linha"><td class="mp-n">')}</div>` : ''}
      <div class="bar-actions"><button class="btn" id="mp-salvar" ${m.img ? '' : 'disabled'}>Salvar mapa</button><button class="btn sec2" id="mp-cancelar">Cancelar</button></div>
    </div>`;
  }
  // planta → JPEG de até 2000 px no lado maior (PDF: renderiza a página escolhida)
  let mapaPdf = null;
  async function plantaDeCanvas(cv) {
    const k = Math.min(1, 2000 / Math.max(cv.width, cv.height));
    const c2 = document.createElement('canvas'); c2.width = Math.round(cv.width * k); c2.height = Math.round(cv.height * k);
    const g = c2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c2.width, c2.height); g.drawImage(cv, 0, 0, c2.width, c2.height);
    return { img: c2.toDataURL('image/jpeg', 0.82), w: c2.width, h: c2.height };
  }
  async function plantaDoPdf(n) {
    const pg = await mapaPdf.getPage(n);
    const v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(6, 2000 / Math.max(v1.width, v1.height)) });
    const cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
    await pg.render({ canvasContext: g, viewport: vp }).promise;
    return plantaDeCanvas(cv);
  }
  async function lerPlanta(f) {
    const ed = S.mapaEd; if (!ed) return;
    ed.lendo = 'Lendo a planta…'; render();
    try {
      let p;
      if (/\.pdf$/i.test(f.name)) {
        await carregaLibs();
        mapaPdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
        ed.pdfPaginas = mapaPdf.numPages; ed.pdfPagina = 1;
        p = await plantaDoPdf(1);
      } else {
        const bmp = await createImageBitmap(f);
        const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height; cv.getContext('2d').drawImage(bmp, 0, 0);
        mapaPdf = null; ed.pdfPaginas = 0;
        p = await plantaDeCanvas(cv);
      }
      Object.assign(ed.m, p); ed.lendo = null;
    } catch (e) { ed.lendo = 'Não consegui ler a planta: ' + e.message; }
    render();
  }
  function bindMapa() {
    const ed = S.mapaEd;
    $$('[data-mapaed]').forEach(b => b.onclick = () => {
      const base = DB.obras.find(x => x.id === S.obraId), lista = base.mapas || [];
      const i = b.dataset.mapaed === 'novo' ? -1 : +b.dataset.mapaed;
      S.mapaEd = { idx: i, m: i < 0 ? { id: novoId(), titulo: '', pagina: 'retrato', zonas: [] } : JSON.parse(JSON.stringify(lista[i])), sel: null };
      mapaPdf = null; render();
    });
    $$('[data-mapadel]').forEach(b => b.onclick = () => {
      const base = DB.obras.find(x => x.id === S.obraId), i = +b.dataset.mapadel, m = (base.mapas || [])[i];
      confirma({ titulo: 'Remover mapa de avanço', texto: `O mapa <b>${esc(m.titulo || 'sem título')}</b> sai do rascunho e, depois de publicar, do report.`, ok: 'Remover', perigo: true },
        () => salvarMapas(base, (base.mapas || []).filter((_, k) => k !== i)));
    });
    if (!ed) return;
    const m = ed.m;
    const t = $('#mp-titulo'); if (t) t.oninput = () => { m.titulo = t.value; };
    const pg = $('#mp-pagina'); if (pg) pg.onchange = () => { m.pagina = pg.value; render(); };
    const fa = $('#mp-arq'); if (fa) fa.onchange = () => { if (fa.files[0]) lerPlanta(fa.files[0]); };
    const up = $('#mp-usapag'); if (up) up.onclick = async () => { const n = Math.max(1, Math.min(ed.pdfPaginas, +$('#mp-pag').value || 1)); ed.pdfPagina = n; ed.lendo = `Lendo a página ${n}…`; render(); try { Object.assign(m, await plantaDoPdf(n)); ed.lendo = null; } catch (e) { ed.lendo = 'Não consegui ler a página: ' + e.message; } render(); };
    const zona = () => m.zonas.find(z => z.id === ed.sel);
    const rot = $('#mp-rot'); if (rot) rot.oninput = () => { const z = zona(); if (z) z.rotulo = rot.value; };
    const vc = $('#mp-vinc'); if (vc) vc.onchange = () => { const z = zona(); if (!z) return; const base = DB.obras.find(x => x.id === S.obraId); const a = Core.atividadesParaMapa(Core.calc(visaoDaObra(base))).find(x => x.chave === vc.value); z.vinculo = a ? { chave: a.chave, eap: a.eap, nome: a.nome } : null; render(); };
    $$('[data-mpst]').forEach(b => b.onclick = () => { const z = zona(); if (z) { z.status = b.dataset.mpst; render(); } });
    $$('[data-mpzdel]').forEach(b => b.onclick = () => { m.zonas = m.zonas.filter(z => z.id !== ed.sel); ed.sel = null; render(); });
    $$('[data-mpsel]').forEach(b => b.onclick = () => { ed.sel = b.dataset.mpsel || null; render(); });
    $$('.mp-linha').forEach((tr, i) => tr.onclick = () => { ed.sel = m.zonas[i] && m.zonas[i].id; render(); });
    const cn = $('#mp-cancelar'); if (cn) cn.onclick = () => { S.mapaEd = null; mapaPdf = null; render(); };
    const sv = $('#mp-salvar'); if (sv) sv.onclick = async () => {
      const base = DB.obras.find(x => x.id === S.obraId), lista = [...(base.mapas || [])];
      const limpo = { ...m, zonas: m.zonas.map(({ id, x, y, w, h, rotulo, status, vinculo }) => ({ id, x, y, w, h, rotulo: rotulo || '', status: status || 'a-executar', vinculo: vinculo || null })), atualizadoEm: new Date().toISOString().slice(0, 10) };
      if (ed.idx < 0) lista.push(limpo); else lista[ed.idx] = limpo;
      if (await salvarMapas(base, lista)) { S.mapaEd = null; mapaPdf = null; render(); }
    };
    // desenhar área: arrastar sobre a planta; tocar numa área seleciona
    const pl = $('.mp-edit .mp-planta'); if (!pl) return;
    pl.onpointerdown = ev => {
      const zEl = ev.target.closest('.mp-z');
      if (zEl) { ed.sel = zEl.dataset.zona; render(); return; }
      ev.preventDefault();
      const bb = pl.getBoundingClientRect(), fx = x => Math.max(0, Math.min(1, (x - bb.left) / bb.width)), fy = y => Math.max(0, Math.min(1, (y - bb.top) / bb.height));
      const x0 = fx(ev.clientX), y0 = fy(ev.clientY);
      const tmp = document.createElement('i'); tmp.className = 'mp-z novo'; pl.appendChild(tmp);
      const ret = e => { const x1 = fx(e.clientX), y1 = fy(e.clientY); return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }; };
      const move = e => { const q = ret(e); Object.assign(tmp.style, { left: q.x * 100 + '%', top: q.y * 100 + '%', width: q.w * 100 + '%', height: q.h * 100 + '%' }); };
      const fim = e => {
        pl.removeEventListener('pointermove', move); pl.removeEventListener('pointerup', fim); pl.removeEventListener('pointercancel', fim);
        const q = ret(e); tmp.remove();
        if (q.w < 0.01 || q.h < 0.01) return;
        const z = { id: novoId(), ...q, rotulo: '', status: 'a-executar', vinculo: null };
        m.zonas.push(z); ed.sel = z.id; render();
      };
      try { pl.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura: o arraste ainda funciona dentro da planta */ }
      pl.addEventListener('pointermove', move); pl.addEventListener('pointerup', fim); pl.addEventListener('pointercancel', fim);
    };
  }
  async function salvarMapas(base, lista) {
    const ok = await gravando('Salvando o mapa de avanço…', () => API.salvarMapas(base.id, lista).then(() => true));
    if (ok) toast('Mapa salvo no rascunho. Publique para o cliente ver no report.');
    return ok;
  }

  function blocoRestricoes(c) {
    if (!c.paralisadas.length) return `<p class="sec-lead" style="margin:0">Nenhuma frente paralisada no último RDO.</p>`;
    return `<p class="sec-lead">Frentes marcadas como paralisadas no RDO. Cada uma vira uma restrição a remover, com responsável e prazo.</p>
      <div class="restr">${c.paralisadas.map(f => `
        <div class="it ${f.motivo ? '' : 'sem-motivo'}"><h4>${esc(f.servico)}</h4>
          <p>${f.motivo ? esc(f.motivo.replace(/^[^:]{0,60}:\s*/, '').toLowerCase().replace(/^./, m => m.toUpperCase())) : 'Motivo não informado no RDO.'}</p>
          <div class="meta"><span>Empresa <b>${esc(f.empresa || '—')}</b></span><span>Local <b>${esc([f.local, f.area].filter(Boolean).join(' · ') || '—')}</b></span><span>Avanço <b>${pct(f.pct, 0)}</b></span><span>Paralisada desde <b>${dBR(f.paralisadaDesde)}</b></span></div>
        </div>`).join('')}</div>`;
  }

  function blocoConferencia(o, r) {
    const raiz = o.tarefas.find(t => t.nivel === 1);
    const somaF = o.tarefas.filter(t => t.folha).reduce((s, t) => s + t.previsto, 0);
    const ultCurva = [...o.curva].reverse().find(p => p.realizado > 0);
    const idpmZero = o.mensal.every(m => !m.idpm);
    const atrasoPrev = r.atrasadas.filter(t => (t.atrasoPrevision || 0) < t.diasAtraso - 7).length;
    const itens = [
      ['ok', `Realizado da Curva S (${pct(ultCurva.realizado, 2)}) bate com o total do Progresso por tarefas (${pct(raiz.realizado, 2)}).`],
      [Math.abs(somaF - 1) < 0.001 ? 'ok' : 'av', `As tarefas finais somam ${pct(somaF, 2)} de peso. A diferença vem do arredondamento do Prevision e é redistribuída no cálculo do previsto por frente.`],
      [idpmZero ? 'av' : 'ok', idpmZero ? 'A coluna IDPM do Progresso mensal veio zerada. O IDP do painel é calculado aqui (realizado ÷ previsto).' : 'IDPM preenchido no Progresso mensal.'],
      [atrasoPrev ? 'av' : 'ok', `${atrasoPrev} tarefas atrasadas aparecem no Prevision com bem menos dias de atraso do que a data de término indica. O painel usa a conta pela data.`],
      ['av', 'As atividades do RDO não trazem o código da EAP. Para ligar campo e cronograma será preciso um de-para serviço → EAP.'],
      [o.curva.some(p => p.base !== p.previsto) ? 'ok' : 'av', o.curva.some(p => p.base !== p.previsto) ? 'Base e Previsto divergem a partir de jul/2026: houve replanejamento. O painel compara com o Previsto e mostra a Base como referência.' : 'Base igual ao Previsto.'],
    ];
    return `<div class="check">${itens.map(([k, t]) => `<div class="${k}"><i>${k === 'ok' ? '✓' : k === 'av' ? '!' : '×'}</i><span>${t}</span></div>`).join('')}</div>
      <div class="meta"><span>Fontes: <b>${esc(Object.values(o.fontes || {}).join(' · '))}</b></span></div>`;
  }

  // ---------- alimentar ----------
  // Dados financeiros (Financeiro VA) vêm nos mesmos arquivos e cabeçalhos do Prevision que os
  // físicos — a única forma confiável de separar é o usuário dizer qual lote está enviando.
  const TIPOS_FISICO = [
    ['curva', 'Curva S', 'Prevision · .xls'],
    ['mensal', 'Progresso mensal ou semanal', 'Prevision · .xls'],
    ['tarefas', 'Progresso por tarefas', 'Prevision · .xlsx'],
    ['cronograma', 'Cronograma', 'Prevision · .xlsx'],
    ['rdos', 'RDOs do período', 'PDF compilado'],
  ];
  const TIPOS_FINANCEIRO = [
    ['financeiro.curva', 'Curva S financeira (VA)', 'Prevision · .xls'],
    ['financeiro.mensal', 'Progresso mensal/semanal financeiro', 'Prevision · .xls'],
    ['financeiro.tarefas', 'Progresso por tarefas financeiro', 'Prevision · .xlsx'],
  ];
  const TIPOS_CONTRATO = [['medicao', 'Controle de Medição', 'Machine · .xlsx']];
  const TIPOS = [...TIPOS_FISICO, ...TIPOS_FINANCEIRO, ...TIPOS_CONTRATO];
  function viewAlimentar() {
    if (!DB.obras.length) return `<div><div class="kicker">Administração</div><h1 class="h1">Alimentar dados</h1></div><div class="card card-pad"><p class="sub" style="margin:0">Cadastre a obra antes de enviar os arquivos.</p><div class="bar-actions" style="margin-top:12px"><button class="btn" data-go="nova-obra">Cadastrar obra</button></div></div>`;
    const o = DB.obras.find(x => x.id === (S.obraId || DB.obras[0].id)) || DB.obras[0];
    const imp = S.imp || { arquivos: [], dados: {}, avisos: {} };
    const modo = S.impModo || 'fisico';
    const val = k => k.includes('.') ? ((imp.dados[k.split('.')[0]] || {})[k.split('.')[1]]) : imp.dados[k];
    const tiposMostrar = modo === 'financeiro' ? [...TIPOS_FINANCEIRO, ...TIPOS_CONTRATO] : [...TIPOS_FISICO, ...TIPOS_CONTRATO];
    return `
      <div><div class="kicker">Administração</div><h1 class="h1">Alimentar dados</h1>
      <p class="sub">Envie as exportações do Prevision (Curva S, Progresso mensal, Progresso por tarefas e Cronograma), o PDF dos diários de obra dos últimos 30 dias e, mensalmente, o Controle de Medição e a Curva S financeira (Valor Agregado). O painel reconhece cada arquivo, confere os números e grava a carga como rascunho.</p></div>
      <div class="card card-pad steps">
        <div class="step-t">1 · Tipo de dados</div>
        <div class="seg" role="group" aria-label="Tipo de dados do lote">
          <button data-modo="fisico" aria-pressed="${modo === 'fisico'}">Dados físicos<b>%</b></button>
          <button data-modo="financeiro" aria-pressed="${modo === 'financeiro'}">Dados financeiros<b>Valor Agregado</b></button>
        </div>
        <small class="hint">Escolha antes de enviar: o cabeçalho das planilhas é igual ao físico, só muda a pasta de exportação do Prevision ("Financeiro VA"). O Controle de Medição vale para os dois.</small>
        <div class="step-t">2 · Obra</div>
        <div class="field" style="max-width:420px"><select class="inp" id="imp-obra">${DB.obras.map(x => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nome)}</option>`).join('')}</select></div>
        <div class="step-t">3 · Arquivos</div>
        <div class="tipos">${tiposMostrar.map(([k, t, s]) => `<div class="tipo ${val(k) ? 'on' : ''}"><b>${t}</b><small>${s}</small><div class="st">${val(k) ? '✓ ' + resumoTipo(k, val(k)) : 'aguardando'}</div></div>`).join('')}</div>
        ${imp.lendo ? `<div class="note-box lendo" id="imp-lendo" role="status"><span class="sync"><i></i></span>${esc(imp.lendo)}</div>` : ''}
        <label class="drop" id="drop" for="imp-file">
          ${IC.up}<b>Toque para escolher ou arraste os arquivos aqui</b>
          <small>Planilhas do Prevision (.xls/.xlsx), o Controle de Medição (.xlsx) e o PDF dos RDOs (últimos 30 dias). Podem ser enviados todos de uma vez.</small>
        </label>
        <input type="file" id="imp-file" multiple accept=".xls,.xlsx,.csv,.pdf" hidden>
        ${imp.arquivos.length ? `<div class="check">${imp.arquivos.map(a => `<div class="${a.erro ? 'er' : 'ok'}"><i>${a.erro ? '×' : '✓'}</i><span><b>${esc(a.nome)}</b> → ${a.erro ? esc(a.erro) : esc(a.tipoNome)}</span></div>`).join('')}</div>` : ''}
        ${Object.keys(imp.dados).length ? `<div class="step-t">4 · Conferência</div><div class="check">${conferenciaImport(o, imp).map(([k, t]) => `<div class="${k}"><i>${k === 'ok' ? '✓' : k === 'av' ? '!' : '×'}</i><span>${t}</span></div>`).join('')}</div>
          <div class="field" style="max-width:260px"><label for="imp-corte">Data de corte</label><input class="inp" type="date" id="imp-corte" value="${imp.corte || o.dataCorte}"></div>
          <div class="step-t">5 · Atualizar</div>
          <div class="bar-actions"><button class="btn" id="imp-aplicar" ${imp.lendo ? 'disabled' : ''}>Salvar rascunho da obra ${esc(o.codigo)}</button><button class="btn sec2" id="imp-limpar">Descartar</button></div>
          <div class="note-box">A carga é gravada como <b>rascunho</b>: Planejamento e Diretoria veem em seguida; o cliente só depois de <b>Publicar para o cliente</b> na tela da obra.</div>` : ''}
      </div>
      <div class="card card-pad steps">
        <div class="step-t">Último carregamento</div>
        <div class="meta" style="margin:0"><span>Obra <b>${esc(o.codigo)}</b></span><span>Data de corte <b>${dBR(o.dataCorte)}</b></span><span>Financeiro atualizado em <b>${o.dataCorteFinanceiro ? dBR(o.dataCorteFinanceiro) : '—'}</b></span><span>Publicado ao cliente até <b>${dBR(o.publicadoAte)}</b></span><span>${(o.tarefas || []).length} tarefas · ${(o.curva || []).length} pontos de curva · ${(o.rdos || []).length} RDOs</span></div>
      </div>`;
  }
  function resumoTipo(k, d) {
    if (k === 'curva' || k === 'financeiro.curva') return `${d.length} meses`;
    if (k === 'mensal' || k === 'financeiro.mensal') return `${d.length} meses${d[0] && d[0].origem === 'semanal' ? ' (somando as semanas)' : ''}`;
    if (k === 'tarefas' || k === 'financeiro.tarefas') return `${d.length} tarefas`;
    if (k === 'cronograma') return `${d.length} linhas`;
    if (k === 'rdos') return `${d.length} RDOs${S.imp && S.imp.dados.fotos ? ' · ' + S.imp.dados.fotos.length + ' fotos' : S.imp && S.imp.lendo ? ' · lendo as fotos…' : ''}`;
    if (k === 'medicao') return `${d.resumo && d.resumo.totalContrato ? moeda(d.resumo.totalContrato) + ' · ' : ''}${d.boletins.length} ${d.boletins.length === 1 ? 'boletim' : 'boletins'}`;
    return '';
  }
  // Código da obra pelo nome do arquivo ("Curva S - 207 - ...", "Cronograma_-_208_-_...") ou pelo nome da raiz ("208 - Fibrasa ...")
  const codigoEm = s => { const m = String(s || '').replace(/_/g, ' ').match(/(?:^|[\s-])(\d{3,4})\s+-\s/); return m ? m[1] : null; };
  function identidadeImport(o, imp) {
    const out = [], d = imp.dados, nomes = imp.nomes || {}, cod = String(o.codigo);
    const raizObra = norm => { const r = (o.tarefas || []).find(t => t.nivel === 1); return r ? norm(r.tarefa) : null; };
    const n = x => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const confere = (rotulo, achado, como) => {
      if (achado === null || achado === undefined) return;
      out.push(achado === cod ? ['ok', `${rotulo}: obra ${cod} (${como}).`] : ['er', `${rotulo} é da obra ${achado} (${como}), não da obra ${cod}. Arquivo não aplicado.`]);
    };
    Object.entries(nomes).forEach(([tipo, nome]) => confere({ curva: 'Curva S', mensal: 'Progresso mensal', tarefas: 'Progresso por tarefas', cronograma: 'Cronograma', rdos: 'PDF de RDOs' }[tipo] || tipo, codigoEm(nome), 'pelo nome do arquivo'));
    const raizT = d.tarefas && d.tarefas.find(t => t.nivel === 1), raizC = d.cronograma && d.cronograma.find(l => l.nivel === 1);
    [['Progresso por tarefas', raizT && raizT.tarefa], ['Cronograma', raizC && raizC.nome]].forEach(([rot, nome]) => {
      if (!nome) return;
      const c = codigoEm(nome + ' ');
      if (c) confere(rot, c, 'pelo nome da tarefa raiz');
      else if (raizObra(n) && n(nome) !== raizObra(n)) out.push(['er', `${rot}: a tarefa raiz "${nome}" não é a da obra ${cod} ("${(o.tarefas || []).find(t => t.nivel === 1).tarefa}"). Arquivo não aplicado.`]);
    });
    if (raizT && raizC && n(raizT.tarefa) !== n(raizC.nome)) out.push(['er', 'Cronograma e Progresso por tarefas têm tarefas raiz diferentes: são de obras ou versões diferentes.']);
    if (d.rdos && d.rdos.length) { const c = codigoEm((d.rdos.at(-1).obra || '').replace(/^(\d{3,4})\s+(?!-)/, '$1 - ')); if (c) confere('PDF de RDOs', c, 'pelo cabeçalho do RDO'); }
    // Progresso mensal não traz identificação: confere com a Curva S (base acumulada mês a mês).
    // O semanal somado em meses reparte as semanas da virada do mês pelos dias: tolerância maior (até ~1,5 ponto na 207).
    const curva = d.curva || o.curva || [];
    if (d.mensal && curva.length) {
      const sem = d.mensal.some(m => m.origem === 'semanal'), tol = sem ? 0.02 : 0.002, nome = sem ? 'Progresso semanal' : 'Progresso mensal';
      let acc = 0, ruins = 0, comp = 0;
      d.mensal.forEach(m => { acc += m.base || 0; const p = curva.find(x => x.data.slice(0, 7) === m.mes); if (p) { comp++; if (Math.abs((p.base || 0) - acc) > tol) ruins++; } });
      out.push(comp && !ruins ? ['ok', `${nome} confere com a Curva S (base acumulada ${sem ? 'equivalente' : 'igual'} em ${comp} meses).`] : ['er', `${nome} não confere com a Curva S${d.curva ? ' enviada' : ' da obra'} (${ruins} de ${comp} meses com base diferente): pode ser de outra obra ou de outra linha de base.`]);
    }
    if (d.cronograma && d.tarefas) {
      const rc = raizC, rt = raizT;
      if (rc && rt && Math.abs(rc.realizado - rt.realizado) > 0.001) out.push(['av', `Cronograma (${pct(rc.realizado, 2)}) e Progresso por tarefas (${pct(rt.realizado, 2)}) mostram realizados diferentes: exporte os dois no mesmo dia.`]);
    }
    return out;
  }
  function conferenciaImport(o, imp) {
    const out = identidadeImport(o, imp), d = imp.dados;
    if (d.curva) {
      const ult = [...d.curva].reverse().find(p => p.realizado > 0);
      const fim = d.curva.at(-1);
      out.push([Math.abs(fim.base - 1) < 0.001 ? 'ok' : 'av', `Curva S: ${d.curva.length} pontos, de ${dBR(d.curva[0].data)} a ${dBR(fim.data)}. Base fecha em ${pct(fim.base, 2)}. Último realizado ${ult ? pct(ult.realizado, 2) : '—'}.`]);
      const mono = d.curva.every((p, i) => !i || p.base >= d.curva[i - 1].base - 1e-6);
      out.push([mono ? 'ok' : 'er', mono ? 'Curva base sempre crescente.' : 'A curva base diminui em algum mês: confira a exportação.']);
    }
    if (d.mensal) {
      const soma = d.mensal.reduce((s, m) => s + (m.base || 0), 0);
      out.push([Math.abs(soma - 1) < 0.002 ? 'ok' : 'av', `Progresso ${d.mensal.some(m => m.origem === 'semanal') ? 'semanal (somado por mês)' : 'mensal'}: ${d.mensal.length} meses; a base soma ${pct(soma, 2)}.`]);
      if (d.mensal.every(m => !m.idpm)) out.push(['av', 'IDPM veio zerado no arquivo; o painel calcula o IDP.']);
    }
    if (d.tarefas) {
      const raiz = d.tarefas.find(t => t.nivel === 1);
      const folhas = d.tarefas.filter(t => t.folha);
      const soma = folhas.reduce((s, t) => s + (t.previsto || 0), 0);
      out.push(['ok', `Progresso por tarefas: ${d.tarefas.length} linhas, ${folhas.length} tarefas finais, ${Math.max(...d.tarefas.map(t => t.nivel))} níveis de EAP. Realizado total ${raiz ? pct(raiz.realizado, 2) : '—'}.`]);
      out.push([Math.abs(soma - 1) < 0.001 ? 'ok' : 'av', `Pesos das tarefas finais somam ${pct(soma, 2)}${Math.abs(soma - 1) < 0.001 ? '' : ' (arredondamento do Prevision; o painel normaliza)'}.`]);
      if (d.curva && raiz) {
        const ult = [...d.curva].reverse().find(p => p.realizado > 0);
        const ok = ult && Math.abs(ult.realizado - raiz.realizado) < 0.001;
        out.push([ok ? 'ok' : 'av', ok ? 'Curva S e Progresso por tarefas mostram o mesmo realizado.' : 'Curva S e Progresso por tarefas mostram realizados diferentes: confira se foram exportados no mesmo dia.']);
      }
    }
    if (d.cronograma) {
      const c = d.cronograma, raiz = c.find(l => l.nivel === 1);
      const tar = d.tarefas || o.tarefas || [];
      const casam = c.filter(l => tar[l.linha - 1] && String(tar[l.linha - 1].tarefa).trim().toLowerCase() === l.nome.trim().toLowerCase()).length;
      out.push(['ok', `Cronograma: ${c.length} linhas. Previsto ${raiz ? pct(raiz.previsto, 2) : '—'}, realizado ${raiz ? pct(raiz.realizado, 2) : '—'}; término ${raiz ? dBR(raiz.fim) : '—'} (base ${raiz ? dBR(raiz.fimBase) : '—'}).`]);
      if (S.imp.dataEstimada) out.push(['av', `Posição estimada em ${dBR(S.imp.dataEstimada)} a partir do previsto do Prevision; o painel usa ${dBR(S.imp.corte)}. Ajuste a data de corte abaixo se precisar.`]);
      out.push([casam === c.length ? 'ok' : 'av', `${casam} de ${c.length} linhas ligadas ao Progresso por tarefas (pela posição na árvore e pelo nome).`]);
      if (tar.length && c.length < tar.length * 0.9) out.push(['av', `A exportação veio com a árvore recolhida (${c.length} de ${tar.length} linhas). Exporte com tudo expandido para o Gantt completo.`]);
      const pend = c.filter(l => /pendente de contrata/i.test(l.responsaveis || '') && l.realizado < 0.9995).length;
      if (pend) out.push(['av', `${pend} linhas com responsável "Pendente de contratação"; vão para Atenção no report.`]);
    }
    if (d.rdos) {
      const r = d.rdos;
      const par = r.at(-1)?.atividades.filter(a => /paralis/i.test(a.situacao)).length || 0;
      out.push(['ok', `RDOs: ${r.length} relatórios (nº ${r[0].numero} a ${r.at(-1).numero}), de ${dBR(r[0].data)} a ${dBR(r.at(-1).data)}. ${r.filter(x => x.status === 'aprovado').length} aprovados, ${r.filter(x => x.status !== 'aprovado').length} em preenchimento.`]);
      // "207/2026" no RDO e "CT/207/2026" no cadastro são o mesmo contrato: compara só os dígitos. A obra já foi
      // conferida pelo cabeçalho do RDO; contrato diferente é aviso, não bloqueia a carga.
      const contr = r.at(-1).contrato, dig = s => String(s || '').replace(/\D/g, '');
      if (dig(contr) && dig(o.contrato) && dig(contr) !== dig(o.contrato)) out.push(['av', `O contrato do RDO (${contr}) não coincide com o do cadastro da obra (${o.contrato}). Confira o cadastro.`]);
      out.push([par ? 'av' : 'ok', par ? `${par} frentes paralisadas no último RDO; vão para Paralisações e restrições.` : 'Nenhuma frente paralisada no último RDO.']);
    }
    return out;
  }

  let libs = null;
  function carregaLibs() {
    if (libs) return libs;
    const js = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('Não consegui carregar ' + src)); document.head.appendChild(s); });
    // bibliotecas: servidor próprio (js/vendor) quando configurado; senão, cdnjs
    const local = window.MP_CONFIG && window.MP_CONFIG.libsLocais;
    const u = { xlsx: local ? 'js/vendor/xlsx.full.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      pdf: local ? 'js/vendor/pdf.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      worker: local ? 'js/vendor/pdf.worker.min.js' : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' };
    libs = Promise.all([
      window.XLSX ? null : js(u.xlsx),
      window.pdfjsLib ? null : js(u.pdf).then(() => js(u.worker)),
    ]);
    return libs;
  }
  // Andamento da leitura: atualiza só a faixa de status (sem redesenhar a tela a cada página do PDF)
  function statusLeitura(txt) {
    if (!S.imp) return;
    S.imp.lendo = txt;
    const el = $('#imp-lendo');
    if (el && txt) el.lastChild.textContent = txt; else render();
  }
  // Fotos: só as dos RDOs dos últimos dias do PDF (o report usa 30 dias). O PDF exportado costuma trazer mais
  // de um mês; todas as fotos tornariam a carga pesada para quem abre o painel (472 fotos, 24 MB na 207).
  const JANELA_FOTOS = 35;
  async function lerArquivos(files) {
    S.imp = S.imp || { arquivos: [], dados: {}, avisos: {} };
    statusLeitura('Preparando a leitura…');
    try { await carregaLibs(); } catch (e) { statusLeitura(null); toast(e.message + '. Confira a conexão e tente de novo.'); return; }
    for (const f of files) {
      const reg = { nome: f.name };
      statusLeitura(`Lendo ${f.name}…`);
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        if (/\.pdf$/i.test(f.name)) {
          const pags = await Parsers.pdfItens(window.pdfjsLib, buf);
          const rdos = Parsers.parseRDOs(pags);
          if (!rdos.length) throw new Error('não encontrei relatórios diários neste PDF');
          // os RDOs entram já: se as fotos falharem, o texto dos relatórios não se perde
          S.imp.dados.rdos = rdos; delete S.imp.dados.fotos;
          S.imp.nomes = { ...(S.imp.nomes || {}), rdos: f.name };
          reg.tipoNome = `RDOs (${rdos.length})`;
          S.imp.arquivos = S.imp.arquivos.filter(a => a.nome !== reg.nome).concat(reg);
          S.imp.lendo = 'Lendo as fotos do PDF…'; render();
          const ultData = rdos.map(x => x.data).filter(Boolean).sort().at(-1);
          const desde = ultData ? Core.addDias(ultData, -JANELA_FOTOS) : null;
          try {
            const fotos = await Parsers.pdfFotos(window.pdfjsLib, pags, { larguraMax: 720, qualidade: 0.68, desde,
              progresso: (p, n) => statusLeitura(`Lendo as fotos do PDF: página ${p} de ${n}`) });
            S.imp.dados.fotos = fotos;
            reg.tipoNome = `RDOs (${rdos.length}) e ${fotos.length} fotos${desde && rdos.some(x => x.data < desde) ? ` dos últimos ${JANELA_FOTOS} dias` : ''}`;
          } catch (e) { reg.tipoNome = `RDOs (${rdos.length}); as fotos não puderam ser lidas (${e.message})`; }
        } else {
          const wb = Parsers.wbDe(window.XLSX, buf);
          if (Parsers.ehMedicao(wb)) {
            S.imp.dados.medicao = Parsers.parseMedicaoContrato(window.XLSX, wb);
            S.imp.nomes = { ...(S.imp.nomes || {}), medicao: f.name };
            reg.tipoNome = 'Controle de Medição';
          } else {
            const linhas = Parsers.linhasDaAba(window.XLSX, wb, wb.SheetNames[0]);
            const tipo = Parsers.tipoPlanilha(linhas);
            if (!tipo) throw new Error('não reconheci as colunas (esperado: Curva S, Progresso mensal, Progresso por tarefas ou Cronograma do Prevision)');
            const dado = tipo === 'curva' ? Parsers.parseCurva(linhas) : tipo === 'mensal' ? Parsers.parseMensal(linhas) : tipo === 'cronograma' ? Parsers.parseCronograma(linhas) : Parsers.parseTarefas(linhas);
            if ((S.impModo || 'fisico') === 'financeiro' && tipo !== 'cronograma') {
              S.imp.dados.financeiro = S.imp.dados.financeiro || {};
              S.imp.dados.financeiro[tipo] = dado;
              const chaveFin = 'financeiro.' + tipo;
              S.imp.nomes = { ...(S.imp.nomes || {}), [chaveFin]: f.name };
              reg.tipoNome = TIPOS.find(t => t[0] === chaveFin)[1];
            } else {
              S.imp.dados[tipo] = dado;
              if (tipo === 'cronograma') S.imp.arqCrono = f.name;
              S.imp.nomes = { ...(S.imp.nomes || {}), [tipo]: f.name };
              reg.tipoNome = TIPOS.find(t => t[0] === tipo)[1];
            }
          }
        }
      } catch (e) { reg.erro = e.message; }
      S.imp.arquivos = S.imp.arquivos.filter(a => a.nome !== reg.nome).concat(reg);
      S.imp.lendo = null; render();
    }
    if (S.imp.dados.rdos) S.imp.corte = S.imp.dados.rdos.map(x => x.data).filter(Boolean).sort().at(-1);
    if (S.imp.dados.cronograma) {
      // posição do cronograma: estimada pelo "Previsto (%)" da raiz contra a curva S, nunca depois de hoje
      const o = DB.obras.find(x => x.id === ($('#imp-obra') ? $('#imp-obra').value : S.obraId)) || DB.obras[0];
      const raiz = S.imp.dados.cronograma.find(l => l.nivel === 1);
      const tmp = { ...o, curva: S.imp.dados.curva || o.curva, tarefas: S.imp.dados.tarefas || o.tarefas };
      const est = raiz ? Core.estimaDataRef(tmp, raiz.previsto) : null;
      const hoje = new Date().toISOString().slice(0, 10);
      S.imp.corte = est ? (est > hoje ? hoje : est) : (S.imp.corte || hoje);
      S.imp.dataEstimada = est;
    }
    S.imp.lendo = null;
    render();
    toast('Arquivos lidos. Confira e atualize o painel.');
  }
  async function aplicarImport() {
    if (S.imp && S.imp.lendo) { toast('Aguarde terminar a leitura dos arquivos.'); return; }
    const obraId = $('#imp-obra').value;
    const oSel = DB.obras.find(x => x.id === obraId);
    const erros = oSel ? conferenciaImport(oSel, S.imp).filter(x => x[0] === 'er') : [];
    if (erros.length) { toast('Há arquivos que não conferem com a obra selecionada. Corrija antes de salvar.'); return; }
    const d = S.imp.dados;
    const corte = ($('#imp-corte') && $('#imp-corte').value) || S.imp.corte;
    if (!corte) { toast('Informe a data de corte.'); return; }
    const pacote = { ...d, cronograma: d.cronograma ? { arquivo: S.imp.arqCrono, linhas: d.cronograma, dataRef: corte } : undefined };
    const fontes = Object.fromEntries(S.imp.arquivos.filter(a => !a.erro).map(a => [a.tipoNome, a.nome]));
    const ok = await gravando('Gravando a carga…', prog => API.salvarCarga(obraId, pacote, corte, fontes, prog));
    if (!ok) return;
    S.imp = null; S.obraId = obraId; S.view = 'obra';
    await recarregar();
    toast('Rascunho salvo. Confira e publique para o cliente.');
  }

  // ---------- acessos (administrador) ----------
  function viewAcessos() {
    const lista = API.listarAcessos();
    const obras = DB.obras;
    const ed = S.editAcesso;
    const chkObras = (pref, sel) => obras.length ? `<div class="chips">${obras.map(o => `<label class="chk"><input type="checkbox" name="${pref}" value="${esc(o.id)}" ${sel.includes(o.id) ? 'checked' : ''}> ${esc(o.codigo)} · ${esc(o.nome)}</label>`).join('')}</div>` : '<small>Nenhuma obra cadastrada.</small>';
    const form = (id, u) => `
      <form class="card card-pad steps" id="${id}" novalidate>
        <div class="step-t">${u ? 'Editar acesso' : 'Novo acesso'}</div>
        <div class="two"><div class="field"><label for="${id}-nome">Nome</label><input class="inp" id="${id}-nome" value="${esc(u ? u.nome : '')}" required></div>
          <div class="field"><label for="${id}-email">E-mail</label><input class="inp" id="${id}-email" type="email" value="${esc(u ? u.email : '')}" ${u ? 'disabled' : 'required'}></div></div>
        <div class="field" style="max-width:320px"><label for="${id}-perfil">Perfil</label><select class="inp" id="${id}-perfil" ${u && u.eu ? 'disabled' : ''}>
          ${['cliente', 'diretoria', 'admin'].map(k => `<option value="${k}" ${(u ? u.perfil : 'cliente') === k ? 'selected' : ''}>${PERFIL[k]}</option>`).join('')}</select>
          <small class="hint">Cliente vê só as obras marcadas e só o que foi publicado. Diretoria vê todas as obras, inclusive rascunhos. Administrador também grava.</small></div>
        <div class="field" data-obras-de="${id}"><label>Obras liberadas (cliente)</label>${chkObras(id + '-obra', u ? u.obras || [] : [])}</div>
        <div class="bar-actions"><button class="btn" type="submit">${u ? 'Salvar alterações' : 'Criar acesso e gerar senha'}</button>${u ? '<button class="btn sec2" type="button" data-editacesso="">Cancelar</button>' : ''}</div>
      </form>`;
    const uEd = ed ? lista.find(u => u.id === ed) : null;
    return `
      <div><div class="kicker">Administração</div><h1 class="h1">Acessos</h1>
      <p class="sub">Pedidos chegam em <b>${esc(EMAIL)}</b>. Aprovado o pedido, crie o acesso aqui: o painel gera a senha e prepara o e-mail de envio.</p></div>
      <div class="tw"><table class="t"><thead><tr><th>Pessoa</th><th>Perfil</th><th>Obras</th><th>Senha emitida</th><th></th></tr></thead><tbody>
      ${lista.map(p => `<tr>
        <td><b style="font-weight:600">${esc(p.nome)}</b>${p.eu ? ' <small>(você)</small>' : ''}<small>${esc(p.email || '')}</small></td>
        <td>${PERFIL[p.perfil]}</td>
        <td>${p.perfil === 'cliente' ? ((p.obras || []).length ? esc(p.obras.join(', ')) : '<small>nenhuma</small>') : '<small>todas</small>'}</td>
        <td>${p.senhaEm ? new Date(p.senhaEm).toLocaleDateString('pt-BR') : '—'}</td>
        <td class="acoes"><button class="more" data-editacesso="${p.id}">Editar</button>${p.eu ? '' : `<button class="more" data-novasenha="${p.id}">Nova senha</button><button class="more neg" data-remover="${p.id}">Remover</button>`}</td>
      </tr>`).join('')}
      </tbody></table></div>
      ${uEd ? form('f-edacesso', uEd) : form('f-acesso', null)}`;
  }
  function lerFormAcesso(id) {
    return { nome: $(`#${id}-nome`).value, email: $(`#${id}-email`).value, perfil: $(`#${id}-perfil`).value,
      obras: $$(`input[name="${id}-obra"]:checked`).map(i => i.value) };
  }

  // ---------- cadastro de obra ----------
  function viewNovaObra(o) {
    const f = (id, rot, v, tipo = 'text', extra = '') => `<div class="field"><label for="${id}">${rot}</label><input class="inp" id="${id}" type="${tipo}" value="${esc(v || '')}" ${extra}></div>`;
    const pz = (o && o.prazoContratual) || {};
    return `
      <div><div class="kicker">Administração</div><h1 class="h1">${o ? 'Cadastro da obra ' + esc(o.codigo) : 'Nova obra'}</h1><p class="sub">${o ? 'Os dados de cadastro aparecem no painel e no report.' : 'Depois de salvar, envie os arquivos do Prevision e o PDF dos RDOs em Alimentar.'}</p></div>
      <form class="card card-pad steps" id="f-obra" data-novo="${o ? '0' : '1'}" novalidate>
        <div class="two">${f('o-codigo', 'Código da obra', o && o.codigo, 'text', o ? 'disabled' : 'required placeholder="ex.: 212" inputmode="numeric"')}${f('o-nome', 'Nome da obra', o && o.nome, 'text', 'required')}</div>
        <div class="two">${f('o-cliente', 'Cliente', o && o.cliente)}${f('o-contratante', 'Contratante', o && o.contratante)}</div>
        <div class="two">${f('o-cidade', 'Cidade/UF', o && o.cidade)}${f('o-contrato', 'Contrato', o && o.contrato)}</div>
        ${f('o-local', 'Endereço', o && o.local)}
        <div class="two">${f('o-resp', 'Responsável em campo', o && o.responsavel)}<div class="two">${f('o-ini', 'Início contratual', pz.inicio, 'date')}${f('o-fim', 'Fim contratual', pz.fim, 'date')}</div></div>
        <div class="bar-actions"><button class="btn" type="submit">Salvar obra</button><button class="btn sec2" type="button" data-go="${o ? 'obra' : 'portfolio'}">Cancelar</button></div>
      </form>`;
  }

  // ---------- report ----------
  // "Em outubro (até 16/10) a obra avançou 3,4%; o plano previa 5,6% (60% do previsto)."
  function periodoTexto(r) {
    const P = r.periodo, mes = Core.mesLongo(Core.addDias(P.inicio, 1)).split(' de ')[0];
    const ader = P.aderencia === null ? '' : ` (${fmtNum(P.aderencia * 100, 0)}% do previsto)`;
    return `Em ${mes} (até ${dCurto(r.corte)}), a obra avançou <b>${pct(Math.max(0, P.real))}</b>; o plano previa ${pct(P.prev)}${ader}.`;
  }

  // ---------- PDF do report ----------
  // O report já é desenhado em folhas A4 (retrato e, para o mapa de avanço em dupla, paisagem): cada folha da
  // tela vira uma página do PDF, do mesmo tamanho (html2canvas + jsPDF). Dentro do claude.ai entrega pelo
  // recurso de download; no site, baixa direto. A impressão do navegador segue o mesmo desenho (CSS @page).
  let libsPdf = null;
  function carregaLibsPdf() {
    if (libsPdf) return libsPdf;
    const js = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('Não consegui carregar ' + src)); document.head.appendChild(s); });
    libsPdf = Promise.all([
      window.html2canvas ? null : js('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      window.jspdf ? null : js('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
    ]).catch(e => { libsPdf = null; throw e; });
    return libsPdf;
  }
  async function baixarPdf(btn) {
    // dentro do claude.ai usa o recurso de download; no site, baixa direto pelo navegador
    let dl = null;
    if (window.self !== window.top) { try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; } }
    const salvar = dl ? a => dl.save(a) : async ({ filename, data }) => {
      const u = URL.createObjectURL(data), a = document.createElement('a'); a.href = u; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    };
    const rotulo = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando PDF…';
    try {
      await carregaLibsPdf();
      try { await document.fonts.ready; } catch (e) {}
      const paper = $('#paper');
      const { jsPDF } = window.jspdf;
      let pdf = null;
      const folhas = $$('.folha', paper);
      for (let i = 0; i < folhas.length; i++) {
        btn.textContent = `Gerando PDF… ${i + 1}/${folhas.length}`;
        const land = folhas[i].classList.contains('paisagem');
        const canvas = await window.html2canvas(folhas[i], { scale: 2, backgroundColor: '#FFFFFF', useCORS: true, logging: false,
          onclone: doc => {
            // na tela a folha pode estar reduzida (zoom) para caber; no PDF vai em tamanho real
            doc.querySelectorAll('.folha').forEach(f => { f.style.zoom = '1'; f.style.boxShadow = 'none'; });
            // html2canvas desenha o conteúdo de <details> fechado: tira antes de capturar
            doc.querySelectorAll('details:not([open]) > :not(summary)').forEach(e => e.remove());
          } });
        const W = land ? 297 : 210, H = land ? 210 : 297;
        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: land ? 'landscape' : 'portrait' });
        else pdf.addPage('a4', land ? 'landscape' : 'portrait');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, W, H);
      }
      const o = DB.obras.find(x => x.id === S.obraId) || obrasDoUsuario()[0];
      const corte = (paper.dataset.corte || new Date().toISOString().slice(0, 10));
      await salvar({ filename: `Report-Obra-${o ? o.codigo : ''}-${corte}.pdf`, data: pdf.output('blob') });
    } catch (e) {
      const c = e && e.code;
      if (c !== 'declined') toast(c === 'rate_limited' ? 'Já existe um download aguardando confirmação.' : 'Não consegui gerar o PDF. Tente de novo.');
    } finally { btn.disabled = false; btn.textContent = rotulo; }
  }

  // ---------- Valor agregado: cartões e legenda dos termos (report e aba Obra) ----------
  const GLOSSARIO_VA = `<dl class="rx-glos" aria-label="O que significam SPI, EV e PV">
      <div><dt>SPI</dt><dd>Índice de desempenho de prazo = <b>EV ÷ PV</b>. 1,00 = no ritmo do plano; abaixo de 1,00 = atrasado; acima = adiantado.</dd></div>
      <div><dt>EV</dt><dd>Valor agregado: quanto vale, em R$, o serviço <b>efetivamente executado</b> até a data de corte.</dd></div>
      <div><dt>PV</dt><dd>Valor planejado: quanto valeria, em R$, o serviço que o cronograma <b>previa executar</b> até a data de corte.</dd></div>
    </dl>`;
  function cartoesVA(rf, o) {
    const F = rf.faturamento, cls = rf.spi === null ? '' : rf.sem.k === 'critico' ? 'crit' : rf.sem.k === 'atencao' ? 'warn' : 'ok';
    const spi = `<div class="rx-card ac-${cls || 'real'}"><small>SPI (EV ÷ PV)</small><b class="rx-card-v ${cls}">${rf.spi !== null ? fmtNum(rf.spi, 2) : '—'}</b>
      <span class="rx-card-s">${rf.spi !== null ? `EV ${Core.moedaCurta(rf.ev)} ÷ PV ${Core.moedaCurta(rf.pv)}` : 'envie a Curva S financeira (Prevision · Financeiro VA)'}</span></div>`;
    const cards = F ? [
      `<div class="rx-card ac-base"><small>Valor do contrato</small><b class="rx-card-v">${Core.moedaCurta(F.contratual)}</b><span class="rx-card-s">BAC · Controle de Medição</span></div>`,
      `<div class="rx-card ac-plan"><small>Medido acumulado</small><b class="rx-card-v">${Core.moedaCurta(F.medido)}</b><span class="rx-card-s">${F.pctMedido !== null ? pct(F.pctMedido, 1) + ' do contrato' : ''}${F.ultimaMedicao ? ` · última: ${esc(F.ultimaMedicao.replace(/\s*\(.*$/, ''))}` : ''}</span></div>`,
      `<div class="rx-card ac-base"><small>Saldo a medir</small><b class="rx-card-v">${Core.moedaCurta(F.saldo)}</b><span class="rx-card-s">${F.pctMedido !== null ? pct(1 - F.pctMedido, 1) + ' do contrato' : 'contrato − medido'}</span></div>`,
      spi,
    ] : [
      `<div class="rx-card ac-real"><small>EV · valor agregado</small><b class="rx-card-v">${Core.moedaCurta(rf.ev)}</b><span class="rx-card-s">executado até ${dCurto(o.dataCorteFinanceiro || o.dataCorte)}</span></div>`,
      `<div class="rx-card ac-plan"><small>PV · valor planejado</small><b class="rx-card-v">${Core.moedaCurta(rf.pv)}</b><span class="rx-card-s">previsto para a data</span></div>`,
      spi,
    ];
    return `<div class="rx-cards${cards.length === 3 ? ' c3' : ''}">${cards.join('')}</div>`;
  }
  // a Curva S financeira do Prevision nem sempre está na base do contrato (207: orçamento da obra × contrato Machine)
  const notaEscalaVA = rf => rf.escala === 'orcamento' ? `% do orçamento no Prevision (${Core.moedaCurta(rf.totalCurva)}), não do contrato` : '% do valor do contrato';

  // Avanço por atividade (report e aba Obra): farol (realizado ÷ planejado da própria atividade, faixas da obra)
  // e barra de % com a marca do planejado na data. Coluna de peso só quando os pesos são válidos.
  const legFarol = '<em class="rx-fa-lg"><span><i class="rx-fa ok"></i>No prazo</span><span><i class="rx-fa atencao"></i>Atenção</span><span><i class="rx-fa critico"></i>Crítico</span><span><i class="rx-fa neutro"></i>A iniciar</span></em>';
  // partes = true (report): cada frente de 1º nível é uma parte que a paginação pode levar para a folha seguinte
  function atividadesHTML(ativ, o, partes) {
    const lim = v => Math.max(0, Math.min(100, (v || 0) * 100));
    const comPeso = ativ.every(a => a.peso !== null && a.peso !== undefined);
    const farol = a => {
      if (a.feito >= 0.9995) return { k: 'ok', t: 'Concluída' };
      if (a.plan < 0.005) return a.feito < 0.005 ? { k: 'neutro', t: 'A iniciar' } : { k: 'ok', t: 'Adiantada' };
      const s = Core.semaforo(a.feito / a.plan, o.faixas);
      return { k: s.k, t: `${s.k === 'critico' ? 'Crítico' : s.t} · ${pct(a.feito, 0)} feito de ${pct(a.plan, 0)} planejado` };
    };
    const linha = (a, nv) => {
      const f = farol(a), fs = a.temFilhos ? a.filhos() : [], id = 'rx' + a.eap;
      const cel = `<span class="rx-av-nm" style="--nv:${nv}"><i class="rx-av-cv">${fs.length ? IC.right : ''}</i><span>${esc(a.nome)}</span></span>
        ${comPeso ? `<span class="rx-av-ps">${a.peso === null || a.peso === undefined ? '—' : pct(a.peso, 1)}</span>` : ''}
        <span class="rx-av-fa"><i class="rx-fa ${f.k}" title="${esc(f.t)}"></i></span>
        <span class="rx-av-br"><span class="rx-pb"><i style="width:${lim(a.feito)}%"></i><em style="left:${lim(a.plan)}%"></em></span><b>${fmtNum(lim(a.feito), 0)}%</b></span>`;
      const p = partes && nv === 0 ? ' data-parte' : '';
      return fs.length
        ? `<details class="rx-av-n" data-k="${id}"${p}${S.abertos[id] ? ' open' : ''}><summary class="rx-av-r n${nv}">${cel}</summary><div class="rx-av-k">${fs.map(c => linha(c, nv + 1)).join('')}</div></details>`
        : `<div class="rx-av-r n${nv}"${p}>${cel}</div>`;
    };
    return `<div class="rx-av${comPeso ? '' : ' sem-peso'}"${partes ? ' data-partes-box' : ''}>
      <div class="rx-av-r rx-av-h"><span>Atividade</span>${comPeso ? '<span class="rx-av-ps">Peso</span>' : ''}<span class="rx-av-fa">Status</span><span class="rx-av-br">Realizado <i class="rx-av-tk"></i> planejado na data</span></div>
      ${ativ.map(a => linha(a, 0)).join('')}</div>`;
  }

  function viewReport() {
    const base = DB.obras.find(x => x.id === S.obraId) || obrasDoUsuario()[0];
    if (!base || !temDados(visaoDaObra(base))) return `<div class="card card-pad"><p class="sub" style="margin:0">Ainda não há dados para o report desta obra.</p></div>`;
    const o = visaoDaObra(base);
    const r = Core.calc(o);
    const X = Core.resumoExecutivo(o, r, base.destaques || []);
    const P = r.prazo;
    const cp = Core.comparaPlano(r.desvio);
    const slipFim = P.contrFim && P.fimCron ? diff(P.contrFim, P.fimCron) : null;
    const dias = n => `${n > 0 ? '+' : '−'}${Math.abs(n)} d`;
    const lim01 = v => Math.max(0, Math.min(100, (v || 0) * 100));
    // Cartões (padrão de cartão de indicador do Power BI): rótulo · valor · referência. Uma cor de série por cartão,
    // a mesma do gráfico (realizado = navy, planejado = azul, base = azul claro); vermelho/verde só no desvio.
    // cor do desvio segue o farol da obra (dentro da faixa "em dia" o desvio não é pintado de alerta)
    const dsv = r.sem.k === 'critico' ? 'crit' : r.sem.k === 'atencao' ? 'warn' : cp.dir > 0 ? 'ok' : '';
    const cards = [
      { k: 'Realizado', ac: 'real', v: pct(r.real),
        x: `<span class="rx-pb rx-pb-k" aria-hidden="true"><i style="width:${lim01(r.real)}%"></i><em style="left:${lim01(r.prevCorte)}%"></em></span>`,
        s: `posição de ${dBR(r.corte)}` },
      { k: 'Planejado', ac: 'plan', v: pct(r.prevCorte), s: r.baseCorte !== null && r.baseCorte !== undefined ? `base ${pct(r.baseCorte)}` : 'cronograma atual' },
      { k: 'Comparado ao plano', ac: dsv || 'real', cls: dsv,
        v: cp.dir === 0 ? 'Em linha' : pp(r.desvio), s: r.idp ? `IDP ${fmtNum(r.idp, 2)}` : 'IDP indisponível' },
      { k: P.contrFim ? 'Término previsto (base)' : 'Término previsto', ac: 'base', v: P.contrFim ? dBR(P.contrFim) : P.fimCron ? dBR(P.fimCron) : '—',
        s: P.contrFim ? `cronograma atual ${dBR(P.fimCron)}${slipFim ? ` · <b class="${slipFim > 0 ? 'warn' : 'ok'}">${dias(slipFim)}</b>` : ''}` : 'cronograma atual (sem linha de base)', html: true },
    ];

    const ativ = Core.atividades(r);
    const fimMs = `<li class="fim"><span class="rx-ms-d">${P.fimCron ? dCurto(P.fimCron) : '—'}</span><span class="rx-ms-n">Término da obra</span><span class="rx-ms-v ${slipFim > 0 ? 'neg' : ''}">${slipFim ? dias(slipFim) : 'na base'}</span></li>`;
    const marcosSec = `<section class="rx-s rx-box"><h2><i class="rx-ic">${IC.rflag}</i>Próximos marcos<em><button class="rx-see" type="button" data-go="obra">Ver cronograma →</button></em></h2>
              <ul class="rx-ms">${X.marcos.lista.slice(0, 4).map(m => `<li class="${m.situacao}"><span class="rx-ms-d">${m.data ? dCurto(m.data) : 'a definir'}</span><span class="rx-ms-n">${m.codigo ? `<em>${esc(m.codigo)}</em> ` : ''}${esc(m.nome)}${m.interface ? ' <i title="Interface com o cliente">cliente</i>' : ''}</span><span class="rx-ms-v ${m.slip > 0 ? 'neg' : ''}">${m.situacao === 'vencido' ? 'vencido' : m.slip ? dias(m.slip) : ''}</span></li>`).join('')}${fimMs}</ul>
            </section>`;
    const rf = Core.calcFinanceiro(o, r.corte);
    const financeiroSec = rf ? `<section class="rx-s rx-box" data-bloco="va"><h2><i class="rx-ic">${IC.search}</i>Valor Agregado<em>SPI ${rf.spi !== null ? fmtNum(rf.spi, 2) : '—'} · CPI ${rf.cpi !== null ? fmtNum(rf.cpi, 2) : 'sem custo real'}</em></h2>
              ${cartoesVA(rf, o)}
              ${GLOSSARIO_VA}
              ${rf.pts ? `<div class="legend rx-leg"><span><i class="sw sw-real"></i>Realizado (EV)</span><span><i class="sw sw-prev"></i>Planejado (PV)</span><span><i class="sw sw-base"></i>Base</span><span class="note">${notaEscalaVA(rf)}</span></div>
              <div class="chart" id="ch-fin-r"></div>` : ''}
            </section>` : '';
    const corta = (t, n) => (t || '').length > n ? t.slice(0, n - 3).replace(/\s+\S*$/, '') + '…' : (t || '');
    const temCritico = X.atencao.some(a => /paralis|atras/i.test(a.tag));
    const atencaoSec = X.atencao.length ? `<section class="rx-s rx-box${temCritico ? ' rx-alert' : ''}"><h2><i class="rx-ic">${IC.alert}</i>Pontos de atenção${X.atencaoMais ? `<em>+${X.atencaoMais} na aba Obra</em>` : ''}<em><button class="rx-see" type="button" data-go="obra">Ver todos →</button></em></h2>
              <ul class="rx-at">${X.atencao.map(a => `<li><span class="rx-dot ${/paralis|atras/i.test(a.tag) ? 'crit' : 'warn'}">${a.tag}</span><span class="rx-at-t"><b>${esc(a.titulo)}</b><small>${esc(corta(a.det, 96))}</small></span></li>`).join('')}</ul>
            </section>` : '';
    const mapas = Core.mapasDaObra(o, r);
    const folhasMapa = folhasDoMapa(mapas, o, r);
    const rodape = `<footer class="fl-pe"><span>Machine · Planejamento e Controle</span><span>Report · Obra ${esc(o.codigo)} · posição de ${dBR(r.corte)}</span><span class="fl-n"></span></footer>`;
    return `
      <div class="head-row no-print"><div><div class="kicker">Report</div><h1 class="h1">Obra ${esc(o.codigo)} · ${dBR(r.corte)}</h1>
        <p class="sub">Folhas A4 retrato, sempre os mesmos blocos na mesma ordem${mapas.length ? ', com o mapa de avanço no fim' : ''}. O detalhe completo fica na aba Obra.</p></div>
        <div class="bar-actions"><button class="btn" id="bt-pdf">Baixar PDF</button><a class="btn sec2" href="${mailto('', `Report de planejamento · Obra ${o.codigo} · ${dBR(r.corte)}`, `Prezados,\n\nSegue o report de planejamento da obra ${o.codigo} · ${o.nome}, com posição de ${dBR(r.corte)}.\n\nO painel completo está disponível em ${SITE()} (acesso com e-mail e senha).\n\nAtenciosamente,\nPlanejamento · Machine`)}">Enviar por e-mail</a></div></div>
      <div class="folhas" id="paper" data-corte="${r.corte}" data-obra="${esc(o.codigo)}">
      <article class="folha retrato exec" data-fluxo="1">
        <header class="rx-hd">
          <div class="rx-hd-top">
            <div class="rx-brand"><img src="${LOGO}" alt="Machine"><i></i><span>Report</span><i></i><span>Obra ${esc(o.codigo)}</span></div>
            <div class="rx-hd-label">Relatório de<br>acompanhamento</div>
          </div>
          <div class="rx-hd-main">
            <div class="rx-hd-id">
              <h1>${esc(o.nome)}</h1>
              <div class="rx-hd-sub"><span>${esc(o.cliente)}</span><i></i><span>${esc(o.cidade)}</span><span class="rx-st ${r.sem.k}">${esc(r.sem.t)}</span></div>
            </div>
            <dl class="rx-hd-meta">
              <dt>Data de corte</dt><dd>${dBR(r.corte)}</dd>
              <dt>Prazo contratual</dt><dd>${P.contrFim ? `${dBR(P.contrIni)} – ${dBR(P.contrFim)}` : '—'}</dd>
            </dl>
          </div>
        </header>
        <div class="fl-corpo">
          <div class="rx-top" data-bloco="topo">
            ${X.manchete ? `<div class="rx-lead"><i class="rx-lead-ic">${IC.trend}</i><p>${esc(X.manchete)}</p></div>` : ''}
            <div class="rx-cards">${cards.map(k => `<div class="rx-card ac-${k.ac}"><small>${k.k}</small><b class="rx-card-v ${k.cls || ''}">${k.v}</b>${k.x || ''}<span class="rx-card-s">${k.html ? k.s : esc(k.s)}</span></div>`).join('')}</div>
          </div>

          <section class="rx-s rx-box" data-bloco="curva"><h2><i class="rx-ic">${IC.search}</i>Curva S física e avanço mensal<em>% do total da obra</em></h2>
            <div class="legend rx-leg"><span class="rx-leg-g">Acumulado</span><span><i class="sw sw-real"></i>Realizado</span><span><i class="sw sw-prev"></i>Planejado</span><span><i class="sw sw-base"></i>Base</span>
              <span class="rx-leg-g">No mês</span><span><i class="sw sw-breal"></i>Realizado</span><span><i class="sw sw-bplan"></i>Planejado</span><span class="note">${Core.mesCurto(r.corte)} parcial até ${dCurto(r.corte)}</span></div>
            <div class="chart" id="ch-combo-r"></div>
          </section>

          ${financeiroSec}

          <div class="rx-row half" data-bloco="marcos">${marcosSec}${atencaoSec}</div>

          ${ativ.length ? `<section class="rx-s" data-bloco="atividades" data-partes><h2><i class="rx-ic">${IC.rlist}</i>Avanço por atividade${legFarol}</h2>${atividadesHTML(ativ, o, true)}</section>` : ''}

          ${X.fotos.length ? `<section class="rx-s" data-bloco="fotos" data-partes><h2><i class="rx-ic">${IC.photo}</i>Registro fotográfico<em>${X.fotos.length} ${X.fotos.length === 1 ? 'foto' : 'fotos'} · ${dCurto(X.fotos[0].data)} a ${dCurto(X.fotos[X.fotos.length - 1].data)}</em></h2>
            <div class="rx-fotos" data-partes-box>${X.fotos.map(f => `<figure data-parte><img src="${f.src}" alt="${esc(legendaCurta(f) || `Foto do RDO nº ${f.rdo}, ${dBR(f.data)}`)}"><figcaption><small>${dCurto(f.data)} · RDO ${f.rdo}</small>${legendaCurta(f) ? `<span>${esc(legendaCurta(f))}</span>` : ''}</figcaption></figure>`).join('')}</div>
          </section>` : ''}
        </div>
        ${rodape}
      </article>
      ${folhasMapa}
      </div>`;
  }

  // ---------- folhas A4 do report ----------
  // O conteúdo entra todo na 1ª folha; depois de desenhado (gráficos prontos), paginar() move para folhas novas os
  // blocos que não couberam. Blocos com data-partes (atividades, fotos) podem ser divididos entre folhas pelas suas
  // partes (data-parte). As folhas do mapa de avanço já nascem prontas (uma planta por folha retrato, ou duas por
  // folha paisagem). No fim, numera "página x de y".
  function cabCurto(fl) {
    return `<header class="fl-hd2"><div class="rx-brand"><img src="${LOGO}" alt="Machine"><i></i><span>Report</span><i></i><span>Obra ${esc(fl.dataset.obra)}</span></div><span>Posição de ${dBR(fl.dataset.corte)}</span></header>`;
  }
  let fontesProntas = false;
  // graf: { id do gráfico: altura => redesenha } — para o gráfico ocupar a sobra da folha
  function paginar(graf) {
    const fl = $('#paper.folhas'); if (!fl || fl.dataset.paginado) return;
    // medida só com as fontes finais; quando carregarem, redesenha o report uma vez
    if (!fontesProntas && document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { fontesProntas = true; if (S.view === 'report') render(); });
    else fontesProntas = true;
    const rod = fl.querySelector('.fl-pe').outerHTML;
    const nova = () => { const a = document.createElement('article'); a.className = 'folha retrato exec'; a.dataset.fluxo = '1'; a.innerHTML = cabCurto(fl) + '<div class="fl-corpo"></div>' + rod; return a; };
    let folha = fl.querySelector('.folha[data-fluxo]');
    for (let guarda = 0; folha && guarda < 30; guarda++) {
      const corpo = folha.querySelector('.fl-corpo');
      if (corpo.scrollHeight <= corpo.clientHeight + 1) { const prox = folha.nextElementSibling; folha = prox && prox.dataset.fluxo ? prox : null; continue; }
      const lim = corpo.getBoundingClientRect().top + corpo.clientHeight;
      const blocos = [...corpo.children];
      let i = blocos.findIndex(b => b.getBoundingClientRect().bottom > lim + 0.5);
      if (i < 0) { folha = null; break; }
      const b = blocos[i], seguinte = nova();
      folha.after(seguinte);
      const destino = seguinte.querySelector('.fl-corpo');
      let mover = blocos.slice(i);
      if (b.hasAttribute('data-partes')) {
        const box = b.querySelector('[data-partes-box]'), partes = box ? [...box.querySelectorAll(':scope > [data-parte]')] : [];
        let k = partes.findIndex(p => p.getBoundingClientRect().bottom > lim + 0.5);
        // fotos em grade: corta no começo da linha
        while (k > 0 && Math.abs(partes[k - 1].getBoundingClientRect().top - partes[k].getBoundingClientRect().top) < 2) k--;
        if (k === 0 && i === 0 && partes.length > 1) k = 1; // nada coube e não há para onde empurrar: leva ao menos uma parte
        if (k > 0) {
          const cont = b.cloneNode(true);
          const h = cont.querySelector('h2'); if (h && !h.querySelector('.fl-cont')) h.insertAdjacentHTML('beforeend', '<em class="fl-cont">continuação</em>');
          [...cont.querySelector('[data-partes-box]').querySelectorAll(':scope > [data-parte]')].slice(0, k).forEach(p => p.remove());
          partes.slice(k).forEach(p => p.remove());
          mover = [cont, ...blocos.slice(i + 1)];
        }
      } else if (i === 0) { seguinte.remove(); folha = null; break; } // bloco maior que a folha: fica (não há como dividir)
      destino.append(...mover);
      folha = seguinte;
    }
    const todas = $$('.folha', fl);
    // folha com sobra embaixo e um gráfico: o gráfico cresce para ocupar parte da sobra (até 460 px de altura)
    todas.forEach(f => {
      const corpo = f.querySelector('.fl-corpo'), ult = corpo && corpo.lastElementChild; if (!ult) return;
      const sobra = corpo.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(corpo).paddingBottom) || 0) - ult.getBoundingClientRect().bottom;
      const ch = $$('.chart[id]', corpo).find(c => graf && graf[c.id]);
      if (ch && sobra > 40) { const h = ch.getBoundingClientRect().height; graf[ch.id](Math.round(Math.min(460, h + sobra - 16))); }
    });
    todas.forEach((f, k) => { const n = f.querySelector('.fl-n'); if (n) n.textContent = `Página ${k + 1} de ${todas.length}`; });
    fl.dataset.paginado = '1';
    ajustaZoomFolhas();
  }
  // Na tela, a folha A4 é reduzida para caber na largura disponível (celular, folha paisagem); impressa e no PDF, tamanho real
  function ajustaZoomFolhas() {
    const fl = $('#paper.folhas'); if (!fl) return;
    const disp = fl.clientWidth;
    $$('.folha', fl).forEach(f => { f.style.zoom = ''; const w = f.offsetWidth; f.style.zoom = w > disp ? String(Math.floor(disp / w * 1000) / 1000) : ''; });
  }

  // ---------- mapa de avanço: folhas do report ----------
  const COR_MAPA = { executado: 'ok', executando: 'andamento', 'a-executar': 'pendente' };
  // opts.maxH (px): altura máxima da planta na folha — a largura encolhe junto, para as áreas (em %) seguirem a imagem
  function plantaHTML(m, opts = {}) {
    const larg = opts.maxH ? `;width:min(100%, ${Math.round(opts.maxH * m.w / m.h)}px)` : '';
    return `<div class="mp-planta" style="aspect-ratio:${m.w} / ${m.h}${larg}"><img src="${m.img}" alt="Planta: ${esc(m.titulo || 'mapa de avanço')}" width="${m.w}" height="${m.h}">
      ${m.zonas.map(z => `<i class="mp-z ${COR_MAPA[z.st]}${opts.sel === z.id ? ' sel' : ''}" data-zona="${esc(z.id)}" style="left:${z.x * 100}%;top:${z.y * 100}%;width:${z.w * 100}%;height:${z.h * 100}%"><b>${z.n}</b></i>`).join('')}</div>`;
  }
  const legMapa = m => `<div class="mp-leg">${m.resumo.map(x => `<span><i class="mp-sw ${COR_MAPA[x.k]}"></i>${x.t}${m.zonas.length ? ` <small>${x.n} ${x.n === 1 ? 'área' : 'áreas'} · ${pct(x.area, 0)}</small>` : ''}</span>`).join('')}</div>`;
  const tabelaMapa = (m, comp) => m.zonas.length ? `<table class="mp-tab${comp ? ' comp' : ''}"><thead><tr><th>Nº</th><th>Área</th>${comp ? '' : '<th>Atividade</th>'}<th class="n">Avanço</th><th>Situação</th></tr></thead><tbody>
    ${m.zonas.map(z => `<tr><td class="mp-n"><i class="mp-sw ${COR_MAPA[z.st]}"></i>${z.n}</td><td>${esc(z.rotulo || '—')}</td>${comp ? '' : `<td>${z.ativ ? esc(z.ativ.nome) : '<small>situação informada no painel</small>'}</td>`}<td class="n">${z.feito === null ? '—' : pct(z.feito, 0)}</td><td>${Core.MAPA_ST[z.st]}</td></tr>`).join('')}</tbody></table>` : '';
  function folhasDoMapa(mapas, o, r) {
    if (!mapas.length) return '';
    const cab = `<header class="rx-hd mp-hd"><div class="rx-hd-top"><div class="rx-brand"><img src="${LOGO}" alt="Machine"><i></i><span>Mapa de avanço físico</span><i></i><span>Obra ${esc(o.codigo)}</span></div>
      <div class="rx-hd-label">Posição de ${dBR(r.corte)}</div></div></header>`;
    const rod = `<footer class="fl-pe"><span>Machine · Planejamento e Controle</span><span>Mapa de avanço · Obra ${esc(o.codigo)} · ${esc(o.nome)}</span><span class="fl-n"></span></footer>`;
    const titulo = m => `<h2 class="mp-tt"><small>Frente de serviço</small>${esc(m.titulo || 'Sem título')}</h2>`;
    // alturas máximas da planta (px na folha): retrato desconta a tabela de áreas; paisagem, lado a lado ou empilhadas
    const ret = mapas.filter(m => m.pagina !== 'paisagem').map(m => `<article class="folha retrato exec mp-folha">${cab}
      <div class="fl-corpo">${titulo(m)}${plantaHTML(m, { maxH: Math.max(380, 820 - 29 * m.zonas.length) })}${legMapa(m)}${tabelaMapa(m, false)}</div>${rod}</article>`);
    const pais = mapas.filter(m => m.pagina === 'paisagem'), pares = [];
    for (let i = 0; i < pais.length; i += 2) pares.push(pais.slice(i, i + 2));
    // plantas largas (mais de 1,6 × a altura) ficam uma sobre a outra, ocupando a largura da folha deitada
    const land = pares.map(par => { const emp = par.every(m => m.w / m.h >= 1.6); return `<article class="folha paisagem exec mp-folha">${cab}
      <div class="fl-corpo"><div class="mp-dupla${emp ? ' empilha' : ''}">${par.map(m => `<div class="mp-meia">${titulo(m)}${plantaHTML(m, { maxH: emp ? (par.length > 1 ? 235 : 520) : 520 })}${legMapa(m)}</div>`).join('')}</div></div>${rod}</article>`; });
    return ret.concat(land).join('');
  }

  // ---------- render ----------
  function render() {
    const app = $('#app');
    if (S.carregando) { app.innerHTML = viewCarregando(); return; }
    if (!S.user) {
      app.innerHTML = (S.view === 'configurar' ? viewConfigurar() : S.view === 'pedido' ? viewPedido() : viewLoginProd()) + modalHTML();
      bind(); return;
    }
    if (!S.obraId || !DB.obras.some(o => o.id === S.obraId)) S.obraId = obrasDoUsuario()[0]?.id;
    if (!ehAdmin() && ['alimentar', 'acessos', 'nova-obra', 'editar-obra', 'senha', 'github'].includes(S.view)) S.view = 'obra';
    const base = DB.obras.find(x => x.id === S.obraId);
    if (base && base.fotosPendentes && ['obra', 'report'].includes(S.view)) carregarFotos(base);
    const v = S.view === 'portfolio' ? viewPortfolio() : S.view === 'obra' ? viewObra() : S.view === 'alimentar' ? viewAlimentar()
      : S.view === 'acessos' ? viewAcessos() : S.view === 'nova-obra' ? viewNovaObra() : S.view === 'editar-obra' ? viewNovaObra(base)
      : S.view === 'senha' ? viewSenha() : S.view === 'github' ? viewGithub() : viewReport();
    app.innerHTML = shell(v) + lightbox() + modalHTML();
    bind(); desenha();
  }
  const carregandoFotos = {};
  async function carregarFotos(base) {
    if (carregandoFotos[base.id]) return;
    carregandoFotos[base.id] = true;
    try {
      const fotos = await API.carregarFotos(base.id);
      const o = DB.obras.find(x => x.id === base.id); if (o) { o.fotos = fotos; o.fotosPendentes = false; }
    } catch (e) { toast('Não consegui carregar as fotos: ' + e.message); const o = DB.obras.find(x => x.id === base.id); if (o) o.fotosPendentes = false; }
    carregandoFotos[base.id] = false;
    render();
  }
  function desenha() {
    const base = DB.obras.find(x => x.id === S.obraId);
    if (!base || !temDados(visaoDaObra(base))) return;
    const o = visaoDaObra(base), r = Core.calc(o);
    const el1 = $('#ch-curva'); if (el1 && el1.closest('details').open) Core.chartCurvaS(el1, o, r);
    const el2 = $('#ch-mensal'); if (el2 && el2.closest('details').open) Core.chartMensal(el2, o, r);
    const el3 = $('#ch-efetivo'); if (el3 && r.campo && el3.closest('details').open) Core.chartEfetivo(el3, r.campo);
    // report: as folhas têm largura fixa (A4), os gráficos são desenhados uma vez, antes da paginação
    const el4 = $('#ch-combo-r'); if (el4 && !el4.firstChild) Core.chartCombo(el4, o, r);
    const rf = Core.calcFinanceiro(o, r.corte);
    const rFin = rf && rf.pts ? { pts: rf.pts, corte: r.corte, real: rf.evFrac, prevCorte: rf.pvFrac, baseCorte: rf.baseFrac, desvio: (rf.evFrac || 0) - (rf.pvFrac || 0) } : null;
    const el5 = $('#ch-fin'); if (el5 && rFin && el5.closest('details').open) Core.chartCurvaS(el5, o, rFin);
    const el6 = $('#ch-fin-r'); if (el6 && rFin && !el6.firstChild) Core.chartCurvaS(el6, o, rFin, { compacto: true });
    const graf = {};
    if (el4) graf['ch-combo-r'] = h => Core.chartCombo(el4, o, r, { altura: h });
    if (el6 && rFin) graf['ch-fin-r'] = h => Core.chartCurvaS(el6, o, rFin, { compacto: true, altura: h });
    if (S.view === 'report') { paginar(graf); ajustaZoomFolhas(); }
  }

  let tt;
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function bind() {
    const atualiza = () => { if (S.user) DB.obras = API.listar(); };
    $$('[data-go]').forEach(b => b.onclick = () => { atualiza(); S.view = b.dataset.go; S.menu = false; S.loginErro = null; S.loginMsg = null; S.editAcesso = null; render(); window.scrollTo(0, 0); });
    $$('[data-obra]').forEach(b => b.onclick = () => { atualiza(); if (S.obraId !== b.dataset.obra) S.mapaEd = null; S.obraId = b.dataset.obra; S.view = 'obra'; render(); window.scrollTo(0, 0); });
    $$('[data-toast]').forEach(b => b.onclick = () => toast(b.dataset.toast));
    const bt = $('#bt-tema'); if (bt) bt.onclick = () => { tema = TEMAS[(TEMAS.indexOf(tema) + 1) % 3]; lsSet('mp_tema', tema); aplicaTema(tema); render(); };
    const bu = $('#bt-user'); if (bu) bu.onclick = e => { e.stopPropagation(); S.menu = !S.menu; render(); };
    $$('[data-act="sair"]').forEach(b => b.onclick = () => { API.sair(); S.user = null; DB.obras = []; S.menu = false; S.view = 'login'; S.imp = null; render(); });

    // ----- entrar -----
    const fl = $('#f-login'); if (fl) fl.onsubmit = async e => {
      e.preventDefault(); S.loginErro = null; S.loginMsg = null;
      const em = $('#l-email').value.trim(), se = $('#l-senha').value;
      if (!em || !se) { S.loginErro = 'Informe e-mail e senha.'; render(); $('#l-email').value = em; return; }
      const b = fl.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Entrando…';
      try { const u = await API.entrar(em, se); await abrirSessao(u); }
      catch (er) { S.loginErro = er.message; render(); $('#l-email').value = em; }
    };
    const fe = $('#l-esqueci'); if (fe) fe.onclick = () => { const em = $('#l-email') && $('#l-email').value.trim(); fe.href = mailtoSenha(em); };
    const fp = $('#f-pedido'); if (fp) fp.onsubmit = e => {
      e.preventDefault(); S.loginErro = null;
      const v = id => ($('#' + id).value || '').trim();
      if (!v('p-nome') || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('p-email')) || !v('p-empresa')) { S.loginErro = 'Informe nome, e-mail válido e empresa.'; const keep = ['p-nome', 'p-email', 'p-empresa', 'p-vinculo', 'p-obras', 'p-motivo'].map(id => [id, $('#' + id).value]); render(); keep.forEach(([id, x]) => { $('#' + id).value = x; }); return; }
      const corpo = `Solicito acesso ao Painel de Obras Machine.\n\nNome: ${v('p-nome')}\nE-mail: ${v('p-email')}\nEmpresa: ${v('p-empresa')}\nVínculo: ${v('p-vinculo')}\nObra(s): ${v('p-obras') || '—'}\nJustificativa: ${v('p-motivo') || '—'}\n\nAtenciosamente,\n${v('p-nome')}`;
      location.href = mailto(EMAIL, `Painel de Obras Machine · Solicitação de acesso · ${v('p-nome')}`, corpo);
      S.loginMsg = 'Pedido preparado no seu programa de e-mail. Após o envio, o Planejamento avalia e responde no e-mail informado.'; render();
    };

    // ----- configuração inicial -----
    const fc = $('#f-config'); if (fc) fc.onsubmit = async e => {
      e.preventDefault(); S.loginErro = null;
      const v = id => $('#' + id).value;
      const vals = ['c-nome', 'c-email', 'c-senha', 'c-conf', 'c-token'].map(id => [id, v(id)]);
      const volta = msg => { S.loginErro = msg; render(); vals.forEach(([id, x]) => { $('#' + id).value = x; }); };
      if (!v('c-nome').trim() || !v('c-email').trim()) return volta('Informe nome e e-mail.');
      if (v('c-senha').length < 12) return volta('A senha precisa ter pelo menos 12 caracteres.');
      if (v('c-senha') !== v('c-conf')) return volta('As duas senhas não são iguais.');
      if (!v('c-token').trim()) return volta('Informe o token do GitHub.');
      const lembrar = $('#c-lembrar').checked, limpar = $('#c-limpar').checked, V = Object.fromEntries(vals);
      S.carregando = true; S.ocupado = 'Validando o token…'; render();
      try {
        await API.github.definir(V['c-token'], lembrar);
        const u = await API.configurar({ nome: V['c-nome'], email: V['c-email'], senha: V['c-senha'], limparHistorico: limpar }, m => { S.ocupado = m; render(); });
        S.ocupado = null; await abrirSessao(u);
        toast('Painel protegido. O site publicado atualiza em cerca de um minuto.');
      } catch (er) { S.carregando = false; S.ocupado = null; volta(er.message); }
    };

    // ----- conta e publicação -----
    const fs = $('#f-senha'); if (fs) fs.onsubmit = async e => {
      e.preventDefault();
      const a = $('#s-nova').value, b = $('#s-conf').value;
      if (a.length < 12) { toast('A senha precisa ter pelo menos 12 caracteres.'); return; }
      if (a !== b) { toast('As duas senhas não são iguais.'); return; }
      const ok = await gravando('Gravando a senha…', () => API.trocarMinhaSenha(a).then(() => true));
      if (ok) { S.view = 'portfolio'; render(); toast('Senha alterada. Use a nova senha no próximo acesso.'); }
    };
    const ft = $('#f-token'); if (ft) ft.onsubmit = async e => {
      e.preventDefault(); const t = $('#g-token').value.trim(); if (!t) { toast('Cole o token.'); return; }
      try { const r = await API.github.definir(t, $('#g-lembrar').checked); toast(`Token válido: ${r.repo} (${r.branch}).`); render(); } catch (er) { toast(er.message); }
    };
    const gl = $('#g-limpar'); if (gl) gl.onclick = () => { API.github.limpar(); toast('Token removido deste navegador.'); render(); };
    const gc = $('#g-compactar'); if (gc) gc.onclick = () => confirma({ titulo: 'Compactar histórico', texto: 'O repositório passa a ter só a versão atual. Não afeta os dados do painel.', ok: 'Compactar' },
      async () => { const ok = await gravando('Compactando o histórico…', prog => API.compactarHistorico(prog).then(() => true)); if (ok) toast('Histórico compactado.'); });
    const fm = $('#f-mtoken'); if (fm) fm.onsubmit = async e => {
      e.preventDefault(); const t = $('#m-token').value.trim(); if (!t) return;
      const m = S.modal;
      try { await API.github.definir(t, $('#m-lembrar').checked); S.modal = null; render(); if (m && m.repetir) m.repetir(); }
      catch (er) { S.modal = { ...m, erro: er.message }; render(); }
    };
    $$('[data-fecha]').forEach(b => b.onclick = () => { const m = S.modal; S.modal = null; render(); if (m && m.cancelar) m.cancelar(); });
    $$('[data-copia]').forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copia); toast('Senha copiada.'); } catch (e) { toast('Selecione a senha e copie manualmente.'); } });
    const mok = $('#m-ok'); if (mok) mok.onclick = () => { const f = S.modal && S.modal.acao; S.modal = null; render(); if (f) f(); };

    // ----- publicação da obra -----
    $$('[data-publicar]').forEach(b => b.onclick = () => {
      const sim = b.dataset.publicar === '1'; const id = S.obraId;
      const o = DB.obras.find(x => x.id === id);
      confirma(sim ? { titulo: 'Publicar para o cliente', texto: `O cliente da obra ${esc(o.codigo)} passa a ver a posição de <b>${dBR(o.dataCorte)}</b>.`, ok: 'Publicar' }
        : { titulo: 'Recolher publicação', texto: `O cliente deixa de ver a obra ${esc(o.codigo)} até uma nova publicação.`, ok: 'Recolher', perigo: true },
        async () => { const ok = await gravando(sim ? 'Publicando…' : 'Recolhendo…', () => API.publicar(id, sim)); if (ok) { await recarregar(); toast(sim ? 'Publicado. O cliente verá esta posição em cerca de um minuto.' : 'Publicação recolhida.'); } });
    });

    // ----- acessos -----
    $$('[data-editacesso]').forEach(b => b.onclick = () => { S.editAcesso = b.dataset.editacesso || null; render(); const f = $('#f-edacesso') || $('#f-acesso'); if (f) f.scrollIntoView({ block: 'center' }); });
    const syncObras = id => { const sel = $(`#${id}-perfil`), box = $(`[data-obras-de="${id}"]`); if (sel && box) { box.hidden = sel.value !== 'cliente'; sel.onchange = () => { box.hidden = sel.value !== 'cliente'; }; } };
    syncObras('f-acesso'); syncObras('f-edacesso');
    const fa = $('#f-acesso'); if (fa) fa.onsubmit = async e => {
      e.preventDefault(); const d = lerFormAcesso('f-acesso');
      if (d.perfil === 'cliente' && !d.obras.length) { toast('Marque ao menos uma obra para o cliente.'); return; }
      const r = await gravando('Criando o acesso…', () => API.criarAcesso(d));
      if (r) { S.modal = { tipo: 'senha', nova: true, ...r }; render(); }
    };
    const fd = $('#f-edacesso'); if (fd) fd.onsubmit = async e => {
      e.preventDefault(); const d = lerFormAcesso('f-edacesso'); const id = S.editAcesso;
      if (d.perfil === 'cliente' && !d.obras.length) { toast('Marque ao menos uma obra para o cliente.'); return; }
      const ok = await gravando('Salvando o acesso…', prog => API.atualizarAcesso(id, d, prog).then(() => true));
      if (ok) { S.editAcesso = null; await recarregar(); toast('Acesso atualizado.'); }
    };
    $$('[data-novasenha]').forEach(b => b.onclick = () => {
      const u = API.listarAcessos().find(x => x.id === b.dataset.novasenha);
      confirma({ titulo: 'Emitir nova senha', texto: `A senha atual de <b>${esc(u.nome)}</b> deixa de valer.`, ok: 'Emitir nova senha' },
        async () => { const r = await gravando('Emitindo nova senha…', () => API.redefinirSenha(u.id)); if (r) { S.modal = { tipo: 'senha', nova: false, ...r }; render(); } });
    });
    $$('[data-remover]').forEach(b => b.onclick = () => {
      const u = API.listarAcessos().find(x => x.id === b.dataset.remover);
      confirma({ titulo: 'Remover acesso', texto: `<b>${esc(u.nome)}</b> perde o acesso. As chaves de todas as obras são trocadas e os dados recifrados (pode levar alguns minutos).`, ok: 'Remover acesso', perigo: true },
        async () => { const ok = await gravando('Removendo o acesso…', prog => API.removerAcesso(u.id, prog).then(() => true)); if (ok) { await recarregar(); toast('Acesso removido e chaves trocadas.'); } });
    });

    // ----- cadastro de obra -----
    const fo = $('#f-obra'); if (fo) fo.onsubmit = async e => {
      e.preventDefault();
      const novo = fo.dataset.novo === '1';
      const v = id => ($('#' + id).value || '').trim();
      if (!v('o-codigo') || !v('o-nome')) { toast('Informe código e nome da obra.'); return; }
      const ini = v('o-ini') || null, fim = v('o-fim') || null;
      if (ini && fim && fim < ini) { toast('O fim contratual é anterior ao início.'); return; }
      const dados = { novo, id: novo ? v('o-codigo') : S.obraId, codigo: v('o-codigo'), nome: v('o-nome'), cliente: v('o-cliente'), contratante: v('o-contratante'), cidade: v('o-cidade'),
        contrato: v('o-contrato'), local: v('o-local'), responsavel: v('o-resp'), prazo_inicio: ini, prazo_fim: fim, prazo_dias: ini && fim ? Core.diff(ini, fim) + 1 : null };
      const o = await gravando(novo ? 'Cadastrando a obra…' : 'Salvando o cadastro…', () => API.salvarObra(dados));
      if (!o) return;
      S.obraId = o.id; S.view = novo ? 'alimentar' : 'obra'; await recarregar();
      toast(novo ? 'Obra cadastrada. Agora envie os arquivos do período.' : 'Cadastro atualizado.');
    };
    $$('details.sec').forEach(d => d.addEventListener('toggle', () => { S.abertos[d.dataset.sec] = d.open; if (d.open) desenha(); }));
    // no report, abrir uma frente muda a altura da folha: redesenha para repaginar
    $$('details.rx-av-n').forEach(d => d.addEventListener('toggle', () => { const antes = !!S.abertos[d.dataset.k]; S.abertos[d.dataset.k] = d.open; if (S.view === 'report' && antes !== d.open) render(); }));
    bindMapa();
    $$('[data-abre]').forEach(b => b.onclick = () => { const id = b.dataset.abre; S.abertos[id] = !S.abertos[id]; render(); });
    $$('[data-filtro]').forEach(b => b.onclick = () => { S.filtroTarefas = b.dataset.filtro; S.verTodas = false; render(); });
    $$('[data-modo]').forEach(b => b.onclick = () => { S.impModo = b.dataset.modo; render(); });
    $$('[data-vertodas]').forEach(b => b.onclick = () => { S.verTodas = !S.verTodas; render(); });
    const fi = $('#imp-file'); if (fi) fi.onchange = () => { if (fi.files.length) lerArquivos([...fi.files]); };
    const dr = $('#drop');
    if (dr) {
      ['dragenter', 'dragover'].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); dr.classList.add('on'); }));
      ['dragleave', 'drop'].forEach(ev => dr.addEventListener(ev, e => { e.preventDefault(); dr.classList.remove('on'); }));
      dr.addEventListener('drop', e => { if (e.dataTransfer.files.length) lerArquivos([...e.dataTransfer.files]); });
    }
    const so = $('#imp-obra'); if (so) so.onchange = () => { S.obraId = so.value; };
    const ap = $('#imp-aplicar'); if (ap) ap.onclick = aplicarImport;
    const li = $('#imp-limpar'); if (li) li.onclick = () => { S.imp = null; render(); };
    const pdf = $('#bt-pdf'); if (pdf) pdf.onclick = () => baixarPdf(pdf);
    $$('[data-fotordo]').forEach(b => b.onclick = () => { const v = b.dataset.fotordo; S.fotoRdo = v === 'todos' ? 'todos' : +v; S.fotosTodas = false; render(); });
    $$('[data-fotostodas]').forEach(b => b.onclick = () => { S.fotosTodas = !S.fotosTodas; render(); });
    $$('[data-lb]').forEach(b => b.onclick = () => { S.lb = +b.dataset.lb; render(); });
    $$('[data-lbx]').forEach(b => b.onclick = () => { S.lb = null; render(); });
    $$('[data-lbnav]').forEach(b => b.onclick = () => { S.lb += +b.dataset.lbnav; render(); });
    $$('[data-estrela]').forEach(b => b.onclick = async () => {
      const o = DB.obras.find(x => x.id === S.obraId); const atual = [...(o.destaques || [])];
      const id = b.dataset.estrela, i = atual.indexOf(id);
      if (i < 0 && atual.length >= 4) { toast('O report usa até 4 fotos. Tire uma estrela antes.'); return; }
      const novo = i >= 0 ? atual.filter(x => x !== id) : atual.concat(id);
      const ok = await gravando('Salvando a seleção de fotos…', () => API.destacar(o.id, novo).then(() => true));
      if (!ok) return;
      o.destaques = novo; render();
      toast(i >= 0 ? 'Foto retirada do report.' : `Foto marcada para o report (${novo.length} de 4).`);
    });
  }
  function confirma(m, acao) { S.modal = { tipo: 'confirma', ...m, acao }; render(); }
  document.addEventListener('click', e => { if (S.menu && !e.target.closest('.menu') && !e.target.closest('#bt-user')) { S.menu = false; render(); } });
  document.addEventListener('keydown', e => {
    if (S.lb === null) return;
    if (e.key === 'Escape') { S.lb = null; render(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const b = $(`[data-lbnav="${e.key === 'ArrowRight' ? 1 : -1}"]`); if (b && !b.disabled) b.click(); }
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(desenha, 150); });

  // ---------- início ----------
  async function abrirSessao(u) {
    S.user = { ...u, ini: iniciais(u.nome), rotulo: ROTULO[u.perfil] || u.perfil };
    S.carregando = true; S.ocupado = 'Abrindo os dados das obras…'; S.loginErro = null; render();
    try { DB.obras = await API.carregarObras(); }
    catch (e) { API.sair(); S.user = null; S.loginErro = e.message; S.view = 'login'; S.carregando = false; S.ocupado = null; render(); return; }
    S.carregando = false; S.ocupado = null;
    const h = location.hash || '';
    const mo = h.match(/obra-([\w-]+)/); if (mo && DB.obras.some(o => o.id === mo[1])) S.obraId = mo[1];
    if (!S.obraId || !DB.obras.some(o => o.id === S.obraId)) S.obraId = DB.obras[0]?.id;
    S.view = /report/.test(h) ? 'report' : /alimentar/.test(h) && ehAdmin() ? 'alimentar' : DB.obras.length > 1 || ehAdmin() ? 'portfolio' : 'obra';
    render(); window.scrollTo(0, 0);
  }
  (async () => {
    render();
    try {
      const est = await API.estado();
      if (est === 'configurar') { S.view = 'configurar'; S.carregando = false; render(); return; }
      const u = await API.sessao();
      if (u) { await abrirSessao(u); return; }
    } catch (e) { S.loginErro = 'Não consegui abrir o painel: ' + e.message; }
    S.view = 'login'; S.carregando = false; render();
  })();
})();

