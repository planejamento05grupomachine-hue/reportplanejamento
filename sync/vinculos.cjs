#!/usr/bin/env node
// Descobre e confere o vínculo entre as obras do painel e os projetos do Prevision. Uso LOCAL: mostra nomes de obras.
//   PAINEL_EMAIL=... PAINEL_SENHA=... [PREVISION_API_TOKEN=...] node sync/vinculos.cjs
// Lê o cofre da cópia local do repositório (data/), a lista de projetos da API (se houver token) e sync/obras.json.
// A correspondência é pelo código da obra no início do nome do projeto ("198 - ...") e confirmada pelos ids;
// nunca só por semelhança de nome. Nada é gravado: o resultado diz o que confirmar ou corrigir em sync/obras.json.
'use strict';
const fs = require('fs');
const path = require('path');
const { RAIZ, configPublica } = require('./lib/ambiente.cjs');
const painel = require('./lib/painel.cjs');
const { PrevisionAPI } = require('./lib/prevision-api.cjs');
const { hashNome } = require('./lib/prevision-export.cjs');

const codigoDoProjeto = nome => (String(nome).match(/^\s*(\d{3,4})\s*-\s/) || [])[1] || null;

(async () => {
  if (process.env.GITHUB_ACTIONS) throw new Error('vinculos.cjs mostra nomes de obras: rode só localmente.');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'obras.json'), 'utf8'));
  const ler = p => { const f = path.join(RAIZ, p); return fs.existsSync(f) ? { bytes: new Uint8Array(fs.readFileSync(f)) } : null; };
  const sessao = await painel.entrar(fs.readFileSync(path.join(RAIZ, 'data', 'acesso.json'), 'utf8'), process.env.PAINEL_EMAIL, process.env.PAINEL_SENHA, configPublica().iteracoes);
  const obras = [];
  for (const id of sessao.obras) {
    const arq = { [painel.P.obra(id)]: ler(painel.P.obra(id)), [painel.P.ras(id)]: ler(painel.P.ras(id)) };
    const { pub, ras } = await painel.lerObra(sessao, arq, id);
    const b = ras || pub; const raiz = (b.tarefas || []).find(t => t.nivel === 1);
    obras.push({ id, codigo: String(b.codigo), nome: b.nome, raiz: raiz ? raiz.tarefa : null, dataCorte: b.dataCorte || null });
  }
  let projetos = null;
  if (process.env.PREVISION_API_TOKEN) projetos = await new PrevisionAPI({ token: process.env.PREVISION_API_TOKEN }).projetos();

  console.log('\nObras do painel × sync/obras.json × API do Prevision\n');
  for (const o of obras) {
    const c = cfg.obras.find(x => x.painelId === o.id);
    const cand = projetos ? projetos.filter(p => codigoDoProjeto(p.name) === o.codigo) : null;
    const linha = [`${o.codigo} · ${o.nome}`, `raiz: ${o.raiz || '— (sem tarefas no painel)'}`, `corte: ${o.dataCorte || '—'}`];
    if (!c) linha.push('NÃO CONFIGURADA em sync/obras.json');
    else linha.push(`config: vínculo ${c.vinculo}, ${c.habilitada ? 'habilitada' : 'desabilitada'}, gantt ${c.prevision.ganttId}, api ${c.prevision.apiProjectId ?? '—'}`);
    if (cand) {
      if (!cand.length) linha.push('API: nenhum projeto com este código');
      else if (cand.length > 1) linha.push(`API: AMBÍGUO (${cand.map(p => `${p.id} "${p.name}"`).join(', ')}) — confirmar à mão`);
      else {
        const p = cand[0]; const confere = c && c.conferenciaNome && c.conferenciaNome.sha256 === hashNome(p.name);
        linha.push(`API: projeto ${p.id} "${p.name}" · nome ${confere ? 'confere com o hash' : 'NÃO confere com o hash da config'}${c && c.prevision.apiProjectId && String(c.prevision.apiProjectId) !== String(p.id) ? ' · id DIFERENTE do configurado' : ''}`);
        if (c && String(p.id) === String(c.prevision.ganttId)) linha.push('API: o id do projeto na API é igual ao id do Gantt na interface');
      }
    }
    console.log('- ' + linha.join('\n    '));
  }
  if (projetos) {
    const sem = projetos.filter(p => !obras.some(o => o.codigo === codigoDoProjeto(p.name)));
    if (sem.length) console.log('\nProjetos do Prevision sem obra no painel (não são importados):\n' + sem.map(p => `- ${p.id} "${p.name}"`).join('\n'));
  } else console.log('\n(sem PREVISION_API_TOKEN: a lista de projetos da API não foi consultada)');
  console.log('\nHash do nome para sync/obras.json: node -e "console.log(require(\'./sync/lib/prevision-export.cjs\').hashNome(process.argv[1]))" "<nome do projeto>"');
})().catch(e => { console.error(`[${e.codigo || 'ERRO'}] ${e.message}`); process.exitCode = 1; });
