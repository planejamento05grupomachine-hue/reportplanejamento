// Lê os arquivos coletados com os mesmos parsers da tela Alimentar (js/parsers.js).
// A natureza (físico × financeiro) vem do modo de coleta — a pasta/perspectiva em que o arquivo foi exportado —,
// nunca do nome nem do cabeçalho, que são iguais nos dois casos. O tipo (curva, mensal...) vem do cabeçalho.
'use strict';
const fs = require('fs');
const path = require('path');
const { Parsers, sha256 } = require('./ambiente.cjs');

const TIPOS = { fisico: ['curva', 'mensal', 'tarefas', 'cronograma'], financeiro: ['curva', 'mensal', 'tarefas'] };
const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });

function lerPlanilha(XLSX, bytes) {
  const wb = Parsers.wbDe(XLSX, bytes);
  if (Parsers.ehMedicao(wb)) return { tipo: 'medicao' };
  const linhas = Parsers.linhasDaAba(XLSX, wb, wb.SheetNames[0]);
  const tipo = Parsers.tipoPlanilha(linhas);
  const dado = tipo === 'curva' ? Parsers.parseCurva(linhas) : tipo === 'mensal' ? Parsers.parseMensal(linhas)
    : tipo === 'cronograma' ? Parsers.parseCronograma(linhas) : tipo === 'tarefas' ? Parsers.parseTarefas(linhas) : null;
  return { tipo, dado };
}

// arquivos: [{ nome, bytes, coletadoEm }] de uma mesma natureza
function lerConjunto(XLSX, natureza, arquivos) {
  const dados = {}, nomes = {}, origem = [], problemas = [];
  for (const a of arquivos) {
    const reg = { nome: a.nome, bytes: a.bytes.length, sha256: sha256(a.bytes), coletadoEm: a.coletadoEm || null };
    origem.push(reg);
    let r;
    try { r = lerPlanilha(XLSX, a.bytes); } catch (e) { problemas.push({ id: 'ARQUIVO_ILEGIVEL', arquivo: a.nome, msg: e.message }); continue; }
    reg.tipo = r.tipo;
    if (!r.tipo || !TIPOS[natureza].includes(r.tipo)) { problemas.push({ id: 'TIPO_NAO_ESPERADO', arquivo: a.nome, msg: `tipo "${r.tipo || 'desconhecido'}" não faz parte dos dados ${natureza === 'fisico' ? 'físicos' : 'financeiros'}` }); continue; }
    if (dados[r.tipo]) { problemas.push({ id: 'TIPO_DUPLICADO', arquivo: a.nome, msg: `mais de um arquivo de ${r.tipo}` }); continue; }
    if (!r.dado || !r.dado.length) { problemas.push({ id: 'ARQUIVO_VAZIO', arquivo: a.nome, msg: `${r.tipo} sem linhas` }); continue; }
    dados[r.tipo] = r.dado;
    nomes[r.tipo] = a.nome;
  }
  return { natureza, dados, nomes, origem, problemas };
}

// Pasta de uma coleta: <dir>/<obra>/fisico/* e <dir>/<obra>/financeiro/*
function arquivosDaPasta(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => /\.(xls|xlsx|csv)$/i.test(n)).sort().map(nome => {
    const p = path.join(dir, nome);
    return { nome, bytes: new Uint8Array(fs.readFileSync(p)), coletadoEm: fs.statSync(p).mtime.toISOString() };
  });
}

module.exports = { TIPOS, lerPlanilha, lerConjunto, arquivosDaPasta, erro };
