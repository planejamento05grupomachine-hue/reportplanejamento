#!/usr/bin/env node
// ============================================================
// Painel de Obras Machine — exporta o report de uma obra em PDF (folhas A4 paisagem, uma página por folha).
// Abre o painel desta pasta num Chromium sem tela, entra com e-mail e senha e imprime o report.
// Os dados ficam cifrados em data/: sem uma conta válida não há o que exportar.
//
// Uso (da pasta do painel):
//   MP_EMAIL=... MP_SENHA=... node tools/gerar.cjs --obra 207 [--saida /mnt/user-data/outputs]
// O PDF mostra o que a conta usada enxerga: conta de cliente → posição publicada;
// administrador/diretoria → rascunho, quando houver.
// Precisa: playwright (o Chromium do ambiente).
// ============================================================
const fs = require('fs');
const path = require('path');
const http = require('http');

const RAIZ = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = { obra: null, saida: '/mnt/user-data/outputs' };
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--obra') opt.obra = args[++i];
  else if (args[i] === '--saida') opt.saida = args[++i];
}
const EMAIL = process.env.MP_EMAIL, SENHA = process.env.MP_SENHA;
if (!opt.obra || !EMAIL || !SENHA) { console.error('Uso: MP_EMAIL=... MP_SENHA=... node tools/gerar.cjs --obra <código> [--saida <pasta>]'); process.exit(1); }

const { chromium } = require(require.resolve('playwright', { paths: [__dirname, process.cwd(), RAIZ, '/opt/npm-tools/node_modules'] }));

const TIPOS = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.json': 'application/json', '.bin': 'application/octet-stream' };
const srv = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(RAIZ, u);
  if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await p.route(/fonts\.(googleapis|gstatic)\.com|api\.github\.com/, r => r.fulfill({ status: 200, body: '', contentType: 'text/css' }));
    const erros = [];
    p.on('pageerror', e => erros.push(e.message));
    await p.goto(`http://127.0.0.1:${srv.address().port}/index.html#report-obra-${opt.obra}`);
    await p.waitForSelector('#f-login', { timeout: 30000 });
    await p.fill('#l-email', EMAIL); await p.fill('#l-senha', SENHA);
    await p.click('#f-login button[type=submit]');
    await p.waitForSelector('#paper, .note-box.err, .card-pad', { timeout: 120000 });
    if (await p.$('.note-box.err')) throw new Error(await p.textContent('.note-box.err'));
    if (!(await p.$('#paper'))) throw new Error(`A obra ${opt.obra} não tem report disponível para esta conta.`);
    await p.waitForFunction(() => ![...document.querySelectorAll('#paper img')].some(i => !i.complete), null, { timeout: 60000 });
    await p.evaluate(() => document.fonts.ready);
    // o report é montado no navegador em folhas A4 paisagem (gráficos no espaço do quadro, continuação, numeração): espera o fim
    await p.waitForTimeout(500);
    await p.waitForSelector('#paper[data-paginado]', { timeout: 30000 });
    const corte = await p.getAttribute('#paper', 'data-corte');
    console.log('Folhas: ' + await p.$$eval('#paper .folha', f => f.length));
    fs.mkdirSync(opt.saida, { recursive: true });
    const arq = path.join(opt.saida, `Report-Obra-${opt.obra}-${corte || new Date().toISOString().slice(0, 10)}.pdf`);
    // cada folha vira uma página do tamanho dela (CSS @page folha / folhaPaisagem, margem zero)
    await p.pdf({ path: arq, printBackground: true, preferCSSPageSize: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    if (erros.length) console.log('Avisos da página:\n' + erros.join('\n'));
    console.log('PDF: ' + arq);
  } catch (e) {
    console.error('Falhou: ' + e.message); process.exitCode = 1;
  } finally { await browser.close(); srv.close(); }
})();
