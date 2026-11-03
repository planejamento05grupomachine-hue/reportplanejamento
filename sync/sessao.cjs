#!/usr/bin/env node
// Renova a sessão do Prevision usada pela exportação automática (rotina de toda sexta às 14:00).
// Abre um navegador VISÍVEL na tela de login; você entra com a sua conta (e resolve o reCAPTCHA, se aparecer).
// Quando a lista de projetos abrir, a sessão (cookies e armazenamento do site, não a senha) é salva num arquivo local
// protegido, fora do repositório.
//
//   cd sync && npm install && npx playwright install chromium      (uma vez por computador)
//   node sync/sessao.cjs --enviar        login + envia direto para o segredo PREVISION_SESSAO do GitHub (o uso semanal)
//   node sync/sessao.cjs                 login + só salva o arquivo local
//   node sync/sessao.cjs --validade      diz até quando a sessão salva vale e se cobre a próxima sexta 14:00
//                                        (lê o arquivo local ou, no GitHub Actions, a variável PREVISION_SESSAO)
//   node sync/sessao.cjs --testar        abre o Prevision com a sessão salva, sem janela, e confere a lista de projetos
//   --saida <arquivo>                    outro arquivo local · --sem-login (com --enviar) envia o arquivo já salvo
//
// Token para --enviar: variável PAINEL_SEGREDOS_TOKEN ou arquivo ~/.painel-sync/github-segredos.token
// (GitHub → Settings → Developer settings → Fine-grained tokens: só este repositório, "Secrets: Read and write").
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cobre, enviarSegredo } = require('./lib/sessao-prevision.cjs');

const args = process.argv.slice(2);
const DIR = path.join(os.homedir(), '.painel-sync');
const saida = args.includes('--saida') ? args[args.indexOf('--saida') + 1] : path.join(DIR, 'prevision-sessao.json');
const fmt = d => d ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' }).format(d) : 'sem data de vencimento';

function relatarValidade(conteudo) {
  const v = cobre(conteudo);
  console.log(`Sessão do Prevision vale até: ${fmt(v.vencimento)} (Brasília).`);
  console.log(`Próxima execução automática: ${fmt(v.proximaExecucao)}.`);
  if (v.ok) console.log('OK: a sessão cobre a próxima execução.');
  else console.log(`ATENÇÃO: a sessão ${v.vencida ? 'já venceu' : 'vence antes da próxima execução'}. Renove antes de sexta 14:00 com: node sync/sessao.cjs --enviar`);
  return v.ok;
}

function tokenSegredos() {
  if (process.env.PAINEL_SEGREDOS_TOKEN) return process.env.PAINEL_SEGREDOS_TOKEN.trim();
  const arq = path.join(DIR, 'github-segredos.token');
  return fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8').trim() : null;
}

async function enviar(conteudo) {
  const { configPublica } = require('./lib/ambiente.cjs');
  const gh = configPublica().github;
  await enviarSegredo({ conteudo, token: tokenSegredos(), owner: gh.owner, repo: gh.repo });
  console.log(`Sessão enviada para o segredo PREVISION_SESSAO de ${gh.owner}/${gh.repo}.`);
}

(async () => {
  if (args.includes('--validade')) {
    const conteudo = process.env.PREVISION_SESSAO || (fs.existsSync(saida) ? fs.readFileSync(saida, 'utf8') : null);
    if (!conteudo) { console.log('Nenhuma sessão salva. Faça o login com: node sync/sessao.cjs --enviar'); process.exitCode = 1; return; }
    process.exitCode = relatarValidade(conteudo) ? 0 : 1;
    return;
  }
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
  if (!(args.includes('--enviar') && args.includes('--sem-login'))) {
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
  }
  const conteudo = fs.readFileSync(saida, 'utf8');
  relatarValidade(conteudo);
  if (args.includes('--enviar')) await enviar(conteudo);
  else console.log('Para enviar ao GitHub sem copiar e colar: node sync/sessao.cjs --enviar --sem-login');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
