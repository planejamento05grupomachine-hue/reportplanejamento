// Exportação dos relatórios pela interface do Prevision (Playwright), com uma sessão aberta por uma pessoa.
// O login do Prevision tem reCAPTCHA Enterprise: a automação NÃO digita senha nem tenta passar pelo captcha.
// Ela reaproveita a sessão salva por `node sync/sessao.cjs` (storageState) e, se cair na tela de login, para com
// SESSAO_PREVISION_EXPIRADA — a recuperação é renovar a sessão (ver sync/README.md).
//
// Parâmetros de exportação conferidos na obra 198 em 27/10/2026 (ver sync/README.md, "Evidências"):
//   físico     = Dashboard, Perspectiva Física (Duração) + Formato Percentual: realizado igual ao do Cronograma;
//   financeiro = Dashboard, Perspectiva Econômica (Orçamento) + Formato Moeda (R$) (a física fica desabilitada em R$);
//   Progresso por tarefas: período cobrindo a obra inteira (o padrão é o mês corrente, e trocar o formato o reinicia);
//   Cronograma: Gantt com tudo expandido, Excel, "Data de referência" = hoje (o padrão).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const APP = 'https://app.prevision.com.br/app';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });
const normNome = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const hashNome = s => crypto.createHash('sha256').update(normNome(s)).digest('hex');

async function abrirNavegador(sessaoArquivo, { headless = true } = {}) {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) { throw erro('Playwright não instalado (cd sync && npm install).', 'DEPENDENCIA'); }
  if (!sessaoArquivo || !fs.existsSync(sessaoArquivo)) throw erro('Não há sessão salva do Prevision (PREVISION_SESSAO).', 'SEM_SESSAO_PREVISION');
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ storageState: sessaoArquivo, acceptDownloads: true, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1600, height: 900 } });
  context.setDefaultTimeout(45000);
  return { browser, context };
}

async function irPara(page, rota) {
  await page.goto(`${APP}/${rota}`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  if (/\/login/.test(page.url())) throw erro('A sessão do Prevision expirou: renove com `node sync/sessao.cjs`.', 'SESSAO_PREVISION_EXPIRADA');
}

// Seleciona o projeto pelo código e confere a identidade pelo id interno (gantt) e pelo nome (hash)
async function selecionarProjeto(page, obra) {
  await irPara(page, 'projects');
  const cartao = page.locator('div').filter({ hasText: new RegExp('^' + obra.codigo + ' - ') }).filter({ has: page.getByRole('button', { name: /selecionar/i }) }).last();
  await cartao.waitFor();
  const titulo = (await cartao.innerText()).split('\n')[0].trim();
  if (obra.conferenciaNome && hashNome(titulo) !== obra.conferenciaNome.sha256) throw erro(`O projeto ${obra.codigo} do Prevision não tem o nome conferido no vínculo.`, 'IDENTIDADE_PREVISION');
  const req = page.waitForRequest(r => /api\.obra\.prevision\.com\.br\/gantts\/\d+\//.test(r.url()), { timeout: 45000 });
  await cartao.getByRole('button', { name: /selecionar/i }).click();
  const id = Number((await req).url().match(/gantts\/(\d+)\//)[1]);
  if (id !== obra.prevision.ganttId) throw erro(`O Prevision abriu o projeto ${id}, mas o vínculo da obra ${obra.codigo} é ${obra.prevision.ganttId}.`, 'IDENTIDADE_PREVISION');
  return { ganttId: id, titulo };
}

async function definirVisao(page, perspectiva, formato) {
  const atual = async () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('input[type=radio]')].map(r => [r.value, r.checked])));
  const v = await atual();
  if (v[perspectiva] && v[formato]) return;
  await page.getByRole('button', { name: /percentual \(%\)|moeda \(r\$\)/i }).first().click();
  for (const val of [perspectiva, formato]) await page.locator(`.v-radio:has(input[value="${val}"])`).filter({ visible: true }).first().click();
  await page.getByRole('button', { name: /^aplicar$/i }).filter({ visible: true }).click();
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const depois = await atual();
  if (!depois[perspectiva] || !depois[formato]) throw erro(`Não consegui aplicar a visão ${perspectiva}/${formato} no Dashboard.`, 'EXPORTACAO_INTERFACE');
}

// Marca o botão de menu (⋮) do cabeçalho de cada quadro do Dashboard com o título do quadro
async function marcarMenus(page) {
  return page.evaluate(() => {
    const titulos = {};
    for (const b of document.querySelectorAll('button')) {
      if (!b.offsetParent || !b.querySelector('[class*="mdi-dots"]')) continue;
      let el = b, t = null;
      for (let i = 0; i < 6 && el && !t; i++) { el = el.parentElement; const h = el && el.querySelector('header, .v-toolbar__title, h1, h2, h3, h4, .text-h6, .card-title, span, div'); const txt = el && (el.innerText || '').trim().split('\n')[0]; if (/^(Curva S|Progresso Mensal|Progresso por tarefas)$/i.test(txt || '')) t = txt; else if (h && /^(Curva S|Progresso Mensal|Progresso por tarefas)$/i.test((h.innerText || '').trim())) t = h.innerText.trim(); }
      if (t) { b.setAttribute('data-sync-menu', t.toLowerCase()); titulos[t.toLowerCase()] = true; }
    }
    return Object.keys(titulos);
  });
}

async function baixar(page, gatilho, pasta) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), gatilho()]);
  const nome = dl.suggestedFilename();
  const destino = path.join(pasta, nome);
  await dl.saveAs(destino);
  return { nome, caminho: destino, coletadoEm: new Date().toISOString() };
}

async function exportarQuadro(page, titulo, pasta) {
  const menus = await marcarMenus(page);
  if (!menus.includes(titulo)) throw erro(`Não achei o menu do quadro "${titulo}" no Dashboard.`, 'EXPORTACAO_INTERFACE');
  const botao = page.locator(`[data-sync-menu="${titulo}"]`);
  await botao.scrollIntoViewIfNeeded();
  await botao.click();
  const item = page.getByRole('menuitem', { name: /exportar excel/i }).filter({ visible: true }).last();
  return baixar(page, () => item.click(), pasta);
}

// Período do Progresso por tarefas: do mês anterior ao início da Curva S até o mês seguinte ao fim
async function definirPeriodoTarefas(page, inicioISO, fimISO) {
  const chip = page.getByText(/^\d{2}\/\d{2}\/\d{4} até \d{2}\/\d{2}\/\d{4}$/).filter({ visible: true }).first();
  await chip.scrollIntoViewIfNeeded();
  await chip.click();
  const escolher = async (rotulo, iso) => {
    const [ano, mes, dia] = iso.split('-').map(Number);
    await page.getByLabel(rotulo).filter({ visible: true }).first().click();
    // cabeçalho do calendário (Vuetify): "Mês anterior" · "Outubro de 2026" · "Próximo mês" — conferido em 27/10/2026
    for (let k = 0; k < 72; k++) {
      const cab = (await page.locator('.v-date-picker-header__value').filter({ visible: true }).last().innerText()).trim().toLowerCase();
      const m = cab.match(/([a-zç]+) de (\d{4})/);
      if (!m || MESES.indexOf(m[1]) < 0) throw erro('Calendário do Prevision em formato inesperado.', 'EXPORTACAO_INTERFACE');
      const dif = (ano * 12 + mes - 1) - (+m[2] * 12 + MESES.indexOf(m[1]));
      if (dif === 0) break;
      await page.getByRole('button', { name: dif < 0 ? 'Mês anterior' : 'Próximo mês' }).filter({ visible: true }).last().click();
      await page.waitForTimeout(200);
    }
    await page.locator('.v-date-picker-table').filter({ visible: true }).last().getByRole('button', { name: new RegExp(`^${dia}$`) }).click();
    await page.waitForTimeout(1500);
  };
  await escolher(/data de in[ií]cio/i, inicioISO);
  await escolher(/data de fim/i, fimISO);
  await page.keyboard.press('Escape');
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const txt = (await chip.innerText()).trim();
  const br = iso => iso.split('-').reverse().join('/');
  if (txt !== `${br(inicioISO)} até ${br(fimISO)}`) throw erro('O período do Progresso por tarefas não foi aplicado.', 'EXPORTACAO_INTERFACE');
}

async function exportarCronograma(page, pasta) {
  await irPara(page, 'gantt-schedule');
  await page.locator('button:has(i.mdi-arrow-expand-vertical)').filter({ visible: true }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('button.v-btn--fab:has(i.mdi-menu)').filter({ visible: true }).first().click();
  await page.getByText(/^exportar$/i).filter({ visible: true }).first().click();
  return baixar(page, () => page.getByRole('button', { name: /^exportar$/i }).filter({ visible: true }).last().click(), pasta);
}

const primeiroDoMesAnterior = iso => { const d = new Date(iso.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); };
const ultimoDoMesSeguinte = iso => { const d = new Date(iso.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 2); d.setUTCDate(0); return d.toISOString().slice(0, 10); };

// Exporta os conjuntos pedidos (fisico, financeiro) para <pasta>/<conjunto>. lerCurva(arquivo) devolve a curva
// lida (para o período das tarefas). Devolve { fisico: [...], financeiro: [...], projeto }.
async function exportarObra(context, obra, pasta, lerCurva, naturezas = ['fisico', 'financeiro']) {
  const page = await context.newPage();
  const out = { fisico: [], financeiro: [], projeto: null };
  const exp = obra.exportacao;
  try {
    out.projeto = await selecionarProjeto(page, obra);
    for (const nat of naturezas) {
      const cfg = obra[nat];
      if (!cfg || !cfg.ativo) continue;
      const dir = path.join(pasta, nat); fs.mkdirSync(dir, { recursive: true });
      await irPara(page, 'dashboard');
      if (nat === 'fisico') await definirVisao(page, exp.fisico.perspectiva, 'percentage');
      else await definirVisao(page, exp.financeiro.perspectiva, 'monetary');
      const curva = await exportarQuadro(page, 'curva s', dir); out[nat].push(curva);
      if (cfg.relatorios.mensal) out[nat].push(await exportarQuadro(page, 'progresso mensal', dir));
      if (cfg.relatorios.tarefas) {
        const c = lerCurva(curva.caminho);
        await definirPeriodoTarefas(page, primeiroDoMesAnterior(c[0].data), ultimoDoMesSeguinte(c.at(-1).data));
        out[nat].push(await exportarQuadro(page, 'progresso por tarefas', dir));
      }
      if (nat === 'fisico' && cfg.relatorios.cronograma) out[nat].push(await exportarCronograma(page, dir));
    }
  } finally {
    // devolve o Dashboard à visão de uso diário de quem usa a mesma conta
    if (exp.restaurarVisao) { try { await irPara(page, 'dashboard'); await definirVisao(page, exp.restaurarVisao.perspectiva, exp.restaurarVisao.formato); } catch (e) { /* não impede a carga */ } }
    await page.close();
  }
  return out;
}

module.exports = { abrirNavegador, exportarObra, selecionarProjeto, hashNome, normNome, primeiroDoMesAnterior, ultimoDoMesSeguinte };
