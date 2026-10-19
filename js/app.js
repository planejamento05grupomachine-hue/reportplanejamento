// ============================================================
// Machine · Painel de Obras — app (telas e navegação).
// Fase 1 (protótipo): dados em memória (js/seed.js) e login por perfil de demonstração.
// Fase 2: a mesma interface lê do Supabase (js/api.js) com e-mail e senha reais.
// ============================================================
(function () {
  'use strict';
  const { esc, fmtNum, pct, pp, dBR, dCurto, mesLongo, diaSemana, diff, nomeBonito } = Core;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- estado ----------
  // Produção: dados e login vêm do Supabase (js/api.js + js/config.js). Sem configuração: demonstração.
  const PROD = !!(window.API && window.API.ativo);
  const DB = PROD ? { obras: [] } : JSON.parse(JSON.stringify(window.SEED));
  const ROTULO = { admin: 'Planejamento · Administrador', diretoria: 'Diretoria · todas as obras', cliente: 'Cliente' };
  const iniciais = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const temDados = o => !!(o && !o.semDados && o.curva && o.curva.length && o.tarefas && o.tarefas.length);
  const USUARIOS = [
    { id: 'adm', nome: 'Carlos Castro', ini: 'CC', perfil: 'admin', rotulo: 'Planejamento · Administrador', obras: '*' },
    { id: 'dir', nome: 'Diretoria Machine', ini: 'DM', perfil: 'diretoria', rotulo: 'Diretoria · todas as obras', obras: '*' },
    { id: 'cli', nome: 'Visão do cliente', ini: 'VC', perfil: 'cliente', rotulo: 'Cliente · só o publicado', obras: '*' },
  ];
  const S = { user: null, view: 'login', carregando: PROD, loginMsg: null, loginErro: null, acessos: null, obraId: null, filtroTarefas: 'atrasada', verTodas: false, abertos: {}, menu: false, imp: null, fotoRdo: null, fotosTodas: false, lb: null };
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* sem armazenamento: segue sem lembrar */ } };

  const podeVer = (u, o) => u.obras === '*' || u.obras.includes(o.id);
  const obrasDoUsuario = () => PROD ? DB.obras : DB.obras.filter(o => podeVer(S.user, o));
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
    const crumb = S.view === 'obra' && o ? `<b>${esc(o.codigo)} · ${esc(o.nome)}</b>` : S.view === 'alimentar' ? '<b>Alimentar dados</b>' : S.view === 'report' ? `<b>Report${o ? ' · ' + esc(o.codigo) : ''}</b>` : S.view === 'acessos' ? '<b>Acessos</b>' : S.view === 'nova-obra' ? '<b>Nova obra</b>' : '<b>Portfólio</b>';
    const itens = [
      ['portfolio', 'Portfólio', IC.home, !ehCliente() || obrasDoUsuario().length > 1],
      ['obra', 'Obra', IC.obra, true],
      ['alimentar', 'Alimentar', IC.up, ehAdmin()],
      ['report', 'Report', IC.doc, true],
      ['acessos', 'Acessos', IC.users, PROD && ehAdmin()],
    ].filter(i => i[3]);
    return `
      <header class="mast"><div class="mast-in">
        <img src="${LOGO}" alt="Machine · Realizações com base sólida">
        <span class="ttl">Painel de Obras</span><span class="crumb">${crumb}</span>
        <span class="sp"></span>
        ${PROD ? '' : '<span class="demo-flag" title="Dados reais da Obra 207, login de demonstração">Protótipo</span>'}
        <button class="iconbtn" id="bt-tema" aria-label="Tema: ${tema === 'auto' ? 'automático' : tema === 'light' ? 'claro' : 'escuro'}">${tema === 'auto' ? IC.auto : tema === 'light' ? IC.sun : IC.moon}</button>
        <button class="avatar" id="bt-user" aria-haspopup="menu" aria-expanded="${S.menu}" aria-label="Conta: ${esc(u.nome)}">${esc(u.ini)}</button>
      </div></header>
      ${S.menu ? `<div class="menu" role="menu"><div class="who"><b>${esc(u.nome)}</b><small>${esc(u.rotulo)}</small></div>
        ${PROD ? '<button role="menuitem" data-senha="1">Trocar minha senha</button>' : '<button role="menuitem" data-act="trocar">Trocar perfil</button>'}<button role="menuitem" data-act="sair">Sair</button></div>` : ''}
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

  // ---------- login (produção) ----------
  const cartaoLogin = corpo => `<div class="login"><div class="login-card"><div class="lm"><img src="${LOGO}" alt="Machine · Realizações com base sólida"></div><div class="lgb">${corpo}</div></div></div>`;
  function viewLoginProd() {
    return cartaoLogin(`
      <div><div class="kicker">Painel de Obras · Planejamento</div><h1 class="h1" style="font-size:28px">Entrar</h1>
        <p class="sub" style="margin-top:8px">Use o e-mail e a senha do seu convite.</p></div>
      <form id="f-login" class="steps" novalidate>
        <div class="field"><label for="l-email">E-mail</label><input class="inp" id="l-email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="l-senha">Senha</label><input class="inp" id="l-senha" type="password" autocomplete="current-password" required></div>
        ${S.loginErro ? `<div class="note-box err" role="alert">${esc(S.loginErro)}</div>` : ''}
        ${S.loginMsg ? `<div class="note-box" role="status">${esc(S.loginMsg)}</div>` : ''}
        <div class="bar-actions"><button class="btn" type="submit">Entrar</button><button class="more" type="button" id="l-esqueci">Esqueci a senha</button></div>
      </form>
      <p class="sec-lead" style="margin:0">Acesso só por convite. Para pedir acesso, fale com o planejamento da Machine.</p>`);
  }
  function viewSenha() {
    return cartaoLogin(`
      <div><div class="kicker">Painel de Obras · Planejamento</div><h1 class="h1" style="font-size:28px">${API.tipoLink === 'invite' ? 'Crie sua senha' : 'Nova senha'}</h1>
        <p class="sub" style="margin-top:8px">Mínimo de 8 caracteres. Use uma senha só sua.</p></div>
      <form id="f-senha" class="steps" novalidate>
        <div class="field"><label for="s-nova">Nova senha</label><input class="inp" id="s-nova" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label for="s-conf">Repita a senha</label><input class="inp" id="s-conf" type="password" autocomplete="new-password" minlength="8" required></div>
        ${S.loginErro ? `<div class="note-box err" role="alert">${esc(S.loginErro)}</div>` : ''}
        <div class="bar-actions"><button class="btn" type="submit">Salvar senha</button>${S.user ? '<button class="btn sec2" type="button" data-go="obra">Cancelar</button>' : ''}</div>
      </form>`);
  }
  const viewCarregando = () => cartaoLogin(`<div class="kicker">Painel de Obras</div><p class="sub" role="status">Carregando…</p>`);

  // ---------- login (demonstração) ----------
  function viewLogin() {
    return `<div class="login"><div class="login-card">
      <div class="lm"><img src="${LOGO}" alt="Machine · Realizações com base sólida"></div>
      <div class="lgb">
        <div><div class="kicker">Painel de Obras · Planejamento</div><h1 class="h1" style="font-size:30px">Entrar</h1>
        <p class="sub" style="margin-top:8px">Protótipo com os dados reais da Obra 207. Escolha um perfil para ver o que cada acesso enxerga.</p></div>
        ${USUARIOS.map(u => `<button class="prof" data-login="${u.id}"><span class="av">${u.ini}</span><span><b>${esc(u.nome)}</b><small>${esc(u.rotulo)}</small></span>${IC.right}</button>`).join('')}
        <div class="note-box">Na versão publicada, cada pessoa entra com <b>e-mail e senha</b> próprios, recebidos por convite. O cliente só enxerga a obra dele e só o que você publicou.</div>
      </div></div></div>`;
  }

  // ---------- portfólio ----------
  function viewPortfolio() {
    const vazias = obrasDoUsuario().filter(o => !temDados(visaoDaObra(o)));
    const obras = obrasDoUsuario().filter(o => temDados(visaoDaObra(o))).map(o => ({ o, r: Core.calc(visaoDaObra(o)) }));
    if (!obras.length) return `<div><div class="kicker">Planejamento · Portfólio</div><h1 class="h1">Olá, ${esc(S.user.nome.split(' ')[0])}</h1></div>
      <div class="card card-pad"><p class="sub" style="margin:0">${ehAdmin() ? 'Nenhuma obra com dados ainda. Cadastre a obra e alimente os arquivos do Prevision.' : 'Ainda não há relatório publicado para você. Assim que o planejamento publicar, ele aparece aqui.'}</p>
      ${ehAdmin() ? `<div class="bar-actions" style="margin-top:12px">${vazias.length ? '' : '<button class="btn" data-go="nova-obra">Cadastrar obra</button>'}<button class="btn sec2" data-go="alimentar">Alimentar dados</button></div>` : ''}</div>`;
    const atrasadas = obras.filter(x => x.r.sem.k === 'critico').length;
    const paralis = obras.reduce((s, x) => s + (x.r.campo ? x.r.campo.paralisadas.length : 0), 0);
    const corte = obras.map(x => x.r.corte).sort().at(-1);
    const pesoTot = obras.length;
    const realMed = obras.reduce((s, x) => s + x.r.real, 0) / (pesoTot || 1);
    const prevMed = obras.reduce((s, x) => s + x.r.prevCorte, 0) / (pesoTot || 1);
    return `
      <div><div class="kicker">Planejamento · Portfólio</div><h1 class="h1">Olá, ${esc(S.user.nome.split(' ')[0])}</h1>
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
              <div><span>Vs. plano</span><b style="color:${r.desvio <= -Core.TOLERANCIA ? 'var(--crit)' : 'var(--ok)'}">${(c => (c.seta ? c.seta + ' ' : '') + c.curto)(Core.comparaPlano(r.desvio))}</b></div>
              <div><span>Término crono.</span><b>${dCurto(r.prazo.fimCron)}${r.crono && r.crono.slip ? ` <small class="${r.crono.slip > 0 ? 'neg' : 'pos'}">${r.crono.slip > 0 ? '+' : ''}${r.crono.slip}d</small>` : ''}</b></div>
              <div><span>Projeção</span><b>${r.projecao ? Core.mesCurto(r.projecao) : '—'}</b></div>
            </div>
          </button>`).join('')}
        ${vazias.map(o => `<div class="add-card" style="border-style:solid"><span><b style="font-size:16px;color:var(--ink)">${esc(o.codigo)} · ${esc(o.nome)}</b>${ehAdmin() ? 'Sem dados ainda. Use Alimentar.' : 'Sem relatório publicado.'}</span></div>`).join('')}
        ${ehAdmin() ? `<button class="add-card" ${PROD ? 'data-go="nova-obra"' : 'data-toast="No protótipo o cadastro fica desativado."'}><span><b>+</b>Cadastrar obra</span></button>` : ''}
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
    if (!temDados(o)) return `<div><div class="kicker">Obra ${esc(base.codigo)}</div><h1 class="h1">${esc(base.nome)}</h1></div>
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
              <div class="kpi"><span>Comparado ao plano</span><b class="${r.desvio <= -Core.TOLERANCIA ? 'crit' : 'ok'}">${pp(r.desvio)}</b><small>${Core.comparaPlano(r.desvio).longo}</small></div>
              <div class="kpi"><span>IDP</span><b class="${r.sem.k === 'critico' ? 'crit' : r.sem.k === 'atencao' ? 'warn' : 'ok'}">${fmtNum(r.idp, 2)}</b><small>realizado ÷ previsto</small></div>
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

    const frentes = sec('frentes', 'Avanço por frente', `${r.pacotes.length} frentes da EAP`, `
      <p class="sec-lead">Barra azul: realizado. Traço cobre: previsto na data de corte. Fundo: peso da frente na obra. Toque numa frente para abrir as etapas.</p>
      <div class="frentes">${r.pacotes.filter(p => p.peso > 0.0005).map(p => linhaFrente(p, r, 0)).join('')}</div>`);

    const tarefas = sec('tarefas', 'Tarefas', `${r.cont.atrasada} atrasadas`, blocoTarefas(r));

    const campo = c ? sec('campo', 'Campo · RDO', `nº ${c.ultimo.numero} · ${dCurto(c.ultimo.data)}`, blocoCampo(o, r, c)) : '';
    const cronoSec = r.crono ? sec('cronograma', 'Cronograma', `término ${dBR(r.crono.fimAtual)}${r.crono.slip ? ` · ${r.crono.slip > 0 ? '+' : ''}${r.crono.slip} d vs base` : ''}`, `
      <p class="sec-lead">Linhas do cronograma do Prevision${r.crono.dataRef ? `, posição de ${dBR(r.crono.dataRef)}` : ''}. Toque numa frente para abrir as etapas.${r.crono.pendentes.length ? ` <b>${r.crono.pendentes.length} ${r.crono.pendentes.length === 1 ? 'serviço pendente' : 'serviços pendentes'} de contratação.</b>` : ''}</p>
      ${!r.crono.completo && ehAdmin() ? `<div class="note-box">A exportação trouxe ${r.crono.linhas.length} de ${r.crono.total} linhas (árvore recolhida no Prevision). Para ver o cronograma inteiro aqui, exporte com todas as linhas expandidas.</div>` : ''}
      ${ganttHTML(r)}`) : '';
    const fotosSec = r.fotos.length ? sec('fotos', 'Fotos do diário de obra', `${r.fotos.length} fotos · ${new Set(r.fotos.map(f => f.rdo)).size} RDOs`, blocoFotos(base, r)) : '';
    const restr = c ? sec('restricoes', 'Paralisações e restrições', c.paralisadas.length ? `<span class="pill critico">${c.paralisadas.length} abertas</span>` : 'nenhuma', blocoRestricoes(c)) : '';
    const conf = ehAdmin() ? sec('conferencia', 'Conferência dos dados', 'só administrador', blocoConferencia(o, r), false) : '';

    return `
      ${PROD && ehAdmin() && base.cargaId ? barraPublicacao(base) : ''}
      <div class="head-row"><div style="min-width:0">
        <div class="kicker">Obra ${esc(o.codigo)} · ${esc(o.cidade)}</div>
        <h1 class="h1">${esc(o.nome)}</h1>
        <p class="sub">${esc(o.cliente)} · contratante ${esc(o.contratante)}</p>
        <div class="meta"><span>Contrato <b>${esc(o.contrato)}</b></span><span>Prazo contratual <b>${dBR(P.contrIni)} a ${dBR(P.contrFim)}</b> (${P.total} dias)</span><span>Decorridos <b>${P.decorrido}</b> · a vencer <b>${P.aVencer}</b></span><span>Responsável <b>${esc(o.responsavel)}</b></span></div>
      </div></div>
      ${situacao}${cronoSec}${curva}${mensal}${frentes}${tarefas}${campo}${fotosSec}${restr}${conf}`;
  }

  // Admin: o que o cliente está vendo e o botão de publicar
  function barraPublicacao(o) {
    return o.publicado
      ? `<div class="pub ok"><span>${pill('ok', 'Publicado')} O cliente vê a posição de <b>${dBR(o.dataCorte)}</b>${o.publicadoEm ? ` (publicada em ${dBR(o.publicadoEm.slice(0, 10))})` : ''}.</span><button class="btn sec2" data-publicar="0">Recolher publicação</button></div>`
      : `<div class="pub"><span>${pill('atencao', 'Rascunho')} Você está vendo a carga de <b>${dBR(o.dataCorte)}</b>. ${o.publicadoAte ? `O cliente ainda vê a de <b>${dBR(o.publicadoAte)}</b>.` : 'O cliente ainda não vê nada desta obra.'}</span><button class="btn" data-publicar="1">Publicar para o cliente</button></div>`;
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
    const F = [['atrasada', 'Atrasadas', r.cont.atrasada], ['andamento', 'Em andamento', r.cont.andamento], ['proximas', 'Terminam em 30 dias', r.proximas.length], ['a-iniciar', 'A iniciar', r.cont['a-iniciar']], ['concluida', 'Concluídas', r.cont.concluida]];
    let lista = S.filtroTarefas === 'proximas' ? r.proximas : r.lista.filter(t => t.situacao === S.filtroTarefas);
    if (S.filtroTarefas === 'atrasada') lista = r.atrasadas;
    if (S.filtroTarefas === 'andamento' || S.filtroTarefas === 'a-iniciar') lista = [...lista].sort((a, b) => a.fim < b.fim ? -1 : 1);
    const N = 10, mostra = S.verTodas ? lista : lista.slice(0, N);
    const lead = S.filtroTarefas === 'atrasada' ? `Tarefas com término previsto antes de ${dBR(r.corte)} e ainda incompletas, ordenadas pelo quanto falta. Somam ${pct(r.faltaAtrasadas)} do avanço da obra.` : '';
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
      <p class="sec-lead">Fotos extraídas do PDF dos RDOs, separadas por dia. A legenda mostra o serviço quando o RDO traz a descrição da foto.${ehAdmin() ? ' Marque com ★ até 4 fotos para o report; as vagas sem marcação são preenchidas com a primeira foto dos RDOs mais recentes.' : ''}</p>
      <div class="seg" role="group" aria-label="Filtrar fotos por dia">
        ${dias.map(n => `<button data-fotordo="${n}" aria-pressed="${sel === n}">${dCurto(dataDe(n))}<b>${r.fotos.filter(f => f.rdo === n).length}</b></button>`).join('')}
        <button data-fotordo="todos" aria-pressed="${sel === 'todos'}">Todas<b>${r.fotos.length}</b></button>
      </div>
      <div class="galeria">${mostra.map(f => `
        <figure class="foto">
          <button class="foto-abre" data-lb="${lista.indexOf(f)}" aria-label="Ampliar foto ${f.idx} do RDO ${f.rdo}"><img src="${f.src}" alt="${esc(legendaCurta(f) || `Foto ${f.idx} do RDO nº ${f.rdo}, ${dBR(f.data)}`)}" loading="lazy" width="${f.w}" height="${f.h}"></button>
          <figcaption>${legendaCurta(f) ? `<b>${esc(legendaCurta(f))}</b>${legendaDet(f) ? `<span>${esc(legendaDet(f))}</span>` : ''}` : ''}<span class="src">RDO ${f.rdo} · ${dCurto(f.data)} · foto ${f.idx}</span></figcaption>
          ${ehAdmin() ? `<button class="estrela" data-estrela="${f.src}" aria-pressed="${dest.has(f.src)}" aria-label="${dest.has(f.src) ? 'Tirar do report' : 'Usar no report'}">★</button>` : ''}
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
      const nome = l.nivel === 1 ? 'Obra completa' : `${esc(l.nomeExib)}${l.area && !comp ? ` <small class="gt-area">${esc(l.area)}</small>` : ''}`;
      const sub = comp ? '' : `<small>${dCurto(l.inicio)}–${dCurto(l.fim)} · ${l.duracao ?? '—'} d${l.responsaveis ? ' · ' + esc(l.responsaveis.replace(/,?\s*Pendente de contratação/i, '')) : ''}</small>`;
      const flags = `${l.pendente ? '<span class="pill atencao">Pendente de contratação</span>' : ''}${l.situacao === 'atrasada' && !comp ? `<span class="pill critico">Venceu há ${l.diasAtraso} d</span>` : ''}`;
      const gap = l.realizado - l.previsto;
      const pcCls = gap < -0.05 ? 'neg' : gap > 0.05 ? 'pos' : '';
      const sl = l.slip === null ? '—' : l.slip === 0 ? (comp ? '' : 'na base') : `${l.slip > 0 ? '+' : '−'}${Math.abs(l.slip)} d`;
      return `<div class="gt-row n${Math.min(l.nivel, 4)} s-${l.situacao}" title="${esc(l.nome)}">
        <div class="gt-nm" style="padding-left:${comp ? 0 : (l.nivel - 1) * 14}px">${tem ? `<button class="gt-tg" data-abre="g${l.eap}" aria-expanded="${ab}" aria-label="${ab ? 'Recolher' : 'Abrir'} ${esc(l.nomeExib)}">${IC.right}</button>` : '<span class="gt-sp"></span>'}<span class="gt-tx"><b>${nome}</b>${sub}${flags ? `<span class="gt-fl">${flags}</span>` : ''}</span></div>
        <div class="gt-tl">${l.inicioBase && l.fimBase ? `<i class="gb-base" style="left:${X(l.inicioBase)}%;width:${W(l.inicioBase, l.fimBase)}%"></i>` : ''}<i class="gb-at" style="left:${X(l.inicio)}%;width:${W(l.inicio, l.fim)}%"><i class="gb-fill" style="width:${Math.min(100, l.realizado * 100)}%"></i></i></div>
        <div class="gt-pc ${pcCls}"><b>${pct(l.realizado, 0)}</b><small>${pct(l.previsto, 0)}</small></div>
        <div class="gt-sl ${l.slip > 0 ? 'neg' : l.slip < 0 ? 'pos' : ''}"><b>${dCurto(l.fim)}</b><small>${sl}</small></div>
      </div>`;
    };
    const leg = `<div class="legend gt-leg"><span><i class="lg-at"></i>Atual, preenchido pelo realizado</span><span><i class="lg-base"></i>Base</span><span><i class="lg-corte"></i>Corte ${dCurto(r.corte)}</span>${contrX !== null ? `<span><i class="lg-contr"></i>Fim contratual ${dCurto(r.prazo.contrFim)}</span>` : ''}</div>`;
    return `<div class="gantt ${comp ? 'gantt-c' : ''}">${leg}<div class="gt-wrap"><div class="gt">${cab}<div class="gt-body">${grade}${linhas.map(row).join('')}</div></div></div></div>`;
  }

  function blocoRestricoes(c) {
    if (!c.paralisadas.length) return `<p class="sec-lead" style="margin:0">Nenhuma frente paralisada no último RDO.</p>`;
    return `<p class="sec-lead">Frentes marcadas como paralisadas no RDO. Cada uma vira uma restrição a remover, com responsável e prazo (na fase 2, editáveis aqui).</p>
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
  const TIPOS = [
    ['curva', 'Curva S', 'Prevision · .xls'],
    ['mensal', 'Progresso mensal', 'Prevision · .xls'],
    ['tarefas', 'Progresso por tarefas', 'Prevision · .xlsx'],
    ['cronograma', 'Cronograma', 'Prevision · .xlsx'],
    ['rdos', 'RDOs do período', 'PDF compilado'],
  ];
  function viewAlimentar() {
    if (!DB.obras.length) return `<div><div class="kicker">Administração</div><h1 class="h1">Alimentar dados</h1></div><div class="card card-pad"><p class="sub" style="margin:0">Cadastre a obra antes de enviar arquivos.</p><div class="bar-actions" style="margin-top:12px"><button class="btn" data-go="nova-obra">Cadastrar obra</button></div></div>`;
    const o = DB.obras.find(x => x.id === (S.obraId || DB.obras[0].id)) || DB.obras[0];
    const imp = S.imp || { arquivos: [], dados: {}, avisos: {} };
    const tem = k => imp.dados[k];
    return `
      <div><div class="kicker">Administração</div><h1 class="h1">Alimentar dados</h1>
      <p class="sub">Solte aqui os relatórios do período. O app reconhece cada arquivo, confere os números e atualiza o painel.</p></div>
      <div class="card card-pad steps">
        <div class="step-t">1 · Obra</div>
        <div class="field" style="max-width:420px"><select class="inp" id="imp-obra">${DB.obras.map(x => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${esc(x.codigo)} · ${esc(x.nome)}</option>`).join('')}</select></div>
        <div class="step-t">2 · Arquivos</div>
        <div class="tipos">${TIPOS.map(([k, t, s]) => `<div class="tipo ${tem(k) ? 'on' : ''}"><b>${t}</b><small>${s}</small><div class="st">${tem(k) ? '✓ ' + resumoTipo(k, imp.dados[k]) : 'aguardando'}</div></div>`).join('')}</div>
        <label class="drop" id="drop" for="imp-file">
          ${IC.up}<b>Toque para escolher ou arraste os arquivos aqui</b>
          <small>Curva S, Progresso mensal, Progresso por tarefas (.xls/.xlsx) e o PDF dos RDOs. Pode mandar todos de uma vez.</small>
        </label>
        <input type="file" id="imp-file" multiple accept=".xls,.xlsx,.csv,.pdf" hidden>
        ${imp.arquivos.length ? `<div class="check">${imp.arquivos.map(a => `<div class="${a.erro ? 'er' : 'ok'}"><i>${a.erro ? '×' : '✓'}</i><span><b>${esc(a.nome)}</b> → ${a.erro ? esc(a.erro) : esc(a.tipoNome)}</span></div>`).join('')}</div>` : ''}
        ${Object.keys(imp.dados).length ? `<div class="step-t">3 · Conferência</div><div class="check">${conferenciaImport(o, imp).map(([k, t]) => `<div class="${k}"><i>${k === 'ok' ? '✓' : k === 'av' ? '!' : '×'}</i><span>${t}</span></div>`).join('')}</div>
          <div class="field" style="max-width:260px"><label for="imp-corte">Data de corte</label><input class="inp" type="date" id="imp-corte" value="${imp.corte || o.dataCorte}"></div>
          <div class="step-t">4 · Atualizar</div>
          <div class="bar-actions"><button class="btn" id="imp-aplicar">${PROD ? 'Salvar rascunho da obra' : 'Atualizar painel da obra'} ${esc(o.codigo)}</button><button class="btn sec2" id="imp-limpar">Descartar</button></div>
          <div class="note-box">${PROD ? 'A carga é gravada como <b>rascunho</b>: você e a diretoria veem na hora; o cliente só depois de você clicar em <b>Publicar para o cliente</b> na tela da obra.' : 'No protótipo a atualização vale só nesta sessão do navegador.'}</div>` : ''}
      </div>
      <div class="card card-pad steps">
        <div class="step-t">Último carregamento</div>
        <div class="meta" style="margin:0"><span>Obra <b>${esc(o.codigo)}</b></span><span>Data de corte <b>${dBR(o.dataCorte)}</b></span><span>Publicado ao cliente até <b>${dBR(o.publicadoAte)}</b></span><span>${(o.tarefas || []).length} tarefas · ${(o.curva || []).length} pontos de curva · ${(o.rdos || []).length} RDOs</span></div>
      </div>`;
  }
  function resumoTipo(k, d) {
    if (k === 'curva') return `${d.length} meses`;
    if (k === 'mensal') return `${d.length} meses`;
    if (k === 'tarefas') return `${d.length} tarefas`;
    if (k === 'cronograma') return `${d.length} linhas`;
    if (k === 'rdos') return `${d.length} RDOs${S.imp && S.imp.dados.fotos ? ' · ' + S.imp.dados.fotos.length + ' fotos' : ''}`;
    return '';
  }
  function conferenciaImport(o, imp) {
    const out = [], d = imp.dados;
    if (d.curva) {
      const ult = [...d.curva].reverse().find(p => p.realizado > 0);
      const fim = d.curva.at(-1);
      out.push([Math.abs(fim.base - 1) < 0.001 ? 'ok' : 'av', `Curva S: ${d.curva.length} pontos, de ${dBR(d.curva[0].data)} a ${dBR(fim.data)}. Base fecha em ${pct(fim.base, 2)}. Último realizado ${ult ? pct(ult.realizado, 2) : '—'}.`]);
      const mono = d.curva.every((p, i) => !i || p.base >= d.curva[i - 1].base - 1e-6);
      out.push([mono ? 'ok' : 'er', mono ? 'Curva base sempre crescente.' : 'A curva base diminui em algum mês: confira a exportação.']);
    }
    if (d.mensal) {
      const soma = d.mensal.reduce((s, m) => s + (m.base || 0), 0);
      out.push([Math.abs(soma - 1) < 0.002 ? 'ok' : 'av', `Progresso mensal: ${d.mensal.length} meses; a base soma ${pct(soma, 2)}.`]);
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
      const contr = r.at(-1).contrato;
      if (contr && o.contrato && contr !== o.contrato) out.push(['er', `O contrato do RDO (${contr}) é diferente do contrato da obra (${o.contrato}).`]);
      out.push([par ? 'av' : 'ok', par ? `${par} frentes paralisadas no último RDO; vão para Paralisações e restrições.` : 'Nenhuma frente paralisada no último RDO.']);
    }
    return out;
  }

  let libs = null;
  function carregaLibs() {
    if (libs) return libs;
    const js = src => new Promise((ok, err) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => err(new Error('Não consegui carregar ' + src)); document.head.appendChild(s); });
    // no site publicado as bibliotecas ficam no próprio servidor (js/vendor); no protótipo vêm do cdnjs
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
  async function lerArquivos(files) {
    S.imp = S.imp || { arquivos: [], dados: {}, avisos: {} };
    toast('Lendo arquivos…');
    try { await carregaLibs(); } catch (e) { toast(e.message + '. Confira a conexão e tente de novo.'); return; }
    for (const f of files) {
      const reg = { nome: f.name };
      try {
        const buf = new Uint8Array(await f.arrayBuffer());
        if (/\.pdf$/i.test(f.name)) {
          const pags = await Parsers.pdfItens(window.pdfjsLib, buf);
          const rdos = Parsers.parseRDOs(pags);
          if (!rdos.length) throw new Error('não encontrei relatórios diários neste PDF');
          toast('Lendo as fotos do PDF…');
          const fotos = await Parsers.pdfFotos(window.pdfjsLib, pags, { larguraMax: 720, qualidade: 0.68 });
          S.imp.dados.rdos = rdos; S.imp.dados.fotos = fotos; reg.tipoNome = `RDOs (${rdos.length}) e ${fotos.length} fotos`;
        } else {
          const linhas = Parsers.lerLinhas(window.XLSX, buf);
          const tipo = Parsers.tipoPlanilha(linhas);
          if (!tipo) throw new Error('não reconheci as colunas (esperado: Curva S, Progresso mensal ou Progresso por tarefas do Prevision)');
          S.imp.dados[tipo] = tipo === 'curva' ? Parsers.parseCurva(linhas) : tipo === 'mensal' ? Parsers.parseMensal(linhas) : tipo === 'cronograma' ? Parsers.parseCronograma(linhas) : Parsers.parseTarefas(linhas);
          if (tipo === 'cronograma') S.imp.arqCrono = f.name;
          reg.tipoNome = TIPOS.find(t => t[0] === tipo)[1];
        }
      } catch (e) { reg.erro = e.message; }
      S.imp.arquivos = S.imp.arquivos.filter(a => a.nome !== reg.nome).concat(reg);
    }
    if (S.imp.dados.rdos) S.imp.corte = S.imp.dados.rdos.at(-1).data;
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
    render();
    toast('Arquivos lidos. Confira e atualize o painel.');
  }
  async function aplicarImportProd() {
    const obraId = $('#imp-obra').value;
    const d = S.imp.dados;
    const corte = ($('#imp-corte') && $('#imp-corte').value) || S.imp.corte;
    if (!corte) { toast('Informe a data de corte.'); return; }
    const pacote = { ...d, cronograma: d.cronograma ? { arquivo: S.imp.arqCrono, linhas: d.cronograma, dataRef: corte } : undefined };
    const fontes = Object.fromEntries(S.imp.arquivos.filter(a => !a.erro).map(a => [a.tipoNome, a.nome]));
    const bt = $('#imp-aplicar'); if (bt) { bt.disabled = true; bt.textContent = 'Gravando…'; }
    try {
      await API.salvarCarga(obraId, pacote, corte, fontes, m => toast(m));
      S.imp = null; S.obraId = obraId; S.view = 'obra';
      await recarregar();
      toast('Rascunho salvo. Confira e publique para o cliente.');
    } catch (e) { toast('Não consegui gravar: ' + e.message); if (bt) { bt.disabled = false; bt.textContent = 'Tentar de novo'; } }
  }
  function aplicarImport() {
    if (PROD) return aplicarImportProd();
    const o = DB.obras.find(x => x.id === $('#imp-obra').value);
    const d = S.imp.dados;
    if (d.curva) o.curva = d.curva;
    if (d.mensal) o.mensal = d.mensal;
    if (d.cronograma) o.cronograma = { arquivo: S.imp.arqCrono, linhas: d.cronograma, dataRef: ($('#imp-corte') && $('#imp-corte').value) || S.imp.corte };
    if (d.tarefas) o.tarefas = d.tarefas;
    if (d.rdos) o.rdos = d.rdos;
    if (d.fotos) { o.fotos = d.fotos; o.destaques = []; }
    const c = $('#imp-corte'); if (c && c.value) o.dataCorte = c.value;
    o.fontes = { ...(o.fontes || {}), ...Object.fromEntries(S.imp.arquivos.filter(a => !a.erro).map(a => [a.tipoNome, a.nome])) };
    S.imp = null; S.obraId = o.id; S.view = 'obra';
    render(); toast(`Painel da obra ${o.codigo} atualizado.`);
  }

  // ---------- acessos (produção, administrador) ----------
  function viewAcessos() {
    const lista = S.acessos;
    if (!lista) { carregarAcessos(); return `<div><div class="kicker">Administração</div><h1 class="h1">Acessos</h1></div><div class="card card-pad"><p class="sub" style="margin:0">Carregando…</p></div>`; }
    return `
      <div><div class="kicker">Administração</div><h1 class="h1">Acessos</h1>
      <p class="sub">Quem entra no painel e o que cada um vê. As mudanças valem no próximo login da pessoa.</p></div>
      <div class="note-box"><b>Para convidar alguém:</b> no Supabase, abra <b>Authentication → Users → Invite user</b> e informe o e-mail. A pessoa recebe o convite, cria a senha e aparece aqui como <b>cliente sem obras</b>. Depois escolha o papel e marque as obras.</div>
      <div class="tw"><table class="t"><thead><tr><th>Pessoa</th><th>Papel</th><th>Obras (cliente)</th><th>Ativo</th></tr></thead><tbody>
      ${lista.map(p => `<tr>
        <td><b style="font-weight:600">${esc(p.nome)}</b><small>${esc(p.email || '')}</small></td>
        <td><select class="inp" data-papel="${p.id}" ${p.id === S.user.id ? 'disabled title="Você não pode mudar o próprio papel"' : ''} aria-label="Papel de ${esc(p.nome)}">
          ${['cliente', 'diretoria', 'admin'].map(k => `<option value="${k}" ${p.papel === k ? 'selected' : ''}>${k === 'admin' ? 'Administrador' : k === 'diretoria' ? 'Diretoria' : 'Cliente'}</option>`).join('')}</select></td>
        <td>${p.papel === 'cliente' ? `<div class="chips">${DB.obras.map(o => `<label class="chk"><input type="checkbox" data-acesso="${p.id}|${o.id}" ${p.obras.includes(o.id) ? 'checked' : ''}> ${esc(o.codigo)}</label>`).join('')}</div>` : '<small>todas</small>'}</td>
        <td><input type="checkbox" data-ativo="${p.id}" ${p.ativo ? 'checked' : ''} ${p.id === S.user.id ? 'disabled' : ''} aria-label="Acesso ativo de ${esc(p.nome)}"></td>
      </tr>`).join('')}
      </tbody></table></div>`;
  }
  async function carregarAcessos() {
    try { S.acessos = await API.listarAcessos(); } catch (e) { S.acessos = []; toast(e.message); }
    if (S.view === 'acessos') render();
  }
  function viewNovaObra() {
    const f = (id, rot, tipo = 'text', extra = '') => `<div class="field"><label for="${id}">${rot}</label><input class="inp" id="${id}" type="${tipo}" ${extra}></div>`;
    return `
      <div><div class="kicker">Administração</div><h1 class="h1">Nova obra</h1><p class="sub">Depois de salvar, envie os arquivos em Alimentar.</p></div>
      <form class="card card-pad steps" id="f-obra" novalidate>
        <div class="two">${f('o-codigo', 'Código da obra', 'text', 'required placeholder="ex.: 211"')}${f('o-nome', 'Nome', 'text', 'required')}</div>
        <div class="two">${f('o-cliente', 'Cliente')}${f('o-contratante', 'Contratante')}</div>
        <div class="two">${f('o-cidade', 'Cidade/UF')}${f('o-contrato', 'Contrato')}</div>
        ${f('o-local', 'Endereço')}
        <div class="two">${f('o-resp', 'Responsável em campo')}<div class="two">${f('o-ini', 'Início contratual', 'date')}${f('o-fim', 'Fim contratual', 'date')}</div></div>
        <div class="bar-actions"><button class="btn" type="submit">Salvar obra</button><button class="btn sec2" type="button" data-go="portfolio">Cancelar</button></div>
      </form>`;
  }

  // ---------- report ----------
  // "Em outubro (até 16/10) a obra avançou 3,4%; o plano previa 5,6% (60% do previsto)."
  function periodoTexto(r) {
    const P = r.periodo, mes = Core.mesLongo(Core.addDias(P.inicio, 1)).split(' de ')[0];
    const ader = P.aderencia === null ? '' : ` (${fmtNum(P.aderencia * 100, 0)}% do previsto)`;
    return `Em ${mes} (até ${dCurto(r.corte)}), a obra avançou <b>${pct(Math.max(0, P.real))}</b>; o plano previa ${pct(P.prev)}${ader}.`;
  }

  function viewReport() {
    const base = DB.obras.find(x => x.id === S.obraId) || obrasDoUsuario()[0];
    if (!base || !temDados(visaoDaObra(base))) return `<div class="card card-pad"><p class="sub" style="margin:0">Ainda não há dados para o report desta obra.</p></div>`;
    const o = visaoDaObra(base);
    const r = Core.calc(o);
    const X = Core.resumoExecutivo(o, r, base.destaques || []);
    const P = r.prazo;
    const podeImprimir = window.self === window.top;
    const barra = (real, prev, peso) => { const w = v => Math.max(0, Math.min(100, v / peso * 100)); return `<span class="xb"><i class="xb-r" style="width:${w(real)}%"></i><i class="xb-p" style="left:${w(prev)}%"></i></span>`; };
    return `
      <div class="head-row no-print"><div><div class="kicker">Report</div><h1 class="h1">Obra ${esc(o.codigo)} · ${dBR(r.corte)}</h1>
        <p class="sub">Formato fixo de uma página: os mesmos blocos, na mesma ordem e com os mesmos limites a cada atualização. O detalhe completo fica na aba Obra.</p></div>
        <div class="bar-actions">${podeImprimir ? `<button class="btn" id="bt-pdf">Baixar PDF</button>` : ''}<button class="btn sec2" data-toast="Envio por e-mail para cliente e diretoria entra na fase 2, com agendamento semanal ou mensal.">Enviar por e-mail</button></div></div>
      ${podeImprimir ? '' : `<div class="note-box no-print">Nesta prévia o PDF não pode ser gerado. No site publicado, o botão <b>Baixar PDF</b> aparece aqui.</div>`}
      <article class="paper exec" id="paper">
        <div class="pm"><img src="${LOGO}" alt="Machine · Realizações com base sólida"><span>Report · ${dBR(r.corte)}</span></div>
        <div class="pb">
          <div class="pt"><div class="kicker">Obra ${esc(o.codigo)} · ${esc(o.cliente)} · ${esc(o.cidade)}</div>
            <div class="pt-row"><h1>${esc(o.nome)}</h1>${pill(r.sem.k, r.sem.t)}</div></div>

          <p class="manchete">${esc(X.manchete)}</p>

          <div class="pk">${X.kpis.map(k => `<div class="kpi"><span>${k.k}</span><b class="${k.cls || ''}">${k.v}</b><small>${esc(k.s)}</small></div>`).join('')}</div>

          <div class="x2">
            <section class="ps"><div class="ps-h"><i>1</i><h2>Curva S física</h2></div>
              <div class="legend"><span><i class="sw sw-real"></i>Realizado</span><span><i class="sw sw-prev"></i>Previsto</span><span><i class="sw sw-base"></i>Base</span></div>
              <div class="chart" id="ch-curva-r"></div>
              <p class="per">${periodoTexto(r)}</p>
            </section>
            <section class="ps"><div class="ps-h"><i>2</i><h2>Pontos-chave</h2></div>
              <ul class="pontos">${X.pontos.map(p => `<li><b>${p.t}</b> ${p.x}</li>`).join('')}</ul>
            </section>
          </div>

          <section class="ps"><div class="ps-h"><i>3</i><h2>${r.crono ? 'Cronograma por frente' : 'Frentes com desvio'}</h2></div>
            ${r.crono ? ganttHTML(r, { compacto: true }) : `<div class="xf">${X.frentes.top.map(p => `<div class="xf-r"><span class="xf-n">${esc(p.nome)}<small>${pct(p.realizado, 1)} de ${pct(p.peso, 1)} · prev. ${pct(p.prevCorte, 1)}</small></span>${barra(p.realizado, p.prevCorte, p.peso)}<b class="neg">${pp(p.desvio, 1)}</b></div>`).join('') || '<p class="per">Nenhuma frente abaixo do previsto.</p>'}
                ${X.frentes.demais.n ? `<div class="xf-r xf-d"><span class="xf-n">Demais ${X.frentes.demais.n} frentes<small>${pct(X.frentes.demais.peso, 1)} do peso da obra</small></span><span class="xf-ok">em dia</span><b>${pp(X.frentes.demais.desvio, 1)}</b></div>` : ''}
              </div>`}
          </section>

          <div class="x2">
            <section class="ps"><div class="ps-h"><i>4</i><h2>Atenção</h2></div>
              <div class="xa">${X.atencao.map(a => `<div class="xa-r"><span class="tag ${a.tag === 'Paralisada' ? 't-crit' : 't-warn'}">${a.tag}</span><div><b>${esc(a.titulo)}</b><small>${esc(a.det)}</small></div></div>`).join('') || '<p class="per">Sem pontos de atenção.</p>'}
                ${X.atencaoMais ? `<p class="per">e mais ${X.atencaoMais} ${X.atencaoMais === 1 ? 'item' : 'itens'} no painel da obra.</p>` : ''}</div>
            </section>
            <section class="ps"><div class="ps-h"><i>5</i><h2>Próximos 30 dias</h2></div>
            <div class="xp"><div class="xp-n"><b>${X.proximas.n}</b><small>tarefas terminam até ${dCurto(Core.addDias(r.corte, 30))}</small></div>
              <div class="xp-l">${X.proximas.top.map(t => `<div><span class="tn">${dCurto(t.fim)}</span><span>${esc(t.nome)}<small>${esc(t.caminho.slice(0, 2).join(' › '))}</small></span><span class="tn">${pct(t.pctTarefa, 0)} feito</span></div>`).join('')}</div></div>
          </section>
          </div>

          ${X.fotos.length ? `<section class="ps"><div class="ps-h"><i>6</i><h2>Registro fotográfico</h2></div>
            <div class="xfotos">${X.fotos.map(f => `<figure><img src="${f.src}" alt="${esc(legendaCurta(f) || `Foto do RDO nº ${f.rdo}, ${dBR(f.data)}`)}"><figcaption>${legendaCurta(f) ? `<b>${esc(legendaCurta(f))}</b>` : ''}<span>RDO ${f.rdo} · ${dBR(f.data)}</span></figcaption></figure>`).join('')}</div>
          </section>` : ''}
        </div>
        <p class="glos"><b>Como ler.</b> <i>Avanço da obra</i>: quanto já foi executado, pesando cada serviço pelo seu valor no orçamento. <i>Planejado</i>: quanto o cronograma previa até esta data. <i>Comparado ao plano</i>: a diferença entre os dois, em pontos do total da obra; ▲ acima, ▼ abaixo, “em linha” até 0,5 ponto. <i>Índice de prazo</i>: executado ÷ planejado; 1,00 é o ritmo do plano, acima de 1,00 a obra está à frente.</p>
        <div class="pf"><span><b>MACHINE</b> | Realizações com base sólida</span><span>Obra ${esc(o.codigo)} · dados até ${dBR(r.corte)} · Prevision e RDO · gerado em ${dBR(new Date().toISOString().slice(0, 10))}</span></div>
      </article>`;
  }

  // ---------- render ----------
  function render() {
    const app = $('#app');
    if (PROD && S.carregando) { app.innerHTML = viewCarregando(); return; }
    if (PROD && S.view === 'senha') { app.innerHTML = viewSenha(); bind(); return; }
    if (!S.user) { app.innerHTML = PROD ? viewLoginProd() : viewLogin(); bind(); return; }
    if (!S.obraId || !DB.obras.some(o => o.id === S.obraId)) S.obraId = obrasDoUsuario()[0]?.id;
    if (!ehAdmin() && ['alimentar', 'acessos', 'nova-obra'].includes(S.view)) S.view = 'obra';
    const v = S.view === 'portfolio' ? viewPortfolio() : S.view === 'obra' ? viewObra() : S.view === 'alimentar' ? viewAlimentar()
      : S.view === 'acessos' ? viewAcessos() : S.view === 'nova-obra' ? viewNovaObra() : viewReport();
    app.innerHTML = shell(v) + lightbox();
    bind(); desenha();
  }
  function desenha() {
    const base = DB.obras.find(x => x.id === S.obraId);
    if (!base || !temDados(visaoDaObra(base))) return;
    const o = visaoDaObra(base), r = Core.calc(o);
    const el1 = $('#ch-curva'); if (el1 && el1.closest('details').open) Core.chartCurvaS(el1, o, r);
    const el2 = $('#ch-mensal'); if (el2 && el2.closest('details').open) Core.chartMensal(el2, o, r);
    const el3 = $('#ch-efetivo'); if (el3 && r.campo && el3.closest('details').open) Core.chartEfetivo(el3, r.campo);
    const el4 = $('#ch-curva-r'); if (el4) Core.chartCurvaS(el4, o, r, { altura: 190, compacto: true });
  }

  let tt;
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function bind() {
    $$('[data-login]').forEach(b => b.onclick = () => {
      S.user = USUARIOS.find(u => u.id === b.dataset.login);
      S.obraId = obrasDoUsuario()[0]?.id;
      S.view = ehCliente() && obrasDoUsuario().length === 1 ? 'obra' : 'portfolio';
      S.menu = false; lsSet('mp_user', S.user.id); render(); window.scrollTo(0, 0);
    });
    $$('[data-go]').forEach(b => b.onclick = () => { S.view = b.dataset.go; S.menu = false; render(); window.scrollTo(0, 0); });
    $$('[data-obra]').forEach(b => b.onclick = () => { S.obraId = b.dataset.obra; S.view = 'obra'; render(); window.scrollTo(0, 0); });
    $$('[data-toast]').forEach(b => b.onclick = () => toast(b.dataset.toast));
    const bt = $('#bt-tema'); if (bt) bt.onclick = () => { tema = TEMAS[(TEMAS.indexOf(tema) + 1) % 3]; lsSet('mp_tema', tema); aplicaTema(tema); render(); };
    const bu = $('#bt-user'); if (bu) bu.onclick = e => { e.stopPropagation(); S.menu = !S.menu; render(); };
    $$('[data-act]').forEach(b => b.onclick = async () => {
      S.menu = false;
      if (PROD && b.dataset.act === 'sair') { await API.sair(); return; } // onAuthStateChange cuida do resto
      S.user = null; S.view = 'login'; lsSet('mp_user', ''); render();
    });
    $$('[data-senha]').forEach(b => b.onclick = () => { S.menu = false; S.loginErro = null; S.view = 'senha'; render(); });
    const fl = $('#f-login'); if (fl) fl.onsubmit = async e => {
      e.preventDefault(); S.loginErro = null; S.loginMsg = null;
      const em = $('#l-email').value, se = $('#l-senha').value;
      if (!em || !se) { S.loginErro = 'Informe e-mail e senha.'; render(); return; }
      const bt = fl.querySelector('button[type=submit]'); bt.disabled = true; bt.textContent = 'Entrando…';
      try { await API.entrar(em, se); } catch (er) { S.loginErro = er.message; render(); $('#l-email').value = em; }
    };
    const fe = $('#l-esqueci'); if (fe) fe.onclick = async () => {
      const em = $('#l-email').value; S.loginErro = null; S.loginMsg = null;
      if (!em) { S.loginErro = 'Digite seu e-mail acima e toque de novo em "Esqueci a senha".'; render(); return; }
      try { await API.esqueci(em); S.loginMsg = 'Se este e-mail tiver acesso, chega em instantes um link para criar uma nova senha.'; } catch (er) { S.loginErro = er.message; }
      render(); $('#l-email').value = em;
    };
    const fs = $('#f-senha'); if (fs) fs.onsubmit = async e => {
      e.preventDefault(); S.loginErro = null;
      const a = $('#s-nova').value, b = $('#s-conf').value;
      if (a.length < 8) { S.loginErro = 'A senha precisa ter pelo menos 8 caracteres.'; render(); return; }
      if (a !== b) { S.loginErro = 'As duas senhas não são iguais.'; render(); return; }
      try { await API.definirSenha(a); history.replaceState(null, '', location.pathname); S.view = 'obra'; toast('Senha salva.'); await iniciarSessao(); }
      catch (er) { S.loginErro = er.message; render(); }
    };
    $$('[data-publicar]').forEach(b => b.onclick = async () => {
      const o = DB.obras.find(x => x.id === S.obraId); const sim = b.dataset.publicar === '1';
      b.disabled = true;
      try { await API.publicar(o.cargaId, sim); await recarregar(); toast(sim ? 'Publicado. O cliente já vê esta posição.' : 'Publicação recolhida.'); }
      catch (er) { toast(er.message); b.disabled = false; }
    });
    $$('[data-papel]').forEach(el => el.onchange = async () => { try { await API.salvarPerfil(el.dataset.papel, { papel: el.value }); toast('Papel atualizado.'); S.acessos = null; render(); } catch (er) { toast(er.message); } });
    $$('[data-ativo]').forEach(el => el.onchange = async () => { try { await API.salvarPerfil(el.dataset.ativo, { ativo: el.checked }); toast(el.checked ? 'Acesso reativado.' : 'Acesso desativado.'); } catch (er) { toast(er.message); el.checked = !el.checked; } });
    $$('[data-acesso]').forEach(el => el.onchange = async () => { const [u, ob] = el.dataset.acesso.split('|'); try { await API.definirAcesso(u, ob, el.checked); toast(el.checked ? `Obra ${ob} liberada.` : `Obra ${ob} retirada.`); } catch (er) { toast(er.message); el.checked = !el.checked; } });
    const fo = $('#f-obra'); if (fo) fo.onsubmit = async e => {
      e.preventDefault();
      const v = id => ($('#' + id).value || '').trim();
      if (!v('o-codigo') || !v('o-nome')) { toast('Informe código e nome da obra.'); return; }
      const ini = v('o-ini') || null, fim = v('o-fim') || null;
      try {
        await API.salvarObra({ id: v('o-codigo'), codigo: v('o-codigo'), nome: v('o-nome'), cliente: v('o-cliente'), contratante: v('o-contratante'), cidade: v('o-cidade'),
          contrato: v('o-contrato'), local: v('o-local'), responsavel: v('o-resp'), prazo_inicio: ini, prazo_fim: fim,
          prazo_dias: ini && fim ? Core.diff(ini, fim) + 1 : null });
        S.obraId = v('o-codigo'); S.view = 'alimentar'; await recarregar(); toast('Obra cadastrada. Agora envie os arquivos.');
      } catch (er) { toast(er.message); }
    };
    $$('details.sec').forEach(d => d.addEventListener('toggle', () => { S.abertos[d.dataset.sec] = d.open; if (d.open) desenha(); }));
    $$('[data-abre]').forEach(b => b.onclick = () => { const id = b.dataset.abre; S.abertos[id] = !S.abertos[id]; render(); });
    $$('[data-filtro]').forEach(b => b.onclick = () => { S.filtroTarefas = b.dataset.filtro; S.verTodas = false; render(); });
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
    const pdf = $('#bt-pdf'); if (pdf) pdf.onclick = () => window.print();
    $$('[data-fotordo]').forEach(b => b.onclick = () => { const v = b.dataset.fotordo; S.fotoRdo = v === 'todos' ? 'todos' : +v; S.fotosTodas = false; render(); });
    $$('[data-fotostodas]').forEach(b => b.onclick = () => { S.fotosTodas = !S.fotosTodas; render(); });
    $$('[data-lb]').forEach(b => b.onclick = () => { S.lb = +b.dataset.lb; render(); });
    $$('[data-lbx]').forEach(b => b.onclick = () => { S.lb = null; render(); });
    $$('[data-lbnav]').forEach(b => b.onclick = () => { S.lb += +b.dataset.lbnav; render(); });
    $$('[data-estrela]').forEach(b => b.onclick = async () => {
      const o = DB.obras.find(x => x.id === S.obraId); o.destaques = o.destaques || [];
      const src = b.dataset.estrela, i = o.destaques.indexOf(src);
      if (i < 0 && o.destaques.length >= 4) { toast('O report usa até 4 fotos. Tire uma estrela antes.'); return; }
      if (PROD) {
        const f = (o.fotos || []).find(x => x.src === src);
        try { await API.destacar(f.path, i < 0); f.destaque = i < 0; } catch (er) { toast(er.message); return; }
      }
      if (i >= 0) { o.destaques.splice(i, 1); toast('Foto retirada do report.'); }
      else { o.destaques.push(src); toast(`Foto marcada para o report (${o.destaques.length} de 4).`); }
      render();
    });
  }
  document.addEventListener('click', e => { if (S.menu && !e.target.closest('.menu') && !e.target.closest('#bt-user')) { S.menu = false; render(); } });
  document.addEventListener('keydown', e => {
    if (S.lb === null) return;
    if (e.key === 'Escape') { S.lb = null; render(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const b = $(`[data-lbnav="${e.key === 'ArrowRight' ? 1 : -1}"]`); if (b && !b.disabled) b.click(); }
  });
  let rz; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(desenha, 150); });

  // ---------- início ----------
  async function recarregar() {
    DB.obras = await API.carregarObras(S.user);
    render();
  }
  async function iniciarSessao() {
    S.carregando = true; render();
    try {
      const u = await API.sessao();
      if (!u) { S.user = null; S.carregando = false; render(); return; }
      S.user = { ...u, ini: iniciais(u.nome), rotulo: ROTULO[u.perfil] || u.perfil };
      if (API.tipoLink === 'invite' || API.tipoLink === 'recovery') { S.view = 'senha'; S.carregando = false; render(); return; }
      DB.obras = await API.carregarObras(S.user);
      if (!['portfolio', 'obra', 'report', 'alimentar', 'acessos', 'nova-obra'].includes(S.view)) S.view = DB.obras.length > 1 ? 'portfolio' : 'obra';
    } catch (e) { S.user = null; S.loginErro = e.message; }
    S.carregando = false; render();
  }

  if (PROD) {
    if (API.erroLink) S.loginErro = /expired|invalid/i.test(API.erroLink) ? 'Este link expirou ou já foi usado. Peça um novo em "Esqueci a senha".' : API.erroLink;
    let ultimo = null;
    API.aoMudarSessao((ev, sess) => {
      const id = sess && sess.user ? sess.user.id : null;
      if (ev === 'PASSWORD_RECOVERY') { S.view = 'senha'; S.carregando = false; render(); return; }
      if (ev === 'SIGNED_OUT') { ultimo = null; S.user = null; DB.obras = []; S.view = 'login'; S.acessos = null; S.carregando = false; render(); return; }
      if (ev === 'INITIAL_SESSION' && !id) { S.carregando = false; render(); return; }
      if (id && id !== ultimo) { ultimo = id; iniciarSessao(); }
    });
    // garantia para versões do cliente que não emitem INITIAL_SESSION
    setTimeout(() => { if (S.carregando && !ultimo) iniciarSessao(); }, 2500);
  } else {
    // Gerador de PDF (tools/gerar.cjs): lê o estado atualizado para regravar js/seed.js
    window.MP_EXPORT = () => JSON.parse(JSON.stringify(DB));
    // abre direto no perfil lembrado
    // (no protótipo, quem chega pela primeira vez entra como administrador; "Trocar perfil" volta ao login)
    const salvo = lsGet('mp_user');
    const lembrado = salvo === '' ? null : (USUARIOS.find(u => u.id === salvo) || USUARIOS[0]);
    if (lembrado) { S.user = lembrado; S.obraId = obrasDoUsuario()[0]?.id; S.view = 'obra'; }
    // atalhos pelo endereço: #report, #obra-207 (usados pelo gerador de PDF)
    const h = location.hash || '';
    const mo = h.match(/obra-([\w-]+)/); if (mo && DB.obras.some(o => o.id === mo[1])) S.obraId = mo[1];
    if (/report/.test(h)) S.view = 'report';
    if (/alimentar/.test(h)) S.view = 'alimentar';
    render();
  }
})();
