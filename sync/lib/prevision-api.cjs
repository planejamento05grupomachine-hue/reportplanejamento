// Cliente da API oficial do Prevision (https://api.prevision.com.br, especificação em /openapi.json) e
// adaptador para o modelo do painel. Autenticação: Bearer com o token gerado em Configurações → Token de API.
//
// O que a API oferece para o painel (conferido na especificação OpenAPI em 27/10/2026):
//   GET /construction/api/v1/projects                                  → { projects: [{ id, name }] } (6 req/min)
//   GET /construction-schedule/api/v1/project/{id}/dashboards/daily-progress?view_type&dashboard_type
//       → { lastMeasuredIn, progress: [{ date, base, expected, realized, goal }] }  (valores NÃO acumulados, por dia)
//   GET /construction-schedule/api/v1/project/{id}/dashboards/monthly-progress?view_type&dashboard_type
//       → { lastMeasuredIn, progress: [{ end_date, base, expected, realized, goal, idpm }] } (por período de fechamento)
//   view_type: monetary | percentage · dashboard_type: economic | physical — as mesmas opções "Formato" e
//   "Perspectiva" do Dashboard do Prevision.
// O que a API NÃO oferece: o Progresso por tarefas e o Cronograma com EAP e "Linha" (as atividades da API são
// serviço × lote, sem EAP). Por isso os dados físicos completos dependem da exportação pela interface.
//
// O adaptador só é usado para gravar depois de comparado com uma exportação real da mesma obra e data
// (ver `comparar`), e quando a obra tiver api.equivalenciaValidada preenchido em sync/obras.json.
'use strict';

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });
const espera = ms => new Promise(r => setTimeout(r, ms));

class PrevisionAPI {
  constructor({ token, fetch = globalThis.fetch, base = 'https://api.prevision.com.br', tentativas = 3, timeoutMs = 60000, pausaMs = 3000 }) {
    if (!token) throw erro('Falta o token da API do Prevision (PREVISION_API_TOKEN).', 'SEM_TOKEN_PREVISION');
    Object.assign(this, { token, fetch, base, tentativas, timeoutMs, pausaMs });
  }
  async get(caminho, params) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    let ultimo;
    for (let t = 0; t < this.tentativas; t++) {
      let r;
      try { r = await this.fetch(this.base + caminho + q, { headers: { Authorization: 'Bearer ' + this.token, Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) }); }
      catch (e) { ultimo = erro(`Falha de rede com a API do Prevision (${e.name}).`, 'REDE_PREVISION'); await espera(this.pausaMs * (t + 1)); continue; }
      if (r.ok) return r.json();
      if (r.status === 401 || r.status === 403) throw erro('A API do Prevision recusou o token (inválido, expirado ou sem acesso a este projeto).', 'TOKEN_PREVISION');
      if (r.status === 404) throw erro('A API do Prevision não encontrou o projeto.', 'PROJETO_PREVISION_INEXISTENTE');
      ultimo = erro(`A API do Prevision respondeu ${r.status}.`, 'PREVISION_' + r.status);
      if (r.status < 500 && r.status !== 429) throw ultimo;
      await espera(this.pausaMs * (t + 1) * (r.status === 429 ? 10 : 1));
    }
    throw ultimo;
  }
  async projetos() { return (await this.get('/construction/api/v1/projects')).projects || []; }
  async medicoes(id) { return (await this.get(`/construction-schedule/api/v1/project/${id}/measurement_tasks`)).measurement_tasks || []; }
  progressoDiario(id, view_type, dashboard_type) { return this.get(`/construction-schedule/api/v1/project/${id}/dashboards/daily-progress`, { view_type, dashboard_type }); }
  progressoMensal(id, view_type, dashboard_type) { return this.get(`/construction-schedule/api/v1/project/${id}/dashboards/monthly-progress`, { view_type, dashboard_type }); }
}

// Escala dos percentuais da API: não documentada (0–1 ou 0–100). Decide pela soma da base, que fecha a obra inteira.
function escalaPercentual(progress) {
  const soma = progress.reduce((s, p) => s + (p.base || 0), 0);
  if (Math.abs(soma - 1) < 0.01) return 1;
  if (Math.abs(soma - 100) < 1) return 100;
  throw erro(`Não reconheci a escala dos percentuais da API (a base soma ${soma}).`, 'ESCALA_API');
}

// daily-progress → Curva S do painel ({ data, base, previsto, realizado } acumulados). Como na exportação "Curva S" do
// Prevision, o realizado acumulado só aparece nos dias de medição e é 0 nos demais (conferido na obra 198 em 27/10/2026:
// os 68 dias com realizado na exportação são as 68 datas `measured_in` de measurement_tasks, inclusive medições sem
// avanço, e o valor é o acumulado do daily-progress). diasMedicao: Set de 'aaaa-mm-dd'.
function curvaDeDiario(resp, viewType, diasMedicao) {
  const prog = [...(resp.progress || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!prog.length) throw erro('A API não devolveu progresso diário.', 'API_VAZIA');
  if (!diasMedicao) throw erro('Faltam as datas de medição do projeto.', 'API_VAZIA');
  const k = viewType === 'percentage' ? escalaPercentual(prog) : 1;
  let b = 0, p = 0, r = 0;
  return prog.map(x => {
    const d = String(x.date).slice(0, 10);
    b += x.base / k; p += x.expected / k; r += x.realized / k;
    return { data: d, base: b, previsto: p, realizado: diasMedicao.has(d) ? r : 0 };
  });
}

// monthly-progress → Progresso mensal do painel ({ mes, base, previsto, realizado, idpm }, não acumulados).
// Só vale com fechamento no último dia do mês (cada período = um mês civil).
function mensalDeMensal(resp, viewType) {
  const prog = [...(resp.progress || [])].sort((a, b) => (a.end_date < b.end_date ? -1 : 1));
  if (!prog.length) throw erro('A API não devolveu progresso mensal.', 'API_VAZIA');
  const fimDoMes = s => { const d = new Date(String(s).slice(0, 10) + 'T12:00:00Z'); return new Date(d.getTime() + 864e5).getUTCDate() === 1; };
  const fora = prog.filter(x => !fimDoMes(x.end_date));
  if (fora.length) throw erro('O fechamento mensal do projeto não é no último dia do mês: os períodos não correspondem a meses.', 'FECHAMENTO_NAO_MENSAL');
  const k = viewType === 'percentage' ? escalaPercentual(prog) : 1;
  return prog.map(x => ({ mes: String(x.end_date).slice(0, 7), base: x.base / k, previsto: x.expected / k, realizado: x.realized / k, idpm: x.idpm }));
}

// Coleta pela API (só curva e mensal). Natureza: físico = perspectiva configurada + percentual; financeiro = econômica + moeda.
async function coletarAPI(api, projetoId, natureza, perspectivaFisico) {
  const [vt, dt] = natureza === 'fisico' ? ['percentage', perspectivaFisico] : ['monetary', 'economic'];
  const diario = await api.progressoDiario(projetoId, vt, dt);
  const mensal = await api.progressoMensal(projetoId, vt, dt);
  const med = await api.medicoes(projetoId);
  const dias = new Set(med.map(m => String(m.measured_in).slice(0, 10)));
  const h = x => require('crypto').createHash('sha256').update(JSON.stringify(x)).digest('hex');
  return {
    dados: { curva: curvaDeDiario(diario, vt, dias), mensal: mensalDeMensal(mensal, vt) },
    respostas: { curva: h({ diario, med }), mensal: h(mensal) },
    ultimaMedicaoPrevision: diario.lastMeasuredIn || mensal.lastMeasuredIn || null,
    parametros: { view_type: vt, dashboard_type: dt },
  };
}

// Equivalência API × exportação da mesma obra e data: maior diferença por campo nas datas/meses em comum
function comparar(api, exp) {
  const dif = (a, b, chave, campos) => {
    const mb = new Map((b || []).map(x => [x[chave], x]));
    const r = { comuns: 0, soNaAPI: 0, soNaExportacao: 0, maxDif: Object.fromEntries(campos.map(c => [c, 0])) };
    for (const x of a || []) { const y = mb.get(x[chave]); if (!y) { r.soNaAPI++; continue; } r.comuns++; campos.forEach(c => { r.maxDif[c] = Math.max(r.maxDif[c], Math.abs((x[c] || 0) - (y[c] || 0))); }); }
    r.soNaExportacao = (b || []).filter(y => !(a || []).some(x => x[chave] === y[chave])).length;
    return r;
  };
  return { curva: dif(api.curva, exp.curva, 'data', ['base', 'previsto', 'realizado']), mensal: dif(api.mensal, exp.mensal, 'mes', ['base', 'previsto', 'realizado']) };
}

module.exports = { PrevisionAPI, escalaPercentual, curvaDeDiario, mensalDeMensal, coletarAPI, comparar };
