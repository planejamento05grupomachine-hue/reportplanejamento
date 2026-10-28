// Diagnóstico local: abre a lista de projetos do Prevision com a sessão salva e grava o que a automação vê
// (endereço, texto da tela e uma captura) em ~/.painel-sync. Não grava nada no Prevision nem no painel.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const pasta = path.join(os.homedir(), '.painel-sync');
  const sessao = process.env.PREVISION_SESSAO_ARQUIVO || path.join(pasta, 'prevision-sessao.json');
  const b = await chromium.launch();
  const ctx = await b.newContext({ storageState: sessao, locale: 'pt-BR', viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('https://app.prevision.com.br/app/projects', { waitUntil: 'domcontentloaded' });
  await p.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const info = { url: p.url(), titulo: await p.title(), texto: (await p.locator('body').innerText()).slice(0, 1500),
    botoes: await p.getByRole('button').allInnerTexts().catch(() => []),
    // estrutura dos cartões de etapa (sem dados de obra): onde está o "Executar" da etapa Obra
    cartoes: await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.children.length <= 4 && /Executar|projetos? ativos?/.test(e.textContent) && e.textContent.length < 80)
      .slice(0, 12).map(e => ({ tag: e.tagName, cls: String(e.className).slice(0, 80), texto: e.textContent.trim().slice(0, 60), html: e.outerHTML.slice(0, 300) }))) };
  fs.writeFileSync(path.join(pasta, 'diagnostico.json'), JSON.stringify(info, null, 1));
  await p.screenshot({ path: path.join(pasta, 'diagnostico.png') });
  await b.close();
  console.log('diagnóstico gravado em', pasta);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
