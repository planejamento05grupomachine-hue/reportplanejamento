// Fontes externas (Sienge, Diário de Obra) e sessão do Prevision — só dados fictícios, sem rede.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { execFileSync } = require('child_process');
const { SomenteLeitura, esqueleto, codigoNoNome } = require('../lib/somente-leitura.cjs');
const sienge = require('../lib/sienge.cjs');
const diario = require('../lib/diario-obra.cjs');
const sessao = require('../lib/sessao-prevision.cjs');

// fetch fictício: registra as chamadas e responde na ordem dada
function fetchFalso(respostas) {
  const chamadas = [];
  const f = async (url, opts) => {
    chamadas.push({ url, opts });
    const r = respostas.length > 1 ? respostas.shift() : respostas[0];
    if (r instanceof Error) throw r;
    return { ok: r.status < 400, status: r.status, text: async () => r.corpo === undefined ? '' : JSON.stringify(r.corpo) };
  };
  f.chamadas = chamadas;
  return f;
}

test('somente leitura: qualquer método além de GET é bloqueado antes de sair da máquina', async () => {
  const f = fetchFalso([{ status: 200, corpo: {} }]);
  const c = new SomenteLeitura({ nome: 'Teste', base: 'https://api.exemplo.com', fetch: f, prefixoCodigo: 'T' });
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    await assert.rejects(() => c.requisicao(m, 'v1/x'), e => e.codigo === 'SOMENTE_LEITURA');
  }
  assert.equal(f.chamadas.length, 0, 'nenhuma requisição saiu');
  await c.get('v1/x', { a: 1, vazio: '' });
  assert.equal(f.chamadas[0].opts.method, 'GET');
  assert.equal(f.chamadas[0].url, 'https://api.exemplo.com/v1/x?a=1');
});

test('somente leitura: 401 e 403 param na hora com código próprio; 500 tenta de novo', async () => {
  const mk = resp => new SomenteLeitura({ nome: 'Teste', base: 'https://api.exemplo.com', fetch: fetchFalso(resp), prefixoCodigo: 'T', pausaMs: 1 });
  await assert.rejects(() => mk([{ status: 401 }]).get('v1/x'), e => e.codigo === 'CREDENCIAL_T');
  await assert.rejects(() => mk([{ status: 403 }]).get('v1/x'), e => e.codigo === 'PERMISSAO_T');
  const f = fetchFalso([{ status: 500 }, { status: 502 }, { status: 200, corpo: { ok: 1 } }]);
  const c = new SomenteLeitura({ nome: 'Teste', base: 'https://api.exemplo.com', fetch: f, prefixoCodigo: 'T', pausaMs: 1 });
  assert.deepEqual(await c.get('v1/x'), { ok: 1 });
  assert.equal(f.chamadas.length, 3);
});

test('Sienge: Basic com o usuário de API, URL da empresa e paginação por offset/limit', async () => {
  const pag = (n, off, total) => ({ status: 200, corpo: { resultSetMetadata: { count: total, offset: off, limit: 2 }, results: Array.from({ length: n }, (_, i) => ({ id: off + i })) } });
  const f = fetchFalso([pag(2, 0, 5), pag(2, 2, 5), pag(1, 4, 5)]);
  const s = new sienge.Sienge({ subdominio: 'empresa', usuario: 'api-leitura', senha: 'segredo', fetch: f });
  const todos = await s.todos('v1/purchase-requests', {}, { limite: 2 });
  assert.deepEqual(todos.map(x => x.id), [0, 1, 2, 3, 4]);
  assert.match(f.chamadas[0].url, /^https:\/\/api\.sienge\.com\.br\/empresa\/public\/api\/v1\/purchase-requests\?limit=2&offset=0$/);
  assert.equal(f.chamadas[0].opts.headers.Authorization, 'Basic ' + Buffer.from('api-leitura:segredo').toString('base64'));
  assert.ok(!f.chamadas.some(c => c.url.includes('segredo')), 'a senha nunca vai na URL');
});

test('Sienge e Diário de Obra: sem variáveis = não configurado; variáveis pela metade = erro claro', () => {
  assert.equal(sienge.deAmbiente({}), null);
  assert.throws(() => sienge.deAmbiente({ SIENGE_SUBDOMINIO: 'empresa' }), e => e.codigo === 'CONFIG_SIENGE');
  assert.throws(() => sienge.deAmbiente({ SIENGE_SUBDOMINIO: 'empresa.com/x', SIENGE_USUARIO: 'u', SIENGE_SENHA: 's' }), e => e.codigo === 'CONFIG_SIENGE');
  assert.equal(diario.deAmbiente({}), null);
});

test('Diário de Obra: token no cabeçalho "token" e rotas oficiais da API externa', async () => {
  const f = fetchFalso([{ status: 200, corpo: [{ _id: 'a1', nome: '208 - Obra teste' }] }]);
  const d = new diario.DiarioObra({ token: 'tk', fetch: f });
  const obras = diario.lista(await d.obras());
  await d.relatorios('a1', { limite: 5, ordem: 'asc' });
  assert.equal(obras.length, 1);
  assert.equal(f.chamadas[0].url, 'https://apiexterna.diariodeobra.app/v1/obras');
  assert.equal(f.chamadas[0].opts.headers.token, 'tk');
  assert.equal(f.chamadas[1].url, 'https://apiexterna.diariodeobra.app/v1/obras/a1/relatorios?limite=5&ordem=asc');
});

test('diagnóstico: estrutura sem valores e código da obra no nome', () => {
  assert.deepEqual(esqueleto({ nome: 'Fulano', valor: 10.5, itens: [{ qtd: 3, sub: { x: null } }], ok: true }),
    { nome: 'string', valor: 'number', itens: [{ qtd: 'number', sub: { x: 'null' } }], ok: 'boolean' });
  assert.equal(codigoNoNome('208 - Fibrasa Galpão'), '208');
  assert.equal(codigoNoNome('Obra 211 SOTREQ'), '211');
  assert.equal(codigoNoNome('Galpão 2026'), null, 'ano não é código de obra');
  assert.equal(codigoNoNome('Mapeamento - SOTREQ (obra 211)'), '211');
  assert.equal(codigoNoNome('Sem código'), null);
});

test('diagnóstico sem nenhuma credencial: termina bem e diz "não configurado"', () => {
  const env = { ...process.env }; ['SIENGE_SUBDOMINIO', 'SIENGE_USUARIO', 'SIENGE_SENHA', 'DIARIO_TOKEN'].forEach(k => delete env[k]);
  // pasta de usuário vazia: o ~/.painel-sync/fontes.env de quem roda o teste não entra
  const vazio = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sem-fontes-')); env.HOME = vazio; env.USERPROFILE = vazio; delete env.GITHUB_ACTIONS;
  const out = execFileSync(process.execPath, [path.join(__dirname, '..', 'fontes-externas.cjs'), '--verificar'], { env, encoding: 'utf8' });
  assert.equal((out.match(/não configurado/g) || []).length, 2);
});

test('sessão do Prevision: próxima execução é sexta 17:00 UTC e a validade sai do cookie de login', () => {
  assert.equal(sessao.proximaExecucao(new Date('2026-11-03T15:00:00Z')).toISOString(), '2026-11-06T17:00:00.000Z');
  assert.equal(sessao.proximaExecucao(new Date('2026-11-06T16:59:00Z')).toISOString(), '2026-11-06T17:00:00.000Z');
  assert.equal(sessao.proximaExecucao(new Date('2026-11-06T17:00:00Z')).toISOString(), '2026-11-13T17:00:00.000Z');
  const st = venceValid => ({ cookies: [
    { name: '_ust_valid_', domain: '.prevision.com.br', expires: Date.parse(venceValid) / 1000 },
    { name: '_ust_', domain: '.prevision.com.br', expires: Date.parse('2026-11-20T00:00:00Z') / 1000 },
    { name: 'outro', domain: '.google.com', expires: Date.parse('2026-11-04T00:00:00Z') / 1000 }] });
  const agora = new Date('2026-11-04T18:00:00Z');
  assert.equal(sessao.cobre(st('2026-11-07T00:00:00Z'), agora).ok, true, 'login na quarta cobre a sexta');
  assert.equal(sessao.cobre(st('2026-11-06T17:30:00Z'), agora).ok, false, 'precisa durar até o fim da execução');
  assert.equal(sessao.cobre(st('2026-11-05T00:00:00Z'), agora).ok, false);
  assert.throws(() => sessao.vencimento({ cookies: [] }), e => e.codigo === 'SEM_SESSAO_PREVISION');
});
