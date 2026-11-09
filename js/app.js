// ============================================================
// Machine · Painel de Obras — app (telas e navegação).
// Dados cifrados no próprio repositório (js/api.js); acesso só com e-mail e senha.
// ============================================================
(function () {
  'use strict';
  const { esc, fmtNum, pct, pp, dBR, dCurto, mesLongo, diaSemana, diff, moeda } = Core;
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
  // Cálculo da obra (Core.calc) uma vez por desenho de tela: a tela, os gráficos e a foto ampliada usam o mesmo resultado.
  // O cache é zerado a cada render(), então nunca sobrevive a uma carga, publicação ou troca de perfil.
  const calcDoRender = new Map();
  function calcObra(base) {
    if (!calcDoRender.has(base)) calcDoRender.set(base, Core.calc(visaoDaObra(base)));
    return calcDoRender.get(base);
  }
  // Fotos e plantas chegam como data URI (base64, ~100 kB cada). Escritas no HTML, cada redesenho reescreveria megabytes
  // de texto: a imagem vira um endereço blob: criado uma vez e reaproveitado (o navegador guarda a imagem decodificada).
  const urlsImg = new Map();
  function urlImg(src) {
    if (typeof src !== 'string' || !src.startsWith('data:') || !src.includes(';base64,')) return src;
    let u = urlsImg.get(src);
    if (!u) {
      const i = src.indexOf(','), bin = atob(src.slice(i + 1)), bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      u = URL.createObjectURL(new Blob([bytes], { type: src.slice(5, src.indexOf(';')) }));
      urlsImg.set(src, u);
    }
    return u;
  }
  // Scripts externos sob demanda (leitura de planilhas/PDF, geração do PDF); uma falha libera nova tentativa
  const scripts = {};
  const carregaScript = src => scripts[src] || (scripts[src] = new Promise((ok, err) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok;
    s.onerror = () => { delete scripts[src]; s.remove(); err(new Error('Não consegui carregar ' + src)); };
    document.head.appendChild(s);
  }));

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
  // logo: versão escura (fundo preto) nas faixas da marca; versão clara nas folhas brancas do report
  const LOGO = 'assets/logo_machine_claro.png', LOGO_FAIXA = 'assets/logo_machine.png';

  // ---------- tema ----------
  const TEMAS = ['auto', 'light', 'dark'];
  function aplicaTema(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }
  let tema = lsGet('mp_tema') || 'auto';
  aplicaTema(tema);

  // ---------- moldura ----------
  const TITULO_TELA = { alimentar: 'Alimentar dados', acessos: 'Acessos', 'nova-obra': 'Nova obra', 'editar-obra': 'Cadastro da obra', senha: 'Senha', github: 'Publicação', manual: 'Manual de alimentação', portfolio: 'Portfólio', restricoes: 'Restrições' };
  function shell(conteudo) {
    const u = S.user;
    const o = S.obraId ? DB.obras.find(x => x.id === S.obraId) : null;
    const crumb = S.view === 'obra' && o ? `${o.codigo} · ${o.nome}` : S.view === 'report' ? `Report${o ? ' · ' + o.codigo : ''}` : TITULO_TELA[S.view] || '';
    const itens = [
      ['portfolio', 'Portfólio', IC.home, !ehCliente() || obrasDoUsuario().length > 1],
      ['obra', 'Obra', IC.obra, true],
      ['restricoes', 'Restrições', IC.rlist, !ehCliente()],
      ['alimentar', 'Alimentar', IC.up, ehAdmin()],
      ['report', 'Report', IC.doc, true],
      ['acessos', 'Acessos', IC.users, ehAdmin()],
    ].filter(i => i[3]);
    // portfólio e report na largura da folha A4 paisagem; as demais telas na largura A4 retrato
    const larga = ['report', 'portfolio', 'manual', 'restricoes'].includes(S.view) ? ' larga' : '';
    const botoes = itens.map(([k, t, ic]) => `<button data-go="${k}" ${S.view === k ? 'aria-current="page"' : ''}>${ic}<span>${t}</span></button>`).join('');
    return `
      <header class="mast"><div class="mast-in">
        <img src="${LOGO_FAIXA}" alt="Machine · Realizações com base sólida">
        <span class="ttl">Painel de Obras</span><span class="crumb"><b>${esc(crumb)}</b></span>
        <nav class="tabs" aria-label="Navegação principal">${botoes}</nav>
        <span class="sp"></span>
        ${S.ocupado ? `<span class="sync" role="status"><i></i>${esc(S.ocupado)}</span>` : ''}
        <button class="iconbtn" id="bt-tema" aria-label="Tema: ${tema === 'auto' ? 'automático' : tema === 'light' ? 'claro' : 'escuro'}">${tema === 'auto' ? IC.auto : tema === 'light' ? IC.sun : IC.moon}</button>
        <button class="avatar" id="bt-user" aria-haspopup="menu" aria-expanded="${S.menu}" aria-label="Conta: ${esc(u.nome)}">${esc(u.ini)}</button>
      </div></header>
      ${S.menu ? `<div class="menu" role="menu"><div class="who"><b>${esc(u.nome)}</b><small>${esc(u.rotulo)}</small></div>
        ${!ehCliente() ? '<button role="menuitem" data-go="manual">Manual de alimentação (interno)</button>' : ''}${ehAdmin() ? `<button role="menuitem" data-go="senha">Trocar minha senha</button><button role="menuitem" data-go="github">Publicação (GitHub)</button>` : `<a role="menuitem" href="${mailtoSenha(u.email)}">Solicitar nova senha</a>`}<button role="menuitem" data-act="sair">Sair</button></div>` : ''}
      <main class="page${larga}" id="main">${conteudo}</main>
      <nav class="nav" aria-label="Navegação principal"><div class="nav-in">${botoes}</div></nav>`;
  }

  const sec = (id, titulo, direita, corpo, aberto = true) => {
    const open = S.abertos[id] ?? aberto;
    return `<details class="sec" data-sec="${id}" ${open ? 'open' : ''}><summary><span class="mk"></span><h2>${titulo}</h2><span class="rt"><span class="rtxt">${direita || ''}</span><span class="chev">${IC.chev}</span></span></summary><div class="sec-body">${corpo}</div></details>`;
  };
  const pill = (k, t) => `<span class="pill ${k}">${esc(t)}</span>`;
  // Atalhos da aba Obra (fixos no topo ao rolar): a página tem até 13 seções; o toque abre a seção e rola até ela
  const navSecoes = itens => { const v = itens.filter(i => i[0]); return v.length < 4 ? '' : `<nav class="sec-nav no-print" aria-label="Seções da obra">${v.map(([, id, t]) => `<button data-irsec="${id}">${t}</button>`).join('')}</nav>`; };
  // Índice que acende o farol: IDP(t) (prazo ganho, em tempo) quando confiável; senão, o IDP em % (início da obra ou cadastro)
  const indicePrazo = r => r.farolTempo ? `IDP(t) ${fmtNum(r.prazoGanho.idpT, 2)}` : `IDP ${fmtNum(r.idp, 2)}`;
  const clsAtraso = r => !r.prazoGanho || Math.abs(r.prazoGanho.atraso) < 1 ? '' : r.prazoGanho.atraso < 0 ? 'pos' : r.sem.k === 'critico' ? 'neg' : r.sem.k === 'atencao' ? 'warn' : '';

  // ---------- e-mails (pedido de acesso e de senha) ----------
  const SITE = () => location.origin + location.pathname;
  const mailto = (para, assunto, corpo) => `mailto:${para}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  // Aviso de nova posição publicada: clientes com acesso à obra em cópia oculta, link direto para o report
  function avisoPublicacao(o) {
    const para = API.listarAcessos().filter(u => u.perfil === 'cliente' && (u.obras || []).includes(o.id) && u.email);
    const link = `${SITE()}#obra-${o.id}/report`, corte = dBR(o.publicadoAte || o.dataCorte);
    const corpo = `Prezados,\n\nA posição de ${corte} da obra ${o.codigo} · ${o.nome} está publicada no Painel de Obras Machine.\n\nReport: ${link}\n(acesso com o seu e-mail e senha)\n\nAtenciosamente,\nPlanejamento · Machine`;
    const bcc = para.map(u => u.email).join(',');
    return { codigo: o.codigo, para, href: `mailto:?${bcc ? `bcc=${encodeURIComponent(bcc)}&` : ''}subject=${encodeURIComponent(`Painel de Obras · Obra ${o.codigo} · posição de ${corte}`)}&body=${encodeURIComponent(corpo)}` };
  }
  const mailtoSenha = email => mailto(EMAIL, 'Painel de Obras Machine · Redefinição de senha',
    `Solicito a redefinição da minha senha de acesso ao Painel de Obras Machine.\n\nE-mail de acesso: ${email || ''}\n\nAtenciosamente,`);

  // ---------- telas de acesso ----------
  const cartaoLogin = corpo => `<div class="login"><div class="login-card"><div class="lm"><img src="${LOGO_FAIXA}" alt="Machine · Realizações com base sólida"></div><div class="lgb">${corpo}</div></div></div>`;
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
        <p class="sub" style="margin-top:8px">Cria o primeiro administrador e as chaves de criptografia. Depois disso, o painel só abre com senha e as obras são cadastradas aqui mesmo.</p></div>
      <form id="f-config" class="steps" novalidate>
        <div class="field"><label for="c-nome">Nome do administrador</label><input class="inp" id="c-nome" autocomplete="name" required></div>
        <div class="field"><label for="c-email">E-mail</label><input class="inp" id="c-email" type="email" autocomplete="username" value="${esc(EMAIL)}" required></div>
        <div class="field"><label for="c-senha">Senha (mínimo 12 caracteres)</label><input class="inp" id="c-senha" type="password" autocomplete="new-password" minlength="12" required></div>
        <div class="field"><label for="c-conf">Repita a senha</label><input class="inp" id="c-conf" type="password" autocomplete="new-password" required></div>
        <div class="field"><label for="c-token">Token do GitHub</label><input class="inp" id="c-token" type="password" autocomplete="off" spellcheck="false" required>
          <small class="hint">${dicaToken()}</small></div>
        <label class="chk"><input type="checkbox" id="c-lembrar"> Lembrar o token neste computador por 7 dias</label>
        <label class="chk"><input type="checkbox" id="c-limpar" checked> Apagar o histórico antigo do repositório (remove as versões sem criptografia)</label>
        ${avisos()}
        <div class="bar-actions"><button class="btn" type="submit">Configurar</button></div>
      </form>`);
  }
  const dicaToken = () => `Crie em <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Fine-grained tokens</a>: acesso só ao repositório <b>${esc(API.github.repo())}</b>, permissão <b>Contents: Read and write</b> e validade de até 90 dias. O token fica só neste navegador.`;
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
        <div class="meta" style="margin:0"><span>Token <b>${tem ? (API.github.lembrado() ? 'configurado neste computador (vale 7 dias)' : 'configurado até fechar o navegador') : 'não configurado'}</b></span></div>
        <form id="f-token" class="steps" novalidate>
          <div class="field"><label for="g-token">${tem ? 'Substituir token' : 'Token do GitHub'}</label><input class="inp" id="g-token" type="password" autocomplete="off" spellcheck="false"><small class="hint">${dicaToken()}</small></div>
          <label class="chk"><input type="checkbox" id="g-lembrar"> Lembrar neste computador por 7 dias (deixe desmarcado em computador compartilhado)</label>
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
        <label class="chk"><input type="checkbox" id="m-lembrar"> Lembrar neste computador por 7 dias</label>
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
    // importação da planilha de restrições: resumo do que foi lido e como aplicar
    if (m.tipo === 'resimp' && S.resImp) {
      const r = S.resImp, base = DB.obras.find(x => x.id === S.obraId) || {}, atuais = (base.restricoes || []).length;
      const ab = r.itens.filter(x => x.status !== 'removida').length, cond = r.itens.filter(x => !x.dataLimite && x.condicao).length;
      return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-t"><div class="modal-card">
      <h2 id="md-t">Importar mapa de restrições</h2>
      <p class="sub"><b>${esc(r.arquivo)}</b>${r.dataMapa ? ` · mapa de ${dBR(r.dataMapa)}` : ''}: ${r.itens.length} restrições (${ab} abertas, ${r.itens.length - ab} removidas${cond ? `, ${cond} com data condicionada` : ''}).</p>
      ${r.equipe ? `<p class="sub">Time <b>${esc(r.equipe)}</b>${r.gestor ? ` · gestor ${esc(r.gestor)}` : ''}${r.indicadores && r.indicadores.irr !== undefined ? ` · IRR do documento ${pct(r.indicadores.irr, 1)}` : ''}. Cada ação do PDF entra como uma restrição; a observação traz as devolutivas.</p>` : ''}
      ${r.outraObra ? `<div class="note-box err" role="alert">O arquivo indica a obra <b>${esc(r.outraObra)}</b>, mas a obra aberta é a <b>${esc(base.codigo)}</b>. Confira antes de importar.</div>` : ''}
      ${(r.avisos || []).map(a => `<div class="note-box" role="status">${esc(a)}</div>`).join('')}
      <p class="sub">${atuais ? `A obra ${esc(base.codigo)} já tem ${atuais} restrições. <b>Somar</b> atualiza as que já existem (mesma frente, tipo e ação) e acrescenta as novas; <b>Substituir</b> apaga as atuais.` : `As restrições entram na obra ${esc(base.codigo)}.`} O farol é recalculado pela data limite; "Atrasado" da planilha vira pendente vencida.</p>
      <div class="bar-actions"><button class="btn" type="button" data-resimp="somar">${atuais ? 'Somar às atuais' : 'Importar'}</button>${atuais ? '<button class="btn sec2" type="button" data-resimp="substituir">Substituir as atuais</button>' : ''}<button class="btn sec2" type="button" data-fecha="1">Cancelar</button></div>
    </div></div>`;
    }
    // depois de publicar: avisar os clientes com acesso à obra (e-mail pronto, com cópia oculta e link direto)
    if (m.tipo === 'avisar') return `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="md-t"><div class="modal-card">
      <h2 id="md-t">Publicado. Avisar o cliente?</h2>
      <p class="sub">${m.para.length ? `${m.para.length === 1 ? 'Uma pessoa tem' : m.para.length + ' pessoas têm'} acesso de cliente à obra ${esc(m.codigo)}: ${m.para.map(u => `<b>${esc(u.nome)}</b>`).join(', ')}. O e-mail sai do seu programa de e-mail, com os endereços em cópia oculta e o link direto para o report.` : `Nenhum acesso de cliente cadastrado para a obra ${esc(m.codigo)}. Você pode preparar o e-mail mesmo assim e escolher os destinatários.`}</p>
      <div class="bar-actions"><a class="btn" id="m-avisar" href="${m.href}">Preparar e-mail</a><button class="btn sec2" type="button" data-fecha="1">Agora não</button></div>
    </div></div>`;
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
  // Matriz executiva: uma coluna por obra (faixa na cor da obra) e as mesmas linhas para todas — prazo, avanço geral,
  // planejado × realizado na data, situação e pontos de atenção. Em telas estreitas cada obra vira um cartão.
  const COR_OBRA = ['#154CB0', '#1E9BD7', '#4E9A3F', '#E07A2F', '#6E56C2', '#C2416B'];
  const ICP = {
    prazo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    avanco: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5A8.5 8.5 0 0 1 20.5 12H12Z" fill="currentColor" stroke="none"/></svg>',
    barras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 20h16"/><path d="M7 17V9M12 17V5M17 17v-6"/></svg>',
    sit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>',
  };
  function donutObra(real, prev) {
    const c = 2 * Math.PI * 44, arco = v => `${Math.max(0, Math.min(1, v)) * c} ${c}`;
    return `<svg viewBox="0 0 112 112" role="img" aria-label="Realizado ${pct(real)}, previsto ${pct(prev)}">
      <circle class="tr" cx="56" cy="56" r="44" fill="none" stroke-width="12"/>
      <circle class="pv" cx="56" cy="56" r="44" fill="none" stroke-width="12" stroke-dasharray="${arco(prev)}" transform="rotate(-90 56 56)"/>
      <circle class="rl" cx="56" cy="56" r="44" fill="none" stroke-width="12" stroke-dasharray="${arco(real)}" stroke-linecap="butt" transform="rotate(-90 56 56)"/>
      <text x="56" y="63" text-anchor="middle">${fmtNum(real * 100, 0)}%</text></svg>`;
  }
  function viewPortfolio() {
    const vazias = obrasDoUsuario().filter(o => !temDados(visaoDaObra(o)));
    const obras = obrasDoUsuario().filter(o => temDados(visaoDaObra(o))).map((o, i) => ({ o, r: calcObra(o), cor: COR_OBRA[i % COR_OBRA.length] }));
    const cabecalho = `<div><div class="kicker">Portfólio de obras</div><h1 class="h1">Visão executiva</h1>`;
    if (!obras.length) return `${cabecalho}</div>
      <div class="card card-pad"><p class="sub" style="margin:0">${ehAdmin() ? 'Nenhuma obra com dados ainda. Cadastre a obra e alimente os arquivos do Prevision.' : 'Ainda não há relatório publicado. A posição aparece aqui assim que o Planejamento publicar.'}</p>
      ${ehAdmin() ? `<div class="bar-actions" style="margin-top:12px"><button class="btn" data-go="nova-obra">Cadastrar obra</button>${vazias.length ? '<button class="btn sec2" data-go="alimentar">Alimentar dados</button>' : ''}</div>` : ''}</div>`;
    const atrasadas = obras.filter(x => x.r.sem.k === 'critico').length;
    const paralis = obras.reduce((s, x) => s + (x.r.campo ? x.r.campo.paralisadas.length : 0), 0);
    const tarefasAtr = obras.reduce((s, x) => s + x.r.cont.atrasada, 0);
    const corte = obras.map(x => x.r.corte).sort().at(-1);
    const realMed = obras.reduce((s, x) => s + x.r.real, 0) / obras.length;
    const prevMed = obras.reduce((s, x) => s + x.r.prevCorte, 0) / obras.length;
    // pontos de atenção na mesma escala para todas as obras
    // restrições vencidas: só para a equipe interna (o cliente não recebe as restrições)
    const hojeP = hojeLocal(), vencidasDe = o => (o.restricoes || []).filter(x => Core.farolRestricao(x, hojeP).k === 'critico').length;
    const atencao = r => [['Tarefas atrasadas', r.cont.atrasada], ['Frentes paralisadas', r.campo ? r.campo.paralisadas.length : 0], ['A contratar', r.crono ? r.crono.pendentes.length : 0]];
    const maxAt = Math.max(1, ...obras.flatMap(x => atencao(x.r).map(a => a[1])));
    // equipe interna: uma linha de restrições por obra (a mesma conta da aba Restrições)
    const interno = !ehCliente();
    const indRes = o => Core.indicadoresRestricoes(o.restricoes || [], hojeP);
    const resVencidas = interno ? obras.reduce((s, x) => s + vencidasDe(x.o), 0) : 0;
    const coluna = ({ o, r, cor }) => {
      const P = r.prazo, slip = r.crono && r.crono.slip, cp = Core.comparaPlano(r.desvio);
      const corDesvio = r.sem.k === 'critico' ? 'neg' : r.desvio >= Core.TOLERANCIA ? 'pos' : '';
      return `<article class="pf-col" style="--ac:${cor}">
        <button class="pf-cab" data-obra="${esc(o.id)}" aria-label="Abrir a obra ${esc(o.codigo)}"><small>Obra ${esc(o.codigo)} · corte ${dCurto(r.corte)}${diff(r.corte, hojeP) > Core.LIMIAR_DIAS.fisico ? ` · <span class="pf-velho">há ${diff(r.corte, hojeP)} dias</span>` : ''}</small><b>${esc(o.nome)}</b><span>${esc([o.cliente, o.cidade].filter(Boolean).join(' · '))}</span></button>
        <div class="pf-cel"><h4>Prazo</h4><dl class="pf-dt"><dt>Início</dt><dd>${dBR(P.contrIni || P.iniCron)}</dd><dt>Término</dt><dd>${dBR(P.contrFim || P.fimCron)}</dd>
          <dd class="rest">${!P.contrFim ? 'datas do cronograma' : P.aVencer >= 0 ? `${P.aVencer} dias a vencer` : `vencido há ${-P.aVencer} dias`}</dd></dl></div>
        <div class="pf-cel"><h4>Avanço físico</h4><div class="pf-av"><p><b>${pct(r.real)}</b><span>realizado · planejado ${pct(r.prevCorte)}</span></p>
          <div class="pf-bul" role="img" aria-label="Realizado ${pct(r.real)}, planejado ${pct(r.prevCorte)}"><i style="width:${Math.min(100, r.real * 100)}%"></i><em style="left:${Math.min(100, r.prevCorte * 100)}%"></em></div>
          <div class="pf-bul-l"><span>0%</span><span>100%</span></div></div></div>
        ${interno ? (() => { const I = indRes(o); return `<div class="pf-cel"><h4>Restrições</h4><div class="pf-sit">
          <div><span>Vencidas</span><b class="${I.vencidas ? 'neg' : ''}">${I.vencidas}</b></div>
          <div><span>Abertas · vencem em 7 dias</span><b>${I.abertas} · ${I.vencem7}</b></div>
          <div><span>IRR · 4 semanas</span><b class="${I.irr4 === null ? '' : I.irr4 >= I.meta ? 'pos' : 'neg'}">${I.irr4 === null ? '—' : pct(I.irr4, 0)}</b></div>
          <button class="pf-res" data-obrares="${esc(o.id)}">Abrir restrições ${IC.right}</button></div></div>`; })() : ''}
        <div class="pf-cel"><h4>Situação</h4><div class="pf-sit">
          <div>${pill(r.sem.k, r.sem.t)}<b>${indicePrazo(r)}</b></div>
          ${r.prazoGanho ? `<div><span>Prazo</span><b class="${clsAtraso(r)}">${Core.textoAtraso(r.prazoGanho)}</b></div>` : ''}
          <div><span>Comparado ao plano</span><b class="${corDesvio}">${cp.dir === 0 ? 'em linha' : pp(r.desvio)}</b></div>
          <div><span>Término do cronograma</span><b class="${slip > 0 ? 'neg' : slip < 0 ? 'pos' : ''}">${dCurto(P.fimCron)}${slip ? ` (${slip > 0 ? '+' : ''}${slip} d)` : ''}</b></div></div></div>
        <div class="pf-cel"><h4>Pontos de atenção</h4><div class="pf-iss">${atencao(r).map(([t, n]) => `<div class="${n ? '' : 'z'}"><span>${t}</span><i style="width:${n ? Math.max(4, n / maxAt * 100) : 4}%"></i><b>${n}</b></div>`).join('')}</div></div>
        <button class="pf-abre" data-obra="${esc(o.id)}">Abrir a obra ${IC.right}</button>
      </article>`;
    };
    return `${cabecalho}<p class="sub">Posição física das obras até ${dBR(corte)}.</p></div>
      <div class="kpi-strip">
        <div class="kpi-t neutro"><span>Obras ativas</span><b>${obras.length}</b><small>com cronograma carregado</small></div>
        ${interno ? `<div class="kpi-t ${resVencidas ? 'crit' : 'ok'}"><span>Restrições vencidas</span><b class="${resVencidas ? 'crit' : ''}">${resVencidas}</b><small>em todas as obras</small></div>` : `<div class="kpi-t"><span>Avanço médio</span><b>${pct(realMed)}</b><small>previsto ${pct(prevMed)} na data</small></div>`}
        <div class="kpi-t ${atrasadas ? 'crit' : 'ok'}"><span>Obras atrasadas</span><b class="${atrasadas ? 'crit' : ''}">${atrasadas}</b><small>índice de prazo abaixo de ${fmtNum(Core.FAIXAS.atencao, 2)}</small></div>
        <div class="kpi-t ${tarefasAtr ? 'crit' : 'ok'}"><span>Tarefas atrasadas</span><b>${tarefasAtr}</b><small>em todas as obras</small></div>
        <div class="kpi-t ${paralis ? 'crit' : 'ok'}"><span>Frentes paralisadas</span><b class="${paralis ? 'crit' : ''}">${paralis}</b><small>no último RDO de cada obra</small></div>
      </div>
      <section class="pf" style="--n:${obras.length};--l:${interno ? 7 : 6}" aria-label="Obras">
        <div class="pf-lab" aria-hidden="true"><div>${esc(Core.mesLongo(corte))}</div><div>${ICP.prazo}Prazo</div><div>${ICP.avanco}Avanço físico</div>${interno ? `<div>${IC.rlist}Restrições</div>` : ''}<div>${ICP.sit}Situação</div><div>${IC.alert}Pontos de atenção</div><div class="pf-vazio"></div></div>
        ${obras.map(coluna).join('')}
      </section>
      ${vazias.length || ehAdmin() ? `<div class="obras-sem">
        ${vazias.map(o => `<button class="add-card" data-obra="${esc(o.id)}"><span><b>${esc(o.codigo)} · ${esc(o.nome)}</b>${ehAdmin() ? 'Sem dados ainda. Use Alimentar.' : 'Sem relatório publicado.'}</span></button>`).join('')}
        ${ehAdmin() ? `<button class="add-card novo" data-go="nova-obra"><span><b>+</b>Cadastrar obra</span></button>` : ''}</div>` : ''}`;
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
    const r = calcObra(base);
    const P = r.prazo;
    const tempoCron = Math.max(0, Math.min(1, diff(P.iniCron, r.corte) / Math.max(1, diff(P.iniCron, P.fimCron))));
    const narr = Core.narrativa(o, r);
    const c = r.campo;

    // linha do tempo: início contratual → fim contratual
    const F = r.projecaoFaixa, fx = F ? [F.atrasoMantido, F.desempenhoMantido].sort() : null;
    const t0 = P.contrIni || P.iniCron, t1 = [P.contrFim, r.projecao, P.fimCron, ...(fx || [])].filter(Boolean).sort().at(-1);
    const X = d => Math.max(0, Math.min(100, diff(t0, d) / Math.max(1, diff(t0, t1)) * 100));
    const rotProj = !r.projecao ? null : F
      ? ['proj', r.projecao, 'Projeção', fx[0].slice(0, 7) === fx[1].slice(0, 7) ? '~' + Core.mesCurto(fx[0]) : `${Core.mesCurto(fx[0])} a ${Core.mesCurto(fx[1])}`]
      : ['proj', r.projecao, 'Projeção (ritmo)', '~' + Core.mesCurto(r.projecao)];
    const marcos = [
      ['corte', r.corte, 'Corte', dBR(r.corte)],
      ['cron', P.fimCron, 'Término cron.', dBR(P.fimCron)],
      rotProj,
      P.contrFim ? ['contr', P.contrFim, 'Contrato', dBR(P.contrFim)] : null,
    ].filter(Boolean);
    const tl = `<div class="tl" aria-label="Linha do tempo de prazos">
        <div class="tl-bar"><div class="axis"></div><div class="done" style="width:${X(r.corte)}%"></div>
          ${marcos.map(([k, d]) => `<i class="mk mk-${k}" style="left:${X(d)}%"></i>`).join('')}</div>
        <div class="tl-ends"><span>${dBR(t0)}</span><span>${dBR(t1)}</span></div>
        <dl class="tl-leg">${marcos.map(([k, d, t, v]) => `<div><dt><i class="mk-${k}"></i>${t}</dt><dd>${v}</dd></div>`).join('')}</dl>
      </div>`;

    const situacao = `
      <div class="card" style="overflow:hidden">
        <div class="sit">
          <div>
            <div class="chips">${pill(r.sem.k, r.sem.t)}${(() => { const idade = diff(r.corte, hojeLocal()); return `<span class="pill ${idade > Core.LIMIAR_DIAS.fisico ? 'atencao' : 'plain'}" title="Data de corte dos dados físicos">Corte ${dBR(r.corte)}${idade > Core.LIMIAR_DIAS.fisico ? ` · há ${idade} dias` : ''}</span>`; })()}${ehCliente() ? '' : (c && c.rdosPendentes ? `<span class="pill atencao">${c.rdosPendentes} RDO em preenchimento</span>` : '')}</div>
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
              ${r.prazoGanho ? `<div class="kpi"><span>Prazo</span><b class="${clsAtraso(r).replace('neg', 'crit').replace('pos', 'ok')}">${Core.textoAtraso(r.prazoGanho)}</b><small>${r.farolTempo ? `IDP(t) ${fmtNum(r.prazoGanho.idpT, 2)} · IDP em % ${fmtNum(r.idp, 2)}` : `IDP ${fmtNum(r.idp, 2)} · ${r.prazoGanho.confiavel ? 'farol pelo IDP em % (cadastro da obra)' : 'início da obra, índice em tempo ainda instável'}`}</small></div>`
                : r.inicioObra ? `<div class="kpi"><span>Prazo</span><b>—</b><small>início da obra · farol a partir de 2% previsto</small></div>` : `<div class="kpi"><span>IDP</span><b>${fmtNum(r.idp, 2)}</b><small>realizado ÷ previsto</small></div>`}
              <div class="kpi"><span>Ritmo atual</span><b>${pct(r.ritmo)}</b><small>média/mês · últimos 3 meses</small></div>
              ${(() => { const dias = diff(r.corte, P.fimCron);
                // a menos de 30 dias do fim do cronograma, "% ao mês" vira número sem sentido (ex.: 182% ao mês): mostra o que falta e o prazo
                if (!r.ritmoCron || dias < 30) return `<div class="kpi"><span>Para concluir</span><b class="${r.restante > 0.005 ? 'crit' : 'ok'}">${pct(r.restante)}</b><small>${dias > 0 ? `em ${dias} ${dias === 1 ? 'dia' : 'dias'}, até ${dCurto(P.fimCron)}` : `fim do cronograma em ${dCurto(P.fimCron)} já passou`}</small></div>`;
                return `<div class="kpi"><span>Ritmo necessário</span><b class="${r.ritmoCron > r.ritmo * 1.05 ? 'crit' : ''}">${pct(r.ritmoCron)}</b><small>ao mês, para fechar em ${dCurto(P.fimCron)}</small></div>`; })()}
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

    // Tendência do prazo: atraso em dias mês a mês (pela Curva S) e o histórico das cargas (o que foi informado em cada corte)
    const hist = (o.historico || []).filter(h => h.corte <= r.corte).slice(-12).reverse();
    const tendSec = r.tendencia.length ? sec('tendencia', 'Tendência do prazo', r.prazoGanho ? Core.textoAtraso(r.prazoGanho) : '', `
      <p class="sec-lead">Atraso em dias no fim de cada mês: quantos dias atrás do plano estava o avanço realizado (prazo ganho). Barra para cima = atraso; para baixo = adiantada. Medido contra o cronograma atual: depois de um replanejamento, os meses passados são relidos no plano novo.</p>
      <div class="legend"><span><i class="sw sw-atr"></i>Atraso</span><span><i class="sw sw-adi"></i>Adiantada</span><span class="note">* data de corte${r.tendencia.some(t => !t.confiavel) ? ' · esmaecido: início da obra, índice instável' : ''}</span></div>
      <div class="chart" id="ch-tend"></div>
      ${hist.length ? `<div><div class="step-t" style="margin:6px 0">Histórico de cargas · o que o painel mostrava em cada corte</div>
        <div class="tw"><table class="t"><thead><tr><th>Corte</th><th class="n">Realizado</th><th class="n">Previsto</th><th class="n">Prazo</th><th class="n">Término do cronograma</th><th class="n">Projeção</th></tr></thead><tbody>
        ${hist.map(h => `<tr><td>${dBR(h.corte)}</td><td class="n">${pct(h.real)}</td><td class="n">${pct(h.prev)}</td>
          <td class="n">${h.atraso === null || h.atraso === undefined ? '—' : Core.textoAtraso(h)}</td><td class="n">${dBR(h.fimCron)}</td>
          <td class="n">${h.projecaoFaixa ? [h.projecaoFaixa.atrasoMantido, h.projecaoFaixa.desempenhoMantido].sort().map(Core.mesCurto).filter((v, i, a) => a.indexOf(v) === i).join(' a ') : h.projecao ? Core.mesCurto(h.projecao) : '—'}</td></tr>`).join('')}
        </tbody></table></div></div>` : `<p class="sec-lead" style="margin:0">O histórico de cargas começa a ser registrado na próxima carga física desta obra.</p>`}`, true) : '';

    const mesAtual = (o.mensal || []).find(m => m.mes === r.corte.slice(0, 7));
    const mensal = sec('mensal', 'Avanço por mês', mesAtual ? `${mesLongo(mesAtual.mes)}: ${pct(mesAtual.realizado)} de ${pct(mesAtual.previsto)}` : '', `
      <div class="legend"><span><i class="sw sw-bplan"></i>Previsto no mês</span><span><i class="sw sw-breal"></i>Realizado no mês</span><span class="note">* mês do corte, parcial até ${dCurto(r.corte)}</span></div>
      <div class="chart" id="ch-mensal"></div>`, true);

    const rf = Core.calcFinanceiro(o, r.corte);
    // cliente vê o financeiro nas mesmas condições do report (cadastro da obra → Valor agregado no report)
    const financeiro = rf && (!ehCliente() || Core.vaNoReport(o, rf)) ? sec('financeiro', 'Financeiro — Valor Agregado', rf.spi !== null ? `SPI ${fmtNum(rf.spi, 2)}` : (rf.faturamento ? moeda(rf.faturamento.medido) : ''), `
      <div class="kpis">
        ${rf.faturamento ? `<div class="kpi"><span>Valor do contrato</span><b>${moeda(rf.faturamento.contratual)}</b><small>com aditivos</small></div>
        <div class="kpi"><span>Medido acumulado</span><b>${moeda(rf.faturamento.medido)}</b><small>${rf.faturamento.pctMedido !== null ? pct(rf.faturamento.pctMedido, 1) + ' do contrato · ' : ''}última medição ${esc(rf.faturamento.ultimaMedicao || '—')}</small></div>
        <div class="kpi"><span>Saldo de contrato</span><b>${moeda(rf.faturamento.saldo)}</b><small>a medir</small></div>` : ''}
        <div class="kpi"><span>SPI</span><b>${rf.spi !== null ? fmtNum(rf.spi, 2) : '—'}</b><small>${rf.spi !== null ? `EV ${Core.moedaCurta(rf.ev)} ÷ PV ${Core.moedaCurta(rf.pv)}` : 'EV ÷ PV'}</small></div>
        <div class="kpi"><span>CPI</span><b>${rf.cpi !== null ? fmtNum(rf.cpi, 2) : '—'}</b><small>${rf.cpi !== null ? 'EV ÷ AC' : 'sem dado de custo real (AC)'}</small></div>
        ${rf.medidoVsExecutado && !ehCliente() ? (() => { const mv = rf.medidoVsExecutado;
          return `<div class="kpi"><span>Medido × executado <em class="int">interno</em></span><b class="${mv.situacao === 'em-linha' ? '' : 'warn'}">${mv.situacao === 'em-linha' ? 'Em linha' : (mv.dif > 0 ? '+' : '−') + Core.moedaCurta(Math.abs(mv.dif))}</b>
            <small>${mv.situacao === 'medido-acima' ? `medição à frente da execução (${pct(mv.frac, 1)} do contrato)` : mv.situacao === 'medido-abaixo' ? `execução ainda não medida (${pct(-mv.frac, 1)} do contrato)` : 'diferença até 2% do contrato'} · medido ${Core.moedaCurta(mv.medido)} × EV ${Core.moedaCurta(mv.ev)}</small></div>`; })() : ''}
      </div>
      ${rf.spi !== null ? `<div class="rx-tok">${GLOSSARIO_VA}</div>` : ''}
      ${rf.pts ? `<div class="legend"><span><i class="sw sw-real"></i>Realizado (EV)</span><span><i class="sw sw-prev"></i>Planejado (PV)</span><span><i class="sw sw-base"></i>Base</span><span class="note">${notaEscalaVA(rf)}</span></div>
      <div class="chart" id="ch-fin"></div>` : '<p class="sub" style="margin:0">Ainda sem Curva S financeira (Financeiro VA) carregada.</p>'}`) : '';

    const frentes = !r.pesosOk && r.crono && r.crono.completo ? sec('frentes', 'Avanço por frente', `${Core.atividades(r).length} frentes da EAP`, `
      <p class="sec-lead">Avanço de cada atividade no cronograma do Prevision: barra = realizado da atividade; traço = planejado na data. Farol = realizado ÷ planejado. Toque numa frente para abrir as etapas.</p>
      ${ehAdmin() ? `<div class="note-box">O Progresso por tarefas veio filtrado por período (raiz ${pct(r.pesoRaiz, 2)}), então o peso de cada frente na obra não aparece. Exporte sem filtro de datas para ter os pesos.</div>` : ''}
      <div class="rx-tok">${atividadesHTML(Core.atividades(r), o)}</div>`) : sec('frentes', 'Avanço por frente', `${r.pacotes.length} frentes da EAP`, `
      <p class="sec-lead">Barra azul: realizado. Traço escuro: previsto na data de corte. Fundo: peso da frente na obra. Toque numa frente para abrir as etapas.</p>
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
    const restr = c ? sec('restricoes', 'Paralisações no RDO', c.paralisadas.length ? `<span class="pill critico">${c.paralisadas.length} abertas</span>` : 'nenhuma', blocoRestricoes(c)) : '';
    // restrições da obra (equipe interna): o essencial da aba Restrições, para a obra ficar toda num lugar só
    const resResumo = !ehCliente() ? (() => {
      const hoje = hojeLocal(), itens = base.restricoes || [], I = Core.indicadoresRestricoes(itens, hoje);
      const top = Core.ordenarRestricoes(itens.filter(x => x.status !== 'removida'), hoje).slice(0, 4);
      return sec('restricoes-resumo', 'Restrições', itens.length ? `${I.vencidas ? `<span class="pill critico">${I.vencidas} vencidas</span> ` : ''}${I.abertas} abertas` : 'nenhuma registrada', `
        <div class="rdo-head">
          <div class="mini"><span>Abertas</span><b class="num">${I.abertas}</b><small>${I.semData ? `${I.semData} sem data` : 'com data limite'}</small></div>
          <div class="mini"><span>Vencidas</span><b class="num" style="color:${I.vencidas ? 'var(--crit)' : 'inherit'}">${I.vencidas}</b><small>data limite já passou</small></div>
          <div class="mini"><span>Vencem em 7 dias</span><b class="num">${I.vencem7}</b><small>prioridade da semana</small></div>
          <div class="mini"><span>IRR · 4 semanas</span><b class="num">${I.irr4 === null ? '—' : pct(I.irr4, 0)}</b><small>meta ${pct(I.meta, 0)}</small></div>
        </div>
        ${top.length ? `<ul class="rs-top">${top.map(x => { const f = Core.farolRestricao(x, hoje); return `<li>${pill(f.k, f.t)}<span><b>${esc(x.frente || '—')}</b> · ${esc(x.acao || '')}</span><small>${esc(x.responsavel || '—')}${x.dataLimite ? ' · ' + dCurto(x.dataLimite) : ''}</small></li>`; }).join('')}</ul>` : ''}
        <div class="bar-actions"><button class="btn sec2" data-go="restricoes">Abrir o mapa de restrições</button></div>`, I.vencidas > 0);
    })() : '';
    const conf = ehAdmin() ? sec('conferencia', 'Conferência dos dados', 'só administrador', blocoConferencia(o, r), false) : '';

    return `
      ${ehAdmin() && base.cargaId ? barraPublicacao(base) : ''}
      <div class="head-row"><div style="min-width:0">
        <div class="kicker">Obra ${esc(o.codigo)} · ${esc(o.cidade)}</div>
        <h1 class="h1">${esc(o.nome)}</h1>
        <p class="sub">${esc(o.cliente)} · contratante ${esc(o.contratante)}</p>
        <div class="meta">${o.contrato ? `<span>Contrato <b>${esc(o.contrato)}</b></span>` : ''}<span>Prazo contratual <b>${dBR(P.contrIni)} a ${dBR(P.contrFim)}</b> (${P.total} dias${P.contrFonte ? ' · ' + P.contrFonte : ''})</span><span>Decorridos <b>${P.decorrido}</b> · a vencer <b>${P.aVencer}</b></span>${o.responsavel ? `<span>Responsável <b>${esc(o.responsavel)}</b></span>` : ''}</div>
      </div><div class="bar-actions no-print"><button class="btn sec2" data-copialink>Copiar link</button>${ehAdmin() ? '<button class="btn sec2" data-go="editar-obra">Editar cadastro</button>' : ''}</div></div>
      ${navSecoes([[resResumo, 'restricoes-resumo', 'Restrições'], [cronoSec, 'cronograma', 'Cronograma'], [curva, 'curva', 'Curva S'], [tendSec, 'tendencia', 'Prazo'], [mensal, 'mensal', 'Mês a mês'], [financeiro, 'financeiro', 'Financeiro'], [frentes, 'frentes', 'Frentes'], [tarefas, 'tarefas', 'Tarefas'], [campo, 'campo', 'Campo'], [fotosSec, 'fotos', 'Fotos'], [mapaSec, 'mapa', 'Mapa'], [restr, 'restricoes', 'Paralisações'], [conf, 'conferencia', 'Conferência']])}
      ${situacao}${resResumo}${cronoSec}${curva}${tendSec}${mensal}${financeiro}${frentes}${tarefas}${campo}${fotosSec}${mapaSec}${restr}${conf}`;
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
    const empresas = [...new Set(u.atividades.flatMap(Core.empresasFrente))];
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
          <div class="legend" style="margin-bottom:4px"><span><i class="sw sw-terc"></i>Terceiros</span><span><i class="sw sw-prop"></i>Próprios</span>${c.diasImpraticaveis ? `<span><i class="sw sw-chuva"></i>Impraticável (${c.diasImpraticaveis} d)</span>` : ''}</div>
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
      <p class="sec-lead">Fotos extraídas do PDF dos RDOs, separadas por dia. A legenda mostra o serviço quando o RDO traz a descrição da foto.${ehAdmin() ? ` Marque com ★ até ${Core.LIM_FOTOS} fotos para o report; o que faltar é completado com 1 foto por serviço dos últimos 30 dias, em ordem cronológica.` : ''}</p>
      <div class="seg" role="group" aria-label="Filtrar fotos por dia">
        ${dias.map(n => `<button data-fotordo="${n}" aria-pressed="${sel === n}">${dCurto(dataDe(n))}<b>${r.fotos.filter(f => f.rdo === n).length}</b></button>`).join('')}
        <button data-fotordo="todos" aria-pressed="${sel === 'todos'}">Todas<b>${r.fotos.length}</b></button>
      </div>
      <div class="galeria">${mostra.map(f => `
        <figure class="foto">
          <button class="foto-abre" data-lb="${lista.indexOf(f)}" aria-label="Ampliar foto ${f.idx} do RDO ${f.rdo}"><img src="${urlImg(f.src)}" alt="${esc(legendaCurta(f) || `Foto ${f.idx} do RDO nº ${f.rdo}, ${dBR(f.data)}`)}" loading="lazy" width="${f.w}" height="${f.h}"></button>
          <figcaption>${legendaCurta(f) ? `<b>${esc(legendaCurta(f))}</b>${legendaDet(f) ? `<span>${esc(legendaDet(f))}</span>` : ''}` : ''}<span class="src">RDO ${f.rdo} · ${dCurto(f.data)} · foto ${f.idx}</span></figcaption>
          ${ehAdmin() ? `<button class="estrela" data-estrela="${f.id}" aria-pressed="${dest.has(f.id)}" aria-label="${dest.has(f.id) ? 'Tirar do report' : 'Usar no report'}">★</button>` : ''}
        </figure>`).join('')}</div>
      ${lista.length > N ? `<button class="more" data-fotostodas="1">${S.fotosTodas ? 'Mostrar menos' : `Mostrar as ${lista.length} fotos`}</button>` : ''}`;
  }
  function lightbox() {
    if (S.lb === null) return '';
    const base = DB.obras.find(x => x.id === S.obraId); const r = calcObra(base);
    const { lista } = fotosFiltradas(r); const f = lista[S.lb]; if (!f) return '';
    return `<div class="lb" role="dialog" aria-modal="true" aria-label="Foto ampliada">
      <div class="lb-top"><span>${legendaCurta(f) ? `<b>${esc(legendaCurta(f))}</b>${legendaDet(f) ? ' · ' + esc(legendaDet(f)) : ''}<br>` : ''}RDO nº ${f.rdo} · ${diaSemana(f.data)}, ${dBR(f.data)} · foto ${f.idx}</span><span class="tn">${S.lb + 1} / ${lista.length}</span><button class="lb-x" data-lbx="1" aria-label="Fechar">×</button></div>
      <div class="lb-img"><img src="${urlImg(f.src)}" alt="Foto ${f.idx} do RDO nº ${f.rdo}"></div>
      <div class="lb-nav"><button data-lbnav="-1" ${S.lb === 0 ? 'disabled' : ''}>‹ Anterior</button><button data-lbnav="1" ${S.lb >= lista.length - 1 ? 'disabled' : ''}>Próxima ›</button></div>
    </div>`;
  }

  // ---------- cronograma (Gantt) ----------
  // Barra cheia = datas atuais; fio abaixo = base. O preenchimento é o realizado da linha.
  // Linhas vencidas e incompletas ficam marcadas; tracejado = data de corte; fio escuro = fim contratual.
  function ganttHTML(r) {
    const k = r.crono; if (!k) return '';
    const t0 = k.ini, t1 = k.fim, tot = Math.max(1, diff(t0, t1));
    const X = d => Math.max(0, Math.min(100, diff(t0, d) / tot * 100));
    const W = (a, b) => Math.max(0.6, X(b) - X(a));
    const meses = []; { let d = t0.slice(0, 7) + '-01'; while (d <= t1) { if (d >= t0) meses.push(d); const [y, m] = d.split('-').map(Number); d = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`; } }
    const filhos = l => k.linhas.filter(x => x.nivel === l.nivel + 1 && x.eap.startsWith(l.eap + '.'));
    const visivel = l => {
      if (l.nivel <= 2) return true;
      const p = l.eap.split('.'); for (let i = 2; i < p.length; i++) if (!S.abertos['g' + p.slice(0, i).join('.')]) return false; return true;
    };
    const linhas = k.linhas.filter(visivel);
    const corteX = X(r.corte), contrX = r.prazo.contrFim ? X(r.prazo.contrFim) : null;
    // rótulos de mês sem embolar: todo mês até 1 ano; trimestral até 2 anos; semestral até 4; anual acima (sempre com o ano)
    const passoM = meses.length <= 12 ? 1 : meses.length <= 24 ? 3 : meses.length <= 48 ? 6 : 12;
    const rotM = (m, i) => Core.mesCurto(m).slice(0, 3) + (i === 0 || passoM > 1 || m.slice(5, 7) === '01' ? '/' + m.slice(2, 4) : '');
    const grade = `<div class="gt-grid">${meses.map((m, i) => `<i style="left:${X(m)}%"${i % passoM ? ' class="fr"' : ''}></i>`).join('')}<b class="gt-corte" style="left:${corteX}%"></b>${contrX !== null ? `<b class="gt-contr" style="left:${contrX}%"></b>` : ''}</div>`;
    const cab = `<div class="gt-row gt-head"><div class="gt-nm">Linha do cronograma</div><div class="gt-tl">${meses.map((m, i) => X(m) > 93 || i % passoM ? '' : `<span style="left:${X(m)}%">${rotM(m, i)}</span>`).join('')}</div><div class="gt-pc">Real / prev.</div><div class="gt-sl">Término</div></div>`;
    const row = l => {
      const tem = l.nivel >= 2 && filhos(l).length > 0, ab = !!S.abertos['g' + l.eap];
      const nome = l.nivel === 1 ? esc(String(l.nome || '').replace(/\s+/g, ' ').trim()) : `${esc(l.nomeExib)}${l.area ? ` <small class="gt-area">${esc(l.area)}</small>` : ''}`;
      const sub = `<small>${dCurto(l.inicio)}–${dCurto(l.fim)} · ${l.duracao ?? '—'} d${l.responsaveis ? ' · ' + esc(l.responsaveis.replace(/,?\s*Pendente de contratação/i, '')) : ''}</small>`;
      const flags = `${l.pendente ? '<span class="pill atencao">Pendente de contratação</span>' : ''}${l.situacao === 'atrasada' ? `<span class="pill critico">Venceu há ${l.diasAtraso} d</span>` : ''}`;
      const gap = l.realizado - l.previsto;
      const pcCls = gap < -0.05 ? 'neg' : gap > 0.05 ? 'pos' : '';
      const sl = l.slip === null ? '—' : l.slip === 0 ? 'na base' : `${l.slip > 0 ? '+' : '−'}${Math.abs(l.slip)} d`;
      return `<div class="gt-row n${Math.min(l.nivel, 4)} s-${l.situacao}" title="${esc(l.nome)}">
        <div class="gt-nm" style="padding-left:${(l.nivel - 1) * 14}px">${tem ? `<button class="gt-tg" data-abre="g${l.eap}" aria-expanded="${ab}" aria-label="${ab ? 'Recolher' : 'Abrir'} ${esc(l.nomeExib)}">${IC.right}</button>` : '<span class="gt-sp"></span>'}<span class="gt-tx"><b>${nome}</b>${sub}${flags ? `<span class="gt-fl">${flags}</span>` : ''}</span></div>
        <div class="gt-tl">${l.inicioBase && l.fimBase ? `<i class="gb-base" style="left:${X(l.inicioBase)}%;width:${W(l.inicioBase, l.fimBase)}%"></i>` : ''}${l.situacao === 'sem-data' ? '' : `<i class="gb-at" style="left:${X(l.inicio)}%;width:${W(l.inicio, l.fim)}%"><i class="gb-fill" style="width:${Math.min(100, l.realizado * 100)}%"></i></i>`}</div>
        <div class="gt-pc ${pcCls}"><b>${pct(l.realizado, 0)}</b><small>${pct(l.previsto, 0)}</small></div>
        <div class="gt-sl ${l.slip > 0 ? 'neg' : l.slip < 0 ? 'pos' : ''}"><b>${l.situacao === 'sem-data' ? 'a definir' : dCurto(l.fim)}</b><small>${l.situacao === 'sem-data' ? '' : sl}</small></div>
      </div>`;
    };
    const leg = `<div class="legend gt-leg"><span><i class="lg-at"></i>Atual, preenchido pelo realizado</span><span><i class="lg-base"></i>Base</span><span><i class="lg-corte"></i>Corte ${dCurto(r.corte)}</span>${contrX !== null ? `<span><i class="lg-contr"></i>Fim contratual ${dCurto(r.prazo.contrFim)}</span>` : ''}</div>`;
    return `<div class="gantt">${leg}<div class="gt-wrap"><div class="gt">${cab}<div class="gt-body">${grade}${linhas.map(row).join('')}</div></div></div></div>`;
  }

  // ---------- mapa de avanço (aba Obra) ----------
  // Planta da obra (imagem ou página de PDF) com áreas demarcadas: Executado · Executando · A executar.
  // Área vinculada a uma atividade do cronograma muda de cor sozinha a cada carga; sem vínculo, a situação é a escolhida aqui.
  // O mapa salvo vai para o rascunho da obra e entra no report (folha A4 retrato, ou duas plantas numa folha paisagem).
  // chaves antigas mantidas (mapas já salvos); o report é todo em A4 paisagem
  const PAGINA_MAPA = { retrato: '1 planta por folha', paisagem: '2 plantas por folha' };
  const novoId = () => Math.random().toString(36).slice(2, 9);
  function blocoMapas(base, o, r) {
    const ed = S.mapaEd;
    if (ed && ehAdmin()) return editorMapa(ed, r);
    const mapas = Core.mapasDaObra(o, r);
    return `<p class="sec-lead">Planta da obra com as áreas de cada frente de serviço classificadas em <b>Executado</b>, <b>Executando</b> e <b>A executar</b>. Área vinculada a uma atividade do cronograma muda de cor sozinha a cada carga.${ehAdmin() ? ' O mapa salvo vai para o rascunho e entra no report depois de publicado.' : ''}</p>
      ${mapas.length ? `<div class="mp-lista">${mapas.map((m, i) => `<figure class="mp-card"><figcaption><b>${esc(m.titulo || 'Sem título')}</b><small>${PAGINA_MAPA[m.pagina || 'retrato']} · ${m.zonas.length} ${m.zonas.length === 1 ? 'área' : 'áreas'}${(m.fotos || []).length ? ` · ${m.fotos.length} ${m.fotos.length === 1 ? 'foto' : 'fotos'} no report` : ''}</small></figcaption>
        ${plantaHTML(m)}${quadroMapa(m)}
        ${ehAdmin() ? `<div class="bar-actions"><button class="btn sec2" data-mapaed="${i}">Editar</button><button class="more neg" data-mapadel="${i}">Remover</button></div>` : ''}</figure>`).join('')}</div>`
      : `<p class="sub" style="margin:0">${ehAdmin() ? 'Nenhum mapa ainda. Envie a planta (PDF ou imagem) e demarque as áreas.' : 'Nenhum mapa de avanço publicado.'}</p>`}
      ${ehAdmin() ? '<div class="bar-actions"><button class="btn" data-mapaed="novo">+ Novo mapa de avanço</button></div>' : ''}`;
  }
  function editorMapa(ed, r) {
    const ativ = Core.atividadesParaMapa(r), m = ed.m;
    const vis = m.img ? Core.mapasDaObra({ mapas: [m] }, r)[0] : { ...m, zonas: [], resumo: [] }, zonas = vis.zonas;
    const z = zonas.find(x => x.id === ed.sel);
    const modo = ed.modo || 'retangulo', rasc = ed.rasc || [];
    const ferr = m.img ? `<div class="mp-ferr">
        <div class="seg" role="group" aria-label="Ferramenta de desenho">${[['retangulo', '▭ Retângulo'], ['poligono', '⬠ Polígono']].map(([k, t]) => `<button data-mpmodo="${k}" aria-pressed="${modo === k}">${t}</button>`).join('')}</div>
        ${modo === 'poligono' ? `<button class="btn" type="button" data-mprasc="fecha" ${rasc.length < 3 ? 'disabled' : ''}>Concluir área${rasc.length ? ` (${rasc.length} ${rasc.length === 1 ? 'ponto' : 'pontos'})` : ''}</button><button class="more" type="button" data-mprasc="volta" ${rasc.length ? '' : 'disabled'}>Desfazer ponto</button><button class="more" type="button" data-mprasc="cancela" ${rasc.length ? '' : 'disabled'}>Cancelar</button>` : ''}
        <p class="hint">${modo === 'poligono'
          ? 'Clique nos cantos da área, um por um, contornando o desenho da planta. Para fechar, clique no primeiro ponto, dê duplo clique ou tecle Enter (Esc cancela).'
          : 'Arraste sobre a planta para criar uma área.'} Numa área selecionada: arraste o meio para mover, os pontos brancos para ajustar os cantos, os tracejados para criar um canto novo e o círculo escuro acima para girar.</p>
      </div>` : '';
    const painel = z ? `<div class="mp-painel card-pad">
        <div class="step-t">Área ${z.n}</div>
        <div class="field"><label for="mp-rot">Nome da área</label><input class="inp" id="mp-rot" value="${esc(z.rotulo || '')}" placeholder="ex.: Galpão A · eixo 1–5"></div>
        <div class="field"><label for="mp-vinc">Atividade do cronograma</label><select class="inp" id="mp-vinc"><option value="">— sem vínculo (situação escolhida abaixo) —</option>
          ${ativ.map(a => `<option value="${esc(a.chave)}" ${z.vinculo && z.vinculo.chave === a.chave ? 'selected' : ''}>${'  '.repeat(Math.max(0, a.nivel - 2))}${esc(a.eap)} · ${esc(a.nome)} (${pct(a.feito, 0)})</option>`).join('')}</select>
          <small class="hint">${z.auto ? `Situação automática: <b>${Core.MAPA_ST[z.st]}</b> (${pct(z.feito, 0)} realizado).` : 'Sem vínculo, a situação é a escolhida abaixo e não muda sozinha.'}</small></div>
        <div class="seg" role="group" aria-label="Situação da área">${Object.entries(Core.MAPA_ST).map(([k, t]) => `<button data-mpst="${k}" aria-pressed="${z.st === k}" ${z.auto ? 'disabled' : ''}><i class="mp-sw ${COR_MAPA[k]}"></i>${t}</button>`).join('')}</div>
        <div class="bar-actions"><button class="more" data-mpdup="1">Duplicar área</button><button class="more neg" data-mpzdel="1">Remover área</button><button class="more" data-mpsel="">Fechar</button></div>
      </div>` : '';
    return `<div class="mp-editor steps">
      <div class="two"><div class="field"><label for="mp-titulo">Frente de serviço</label><input class="inp" id="mp-titulo" value="${esc(m.titulo || '')}" placeholder="ex.: Cobertura · Armazém Praia do Forte"></div>
        <div class="field"><label for="mp-pagina">Folha no report</label><select class="inp" id="mp-pagina">${Object.entries(PAGINA_MAPA).map(([k, t]) => `<option value="${k}" ${(m.pagina || 'retrato') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <small class="hint">O report é em A4 paisagem; com 2 plantas largas na mesma folha, elas ficam uma sobre a outra.</small></div></div>
      <div class="field"><label for="mp-arq">Planta (PDF ou imagem)</label><input class="inp" type="file" id="mp-arq" accept=".pdf,image/png,image/jpeg">
        ${ed.pdfPaginas > 1 ? `<div class="bar-actions" style="margin-top:6px"><label for="mp-pag" class="hint">O PDF tem ${ed.pdfPaginas} páginas. Página:</label><input class="inp" id="mp-pag" type="number" min="1" max="${ed.pdfPaginas}" value="${ed.pdfPagina || 1}" style="width:90px"><button class="btn sec2" type="button" id="mp-usapag">Usar esta página</button></div>` : ''}
        ${ed.lendo ? `<small class="hint" role="status">${esc(ed.lendo)}</small>` : ''}</div>
      ${ferr}
      ${m.img ? `<div class="mp-edit${modo === 'poligono' ? ' desenhando' : ''}">${plantaHTML(vis, { sel: rasc.length ? null : ed.sel, editor: true })}</div>${legMapa(vis)}` : ''}
      ${painel}
      ${zonas.length ? `<div class="tw">${tabelaMapa(vis, false).replace(/<tr><td class="mp-n">/g, '<tr class="mp-linha"><td class="mp-n">')}</div>` : ''}
      <div class="field"><label for="mp-fotos">Fotos da frente no report <small class="hint">— evidências do período, duas por folha, logo depois da planta</small></label>
        ${(m.fotos || []).length ? `<div class="mp-fotos">${m.fotos.map((f, i) => `<div class="mp-foto"><img src="${f.src}" alt="Foto ${i + 1} da frente"><input class="inp" data-mpfleg="${i}" value="${esc(f.legenda || '')}" placeholder="Legenda (ex.: Montagem do Pipe Rack)" aria-label="Legenda da foto ${i + 1}"><button class="more neg" type="button" data-mpfdel="${i}">Remover</button></div>`).join('')}</div>` : ''}
        <input class="inp" type="file" id="mp-fotos" accept="image/png,image/jpeg,image/webp" multiple>
        ${ed.lendoFotos ? `<small class="hint" role="status">${esc(ed.lendoFotos)}</small>` : ''}
        <small class="hint">Quando alguma frente tem fotos aqui, o report usa só as fotos escolhidas nas frentes (sem a seleção automática dos RDOs).</small></div>
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
      const m = i < 0 ? { id: novoId(), titulo: '', pagina: 'retrato', zonas: [] } : JSON.parse(JSON.stringify(lista[i]));
      // retângulos de mapas antigos viram polígonos de 4 pontos (editáveis e giráveis)
      m.zonas = (m.zonas || []).map(({ x, y, w, h, ...z }) => ({ ...z, pts: Core.ptsZona({ x, y, w, h, ...z }) }));
      S.mapaEd = { idx: i, m, sel: null, modo: 'retangulo', rasc: [] };
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
    // fotos da frente (report): JPEG de até 1400 px no lado maior, guardadas com o mapa no rascunho
    const ff = $('#mp-fotos'); if (ff) ff.onchange = async () => {
      const arqs = [...ff.files]; if (!arqs.length) return;
      ed.lendoFotos = `Lendo ${arqs.length} ${arqs.length === 1 ? 'foto' : 'fotos'}…`; render();
      try {
        for (const f of arqs) {
          const bmp = await createImageBitmap(f), k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
          const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
          const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(bmp, 0, 0, cv.width, cv.height);
          (m.fotos = m.fotos || []).push({ id: novoId(), src: cv.toDataURL('image/jpeg', 0.8), legenda: '', em: hojeLocal() });
        }
        ed.lendoFotos = null;
      } catch (e) { ed.lendoFotos = 'Não consegui ler a foto: ' + e.message; }
      render();
    };
    $$('[data-mpfleg]').forEach(i => i.oninput = () => { const f = (m.fotos || [])[+i.dataset.mpfleg]; if (f) f.legenda = i.value; });
    $$('[data-mpfdel]').forEach(b => b.onclick = () => { m.fotos.splice(+b.dataset.mpfdel, 1); render(); });
    const zona = () => m.zonas.find(z => z.id === ed.sel);
    const rot = $('#mp-rot'); if (rot) rot.oninput = () => { const z = zona(); if (z) z.rotulo = rot.value; };
    const vc = $('#mp-vinc'); if (vc) vc.onchange = () => { const z = zona(); if (!z) return; const base = DB.obras.find(x => x.id === S.obraId); const a = Core.atividadesParaMapa(calcObra(base)).find(x => x.chave === vc.value); z.vinculo = a ? { chave: a.chave, eap: a.eap, nome: a.nome } : null; render(); };
    $$('[data-mpst]').forEach(b => b.onclick = () => { const z = zona(); if (z) { z.status = b.dataset.mpst; render(); } });
    $$('[data-mpzdel]').forEach(b => b.onclick = () => { m.zonas = m.zonas.filter(z => z.id !== ed.sel); ed.sel = null; render(); });
    $$('[data-mpdup]').forEach(b => b.onclick = () => {
      const z = zona(); if (!z) return;
      const xs = z.pts.map(p => p[0]), ys = z.pts.map(p => p[1]), dx = Math.min(0.03, 1 - Math.max(...xs)), dy = Math.min(0.03, 1 - Math.max(...ys));
      const nz = { ...JSON.parse(JSON.stringify(z)), id: novoId(), rotulo: z.rotulo ? z.rotulo + ' (cópia)' : '', pts: z.pts.map(([x, y]) => [x + dx, y + dy]) };
      m.zonas.push(nz); ed.sel = nz.id; render();
    });
    $$('[data-mpsel]').forEach(b => b.onclick = () => { ed.sel = b.dataset.mpsel || null; render(); });
    $$('.mp-linha').forEach((tr, i) => tr.onclick = () => { ed.sel = m.zonas[i] && m.zonas[i].id; render(); });
    $$('[data-mpmodo]').forEach(b => b.onclick = () => { ed.modo = b.dataset.mpmodo; ed.rasc = []; render(); });
    $$('[data-mprasc]').forEach(b => b.onclick = () => { const a = b.dataset.mprasc; if (a === 'fecha') fechaRasc(); else { if (a === 'volta') ed.rasc.pop(); else ed.rasc = []; render(); } });
    const cn = $('#mp-cancelar'); if (cn) cn.onclick = () => { S.mapaEd = null; mapaPdf = null; render(); };
    const sv = $('#mp-salvar'); if (sv) sv.onclick = async () => {
      const base = DB.obras.find(x => x.id === S.obraId), lista = [...(base.mapas || [])];
      const r4 = v => Math.round(Math.max(0, Math.min(1, v)) * 1e4) / 1e4;
      const limpo = { ...m, zonas: m.zonas.map(({ id, pts, rotulo, status, vinculo }) => ({ id, pts: pts.map(([x, y]) => [r4(x), r4(y)]), rotulo: rotulo || '', status: status || 'a-executar', vinculo: vinculo || null })), atualizadoEm: new Date().toISOString().slice(0, 10) };
      if (ed.idx < 0) lista.push(limpo); else lista[ed.idx] = limpo;
      if (await salvarMapas(base, lista)) { S.mapaEd = null; mapaPdf = null; render(); }
    };
    if (!bindMapa.tecla) { bindMapa.tecla = true; document.addEventListener('keydown', teclaMapa); }

    const pl = $('.mp-edit .mp-planta'); if (!pl) return;
    const c01 = v => Math.max(0, Math.min(1, v));
    const pos = e => { const b = pl.getBoundingClientRect(); return [c01((e.clientX - b.left) / b.width), c01((e.clientY - b.top) / b.height)]; };
    const pxDist = (a, b) => { const bb = pl.getBoundingClientRect(); return Math.hypot((a[0] - b[0]) * bb.width, (a[1] - b[1]) * bb.height); };
    const rasc = pl.querySelector('.mp-rasc');
    const tracejado = (pts, fechado) => `<${fechado ? 'polygon' : 'polyline'} points="${ptsSvg(pts, m)}" fill="${fechado ? 'rgba(84,124,165,.22)' : 'none'}" stroke="#547CA5" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>`;
    // atualiza só a área mexida (sem redesenhar a tela) enquanto arrasta
    const vivo = z => {
      const el = [...pl.querySelectorAll('polygon[data-zona]')].find(p => p.dataset.zona === z.id); if (el) el.setAttribute('points', ptsSvg(z.pts, m));
      const g = Core.geoZona(z.pts), n = [...pl.querySelectorAll('.mp-num')].find(x => x.dataset.n === z.id); if (n) { n.style.left = g.cx * 100 + '%'; n.style.top = g.cy * 100 + '%'; }
      pl.querySelectorAll('.mp-h, .mp-hm, .mp-hr').forEach(x => x.remove());
      pl.insertAdjacentHTML('beforeend', alcasZona(z.pts));
    };
    // polígono em andamento: linha tracejada até o cursor e os cantos já marcados (o primeiro maior: clicar nele fecha)
    const desenhaRasc = extra => {
      if (!rasc) return;
      const R = ed.rasc, p = extra ? [...R, extra] : R, esc1 = m.w / pl.getBoundingClientRect().width;
      rasc.innerHTML = R.length ? tracejado(p, false) + R.map((q, i) => `<circle cx="${q[0] * m.w}" cy="${q[1] * m.h}" r="${(i === 0 ? 7 : 4.5) * esc1}" fill="${i === 0 ? '#FFFFFF' : '#547CA5'}" stroke="#547CA5" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('') : '';
    };
    desenhaRasc();
    pl.onpointermove = ed.modo === 'poligono' ? e => { if (ed.rasc.length) desenhaRasc(pos(e)); } : null;
    pl.ondblclick = e => {
      const h = e.target.closest('.mp-h'), z = zona();
      if (h && z && z.pts.length > 3) { z.pts.splice(+h.dataset.v, 1); render(); }
    };
    pl.onpointerdown = ev => {
      if (ev.button > 0) return;
      ev.preventDefault();
      const p0 = pos(ev);
      // polígono: cada clique é um canto; perto do primeiro ponto (ou duplo clique) fecha.
      // Antes do primeiro canto, as alças da área selecionada continuam editáveis.
      if (ed.modo === 'poligono' && (ed.rasc.length || !ev.target.closest('.mp-h, .mp-hm, .mp-hr'))) {
        const R = ed.rasc;
        if (R.length >= 3 && pxDist(p0, R[0]) < 12) return fechaRasc();
        if (R.length && pxDist(p0, R[R.length - 1]) < 5) { if (R.length >= 3 && ev.detail >= 2) fechaRasc(); return; }
        R.push(p0); ed.sel = null; render(); return;
      }
      const h = ev.target.closest('.mp-h, .mp-hm, .mp-hr'), z = zona();
      let acao;
      if (h && z) {
        if (h.classList.contains('mp-h')) acao = { k: 'vertice', i: +h.dataset.v };
        else if (h.classList.contains('mp-hm')) { const i = +h.dataset.m + 1; z.pts.splice(i, 0, p0); acao = { k: 'vertice', i }; vivo(z); }
        else { const g = Core.geoZona(z.pts); acao = { k: 'giro', c: [g.cx * m.w, g.cy * m.h], orig: z.pts.map(p => [...p]) }; acao.a0 = Math.atan2(p0[1] * m.h - acao.c[1], p0[0] * m.w - acao.c[0]); }
      } else {
        const poly = ev.target.closest('polygon[data-zona]');
        if (poly && poly.dataset.zona !== ed.sel) { ed.sel = poly.dataset.zona; render(); return; }
        acao = poly ? { k: 'mover', orig: z.pts.map(p => [...p]) } : { k: 'ret' };
      }
      let mexeu = acao.k === 'vertice' && h.classList.contains('mp-hm');
      const move = e => {
        const p = pos(e); if (!mexeu && pxDist(p, p0) < 3) return; mexeu = true;
        if (acao.k === 'vertice') { z.pts[acao.i] = p; vivo(z); }
        else if (acao.k === 'mover') {
          const xs = acao.orig.map(q => q[0]), ys = acao.orig.map(q => q[1]);
          const dx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), p[0] - p0[0])), dy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), p[1] - p0[1]));
          z.pts = acao.orig.map(([x, y]) => [x + dx, y + dy]); vivo(z);
        } else if (acao.k === 'giro') {
          let da = Math.atan2(p[1] * m.h - acao.c[1], p[0] * m.w - acao.c[0]) - acao.a0;
          if (e.shiftKey) da = Math.round(da / (Math.PI / 12)) * (Math.PI / 12);
          const [cx, cy] = acao.c, cs = Math.cos(da), sn = Math.sin(da);
          const rot = acao.orig.map(([x, y]) => { const X = x * m.w - cx, Y = y * m.h - cy; return [(cx + X * cs - Y * sn) / m.w, (cy + X * sn + Y * cs) / m.h]; });
          // canto saindo da planta: desloca a área inteira para dentro (sem deformar); só corta se ela não couber
          const ajuste = k => { const v = rot.map(q => q[k]), lo = Math.min(...v), hi = Math.max(...v); return lo < 0 ? -lo : hi > 1 ? 1 - hi : 0; };
          const ax = ajuste(0), ay = ajuste(1);
          z.pts = rot.map(([x, y]) => [c01(x + ax), c01(y + ay)]); vivo(z);
        } else if (rasc) {
          const [x0, y0] = p0, [x1, y1] = p;
          rasc.innerHTML = tracejado([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
        }
      };
      const fim = e => {
        pl.removeEventListener('pointermove', move); pl.removeEventListener('pointerup', fim); pl.removeEventListener('pointercancel', fim);
        if (acao.k === 'ret') {
          const [x0, y0] = p0, [x1, y1] = pos(e);
          if (!mexeu || Math.abs(x1 - x0) < 0.01 || Math.abs(y1 - y0) < 0.01) { if (rasc) rasc.innerHTML = ''; if (ed.sel) { ed.sel = null; render(); } return; }
          const zn = { id: novoId(), pts: [[Math.min(x0, x1), Math.min(y0, y1)], [Math.max(x0, x1), Math.min(y0, y1)], [Math.max(x0, x1), Math.max(y0, y1)], [Math.min(x0, x1), Math.max(y0, y1)]], rotulo: '', status: 'a-executar', vinculo: null };
          m.zonas.push(zn); ed.sel = zn.id; render(); return;
        }
        if (mexeu) render();
      };
      try { pl.setPointerCapture(ev.pointerId); } catch (e) { /* sem captura: o arraste ainda funciona dentro da planta */ }
      pl.addEventListener('pointermove', move); pl.addEventListener('pointerup', fim); pl.addEventListener('pointercancel', fim);
    };
  }
  function fechaRasc() {
    const ed = S.mapaEd; if (!ed || ed.rasc.length < 3) return;
    const z = { id: novoId(), pts: ed.rasc, rotulo: '', status: 'a-executar', vinculo: null };
    ed.m.zonas.push(z); ed.rasc = []; ed.sel = z.id; render();
  }
  // polígono em andamento: Enter fecha, Esc cancela, Backspace desfaz o último ponto; Esc também solta a área selecionada
  function teclaMapa(e) {
    const ed = S.mapaEd; if (!ed || S.view !== 'obra' || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return;
    if (ed.rasc && ed.rasc.length) {
      if (e.key === 'Enter') { e.preventDefault(); fechaRasc(); }
      else if (e.key === 'Escape') { ed.rasc = []; render(); }
      else if (e.key === 'Backspace') { e.preventDefault(); ed.rasc.pop(); render(); }
    } else if (e.key === 'Escape' && ed.sel) { ed.sel = null; render(); }
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
    // tudo calculado com os dados da própria obra (obra sem medição, sem Progresso mensal ou sem RDO não quebra)
    const tarefas = o.tarefas || [], curva = o.curva || [], mensal = o.mensal || [];
    const raiz = tarefas.find(t => t.nivel === 1);
    const somaF = tarefas.filter(t => t.folha).reduce((s, t) => s + (t.previsto || 0), 0);
    const ultCurva = [...curva].reverse().find(p => p.realizado > 0);
    const idpmZero = mensal.length && mensal.every(m => !m.idpm);
    const atrasoPrev = r.atrasadas.filter(t => (t.atrasoPrevision || 0) < t.diasAtraso - 7).length;
    const realRaiz = raiz ? raiz.realizado || 0 : null;
    const real = !ultCurva && realRaiz !== null && realRaiz < 0.0005 ? ['ok', 'Obra ainda sem medição: Curva S e Progresso por tarefas sem realizado.']
      : ultCurva && realRaiz !== null && Math.abs(ultCurva.realizado - realRaiz) < 0.001 ? ['ok', `Realizado da Curva S (${pct(ultCurva.realizado, 2)}) bate com o total do Progresso por tarefas (${pct(realRaiz, 2)}).`]
      : ['av', `Realizado da Curva S (${ultCurva ? pct(ultCurva.realizado, 2) : '—'}) e do Progresso por tarefas (${realRaiz === null ? '—' : pct(realRaiz, 2)}) diferentes: exportações de dias diferentes.`];
    const divergeEm = (curva.find(p => Math.abs((p.base || 0) - (p.previsto || 0)) > 0.0005) || {}).data;
    const itens = [
      real,
      [Math.abs(somaF - 1) < 0.001 ? 'ok' : 'av', `As tarefas finais somam ${pct(somaF, 2)} de peso. A diferença vem do arredondamento do Prevision e é redistribuída no cálculo do previsto por frente.`],
      mensal.length ? [idpmZero ? 'av' : 'ok', idpmZero ? 'A coluna IDPM do Progresso mensal veio zerada. O IDP do painel é calculado aqui (realizado ÷ previsto).' : 'IDPM preenchido no Progresso mensal.'] : ['av', 'Sem Progresso mensal: o ritmo dos últimos meses e as barras por mês ficam de fora.'],
      [atrasoPrev ? 'av' : 'ok', `${atrasoPrev} tarefas atrasadas aparecem no Prevision com bem menos dias de atraso do que a data de término indica. O painel usa a conta pela data.`],
      ...((o.rdos || []).length ? [['av', 'As atividades do RDO não trazem o código da EAP. Para ligar campo e cronograma será preciso um de-para serviço → EAP.']] : []),
      divergeEm ? ['ok', `Base e Previsto divergem a partir de ${Core.mesLongo(divergeEm)}: houve replanejamento. O painel compara com o Previsto e mostra a Base como referência.`] : ['ok', 'Base e Previsto iguais: o cronograma segue a linha de base original.'],
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
        <small class="hint">O que cada arquivo precisa trazer e quando enviar: <button class="btn sec2" type="button" data-go="manual" style="padding:2px 10px;min-height:0">Manual de alimentação</button></small>
        ${imp.arquivos.length ? `<div class="check">${imp.arquivos.map(a => `<div class="${a.erro ? 'er' : 'ok'}"><i>${a.erro ? '×' : '✓'}</i><span><b>${esc(a.nome)}</b> → ${a.erro ? esc(a.erro) : esc(a.tipoNome)}</span></div>`).join('')}</div>` : ''}
        ${Object.keys(imp.dados).length ? `<div class="step-t">4 · Conferência</div><div class="check">${Carga.conferencia(o, imp).map(([k, t]) => `<div class="${k}"><i>${k === 'ok' ? '✓' : k === 'av' ? '!' : '×'}</i><span>${t}</span></div>`).join('')}</div>
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
  // conferência dos arquivos com a obra: js/carga.js (as mesmas regras da sincronização automática)

  // leitura das planilhas (SheetJS) e do PDF dos RDOs (pdf.js), só quando o administrador abre Alimentar
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const carregaLibs = () => Promise.all([
    window.XLSX ? null : carregaScript(CDN + 'xlsx/0.18.5/xlsx.full.min.js'),
    window.pdfjsLib ? null : carregaScript(CDN + 'pdf.js/3.11.174/pdf.min.js').then(() => carregaScript(CDN + 'pdf.js/3.11.174/pdf.worker.min.js')),
  ]);
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
    if (S.imp.dados.rdos || S.imp.dados.cronograma) {
      // data de corte: a do último RDO; com cronograma, estimada pelo "Previsto (%)" da raiz contra a curva S, nunca depois de hoje
      const o = DB.obras.find(x => x.id === ($('#imp-obra') ? $('#imp-obra').value : S.obraId)) || DB.obras[0];
      const { corte, dataEstimada } = Carga.estimarCorte(S.imp.dados, o, new Date().toISOString().slice(0, 10), S.imp.corte);
      S.imp.corte = corte;
      if (S.imp.dados.cronograma) S.imp.dataEstimada = dataEstimada;
    }
    S.imp.lendo = null;
    render();
    toast('Arquivos lidos. Confira e atualize o painel.');
  }
  async function aplicarImport() {
    if (S.imp && S.imp.lendo) { toast('Aguarde terminar a leitura dos arquivos.'); return; }
    const obraId = $('#imp-obra').value;
    const oSel = DB.obras.find(x => x.id === obraId);
    const erros = oSel ? Carga.conferencia(oSel, S.imp).filter(x => x[0] === 'er') : [];
    if (erros.length) { toast('Há arquivos que não conferem com a obra selecionada. Corrija antes de salvar.'); return; }
    const d = S.imp.dados;
    const corte = ($('#imp-corte') && $('#imp-corte').value) || S.imp.corte;
    if (!corte) { toast('Informe a data de corte.'); return; }
    const pacote = Carga.montarPacote(d, corte, S.imp.arqCrono);
    const fontes = Object.fromEntries(S.imp.arquivos.filter(a => !a.erro).map(a => [a.tipoNome, a.nome]));
    const ok = await gravando('Gravando a carga…', prog => API.salvarCarga(obraId, pacote, corte, fontes, prog));
    if (!ok) return;
    S.imp = null; S.obraId = obraId; S.view = 'obra';
    await recarregar();
    toast('Rascunho salvo. Confira e publique para o cliente.');
  }

  // ---------- manual de alimentação do painel (uso interno: administrador e diretoria) ----------
  // Um padrão para cada documento que alimenta o painel e o report: de onde vem, quando enviar, como gerar e o que precisa
  // trazer. As tabelas medem, na carga de cada obra, quanto do padrão aparece (Core.qualidadeDocs e Core.qualidadeRdo); a
  // obra de referência de cada item é a que mais cumpre o padrão, e os exemplos do RDO saem do diário dela.
  const DOCS = [
    { k: 'cadastro', t: 'Cadastro da obra', de: 'Painel · Cadastro da obra', quando: 'Na abertura da obra e a cada aditivo',
      como: ['Código da obra igual ao do Prevision, do RDO e do Controle de Medição (ex.: 208).', 'Contrato no mesmo número do RDO e do Controle de Medição (ex.: CT/208/2026): o painel compara os dois.',
        'Cliente, contratante, cidade, endereço e responsável em campo: aparecem no cabeçalho do painel e do report.', 'Prazo contratual com as datas do contrato e dos aditivos aprovados.'],
      usa: 'cabeçalho do painel e do report, prazo no portfólio e conferência de que cada arquivo enviado é da obra certa' },
    { k: 'cronograma', t: 'Cronograma', de: 'Prevision · Gantt em .xlsx', quando: 'Toda semana, na data de corte', pasta: 'planejamento/Físico',
      como: ['Lance no Prevision o avanço da semana, a partir dos RDOs aprovados, antes de exportar.', 'Exporte o Gantt com todas as linhas expandidas: árvore recolhida tira tarefas do painel.',
        'Linha de base salva no Prevision: dela saem o término de base e o desvio de prazo.', 'Responsável de cada tarefa: a empresa executora, ou "Pendente de contratação" enquanto não houver empresa.',
        'Exporte no mesmo dia do Progresso por tarefas e da Curva S.'],
      cols: 'Linha, EAP, Nome, Início, Fim, Duração, Predecessoras, Sucessoras, Início (base), Fim (base), Responsáveis, Previsto (%), Realizado (%), Base (%)',
      usa: 'Gantt da aba Obra, término previsto × base, tarefas atrasadas e próximas, "a contratar" nos pontos de atenção e cor das áreas vinculadas no mapa' },
    { k: 'tarefas', t: 'Progresso por tarefas', de: 'Prevision · .xlsx', quando: 'Toda semana, com o Cronograma', pasta: 'planejamento/Físico',
      como: ['Exporte sem filtro de datas e com a árvore toda aberta: com filtro, a raiz não soma 100% e os pesos das frentes deixam de valer.',
        'Mesmo dia do Cronograma: o painel liga as duas planilhas pela posição na árvore e pelo nome da tarefa.'],
      cols: 'EAP, Tarefa, Início, Fim, Base, Previsto, Realizado, Atraso',
      usa: 'avanço por atividade e por etapa, peso de cada frente e maior diferença para o plano na leitura do período' },
    { k: 'curva', t: 'Curva S', de: 'Prevision · .xls', quando: 'Toda semana', pasta: 'planejamento/Físico',
      como: ['Exporte a Curva S física da obra inteira, do início ao término, e não só o período.', 'A linha de base precisa fechar em 100% e nunca diminuir.'],
      cols: 'Dia, Base, Previsto, Realizado',
      usa: 'Curva S do painel e do report, avanço na data de corte e índice de prazo (IDP)' },
    { k: 'mensal', t: 'Progresso mensal ou semanal', de: 'Prevision · .xls', quando: 'Toda semana', pasta: 'planejamento/Físico',
      como: ['Vale o progresso mensal ou o semanal: o semanal é somado por mês, repartindo a semana da virada pelos dias.', 'Mesma linha de base da Curva S: o painel confere mês a mês e recusa o arquivo que não bate.'],
      cols: 'Mês, Base, Previsto, Realizado (IDPM opcional)',
      usa: 'barras de avanço por mês, ritmo dos últimos 3 meses e projeção de término' },
    { k: 'rdo', t: 'Diário de obra (RDO)', de: 'Plataforma RDO · PDF compilado', quando: 'Diário na obra; envio semanal dos últimos 30 dias', pasta: 'planejamento/Diário',
      como: ['Preencha e aprove o RDO até o dia útil seguinte: só RDO aprovado entra na posição do cliente.', 'Exporte da plataforma RDO o PDF compilado dos últimos 30 dias, com as fotos.',
        'O PDF pode passar de 60 MB: a tela mostra a leitura página a página e só libera o salvar no fim.', 'O preenchimento de cada campo segue o padrão abaixo (itens 6.1 a 6.6).'],
      usa: 'quadro Campo, efetivo por dia, frentes e paralisações, registro fotográfico e foto ao lado do mapa de avanço' },
    { k: 'mapas', t: 'Plantas e mapa de avanço', de: 'Projetos da obra · PDF ou imagem', quando: 'Ao abrir cada frente; revisar quando o cronograma mudar', pasta: '3_Projetos',
      como: ['Na aba Obra → Mapa de avanço, envie a planta da frente (PDF, escolhendo a página, ou PNG/JPG).', 'Uma planta por frente de serviço, com título claro (ex.: Cobertura · Galpão de injetoras).',
        'Dê às áreas os mesmos nomes de local usados no RDO (galpão, bloco, eixo).', 'Vincule cada área à atividade do cronograma: a cor muda sozinha a cada carga. Área sem vínculo só muda à mão.'],
      usa: 'folhas de mapa de avanço do report e planta ao lado de cada foto do serviço' },
    { k: 'financeiro', t: 'Curva S financeira (valor agregado)', de: 'Prevision · Financeiro VA · .xls', quando: 'Todo mês, após a medição', pasta: 'planejamento/Financeiro VA',
      como: ['Em Alimentar, escolha "Dados financeiros" antes de enviar: o cabeçalho é igual ao da Curva S física e quem define o tipo é essa escolha.',
        'Curva em reais na base do contrato: quando o total bate com o Controle de Medição (±15%), o quadro de valor agregado entra no report.',
        'Progresso mensal e por tarefas financeiros são opcionais: ficam guardados, o report usa a curva.'],
      cols: 'Dia, Base, Previsto, Realizado (em R$)',
      usa: 'valor planejado (PV), valor agregado (EV) e índice de prazo em valor (SPI)' },
    { k: 'medicao', t: 'Controle de Medição', de: 'Planilha Machine · .xlsx', quando: 'Todo mês, a cada medição', pasta: 'contrato',
      como: ['Total do contrato com aditivos, medido acumulado e saldo.', 'Uma linha por mês com previsto, realizado e a situação da medição (realizada, em análise, a aprovar).',
        'Uma aba de boletim por medição (M1, M2…), com Referência (EAP), Descrição, Contratada, Acumulado, Medida, % executado, Preço unitário e Medição.',
        'Layouts lidos: Controle Mensal (198), VISÃO GERAL (208) e SÉRIE DE MEDIÇÕES + RESUMO (207). Vale nos dois tipos de envio.'],
      usa: 'valor do contrato, medido e saldo no quadro financeiro e última medição' },
  ];
  const ROTINA = [
    ['Toda semana · dados físicos', ['RDOs do período aprovados na plataforma.', 'Avanço da semana lançado no Prevision.', 'Exportar no mesmo dia: Cronograma, Progresso por tarefas, Curva S e Progresso semanal.',
      'Exportar o PDF dos RDOs dos últimos 30 dias.', 'Alimentar → Dados físicos: enviar tudo de uma vez, sem nenhum × na conferência, com a data de corte do dia da exportação.',
      'Conferir a aba Obra, publicar para o cliente e baixar o report.']],
    ['Todo mês · dados financeiros', ['Fechar a medição no Controle de Medição: linha do mês, situação e aba do boletim.', 'Exportar a Curva S financeira (Financeiro VA).',
      'Alimentar → Dados financeiros: enviar a Curva S financeira e o Controle de Medição.', 'Conferir o quadro financeiro na aba Obra e publicar.']],
    ['Quando houver mudança', ['Aditivo de prazo ou de contrato: atualizar o cadastro da obra.', 'Nova frente ou nova revisão de projeto: planta no mapa de avanço, com as áreas vinculadas.',
      'Nova linha de base no Prevision: exportar juntos Cronograma, Progresso por tarefas e Curva S.']],
  ];
  const PADRAO_RDO = [
    { b: 1, k: 'diario', t: 'Um RDO por dia útil' }, { b: 1, k: 'aprovado', t: 'RDO aprovado' },
    { b: 2, k: 'clima', t: 'Tempo e condição nos dois turnos' },
    { b: 3, k: 'maoDeObra', t: 'Funções e empresas com efetivo', n: true }, { b: 3, k: 'equipamentos', t: 'Equipamentos do dia' },
    { b: 4, k: 'atividades', t: 'Atividades por RDO', n: true }, { b: 4, k: 'eap', t: 'Código EAP do cronograma' }, { b: 4, k: 'empresa', t: 'Empresa executora' },
    { b: 4, k: 'local', t: 'Local ou área' }, { b: 4, k: 'pct', t: '% acumulado da atividade' }, { b: 4, k: 'descricao', t: 'O que foi feito no dia' },
    { b: 4, k: 'motivo', t: 'Motivo da paralisação' },
    { b: 5, k: 'fotos', t: 'Fotos por RDO', n: true }, { b: 5, k: 'fotoLegenda', t: 'Legenda com o serviço' }, { b: 5, k: 'fotoEap', t: 'Legenda com código EAP' },
    { b: 5, k: 'fotoLocal', t: 'Legenda com local ou área' },
  ];
  const BLOCOS_RDO = {
    1: { t: 'Cabeçalho e aprovação', usa: 'cobertura do período, efetivo por dia e leitura de campo (o cliente só vê RDO aprovado)',
      faz: ['Um RDO para cada dia trabalhado, inclusive sábado com equipe em campo.', 'Responsável da obra identificado.', 'Aprovação até o dia útil seguinte: RDO em preenchimento não entra na posição do cliente.'] },
    2: { t: 'Horário e clima', usa: 'dias impraticáveis no período e justificativa de prazo',
      faz: ['Tempo (claro, nublado, chuvoso) e condição (praticável ou impraticável) na manhã e na tarde, em campos separados.', 'Índice pluviométrico quando chover.', 'Turno impraticável: citar nas atividades qual frente parou por chuva.'] },
    3: { t: 'Mão de obra e equipamentos', usa: 'efetivo próprio × terceiros no quadro Campo e no gráfico de efetivo por dia',
      faz: ['Própria por função; terceiros por empresa, sempre com o mesmo nome (o do contrato).', 'Quantidade real presente no dia. Empresa sem ninguém na obra fica fora da lista do dia (não lançar zero).', 'Equipamentos usados no dia, com quantidade.'] },
    4: { t: 'Atividades', usa: 'frentes no último RDO, paralisações (pontos de atenção), situação das áreas e foto ao lado do mapa de avanço',
      faz: ['Serviço com o código EAP e o nome iguais aos do cronograma (Prevision). Ex.: 01.02.08.01.01.01 - Fornecimento e Instalação de Gradil…', 'Empresa executora, com o mesmo nome usado na mão de obra.', 'Local e área (galpão, bloco, pavimento, eixo), com os mesmos nomes das áreas do mapa de avanço.', '% acumulado da atividade até o dia (não o avanço do dia).', 'Situação: Em andamento, Paralisada ou Concluída. Paralisada sempre com o motivo: o que falta e de quem depende.', 'Descrição do que foi feito no dia e a equipe, no formato "Empresa (n)".'] },
    5: { t: 'Fotos', usa: 'registro fotográfico do report, que coloca cada foto ao lado da planta da frente (pela EAP ou pelo nome do serviço)',
      faz: ['Pelo menos 2 fotos de cada atividade em andamento, mostrando o serviço (de preferência na horizontal).', 'Legenda com código EAP, serviço e local/área, iguais aos da atividade.', 'Fotos só de clima, de pessoas ou de documentos não contam como registro do serviço.'] },
  };
  function viewManual() {
    const obras = DB.obras.filter(b => temDados(visaoDaObra(b))).map(b => {
      const o = visaoDaObra(b), fotos = b.fotosPendentes ? null : o.fotos || [], q = Core.qualidadeRdo(o.rdos || [], fotos);
      return { b, o, q, d: { ...Core.qualidadeDocs(o, calcObra(b), fotos), rdo: q ? PADRAO_RDO.map(c => ({ t: c.t, v: q.v[c.k], n: c.n })) : null } };
    });
    const semCarga = DB.obras.filter(b => !temDados(visaoDaObra(b)));
    const nome = x => `Obra ${esc(x.b.codigo)}`;
    const num = v => v === true ? 1 : v === false ? 0 : v;
    const cls = v => v >= 0.9 ? 'ok' : v >= 0.5 ? 'atencao' : 'critico';
    // nota do documento: média dos itens medidos (as médias por RDO, como funções e fotos, ficam de fora)
    const nota = itens => { const vs = (itens || []).filter(i => !i.n).map(i => num(i.v)).filter(v => v !== null && v !== undefined); return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null; };
    // referência: a(s) obra(s) com o maior valor; nenhuma quando todas empatam ou o melhor é quase nada
    const melhor = (val, min = 0.05) => { const vs = obras.map(val).map(num).filter(v => v !== null && v !== undefined); const m = vs.length ? Math.max(...vs) : 0;
      const top = obras.filter(x => num(val(x)) === m); return m >= min && top.length < obras.length ? top : []; };
    const refDoc = D => melhor(x => nota(x.d[D.k]));
    const cel = (v, n) => v === undefined ? '<span class="hint">não enviado</span>' : v === null ? '—' : n ? fmtNum(v, 1)
      : typeof v === 'boolean' ? `<span class="pill ${v ? 'ok' : 'critico'} plain">${v ? 'sim' : 'não'}</span>` : `<span class="pill ${cls(v)} plain">${pct(v, 0)}</span>`;
    const estrela = '<span class="man-ref" title="obra de referência">★</span>';
    // itens do documento × obras
    const tabItens = D => {
      const modelo = (obras.find(x => x.d[D.k]) || {}).d?.[D.k];
      if (!modelo) return '<p class="hint" style="margin:0">Nenhuma obra enviou este documento ainda.</p>';
      const linhas = modelo.map((it, i) => [it, i]);
      return `<div class="tw"><table class="t man-t"><thead><tr><th>Item do padrão</th>${obras.map(x => `<th class="n">${nome(x)}</th>`).join('')}</tr></thead><tbody>
        ${linhas.map(([it, i]) => { const v = x => x.d[D.k] ? x.d[D.k][i].v : undefined, m = melhor(v, it.n ? 0.5 : 0.05);
          return `<tr><td>${esc(it.t)}${it.n ? ' <small class="hint">(média por RDO)</small>' : ''}</td>${obras.map(x => `<td class="n">${cel(v(x), it.n)}${m.includes(x) ? ' ' + estrela : ''}</td>`).join('')}</tr>`; }).join('')}
        </tbody></table></div>`;
    };

    // ----- situação geral: um documento por linha, uma obra por coluna -----
    const hojeIso = new Date().toISOString().slice(0, 10);
    const idade = (d, lim) => { if (!d) return '<span class="pill critico plain">sem carga</span>'; const n = diff(d, hojeIso); return `<span class="pill ${n > lim ? 'atencao' : 'ok'} plain">${dCurto(d)}</span>${n > lim ? `<small>${n} dias</small>` : ''}`; };
    const celDoc = (x, D) => { const it = x.d[D.k], s = nota(it);
      if (!it) return D.k === 'mapas' ? '<span class="pill atencao plain">sem planta</span>' : '<span class="pill critico plain">não enviado</span>';
      return s === null ? '—' : `<span class="pill ${cls(s)} plain">${pct(s, 0)}</span>`; };
    const geral = obras.length ? `<div class="tw"><table class="t man-t"><thead><tr><th>Documento</th><th>Quando</th>${obras.map(x => `<th class="n">${nome(x)}</th>`).join('')}</tr></thead><tbody>
      ${DOCS.map((D, i) => { const ref = refDoc(D);
        return `<tr><td><button class="man-ir" type="button" data-ir="man-${D.k}">${i + 1}. ${esc(D.t)}</button></td><td class="man-q">${esc(D.quando)}</td>${obras.map(x => `<td class="n">${celDoc(x, D)}${ref.includes(x) ? ' ' + estrela : ''}</td>`).join('')}</tr>`; }).join('')}
      <tr class="man-sep"><td colspan="${obras.length + 2}">Atualização</td></tr>
      <tr><td>Última carga física</td><td class="man-q">Semanal (até ${Core.LIMIAR_DIAS.fisico} dias)</td>${obras.map(x => `<td class="n">${idade(x.b.dataCorte, Core.LIMIAR_DIAS.fisico)}</td>`).join('')}</tr>
      <tr><td>Última carga financeira</td><td class="man-q">Mensal (até ${Core.LIMIAR_DIAS.financeiro} dias)</td>${obras.map(x => `<td class="n">${idade(x.b.dataCorteFinanceiro, Core.LIMIAR_DIAS.financeiro)}</td>`).join('')}</tr>
      <tr><td>Posição publicada ao cliente</td><td class="man-q">Após cada carga</td>${obras.map(x => { const p = x.b.publicadoAte, c = x.b.dataCorte;
        return `<td class="n">${!p ? '<span class="pill critico plain">não publicada</span>' : `<span class="pill ${!c || p >= c ? 'ok' : 'atencao'} plain">${dCurto(p)}</span>${c && p < c ? `<small>rascunho de ${dCurto(c)}</small>` : ''}`}</td>`; }).join('')}</tr>
      </tbody></table></div>
      <small class="hint">Percentual: quanto do padrão de cada documento aparece na carga atual da obra. ★ obra de referência. ${semCarga.length ? `Sem carga ainda: ${semCarga.map(b => 'Obra ' + esc(b.codigo)).join(', ')}.` : ''}</small>`
      : '<p class="sub" style="margin:0">Nenhuma obra tem carga ainda.</p>';

    // ----- RDO: exemplos reais da obra de referência de cada bloco -----
    const refBloco = b => { const cont = new Map(); PADRAO_RDO.forEach((c, i) => { if (c.b === b) melhor(x => x.d.rdo ? x.d.rdo[i].v : undefined, c.n ? 0.5 : 0.05).forEach(x => cont.set(x, (cont.get(x) || 0) + 1)); }); return [...cont].sort((a, z) => z[1] - a[1])[0]?.[0] || null; };
    const ultimo = x => [...x.o.rdos].sort((a, z) => a.data < z.data ? -1 : 1).at(-1);
    const exemplo = b => {
      const x = refBloco(b); if (!x) return '';
      const cab = `<div class="step-t" style="margin:4px 0 6px">Exemplo real · ${nome(x)}</div>`;
      if (b === 3) { const u = ultimo(x), mo = u.maoDeObra.filter(m => m.qtd > 0);
        return cab + `<div class="tw"><table class="t" style="min-width:0"><thead><tr><th>RDO nº ${u.numero} · ${dCurto(u.data)}</th><th>Tipo</th><th class="n">Qtd</th></tr></thead><tbody>${mo.slice(0, 8).map(m => `<tr><td>${esc(m.funcao)}</td><td>${m.tipo === 'propria' ? 'Própria' : 'Terceiro'}</td><td class="n">${m.qtd}</td></tr>`).join('')}</tbody></table></div>`; }
      if (b === 4) {
        // a atividade mais completa dos últimos RDOs da obra de referência
        const campos = a => [a.eap, Core.empresasFrente(a).length, a.local || a.area, a.pct !== null && a.pct !== undefined, a.descricao && a.descricao !== a.servico].filter(Boolean).length;
        const rds = [...x.o.rdos].sort((a, z) => a.data < z.data ? 1 : -1).slice(0, 10);
        const [a, r] = rds.flatMap(r => r.atividades.map(a => [a, r])).sort((p, q) => campos(q[0]) - campos(p[0]))[0] || [];
        if (!a) return '';
        const lin = (t, v) => `<tr><td>${t}</td><td>${v ? esc(v) : '<span class="pill critico plain">não informado</span>'}</td></tr>`;
        return cab + `<div class="tw"><table class="t" style="min-width:0"><thead><tr><th colspan="2">RDO nº ${r.numero} · ${dCurto(r.data)}</th></tr></thead><tbody>
          ${lin('Serviço', a.servico)}${lin('Código EAP', a.eap)}${lin('Empresa', Core.empresasFrente(a).join(', '))}${lin('Local / área', [a.local, a.area].filter(Boolean).join(' · '))}
          ${lin('% acumulado', a.pct === null || a.pct === undefined ? '' : pct(a.pct, 0))}${lin('Situação', a.situacao)}${/paralis/i.test(a.situacao || '') ? lin('Motivo', a.motivo) : ''}${lin('Descrição do dia', a.descricao && a.descricao !== a.servico ? a.descricao : '')}</tbody></table></div>`;
      }
      if (b === 5) { const f = [...(x.o.fotos || [])].reverse().find(f => f.legenda && f.legenda.eap) || [...(x.o.fotos || [])].reverse().find(f => f.legenda);
        return f ? cab + `<figure class="man-foto"><img src="${urlImg(f.src)}" alt=""><figcaption class="hint">RDO nº ${f.rdo} · ${dCurto(f.data)} — ${esc(f.legenda.texto || f.legenda.servico || '')}</figcaption></figure>` : ''; }
      return '';
    };
    const blocosRdo = n => [1, 2, 3, 4, 5].map(b => { const B = BLOCOS_RDO[b], x = refBloco(b);
      return `<div class="man-sub"><div class="man-sub-t">${n}.${b} ${esc(B.t)}${x ? ` <span class="pill info plain">referência: ${nome(x)}</span>` : ''}</div>
        <ul class="man-l">${B.faz.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <p class="hint" style="margin:0 0 6px">No painel: ${esc(B.usa)}.</p>${exemplo(b)}</div>`; }).join('')
      + `<div class="man-sub"><div class="man-sub-t">${n}.6 Comentários e ocorrências</div>
        <ul class="man-l"><li>Visitas do cliente e da fiscalização, entregas de material, acidentes e incidentes, interferências e pendências do cliente, com data e responsável.</li>
        <li>O que estiver nos comentários não aparece no report: o que afeta prazo vai também na atividade (situação e motivo).</li></ul></div>`;
    const baseRdo = obras.filter(x => x.q).map(x => `${nome(x)} — ${x.q.n} RDOs de ${dCurto(x.q.de)} a ${dCurto(x.q.ate)}${x.q.nFotos ? `, ${x.q.nFotos} fotos` : ''}${x.q.nParalisadas ? '' : ', sem paralisação no período'}`).join(' · ');

    // ----- um cartão por documento -----
    const cartao = (D, i) => { const ref = refDoc(D), n = i + 1;
      return `<section class="card card-pad man-doc" id="man-${D.k}">
        <div class="man-h"><span class="man-n">${n}</span><div class="man-h-t"><h2>${esc(D.t)}</h2>
          <div class="meta"><span>Origem <b>${esc(D.de)}</b></span><span>Quando <b>${esc(D.quando)}</b></span>${D.pasta ? `<span>Pasta <b>${esc(D.pasta)}</b></span>` : ''}</div></div>
          ${ref.length ? `<span class="pill info plain">referência: ${ref.map(nome).join(', ')}</span>` : ''}</div>
        <div class="man-g">
          <div><div class="step-t">Como gerar e enviar</div><ol class="man-l">${D.como.map(t => `<li>${esc(t)}</li>`).join('')}</ol>
            ${D.cols ? `<p class="hint" style="margin:0 0 6px"><b>Colunas que o painel lê:</b> ${esc(D.cols)}.</p>` : ''}
            <p class="hint" style="margin:0"><b>No painel e no report:</b> ${esc(D.usa)}.</p></div>
          <div><div class="step-t" style="margin-bottom:8px">Como está nas obras</div>${tabItens(D)}${D.k === 'rdo' && baseRdo ? `<small class="hint">Base: ${baseRdo}.</small>` : ''}</div>
        </div>
        ${D.k === 'rdo' ? `<div class="step-t" style="margin:18px 0 2px">Padrão de preenchimento</div>${blocosRdo(n)}` : ''}
      </section>`; };

    return `
      <div class="head-row"><div><div class="kicker">Uso interno · Machine</div><h1 class="h1">Manual de alimentação do painel</h1>
        <p class="sub">Os documentos que atualizam o painel e o report do cliente: de onde vem cada um, quando enviar, como gerar e o que precisa trazer. O padrão é o mesmo para todas as obras e foi montado com o que cada obra já faz melhor; as tabelas mostram quanto dele aparece hoje na carga de cada obra.</p></div>
        <div class="bar-actions no-print"><button class="btn sec2" type="button" id="man-imprimir">Imprimir</button></div></div>
      <div class="card card-pad"><div class="step-t" style="margin-bottom:8px">Documentos e situação nas obras</div>${geral}</div>
      <div class="card card-pad"><div class="step-t" style="margin-bottom:10px">Rotina de atualização</div>
        <div class="man-rot">${ROTINA.map(([t, passos]) => `<div><div class="man-sub-t">${esc(t)}</div><ol class="man-l">${passos.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>`).join('')}</div>
        <p class="hint" style="margin:6px 0 0">Todo arquivo do Prevision leva o código da obra no nome (ex.: Cronograma - 208 - …): o painel confere a obra pelo nome e pela tarefa raiz e recusa arquivo de outra obra. O Relatório de Medição do cliente, o Relatório de Contas Pagas e o custo real ainda não são lidos pelo painel e não precisam ser enviados.</p></div>
      ${DOCS.map(cartao).join('')}`;
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

  // Logo do cliente para a capa: corta a margem vazia (transparente ou branca), cabe em 640×320 e sai em PNG
  // (data URL, guardado no cadastro cifrado da obra; o html2canvas do PDF lê sem depender de outro endereço).
  async function logoReduzida(arquivo) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('formato não suportado')); i.src = url; });
      const w0 = img.naturalWidth || 640, h0 = img.naturalHeight || 320;
      const c0 = document.createElement('canvas'); c0.width = w0; c0.height = h0;
      const g0 = c0.getContext('2d'); g0.drawImage(img, 0, 0, w0, h0);
      const px = g0.getImageData(0, 0, w0, h0).data;
      let x0 = w0, y0 = h0, x1 = -1, y1 = -1;
      for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
        const k = (y * w0 + x) * 4, vazio = px[k + 3] < 16 || (px[k] > 242 && px[k + 1] > 242 && px[k + 2] > 242);
        if (!vazio) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) throw new Error('a imagem está vazia');
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, esc2 = Math.min(1, 640 / cw, 320 / ch);
      const c = document.createElement('canvas'); c.width = Math.round(cw * esc2); c.height = Math.round(ch * esc2);
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c0, x0, y0, cw, ch, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    } finally { URL.revokeObjectURL(url); }
  }

  // ---------- cadastro de obra ----------
  const OPCOES_VA = { auto: 'Automático', mostrar: 'Mostrar sempre', ocultar: 'Não mostrar' };
  const OPCOES_IP = { tempo: 'Prazo ganho, IDP(t) (recomendado)', percentual: 'IDP em % (realizado ÷ previsto)' };
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
        <div class="step-t">Capa do report</div>
        <div class="two">${f('o-capa-titulo', 'Nome da obra na capa', o && o.capa && o.capa.titulo, 'text', `placeholder="${esc((o && o.nome) || 'ex.: Fibrasa - Fábrica de Embalagens - Civit I')}"`)}${f('o-capa-rev', 'Revisão', (o && o.capa && o.capa.revisao) || '00', 'text', 'maxlength="4" inputmode="numeric"')}</div>
        <div class="field"><label>Logo do cliente</label>
          <div class="cp-logo-ed">${o && o.capa && o.capa.logo ? `<img src="${o.capa.logo}" alt="Logo do cliente">` : '<span class="sub">sem logo</span>'}
            <button class="btn sec2" type="button" id="o-logo-bt">Escolher imagem</button><button class="btn sec2" type="button" id="o-logo-rm" ${o && o.capa && o.capa.logo ? '' : 'hidden'}>Remover</button>
            <input type="file" id="o-logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></div>
          <small class="hint">PNG com fundo transparente fica melhor. Sem logo, a capa mostra só a da Machine. A capa é a mesma em todas as obras; de um mês para o outro só muda o mês de referência, escolhido na tela do report.</small></div>
        <div class="step-t">Report</div>
        <div class="field"><label for="o-va">Valor agregado no report</label><select class="inp" id="o-va">${Object.entries(OPCOES_VA).map(([k, t]) => `<option value="${k}" ${((o && o.reportVA) || 'auto') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <small class="hint">Automático: o quadro só entra no report quando há SPI e a Curva S financeira está na base do contrato. Na aba Obra, administradores e diretoria continuam vendo os números.</small></div>
        <div class="field"><label for="o-ip">Índice que acende o farol de prazo</label><select class="inp" id="o-ip">${Object.entries(OPCOES_IP).map(([k, t]) => `<option value="${k}" ${((o && o.indicePrazo) || 'tempo') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <small class="hint">Prazo ganho: compara datas (em quantos dias o realizado está atrás do plano) e não perde sensibilidade no fim da obra; no primeiro mês, ou com menos de 2% previsto, o painel usa o IDP em %. IDP em %: realizado ÷ previsto, a regra anterior.</small></div>
        <div class="bar-actions"><button class="btn" type="submit">Salvar obra</button><button class="btn sec2" type="button" data-go="${o ? 'obra' : 'portfolio'}">Cancelar</button></div>
      </form>`;
  }

  // ---------- PDF do report ----------
  // O report já é desenhado em folhas A4 paisagem: cada folha da tela vira uma página do PDF, do mesmo tamanho
  // (html2canvas + jsPDF). Dentro do claude.ai entrega pelo recurso de download; no site, baixa direto.
  // A impressão do navegador segue o mesmo desenho (CSS @page).
  const carregaLibsPdf = () => Promise.all([
    window.html2canvas ? null : carregaScript(CDN + 'html2canvas/1.4.1/html2canvas.min.js'),
    window.jspdf ? null : carregaScript(CDN + 'jspdf/2.5.1/jspdf.umd.min.js'),
  ]);
  async function baixarPdf(btn) {
    // dentro do claude.ai usa o recurso de download; no site, baixa direto pelo navegador
    let dl = null;
    if (window.self !== window.top) { try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; } }
    const salvar = dl ? a => dl.save(a) : async ({ filename, data }) => {
      const u = URL.createObjectURL(data), a = document.createElement('a'); a.href = u; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    };
    const rotulo = btn.textContent; btn.disabled = true; btn.textContent = 'Gerando PDF…';
    // dashboard aberto na tela (EAP expandida, folha mais alta): volta ao nível 2 antes de medir a folha; redesenha no fim
    const dashAberta = $$('#paper .folha.dash.aberta');
    dashAberta.forEach(f => { $$('.ds-sub', f).forEach(e => e.remove()); f.classList.remove('aberta'); });
    try {
      await carregaLibsPdf();
      try { await document.fonts.ready; } catch (e) {}
      const paper = $('#paper');
      const { jsPDF } = window.jspdf;
      let pdf = null;
      const folhas = $$('.folha', paper);
      for (let i = 0; i < folhas.length; i++) {
        btn.textContent = `Gerando PDF… ${i + 1}/${folhas.length}`;
        const canvas = await window.html2canvas(folhas[i], { scale: 2, backgroundColor: '#FFFFFF', useCORS: true, logging: false,
          onclone: doc => {
            // na tela a folha pode estar reduzida (zoom) para caber; no PDF vai em tamanho real
            doc.querySelectorAll('.folha').forEach(f => { f.style.zoom = '1'; f.style.boxShadow = 'none'; });
            // html2canvas desenha o conteúdo de <details> fechado: tira antes de capturar
            doc.querySelectorAll('details:not([open]) > :not(summary)').forEach(e => e.remove());
            // avisos internos da tela ("+N na aba Obra") não vão para o cliente
            doc.querySelectorAll('.fl-int').forEach(e => e.remove());
            // dashboard: no PDF fica a visão do nível 2 da EAP (linhas abertas na tela e setas saem)
            doc.querySelectorAll('.folha.dash .ds-sub').forEach(e => e.remove());
            doc.querySelectorAll('.folha.dash').forEach(f => f.classList.remove('aberta'));
            doc.querySelectorAll('.folha.dash .ds-tg, .folha.dash .ds-tg-sp').forEach(e => e.remove());
          } });
        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
        else pdf.addPage('a4', 'landscape');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 297, 210);
      }
      const o = DB.obras.find(x => x.id === S.obraId) || obrasDoUsuario()[0];
      const corte = (paper.dataset.corte || new Date().toISOString().slice(0, 10));
      await salvar({ filename: `Report-Obra-${o ? o.codigo : ''}-${corte}.pdf`, data: pdf.output('blob') });
    } catch (e) {
      const c = e && e.code;
      if (c !== 'declined') toast(c === 'rate_limited' ? 'Já existe um download aguardando confirmação.' : 'Não consegui gerar o PDF. Tente de novo.');
    } finally { btn.disabled = false; btn.textContent = rotulo; if (dashAberta.length) render(); }
  }

  // ---------- Valor agregado: cartões e nota dos termos (report e aba Obra) ----------
  const GLOSSARIO_VA = `<p class="rx-glos"><b>SPI</b> = EV ÷ PV (1,00 = no ritmo do plano) · <b>EV</b> valor do que foi executado · <b>PV</b> valor do que estava previsto até o corte</p>`;
  function cartoesVA(rf, o) {
    const F = rf.faturamento, cls = rf.spi === null ? '' : rf.sem.k === 'critico' ? 'crit' : rf.sem.k === 'atencao' ? 'warn' : 'ok';
    const spi = rf.spi === null ? null : `<div class="rx-card ac-${cls}"><small>SPI · prazo</small><b class="rx-card-v ${cls}">${fmtNum(rf.spi, 2)}</b>
      <span class="rx-card-s">EV ${Core.moedaCurta(rf.ev).replace('R$ ', '')} · PV ${Core.moedaCurta(rf.pv).replace('R$ ', '')}</span></div>`;
    const cards = (F ? [
      `<div class="rx-card ac-base"><small>Valor do contrato</small><b class="rx-card-v">${Core.moedaCurta(F.contratual)}</b><span class="rx-card-s"></span></div>`,
      `<div class="rx-card ac-plan"><small>Medido acumulado</small><b class="rx-card-v">${Core.moedaCurta(F.medido)}</b><span class="rx-card-s">${F.pctMedido !== null ? pct(F.pctMedido, 1) + ' do contrato' : ''}</span></div>`,
      `<div class="rx-card ac-base"><small>Saldo a medir</small><b class="rx-card-v">${Core.moedaCurta(F.saldo)}</b><span class="rx-card-s">${F.pctMedido !== null ? pct(1 - F.pctMedido, 1) + ' do contrato' : ''}</span></div>`,
    ] : [
      `<div class="rx-card ac-real"><small>EV · executado</small><b class="rx-card-v">${Core.moedaCurta(rf.ev)}</b><span class="rx-card-s">até ${dCurto(o.dataCorteFinanceiro || o.dataCorte)}</span></div>`,
      `<div class="rx-card ac-plan"><small>PV · previsto</small><b class="rx-card-v">${Core.moedaCurta(rf.pv)}</b><span class="rx-card-s">para a mesma data</span></div>`,
    ]).concat(spi ? [spi] : []);
    return `<div class="rx-cards${cards.length === 3 ? ' c3' : cards.length === 2 ? ' c2' : ''}">${cards.join('')}</div>`;
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

  // ---------- restrições (uso interno) ----------
  // Mapa de restrições da reunião semanal, no padrão do Last Planner System: cada restrição tem frente, tipo, responsável,
  // data limite e ação. O farol sai da data (Core.farolRestricao), o IRR mede a remoção no prazo (Core.indicadoresRestricoes).
  // Administrador registra e atualiza; diretoria consulta; cliente não vê a aba.
  const hojeLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const FILTROS_RES = [['abertas', 'Abertas'], ['vencidas', 'Vencidas'], ['semana', 'Vencem em 7 dias'], ['removidas', 'Removidas'], ['todas', 'Todas']];
  function viewRestricoes() {
    const base = DB.obras.find(x => x.id === S.obraId);
    if (!base) return `<div class="card card-pad">Escolha uma obra no portfólio.</div>`;
    const hoje = hojeLocal(), itens = base.restricoes || [], adm = ehAdmin();
    const I = Core.indicadoresRestricoes(itens, hoje);
    const linhasCron = (base.cronograma && base.cronograma.linhas) || [];
    const filtro = S.resFiltro || 'abertas', pessoa = S.resPessoa || null;
    const doFiltro = x => { const f = Core.farolRestricao(x, hoje);
      return filtro === 'todas' ? true : filtro === 'removidas' ? x.status === 'removida' : filtro === 'vencidas' ? f.k === 'critico' : filtro === 'semana' ? f.ordem === 1 : x.status !== 'removida'; };
    const lista = Core.ordenarRestricoes(itens.filter(doFiltro).filter(x => !pessoa || Core.pessoasDe(x.responsavel).includes(pessoa)), hoje);
    const conta = { abertas: I.abertas, vencidas: I.vencidas, semana: I.vencem7, removidas: I.total - I.abertas, todas: I.total };
    const irrCls = v => v === null ? '' : v >= I.meta ? 'ok' : v >= 0.6 ? 'warn' : 'crit';
    const seletorObra = DB.obras.length > 1 ? `<label class="rs-obra"><span>Obra</span><select class="inp" id="rs-obra">${DB.obras.map(o => `<option value="${esc(o.id)}" ${o.id === base.id ? 'selected' : ''}>${esc(o.codigo)} · ${esc(o.nome)}</option>`).join('')}</select></label>` : '';

    const kpis = `<div class="kpi-strip">
        <div class="kpi-t neutro"><span>Abertas</span><b>${I.abertas}</b><small>${I.total} registradas${I.semData ? ` · ${I.semData} sem data` : ''}</small></div>
        <div class="kpi-t ${I.vencidas ? 'crit' : 'ok'}"><span>Vencidas</span><b class="${I.vencidas ? 'crit' : ''}">${I.vencidas}</b><small>data limite já passou</small></div>
        <div class="kpi-t ${I.vencem7 ? 'warn' : 'ok'}"><span>Vencem em 7 dias</span><b>${I.vencem7}</b><small>prioridade da semana</small></div>
        <div class="kpi-t ${irrCls(I.irr4) || 'neutro'}"><span>IRR · 4 semanas</span><b class="${irrCls(I.irr4) === 'crit' ? 'crit' : ''}">${I.irr4 === null ? '—' : pct(I.irr4, 0)}</b><small>${I.previstas4 ? `${I.noPrazo4} de ${I.previstas4} removidas no prazo` : 'sem restrições previstas'} · meta ${pct(I.meta, 0)}</small></div>
        <div class="kpi-t neutro"><span>Removidas na semana</span><b>${I.removidasSemana}</b><small>desde ${dCurto(I.serie.at(-1).ini)}</small></div>
      </div>`;

    const irr = `<div class="card card-pad rs-irr-card">
        <div class="rs-irr-cab"><b>IRR semanal</b><span>restrições removidas até a data prevista original ÷ restrições previstas na semana</span></div>
        <div class="rs-irr" role="img" aria-label="IRR das últimas ${I.serie.length} semanas">
          <em class="rs-meta" style="--m:${I.meta}"><span>meta ${pct(I.meta, 0)}</span></em>
          ${I.serie.map(w => `<div class="${w.atual ? 'at' : ''}" title="${dBR(w.ini)} a ${dBR(w.fim)}: ${w.previstas ? `${w.noPrazo} de ${w.previstas} no prazo` : 'nenhuma prevista'}${w.atual ? ' (semana em curso)' : ''}">
            <i class="${irrCls(w.irr)}" style="height:${w.irr === null ? 0 : Math.max(2, w.irr * 100)}%"></i><b>${w.irr === null ? '—' : pct(w.irr, 0)}</b><span>${dCurto(w.ini)}${w.atual ? '*' : ''}</span></div>`).join('')}
        </div>
        <p class="sec-lead" style="margin:0">* semana em curso, até hoje. A data prevista é a primeira data limite informada: reprogramar não melhora o índice${I.reprogramadas ? ` (${I.reprogramadas} ${I.reprogramadas === 1 ? 'restrição aberta foi reprogramada' : 'restrições abertas foram reprogramadas'})` : ''}.</p>
      </div>`;

    const pessoas = I.porPessoa.length ? `<div class="rs-pessoas" role="group" aria-label="Filtrar por responsável">
        ${I.porPessoa.map(p => `<button data-respessoa="${esc(p.nome)}" aria-pressed="${pessoa === p.nome}">${esc(p.nome)} <b>${p.abertas}</b>${p.vencidas ? `<i>${p.vencidas} vencida${p.vencidas > 1 ? 's' : ''}</i>` : ''}</button>`).join('')}
        ${pessoa ? '<button data-respessoa="" class="rs-limpa">Todos</button>' : ''}</div>` : '';

    const linha = x => {
      const f = Core.farolRestricao(x, hoje), imp = Core.restricaoImpede(x, linhasCron);
      const datas = x.dataLimite ? `${dBR(x.dataLimite)}${(x.reprogramacoes || 0) > 0 ? `<small>reprogramada ${x.reprogramacoes}× · prevista ${dCurto(x.dataOriginal)}</small>` : ''}` : `<span class="rs-cond">${esc(x.condicao || 'sem data')}</span>`;
      return `<tr class="rs-${f.k}">
        <td>${pill(f.k, f.t)}</td>
        <td><b style="font-weight:600">${esc(x.frente || '—')}</b>${x.acao ? `<small class="rs-acao">${esc(x.acao)}</small>` : ''}${x.obs ? `<small class="rs-obs" title="${esc(x.obs)}">${esc(x.obs)}</small>` : ''}
          ${imp ? `<small class="rs-imp ${imp.conflito ? 'crit' : ''}">${imp.conflito ? `${IC.alert}<span>${esc(Core.nomeCurto ? Core.nomeCurto(imp.nome) : imp.nome)} começa em ${dBR(imp.inicio)}, antes da data limite</span>` : `<span>Libera: ${esc(imp.nome)}${imp.inicio ? ` (início ${dBR(imp.inicio)})` : ''}</span>`}</small>` : ''}</td>
        <td>${esc(x.tipo || '—')}</td><td>${esc(x.responsavel || '—')}</td>
        <td class="n">${datas}</td>
        <td>${esc(Core.ST_RESTR[x.status] || x.status)}${x.status === 'removida' && x.removidaEm ? `<small>em ${dCurto(x.removidaEm)}</small>` : ''}</td>
        ${adm ? `<td class="acoes no-print">${x.status !== 'removida' ? `<button class="btn sm" data-resremover="${esc(x.id)}" title="Marcar como removida hoje">Remover</button>` : ''}<button class="btn sm sec2" data-reseditar="${esc(x.id)}">Editar</button></td>` : ''}
      </tr>`;
    };
    const tabela = lista.length ? `<div class="tw"><table class="t rs-t"><thead><tr><th>Farol</th><th>Frente · ação</th><th>Tipo</th><th>Responsável</th><th class="n">Data limite</th><th>Status</th>${adm ? '<th class="no-print"></th>' : ''}</tr></thead>
        <tbody>${lista.map(linha).join('')}</tbody></table></div>`
      : `<p class="sec-lead" style="margin:0">${itens.length ? 'Nenhuma restrição neste filtro.' : adm ? 'Nenhuma restrição registrada. Cadastre a primeira ou importe a planilha do mapa de restrições.' : 'Nenhuma restrição registrada nesta obra.'}</p>`;

    return `
      <div class="head-row"><div style="min-width:0">
        <div class="kicker">Obra ${esc(base.codigo)} · uso interno</div>
        <h1 class="h1">Mapa de restrições</h1>
        <p class="sub">O que precisa estar resolvido para cada frente avançar. Farol pela data limite; revisão na reunião semanal.${base.restricoesEm ? ` Atualizado em ${new Date(base.restricoesEm).toLocaleDateString('pt-BR')}.` : ''}</p>
        <p class="print-only">Posição de ${dBR(hoje)} · ${esc(base.nome)}</p>
      </div><div class="bar-actions no-print">${seletorObra}
        ${adm ? '<button class="btn" data-resnova>Nova restrição</button><button class="btn sec2" id="rs-importar">Importar planilha ou PDF</button><input type="file" id="rs-arq" accept=".xlsx,.xls,.pdf" hidden>' : ''}
        <button class="btn sec2" id="rs-imprimir">Imprimir</button><button class="btn sec2" data-copialink>Copiar link</button></div></div>
      ${S.resEd ? formRestricao(base, linhasCron) : ''}
      ${kpis}
      ${irr}
      <div class="card card-pad steps">
        <div class="seg no-print" role="group" aria-label="Filtrar restrições">${FILTROS_RES.map(([k, t]) => `<button data-resfiltro="${k}" aria-pressed="${filtro === k}">${t}<b>${conta[k]}</b></button>`).join('')}</div>
        ${pessoas ? `<div class="no-print">${pessoas}</div>` : ''}
        ${tabela}
      </div>`;
  }
  function formRestricao(base, linhasCron) {
    const x = S.resEd.id ? (base.restricoes || []).find(r => r.id === S.resEd.id) || {} : { status: 'pendente' };
    const v = k => esc(x[k] || '');
    const nomes = [...new Set((base.restricoes || []).flatMap(r => Core.pessoasDe(r.responsavel)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const frentes = [...new Set((base.restricoes || []).map(r => r.frente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const tipos = [...new Set([...Core.TIPOS_RESTR, ...(base.restricoes || []).map(r => r.tipo).filter(Boolean)])];
    const ativ = linhasCron.filter(l => l.nivel >= 2 && l.nivel <= 4 && (l.realizado || 0) < 0.9995);
    const atAtual = x.atividade ? `${x.atividade.linha}|${x.atividade.nome}` : '';
    return `<form class="card card-pad steps rs-form no-print" id="f-res" novalidate>
        <div class="step-t">${x.id ? 'Editar restrição' : 'Nova restrição'}</div>
        <div class="two"><div class="field"><label for="rs-frente">Frente / item</label><input class="inp" id="rs-frente" list="rs-frentes" value="${v('frente')}" required placeholder="ex.: Fundação rasa"><datalist id="rs-frentes">${frentes.map(f => `<option value="${esc(f)}">`).join('')}</datalist></div>
          <div class="field"><label for="rs-tipo">Tipo</label><input class="inp" id="rs-tipo" list="rs-tipos" value="${v('tipo')}" placeholder="Projeto, Contratação, Material…"><datalist id="rs-tipos">${tipos.map(t => `<option value="${esc(t)}">`).join('')}</datalist></div></div>
        <div class="field"><label for="rs-acao">Ação para remover</label><textarea class="inp" id="rs-acao" rows="2" placeholder="ex.: Apresentar ao Fernando o quadro de concorrência da SC 4811">${v('acao')}</textarea></div>
        <div class="two"><div class="field"><label for="rs-resp">Responsável</label><input class="inp" id="rs-resp" list="rs-nomes" value="${v('responsavel')}" placeholder="ex.: Gisele / André"><datalist id="rs-nomes">${nomes.map(n => `<option value="${esc(n)}">`).join('')}</datalist></div>
          <div class="two"><div class="field"><label for="rs-data">Data limite</label><input class="inp" id="rs-data" type="date" value="${v('dataLimite')}"></div>
            <div class="field"><label for="rs-status">Status</label><select class="inp" id="rs-status">${Object.entries(Core.ST_RESTR).map(([k, t]) => `<option value="${k}" ${(x.status || 'pendente') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div></div>
        <div class="two"><div class="field"><label for="rs-cond">Condição, quando não há data</label><input class="inp" id="rs-cond" value="${v('condicao')}" placeholder="ex.: 3 dias após envio da carta"></div>
          <div class="field" id="rs-rem-f" ${x.status === 'removida' ? '' : 'hidden'}><label for="rs-rem">Removida em</label><input class="inp" id="rs-rem" type="date" value="${esc(x.removidaEm || hojeLocal())}"></div></div>
        <div class="field"><label for="rs-obs">Observação</label><textarea class="inp" id="rs-obs" rows="2">${v('obs')}</textarea></div>
        ${ativ.length ? `<div class="field"><label for="rs-ativ">Atividade do cronograma que esta restrição libera (opcional)</label><select class="inp" id="rs-ativ"><option value="">—</option>${ativ.map(l => `<option value="${esc(l.linha + '|' + l.nome)}" ${atAtual === l.linha + '|' + l.nome ? 'selected' : ''}>${esc(l.eap)} · ${esc(l.nome.length > 80 ? l.nome.slice(0, 77) + '…' : l.nome)}${l.inicio ? ` · início ${dCurto(l.inicio)}` : ''}</option>`).join('')}</select>
          <small class="hint">Com o vínculo, o painel avisa quando a atividade começa antes da data limite da restrição.</small></div>` : ''}
        ${x.id && (x.reprogramacoes || 0) > 0 ? `<p class="sec-lead" style="margin:0">Reprogramada ${x.reprogramacoes}× · data prevista original ${dBR(x.dataOriginal)} (base do IRR).</p>` : ''}
        <div class="bar-actions"><button class="btn" type="submit">Salvar</button><button class="btn sec2" type="button" id="rs-cancelar">Cancelar</button>${x.id ? '<button class="btn danger" type="button" id="rs-excluir">Excluir</button>' : ''}</div>
      </form>`;
  }
  // grava e volta à lista; a tela é recarregada da API (mesma versão que foi para o repositório)
  async function gravaRestricao(msg, fn, ok) {
    const r = await gravando(msg, fn);
    if (!r) return false;
    await recarregar(); if (ok) toast(ok);
    return true;
  }
  async function importarPlanilhaRestricoes(f) {
    if (/\.pdf$/i.test(f.name)) return importarPdfRestricoes(f);
    try { if (!window.XLSX) await carregaScript(CDN + 'xlsx/0.18.5/xlsx.full.min.js'); } catch (e) { toast(e.message + '. Confira a conexão e tente de novo.'); return; }
    try {
      const wb = Parsers.wbDe(window.XLSX, new Uint8Array(await f.arrayBuffer()));
      const r = Parsers.parseRestricoes(window.XLSX, wb, { arquivo: f.name, hoje: hojeLocal(), dataRestricao: Core.dataRestricao });
      if (!r || !r.itens.length) { toast('Não encontrei a tabela de restrições (cabeçalho com Status e Ação) nesta planilha.'); return; }
      const base = DB.obras.find(x => x.id === S.obraId);
      const cod = (f.name.match(/obra\s*(\d{3,4})/i) || r.titulo.match(/obra\s*(\d{3,4})/i) || [])[1];
      S.resImp = { ...r, arquivo: f.name, outraObra: cod && base && cod !== String(base.codigo) ? cod : null };
      S.modal = { tipo: 'resimp' }; render();
    } catch (e) { toast('Não consegui ler a planilha: ' + e.message); }
  }
  // PDF "Remoção de Restrições" do Departamento de Operações: mesma importação da planilha (somar atualiza o status das
  // ações que já estão no mapa). A obra sai do código no título ("SOTREQ (211)") ou do nome do time no cadastro.
  async function importarPdfRestricoes(f) {
    try { if (!window.pdfjsLib) await carregaScript(CDN + 'pdf.js/3.11.174/pdf.min.js').then(() => carregaScript(CDN + 'pdf.js/3.11.174/pdf.worker.min.js')); } catch (e) { toast(e.message + '. Confira a conexão e tente de novo.'); return; }
    try {
      const pags = await Parsers.pdfItens(window.pdfjsLib, new Uint8Array(await f.arrayBuffer()));
      if (!Parsers.ehRestricoesPdf(pags)) { toast('Este PDF não é uma Remoção de Restrições (Controle de ações e restrições).'); return; }
      const r = Parsers.parseRestricoesPdf(pags);
      if (!r.itens.length) { toast(r.avisos[0] || 'Nenhuma ação lida no PDF.'); return; }
      const base = DB.obras.find(x => x.id === S.obraId) || {};
      const nrm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const time = nrm(String(r.equipe || '').split(/[\/(]/)[0]).trim();
      const outraObra = r.codigo && r.codigo !== String(base.codigo) ? r.codigo : null;
      if (!r.codigo && time && !nrm([base.nome, base.cliente, base.contratante].join(' ')).includes(time)) r.avisos.push(`O time "${r.equipe}" não aparece no nome nem no cliente da obra ${base.codigo}: confira se é a obra certa.`);
      S.resImp = { ...r, arquivo: f.name, outraObra };
      S.modal = { tipo: 'resimp' }; render();
    } catch (e) { toast('Não consegui ler o PDF: ' + e.message); }
  }
  // ---------- report no celular: resumo legível antes das folhas ----------
  // No celular a folha A4 é reduzida até caber e o texto fica pequeno demais. O resumo traz o essencial em tamanho de
  // leitura (só na tela estreita; fora da impressão e do PDF): situação, avanço, prazo, projeção, atenções e marcos.
  function resumoCelular(o, r, X) {
    const P = r.prazo, F = r.projecaoFaixa;
    const proj = F ? [F.atrasoMantido, F.desempenhoMantido].sort().map(Core.mesCurto).filter((v, i, a) => a.indexOf(v) === i).join(' a ') : r.projecao ? '~' + Core.mesCurto(r.projecao) : '—';
    const corPrazo = clsAtraso(r).replace('neg', 'crit').replace('pos', 'ok');
    return `<section class="rx-mob no-print" aria-label="Resumo do report">
      <div class="rx-mob-top">${pill(r.sem.k, r.sem.t)}<span>Posição de <b>${dBR(r.corte)}</b></span></div>
      <div class="rx-mob-g">
        <div><small>Realizado</small><b>${pct(r.real)}</b><span>planejado ${pct(r.prevCorte)}</span></div>
        <div><small>Prazo</small><b class="${corPrazo}">${r.prazoGanho ? Core.textoAtraso(r.prazoGanho) : '—'}</b><span>${indicePrazo(r)}</span></div>
        <div><small>Término do cronograma</small><b>${dBR(P.fimCron)}</b><span>${P.contrFim ? 'contrato ' + dBR(P.contrFim) : 'sem linha de base'}</span></div>
        <div><small>Projeção</small><b>${proj}</b><span>${r.projecaoFonte === 'prazo' ? 'pelo prazo ganho' : r.projecaoFonte === 'ritmo' ? 'pelo ritmo de 3 meses' : 'histórico insuficiente'}</span></div>
      </div>
      ${X.manchete ? `<p class="rx-mob-lead">${esc(X.manchete)}</p>` : ''}
      ${X.atencao.length ? `<h3>Pontos de atenção</h3><ul>${X.atencao.map(a => `<li><span class="rx-dot ${/paralis|atras/i.test(a.tag) ? 'crit' : 'warn'}">${esc(a.tag)}</span><b>${esc(a.titulo)}</b><small>${esc(a.det || '')}</small></li>`).join('')}</ul>` : ''}
      ${X.marcos.lista.length ? `<h3>Próximos marcos</h3><ul>${X.marcos.lista.slice(0, 4).map(m => `<li><span class="rx-mob-d">${m.data ? dCurto(m.data) : 'a definir'}</span><b>${esc(m.nome)}</b>${m.situacao === 'vencido' ? '<small class="crit">vencido</small>' : m.slip ? `<small>${m.slip > 0 ? '+' : '−'}${Math.abs(m.slip)} d vs base</small>` : ''}</li>`).join('')}</ul>` : ''}
      <p class="rx-mob-nota">As folhas completas do report seguem abaixo; para ler no tamanho original, use Baixar PDF.</p>
    </section>`;
  }

  // ---------- report: folhas A4 paisagem (rev. 25/10/2026) ----------
  // Desenho fixo, o mesmo em todas as obras, com cabeçalho e rodapé iguais em todas as folhas:
  //   Visão geral — identificação, 4 indicadores, leitura do período; Curva S física (esquerda), marcos e pontos de atenção (direita)
  //   Andamento — avanço por atividade (esquerda) e campo no último RDO (direita)
  //   Valor agregado — só quando entra no report (cadastro da obra → Valor agregado no report)
  //   Registro fotográfico — até 12 fotos por folha (4 × 3) · Mapa de avanço — uma ou duas plantas por folha
  // Os gráficos ocupam a altura que sobra no quadro; o que não cabe é ajustado depois, em montaFolhas().
  function viewReport() {
    const base = DB.obras.find(x => x.id === S.obraId) || obrasDoUsuario()[0];
    if (!base || !temDados(visaoDaObra(base))) return `<div class="card card-pad"><p class="sub" style="margin:0">Ainda não há dados para o report desta obra.</p></div>`;
    const o = visaoDaObra(base);
    const r = calcObra(base);
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
        v: cp.dir === 0 ? 'Em linha' : pp(r.desvio), s: r.inicioObra ? 'início da obra · farol a partir de 2% previsto' : r.prazoGanho ? `${Core.textoAtraso(r.prazoGanho)} · ${indicePrazo(r)}` : r.idp ? `IDP ${fmtNum(r.idp, 2)}` : 'IDP indisponível' },
      { k: P.contrFim ? 'Término previsto (base)' : 'Término previsto', ac: 'base', v: P.contrFim ? dBR(P.contrFim) : P.fimCron ? dBR(P.fimCron) : '—',
        s: P.contrFim ? `cronograma atual ${dBR(P.fimCron)}${slipFim ? ` · <b class="${slipFim > 0 ? 'warn' : 'ok'}">${dias(slipFim)}</b>` : ''}` : 'cronograma atual (sem linha de base)', html: true },
    ];
    const corte = dBR(r.corte);
    const cab = (titulo, sub) => `<header class="fl-cab"><div class="fl-cab-a"><img src="${LOGO}" alt="Machine"><i></i><span>Relatório de<br>acompanhamento</span></div>
        <div class="fl-cab-b"><b>${titulo}</b><span>Obra ${esc(o.codigo)} · ${esc(o.nome)}${sub ? ` · ${sub}` : ''}</span></div>
        <div class="fl-cab-c"><small>Posição de</small><b>${corte}</b></div></header>`;
    const pe = `<footer class="fl-pe"><span>Machine · Planejamento e Controle</span><span>${esc([o.cliente, o.cidade].filter(Boolean).join(' · '))}</span><span class="fl-n"></span></footer>`;
    const folha = (titulo, corpo, cls = '', sub = '') => `<article class="folha paisagem exec ${cls}">${cab(titulo, sub)}<div class="fl-corpo">${corpo}</div>${pe}</article>`;

    // ----- Capa (padrão único para todas as obras) -----
    // Fixo por obra (cadastro): nome no report, cliente, local, revisão e a logo do cliente (quando houver).
    // Muda todo mês: só o mês/ano de referência (escolhido na tela do report; sem escolha, o mês da data de corte).
    const capa = o.capa || {}, nomeCapa = capa.titulo || o.nome;
    const mr = o.mesReferencia, mesRefIso = mr && /^\d{4}-\d{2}$/.test(mr.mes || '') && mr.corte === o.dataCorte ? mr.mes : r.corte.slice(0, 7);
    const mesRef = Core.mesLongo(mesRefIso).replace(/^./, c => c.toUpperCase());
    const linhaCapa = (k, v) => v ? `<div><dt>${k}:</dt><dd>${esc(v)}</dd></div>` : '';
    const folhaCapa = `<article class="folha paisagem capa" aria-label="Capa do relatório">
        <div class="cp-titulo"><h1>RELATÓRIO MENSAL DE CONTRATO</h1><p>Obra ${esc(o.codigo)} - ${esc(nomeCapa)}</p></div>
        <div class="cp-bloco">
          <div class="cp-logos"><div class="cp-machine"><img src="${LOGO}" alt="Machine"><span>Realizações com base sólida</span></div>
            ${capa.logo ? `<img class="cp-cli" src="${capa.logo}" alt="${esc(o.cliente || 'Cliente')}">` : ''}</div>
          <i class="cp-reg" aria-hidden="true"></i>
          <dl class="cp-dados">${linhaCapa('Mês/Ano de referência', mesRef)}${linhaCapa('Obra', `${o.codigo} - ${nomeCapa}`)}${linhaCapa('Local', o.cidade)}${linhaCapa('Cliente', o.cliente)}${linhaCapa('Revisão', capa.revisao || '00')}</dl>
        </div>
      </article>`;

    // ----- Dashboard · status geral (2ª folha, mesmo desenho em todas as obras) -----
    const folhaDash = dashboardStatus(o, r, capa);

    // ----- Físico (3ª folha): a curva física num quadro só — acumulado em cima, avanço de cada mês na faixa de baixo, no
    // mesmo eixo de meses — e as barras Base / Previsto / Realizado na data. Cartões e identificação já estão no dashboard.
    const tri = [['Base', r.baseCorte, 'base'], ['Previsto', r.prevCorte, 'prev'], ['Realizado', r.real, 'real']];
    const visao = `<section class="rx-s rx-box fx p-cresce"><h2><i class="rx-ic">${IC.search}</i>Curva física<em>% do total da obra · posição de ${corte}</em></h2>
          <div class="legend rx-leg"><span class="rx-leg-g">Acumulado</span><span><i class="sw sw-base"></i>Base</span><span><i class="sw sw-prev"></i>Previsto</span><span><i class="sw sw-real"></i>Realizado</span>
            <span class="rx-leg-g">No mês</span><span><i class="sw sw-bbase"></i>Base</span><span><i class="sw sw-bplan"></i>Previsto</span><span><i class="sw sw-breal"></i>Realizado</span><span class="note">${Core.mesCurto(r.corte)} parcial até ${dCurto(r.corte)}</span></div>
          <div class="chart" id="ch-combo-r" data-fill></div></section>
      <div class="rx-tri">${tri.map(([t, v, k]) => `<div class="rx-tri-i ${k}"><span>${t}</span><b>${pct(v, 2)}</b><i><em style="width:${lim01(v)}%"></em></i></div>`).join('')}</div>`;

    // ----- Valor agregado -----
    const rf = Core.calcFinanceiro(o, r.corte);
    const valor = Core.vaNoReport(o, rf) ? `${cartoesVA(rf, o)}${rf.spi !== null ? GLOSSARIO_VA : ''}
      ${rf.pts ? `<section class="rx-s rx-box fx p-cresce"><h2><i class="rx-ic">${IC.search}</i>Curva S financeira<em>${notaEscalaVA(rf)}</em></h2>
        <div class="legend rx-leg"><span><i class="sw sw-real"></i>Realizado (EV)</span><span><i class="sw sw-prev"></i>Planejado (PV)</span><span><i class="sw sw-base"></i>Base</span>${rf.cpi !== null ? `<span class="note">CPI ${fmtNum(rf.cpi, 2)}</span>` : ''}</div>
        <div class="chart" id="ch-fin-r" data-fill></div></section>` : ''}` : '';

    // ----- Frentes: mapa de avanço + fotos do período (como o relatório mensal) -----
    // Para cada frente com planta: a folha da planta (executado · em execução · a executar) e, logo depois, as fotos do
    // período daquela frente, duas por folha, com legenda. Fotos sem frente no mapa (ou obra sem mapa) vêm no fim, também
    // duas por folha. A escolha das fotos continua a do report (Core.resumoExecutivo: uma por serviço, até 12).
    const mapas = Core.mapasDaObra(o, r);
    // Fotos escolhidas na própria frente (editor do mapa, como no relatório mensal): com elas, o report usa só essas.
    // Sem nenhuma, vale a seleção automática dos RDOs, ligada à frente pela EAP/serviço da legenda.
    const curadas = mapas.some(m => (m.fotos || []).length);
    const porMapa = new Map(mapas.map(m => [m.id, curadas ? (m.fotos || []).map(f => ({ ...f, curada: true })) : []])), soltas = [];
    if (!curadas) X.fotos.forEach(f => { const v = mapas.length ? Core.fotoNoMapa(f, mapas) : null; if (v && porMapa.has(v.mapa.id)) porMapa.get(v.mapa.id).push(f); else soltas.push(f); });
    const figFoto = f => f.curada
      ? `<figure class="rx-f2"><div class="rx-f2-img"><img src="${f.src}" alt="${esc(f.legenda || 'Foto da frente de serviço')}"></div>${f.legenda ? `<figcaption><span>${esc(f.legenda)}</span></figcaption>` : ''}</figure>`
      : `<figure class="rx-f2"><div class="rx-f2-img"><img src="${urlImg(f.src)}" alt="${esc(legendaCurta(f) || `Foto do RDO nº ${f.rdo}, ${dBR(f.data)}`)}"></div>
        <figcaption><span>${esc(legendaCurta(f) || 'Registro do diário de obra')}</span><small>RDO nº ${f.rdo} · ${dBR(f.data)}</small></figcaption></figure>`;
    const folhasFotos = (fs, sub) => { const out = []; for (let i = 0; i < fs.length; i += 2) out.push(folha('Fotos · registros — evidências do período', `<div class="rx-fotos2">${fs.slice(i, i + 2).map(figFoto).join('')}</div>`, 'fl-fotos2', sub)); return out.join(''); };
    const frentes = [];
    mapas.filter(m => m.pagina !== 'paisagem').forEach(m => frentes.push(folhasDoMapa([m], folha) + folhasFotos(porMapa.get(m.id), m.titulo || '')));
    const duas = mapas.filter(m => m.pagina === 'paisagem');
    for (let i = 0; i < duas.length; i += 2) { const par = duas.slice(i, i + 2); frentes.push(folhasDoMapa(par, folha) + folhasFotos(par.flatMap(m => porMapa.get(m.id)), par.map(m => m.titulo).filter(Boolean).join(' · '))); }
    const fotos = frentes.join('') + folhasFotos(soltas, mapas.length ? 'outros serviços do período' : '');
    // rotina do mês (só administrador, fora do PDF): de quando são as fotos das frentes e como recomeçar no mês seguinte
    const fotosFr = mapas.flatMap(m => (m.fotos || []).map(f => ({ ...f, frente: m.titulo, em: f.em || m.atualizadoEm || null })));
    const datasF = fotosFr.map(f => f.em).filter(Boolean).sort();
    const velhas = fotosFr.filter(f => !f.em || diff(f.em, hojeLocal()) > 40).length;
    const notaFotos = !ehAdmin() ? '' : curadas
      ? `<div class="note-box no-print${velhas ? ' err' : ''}">Fotos das frentes: <b>${fotosFr.length}</b> em <b>${mapas.filter(m => (m.fotos || []).length).length}</b> frentes${datasF.length ? `, carregadas de ${dBR(datasF[0])} a ${dBR(datasF.at(-1))}` : ''}.${velhas ? ` <b>${velhas} ${velhas === 1 ? 'foto tem' : 'fotos têm'} mais de 40 dias ou sem data</b>: confira se são do mês do report.` : ''} No mês seguinte, limpe e carregue as novas em Obra → Mapa de avanço. <button class="btn sec2" type="button" data-limpafotos style="margin-left:8px">Limpar fotos de todas as frentes</button></div>`
      : mapas.length ? '<div class="note-box no-print">Nenhuma frente com fotos escolhidas: o report usa a seleção automática das fotos dos RDOs. Para o modelo do relatório mensal, carregue duas fotos por frente em Obra → Mapa de avanço.</div>' : '';

    return `
      <div class="head-row no-print"><div><div class="kicker">Report</div><h1 class="h1">Obra ${esc(o.codigo)} · ${corte}</h1>
        <p class="sub">Folhas A4 paisagem, com os mesmos quadros na mesma ordem em todas as obras: capa, dashboard, curva física, ${mapas.length ? 'cada frente com a planta e as fotos do período' : 'fotos do período'}, valor agregado e medições. O detalhe completo fica na aba Obra.</p></div>
        <div class="bar-actions">${ehAdmin() ? `<label class="rp-mes" title="Só o mês muda na capa de um mês para o outro">Mês da capa<input class="inp" type="month" id="rp-mes" value="${mesRefIso}"></label>` : ''}<button class="btn" id="bt-pdf">Baixar PDF</button><a class="btn sec2" href="${mailto('', `Report de planejamento · Obra ${o.codigo} · ${corte}`, `Prezados,\n\nSegue o report de planejamento da obra ${o.codigo} · ${o.nome}, com posição de ${corte}.\n\nO painel completo está disponível em ${SITE()}#obra-${o.id}/report (acesso com e-mail e senha).\n\nAtenciosamente,\nPlanejamento · Machine`)}">Enviar por e-mail</a></div></div>
      ${notaFotos}
      ${resumoCelular(o, r, X)}
      <div class="folhas" id="paper" data-corte="${r.corte}">
        ${folhaCapa}
        ${folhaDash}
        ${folha('Físico (previsto x realizado)', visao, 'fl-visao fl-fisico')}
        ${fotos}
        ${valor ? folha('Valor agregado', valor, 'fl-valor') : ''}
        ${folhasMedicao(o, folha)}
      </div>`;
  }

  // ---------- Dashboard · status geral (2ª folha do report) ----------
  // Cartões (avanço físico e financeiro acumulados, IDP, IDC, variação do término), linha do prazo contratual e a tabela
  // Previsto × Realizado por frente da EAP (Base, Previsto e Realizado da própria linha no cronograma do Prevision).
  // Faixas dos índices = farol do painel (Core.FAIXAS). Sem o dado, o cartão mostra "—" e diz o que falta.
  const DASH_LINHAS = 15;
  function dashboardStatus(o, r, capa) {
    const P = r.prazo, F = Core.FAIXAS, n2 = v => v === null || v === undefined || isNaN(v) ? '—' : fmtNum(v * 100, 2);
    const farol = v => v === null || v === undefined ? 'neutro' : v >= F.ok ? 'ok' : v >= F.atencao ? 'atencao' : 'critico';
    const rf = Core.calcFinanceiro(o, r.corte), comVA = Core.vaNoReport(o, rf);
    // IDC: só o da Gestão de Custos do Prevision (gravado pela sincronização em obra.indicesPrevision)
    const IP = o.indicesPrevision, idp = r.farolTempo ? r.prazoGanho.idpT : r.idp, cpi = IP && IP.idc ? IP.idc : null;
    const varFim = P.contrFim && P.fimCron ? diff(P.contrFim, P.fimCron) : (r.crono && r.crono.slip !== undefined ? r.crono.slip : null);
    const card = (cls, rot, val, sub) => `<div class="ds-card ${cls}"><small>${rot}</small><b>${val}</b><span>${sub}</span></div>`;
    const cards = `<div class="ds-cards">
        ${card('ac-fis', 'Avanço físico (acum.)', `${n2(r.real)}%`, `Base: ${n2(r.baseCorte)}%`)}
        ${card('ac-fis', 'Avanço financeiro (acum.)', comVA && rf.evFrac !== null ? `${n2(rf.evFrac)}%` : '—', comVA && rf.baseFrac !== null ? `Base: ${n2(rf.baseFrac)}%` : 'sem Curva S financeira no report')}
        <div class="ds-ind">
          <div class="ds-ind-g">${card(`ac-${farol(idp)}`, `IDP<em>(Índice de Prazo)</em>`, idp ? fmtNum(idp, 2) : '—', 'Meta: 1,00')}
            ${card(`ac-${farol(cpi)}`, `IDC<em>(Índice de Custo)</em>`, cpi ? fmtNum(cpi, 2) : '—', cpi ? 'Meta: 1,00' : 'sem IDC no Prevision')}</div>
          <div class="ds-leg"><span><i class="ok"></i>≥ ${fmtNum(F.ok, 2)}</span><span><i class="atencao"></i>${fmtNum(F.atencao, 2)} ≤ índice &lt; ${fmtNum(F.ok, 2)}</span><span><i class="critico"></i>&lt; ${fmtNum(F.atencao, 2)}</span></div>
        </div>
        ${card(`ac-${varFim === null ? 'neutro' : varFim > 0 ? 'critico' : 'escuro'}`, 'Variação término', varFim === null ? '—' : `${varFim > 0 ? '+' : ''}${varFim} ${Math.abs(varFim) === 1 ? 'dia' : 'dias'}`, 'Meta: 0 dias')}
      </div>`;
    const decor = P.total ? Math.max(0, Math.min(1, P.decorrido / P.total)) : null;
    const prazo = `<div class="ds-prazo">
        <div class="ds-pz-l"><div class="ds-pz-d"><span>Início contratual<b>${dBR(P.contrIni)}</b></span><span class="dir">Término contratual<b>${dBR(P.contrFim)}</b></span></div>
          ${decor === null ? '' : `<div class="ds-pz-bar"><i style="width:${(decor * 100).toFixed(1)}%"></i><em style="left:${(decor * 100).toFixed(1)}%">${fmtNum(decor * 100, 0)}%</em></div>`}</div>
        <dl class="ds-pz-r"><dt>Prazo total</dt><dd>${P.total ? `${P.total} dias` : '—'}</dd><dt>A vencer</dt><dd>${P.aVencer !== null && P.aVencer !== undefined ? `${Math.max(0, P.aVencer)} dias` : '—'}</dd></dl>
      </div>`;
    // tabela: a EAP da própria obra — raiz e linhas de nível 2 do cronograma do Prevision, na ordem e com os nomes da EAP,
    // com Base, Previsto e Realizado de cada linha. Sem cronograma, o Progresso por tarefas (nível 2), também na ordem da EAP.
    // Na tela, cada item abre até o pacote executável (a última linha da EAP), como o "Avanço por atividade"; no PDF e
    // na impressão a folha volta ao nível 2 (as linhas abertas saem no onclone de baixarPdf e no CSS de impressão).
    const crono = (o.cronograma && o.cronograma.linhas) || [];
    const raizC = crono.find(l => l.nivel === 1);
    const ordemEap = (a, b) => String(a.eap).split('.').map(Number).reduce((s, v, i) => s || v - (+String(b.eap).split('.')[i] || 0), 0);
    const nos = (crono.length
      ? crono.filter(l => l.nivel >= 2).map(l => ({ eap: l.eap, nivel: l.nivel, nome: l.nome, base: l.base, prev: l.previsto, real: l.realizado }))
      : (o.tarefas || []).filter(t => t.nivel >= 2).map(t => { const p = (t.previsto ?? t.base ?? 0) || null;
        return { eap: t.eap, nivel: t.nivel, nome: t.tarefa, base: null, prev: null, real: p ? (t.realizado || 0) / p : null }; })).sort(ordemEap);
    const filhosDe = x => nos.filter(y => y.nivel === x.nivel + 1 && String(y.eap).startsWith(x.eap + '.'));
    const linhas = [];
    const poe = x => { const f = filhosDe(x), ab = f.length > 0 && !!S.abertos['d' + x.eap]; linhas.push({ ...x, temFilhos: f.length > 0, aberto: ab }); if (ab) f.forEach(poe); };
    nos.filter(x => x.nivel === 2).forEach(poe);
    const densa = nos.filter(x => x.nivel === 2).length > DASH_LINHAS, algumAberto = linhas.some(x => x.nivel > 2);
    const barra = v => v === null || v === undefined ? '<td class="n">—</td>' : `<td class="n"><i style="width:${Math.max(0, Math.min(100, v * 100)).toFixed(1)}%"></i><span>${n2(v)}</span></td>`;
    const delta = (a, b) => { if (a === null || b === null || a === undefined || b === undefined) return '<td class="d">—</td>';
      const d = (a - b) * 100, z = Math.abs(d) < 0.005, up = d >= 0;
      return `<td class="d ${z ? 'z' : up ? 'pos' : 'neg'}"><span class="ds-seta" aria-hidden="true">${up ? '↑' : '↓'}</span>${fmtNum(z ? 0 : d, 2)}</td>`; };
    const nomeLinha = x => x.nivel === undefined ? esc(x.nome)
      : `<span class="ds-nm" style="padding-left:${(x.nivel - 2) * 16}px">${x.temFilhos ? `<button class="ds-tg" data-abre="d${esc(x.eap)}" aria-expanded="${x.aberto}" aria-label="${x.aberto ? 'Recolher' : 'Abrir'} ${esc(x.nome)}">${IC.right}</button>` : '<i class="ds-tg-sp"></i>'}<span>${esc(x.nome)}</span></span>`;
    const lin = (x, cls = '') => `<tr class="${cls}${x.nivel > 2 ? ` ds-sub n${Math.min(x.nivel, 6)}` : ''}"><td class="nm">${nomeLinha(x)}</td>${barra(x.base)}${barra(x.prev)}${barra(x.real)}${delta(x.real, x.base)}${delta(x.real, x.prev)}</tr>`;
    const raiz = raizC ? { nome: raizC.nome, base: raizC.base, prev: raizC.previsto, real: raizC.realizado }
      : { nome: `${o.codigo} - ${(capa && capa.titulo) || o.nome}`, base: r.baseCorte, prev: r.prevCorte, real: r.real };
    const tabela = `<section class="ds-tab${densa ? ' densa' : ''}"><h2>Previsto x Realizado<em>EAP da obra · % de cada item · posição de ${dBR(raizC && o.cronograma.dataRef ? o.cronograma.dataRef : r.corte)}</em></h2>
        <table><thead><tr><th>Nome</th><th>Base (%)</th><th>Previsto (%)</th><th>Realizado (%)</th><th>Δ Base (%)</th><th>Δ Previsto (%)</th></tr></thead>
          <tbody>${lin(raiz, 'obra')}${linhas.map(x => lin(x)).join('')}</tbody></table></section>`;
    return `<article class="folha paisagem dash${algumAberto ? ' aberta' : ''}" aria-label="Dashboard, status geral">
        <header class="ds-cab"><h1>DASHBOARD – STATUS GERAL</h1><div class="cp-machine"><img src="${LOGO}" alt="Machine"><span>Realizações com base sólida</span></div></header>
        <div class="ds-corpo">${cards}${prazo}${tabela}</div>
        <footer class="ds-pe"><span>Obra ${esc(o.codigo)} · ${esc((capa && capa.titulo) || o.nome)}</span><span class="fl-n"></span>${capa && capa.logo ? `<img class="ds-cli" src="${capa.logo}" alt="${esc(o.cliente || 'Cliente')}">` : '<i></i>'}</footer>
      </article>`;
  }

  // ---------- Medições / Faturamento — controle (folhas finais do report) ----------
  // Do Controle de Medição da obra (Alimentar → Controle de Medição; depois, o Sienge): o histórico mês a mês com
  // faturamento direto e medição Machine, os totais do contrato e o boletim da última medição por item da EAP.
  // Colunas sem nenhum valor na planilha da obra não aparecem (cada obra tem o seu formato).
  function folhasMedicao(o, folha) {
    const M = o.medicao; if (!M || !M.resumo) return '';
    const R = M.resumo, meses = R.meses || [], $$v = v => v === null || v === undefined ? '' : moeda(v);
    const COLS = [['previstoCT', 'Previsto (CT)'], ['realizadoCT', 'Realizado (CT)'], ['faturamentoDireto', 'Faturamento direto'], ['medicaoPrevista', 'Medição Machine prevista'], ['medicaoRealizada', 'Medição Machine realizada']]
      .filter(([k]) => meses.some(m => m[k] !== null && m[k] !== undefined));
    const temSt = meses.some(m => m.status);
    const soma = k => meses.reduce((s, m) => s + (m[k] || 0), 0);
    const pctMed = R.totalContrato && R.medidoAcumulado !== null ? R.medidoAcumulado / R.totalContrato : null;
    const cards = [['Valor do contrato', R.totalContrato, R.contrato || ''], ['Medido acumulado', R.medidoAcumulado, pctMed !== null ? pct(pctMed, 1) + ' do contrato' : ''],
      ['Saldo de contrato', R.saldo, pctMed !== null ? pct(1 - pctMed, 1) + ' a medir' : ''], ['Última medição', null, R.ultimaMedicao || '—']]
      .map(([t, v, s]) => `<div class="md-card"><small>${t}</small><b>${v === null ? esc(s) : moeda(v)}</b>${v === null ? '' : `<span>${esc(s)}</span>`}</div>`).join('');
    const hist = meses.length ? `<table class="md-tab"><thead><tr><th>Mês</th>${COLS.map(([, t]) => `<th class="n">${t}</th>`).join('')}${temSt ? '<th>Status</th>' : ''}</tr></thead>
        <tbody>${meses.map(m => `<tr><td>${esc(m.mes)}</td>${COLS.map(([k]) => `<td class="n">${$$v(m[k])}</td>`).join('')}${temSt ? `<td>${esc(m.status || '')}</td>` : ''}</tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td>${COLS.map(([k]) => `<td class="n">${moeda(soma(k))}</td>`).join('')}${temSt ? '<td></td>' : ''}</tr></tfoot></table>` : '<p class="sub">Sem série mensal no Controle de Medição.</p>';
    const out = [folha('Medições / faturamento — controle', `<div class="md-cards">${cards}</div><section class="rx-s rx-box md-box"><h2>Histórico de medição</h2>${hist}</section>`, 'fl-medicao', 'histórico de medição')];
    // boletim da última medição: o de maior número (o contrato principal antes dos aditivos)
    const nBol = b => +((String(b.aba).match(/\d+/) || [0])[0]);
    const bols = [...(M.boletins || [])].sort((a, b) => nBol(a) - nBol(b) || (/aditivo/i.test(a.aba) ? 1 : 0) - (/aditivo/i.test(b.aba) ? 1 : 0));
    const prin = bols.filter(b => !/aditivo/i.test(b.aba)), ult = (prin.length ? prin : bols).at(-1);
    if (ult) {
      const prof = e => String(e).split('.').length, minP = Math.min(...ult.itens.map(i => prof(i.eap)));
      const itens = ult.itens.filter(i => prof(i.eap) <= minP + 1).slice(0, 22);
      const pc = v => v === null || v === undefined ? '' : pct(v, 2);
      const total = ult.itens.filter(i => prof(i.eap) === minP).reduce((s, i) => s + (i.medicao || 0), 0);
      // competência: o mês ligado ao boletim na série ou, sem esse vínculo na planilha, o último mês medido
      const mesBol = meses.find(m => m.boletim && String(m.boletim).replace(/\D/g, '') === String(nBol(ult)))
        || [...meses].reverse().find(m => (m.realizadoCT || m.medicaoRealizada || 0) > 0);
      const tab = `<table class="md-tab md-bol"><thead><tr><th>Referência</th><th>Descrição</th><th class="n">Acum. anterior</th><th class="n">Medida</th><th class="n">% Exe.</th><th class="n">Preço unitário</th><th class="n">Medição</th></tr></thead>
          <tbody>${itens.map(i => `<tr class="${prof(i.eap) === minP ? 'md-n1' : ''}"><td>${esc(i.eap)}</td><td>${esc(i.descricao)}</td><td class="n">${pc(i.acumuladoAnterior)}</td><td class="n">${pc(i.medida)}</td><td class="n">${pc(i.pctExec)}</td><td class="n">${$$v(i.precoUnitario)}</td><td class="n">${$$v(i.medicao)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="6">Total da medição</td><td class="n">${moeda(total)}</td></tr></tfoot></table>`;
      out.push(folha('Medições / faturamento — controle', `<section class="rx-s rx-box md-box"><h2>Resumo de medição<em>Medição ${nBol(ult) || ''}${mesBol ? ` · competência ${esc(mesBol.mes)}` : ''}${R.contrato ? ` · contrato ${esc(R.contrato)}` : ''}</em></h2>${tab}</section>`, 'fl-medicao', 'resumo de medição'));
    }
    return out.join('');
  }

  // ---------- montagem das folhas ----------
  // Depois de desenhadas: (1) frentes do avanço por atividade que não cabem seguem numa folha de continuação, na largura
  // inteira; (2) a coluna lateral da Visão geral perde os últimos itens até caber (o resto fica na aba Obra); (3) os
  // gráficos são desenhados na altura que sobrou no quadro; (4) numera "Página x de y".
  let fontesProntas = false;
  // graf: { id do gráfico: altura => desenha }
  function montaFolhas(graf) {
    const fl = $('#paper.folhas'); if (!fl || fl.dataset.paginado) return;
    // medida só com as fontes finais; quando carregarem, redesenha o report uma vez
    if (!fontesProntas && document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { fontesProntas = true; if (S.view === 'report') render(); });
    else fontesProntas = true;
    let sec = $('[data-bloco="atividades"]', fl);
    // folga no avanço por atividade (obra com poucas etapas, como a 208): abre, na ordem, as etapas que couberem inteiras
    if (sec) {
      const lim = sec.getBoundingClientRect().bottom - 2, box = sec.querySelector('[data-partes-box]');
      const cabe = () => box.lastElementChild.getBoundingClientRect().bottom <= lim;
      // (etapa que a pessoa fechou à mão fica fechada: S.abertos[k] === false)
      if (cabe()) $$(':scope > details[data-parte]:not([open])', box).filter(d => S.abertos[d.dataset.k] === undefined).forEach(d => { d.open = true; if (cabe()) d.dataset.auto = '1'; else d.open = false; });
    }
    // espaço que sobra abaixo do avanço por atividade (todas as etapas couberam): entra a tendência do prazo em dias.
    // Só quando cabe com folga; obra com muitas etapas segue como antes (as etapas têm prioridade sobre o gráfico).
    if (sec && graf.__tend) {
      const box = sec.querySelector('[data-partes-box]'), ult = box && box.lastElementChild;
      const todas = [...sec.querySelectorAll('[data-partes-box] > [data-parte]')].every(p => p.getBoundingClientRect().bottom <= sec.getBoundingClientRect().bottom + 0.5);
      const livre = ult ? sec.getBoundingClientRect().bottom - ult.getBoundingClientRect().bottom - 24 : 0;
      if (todas && livre >= 190) {
        box.insertAdjacentHTML('afterend', '<div class="rx-tend"><h3 class="rx-sub">Prazo · atraso em dias no fim de cada mês</h3><div class="legend rx-leg"><span><i class="sw sw-atr"></i>Atraso</span><span><i class="sw sw-adi"></i>Adiantada</span><span class="note">prazo ganho, contra o cronograma atual</span></div><div class="chart" id="ch-tend-r"></div></div>');
        graf.__tend($('#ch-tend-r', fl), Math.min(240, Math.floor(livre - 56)));
      }
    }
    for (let guarda = 0; sec && guarda < 12; guarda++) {
      const lim = sec.getBoundingClientRect().bottom;
      const partes = [...sec.querySelectorAll('[data-partes-box] > [data-parte]')];
      let k = partes.findIndex(p => p.getBoundingClientRect().bottom > lim + 0.5);
      if (k < 0) break;
      k = Math.max(1, k); if (k >= partes.length) break;
      const folha = sec.closest('.folha'), cont = sec.cloneNode(true);
      [...cont.querySelectorAll('[data-partes-box] > [data-parte]')].slice(0, k).forEach(p => p.remove());
      partes.slice(k).forEach(p => p.remove());
      const h = cont.querySelector('h2'); if (h && !h.querySelector('.fl-cont')) h.insertAdjacentHTML('beforeend', '<em class="fl-cont">continuação</em>');
      const nova = document.createElement('article'); nova.className = folha.className;
      nova.innerHTML = folha.querySelector('.fl-cab').outerHTML + '<div class="fl-corpo"><div class="p-duas so"></div></div>' + folha.querySelector('.fl-pe').outerHTML;
      nova.querySelector('.p-duas').append(cont);
      folha.after(nova); sec = cont;
    }
    $$('[data-ajusta]', fl).forEach(col => {
      for (let guarda = 0; guarda < 20 && col.scrollHeight > col.clientHeight + 1; guarda++) {
        const u = $$('ul[data-corta]', col).filter(x => x.querySelectorAll(':scope > li:not(.fim)').length > 1).pop(); if (!u) break;
        [...u.querySelectorAll(':scope > li:not(.fim)')].pop().remove();
        u.dataset.cortados = (+u.dataset.cortados || 0) + 1;
      }
      // o aviso vai no título da própria lista (h3) ou, sem ele, no título do quadro; é só da tela (fl-int: fora do PDF e da impressão)
      $$('ul[data-cortados]', col).forEach(u => { const t = u.previousElementSibling && u.previousElementSibling.matches('.rx-sub') ? u.previousElementSibling : u.closest('section').querySelector('h2');
        t.insertAdjacentHTML('beforeend', `<em class="fl-int">+${u.dataset.cortados} na aba Obra</em>`); });
    });
    $$('.chart[data-fill]', fl).forEach(el => { if (graf[el.id]) graf[el.id](Math.max(110, Math.floor(el.clientHeight) - 4)); });
    const todas = $$('.folha', fl);
    todas.forEach((f, k) => { const n = f.querySelector('.fl-n'); if (n) n.textContent = `Página ${k + 1} de ${todas.length}`; });
    fl.dataset.paginado = '1';
    ajustaZoomFolhas();
  }
  // Na tela, a folha A4 é reduzida para caber na largura disponível (celular, tela estreita); impressa e no PDF, tamanho real
  function ajustaZoomFolhas() {
    const fl = $('#paper.folhas'); if (!fl) return;
    const disp = fl.clientWidth;
    $$('.folha', fl).forEach(f => { f.style.zoom = ''; const w = f.offsetWidth; f.style.zoom = w > disp ? String(Math.floor(disp / w * 1000) / 1000) : ''; });
  }

  // ---------- mapa de avanço: folhas do report ----------
  const COR_MAPA = { executado: 'ok', executando: 'andamento', 'a-executar': 'pendente' };
  // preenchimento · contorno · opacidade (padrão de mapeamento); vão como atributos do SVG para o PDF sair igual
  const COR_SVG = { executado: ['#22C55E', '#16A34A', 0.36], executando: ['#FACC15', '#CA8A04', 0.42], 'a-executar': ['#EF4444', '#DC2626', 0.32] };
  const ptsSvg = (pts, m) => pts.map(([x, y]) => `${+(x * m.w).toFixed(1)},${+(y * m.h).toFixed(1)}`).join(' ');
  // alças da área selecionada no editor: vértices, meio de cada lado (cria vértice) e giro (acima do topo da área)
  function alcasZona(pts) {
    const P = (x, y) => `left:${x * 100}%;top:${y * 100}%`;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    return pts.map((p, i) => `<b class="mp-h" data-v="${i}" style="${P(p[0], p[1])}" title="Arraste para ajustar · duplo clique remove o ponto"></b>`).join('')
      + pts.map((p, i) => { const q = pts[(i + 1) % pts.length]; return `<b class="mp-hm" data-m="${i}" style="${P((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)}" title="Arraste para criar um ponto"></b>`; }).join('')
      + `<b class="mp-hr" style="left:${(Math.min(...xs) + Math.max(...xs)) / 2 * 100}%;top:calc(${Math.min(...ys) * 100}% - 24px)" title="Arraste para girar (Shift: de 15 em 15°)"></b>`;
  }
  // opts.maxH (px): altura máxima da planta na folha — a largura encolhe junto, para as áreas seguirem a imagem
  // opts.editor: alças da área selecionada (opts.sel) e camada do desenho em andamento
  function plantaHTML(m, opts = {}) {
    const larg = opts.maxH ? `;width:min(100%, ${Math.round(opts.maxH * m.w / m.h)}px)` : '';
    // opts.destaque: ids das áreas do serviço da foto (contorno escuro; as demais ficam mais claras)
    const dest = opts.destaque && opts.destaque.length ? opts.destaque : null;
    const poli = m.zonas.map(z => { const [f, s, a] = COR_SVG[z.st], sel = opts.sel === z.id || (dest && dest.includes(z.id)), apaga = dest && !sel;
      return `<polygon data-zona="${esc(z.id)}"${sel ? ' class="sel"' : ''} points="${ptsSvg(z.pts, m)}" fill="${f}" fill-opacity="${apaga ? a / 2 : a}" stroke="${sel ? '#1A1A1A' : s}" stroke-width="${sel ? 3 : 2}" stroke-opacity="${apaga ? 0.5 : 1}" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`; }).join('');
    const sel = opts.editor && m.zonas.find(z => z.id === opts.sel);
    return `<div class="mp-planta" style="aspect-ratio:${m.w} / ${m.h}${larg}"><img src="${urlImg(m.img)}" alt="Planta: ${esc(m.titulo || 'mapa de avanço')}" width="${m.w}" height="${m.h}">
      <svg class="mp-svg" viewBox="0 0 ${m.w} ${m.h}" preserveAspectRatio="none" aria-hidden="true">${poli}${opts.editor ? '<g class="mp-rasc"></g>' : ''}</svg>
      ${m.zonas.map(z => `<i class="mp-num" data-n="${esc(z.id)}" style="left:${z.cx * 100}%;top:${z.cy * 100}%">${z.n}</i>`).join('')}${sel ? alcasZona(sel.pts) : ''}</div>`;
  }
  const legMapa = m => `<div class="mp-leg">${m.resumo.map(x => `<span><i class="mp-sw ${COR_MAPA[x.k]}"></i>${x.t}${m.zonas.length ? ` <small>${x.n} ${x.n === 1 ? 'área' : 'áreas'} · ${pct(x.area, 0)}</small>` : ''}</span>`).join('')}</div>`;
  // Prazo da frente (início e término planejados, pelas atividades vinculadas às áreas) + o que está em execução agora.
  // Some junto da legenda (que já traz o quantitativo: nº de áreas e % da planta por situação) no quadro da frente.
  function infoPrazoMapa(m) {
    const d = m.datas || {};
    const partes = [];
    if (d.inicio) partes.push(`<span><small>Início</small>${dBR(d.inicio)}</span>`);
    if (d.fimPrevisto) partes.push(`<span><small>Término previsto</small>${dBR(d.fimPrevisto)}</span>`);
    if (d.fimAtual) partes.push(`<span class="neg"><small>Término atual</small>${dBR(d.fimAtual)}</span>`);
    if (m.emExecucao && m.emExecucao.length) partes.push(`<span class="exec"><small>Em execução</small>${esc(m.emExecucao.join(' · '))}</span>`);
    return partes.length ? `<div class="mp-prazo">${partes.join('')}</div>` : '';
  }
  const quadroMapa = m => `<div class="mp-resumo">${infoPrazoMapa(m)}${legMapa(m)}</div>`;
  const tabelaMapa = (m, comp) => m.zonas.length ? `<table class="mp-tab${comp ? ' comp' : ''}"><thead><tr><th>Nº</th><th>Área</th>${comp ? '' : '<th>Atividade</th>'}<th class="n">Avanço</th><th>Situação</th></tr></thead><tbody>
    ${m.zonas.map(z => `<tr><td class="mp-n"><i class="mp-sw ${COR_MAPA[z.st]}"></i>${z.n}</td><td>${esc(z.rotulo || '—')}</td>${comp ? '' : `<td>${z.ativ ? esc(z.ativ.nome) : '<small>situação informada no painel</small>'}</td>`}<td class="n">${z.feito === null ? '—' : pct(z.feito, 0)}</td><td>${Core.MAPA_ST[z.st]}</td></tr>`).join('')}</tbody></table>` : '';
  // folhas do mapa (paisagem, como todo o report): uma planta por folha, com legenda e tabela ao lado (abaixo, se a
  // planta for larga), ou duas plantas por folha — lado a lado, ou uma sobre a outra quando as duas são largas
  function folhasDoMapa(mapas, folha) {
    if (!mapas.length) return '';
    const titulo = m => `<h2 class="mp-tt"><small>Frente de serviço</small>${esc(m.titulo || 'Sem título')}</h2>`;
    const larga = m => m.w / m.h >= 1.6;
    // planta já marcada (sem áreas desenhadas no painel), como no relatório mensal: a planta ocupa a folha e a legenda
    // fica em linha embaixo
    const legLinha = `<div class="mp-leg-h"><span><i class="mp-sw ok"></i>Executado</span><span><i class="mp-sw andamento"></i>Em execução</span><span><i class="mp-sw pendente"></i>A executar</span></div>`;
    const limpa = m => folha('Físico · avanço da frente', `${titulo(m)}<div class="mp-limpa">${plantaHTML(m, { maxH: 520 })}</div>${legLinha}`, 'mp-folha mp-folha-limpa');
    const uma = mapas.filter(m => m.pagina !== 'paisagem').map(m => !m.zonas.length ? limpa(m) : folha('Físico · avanço da frente', larga(m)
      ? `${titulo(m)}<div class="mp-um largo">${plantaHTML(m, { maxH: Math.max(260, 440 - 27 * m.zonas.length) })}<div class="mp-info">${quadroMapa(m)}${tabelaMapa(m, false)}</div></div>`
      : `<div class="mp-um">${plantaHTML(m, { maxH: 600 })}<div class="mp-info">${titulo(m)}${quadroMapa(m)}${tabelaMapa(m, true)}</div></div>`, 'mp-folha'));
    const duas = mapas.filter(m => m.pagina === 'paisagem'), pares = [];
    for (let i = 0; i < duas.length; i += 2) pares.push(duas.slice(i, i + 2));
    const dupla = pares.map(par => { const emp = par.length > 1 && par.every(larga);
      return folha('Físico · avanço da frente', `<div class="mp-dupla${emp ? ' empilha' : ''}">${par.map(m => `<div class="mp-meia">${titulo(m)}${plantaHTML(m, { maxH: emp ? 228 : 540 })}${legMapa(m)}</div>`).join('')}</div>`, 'mp-folha'); });
    return uma.concat(dupla).join('');
  }

  // ---------- render ----------
  function render() {
    calcDoRender.clear();
    const app = $('#app');
    if (S.carregando) { app.innerHTML = viewCarregando(); return; }
    if (!S.user) {
      app.innerHTML = (S.view === 'configurar' ? viewConfigurar() : S.view === 'pedido' ? viewPedido() : viewLoginProd()) + modalHTML();
      bind(); return;
    }
    if (!S.obraId || !DB.obras.some(o => o.id === S.obraId)) S.obraId = obrasDoUsuario()[0]?.id;
    if (!ehAdmin() && ['alimentar', 'acessos', 'nova-obra', 'editar-obra', 'senha', 'github'].includes(S.view)) S.view = 'obra';
    if (ehCliente() && ['manual', 'restricoes'].includes(S.view)) S.view = 'obra';
    if (S.view === 'manual') DB.obras.filter(o => o.fotosPendentes).forEach(carregarFotos);
    const base = DB.obras.find(x => x.id === S.obraId);
    if (base && base.fotosPendentes && ['obra', 'report'].includes(S.view)) carregarFotos(base);
    const v = S.view === 'portfolio' ? viewPortfolio() : S.view === 'obra' ? viewObra() : S.view === 'alimentar' ? viewAlimentar()
      : S.view === 'acessos' ? viewAcessos() : S.view === 'nova-obra' ? viewNovaObra() : S.view === 'editar-obra' ? viewNovaObra(base)
      : S.view === 'senha' ? viewSenha() : S.view === 'github' ? viewGithub() : S.view === 'manual' ? viewManual() : S.view === 'restricoes' ? viewRestricoes() : viewReport();
    app.innerHTML = shell(v) + lightbox() + modalHTML();
    bind(); desenha(); atualizaEndereco();
  }
  // ---------- links diretos ----------
  // O endereço acompanha a tela: #portfolio · #obra-208 · #obra-208/report · #manual. Abrir o link (depois do login, se
  // preciso) leva direto à mesma tela; telas administrativas não entram no endereço.
  const TELAS_LINK = ['portfolio', 'obra', 'report', 'manual', 'restricoes'];
  function hashDaTela() {
    if (!S.user || !TELAS_LINK.includes(S.view)) return null;
    if (S.view === 'portfolio' || S.view === 'manual') return '#' + S.view;
    return S.obraId ? `#obra-${S.obraId}${S.view === 'report' ? '/report' : S.view === 'restricoes' ? '/restricoes' : ''}` : null;
  }
  function atualizaEndereco() {
    const h = hashDaTela();
    // troca de tela entra no histórico (o Voltar do navegador/celular volta à tela anterior); a primeira só marca o endereço
    if (h && location.hash !== h) { try { history[location.hash ? 'pushState' : 'replaceState'](null, '', h); } catch (e) { /* sem histórico: segue sem link */ } }
  }
  function telaDoHash(h, u) {
    const mo = h.match(/obra-([\w-]+)/);
    if (mo && DB.obras.some(o => o.id === mo[1])) S.obraId = mo[1];
    if (!S.obraId || !DB.obras.some(o => o.id === S.obraId)) S.obraId = DB.obras[0]?.id;
    S.view = /report/.test(h) ? 'report' : /restricoes/.test(h) && u.perfil !== 'cliente' ? 'restricoes' : mo ? 'obra' : /manual/.test(h) && u.perfil !== 'cliente' ? 'manual' : /alimentar/.test(h) && ehAdmin() ? 'alimentar'
      : /portfolio/.test(h) && (DB.obras.length > 1 || u.perfil !== 'cliente') ? 'portfolio' : DB.obras.length > 1 || ehAdmin() ? 'portfolio' : 'obra';
  }
  window.addEventListener('hashchange', () => {
    if (!S.user || S.carregando || location.hash === hashDaTela()) return;
    telaDoHash(location.hash || '', S.user); S.mapaEd = null; render(); window.scrollTo(0, 0);
  });
  const linkDaTela = () => location.origin + location.pathname + (hashDaTela() || '');
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
    const o = visaoDaObra(base), r = calcObra(base);
    const el1 = $('#ch-curva'); if (el1 && el1.closest('details').open) Core.chartCurvaS(el1, o, r);
    const el2 = $('#ch-mensal'); if (el2 && el2.closest('details').open) Core.chartMensal(el2, o, r);
    const el3 = $('#ch-efetivo'); if (el3 && r.campo && el3.closest('details').open) Core.chartEfetivo(el3, r.campo);
    const elT = $('#ch-tend'); if (elT && elT.closest('details').open) Core.chartTendencia(elT, r.tendencia);
    const rf = Core.calcFinanceiro(o, r.corte);
    const rFin = rf && rf.pts ? { pts: rf.pts, corte: r.corte, real: rf.evFrac, prevCorte: rf.pvFrac, baseCorte: rf.baseFrac, desvio: (rf.evFrac || 0) - (rf.pvFrac || 0) } : null;
    const el5 = $('#ch-fin'); if (el5 && rFin && el5.closest('details').open) Core.chartCurvaS(el5, o, rFin);
    // report: os gráficos são desenhados na montagem das folhas, já na altura que sobrou no quadro
    if (S.view !== 'report') return;
    const el4 = $('#ch-combo-r'), el6 = $('#ch-fin-r'), el7 = $('#ch-efetivo-r'), graf = {};
    if (el4) graf['ch-combo-r'] = h => Core.chartCombo(el4, o, r, { altura: h });
    if (el6 && rFin) graf['ch-fin-r'] = h => Core.chartCurvaS(el6, o, rFin, { altura: h });
    if (el7 && r.campo) graf['ch-efetivo-r'] = h => Core.chartEfetivo(el7, r.campo, { altura: h });
    if (r.tendencia && r.tendencia.length >= 2) graf.__tend = (el, h) => Core.chartTendencia(el, r.tendencia, { altura: h });
    montaFolhas(graf); ajustaZoomFolhas();
  }

  let tt;
  function toast(msg) {
    let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => { t.hidden = true; }, 3200);
  }

  function bind() {
    const atualiza = () => { if (S.user) DB.obras = API.listar(); };
    $$('[data-go]').forEach(b => b.onclick = () => { atualiza(); S.view = b.dataset.go; S.menu = false; S.loginErro = null; S.loginMsg = null; S.editAcesso = null; render(); window.scrollTo(0, 0); });
    $$('[data-irsec]').forEach(b => b.onclick = () => {
      const id = b.dataset.irsec, d = $(`details.sec[data-sec="${id}"]`); if (!d) return;
      if (!d.open) { d.open = true; S.abertos[id] = true; }
      d.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
    $$('[data-obrares]').forEach(b => b.onclick = () => { atualiza(); S.obraId = b.dataset.obrares; S.resEd = null; S.resPessoa = null; S.view = 'restricoes'; render(); window.scrollTo(0, 0); });
    $$('[data-obra]').forEach(b => b.onclick = () => { atualiza(); if (S.obraId !== b.dataset.obra) S.mapaEd = null; S.obraId = b.dataset.obra; S.view = 'obra'; render(); window.scrollTo(0, 0); });
    $$('[data-toast]').forEach(b => b.onclick = () => toast(b.dataset.toast));
    // manual: o índice rola até o documento; imprimir usa o CSS de impressão das telas (A4 retrato)
    $$('[data-ir]').forEach(b => b.onclick = () => { const el = document.getElementById(b.dataset.ir); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    const mi = $('#man-imprimir'); if (mi) mi.onclick = () => window.print();
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
        async () => {
          const ok = await gravando(sim ? 'Publicando…' : 'Recolhendo…', () => API.publicar(id, sim)); if (!ok) return;
          await recarregar();
          if (!sim) { toast('Publicação recolhida.'); return; }
          toast('Publicado. O cliente verá esta posição em cerca de um minuto.');
          S.modal = { tipo: 'avisar', ...avisoPublicacao(DB.obras.find(x => x.id === id) || o) }; render();
        });
    });
    $$('[data-copialink]').forEach(b => b.onclick = async () => {
      const url = linkDaTela();
      try { await navigator.clipboard.writeText(url); toast('Link copiado. Quem abrir faz login e cai direto nesta tela.'); }
      catch (e) { toast('Copie o endereço: ' + url); }
    });
    const mav = $('#m-avisar'); if (mav) mav.onclick = () => { setTimeout(() => { S.modal = null; render(); }, 300); };

    // ----- restrições -----
    const rso = $('#rs-obra'); if (rso) rso.onchange = () => { S.obraId = rso.value; S.resEd = null; S.resPessoa = null; render(); };
    $$('[data-resfiltro]').forEach(b => b.onclick = () => { S.resFiltro = b.dataset.resfiltro; render(); });
    $$('[data-respessoa]').forEach(b => b.onclick = () => { S.resPessoa = b.dataset.respessoa && S.resPessoa !== b.dataset.respessoa ? b.dataset.respessoa : null; render(); });
    $$('[data-resnova]').forEach(b => b.onclick = () => { S.resEd = { id: null }; render(); const f = $('#rs-frente'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } });
    $$('[data-reseditar]').forEach(b => b.onclick = () => { S.resEd = { id: b.dataset.reseditar }; render(); const f = $('#f-res'); if (f) f.scrollIntoView({ block: 'start' }); });
    $$('[data-resremover]').forEach(b => b.onclick = async () => {
      const id = S.obraId, x = (DB.obras.find(o => o.id === id).restricoes || []).find(r => r.id === b.dataset.resremover); if (!x) return;
      await gravaRestricao('Marcando a restrição como removida…', () => API.salvarRestricao(id, { ...x, status: 'removida', removidaEm: hojeLocal() }), 'Restrição removida.');
    });
    const rst = $('#rs-status'); if (rst) rst.onchange = () => { const f = $('#rs-rem-f'); if (f) f.hidden = rst.value !== 'removida'; };
    const rsc = $('#rs-cancelar'); if (rsc) rsc.onclick = () => { S.resEd = null; render(); };
    const fr = $('#f-res'); if (fr) fr.onsubmit = async e => {
      e.preventDefault();
      const v = id => ($('#' + id) ? $('#' + id).value : '').trim();
      if (!v('rs-frente') && !v('rs-acao')) { toast('Informe a frente ou a ação.'); return; }
      const at = v('rs-ativ'), i = at.indexOf('|');
      const item = { id: S.resEd.id || undefined, frente: v('rs-frente'), tipo: v('rs-tipo'), acao: v('rs-acao'), responsavel: v('rs-resp'),
        dataLimite: v('rs-data') || null, condicao: v('rs-data') ? '' : v('rs-cond'), status: v('rs-status') || 'pendente', obs: v('rs-obs'),
        removidaEm: v('rs-status') === 'removida' ? (v('rs-rem') || hojeLocal()) : null,
        atividade: at ? { linha: +at.slice(0, i), nome: at.slice(i + 1) } : null };
      const novo = !item.id, id = S.obraId;
      const ok = await gravaRestricao('Salvando a restrição…', () => API.salvarRestricao(id, item), novo ? 'Restrição registrada.' : 'Restrição atualizada.');
      if (ok) { S.resEd = null; render(); }
    };
    const rsx = $('#rs-excluir'); if (rsx) rsx.onclick = () => {
      const id = S.obraId, rid = S.resEd && S.resEd.id;
      confirma({ titulo: 'Excluir restrição', texto: 'A restrição sai do mapa e do cálculo do IRR. Para registrar que foi resolvida, use o status <b>Removida</b>.', ok: 'Excluir', perigo: true },
        async () => { const ok = await gravaRestricao('Excluindo…', () => API.excluirRestricao(id, rid), 'Restrição excluída.'); if (ok) { S.resEd = null; render(); } });
    };
    const rsi = $('#rs-importar'), rsa = $('#rs-arq');
    if (rsi && rsa) { rsi.onclick = () => rsa.click(); rsa.onchange = () => { if (rsa.files.length) importarPlanilhaRestricoes(rsa.files[0]); }; }
    $$('[data-resimp]').forEach(b => b.onclick = async () => {
      const imp = S.resImp, id = S.obraId, subst = b.dataset.resimp === 'substituir'; S.modal = null; S.resImp = null; render();
      const r = await gravando('Importando as restrições…', () => API.importarRestricoes(id, imp.itens, subst));
      if (r) { await recarregar(); toast(`Importadas: ${r.novos} novas${r.atualizados ? `, ${r.atualizados} atualizadas` : ''}.`); }
    });
    const rsp = $('#rs-imprimir'); if (rsp) rsp.onclick = () => window.print();
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
    // logo do cliente: reduzida no navegador (PNG até 640×320, mantém a transparência) e guardada no cadastro cifrado
    const lgb = $('#o-logo-bt'), lgi = $('#o-logo'), lgr = $('#o-logo-rm');
    const idForm = () => { const f = $('#f-obra'); return f && f.dataset.novo === '1' ? null : S.obraId; };
    if (lgb) S.logoCli = null; // formulário recém-aberto: começa pela logo gravada
    // (a prévia é trocada no lugar, sem redesenhar a tela, para não perder o que já foi digitado no formulário)
    const prevLogo = src => { const box = $('.cp-logo-ed'); if (!box) return; const el = box.firstElementChild;
      el.outerHTML = src ? `<img src="${src}" alt="Logo do cliente">` : '<span class="sub">sem logo</span>'; const rm = $('#o-logo-rm'); if (rm) rm.hidden = !src; };
    if (lgb && lgi) { lgb.onclick = () => lgi.click(); lgi.onchange = async () => {
      const f = lgi.files[0]; if (!f) return;
      if (f.size > 5e6) { toast('Imagem muito grande (máximo 5 MB).'); return; }
      try { S.logoCli = { id: idForm(), src: await logoReduzida(f) }; prevLogo(S.logoCli.src); } catch (e) { toast('Não consegui ler a imagem: ' + e.message); }
    }; }
    if (lgr) lgr.onclick = () => { S.logoCli = { id: idForm(), src: '' }; prevLogo(''); };
    const fo = $('#f-obra'); if (fo) fo.onsubmit = async e => {
      e.preventDefault();
      const novo = fo.dataset.novo === '1';
      const v = id => ($('#' + id).value || '').trim();
      if (!v('o-codigo') || !v('o-nome')) { toast('Informe código e nome da obra.'); return; }
      const ini = v('o-ini') || null, fim = v('o-fim') || null;
      if (ini && fim && fim < ini) { toast('O fim contratual é anterior ao início.'); return; }
      const dados = { novo, id: novo ? v('o-codigo') : S.obraId, codigo: v('o-codigo'), nome: v('o-nome'), cliente: v('o-cliente'), contratante: v('o-contratante'), cidade: v('o-cidade'),
        contrato: v('o-contrato'), local: v('o-local'), responsavel: v('o-resp'), reportVA: v('o-va'), indicePrazo: v('o-ip'), prazo_inicio: ini, prazo_fim: fim, prazo_dias: ini && fim ? Core.diff(ini, fim) + 1 : null };
      const atual = !novo && (DB.obras.find(x => x.id === S.obraId) || {}).capa || {};
      const lg = S.logoCli && S.logoCli.id === (novo ? null : S.obraId) ? S.logoCli.src : atual.logo || '';
      dados.capa = { titulo: v('o-capa-titulo'), revisao: v('o-capa-rev') || '00', logo: lg };
      const o = await gravando(novo ? 'Cadastrando a obra…' : 'Salvando o cadastro…', () => API.salvarObra(dados));
      if (!o) return;
      S.logoCli = null;
      S.obraId = o.id; S.view = novo ? 'alimentar' : 'obra'; await recarregar();
      toast(novo ? 'Obra cadastrada. Agora envie os arquivos do período.' : 'Cadastro atualizado.');
    };
    $$('details.sec').forEach(d => d.addEventListener('toggle', () => { S.abertos[d.dataset.sec] = d.open; if (d.open) desenha(); }));
    // no report, abrir uma frente muda a altura da folha: redesenha para repaginar. Etapa aberta pelo próprio report
    // (data-auto) e depois fechada à mão fica marcada como fechada (S.abertos[k] = false) e não reabre sozinha.
    $$('details.rx-av-n').forEach(d => d.addEventListener('toggle', () => {
      const k = d.dataset.k;
      if (d.dataset.auto) { if (d.open) return; delete d.dataset.auto; S.abertos[k] = false; if (S.view === 'report') render(); return; }
      if (!!S.abertos[k] === d.open) return;
      S.abertos[k] = d.open; if (S.view === 'report') render();
    }));
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
    // início do mês: tira as fotos de todas as frentes (as plantas ficam) para carregar as do mês novo
    const lf = $('[data-limpafotos]'); if (lf) lf.onclick = () => {
      const base = DB.obras.find(x => x.id === S.obraId); if (!base) return;
      confirma({ titulo: 'Limpar fotos das frentes', texto: 'As fotos escolhidas de todas as frentes saem do rascunho (as plantas continuam). Depois, carregue as fotos do mês novo em Obra → Mapa de avanço.', ok: 'Limpar fotos', perigo: true },
        () => salvarMapas(base, (base.mapas || []).map(m => ({ ...m, fotos: [] }))));
    };
    // mês/ano de referência da capa: grava na carga que o administrador está vendo (rascunho, se houver)
    const rpm = $('#rp-mes'); if (rpm) rpm.onchange = async () => {
      if (!/^\d{4}-\d{2}$/.test(rpm.value)) return;
      const ok = await gravando('Salvando o mês da capa…', () => API.mesReferencia(S.obraId, rpm.value).then(() => true));
      if (ok) { await recarregar(); toast('Mês de referência da capa atualizado.'); }
    };
    $$('[data-fotordo]').forEach(b => b.onclick = () => { const v = b.dataset.fotordo; S.fotoRdo = v === 'todos' ? 'todos' : +v; S.fotosTodas = false; render(); });
    $$('[data-fotostodas]').forEach(b => b.onclick = () => { S.fotosTodas = !S.fotosTodas; render(); });
    $$('[data-lb]').forEach(b => b.onclick = () => { S.lb = +b.dataset.lb; render(); });
    $$('[data-lbx]').forEach(b => b.onclick = () => { S.lb = null; render(); });
    $$('[data-lbnav]').forEach(b => b.onclick = () => { S.lb += +b.dataset.lbnav; render(); });
    $$('[data-estrela]').forEach(b => b.onclick = async () => {
      const o = DB.obras.find(x => x.id === S.obraId); const atual = [...(o.destaques || [])];
      const id = b.dataset.estrela, i = atual.indexOf(id);
      if (i < 0 && atual.length >= Core.LIM_FOTOS) { toast(`O report usa até ${Core.LIM_FOTOS} fotos. Tire uma estrela antes.`); return; }
      const novo = i >= 0 ? atual.filter(x => x !== id) : atual.concat(id);
      const ok = await gravando('Salvando a seleção de fotos…', () => API.destacar(o.id, novo).then(() => true));
      if (!ok) return;
      o.destaques = novo; render();
      toast(i >= 0 ? 'Foto retirada do report.' : `Foto marcada para o report (${novo.length} de ${Core.LIM_FOTOS}).`);
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
    telaDoHash(location.hash || '', u);
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

