// ============================================================
// Parsers — leem os arquivos de planejamento no navegador.
//   Prevision: Curva S (.xls/HTML), Progresso mensal (.xls/HTML),
//              Progresso por tarefas (.xlsx)
//   RDO: PDF compilado do app de diário de obra
// Funciona no navegador (window.Parsers) e no Node (module.exports),
// para testar com os arquivos reais.
// Todos os percentuais saem como fração (0–1).
// ============================================================
(function (root) {
  'use strict';

  // ---------- utilidades ----------
  // Número em pt-BR ou en-US, com ou sem %. "0,0300" → 0.03 · "76.79%" → 0.7679
  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    const pct = s.endsWith('%');
    s = s.replace('%', '').replace(/\s/g, '');
    if (s.includes(',') && s.includes('.')) {
      s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (s.includes(',')) s = s.replace(',', '.');
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    return pct ? n / 100 : n;
  }
  // "31/03/2026" → "2026-03-31"
  function dataISO(s) {
    if (!s) return null;
    const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  // "Mar/2026" → "2026-03"
  function mesISO(s) {
    const m = String(s || '').trim().toLowerCase().match(/^([a-zç]{3})\/(\d{4})/);
    if (!m || !MESES[m[1]]) return null;
    return `${m[2]}-${String(MESES[m[1]]).padStart(2, '0')}`;
  }
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  // ---------- planilhas (SheetJS) ----------
  // raw:true é obrigatório: sem ele o SheetJS lê "0,0300" como 300 e "Mar/2026" como data.
  function lerLinhas(XLSX, buffer) {
    const wb = XLSX.read(buffer, { type: 'array', raw: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: null })
      .filter(r => r.some(c => c !== null && String(c).trim() !== ''));
  }

  // Reconhece o tipo pelo cabeçalho
  function tipoPlanilha(linhas) {
    const h = (linhas[0] || []).map(norm);
    if (h[0] === 'eap' && h.includes('tarefa')) return 'tarefas';
    if (h[0] === 'dia' && h.includes('base') && h.includes('realizado')) return 'curva';
    if (h[0] === 'mes' && h.includes('base') && h.includes('realizado')) return 'mensal';
    if (linhas.slice(0, 4).some(r => { const x = r.map(norm); return x.includes('linha') && x.includes('eap') && x.includes('nome') && x.some(c => c.startsWith('predecessora')); })) return 'cronograma';
    return null;
  }

  // Cronograma do Prevision (Gantt exportado): datas atuais e de base, duração, vínculos,
  // responsáveis e % previsto/realizado/base de cada linha (avanço da própria linha, 0–1).
  // "Linha" é a posição da tarefa na árvore completa; é ela que liga ao Progresso por tarefas,
  // porque o Prevision renumera a EAP quando a árvore muda.
  function parseCronograma(linhas) {
    const ih = linhas.findIndex(r => r.map(norm).includes('linha'));
    const h = linhas[ih].map(norm);
    const ix = k => h.indexOf(k);
    const col = (r, k) => { const i = ix(k); return i >= 0 ? r[i] : null; };
    return linhas.slice(ih + 1).map(r => {
      const eap = String(col(r, 'eap') || '').replace(/"/g, '').trim();
      return {
        linha: num(col(r, 'linha')),
        eap, nivel: eap ? eap.split('.').length : 0,
        nome: String(col(r, 'nome') || '').trim(),
        inicio: dataISO(col(r, 'inicio')), fim: dataISO(col(r, 'fim')),
        duracao: num(String(col(r, 'duracao') || '').replace(/[^\d,.]/g, '')),
        predecessoras: String(col(r, 'predecessoras') || '').trim() || null,
        sucessoras: String(col(r, 'sucessoras') || '').trim() || null,
        inicioBase: dataISO(col(r, 'inicio (base)')), fimBase: dataISO(col(r, 'fim (base)')),
        responsaveis: String(col(r, 'responsaveis') || '').trim() || null,
        previsto: (num(col(r, 'previsto (%)')) ?? 0) / 100,
        realizado: (num(col(r, 'realizado (%)')) ?? 0) / 100,
        base: (num(col(r, 'base (%)')) ?? 0) / 100,
      };
    }).filter(l => l.eap && l.linha);
  }

  function parseCurva(linhas) {
    const h = linhas[0].map(norm);
    const ix = k => h.indexOf(k);
    return linhas.slice(1).map(r => ({
      data: dataISO(r[ix('dia')]),
      base: num(r[ix('base')]),
      previsto: num(r[ix('previsto')]),
      realizado: num(r[ix('realizado')]),
    })).filter(p => p.data);
  }

  function parseMensal(linhas) {
    const h = linhas[0].map(norm);
    const ix = k => h.indexOf(k);
    return linhas.slice(1).map(r => ({
      mes: mesISO(r[ix('mes')]),
      base: num(r[ix('base')]),
      previsto: num(r[ix('previsto')]),
      realizado: num(r[ix('realizado')]),
      idpm: ix('idpm') >= 0 ? num(r[ix('idpm')]) : null,
    })).filter(p => p.mes);
  }

  function parseTarefas(linhas) {
    const h = linhas[0].map(norm);
    const ix = k => h.findIndex(x => x.startsWith(k));
    const out = linhas.slice(1).map(r => {
      const eap = String(r[ix('eap')] || '').trim();
      return {
        eap,
        nivel: eap ? eap.split('.').length : 0,
        tarefa: String(r[ix('tarefa')] || '').trim(),
        inicio: dataISO(r[ix('inicio')]),
        fim: dataISO(r[ix('fim')]),
        base: num(r[ix('base')]),
        previsto: num(r[ix('previsto')]),
        realizado: num(r[ix('realizado')]),
        atrasoPrevision: num(r[ix('atraso')]),
      };
    }).filter(t => t.eap);
    // folha = sem filhos
    const set = new Set(out.map(t => t.eap));
    out.forEach((t, i) => { t.folha = !out.some(o => o.eap.startsWith(t.eap + '.')); t.linha = i + 1; });
    return out;
  }

  // ---------- PDF (pdf.js) ----------
  // Extrai itens de texto com posição, página a página.
  async function pdfItens(pdfjs, buffer) {
    const doc = await pdfjs.getDocument({ data: buffer, disableFontFace: true, isEvalSupported: false }).promise;
    const paginas = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const pg = await doc.getPage(p);
      const tc = await pg.getTextContent();
      paginas.push(tc.items.filter(i => i.str && i.str.trim()).map(i => ({
        x: i.transform[4], y: i.transform[5], w: i.width, s: i.str,
      })));
    }
    paginas.doc = doc; // reaproveitado por pdfFotos, sem abrir o PDF de novo
    return paginas;
  }

  // Fotos dos RDOs: acha onde cada imagem é desenhada na página (matriz de transformação),
  // renderiza a página e recorta cada foto. Só no navegador (precisa de canvas).
  // Ignora imagens pequenas (logos e assinaturas).
  async function pdfFotos(pdfjs, paginas, opts = {}) {
    const doc = paginas.doc;
    const larguraMax = opts.larguraMax || 900, qualidade = opts.qualidade || 0.72, minPt = opts.minPt || 100;
    const OPS = pdfjs.OPS;
    const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
    const out = [];
    const contPorRdo = {};
    for (let p = 1; p <= doc.numPages; p++) {
      const cab = linhasDe(paginas[p - 1]).find(l => RE_CAB.test(l.txt));
      if (!cab) continue;
      const m = cab.txt.match(RE_CAB);
      const rdo = +m[2], data = dataISO(m[1]);
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      const rects = [];
      let ctm = [1, 0, 0, 1, 0, 0];
      const pilha = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i], a = ops.argsArray[i];
        if (fn === OPS.save) pilha.push(ctm);
        else if (fn === OPS.restore) ctm = pilha.pop() || [1, 0, 0, 1, 0, 0];
        else if (fn === OPS.transform) ctm = mul(ctm, a);
        else if (fn === OPS.paintImageXObject || fn === OPS.paintJpegXObject || fn === OPS.paintInlineImageXObject) {
          const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
          const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
          const r = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
          if (r[2] - r[0] >= minPt && r[3] - r[1] >= minPt) rects.push(r);
        }
      }
      if (!rects.length) continue;
      const maiorLado = Math.max(...rects.map(r => r[2] - r[0]));
      const escala = Math.min(4, Math.max(1.5, larguraMax / maiorLado));
      const vp = page.getViewport({ scale: escala });
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      // ordem de leitura: de cima para baixo, da esquerda para a direita
      rects.sort((a, b) => (b[3] - a[3]) > 4 ? 1 : (a[3] - b[3]) > 4 ? -1 : a[0] - b[0]);
      for (const r of rects) {
        const [x0, y0, x1, y1] = vp.convertToViewportRectangle(r);
        const sx = Math.max(0, Math.min(x0, x1)), sy = Math.max(0, Math.min(y0, y1));
        const w = Math.min(cv.width - sx, Math.abs(x1 - x0)), h = Math.min(cv.height - sy, Math.abs(y1 - y0));
        if (w < 20 || h < 20) continue;
        const k = Math.min(1, larguraMax / w);
        const c2 = document.createElement('canvas');
        c2.width = Math.round(w * k); c2.height = Math.round(h * k);
        c2.getContext('2d').drawImage(cv, sx, sy, w, h, 0, 0, c2.width, c2.height);
        contPorRdo[rdo] = (contPorRdo[rdo] || 0) + 1;
        const legenda = legendaDaFoto(paginas[p - 1], r, rects);
        out.push({ rdo, data, idx: contPorRdo[rdo], pagina: p, w: c2.width, h: c2.height, legenda, src: c2.toDataURL('image/jpeg', qualidade) });
      }
      cv.width = cv.height = 0;
      if (opts.progresso) opts.progresso(p, doc.numPages);
    }
    return out;
  }

  // Legenda: texto logo abaixo da foto, dentro da mesma coluna (quando o RDO tem).
  // Formato estruturado ("Empresa: / Serviço: / Galpão: / Acumulado:") ou texto livre.
  const RE_LIXO = /^(Relatório \d{2}\/|_{5,}|Fotos \(\d+\)$|Criado por:|Última modificação:)|Assinatura/;
  function legendaDaFoto(itens, r, todos) {
    const [x0, y0, x1] = r;
    const abaixo = todos.filter(o => o !== r && o[3] <= y0 + 1 && o[0] < x1 && o[2] > x0).map(o => o[3]);
    const limite = Math.max(y0 - 110, ...abaixo);
    const cand = itens.filter(i => { const cx = i.x + i.w / 2; return cx >= x0 - 12 && cx <= x1 + 12 && i.y < y0 - 1 && i.y > limite && i.y > 80; });
    const linhas = linhasDe(cand).map(l => l.txt.replace(/\s*\|\s*/g, ' ').trim()).filter(t => t && !RE_LIXO.test(t));
    if (!linhas.length) return null;
    const txt = linhas.join(' ').replace(/\s+/g, ' ').trim();
    const campo = re => { const m = txt.match(re); return m ? m[1].trim().replace(/[.;,]$/, '') : null; };
    const fim = '(?=\\s*(?:Empresa|Servi[cç]o|Galp[ãa]o|Local|Área(?: de execução)?|Acumulado):|$)';
    const servico = campo(new RegExp('Servi[cç]o:\\s*(.+?)' + fim, 'i'));
    const leg = {
      texto: txt,
      empresa: campo(new RegExp('Empresa:\\s*(.+?)' + fim, 'i')),
      servico: servico || (/:/.test(txt) ? null : txt),
      local: campo(new RegExp('(?:Galp[ãa]o|Local):\\s*(.+?)' + fim, 'i')),
      area: campo(new RegExp('Área(?: de execução)?:\\s*(.+?)' + fim, 'i')),
      acumulado: campo(new RegExp('Acumulado:\\s*(.+?)' + fim, 'i')),
    };
    if (!leg.servico) leg.servico = txt;
    // legenda com código da EAP: '"01.02.03.04.01.13" - Escada hidráulica DAD 60-36'
    const ce = txt.match(/^"([\d.]+)"\s*-\s*(.+)$/);
    if (ce) { leg.eap = ce[1]; leg.servico = ce[2].trim(); }
    return leg;
  }

  // Agrupa itens em linhas (mesmo y), com " | " onde há vão grande entre colunas
  function linhasDe(itens) {
    const rows = [];
    for (const it of itens) {
      const y = Math.round(it.y);
      let r = rows.find(r => Math.abs(r.y - y) <= 2);
      if (!r) { r = { y, itens: [] }; rows.push(r); }
      r.itens.push(it);
    }
    rows.sort((a, b) => b.y - a.y);
    return rows.map(r => {
      r.itens.sort((a, b) => a.x - b.x);
      let txt = '', fim = null;
      for (const it of r.itens) {
        if (fim !== null) txt += (it.x - fim > 8) ? ' | ' : (it.x - fim > 1 ? ' ' : '');
        txt += it.s; fim = it.x + it.w;
      }
      return { y: r.y, x: r.itens[0].x, txt: txt.trim(), itens: r.itens };
    });
  }

  const RE_CAB = /^Relatório (\d{2}\/\d{2}\/\d{4}) n° (\d+)(?: \| (.+))?$/;
  const RE_RODAPE = /(\| Assinatura \| \d+ \/ \d+$)|^_{5,}$|^Assinatura$/;

  // Divide o PDF compilado em RDOs e lê cada um
  function parseRDOs(paginas) {
    const grupos = new Map();
    for (const itens of paginas) {
      const ls = linhasDe(itens);
      const cab = ls.find(l => RE_CAB.test(l.txt));
      if (!cab) continue;
      const m = cab.txt.match(RE_CAB);
      const n = +m[2];
      if (!grupos.has(n)) grupos.set(n, { numero: n, data: dataISO(m[1]), status: (m[3] || '').trim(), paginas: [] });
      grupos.get(n).paginas.push({ itens, linhas: ls });
    }
    return [...grupos.values()].map(lerRDO).sort((a, b) => a.numero - b.numero);
  }

  function lerRDO(g) {
    const r = {
      numero: g.numero, data: g.data,
      status: /aprovad/i.test(g.status) ? 'aprovado' : (g.status ? 'preenchendo' : 'desconhecido'),
      statusTexto: g.status || '',
      contrato: null, obra: null, local: null, contratante: null, responsavel: null,
      prazo: { contratual: null, decorrido: null, vencer: null },
      horario: { entradaSaida: null, intervalo: null, horas: null },
      clima: [], maoDeObra: [], atividades: [], fotos: 0,
      criadoPor: null, modificadoPor: null,
    };
    const todas = g.paginas.flatMap(p => p.linhas.map(l => l.txt)).filter(t => !RE_CAB.test(t) && !RE_RODAPE.test(t));
    const pega = (re, i = 1) => { for (const t of todas) { const m = t.match(re); if (m) return m[i].trim(); } return null; };

    r.contrato = pega(/Contrato \| ([\w\/.-]+)/);
    r.local = pega(/^Local \| (.+?) \| Prazo decorrido/);
    r.contratante = pega(/^Contratante (.+?) \| Responsável/);
    r.responsavel = pega(/Responsável (.+?)\s*\|?\s*Prazo a vencer/);
    r.prazo.contratual = num(pega(/Prazo contratual \| (\d+)/));
    r.prazo.decorrido = num(pega(/Prazo decorrido \| (\d+)/));
    r.prazo.vencer = num(pega(/Prazo a vencer \| (-?\d+)/));
    r.horario.entradaSaida = pega(/^Entrada \/ Saída \| ([\d:]+ - [\d:]+)/);
    r.horario.intervalo = pega(/^Intervalo \| ([\d:]+ - [\d:]+)/);
    // obra: linha logo acima de "Obra | Prazo contratual"
    // duas variações de layout: nome da obra na mesma linha ("Obra | 198 - ... | Prazo contratual") ou na linha de cima
    r.obra = pega(/^Obra \| (.+?) \| Prazo contratual/);
    const iObra = todas.findIndex(t => /^Obra \| Prazo contratual/.test(t));
    if (!r.obra && iObra > 0) r.obra = todas[iObra - 1];
    const iPer = todas.findIndex(t => /^\d{2}\/\d{2}\/\d{4} até \d{2}\/\d{2}\/\d{4}$/.test(t));
    if (iPer >= 0) { const [a, b] = todas[iPer].split(' até '); r.periodo = { inicio: dataISO(a), fim: dataISO(b) }; }
    const horas = todas.find(t => /^\d{2}:\d{2}$/.test(t));
    if (horas) r.horario.horas = horas;
    for (const turno of ['Manhã', 'Tarde', 'Noite']) {
      const t = todas.find(x => new RegExp('\\| ' + turno + ' \\| ').test(x));
      if (t) { const p = t.split(' | '); const i = p.indexOf(turno); r.clima.push({ turno, tempo: p[i + 1] || null, condicao: p[i + 2] || null }); }
    }

    // Mão de obra: grade de células. Lê pela posição dos itens na 1ª página.
    r.maoDeObra = lerMaoDeObra(g.paginas[0]);
    r.equipamentos = lerEquipamentos(g.paginas[0]);

    // Atividades: do título "Atividades (n)" até "Fotos (n)", atravessando páginas
    const iA = todas.findIndex(t => /^Atividades \(\d+\)$/.test(t));
    const iF = todas.findIndex(t => /^Fotos \((\d+)\)$/.test(t));
    if (iF >= 0) r.fotos = +todas[iF].match(/\((\d+)\)/)[1];
    if (iA >= 0) r.atividades = lerAtividades(todas.slice(iA + 1, iF >= 0 ? iF : undefined));

    const cp = todas.find(t => /^Criado por:/.test(t));
    const mp = todas.find(t => /^Última modificação:/.test(t));
    if (cp) r.criadoPor = cp.replace(/^Criado por:\s*/, '');
    if (mp) r.modificadoPor = mp.replace(/^Última modificação:\s*/, '');
    r.efetivo = r.maoDeObra.reduce((s, m) => s + (m.qtd || 0), 0);
    // período contratual: quando o RDO não traz "dd/mm/aaaa até dd/mm/aaaa", sai do prazo decorrido
    if (!r.periodo && r.data && r.prazo.decorrido && r.prazo.contratual) {
      const d = new Date(r.data + 'T12:00:00'); const ini = new Date(d.getTime() - (r.prazo.decorrido - 1) * 864e5);
      const fim = new Date(ini.getTime() + (r.prazo.contratual - 1) * 864e5);
      r.periodo = { inicio: ini.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10), estimado: true };
    }
    return r;
  }

  function lerMaoDeObra(pagina) {
    const ls = pagina.linhas;
    const i0 = ls.findIndex(l => /^Mão de obra \(\d+\)$/.test(l.txt));
    const i1 = ls.findIndex((l, i) => i > i0 && /^(Equipamentos|Atividades) \(\d+\)$/.test(l.txt));
    if (i0 < 0 || i1 < 0) return [];
    const yTop = ls[i0].y, yBot = ls[i1].y;
    const itens = pagina.itens.filter(i => i.y < yTop - 1 && i.y > yBot + 1);
    // Faixas (linhas da grade): separadas pelos totais "(n)" da coluna da direita
    const totais = itens.filter(i => /^\(\d+\)$/.test(i.s.trim())).sort((a, b) => b.y - a.y);
    const rotTot = itens.filter(i => /Mão de Obra Própria|Terceiros/i.test(i.s)).sort((a, b) => b.y - a.y);
    const xTot = totais.length ? Math.min(...totais.map(t => t.x), ...rotTot.map(t => t.x)) - 5 : Infinity;
    const faixas = totais.map((t, k) => ({ y: t.y, tipo: /terceir/i.test((rotTot[k] || {}).s || '') ? 'terceiros' : 'propria' }));
    const out = [];
    const cel = itens.filter(i => i.x < xTot);
    // agrupa por coluna (x do centro)
    const cols = [];
    for (const it of cel) {
      const cx = it.x + it.w / 2;
      let c = cols.find(c => Math.abs(c.cx - cx) < 40);
      if (!c) { c = { cx, itens: [] }; cols.push(c); }
      c.itens.push(it);
    }
    for (const c of cols) {
      // dentro da coluna, separa por faixa: cada número fecha uma célula
      const ord = c.itens.sort((a, b) => b.y - a.y);
      let nome = [];
      for (const it of ord) {
        const s = it.s.trim();
        if (/^\d+$/.test(s)) {
          const fx = faixas.reduce((best, f) => Math.abs(f.y - it.y) < Math.abs(best.y - it.y) ? f : best, faixas[0] || { tipo: 'propria', y: it.y });
          out.push({ funcao: nome.join(' ').replace(/\s+/g, ' ').trim(), qtd: +s, tipo: fx.tipo });
          nome = [];
        } else nome.push(s);
      }
    }
    return out;
  }

  // Bloco "Equipamentos (n)": grade de nome + quantidade, sem totais por faixa
  function lerEquipamentos(pagina) {
    const ls = pagina.linhas;
    const i0 = ls.findIndex(l => /^Equipamentos \(\d+\)$/.test(l.txt));
    const i1 = ls.findIndex((l, i) => i > i0 && /^Atividades \(\d+\)$/.test(l.txt));
    if (i0 < 0 || i1 < 0) return [];
    const itens = pagina.itens.filter(i => i.y < ls[i0].y - 1 && i.y > ls[i1].y + 1);
    const cols = [];
    for (const it of itens) { const cx = it.x + it.w / 2; let c = cols.find(c => Math.abs(c.cx - cx) < 40); if (!c) { c = { cx, itens: [] }; cols.push(c); } c.itens.push(it); }
    const out = [];
    for (const c of cols.sort((a, b) => a.cx - b.cx)) {
      let nome = [];
      for (const it of c.itens.sort((a, b) => b.y - a.y)) { const s = it.s.trim(); if (/^\d+$/.test(s)) { out.push({ nome: nome.join(' ').trim(), qtd: +s }); nome = []; } else nome.push(s); }
    }
    return out.filter(e => e.nome);
  }

  const RE_PCT = /(?:^|\|\s*)(?:\d+\s*\|\s*)?(\d{1,3})%\s*-\s*([^|]+)$/;
  function lerAtividades(linhas) {
    const out = [];
    let cur = null;
    const fecha = () => { if (cur) { cur.descricao = cur.descricao.trim(); out.push(cur); } };
    const RE_EAP = /^"([\d.]+)"\s*-\s*(.+?)(?:\s*\|\s*\d{1,2}:\d{2}\s*até\s*\d{1,2}:\d{2}.*)?$/;
    for (const raw of linhas) {
      const t = raw.trim();
      if (!t) continue;
      // layout com código da EAP: '"01.02.03" - Serviço | 07:00 até 17:00 (10h)' e o % na linha seguinte
      const e = t.match(RE_EAP);
      if (e && !RE_PCT.test(t)) {
        fecha();
        cur = { empresa: null, servico: e[2].trim(), eap: e[1], local: null, area: null, descricao: '', pct: null, situacao: null, motivo: null, acumulado: null, total: null, unidade: null };
        continue;
      }
      const so = t.match(/^(\d{1,3})%\s*-\s*(.+)$/);
      if (so && cur && cur.pct === null) { cur.pct = +so[1] / 100; cur.situacao = so[2].trim(); continue; }
      const m = t.match(RE_PCT);
      if (m) {
        fecha();
        const antes = t.slice(0, t.length - m[0].length).replace(/\|\s*\d+\s*$/, '').trim();
        cur = { empresa: null, servico: null, local: null, area: null, descricao: '', pct: +m[1] / 100,
          situacao: m[2].trim(), motivo: null, acumulado: null, total: null, unidade: null };
        const emp = antes.match(/^Empresa:\s*(.+)$/i);
        if (emp) cur.empresa = emp[1].trim();
        else {
          // formato antigo, texto livre: "Empresa Lajaman - Serviço - Local" ou "FMC - serviço - local"
          cur.descricao = antes;
          const segs = antes.split(/\s+-\s+/);
          let s = segs;
          const e1 = segs[0].match(/^Empresa\s+(.+)$/i);
          if (e1) { cur.empresa = e1[1].trim(); s = segs.slice(1); }
          else if (segs.length > 1 && segs[0].split(' ').length <= 2 && /^[A-Z]/.test(segs[0])) { cur.empresa = segs[0].trim(); s = segs.slice(1); }
          const ult = s.length > 1 ? s[s.length - 1] : '';
          if (/^(banheiro |armaz[ée]m|costa do sau|praia do forte|portaria|itapu)/i.test(ult)) { cur.local = ult.replace(/\.$/, '').trim(); s = s.slice(0, -1); }
          cur.servico = s.join(' - ').trim();
        }
        continue;
      }
      if (!cur) continue;
      let k;
      if ((k = t.match(/^Servi[cç]o:\s*(.+)$/i))) { cur.servico = k[1].trim(); cur.descricao += ' ' + k[1]; }
      else if ((k = t.match(/^(Galpão|Local):\s*(.+)$/i))) cur.local = k[2].trim().replace(/\.$/, '');
      else if ((k = t.match(/^Área(?: de execução)?:\s*(.+)$/i))) cur.area = k[1].trim().replace(/\.$/, '');
      else if ((k = t.match(/^Acumulado:\s*(\d+)\s*de\s*(\d+)\s*(.*)$/i))) { cur.acumulado = +k[1]; cur.total = +k[2]; cur.unidade = k[3].trim() || null; }
      else if ((k = t.match(/^-\s*(.+)$/))) cur.motivo = k[1].trim();
      else if (cur.motivo) cur.motivo += ' ' + t;
      else cur.descricao += ' ' + t;
    }
    fecha();
    out.forEach(a => {
      if (a.motivo) a.motivo = a.motivo.replace(/\s+/g, ' ').replace(/^[^:]{0,60}:\s*/, m => m).trim();
      if (!a.servico) a.servico = a.descricao;
      if (!a.local) { const l = (a.descricao || '').match(/(Armaz[ée]m [A-Za-zÀ-ú ]+|Costa do Sau[ií]pe|Praia do Forte)\.?$/i); if (l) a.local = l[1]; }
    });
    return out;
  }

  const api = { num, dataISO, mesISO, lerLinhas, tipoPlanilha, parseCurva, parseMensal, parseTarefas, parseCronograma, pdfItens, pdfFotos, linhasDe, parseRDOs };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Parsers = api;
})(typeof window !== 'undefined' ? window : globalThis);
