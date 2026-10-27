// Acesso ao cofre do painel com a conta da automação — o mesmo caminho de API.entrar e API.carregarObra
// (js/api.js), com o mesmo js/cofre.js. A conta precisa de acesso interno (perfil Diretoria ou Administrador):
// é o que dá a chave do rascunho. A automação só grava o rascunho; publicar continua manual.
'use strict';
const { Cofre } = require('./ambiente.cjs');

const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });
const td = new TextDecoder();
const P = {
  acesso: 'data/acesso.json', dir: 'data/diretorio.bin',
  obra: id => `data/obras/${id}.bin`, ras: id => `data/obras/${id}.rascunho.bin`,
};

async function entrar(acessoJson, email, senha, iterPadrao) {
  if (!email || !senha) throw erro('Faltam o e-mail e a senha da conta da automação no painel (PAINEL_EMAIL / PAINEL_SENHA).', 'SEM_CREDENCIAL_PAINEL');
  const acesso = typeof acessoJson === 'string' ? JSON.parse(acessoJson) : acessoJson;
  const uid = await Cofre.idDoEmail(email);
  const e = acesso && acesso.usuarios && acesso.usuarios[uid];
  const falha = () => erro('O painel recusou o e-mail/senha da conta da automação.', 'CREDENCIAL_PAINEL');
  if (!e) throw falha();
  let uk;
  try { uk = await Cofre.decifrar(await Cofre.chaveDaSenha(senha, Cofre.unb64(e.s), e.i || iterPadrao), Cofre.unb64(e.p)); } catch (x) { throw falha(); }
  const ch = JSON.parse(td.decode(await Cofre.decifrar(uk, Cofre.unb64(e.c))));
  if (!ch.ki) throw erro('A conta da automação não tem acesso interno: use perfil Diretoria (ou Administrador).', 'PERFIL_SEM_ACESSO_INTERNO');
  return {
    uid, perfil: ch.perfil,
    ki: Cofre.unb64(ch.ki),
    chaveObra: id => (ch.obras && ch.obras[id] ? Cofre.unb64(ch.obras[id]) : null),
    obras: Object.keys(ch.obras || {}),
  };
}

async function abrir(chave, bytes) { return bytes ? Cofre.desempacotarJSON(await Cofre.decifrar(chave, bytes)) : null; }

// arquivos: { caminho: { bytes } | null } — como vem de GitHub.retrato
async function lerObra(sessao, arquivos, id) {
  const k = sessao.chaveObra(id);
  if (!k) throw erro(`A conta da automação não tem a chave da obra ${id}.`, 'SEM_CHAVE_OBRA');
  const a = arquivos[P.obra(id)], r = arquivos[P.ras(id)];
  if (!a) throw erro(`A obra ${id} não existe no painel.`, 'OBRA_INEXISTENTE');
  let pub, ras;
  try { pub = await abrir(k, a.bytes); ras = r ? await abrir(sessao.ki, r.bytes) : null; }
  catch (e) { throw erro(`Não consegui abrir os dados da obra ${id} (chaves trocadas?).`, 'CHAVE_INVALIDA'); }
  return { pub, ras };
}

async function cifrarRascunho(sessao, ras) { return Cofre.cifrar(sessao.ki, await Cofre.empacotarJSON(ras)); }

module.exports = { P, entrar, lerObra, cifrarRascunho, abrir };
