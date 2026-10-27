#!/usr/bin/env node
// Compara a API oficial do Prevision com a exportação da MESMA obra, revisão e data (rodar no mesmo dia da exportação).
//   PREVISION_API_TOKEN=... node sync/comparar-api.cjs --obra 198 --dir <pasta com <obra>/fisico e <obra>/financeiro>
// Só depois de diferenças nulas (ou explicadas) preencha api.equivalenciaValidada da obra em sync/obras.json com a data
// e o resultado — até lá, a fonte "api" não grava.
'use strict';
const fs = require('fs');
const path = require('path');
const { carregarXLSX } = require('./lib/ambiente.cjs');
const { lerConjunto, arquivosDaPasta } = require('./lib/leitura.cjs');
const { PrevisionAPI, coletarAPI, comparar } = require('./lib/prevision-api.cjs');

(async () => {
  const a = process.argv.slice(2), arg = k => (a.includes(k) ? a[a.indexOf(k) + 1] : null);
  const cod = arg('--obra'), dir = arg('--dir');
  if (!cod || !dir) throw new Error('Uso: node sync/comparar-api.cjs --obra <código> --dir <pasta>');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'obras.json'), 'utf8'));
  const o = cfg.obras.find(x => x.codigo === cod); if (!o) throw new Error(`Obra ${cod} fora de sync/obras.json.`);
  const id = arg('--projeto') || o.prevision.apiProjectId;
  if (!id) throw new Error('Informe --projeto <id na API> (veja node sync/vinculos.cjs) ou preencha prevision.apiProjectId.');
  const XLSX = await carregarXLSX();
  const api = new PrevisionAPI({ token: process.env.PREVISION_API_TOKEN });
  const persp = (o.exportacao && o.exportacao.fisico && o.exportacao.fisico.perspectiva) || cfg.padroes.exportacao.fisico.perspectiva;
  const out = { obra: cod, projetoApi: id, em: new Date().toISOString() };
  for (const nat of ['fisico', 'financeiro']) {
    const exp = lerConjunto(XLSX, nat, arquivosDaPasta(path.join(dir, cod, nat))).dados;
    const doApi = await coletarAPI(api, id, nat, persp);
    out[nat] = { parametros: doApi.parametros, ultimaMedicaoPrevision: doApi.ultimaMedicaoPrevision, diferencas: comparar(doApi.dados, exp) };
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(`[${e.codigo || 'ERRO'}] ${e.message}`); process.exitCode = 1; });
