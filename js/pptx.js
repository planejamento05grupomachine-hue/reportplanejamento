// ============================================================
// Machine · Painel de Obras — PowerPoint do report (editável).
// Cada folha do report vira um slide montado com objetos nativos do PowerPoint, na mesma posição da tela:
//   textos → caixas de texto (mesma fonte, tamanho, cor e peso) · quadros, faixas e barras → formas
//   tabelas → tabelas · curvas e barras dos gráficos → gráficos do PowerPoint (com os dados, editáveis)
//   áreas do mapa de avanço → formas livres sobre a planta · fotos, plantas e logos → imagens.
// Nada de folha "fotografada": imagem só onde o conteúdo já é imagem.
// Fontes: Barlow e Barlow Semi Condensed (fontes de nuvem do Office: abrem certas sem instalar).
// ============================================================
(function (root) {
  'use strict';
  const LIB = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';
  const W = 11.69, H = 8.27;                 // A4 paisagem, em polegadas
  const COR = { real: '154CB0', plan: '8C99AB', base: 'C3CBD6', grade: 'E4E7EC', eixo: '6B7380', tinta: '1B1E24' };
  const FONTES = ['Barlow Semi Condensed', 'Barlow'];
  const PULA = '.no-print, .fl-int, .ds-tg, .ds-tg-sp, .ds-sub, .tip, .mp-h, .mp-hm, .mp-hr, .mp-rasc';

  // ---------- cores e medidas ----------
  const rgba = s => { const m = String(s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const hex = c => [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const cor = s => { const c = rgba(s); return c && c.a > 0.02 ? c : null; };
  const preench = c => c ? (c.a < 0.98 ? { color: hex(c), transparency: Math.round((1 - c.a) * 100) } : { color: hex(c) }) : null;
  const fonte = fam => { const f = String(fam || '').split(',').map(x => x.trim().replace(/["']/g, '')); return f.find(x => FONTES.includes(x)) || 'Barlow'; };
  const limpa = t => t.replace(/\s+/g, ' ');
  // amostra de cor de legenda: elemento pequeno, sem texto, que não é imagem
  const ehAmostra = c => { if (c.textContent.trim() || /^(IMG|svg|TABLE)$/.test(c.tagName)) return false; const q = c.getBoundingClientRect(); return q.width > 1 && q.width <= 24 && q.height <= 24; };
  const corDe = cs => cor(cs.backgroundColor) || (cs.backgroundImage !== 'none' ? cor((cs.backgroundImage.match(/rgba?\([^)]+\)/) || [])[0]) : null)
    || (cs.boxShadow !== 'none' ? cor(cs.boxShadow) : null) || (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) ? cor(cs.borderTopColor) : null);

  // ---------- séries dos gráficos (mesmas regras dos gráficos da tela) ----------
  const fimDoMes = m => { const [y, mo] = m.split('-').map(Number); return new Date(Date.UTC(y, mo, 0, 12)).toISOString().slice(0, 10); };
  const proxMes = k => { const [y, mo] = k.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };
  const mesesEntre = (a, b) => { const out = []; for (let k = a; k <= b; k = proxMes(k)) out.push(k); return out; };
  const rotulo = (k, mc) => root.Core.mesCurto(k + '-01') + (k === mc ? '*' : '');
  // curva acumulada por fechamento de mês: base e previsto no último ponto do mês; realizado = último valor medido
  // até o fim do mês (a curva diária do Prevision traz 0 nos dias sem medição), e o do corte no mês do corte
  function acumulado(pts, corte, real, meses) {
    const ate = d => { let q = null; for (const p of pts) { if (p.data <= d) q = p; else break; } return q; };
    const medido = pts.filter(p => p.data <= corte && (p.realizado || 0) > 0);
    const medAte = d => { let v = 0; for (const p of medido) { if (p.data > d) break; v = p.realizado; } return v; };
    const mc = corte.slice(0, 7);
    return meses.map(k => { const q = ate(fimDoMes(k)) || pts[0];
      return { k, base: q.base ?? null, prev: q.previsto ?? null, real: k < mc ? medAte(fimDoMes(k)) : k === mc ? real : null }; });
  }
  function serieFisica(o, r) {
    const pts = r.pts, mc = r.corte.slice(0, 7);
    const meses = mesesEntre(pts[0].data.slice(0, 7), [pts.at(-1).data, r.prazo.fimCron].sort().at(-1).slice(0, 7));
    const ac = acumulado(pts, r.corte, r.real, meses);
    const porMes = Object.fromEntries((o.mensal || []).map(d => [d.mes, d]));
    const mes = meses.map(k => { const d = porMes[k] || {}; return { base: d.base ?? null, prev: d.previsto ?? null, real: k > mc ? null : k === mc ? Math.max(0, r.periodo.real) : d.realizado ?? null }; });
    return { cat: meses.map(k => rotulo(k, mc)), ac, mes };
  }
  function serieFinanceira(rf, corte) {
    const pts = rf.pts, mc = corte.slice(0, 7);
    const meses = mesesEntre(pts[0].data.slice(0, 7), pts.at(-1).data.slice(0, 7));
    return { cat: meses.map(k => rotulo(k, mc)), ac: acumulado(pts, corte, rf.evFrac, meses) };
  }

  // ---------- montagem ----------
  async function gerar({ paper, o, r, rf, progresso }) {
    if (!root.PptxGenJS) await new Promise((ok, err) => { const s = document.createElement('script'); s.src = LIB; s.onload = ok; s.onerror = () => err(new Error('PptxGenJS')); document.head.appendChild(s); });
    try { await document.fonts.ready; } catch (e) { /* segue */ }
    const pptx = new root.PptxGenJS();
    pptx.defineLayout({ name: 'A4P', width: W, height: H }); pptx.layout = 'A4P';
    pptx.theme = { headFontFace: 'Barlow Semi Condensed', bodyFontFace: 'Barlow' };
    pptx.company = 'Machine Construtora'; pptx.title = `Report · Obra ${o.codigo}`;
    const folhas = [...paper.querySelectorAll('.folha')];
    // em tamanho real durante a leitura (na tela a folha pode estar reduzida para caber)
    const zooms = folhas.map(f => f.style.zoom); folhas.forEach(f => { f.style.zoom = '1'; });
    const imgCache = new Map();
    const dataURL = async src => {
      if (/^data:/.test(src)) return src;
      if (!imgCache.has(src)) imgCache.set(src, (async () => { const b = await (await fetch(src)).blob(); return await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(b); }); })());
      return imgCache.get(src);
    };
    try {
      for (let i = 0; i < folhas.length; i++) {
        if (progresso) progresso(i + 1, folhas.length);
        await new Slide(pptx, folhas[i], { o, r, rf, dataURL }).montar();
      }
    } finally { folhas.forEach((f, i) => { f.style.zoom = zooms[i]; }); }
    return pptx.write({ outputType: 'blob' });
  }

  class Slide {
    constructor(pptx, folha, ctx) {
      this.pptx = pptx; this.f = folha; this.ctx = ctx; this.s = pptx.addSlide();
      this.R = folha.getBoundingClientRect(); this.k = W / this.R.width;   // polegadas por px
      this.pt = this.k * 72;                                                 // pontos por px
      this.tarefas = [];
    }
    box(rc) { return { x: (rc.left - this.R.left) * this.k, y: (rc.top - this.R.top) * this.k, w: rc.width * this.k, h: rc.height * this.k }; }
    async montar() {
      const fundo = cor(getComputedStyle(this.f).backgroundColor);
      this.s.background = { color: fundo ? hex(fundo) : 'FFFFFF' };
      await this.no(this.f, true);
    }
    visivel(el) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
      const rc = el.getBoundingClientRect();
      if (rc.width <= 0.5 || rc.height <= 0.5) return false;
      // o que a tela corta (quadro com overflow escondido, ou fora da folha) também fica fora do slide
      if (rc.top >= this.R.bottom - 0.5 || rc.left >= this.R.right - 0.5) return false;
      for (let a = el.parentElement; a && a !== this.f; a = a.parentElement) {
        if (getComputedStyle(a).overflow === 'visible') continue;
        const q = a.getBoundingClientRect();
        if (rc.top >= q.bottom - 0.5 || rc.bottom <= q.top + 0.5 || rc.left >= q.right - 0.5 || rc.right <= q.left + 0.5) return false;
      }
      return true;
    }
    // ----- percorre a folha -----
    async no(el, raiz) {
      if (!raiz && (el.matches(PULA) || !this.visivel(el))) return;
      if (el.closest('details:not([open])') && el.tagName !== 'SUMMARY' && !el.matches('details') && !el.closest('summary')) return;
      if (!raiz) this.caixa(el); else this.pseudo(el);
      if (el.matches('.chart')) return this.grafico(el);
      if (el.tagName === 'TABLE') return this.tabela(el);
      if (el.tagName === 'IMG') return this.imagem(el);
      if (el.tagName === 'svg') return this.svg(el);
      if (this.ehTexto(el)) { this.absolutos(el); return this.texto(el); }
      for (const n of el.childNodes) {
        if (n.nodeType === 1) await this.no(n);
        else if (n.nodeType === 3 && n.textContent.trim()) this.textoSolto(n, el);
      }
    }
    // bloco de texto: tem texto e só elementos em linha dentro (texto + negrito/itálico/amostras de cor)
    ehTexto(el) {
      if (!el.textContent.trim()) return false;
      const ok = e => { for (const c of e.children) {
        if (c.matches(PULA)) continue;
        const cs = getComputedStyle(c);
        if (cs.display === 'none') continue;
        if (c.tagName === 'IMG' || c.tagName === 'TABLE' || (c.tagName === 'svg' && c.matches('.mp-svg'))) return false;
        // posicionado: barra/fundo sem texto fica atrás do texto; com texto (número do mapa), é outro bloco
        if (cs.position === 'absolute' || cs.position === 'fixed') { if (c.textContent.trim()) return false; continue; }
        if (ehAmostra(c)) continue;
        if (!/^inline/.test(cs.display) && c.tagName !== 'BR') return false;
        if (!ok(c)) return false;
      } return true; };
      return ok(el);
    }
    // ----- fundos, bordas e faixas (::before) -----
    caixa(el) {
      const cs = getComputedStyle(el), rc = el.getBoundingClientRect(), b = this.box(rc);
      const bg = cor(cs.backgroundColor);
      if (bg && +cs.opacity < 1) bg.a *= +cs.opacity;   // barra translúcida (opacity no elemento) vira transparência no preenchimento
      const bw = ['Top', 'Right', 'Bottom', 'Left'].map(s => parseFloat(cs[`border${s}Width`]) || 0);
      const bc = ['Top', 'Right', 'Bottom', 'Left'].map(s => cs[`border${s}Style`] !== 'none' ? cor(cs[`border${s}Color`]) : null);
      const raio = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, rc.width / 2, rc.height / 2);
      const igual = bw.every(v => v === bw[0]) && bc.every(c => (c && hex(c)) === (bc[0] && hex(bc[0])));
      // contorno interno feito com box-shadow (amostras "planejado" das legendas)
      const sh = cs.boxShadow !== 'none' && /inset/.test(cs.boxShadow) ? cor(cs.boxShadow) : null;
      if (bg || (igual && bw[0] > 0 && bc[0]) || sh) {
        const linha = igual && bw[0] > 0 && bc[0] ? { color: hex(bc[0]), width: Math.max(0.25, bw[0] * this.pt) } : sh ? { color: hex(sh), width: 1 } : { type: 'none' };
        const circ = raio >= Math.min(rc.width, rc.height) / 2 - 0.5 && Math.abs(rc.width - rc.height) < 1;
        this.s.addShape(circ ? this.pptx.ShapeType.ellipse : raio > 0.5 ? this.pptx.ShapeType.roundRect : this.pptx.ShapeType.rect,
          { ...b, fill: preench(bg) || { type: 'none' }, line: linha, ...(raio > 0.5 && !circ ? { rectRadius: raio * this.k } : {}) });
      }
      if (!igual) bw.forEach((w, i) => { if (!w || !bc[i]) return;
        const t = w * this.k, g = i === 0 ? { x: b.x, y: b.y, w: b.w, h: t } : i === 1 ? { x: b.x + b.w - t, y: b.y, w: t, h: b.h } : i === 2 ? { x: b.x, y: b.y + b.h - t, w: b.w, h: t } : { x: b.x, y: b.y, w: t, h: b.h };
        this.s.addShape(this.pptx.ShapeType.rect, { ...g, fill: preench(bc[i]), line: { type: 'none' } }); });
      this.pseudo(el);
    }
    // faixa colorida feita com ::before (cartões do dashboard)
    pseudo(el) {
      const ps = getComputedStyle(el, '::before');
      if (!ps || ps.content === 'none' || ps.position !== 'absolute') return;
      const bg = cor(ps.backgroundColor); if (!bg) return;
      const rc = el.getBoundingClientRect(), px = v => parseFloat(v);
      const l = px(ps.left), t = px(ps.top), w = px(ps.width), h = px(ps.height);
      if ([l, t, w, h].some(isNaN)) return;
      this.s.addShape(this.pptx.ShapeType.rect, { x: (rc.left - this.R.left + l) * this.k, y: (rc.top - this.R.top + t) * this.k, w: w * this.k, h: h * this.k, fill: preench(bg), line: { type: 'none' } });
    }
    // elementos posicionados dentro de um bloco de texto (barras atrás de números etc.)
    absolutos(el) { for (const c of el.querySelectorAll('*')) { const cs = getComputedStyle(c); if ((cs.position === 'absolute') && this.visivel(c) && !c.matches(PULA)) this.caixa(c); } }

    // ----- texto -----
    estilo(el) {
      const cs = getComputedStyle(el);
      const c = cor(cs.color) || { r: 27, g: 30, b: 36, a: 1 };
      const o = { fontFace: fonte(cs.fontFamily), fontSize: Math.max(4, Math.round(parseFloat(cs.fontSize) * this.pt * 2) / 2), color: hex(c), bold: +cs.fontWeight >= 600, italic: cs.fontStyle === 'italic' };
      if (c.a < 0.98) o.transparency = Math.round((1 - c.a) * 100);
      const ls = parseFloat(cs.letterSpacing); if (ls) o.charSpacing = Math.round(ls * this.pt * 10) / 10;
      return o;
    }
    // trechos com o estilo de cada elemento; amostras de cor (sem texto, com fundo) viram um quadradinho colorido
    trechos(el, out = [], tt = null) {
      const csEl = getComputedStyle(el), up = csEl.textTransform === 'uppercase' ? 'u' : csEl.textTransform === 'lowercase' ? 'l' : tt;
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { let t = limpa(n.textContent); if (!t) continue; if (up === 'u') t = t.toUpperCase(); else if (up === 'l') t = t.toLowerCase(); out.push({ text: t, options: this.estilo(el) }); continue; }
        if (n.nodeType !== 1 || n.matches(PULA)) continue;
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.position === 'absolute') continue;
        if (n.tagName === 'BR') { if (out.length) out.at(-1).options = { ...out.at(-1).options, breakLine: true }; continue; }
        if (n.tagName === 'svg') continue;
        if (!n.textContent.trim()) {
          // amostra de cor: quadrado (barra) ou traço (linha)
          // amostra branca com contorno (planejado, "vazado"): quadrado vazado na cor do contorno
          const bg = corDe(cs), q = n.getBoundingClientRect();
          const cont = (cs.boxShadow !== 'none' ? cor(cs.boxShadow) : null) || (cs.borderTopStyle !== 'none' && parseFloat(cs.borderTopWidth) ? cor(cs.borderTopColor) : null);
          const vaz = bg && bg.r > 245 && bg.g > 245 && bg.b > 245 && cont;
          if (bg && q.width > 1) out.push({ text: q.height <= 4 ? '━ ' : vaz ? '□ ' : '■ ', options: { ...this.estilo(el), color: hex(vaz ? cont : bg), bold: false } });
          continue;
        }
        // espaço entre itens em linha com margem (legendas, rótulos, subtítulo ao lado do título)
        const ml = parseFloat(cs.marginLeft) || 0, mr = parseFloat(cs.marginRight) || 0;
        if (ml > 3 && out.length && !/\s$/.test(out.at(-1).text)) out.at(-1).text += '   ';
        this.trechos(n, out, up);
        if (mr > 3 && out.length) out.at(-1).text += ' ';
      }
      return out;
    }
    texto(el) {
      const runs = this.trechos(el);
      // aparas de espaço no começo e no fim do bloco
      while (runs.length && !runs[0].text.trim()) runs.shift();
      while (runs.length && !runs.at(-1).text.trim()) runs.pop();
      if (!runs.length) return;
      runs[0].text = runs[0].text.replace(/^\s+/, ''); runs.at(-1).text = runs.at(-1).text.replace(/\s+$/, '');
      const cs = getComputedStyle(el), rc = el.getBoundingClientRect();
      const pad = ['Top', 'Right', 'Bottom', 'Left'].map(s => (parseFloat(cs[`padding${s}`]) || 0) + (parseFloat(cs[`border${s}Width`]) || 0));
      const b = this.box({ left: rc.left + pad[3], top: rc.top + pad[0], width: Math.max(1, rc.width - pad[1] - pad[3]), height: Math.max(1, rc.height - pad[0] - pad[2]) });
      const fs = parseFloat(cs.fontSize), lh = cs.lineHeight === 'normal' ? fs * 1.2 : parseFloat(cs.lineHeight);
      const umaLinha = b.h / this.k < lh * 1.6;
      // linhas definidas só por <br> (ex.: "Relatório de / acompanhamento"): sem quebra automática
      const nBr = el.querySelectorAll('br').length;
      let soBr = false;
      if (nBr) { const rg = document.createRange(); rg.selectNodeContents(el); const tops = new Set([...rg.getClientRects()].filter(q => q.width > 0.5).map(q => Math.round(q.top))); soBr = tops.size <= nBr + 1; }
      const al = { left: 'left', start: 'left', right: 'right', end: 'right', center: 'center', justify: 'justify' }[cs.textAlign] || 'left';
      this.caixaTexto(runs, b, { align: al, valign: umaLinha ? 'middle' : 'top', lineSpacing: Math.round(lh * this.pt * 10) / 10, nowrap: cs.whiteSpace === 'nowrap' || umaLinha || soBr });
    }
    // texto solto direto num contêiner flex/grid (item anônimo): a posição vem do próprio trecho
    textoSolto(n, pai) {
      const rg = document.createRange(); rg.selectNodeContents(n); const rc = rg.getBoundingClientRect();
      if (rc.width < 0.5) return;
      const t = limpa(n.textContent).trim(); if (!t) return;
      const cs = getComputedStyle(pai);
      this.caixaTexto([{ text: cs.textTransform === 'uppercase' ? t.toUpperCase() : t, options: this.estilo(pai) }], this.box(rc), { align: 'left', valign: 'middle', nowrap: true });
    }
    caixaTexto(runs, b, { align, valign, lineSpacing, nowrap }) {
      // folga de largura: a mesma fonte quebra igual, mas o arredondamento do PowerPoint pode empurrar a última palavra
      const folga = nowrap ? Math.max(0.12, b.w * 0.06) : b.w * 0.015;
      const x = align === 'right' ? b.x - folga : align === 'center' ? b.x - folga / 2 : b.x;
      const op = { x, y: b.y, w: b.w + folga, h: b.h, margin: 0, align, valign, wrap: !nowrap, fit: 'none', paraSpaceBefore: 0, paraSpaceAfter: 0 };
      if (lineSpacing && (!nowrap || runs.some(t => t.options.breakLine))) op.lineSpacing = lineSpacing;
      this.s.addText(runs, op);
    }

    // ----- imagens -----
    async imagem(el) {
      if (!el.currentSrc && !el.src) return;
      const rc = el.getBoundingClientRect(), b = this.box(rc), cs = getComputedStyle(el);
      let data; try { data = await this.ctx.dataURL(el.currentSrc || el.src); } catch (e) { return; }
      const nw = el.naturalWidth || rc.width, nh = el.naturalHeight || rc.height;
      if (cs.objectFit === 'contain') { const p = nw / nh; let w = b.w, h = w / p; if (h > b.h) { h = b.h; w = h * p; } this.s.addImage({ data, x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h }); }
      else if (cs.objectFit === 'cover') this.s.addImage({ data, ...b, sizing: { type: 'cover', w: b.w, h: b.h } });
      else this.s.addImage({ data, ...b });
    }
    // ----- SVG: áreas do mapa de avanço viram formas livres; ícones decorativos ficam de fora -----
    svg(el) {
      if (!el.matches('.mp-svg')) return;
      const rc = el.getBoundingClientRect(), vb = el.viewBox.baseVal;
      const sx = rc.width / vb.width, sy = rc.height / vb.height;
      for (const pg of el.querySelectorAll('polygon')) {
        const ps = pg.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number)).map(([x, y]) => [rc.left - this.R.left + x * sx, rc.top - this.R.top + y * sy]);
        const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
        const fill = pg.getAttribute('fill'), fo = +(pg.getAttribute('fill-opacity') || 1), st = pg.getAttribute('stroke'), so = +(pg.getAttribute('stroke-opacity') || 1);
        this.s.addShape(this.pptx.ShapeType.custGeom, {
          x: x0 * this.k, y: y0 * this.k, w: Math.max(0.01, (x1 - x0) * this.k), h: Math.max(0.01, (y1 - y0) * this.k),
          points: [...ps.map(([x, y]) => ({ x: (x - x0) * this.k, y: (y - y0) * this.k })), { close: true }],
          fill: { color: fill.replace('#', '').toUpperCase(), transparency: Math.round((1 - fo) * 100) },
          line: { color: st.replace('#', '').toUpperCase(), width: (+pg.getAttribute('stroke-width') || 2) * 0.75, transparency: Math.round((1 - so) * 100) } });
      }
    }

    // ----- tabelas -----
    tabela(el) {
      const linhas = [...el.rows].filter(tr => this.visivel(tr) && !tr.matches(PULA));
      if (!linhas.length) return;
      const trc = el.getBoundingClientRect();
      // colunas: as bordas de todas as células (vale para colspan)
      const bordas = [trc.left, trc.right];
      linhas.forEach(tr => [...tr.cells].forEach(c => { const q = c.getBoundingClientRect(); bordas.push(q.left, q.right); }));
      const xs = []; bordas.sort((a, b) => a - b).forEach(v => { if (!xs.length || v - xs.at(-1) > 1.5) xs.push(v); });
      const col = v => xs.reduce((m, x, i) => Math.abs(x - v) < Math.abs(xs[m] - v) ? i : m, 0);
      const colW = xs.slice(1).map((x, i) => (x - xs[i]) * this.k);
      // fundo das células e barras dentro delas: formas atrás da tabela (a tabela fica sem preenchimento)
      linhas.forEach(tr => {
        const ftr = cor(getComputedStyle(tr).backgroundColor), fsec = cor(getComputedStyle(tr.parentElement).backgroundColor);
        [...tr.cells].forEach(c => {
          const bg = cor(getComputedStyle(c).backgroundColor) || ftr || fsec;
          if (bg) this.s.addShape(this.pptx.ShapeType.rect, { ...this.box(c.getBoundingClientRect()), fill: preench(bg), line: { type: 'none' } });
          this.absolutos(c);
        });
      });
      const borda = (cs, s) => { const w = parseFloat(cs[`border${s}Width`]) || 0, c = cs[`border${s}Style`] !== 'none' ? cor(cs[`border${s}Color`]) : null; return w && c ? { type: 'solid', pt: Math.max(0.25, Math.round(w * this.pt * 4) / 4), color: hex(c) } : { type: 'none' }; };
      const rows = linhas.map(tr => [...tr.cells].filter(c => this.visivel(c)).map(c => {
        const cs = getComputedStyle(c), q = c.getBoundingClientRect();
        const runs = this.trechos(c); while (runs.length && !runs[0].text.trim()) runs.shift(); while (runs.length && !runs.at(-1).text.trim()) runs.pop();
        if (runs.length) { runs[0].text = runs[0].text.replace(/^\s+/, ''); runs.at(-1).text = runs.at(-1).text.replace(/\s+$/, ''); }
        const al = { left: 'left', start: 'left', right: 'right', end: 'right', center: 'center' }[cs.textAlign] || 'left';
        // margens laterais da célula; em cima e embaixo quase nada: a altura da linha já vem da tela (rowH), e a margem
        // somada à altura da fonte faria o PowerPoint esticar as linhas (o boletim passava do fim do slide).
        // (no PptxGenJS a margem é em pontos quando a de cima é ≥ 1)
        const pad = ['Top', 'Right', 'Bottom', 'Left'].map(s => Math.round((parseFloat(cs[`padding${s}`]) || 0) * this.pt));
        const est = this.estilo(c);
        return { text: runs.length ? runs : [{ text: '', options: est }], options: {
          colspan: Math.max(1, col(q.right) - col(q.left)), rowspan: c.rowSpan > 1 ? c.rowSpan : undefined,
          align: al, valign: 'middle', margin: [1, Math.max(1, pad[1]), 0, Math.max(1, pad[3])], lineSpacing: Math.round(est.fontSize * 1.15 * 10) / 10,
          border: ['Top', 'Right', 'Bottom', 'Left'].map(s => borda(cs, s)), ...est } };
      }));
      this.s.addTable(rows, { ...this.box(trc), colW, rowH: linhas.map(tr => tr.getBoundingClientRect().height * this.k), autoPage: false, fontFace: 'Barlow' });
    }

    // ----- gráficos nativos -----
    grafico(el) {
      const b = this.box(el.getBoundingClientRect()), { o, r, rf } = this.ctx;
      const eixo = { catAxisLabelFontFace: 'Barlow', valAxisLabelFontFace: 'Barlow', catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, catAxisLabelColor: COR.eixo, valAxisLabelColor: COR.eixo,
        catAxisLineShow: true, catAxisLineColor: COR.grade, valAxisLineShow: false, valGridLine: { color: COR.grade, size: 0.5 }, catGridLine: { style: 'none' }, showLegend: false, plotArea: { fill: { color: 'FFFFFF', transparency: 100 } } };
      const linha = (nome, cat, vals, cor, extra = {}) => ({ type: this.pptx.ChartType.line, data: [{ name: nome, labels: cat, values: vals }],
        options: { chartColors: [cor], lineSize: 2, lineDataSymbol: 'none', ...extra } });
      const rotReal = { showValue: true, dataLabelFormatCode: '0.0%', dataLabelPosition: 't', dataLabelFontFace: 'Barlow', dataLabelFontSize: 7.5, dataLabelFontBold: true, dataLabelColor: COR.real, lineDataSymbol: 'circle', lineDataSymbolSize: 5, lineSize: 2.5 };
      if (el.id === 'ch-combo-r') {
        const S = serieFisica(o, r), hTop = b.h * 0.66;
        this.s.addChart([
          linha('Base', S.cat, S.ac.map(x => x.base), COR.base, { lineDash: 'dash', lineSize: 1.5 }),
          linha('Previsto', S.cat, S.ac.map(x => x.prev), COR.plan),
          linha('Realizado', S.cat, S.ac.map(x => x.real), COR.real, rotReal),
        ], { x: b.x, y: b.y, w: b.w, h: hTop, ...eixo, catAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: '0%', displayBlanksAs: 'gap' });
        this.s.addChart(this.pptx.ChartType.bar, [
          { name: 'Base (mês)', labels: S.cat, values: S.mes.map(x => x.base) },
          { name: 'Previsto (mês)', labels: S.cat, values: S.mes.map(x => x.prev) },
          { name: 'Realizado (mês)', labels: S.cat, values: S.mes.map(x => x.real) },
        ], { x: b.x, y: b.y + hTop, w: b.w, h: b.h - hTop, ...eixo, barDir: 'col', barGrouping: 'clustered', barGapWidthPct: 60, chartColors: [COR.base, 'FFFFFF', COR.real], dataBorder: { pt: 0.75, color: COR.plan },
          valAxisMinVal: 0, valAxisLabelFormatCode: '0%', displayBlanksAs: 'gap' });
        return;
      }
      if (el.id === 'ch-fin-r' && rf && rf.pts) {
        const S = serieFinanceira(rf, r.corte);
        this.s.addChart([
          linha('Base', S.cat, S.ac.map(x => x.base), COR.base, { lineDash: 'dash', lineSize: 1.5 }),
          linha('Planejado (PV)', S.cat, S.ac.map(x => x.prev), COR.plan),
          linha('Realizado (EV)', S.cat, S.ac.map(x => x.real), COR.real, rotReal),
        ], { ...b, ...eixo, valAxisMinVal: 0, valAxisMaxVal: 1, valAxisMajorUnit: 0.25, valAxisLabelFormatCode: '0%', displayBlanksAs: 'gap' });
      }
    }
  }

  root.ReportPptx = { gerar, serieFisica, serieFinanceira };
})(window);
