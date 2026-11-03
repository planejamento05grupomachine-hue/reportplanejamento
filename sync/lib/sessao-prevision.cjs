// Sessão do Prevision usada pela exportação automática: validade e envio para o segredo do GitHub.
// A sessão vale cerca de 3 dias (cookie _ust_valid_, ver sync/README.md); a rotina roda toda sexta às 14:00 de Brasília.
'use strict';

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });
// Execução semanal: sexta 17:00 UTC (14:00 em Brasília, sem horário de verão desde 2019). A sessão precisa durar até o
// fim da execução: início + 60 minutos de folga (o job tem limite de 45).
const EXECUCAO = { diaSemana: 5, horaUTC: 17, folgaMin: 60 };

function proximaExecucao(agora = new Date()) {
  const d = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(), EXECUCAO.horaUTC, 0, 0));
  while (d.getUTCDay() !== EXECUCAO.diaSemana || d <= agora) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// storageState do Playwright → quando a sessão para de abrir o Prevision (o menor vencimento entre os cookies que
// a mantêm: _ust_valid_ e _ust_; sem eles, a sessão não serve)
function vencimento(estado) {
  const st = typeof estado === 'string' ? JSON.parse(estado) : estado;
  const ck = ((st && st.cookies) || []).filter(c => /prevision/i.test(c.domain || '') && /^_ust_(valid_)?$/.test(c.name));
  if (!ck.length) throw erro('A sessão salva não tem os cookies de login do Prevision. Renove com: node sync/sessao.cjs --enviar', 'SEM_SESSAO_PREVISION');
  const exp = ck.map(c => c.expires).filter(e => e && e > 0);
  return exp.length ? new Date(Math.min(...exp) * 1000) : null; // null = cookie de sessão do navegador (sem data)
}

function cobre(estado, agora = new Date()) {
  const venc = vencimento(estado), exec = proximaExecucao(agora);
  const ate = new Date(exec.getTime() + EXECUCAO.folgaMin * 60000);
  return { vencimento: venc, proximaExecucao: exec, ok: !!venc && venc >= ate, vencida: !!venc && venc <= agora };
}

// Envia o conteúdo para o segredo PREVISION_SESSAO do repositório (cifra com a chave pública do repositório,
// "sealed box" do libsodium, como o GitHub exige). Token: fine-grained, só este repositório, "Secrets: Read and write".
async function enviarSegredo({ conteudo, token, owner, repo, nome = 'PREVISION_SESSAO', fetch = globalThis.fetch }) {
  if (!token) throw erro('Falta o token para gravar o segredo (PAINEL_SEGREDOS_TOKEN ou ~/.painel-sync/github-segredos.token).', 'SEM_TOKEN_GITHUB');
  const sodium = require('libsodium-wrappers');
  await sodium.ready;
  const h = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'painel-sync-sessao' };
  const base = `https://api.github.com/repos/${owner}/${repo}/actions/secrets`;
  const rk = await fetch(`${base}/public-key`, { headers: h });
  if (rk.status === 401) throw erro('Token do GitHub recusado (401).', 'TOKEN_GITHUB');
  if (!rk.ok) throw erro(`O token não lê os segredos do repositório (${rk.status}). Ele precisa de "Secrets: Read and write".`, 'PERMISSAO_GITHUB');
  const { key, key_id } = await rk.json();
  const cifrado = sodium.crypto_box_seal(sodium.from_string(conteudo), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
  const rp = await fetch(`${base}/${nome}`, { method: 'PUT', headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ encrypted_value: sodium.to_base64(cifrado, sodium.base64_variants.ORIGINAL), key_id }) });
  if (!rp.ok) throw erro(`O GitHub não aceitou o segredo (${rp.status}).`, 'PERMISSAO_GITHUB');
  return true;
}

module.exports = { EXECUCAO, proximaExecucao, vencimento, cobre, enviarSegredo };
