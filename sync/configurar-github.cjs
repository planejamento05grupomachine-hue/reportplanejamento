#!/usr/bin/env node
// ============================================================
// Configuração da rotina no GitHub Actions, sem abrir as telas do GitHub.
//
//   node sync/configurar-github.cjs --estado     variáveis da rotina e NOMES dos segredos cadastrados (nunca valores)
//   node sync/configurar-github.cjs --ativar     SYNC_ATIVO = true (liga a execução de sexta 14:00 e o aviso de sessão)
//   node sync/configurar-github.cjs --desativar  SYNC_ATIVO = false
//   node sync/configurar-github.cjs --aviso      dispara agora o "Aviso da sessão do Prevision" (confere a sessão do GitHub)
//
// Token: o mesmo do `sessao.cjs --enviar` — variável PAINEL_SEGREDOS_TOKEN ou arquivo ~/.painel-sync/github-segredos.token.
// Fine-grained, só este repositório, com: Secrets (Read and write), Variables (Read and write), Actions (Read and write).
// ============================================================
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { configPublica } = require('./lib/ambiente.cjs');

const ESPERADOS = ['PAINEL_GH_TOKEN', 'PAINEL_EMAIL', 'PAINEL_SENHA', 'PREVISION_SESSAO', 'PREVISION_API_TOKEN', 'SIENGE_SUBDOMINIO', 'SIENGE_USUARIO', 'SIENGE_SENHA', 'DIARIO_TOKEN'];
const token = () => {
  if (process.env.PAINEL_SEGREDOS_TOKEN) return process.env.PAINEL_SEGREDOS_TOKEN.trim();
  const arq = path.join(os.homedir(), '.painel-sync', 'github-segredos.token');
  if (!fs.existsSync(arq)) throw new Error(`Falta o token: crie ${arq} (ver o cabeçalho deste arquivo).`);
  return fs.readFileSync(arq, 'utf8').trim();
};

async function main() {
  const a = process.argv.slice(2), gh = configPublica().github;
  const base = `https://api.github.com/repos/${gh.owner}/${gh.repo}/actions`;
  const h = { Authorization: 'Bearer ' + token(), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'painel-sync-config' };
  const req = async (metodo, caminho, corpo) => {
    const r = await fetch(base + caminho, { method: metodo, headers: { ...h, ...(corpo ? { 'Content-Type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined });
    if (r.status === 401) throw new Error('Token recusado pelo GitHub (401).');
    if (r.status === 403) throw new Error(`O token não tem a permissão necessária para ${caminho.split('/')[1]} (403). Veja o cabeçalho deste arquivo.`);
    return r;
  };
  const definir = async (nome, valor) => {
    const r = await req('PATCH', `/variables/${nome}`, { name: nome, value: valor });
    if (r.status === 404) { const c = await req('POST', '/variables', { name: nome, value: valor }); if (!c.ok) throw new Error(`Não consegui criar ${nome} (${c.status}).`); }
    else if (!r.ok) throw new Error(`Não consegui alterar ${nome} (${r.status}).`);
    console.log(`${nome} = ${valor}`);
  };
  if (a.includes('--ativar')) await definir('SYNC_ATIVO', 'true');
  if (a.includes('--desativar')) await definir('SYNC_ATIVO', 'false');
  if (a.includes('--aviso')) {
    const r = await req('POST', '/workflows/aviso-sessao.yml/dispatches', { ref: gh.branch || 'main' });
    console.log(r.ok ? 'Aviso da sessão disparado: veja o resultado em Actions → "Aviso da sessão do Prevision".' : `Não consegui disparar (${r.status}).`);
  }
  if (a.includes('--estado') || !a.length) {
    const v = await (await req('GET', '/variables')).json();
    console.log('Variáveis:'); (v.variables || []).forEach(x => console.log(`  ${x.name} = ${x.value}`));
    if (!(v.variables || []).some(x => x.name === 'SYNC_ATIVO' && x.value === 'true')) console.log('  → agendamento DESLIGADO (node sync/configurar-github.cjs --ativar)');
    const s = await (await req('GET', '/secrets')).json(), nomes = new Set((s.secrets || []).map(x => x.name));
    console.log('Segredos (só nomes):');
    ESPERADOS.forEach(n => { const x = (s.secrets || []).find(y => y.name === n); console.log(`  ${x ? '✔' : '—'} ${n}${x ? ` (atualizado em ${x.updated_at.slice(0, 10)})` : ''}`); });
    [...nomes].filter(n => !ESPERADOS.includes(n)).forEach(n => console.log(`  · ${n}`));
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
