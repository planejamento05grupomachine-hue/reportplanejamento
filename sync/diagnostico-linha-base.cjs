#!/usr/bin/env node
// Diagnóstico local de linha de base de uma obra no Prevision (só lê; uso local, nunca no GitHub Actions).
//   node sync/diagnostico-linha-base.cjs 207
// Exporta a Curva S nas perspectivas Física e Econômica (%) e grava o que o painel "Versões" do Cronograma mostra,
// em ~/.painel-sync/linha-base-<obra>/. Restaura a visão do Dashboard no fim.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const exp = require('./lib/prevision-export.cjs');

(async () => {
  if (process.env.GITHUB_ACTIONS) throw new Error('Diagnóstico só para uso local.');
  const codigo = process.argv[2];
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'obras.json'), 'utf8'));
  const obra = { ...cfg.obras.find(o => o.codigo === codigo), exportacao: cfg.padroes.exportacao };
  if (!obra.codigo) throw new Error(`Obra ${codigo} fora de sync/obras.json.`);
  const pasta = path.join(os.homedir(), '.painel-sync', `linha-base-${codigo}`);
  fs.mkdirSync(pasta, { recursive: true });
  const sessao = process.env.PREVISION_SESSAO_ARQUIVO || path.join(os.homedir(), '.painel-sync', 'prevision-sessao.json');
  const { browser, context } = await exp.abrirNavegador(sessao);
  const page = await context.newPage();
  const out = { obra: codigo, em: new Date().toISOString(), arquivos: {} };
  try {
    out.projeto = await exp.selecionarProjeto(page, obra);
    for (const persp of ['physical', 'economic']) {
      const dir = path.join(pasta, persp); fs.mkdirSync(dir, { recursive: true });
      await exp._internas.irPara(page, 'dashboard');
      await exp._internas.definirVisao(page, persp, 'percentage');
      await exp._internas.atualizarDashboard(page);
      const r = await exp._internas.exportarQuadro(page, 'curva s', dir);
      out.arquivos[persp] = r.caminho;
    }
    // Cronograma → Funcionalidades → Versões: lista de versões/linhas de base salvas
    await exp._internas.irPara(page, 'gantt-schedule');
    await page.locator('button.v-btn--fab:has(i.mdi-menu)').filter({ visible: true }).first().click();
    await page.getByText(/^vers[õo]es$/i).filter({ visible: true }).first().click();
    await page.waitForTimeout(4000);
    for (const secao of [/^linhas de base$/i, /^cen[áa]rios$/i]) { await page.getByText(secao).filter({ visible: true }).first().click().catch(() => {}); await page.waitForTimeout(2500); }
    out.versoesTexto =(await page.locator('aside, .v-navigation-drawer, [role=dialog]').filter({ visible: true }).last().innerText().catch(() => '')).slice(0, 4000);
    await page.screenshot({ path: path.join(pasta, 'versoes.png'), fullPage: true });
    out.cabecalhoGantt = (await page.locator('body').innerText()).match(/Fim do projeto:[^\n]*\n?[^\n]*Fim da linha de base:[^\n]*/)?.[0] || null;
  } finally {
    try { await exp._internas.irPara(page, 'dashboard'); await exp._internas.definirVisao(page, 'economic', 'percentage'); } catch (e) { /* ok */ }
    await browser.close();
  }
  fs.writeFileSync(path.join(pasta, 'diagnostico.json'), JSON.stringify(out, null, 1));
  console.log('diagnóstico gravado em', pasta);
})().catch(e => { console.error(`[${e.codigo || 'ERRO'}] ${e.message}`); process.exitCode = 1; });
