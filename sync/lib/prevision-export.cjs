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
  // /app/projects abre a tela inicial ("Selecione a etapa do seu projeto"): a lista de obras vem do cartão da etapa
  // "3 Obra · N projetos ativos", que é todo clicável (v-card--link; o "Executar" é desenho, não texto) — 28/10/2026
  if (!/\/app\/projects/.test(page.url())) {
    // texto do cartão vem colado: "3Obra6 projetos ativos"
    await page.locator('.v-card.v-card--link').filter({ hasText: /^\s*\d\s*Obra\s*\d+\s*projetos? ativos?/ }).first().click();
    await page.waitForURL(/\/app\/projects/, { timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }
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
  // projeto sem dados nesta perspectiva (ex.: econômica sem orçamento vinculado ao cronograma — obra 211, 28/10/2026)
  if (await page.getByText(/Dashboard sem dados/i).filter({ visible: true }).count()) {
    throw erro('O Dashboard do Prevision está sem dados nesta perspectiva (na econômica, falta vincular o orçamento ao cronograma).', 'SEM_DADOS_PREVISION');
  }
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
  const padrao = (await chip.innerText()).trim();
  await chip.click();
  const escolher = async (rotulo, iso) => {
    const [ano, mes, dia] = iso.split('-').map(Number);
    await page.getByLabel(rotulo).filter({ visible: true }).first().click();
    // cabeçalho do calendário (Vuetify): "Mês anterior" · "Outubro de 2026" · "Próximo mês" — conferido em 27/10/2026.
    // A troca de mês é animada e, durante a animação, o cabeçalho traz os dois meses ("Outubro de 2026\nSetembro de
    // 2026" — 28/10/2026); lê-lo nesse instante fazia o robô passar um mês. Só vale o cabeçalho com um mês e diferente do anterior.
    const cabecalho = async () => (await page.locator('.v-date-picker-header__value').filter({ visible: true }).last().innerText()).trim().toLowerCase();
    const esperarCabecalho = async anterior => {
      for (let w = 0; w < 50; w++) { const c = await cabecalho(); if (!c.includes('\n') && c !== anterior) return c; await page.waitForTimeout(100); }
      throw erro('O calendário do Prevision não trocou de mês.', 'EXPORTACAO_INTERFACE');
    };
    let cab = await esperarCabecalho(null), limite = null;
    for (let k = 0; k < 72; k++) {
      const m = cab.match(/^([a-zç]+) de (\d{4})$/);
      if (!m || MESES.indexOf(m[1]) < 0) throw erro('Calendário do Prevision em formato inesperado.', 'EXPORTACAO_INTERFACE');
      const dif = (ano * 12 + mes - 1) - (+m[2] * 12 + MESES.indexOf(m[1]));
      if (dif === 0) break;
      const seta = page.getByRole('button', { name: dif < 0 ? 'Mês anterior' : 'Próximo mês' }).filter({ visible: true }).last();
      // o Prevision limita o calendário ao período do projeto (207, 208 e 211, 28/10/2026): no limite, fica a data
      // mais extrema permitida, que já cobre todo o período possível
      if (await seta.isDisabled()) { limite = dif < 0 ? 'primeiro' : 'ultimo'; break; }
      await seta.click();
      cab = await esperarCabecalho(cab);
    }
    await page.waitForTimeout(300);
    const tabela = page.locator('.v-date-picker-table').filter({ visible: true }).last();
    const diaBtn = limite ? tabela.locator('button:not([disabled])').nth(limite === 'primeiro' ? 0 : -1)
      : tabela.getByRole('button', { name: new RegExp(`^${dia}$`) });
    await diaBtn.click();
    await page.waitForTimeout(1500);
    return limite;
  };
  // Confere o período aplicado: começa até a data pedida (ou no limite do calendário) e termina depois da pedida (ou no
  // limite). A troca de mês é animada e às vezes o clique cai no dia errado (207, 28/10/2026): repete até 3 vezes.
  let ultimo = null;
  for (let t = 0; t < 3; t++) {
    if (t) { await chip.click(); await page.waitForTimeout(800); }
    const limIni = await escolher(/data de in[ií]cio/i, inicioISO);
    const limFim = await escolher(/data de fim/i, fimISO);
    await page.keyboard.press('Escape');
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const txt = (await chip.innerText()).trim();
    const m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4}) até (\d{2})\/(\d{2})\/(\d{4})$/);
    const iso = m && [`${m[3]}-${m[2]}-${m[1]}`, `${m[6]}-${m[5]}-${m[4]}`];
    ultimo = { texto: txt, inicio: iso && iso[0], fim: iso && iso[1], limiteInicio: !!limIni, limiteFim: !!limFim };
    if (iso && txt !== padrao && (limIni || iso[0] <= inicioISO) && (limFim || iso[1] >= fimISO)) return ultimo;
  }
  throw erro(`O período do Progresso por tarefas não cobriu a obra (aplicado: ${ultimo && ultimo.texto}).`, 'EXPORTACAO_INTERFACE');
}
// O Dashboard do Prevision guarda um cálculo e avisa "A sua dashboard está desatualizada. Deseja atualizar?" quando o
// cronograma mudou depois dele (211, 28/10/2026: Gantt 5,93% × Dashboard 5,80%). A pessoa clicaria em Atualizar; o robô
// faz o mesmo antes de exportar (só recalcula o painel do Prevision, não altera dados da obra).
async function atualizarDashboard(page) {
  const aviso = page.getByText(/dashboard est[áa] desatualizada/i).filter({ visible: true });
  if (!(await aviso.count())) return false;
  await page.getByRole('button', { name: /^atualizar$/i }).filter({ visible: true }).last().click();
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});
  for (let w = 0; w < 60 && await aviso.count(); w++) await page.waitForTimeout(1000);
  await page.waitForTimeout(3000);
  return true;
}

async function exportarCronograma(page, pasta) {
  await irPara(page, 'gantt-schedule');
  await page.locator('button:has(i.mdi-arrow-expand-vertical)').filter({ visible: true }).first().click().catch(() => {});
  await page.waitForTimeout(2000);
  await page.locator('button.v-btn--fab:has(i.mdi-menu)').filter({ visible: true }).first().click();
  await page.getByText(/^exportar$/i).filter({ visible: true }).first().click();
  return baixar(page, () => page.getByRole('button', { name: /^exportar$/i }).filter({ visible: true }).last().click(), pasta);
}

// Captura da tela onde a exportação parou: só com SYNC_CAPTURAS (uso local). Nunca no GitHub Actions, cujos
// artefatos são públicos e a tela tem dados da obra.
async function capturar(page, obra, etapa) {
  const dir = process.env.SYNC_CAPTURAS;
  if (!dir || process.env.GITHUB_ACTIONS) return;
  try { fs.mkdirSync(dir, { recursive: true }); await page.screenshot({ path: path.join(dir, `${obra.codigo}-${etapa}-${Date.now()}.png`), fullPage: true }); } catch (e) { /* diagnóstico apenas */ }
}

// período das tarefas: dia 1 do mês anterior ao início da Curva S até dia 1 do segundo mês depois do fim (dia 1 existe
// em todo mês; janela maior que a obra não muda nada: a raiz fecha em 100% do previsto)
const primeiroDoMesAnterior = iso => { const d = new Date(iso.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); };
const primeiroDoSegundoMesSeguinte = iso => { const d = new Date(iso.slice(0, 7) + '-01T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() + 2); return d.toISOString().slice(0, 10); };

// Exporta os conjuntos pedidos (fisico, financeiro) para <pasta>/<conjunto>. lerCurva(arquivo) devolve a curva
// lida (para o período das tarefas). Devolve { fisico: [...], financeiro: [...], projeto, erros: { conjunto: Error } }:
// cada conjunto falha sozinho (ex.: obra sem orçamento vinculado não tem a visão econômica, mas tem a física).
async function exportarObra(context, obra, pasta, lerCurva, naturezas = ['fisico', 'financeiro']) {
  const page = await context.newPage();
  const out = { fisico: [], financeiro: [], projeto: null, erros: {} };
  const exp = obra.exportacao;
  try {
    out.projeto = await selecionarProjeto(page, obra).catch(async e => { await capturar(page, obra, 'projeto'); throw e; });
    for (const nat of naturezas) {
      const cfg = obra[nat];
      if (!cfg || !cfg.ativo) continue;
      try {
        const dir = path.join(pasta, nat); fs.mkdirSync(dir, { recursive: true });
        await irPara(page, 'dashboard');
        if (nat === 'fisico') await definirVisao(page, exp.fisico.perspectiva, 'percentage');
        else await definirVisao(page, exp.financeiro.perspectiva, 'monetary');
        if (await atualizarDashboard(page)) out.dashboardAtualizado = true;
        const curva = await exportarQuadro(page, 'curva s', dir); out[nat].push(curva);
        if (cfg.relatorios.mensal) out[nat].push(await exportarQuadro(page, 'progresso mensal', dir));
        if (cfg.relatorios.tarefas) {
          const c = lerCurva(curva.caminho);
          out.periodoTarefas = out.periodoTarefas || {};
          out.periodoTarefas[nat] = await definirPeriodoTarefas(page, primeiroDoMesAnterior(c[0].data), primeiroDoSegundoMesSeguinte(c.at(-1).data));
          out[nat].push(await exportarQuadro(page, 'progresso por tarefas', dir));
        }
        if (nat === 'fisico' && cfg.relatorios.cronograma) out[nat].push(await exportarCronograma(page, dir));
      } catch (e) {
        if (['SESSAO_PREVISION_EXPIRADA'].includes(e.codigo)) throw e;
        await capturar(page, obra, nat);
        out.erros[nat] = e; out[nat] = [];
      }
    }
  } catch (e) {
    await capturar(page, obra, 'exportacao');
    throw e;
  } finally {
    // devolve o Dashboard à visão de uso diário de quem usa a mesma conta
    if (exp.restaurarVisao) { try { await irPara(page, 'dashboard'); await definirVisao(page, exp.restaurarVisao.perspectiva, exp.restaurarVisao.formato); } catch (e) { /* não impede a carga */ } }
    await page.close();
  }
  return out;
}

module.exports = { abrirNavegador, exportarObra, selecionarProjeto, hashNome, normNome, primeiroDoMesAnterior, primeiroDoSegundoMesSeguinte };
