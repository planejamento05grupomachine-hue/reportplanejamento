// Exportações fictícias do Prevision, no mesmo formato das reais (conferido com as da obra 198 em 27/10/2026):
// Curva S e Progresso mensal = tabela HTML do Highcharts salva como .xls (decimal com vírgula);
// Progresso por tarefas = .xlsx com "12.34%" (ou "R$ 1.234,56" no financeiro); Cronograma = .xlsx com título na 1ª linha.
// Um projeto fictício coerente: a curva, o mensal, as tarefas e o cronograma saem das mesmas tarefas e pesos.
'use strict';
const fs = require('fs');
const path = require('path');

const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const dia = iso => new Date(iso + 'T12:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const somaDias = (a, n) => iso(new Date(dia(a).getTime() + n * 864e5));
const difDias = (a, b) => Math.round((dia(b) - dia(a)) / 864e5);
const br = s => s.split('-').reverse().join('/');
const fimDoMes = m => { const [y, mo] = m.split('-').map(Number); return iso(new Date(Date.UTC(y, mo, 0, 12))); };
const virgula = v => (v === 0 ? '0' : v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '').replace('.', ','));
const reais = v => 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const TAREFAS = [
  ['01.01.01', 'Mobilização de canteiro', '2026-01-05', '2026-02-13', 0.05],
  ['01.01.02', 'Terraplenagem', '2026-02-02', '2026-04-10', 0.15],
  ['01.01.03', 'Fundações', '2026-03-16', '2026-06-12', 0.20],
  ['01.02.01', 'Estrutura metálica', '2026-05-04', '2026-08-28', 0.25],
  ['01.02.02', 'Cobertura', '2026-07-06', '2026-10-02', 0.20],
  ['01.02.03', 'Acabamentos', '2026-08-17', '2026-11-27', 0.15],
];

function projeto({ codigo = '901', nomeObra = 'Obra Teste', raiz = 'CONTRATO OBRA TESTE', medicao = '2026-07-10', hoje = '2026-07-15', ritmo = 0.9, valor = 5000000, pesoExtra = 0 } = {}) {
  const tarefas = TAREFAS.map(([eap, nome, ini, fim, peso], i) => ({ eap, nome, ini, fim, peso: i === 0 ? peso + pesoExtra : peso - (i === 1 ? pesoExtra : 0) }));
  const frac = (t, d) => Math.max(0, Math.min(1, (difDias(t.ini, d) + 1) / (difDias(t.ini, t.fim) + 1)));
  const base = d => tarefas.reduce((s, t) => s + t.peso * frac(t, d), 0);
  const real = d => base(d > medicao ? medicao : d) * ritmo;
  const inicio = tarefas[0].ini, fim = tarefas.at(-1).fim;
  const grupos = [['01', raiz], ['01.01', 'INFRAESTRUTURA'], ['01.02', 'EDIFICAÇÃO']];
  const folhasDe = eap => tarefas.filter(t => t.eap === eap || t.eap.startsWith(eap + '.'));
  const nos = [];
  for (const [eap, nome] of grupos) {
    nos.push({ eap, nome, grupo: true });
    if (eap !== '01') tarefas.filter(t => t.eap.startsWith(eap + '.')).forEach(t => nos.push({ ...t, grupo: false }));
  }
  nos.forEach(n => { const f = folhasDe(n.eap); n.ini = f.map(t => t.ini).sort()[0]; n.fim = f.map(t => t.fim).sort().at(-1); n.peso = f.reduce((s, t) => s + t.peso, 0);
    n.realPeso = f.reduce((s, t) => s + t.peso * frac(t, medicao) * ritmo, 0); n.basePesoHoje = f.reduce((s, t) => s + t.peso * frac(t, hoje), 0); });
  return { codigo, nomeObra, raiz, medicao, hoje, ritmo, valor, tarefas, nos, frac, base, real, inicio, fim };
}

function htmlXls(titulo, cab, linhas) {
  const th = c => `<th class="highcharts-text" scope="col">${c}</th>`;
  const tr = l => `<tr><th class="highcharts-text" scope="row">${l[0]}</th>${l.slice(1).map(v => `<td class="highcharts-number">${v}</td>`).join('')}</tr>`;
  return String.fromCharCode(0xfeff) + '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset=UTF-8></head><body><table>'
    + `<caption class="highcharts-table-caption">${titulo}</caption><thead><tr>${cab.map(th).join('')}</tr></thead><tbody>${linhas.map(tr).join('')}</tbody></table></body></html>`;
}
function xlsx(XLSX, aoa, aba) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), aba);
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

function curvaS(p, k = 1) {
  const linhas = [];
  for (let d = p.inicio; d <= p.fim; d = somaDias(d, 1)) linhas.push([br(d), virgula(p.base(d) * k), virgula(p.base(d) * k), virgula(d <= p.medicao ? p.real(d) * k : 0)]);
  return htmlXls('Curva S', ['Dia', 'Base', 'Previsto', 'Realizado'], linhas);
}
function mensal(p, k = 1) {
  const meses = []; for (let m = p.inicio.slice(0, 7); m <= p.fim.slice(0, 7); m = somaDias(fimDoMes(m), 1).slice(0, 7)) meses.push(m);
  const ant = m => somaDias(m + '-01', -1);
  const linhas = meses.map(m => { const f = fimDoMes(m), a = ant(m), db = p.base(f) - p.base(a), dr = p.real(f) - p.real(a);
    return [`${MES[+m.slice(5) - 1]}/${m.slice(0, 4)}`, virgula(db * k), virgula(db * k), virgula(dr * k), '0']; });
  return htmlXls('Progresso Mensal', ['Mês', 'Base', 'Previsto', 'Realizado', 'IDPM'], linhas);
}
function tarefas(XLSX, p, { k = 1, filtroPeriodo = false } = {}) {
  const fmt = v => (k === 1 ? (v * 100).toFixed(2) + '%' : reais(v * k));
  const mesIni = p.hoje.slice(0, 7) + '-01', mesFim = fimDoMes(p.hoje.slice(0, 7));
  const linhas = p.nos.map(n => {
    let b = n.peso, pr = n.peso, r = n.realPeso;
    if (filtroPeriodo) { const f = p.tarefas.filter(t => t.eap === n.eap || t.eap.startsWith(n.eap + '.')); const noMes = t => t.peso * (p.frac(t, mesFim) - p.frac(t, somaDias(mesIni, -1))); b = pr = f.reduce((s, t) => s + noMes(t), 0); r = b * p.ritmo * 0.5; }
    return [n.eap, n.nome, br(n.ini), br(n.fim), fmt(b), fmt(pr), fmt(r), '0'];
  });
  return xlsx(XLSX, [['EAP', 'Tarefa', 'Início', 'Fim', 'Base', 'Previsto', 'Realizado', 'Atraso (dias)'], ...linhas], 'Planilha1');
}
function cronograma(XLSX, p) {
  const proprio = (n, v) => (n.peso ? v / n.peso : 0);
  const linhas = p.nos.map((n, i) => [String(i + 1), `"${n.eap}"`, n.nome, br(n.ini), br(n.fim), `${difDias(n.ini, n.fim) + 1} Dias`, '', '', br(n.ini), br(n.fim),
    n.eap === '01.02.03' ? 'Pendente de contratação' : n.grupo ? '' : 'Empresa Ficticia Ltda',
    (proprio(n, n.basePesoHoje) * 100).toFixed(2), (proprio(n, n.realPeso) * 100).toFixed(2), '', (proprio(n, n.basePesoHoje) * 100).toFixed(2)]);
  const cab = ['Linha', 'EAP', 'Nome', 'Início', 'Fim', 'Duração', 'Predecessoras', 'Sucessoras', 'Início (Base)', 'Fim (Base)', 'Responsáveis', 'Previsto (%)', 'Realizado (%)', 'Desvio', 'Base (%)'];
  return xlsx(XLSX, [['Cronograma', ...cab.slice(1).map(() => '')], cab, ...linhas], 'Cronograma');
}

// Escreve <dir>/<codigo>/fisico e /financeiro como a exportação faria. opcoes: { faltar: [tipos], filtroPeriodo, tarefasFinanceiro }
function escreverColeta(XLSX, dir, p, opcoes = {}) {
  const falta = new Set(opcoes.faltar || []);
  const nome = `${p.codigo} - ${p.nomeObra}`;
  const fis = path.join(dir, p.codigo, 'fisico');
  const fin = path.join(dir, p.codigo, 'financeiro');
  fs.mkdirSync(fis, { recursive: true }); fs.mkdirSync(fin, { recursive: true });
  const w = (pasta, arq, conteudo, tipo) => { if (!falta.has(tipo)) fs.writeFileSync(path.join(pasta, arq), conteudo); };
  w(fis, `Curva S - ${nome}.xls`, curvaS(p), 'curva');
  w(fis, 'progresso-mensal.xls', mensal(p), 'mensal');
  w(fis, 'Progresso por tarefas.xls', tarefas(XLSX, p, { filtroPeriodo: opcoes.filtroPeriodo }), 'tarefas');
  w(fis, `Cronograma - ${nome}.xlsx`, cronograma(XLSX, p), 'cronograma');
  w(fin, `Curva S - ${nome}.xls`, curvaS(p, p.valor), 'fin.curva');
  w(fin, 'progresso-mensal.xls', mensal(p, p.valor), 'fin.mensal');
  if (opcoes.tarefasFinanceiro) w(fin, 'Progresso por tarefas.xls', tarefas(XLSX, p, { k: p.valor }), 'fin.tarefas');
  return { fisico: fis, financeiro: fin };
}

module.exports = { projeto, escreverColeta, curvaS, mensal, tarefas, cronograma, somaDias };
