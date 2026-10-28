// Validação da carga automática. Parte da conferência da tela Alimentar (Carga.conferencia) e é mais estrita:
// na tela, um aviso (!) deixa o administrador decidir; aqui ninguém decide, então todo aviso bloqueia,
// salvo os informativos listados em AVISOS_INFORMATIVOS. Bloqueio = a última carga válida fica como está.
// Cada verificação tem um texto público (sem números da obra, vai para o log do GitHub) e um detalhe (com números,
// só no relatório cifrado).
'use strict';
const { Carga, sha256 } = require('./ambiente.cjs');

// "Pesos das tarefas finais somam X%" é arredondamento do Prevision (o painel normaliza); o limite de 0,5% fica com a
// verificação TAREFAS_FILTRADAS abaixo (207: 100,24% em 28/10/2026)
const AVISOS_INFORMATIVOS = [/^IDPM veio zerado/, /^Posição estimada em/, /Pendente de contratação/, /^Pesos das tarefas finais somam/];
const JANELA_COLETA_MIN = 90;

const ultimoReal = curva => [...(curva || [])].reverse().find(p => p.realizado > 0) || null;
const nulos = (lista, campos) => (lista || []).filter(p => campos.some(c => p[c] === null || p[c] === undefined || Number.isNaN(p[c]))).length;
const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(c => [c, x[c]])) : x));
const hashDe = obj => sha256(Buffer.from(canon(obj)));
// "mesmos dados": iguais a menos de arredondamento (a API e a exportação diferem na 7ª casa: conferido na obra 198)
function quaseIgual(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => quaseIgual(x, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    return ka.length === kb.length && ka.every(k => quaseIgual(a[k], b[k]));
  }
  return a === b;
}

// O que conta como "a mesma produção" de cada conjunto (a data de referência do cronograma muda todo dia e fica de fora)
function retratoFisico(o) { return { curva: o.curva || null, mensal: o.mensal || null, tarefas: o.tarefas || null, cronograma: (o.cronograma && o.cronograma.linhas) || null }; }
function retratoFinanceiro(f, tipos) { return Object.fromEntries(tipos.map(t => [t, (f || {})[t] || null])); }

function novoResultado() {
  const v = [];
  const add = (id, nivel, publico, detalhe) => v.push({ id, nivel, publico, detalhe: detalhe || publico });
  return { v, add, ok: (id, p, d) => add(id, 'ok', p, d), aviso: (id, p, d) => add(id, 'aviso', p, d), bloqueio: (id, p, d) => add(id, 'bloqueio', p, d) };
}

function baseDiverge(nova, atual, tol) {
  const porData = new Map((atual || []).map(p => [p.data, p.base]));
  let comp = 0, max = 0;
  for (const p of nova) { if (!porData.has(p.data) || p.base === null) continue; comp++; max = Math.max(max, Math.abs(p.base - porData.get(p.data))); }
  return { comp, max, diverge: comp > 0 && max > tol };
}

// conj: { dados, nomes, origem, problemas } (leitura.lerConjunto) · obra: rascunho ou posição publicada atual
function validarFisico(conj, obra, cfg, { hoje, aceitarNovaBase = false } = {}) {
  const r = novoResultado(), d = conj.dados;
  conj.problemas.forEach(p => r.bloqueio(p.id, `Arquivo não aproveitado (${p.id}).`, `${p.arquivo}: ${p.msg}`));
  const exig = Object.entries(cfg.relatorios).filter(([, x]) => x === 'obrigatorio').map(([t]) => t);
  const faltam = exig.filter(t => !d[t]);
  faltam.forEach(t => r.bloqueio('INCOMPLETO', `Falta o relatório obrigatório: ${t}.`));
  if (faltam.length) return fechar(r, null);

  // unidade: dados físicos em fração (0–1), como os parsers entregam
  const fimBase = d.curva.at(-1).base;
  if (!(fimBase > 0.5 && fimBase <= 1.0005)) r.bloqueio('ESCALA', 'A Curva S física não está em percentual (0–100%).', `base final ${fimBase}`);
  const nC = nulos(d.curva, ['base', 'previsto', 'realizado']), nT = nulos(d.tarefas, ['base', 'previsto', 'realizado']);
  if (nC || nT) r.bloqueio('VALOR_AUSENTE', 'Há valores em branco na Curva S ou no Progresso por tarefas (ausente não é zero).', `curva: ${nC} pontos · tarefas: ${nT} linhas`);

  // conferência da tela Alimentar, com a mesma data de corte que ela proporia
  const { corte, dataEstimada } = Carga.estimarCorte(d, obra, hoje);
  const imp = { dados: d, nomes: conj.nomes, corte, dataEstimada };
  for (const [nivel, texto] of Carga.conferencia(obra, imp)) {
    if (nivel === 'ok') r.ok('CONFERENCIA', 'Conferência do painel: ok.', texto);
    else if (nivel === 'er') r.bloqueio('CONFERENCIA', 'A conferência do painel recusou a carga.', texto);
    else if (AVISOS_INFORMATIVOS.some(re => re.test(texto))) r.aviso('CONFERENCIA_INFORMATIVA', 'Aviso informativo da conferência.', texto);
    else r.bloqueio('CONFERENCIA_AVISO', 'A conferência do painel deu um aviso que, sem revisão humana, bloqueia a carga.', texto);
  }

  // filtro de datas no Progresso por tarefas: a raiz e os pesos não somam 100%
  const raiz = d.tarefas.find(t => t.nivel === 1);
  const somaFolhas = d.tarefas.filter(t => t.folha).reduce((s, t) => s + (t.previsto || 0), 0);
  if (!raiz || raiz.previsto < 0.995 || Math.abs(somaFolhas - 1) > 0.005) r.bloqueio('TAREFAS_FILTRADAS', 'O Progresso por tarefas veio com filtro de datas (a raiz não soma 100%).', `raiz previsto ${raiz && raiz.previsto} · folhas ${somaFolhas}`);
  else r.ok('TAREFAS_FILTRADAS', 'Progresso por tarefas sem filtro de datas.');

  // todos os arquivos da mesma coleta (exportados juntos)
  const horas = conj.origem.map(o => o.coletadoEm && Date.parse(o.coletadoEm)).filter(Boolean);
  if (horas.length > 1 && (Math.max(...horas) - Math.min(...horas)) / 60000 > JANELA_COLETA_MIN) r.bloqueio('COLETAS_DIFERENTES', `Arquivos coletados com mais de ${JANELA_COLETA_MIN} minutos de diferença.`, conj.origem.map(o => `${o.tipo}: ${o.coletadoEm}`).join(' · '));

  const ult = ultimoReal(d.curva), ultAtual = ultimoReal(obra.curva);
  if (ult && ultAtual && ult.data < ultAtual.data) r.bloqueio('DADOS_MAIS_ANTIGOS', 'A coleta tem medição mais antiga que a carga atual do painel.', `último realizado ${ult.data} × atual ${ultAtual.data}`);
  if (obra.dataCorte && corte < obra.dataCorte) r.bloqueio('CORTE_ANTERIOR', 'A data de corte calculada é anterior à da carga atual.', `${corte} × ${obra.dataCorte}`);
  const lb = baseDiverge(d.curva, obra.curva, 0.002);
  if (lb.diverge && !aceitarNovaBase) r.bloqueio('LINHA_DE_BASE_DIFERENTE', 'A linha de base mudou em relação à carga atual (nova linha de base, outra perspectiva ou outra obra).', `diferença máx. ${lb.max} em ${lb.comp} datas`);
  else if (lb.diverge) r.aviso('LINHA_DE_BASE_ACEITA', 'Nova linha de base aceita por quem disparou a execução.', `diferença máx. ${lb.max}`);

  const novo = retratoFisico({ curva: d.curva, mensal: d.mensal, tarefas: d.tarefas, cronograma: d.cronograma ? { linhas: d.cronograma } : null });
  return fechar(r, { corte, ultimoRealizado: ult ? ult.data : null, hash: hashDe(novo), inalterado: quaseIgual(novo, retratoFisico(obra)) });
}

function validarFinanceiro(conj, obra, cfg, { hoje, aceitarNovaBase = false } = {}) {
  const r = novoResultado(), d = conj.dados;
  conj.problemas.forEach(p => r.bloqueio(p.id, `Arquivo não aproveitado (${p.id}).`, `${p.arquivo}: ${p.msg}`));
  const exig = Object.entries(cfg.relatorios).filter(([, x]) => x === 'obrigatorio').map(([t]) => t);
  const faltam = exig.filter(t => !d[t]);
  faltam.forEach(t => r.bloqueio('INCOMPLETO', `Falta o relatório financeiro obrigatório: ${t}.`));
  if (faltam.length || !d.curva) return fechar(r, null);

  // identidade: o código da obra no nome do arquivo, quando o Prevision o coloca (a Curva S traz "Curva S - 198 - ...")
  for (const o of conj.origem) {
    const c = Carga.codigoEm(o.nome);
    if (c && c !== String(obra.codigo)) r.bloqueio('OUTRA_OBRA', 'Arquivo financeiro de outra obra.', `${o.nome}: obra ${c}, esperado ${obra.codigo}`);
  }

  // unidade: valor agregado em reais — uma curva que fecha perto de 1 é percentual, não R$
  const fimBase = d.curva.at(-1).base;
  if (!(fimBase > 1000)) r.bloqueio('ESCALA', 'A Curva S financeira não está em reais (parece percentual).', `base final ${fimBase}`);
  const mono = d.curva.every((p, i) => !i || p.base >= d.curva[i - 1].base - 0.01);
  if (!mono) r.bloqueio('BASE_DECRESCENTE', 'A base da Curva S financeira diminui em algum ponto.');
  const n = nulos(d.curva, ['base', 'previsto', 'realizado']);
  if (n) r.bloqueio('VALOR_AUSENTE', 'Há valores em branco na Curva S financeira (ausente não é zero).', `${n} pontos`);
  const tol = Math.max(1, fimBase * 0.005);
  if (d.mensal) {
    const soma = d.mensal.reduce((s, m) => s + (m.base || 0), 0);
    if (Math.abs(soma - fimBase) > tol) r.bloqueio('MENSAL_FINANCEIRO', 'O progresso mensal financeiro não fecha com a Curva S financeira.', `soma base ${soma} × curva ${fimBase}`);
    else r.ok('MENSAL_FINANCEIRO', 'Progresso mensal financeiro fecha com a Curva S financeira.');
  }
  const ult = ultimoReal(d.curva);
  if (d.tarefas) {
    const raiz = d.tarefas.find(t => t.nivel === 1);
    if (!raiz || Math.abs((raiz.previsto || 0) - d.curva.at(-1).previsto) > tol) r.bloqueio('TAREFAS_FILTRADAS', 'O Progresso por tarefas financeiro veio com filtro de datas.', `raiz previsto ${raiz && raiz.previsto} × curva ${d.curva.at(-1).previsto}`);
    else if (ult && Math.abs((raiz.realizado || 0) - ult.realizado) > tol) r.bloqueio('TAREFAS_REALIZADO', 'Curva S e Progresso por tarefas financeiros mostram realizados diferentes.', `${raiz.realizado} × ${ult.realizado}`);
    else r.ok('TAREFAS_FINANCEIRO', 'Progresso por tarefas financeiro confere com a curva.');
  }
  const horas = conj.origem.map(o => o.coletadoEm && Date.parse(o.coletadoEm)).filter(Boolean);
  if (horas.length > 1 && (Math.max(...horas) - Math.min(...horas)) / 60000 > JANELA_COLETA_MIN) r.bloqueio('COLETAS_DIFERENTES', `Arquivos financeiros coletados com mais de ${JANELA_COLETA_MIN} minutos de diferença.`);

  const atual = (obra.financeiro || {}).curva;
  const ultAtual = ultimoReal(atual);
  if (ult && ultAtual && ult.data < ultAtual.data) r.bloqueio('DADOS_MAIS_ANTIGOS', 'A coleta financeira tem medição mais antiga que a carga atual.', `${ult.data} × ${ultAtual.data}`);
  const lb = baseDiverge(d.curva, atual, tol);
  if (lb.diverge && !aceitarNovaBase) r.bloqueio('LINHA_DE_BASE_DIFERENTE', 'A linha de base financeira mudou em relação à carga atual.', `diferença máx. ${lb.max}`);
  else if (lb.diverge) r.aviso('LINHA_DE_BASE_ACEITA', 'Nova linha de base financeira aceita por quem disparou a execução.');

  // corte financeiro: a data do último valor agregado registrado (o dado diz até quando vai), nunca depois de hoje
  const corte = ult ? (ult.data > hoje ? hoje : ult.data) : null;
  if (!corte) r.bloqueio('SEM_REALIZADO', 'A Curva S financeira não tem nenhum valor agregado realizado.');
  if (corte && obra.dataCorteFinanceiro && corte < obra.dataCorteFinanceiro) r.bloqueio('CORTE_ANTERIOR', 'O corte financeiro é anterior ao da carga atual.', `${corte} × ${obra.dataCorteFinanceiro}`);
  const tipos = Object.keys(d);
  const novo = retratoFinanceiro(d, tipos);
  return fechar(r, { corte, ultimoRealizado: ult ? ult.data : null, hash: hashDe(novo), inalterado: quaseIgual(novo, retratoFinanceiro(obra.financeiro, tipos)) });
}

function fechar(r, extra) {
  const bloqueado = r.v.some(x => x.nivel === 'bloqueio');
  return { verificacoes: r.v, bloqueado, ...(extra || {}) };
}

module.exports = { validarFisico, validarFinanceiro, AVISOS_INFORMATIVOS, hashDe, quaseIgual, ultimoReal };
