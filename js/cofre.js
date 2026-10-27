// ============================================================
// Painel de Obras Machine — cofre: criptografia e empacotamento dos dados cifrados.
// O mesmo arquivo serve o navegador (window.Cofre, usado por js/api.js) e o Node (module.exports,
// usado pela sincronização automática em sync/), para os dois gravarem exatamente o mesmo formato.
// Cifra AES-256-GCM (IV de 12 bytes à frente); senha → chave por PBKDF2-SHA256.
// Pacote JSON: byte 1 = JSON comprimido (gzip) · 2 = JSON puro.
// ============================================================
(function (root) {
  'use strict';
  const subtle = root.crypto.subtle;
  const te = new TextEncoder(), td = new TextDecoder();

  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const aleatorio = n => root.crypto.getRandomValues(new Uint8Array(n));
  const erro = (msg, codigo) => Object.assign(new Error(msg), { codigo });

  const importar = raw => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function cifrar(chave, bytes) {
    const k = chave instanceof root.CryptoKey ? chave : await importar(chave);
    const iv = aleatorio(12);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out;
  }
  async function decifrar(chave, buf) {
    const k = chave instanceof root.CryptoKey ? chave : await importar(chave);
    const u = new Uint8Array(buf);
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) }, k, u.subarray(12)));
  }
  async function chaveDaSenha(senha, salt, iter) {
    const base = await subtle.importKey('raw', te.encode(String(senha).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function idDoEmail(email) {
    const h = new Uint8Array(await subtle.digest('SHA-256', te.encode('mp-painel|' + String(email).trim().toLowerCase())));
    return [...h.subarray(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function gzip(bytes, modo) {
    const s = new Blob([bytes]).stream().pipeThrough(modo === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function empacotarJSON(obj) {
    const raw = te.encode(JSON.stringify(obj));
    const ok = typeof CompressionStream !== 'undefined';
    const corpo = ok ? await gzip(raw, 'c') : raw;
    const out = new Uint8Array(corpo.length + 1); out[0] = ok ? 1 : 2; out.set(corpo, 1); return out;
  }
  async function desempacotarJSON(u8) {
    if (u8[0] === 1) return JSON.parse(td.decode(await gzip(u8.subarray(1), 'd')));
    if (u8[0] === 2) return JSON.parse(td.decode(u8.subarray(1)));
    throw erro('Formato de arquivo desconhecido.');
  }

  const api = { b64, unb64, aleatorio, cifrar, decifrar, chaveDaSenha, idDoEmail, empacotarJSON, desempacotarJSON };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cofre = api;
})(typeof window !== 'undefined' ? window : globalThis);
