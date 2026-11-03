#!/usr/bin/env node
// ============================================================
// Fontes externas do painel (Sienge e Diário de Obra) — conexão e diagnóstico, SOMENTE LEITURA.
//
//   node sync/fontes-externas.cjs --verificar     conecta em cada fonte configurada e diz se a credencial funciona
//   node sync/fontes-externas.cjs --explorar      lista as obras de cada sistema com o código achado no nome, propõe o
//                                                 vínculo com sync/obras.json, testa cada recurso que a automação vai
//                                                 ler e mostra a ESTRUTURA das respostas (nomes de campos, sem valores)
//   --detalhar                                    (só no seu terminal) mostra também os nomes das obras
//
// Variáveis: SIENGE_SUBDOMINIO, SIENGE_USUARIO, SIENGE_SENHA · DIARIO_TOKEN. Fonte sem variável = "não configurada".
// O log do GitHub Actions é público: lá o --detalhar é ignorado e nenhum valor é impresso.
// Códigos de saída: 0 = ok (ou nada configurado) · 2 = credencial/permissão precisa de atenção · 1 = erro inesperado.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const sienge = require('./lib/sienge.cjs');
const diario = require('./lib/diario-obra.cjs');
const { esqueleto, codigoNoNome } = require('./lib/somente-leitura.cjs');

const args = process.argv.slice(2);
const explorar = args.includes('--explorar');
const detalhar = args.includes('--detalhar') && !process.env.GITHUB_ACTIONS;
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'obras.json'), 'utf8'));
const codigosPainel = new Set(config.obras.map(o => String(o.codigo)));
const linha = (...p) => console.log(p.join(' '));
const nomeDe = o => o && (o.nome || o.name || o.descricao || o.description || o.nomeObra || o.titulo || '');
const idDe = o => o && (o._id || o.id || o.codigo || o.code || o.enterpriseId || o.buildingId);
const esq = v => JSON.stringify(esqueleto(v));
let atencao = false;

async function cada(rotulo, fn) {
  try { await fn(); }
  catch (e) {
    if (/^(CREDENCIAL|PERMISSAO|CONFIG)_/.test(e.codigo || '')) atencao = true;
    linha(`  ✖ ${rotulo}: ${e.codigo || 'ERRO'} — ${e.message}`);
  }
}

async function verSienge() {
  linha('\nSienge');
  let api;
  try { api = sienge.deAmbiente(); } catch (e) { atencao = true; return linha(`  ✖ ${e.codigo}: ${e.message}`); }
  if (!api) return linha('  — não configurado (SIENGE_SUBDOMINIO, SIENGE_USUARIO, SIENGE_SENHA)');
  let obras = [];
  await cada('conexão', async () => {
    const r = await api.get('v1/enterprises', { limit: explorar ? 200 : 1, offset: 0 });
    obras = Array.isArray(r) ? r : (r && r.results) || [];
    linha(`  ✔ conexão e credencial ok (${r && r.resultSetMetadata ? r.resultSetMetadata.count : obras.length} obras/empreendimentos)`);
  });
  if (!explorar) return;
  if (obras.length) {
    linha('  Obras no Sienge (id · código no nome · no painel?):');
    obras.forEach(o => { const c = codigoNoNome(nomeDe(o)); linha(`    ${idDe(o)} · ${c || '—'} · ${c && codigosPainel.has(c) ? 'SIM' : 'não'}${detalhar ? ' · ' + nomeDe(o) : ''}`); });
    linha('  Estrutura de uma obra:', esq(obras[0]));
  }
  const exemplo = obras.find(o => codigosPainel.has(codigoNoNome(nomeDe(o)) || ''));
  linha('  Recursos que a automação vai ler:');
  for (const r of sienge.RECURSOS) {
    if (r.porObra && !exemplo) { linha(`    · ${r.id}: (precisa de uma obra vinculada)`); continue; }
    const caminho = r.caminho.replace('{obra}', exemplo ? idDe(exemplo) : '');
    try {
      const resp = await api.get(caminho, { limit: 1, offset: 0 });
      const item = Array.isArray(resp) ? resp[0] : resp && resp.results ? resp.results[0] : resp;
      linha(`    ✔ ${r.id} (${r.caminho}) — ${r.uso}`);
      if (item) linha(`      estrutura: ${esq(item)}`);
    } catch (e) {
      if (e.status === 403 || e.status === 401) atencao = true;
      linha(`    ${e.status === 400 ? '◐' : '✖'} ${r.id} (${r.caminho}) — ${e.status === 400 ? 'responde, mas exige parâmetros' + (r.exige ? ` (${r.exige})` : '') : e.codigo}`);
    }
  }
}

async function verDiario() {
  linha('\nDiário de Obra');
  const api = diario.deAmbiente();
  if (!api) return linha('  — não configurado (DIARIO_TOKEN)');
  let obras = [];
  await cada('conexão', async () => { obras = diario.lista(await api.obras()); linha(`  ✔ conexão e token ok (${obras.length} obras)`); });
  if (!explorar || !obras.length) return;
  linha('  Obras no Diário de Obra (id · código no nome · no painel?):');
  obras.forEach(o => { const c = codigoNoNome(nomeDe(o)); linha(`    ${idDe(o)} · ${c || '—'} · ${c && codigosPainel.has(c) ? 'SIM' : 'não'}${detalhar ? ' · ' + nomeDe(o) : ''}`); });
  linha('  Estrutura de uma obra:', esq(obras[0]));
  const ex = obras.find(o => codigosPainel.has(codigoNoNome(nomeDe(o)) || '')) || obras[0];
  await cada('relatórios', async () => {
    const rel = diario.lista(await api.relatorios(idDe(ex), { limite: 2, ordem: 'desc' }));
    linha(`  ✔ relatórios da obra ${idDe(ex)}: ${rel.length} lidos (limite 2)`);
    if (rel[0]) {
      linha('  Estrutura da lista de relatórios:', esq(rel[0]));
      const det = await api.relatorio(idDe(ex), idDe(rel[0]));
      linha('  Estrutura de um relatório completo (RDO):', esq(det));
    }
  });
}

(async () => {
  if (!args.includes('--verificar') && !explorar) { linha('Use --verificar ou --explorar (ver o cabeçalho do arquivo).'); process.exitCode = 1; return; }
  linha(`Fontes externas · ${explorar ? 'diagnóstico' : 'verificação'} · somente leitura${detalhar ? ' · com nomes (só neste terminal)' : ''}`);
  await verSienge();
  await verDiario();
  if (atencao) { linha('\nAlguma credencial ou permissão precisa de atenção (ver acima).'); process.exitCode = 2; }
})().catch(e => { console.error(`Erro inesperado: ${e.message}`); process.exitCode = 1; });
