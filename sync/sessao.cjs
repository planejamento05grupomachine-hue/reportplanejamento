#!/usr/bin/env node
// Renova a sessão do Prevision usada pela exportação automática.
// Abre um navegador VISÍVEL na tela de login; você entra com a sua conta (e resolve o reCAPTCHA, se aparecer).
// Quando a lista de projetos abrir, a sessão (cookies e armazenamento do site, não a senha) é salva num arquivo local
// protegido, fora do repositório. Depois, copie o conteúdo para o segredo PREVISION_SESSAO do GitHub (ver sync/README.md).
//
//   cd sync && npm install && npx playwright install chromium
//   node sync/sessao.cjs [--saida <arquivo>] [--testar]
// --testar: só confere se a sessão salva ainda abre a lista de projetos (sem navegador visível).
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const saida = args.includes('--saida') ? args[args.indexOf('--saida') + 1] : path.join(os.homedir(), '.painel-sync', 'prevision-sessao.json');

(async () => {
  const { chromium } = require('playwright');
  if (args.includes('--testar')) {
    const b = await chromium.launch();
    const ctx = await b.newContext({ storageState: saida });
    const p = await ctx.newPage();
    await p.goto('https://app.prevision.com.br/app/projects', { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(5000);
    const ok = !/\/login/.test(p.url());
    await b.close();
    console.log(ok ? 'Sessão válida: a lista de projetos abriu.' : 'Sessão vencida: rode de novo sem --testar.');
    process.exitCode = ok ? 0 : 1;
    return;
  }
  const b = await chromium.launch({ headless: false });
  const ctx = await b.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const p = await ctx.newPage();
  await p.goto('https://app.prevision.com.br/login');
  console.log('Entre no Prevision na janela que abriu. Aguardando a lista de projetos (até 10 minutos)…');
  await p.waitForURL(/\/app\/(projects|home|dashboard|gantt)/, { timeout: 600000 });
  await p.waitForTimeout(3000);
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  await ctx.storageState({ path: saida });
  try { fs.chmodSync(saida, 0o600); } catch (e) { /* Windows: herda as permissões da pasta do usuário */ }
  await b.close();
  console.log(`Sessão salva em ${saida} (o conteúdo não é mostrado aqui).`);
  console.log('Para o GitHub Actions: gh secret set PREVISION_SESSAO < "' + saida + '"  (ou cole o conteúdo em Settings → Secrets and variables → Actions).');
  console.log('Apague o arquivo local quando não precisar mais dele.');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
