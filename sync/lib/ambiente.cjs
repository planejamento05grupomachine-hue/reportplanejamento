// Carrega no Node os mesmos módulos que o painel usa no navegador (cofre, parsers, core, carga)
// e a mesma versão do SheetJS que a tela Alimentar baixa do cdnjs, conferida por SHA-256.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const RAIZ = path.resolve(__dirname, '..', '..');
const Cofre = require(path.join(RAIZ, 'js', 'cofre.js'));
const Parsers = require(path.join(RAIZ, 'js', 'parsers.js'));
require(path.join(RAIZ, 'js', 'core.js'));
const Core = globalThis.Core;
const Carga = require(path.join(RAIZ, 'js', 'carga.js'));

// js/app.js carrega exatamente este arquivo (CDN + 'xlsx/0.18.5/xlsx.full.min.js')
const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const XLSX_SHA256 = 'c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99';
const CACHE = process.env.SYNC_CACHE || path.join(RAIZ, 'sync', '.cache');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function carregarXLSX() {
  const arq = path.join(CACHE, 'xlsx-0.18.5.full.min.js');
  if (!fs.existsSync(arq) || sha256(fs.readFileSync(arq)) !== XLSX_SHA256) {
    const r = await fetch(XLSX_URL, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw Object.assign(new Error(`Não consegui baixar o SheetJS (${r.status}).`), { codigo: 'DEPENDENCIA' });
    const bytes = Buffer.from(await r.arrayBuffer());
    if (sha256(bytes) !== XLSX_SHA256) throw Object.assign(new Error('O SheetJS baixado não confere com o SHA-256 esperado.'), { codigo: 'DEPENDENCIA' });
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(arq, bytes);
  }
  return require(arq);
}

// js/config.js é um script de navegador (window.MP_CONFIG): roda isolado para ler repositório e iterações
function configPublica() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(RAIZ, 'js', 'config.js'), 'utf8'), ctx);
  return ctx.window.MP_CONFIG;
}

module.exports = { RAIZ, Cofre, Parsers, Core, Carga, carregarXLSX, configPublica, sha256 };
