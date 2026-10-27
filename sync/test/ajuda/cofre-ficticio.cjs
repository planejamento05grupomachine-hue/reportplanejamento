// Cofre fictício no mesmo formato que o painel grava (API.configurar, novaEntrada, chaveiroDe e salvarObra em js/api.js),
// usando o mesmo js/cofre.js. Iterações do PBKDF2 baixas só para o teste ficar rápido (o campo `i` de cada entrada
// guarda o número usado, como no painel).
'use strict';
const { Cofre } = require('../../lib/ambiente.cjs');
const te = new TextEncoder();

async function criarCofre({ usuarios, obras, iter = 2000 }) {
  const MK = Cofre.aleatorio(32);
  const DIR = { usuarios: {}, chaves: {}, ki: Cofre.b64(Cofre.aleatorio(32)), criadoEm: '2026-01-01T00:00:00Z' };
  const ACESSO = { versao: 1, cifra: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', usuarios: {} };
  for (const o of obras) DIR.chaves[o.id] = Cofre.b64(Cofre.aleatorio(32));
  const chaveiroDe = uid => {
    const u = DIR.usuarios[uid]; const interno = u.perfil !== 'cliente';
    const c = { uid, nome: u.nome, email: u.email, perfil: u.perfil, obras: Object.fromEntries(Object.entries(DIR.chaves).filter(([id]) => interno || (u.obras || []).includes(id))) };
    if (interno) c.ki = DIR.ki;
    if (u.perfil === 'admin') c.mk = Cofre.b64(MK);
    return c;
  };
  for (const u of usuarios) {
    const uid = await Cofre.idDoEmail(u.email);
    DIR.usuarios[uid] = { nome: u.nome, email: u.email, perfil: u.perfil, obras: u.obras || [], criadoEm: '2026-01-01T00:00:00Z', senhaEm: '2026-01-01T00:00:00Z' };
    const uk = Cofre.aleatorio(32), s = Cofre.aleatorio(16);
    const pk = await Cofre.chaveDaSenha(u.senha, s, iter);
    ACESSO.usuarios[uid] = { s: Cofre.b64(s), i: iter, p: Cofre.b64(await Cofre.cifrar(pk, uk)), a: Cofre.b64(await Cofre.cifrar(MK, uk)), c: '' };
    ACESSO.usuarios[uid].c = Cofre.b64(await Cofre.cifrar(uk, te.encode(JSON.stringify(chaveiroDe(uid)))));
  }
  const arquivos = {
    'data/acesso.json': te.encode(JSON.stringify({ ...ACESSO, atualizadoEm: '2026-01-01T00:00:00Z' }, null, 1)),
    'data/diretorio.bin': await Cofre.cifrar(MK, await Cofre.empacotarJSON(DIR)),
  };
  for (const o of obras) {
    arquivos[`data/obras/${o.id}.bin`] = await Cofre.cifrar(Cofre.unb64(DIR.chaves[o.id]), await Cofre.empacotarJSON(o.pub));
    if (o.ras) arquivos[`data/obras/${o.id}.rascunho.bin`] = await Cofre.cifrar(Cofre.unb64(DIR.ki), await Cofre.empacotarJSON(o.ras));
  }
  return { arquivos, ki: Cofre.unb64(DIR.ki), chaveObra: id => Cofre.unb64(DIR.chaves[id]) };
}

async function abrir(chave, bytes) { return Cofre.desempacotarJSON(await Cofre.decifrar(chave, bytes)); }

module.exports = { criarCofre, abrir };
