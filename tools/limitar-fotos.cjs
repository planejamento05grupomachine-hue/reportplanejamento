#!/usr/bin/env node
// ============================================================
// Painel de Obras Machine — limite de fotos por obra.
// O artifact publicado aceita no máximo 511 arquivos por versão; por isso cada obra
// guarda até MAX_FOTOS fotos. Escolha: rodízio pelos RDOs mais recentes primeiro
// (1ª foto de cada RDO, depois a 2ª, ...), sempre mantendo as fotos marcadas com ★.
// Assim todos os dias do período continuam representados e o report (que usa a
// 1ª foto dos RDOs mais recentes) não muda.
//
// Uso standalone (da pasta do painel): node tools/limitar-fotos.cjs [--max 60]
//   → aplica o limite em todas as obras de js/seed.js, regrava o seed e lista
//     as fotos removidas (para tirar do artifact na publicação).
// ============================================================
const MAX_FOTOS = 60;

function limitarFotos(obra, max = MAX_FOTOS) {
  const fotos = obra.fotos || [];
  if (fotos.length <= max) return [];
  const fixas = new Set(obra.destaques || []);
  const porRdo = new Map();
  for (const f of fotos) { if (!porRdo.has(f.rdo)) porRdo.set(f.rdo, []); porRdo.get(f.rdo).push(f); }
  const rdos = [...porRdo.keys()].sort((a, b) => {
    const da = porRdo.get(a)[0].data || '', db = porRdo.get(b)[0].data || '';
    return da < db ? 1 : da > db ? -1 : b - a;
  });
  for (const r of rdos) porRdo.get(r).sort((a, b) => a.idx - b.idx);
  const fica = new Set(fotos.filter(f => fixas.has(f.src)));
  for (let k = 0; fica.size < max; k++) {
    let algum = false;
    for (const r of rdos) {
      const f = porRdo.get(r)[k]; if (!f) continue; algum = true;
      if (fica.size >= max) break; fica.add(f);
    }
    if (!algum) break;
  }
  obra.fotos = fotos.filter(f => fica.has(f));
  return fotos.filter(f => !fica.has(f));
}

module.exports = { limitarFotos, MAX_FOTOS };

if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const RAIZ = path.resolve(__dirname, '..');
  const i = process.argv.indexOf('--max'); const max = i > 0 ? +process.argv[i + 1] : MAX_FOTOS;
  const arq = path.join(RAIZ, 'js/seed.js');
  const txt = fs.readFileSync(arq, 'utf8');
  const cab = txt.split('\n').filter(l => l.startsWith('//')).join('\n');
  const w = {}; new Function('window', txt)(w);
  const removidas = [];
  for (const o of w.SEED.obras) {
    const fora = limitarFotos(o, max);
    removidas.push(...fora.map(f => f.src));
    console.log(`Obra ${o.id}: ${(o.fotos || []).length} fotos mantidas, ${fora.length} removidas.`);
  }
  fs.writeFileSync(arq, `${cab}\nwindow.SEED = ${JSON.stringify(w.SEED)};\n`);
  fs.writeFileSync(path.join(RAIZ, 'tools/fotos-removidas.json'), JSON.stringify(removidas, null, 1));
  for (const s of removidas) { const f = path.join(RAIZ, s); if (fs.existsSync(f)) fs.unlinkSync(f); }
  console.log(`Total removido: ${removidas.length} (lista em tools/fotos-removidas.json).`);
}
