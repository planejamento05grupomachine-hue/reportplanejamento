#!/usr/bin/env node
// ============================================================
// Painel de Obras Machine — atualizar a obra e exportar o report em PDF.
// Roda o próprio painel num Chromium sem tela: usa a tela Alimentar com os
// arquivos enviados, grava os dados novos em js/seed.js (+ fotos em assets/fotos/<obra>/)
// e imprime o report em A4.
//
// Uso (da pasta do painel):
//   node tools/gerar.cjs --obra 207 [--corte AAAA-MM-DD] [--visao cliente|diretoria]
//                        [--saida /mnt/user-data/outputs] [--so-pdf] arquivo1 arquivo2 ...
// Sem arquivos (ou com --so-pdf), só gera o PDF com os dados que já estão no painel.
// Precisa: playwright (o Chromium do ambiente). Bibliotecas do painel vêm de js/vendor.
// ============================================================
const fs = require('fs');
const path = require('path');
const http = require('http');

const RAIZ = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = { obra: null, corte: null, visao: 'cliente', saida: '/mnt/user-data/outputs', soPdf: false, arquivos: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--obra') opt.obra = args[++i];
  else if (a === '--corte') opt.corte = args[++i];
  else if (a === '--visao') opt.visao = args[++i];
  else if (a === '--saida') opt.saida = args[++i];
  else if (a === '--so-pdf') opt.soPdf = true;
  else opt.arquivos.push(path.resolve(a));
}
if (!opt.obra) { console.error('Informe --obra <código>.'); process.exit(1); }
for (const f of opt.arquivos) if (!fs.existsSync(f)) { console.error('Arquivo não encontrado: ' + f); process.exit(1); }

const { chromium } = require(require.resolve('playwright', { paths: [__dirname, process.cwd(), RAIZ] }));

// bibliotecas: js/vendor do painel ou, se não houver, node_modules (npm i xlsx pdfjs-dist)
const LIBS = { 'xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js', 'pdf.min.js': 'pdfjs-dist/build/pdf.min.js', 'pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js' };
function libLocal(f) {
  const v = path.join(RAIZ, 'js/vendor', f);
  if (fs.existsSync(v)) return v;
  return require.resolve(LIBS[f], { paths: [__dirname, process.cwd(), RAIZ] });
}

// servidor estático da pasta do painel
const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  let f = path.join(RAIZ, u);
  if (u === '/index.html' && !fs.existsSync(f)) f = path.join(RAIZ, 'local.html'); // cópia guardada no painel publicado
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

async function novaPagina(browser, perfil, hash) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p.addInitScript(id => { try { localStorage.setItem('mp_user', id); localStorage.setItem('mp_tema', 'light'); } catch (e) {} }, perfil);
  // bibliotecas e fontes sempre locais (o ambiente pode não alcançar CDNs)
  await p.route(/cdnjs\.cloudflare\.com/, r => {
    const u = r.request().url();
    const f = u.includes('xlsx') ? 'xlsx.full.min.js' : u.includes('worker') ? 'pdf.worker.min.js' : 'pdf.min.js';
    r.fulfill({ path: libLocal(f), contentType: 'application/javascript' });
  });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html${hash}`);
  await p.waitForTimeout(600);
  return { p, erros };
}

(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch();
  try {
    // ---------- 1. atualizar dados ----------
    if (opt.arquivos.length && !opt.soPdf) {
      const { p, erros } = await novaPagina(browser, 'adm', `#alimentar-obra-${opt.obra}`);
      const obras = await p.$$eval('#imp-obra option', os => os.map(o => o.value));
      if (!obras.includes(opt.obra)) throw new Error(`Obra ${opt.obra} não existe no painel. Obras: ${obras.join(', ')}`);
      await p.selectOption('#imp-obra', opt.obra);
      await p.setInputFiles('#imp-file', opt.arquivos);
      await p.waitForSelector('#imp-aplicar', { timeout: 180000 });
      const leitura = await p.$$eval('.check', cs => cs.map(c => c.innerText).join('\n'));
      console.log('--- Leitura dos arquivos ---\n' + leitura.replace(/\n([✓!×])\n/g, '\n$1 '));
      if (opt.corte) await p.fill('#imp-corte', opt.corte);
      const corteUsado = await p.inputValue('#imp-corte');
      await p.click('#imp-aplicar');
      await p.waitForTimeout(800);
      const db = await p.evaluate(() => window.MP_EXPORT());
      if (erros.length) console.log('Avisos da página:\n' + erros.join('\n'));
      // fotos novas (data:) viram arquivos em assets/fotos/<obra>/
      const o = db.obras.find(x => x.id === opt.obra);
      // limite de fotos por obra (o artifact aceita até 511 arquivos por versão)
      const { limitarFotos, MAX_FOTOS } = require('./limitar-fotos.cjs');
      const fora = limitarFotos(o, MAX_FOTOS);
      if (fora.length) console.log(`Fotos: ${o.fotos.length} mantidas (limite ${MAX_FOTOS}, rodízio pelos RDOs mais recentes); ${fora.length} deixadas de fora.`);
      const novas = (o.fotos || []).filter(f => String(f.src).startsWith('data:'));
      if (novas.length) {
        const dir = path.join(RAIZ, 'assets/fotos', opt.obra);
        fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
        for (const f of novas) {
          const nome = `r${f.rdo}-${String(f.idx).padStart(2, '0')}.jpg`;
          fs.writeFileSync(path.join(dir, nome), Buffer.from(f.src.split(',')[1], 'base64'));
          f.src = `assets/fotos/${opt.obra}/${nome}`;
        }
        o.destaques = [];
      }
      o.publicadoAte = o.dataCorte;
      fs.writeFileSync(path.join(RAIZ, 'js/seed.js'),
        `// Dados das obras do Painel de Obras Machine, gerados por tools/gerar.cjs em ${new Date().toISOString().slice(0, 10)}.\n` +
        `// Fotos em assets/fotos/<obra>/. Não edite à mão: rode o gerador com os arquivos do período.\nwindow.SEED = ${JSON.stringify(db)};\n`);
      console.log(`Dados da obra ${opt.obra} atualizados (corte ${corteUsado}; ${(o.rdos || []).length} RDOs; ${(o.fotos || []).length} fotos).`);
      await p.close();
    }

    // ---------- 2. PDF ----------
    const perfil = opt.visao === 'diretoria' ? 'dir' : 'cli';
    const { p, erros } = await novaPagina(browser, perfil, `#report-obra-${opt.obra}`);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    const corte = await p.evaluate(() => (document.querySelector('#paper .pm span') || {}).textContent || '');
    const data = (corte.match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join('-') || new Date().toISOString().slice(0, 10);
    await p.emulateMedia({ media: 'print' });
    // zoom automático: o report cabe em uma página A4 (área útil ~733 x 1060 px a 96 dpi)
    const zoom = await p.evaluate(() => {
      const el = document.getElementById('paper'); if (!el) return null;
      el.style.zoom = '1'; const r = el.getBoundingClientRect();
      const z = Math.min(733 / r.width, 1050 / r.height, 0.9);
      el.style.zoom = String(Math.floor(z * 1000) / 1000); return z;
    });
    if (zoom) console.log('Escala do PDF: ' + Math.round(zoom * 100) + '%');
    fs.mkdirSync(opt.saida, { recursive: true });
    const arq = path.join(opt.saida, `Report-Obra-${opt.obra}-${data}${opt.visao === 'diretoria' ? '-diretoria' : ''}.pdf`);
    await p.pdf({ path: arq, format: 'A4', printBackground: true, preferCSSPageSize: true });
    if (erros.length) console.log('Avisos da página:\n' + erros.join('\n'));
    console.log('PDF: ' + arq);
  } catch (e) {
    console.error('Falhou: ' + e.message); process.exitCode = 1;
  } finally {
    await browser.close(); srv.close();
  }
})();
