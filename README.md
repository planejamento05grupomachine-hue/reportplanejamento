# Painel de Obras Machine — Planejamento

Portal de planejamento e report das obras da Machine, publicado no GitHub Pages:
https://planejamento05grupomachine-hue.github.io/reportplanejamento/

## Acesso

- O painel só abre com **e-mail e senha**. Não existe cadastro aberto.
- Quem não tem senha usa **Solicitar acesso** na tela de entrada. O pedido vai para
  **planejamento05@grupomachine.com.br**; o Planejamento avalia e, se aprovado, cria o acesso e envia a senha.
- Perfis:
  - **Cliente** — vê só as obras liberadas para ele e só a posição publicada.
  - **Diretoria** — vê todas as obras, inclusive rascunhos ainda não publicados.
  - **Administrador** — vê tudo e grava: cadastra obras, alimenta dados, publica e gerencia acessos.

## Segurança dos dados

O repositório é público (exigência do GitHub Pages gratuito), por isso nada fica em claro:

| Arquivo | Conteúdo | Quem abre |
|---|---|---|
| `data/acesso.json` | chaveiros das pessoas (sem nomes ou e-mails em claro) | cada um, com a própria senha |
| `data/diretorio.bin` | cadastro de acessos e chaves das obras | administradores |
| `data/obras/<obra>.bin` · `data/fotos/<obra>.bin` | posição publicada e fotos | equipe interna e clientes da obra |
| `data/obras/<obra>.rascunho.bin` · `data/fotos/<obra>.rascunho.bin` | carga ainda não publicada | administradores e diretoria |

Cifra AES-256-GCM; a senha vira chave por PBKDF2-SHA256 com 600 mil iterações. As senhas emitidas pelo
painel têm 12 caracteres aleatórios. Ao remover um acesso (ou reduzir o que alguém vê), todas as chaves são
trocadas e os dados recifrados. Depois, **Publicação → Compactar histórico** apaga as versões antigas do repositório.

## Telas

- **Portfólio** — visão executiva de todas as obras: indicadores gerais e uma coluna por obra com prazo, avanço físico,
  planejado × realizado na data, situação e pontos de atenção. No celular, cada obra vira um cartão.
- **Obra** — situação, cronograma, Curva S, avanço por mês, valor agregado, frentes, tarefas, campo (RDO), fotos,
  mapa de avanço e paralisações.
- **Report** — folhas A4 paisagem para cliente e diretoria (ver item 6 da rotina).
- **Manual de alimentação** (menu da conta, uso interno) — padrão de cada documento que atualiza o painel (cadastro,
  Cronograma, Progresso por tarefas, Curva S, Progresso mensal/semanal, RDO, plantas do mapa, Curva S financeira e
  Controle de Medição): de onde vem, quando enviar, como gerar, as colunas lidas e quanto do padrão cada obra cumpre hoje.

## Rotina do administrador

1. **Publicação (GitHub)** — informe uma vez o token de publicação (fine-grained token com acesso só a este
   repositório e permissão *Contents: Read and write*). Ele fica só no seu navegador.
2. **Cadastrar obra** — código, nome, cliente, prazo contratual e se o quadro de valor agregado entra no report
   (automático: só quando há SPI e a Curva S financeira está na base do contrato).
3. **Alimentar** — envie as exportações do Prevision (Curva S, Progresso mensal ou o `progresso-semanal`, que o painel
   soma por mês, Progresso por tarefas, Cronograma) e o PDF dos diários de obra exportado da plataforma RDO. O PDF
   pode ser grande (60 MB ou mais): a tela mostra o andamento página a página e só libera o salvar no fim; das fotos,
   ficam as dos últimos 35 dias do PDF. A carga entra como **rascunho**.
4. **Mapa de avanço** (aba Obra) — envie a planta da obra (PDF, escolhendo a página, ou imagem) e demarque as áreas
   da frente de serviço: retângulo (arrastar) ou polígono (clicar nos cantos); depois cada área pode ser movida, girada
   e ajustada canto a canto. Classifique cada uma em Executado, Executando ou A executar. Área vinculada a uma atividade
   do cronograma muda de cor sozinha a cada carga. O mapa vai para o rascunho.
5. Confira na tela da obra e clique em **Publicar para o cliente**.
6. **Report → Baixar PDF** gera o report em folhas A4 paisagem, uma página do PDF por folha, com o mesmo desenho em
   todas as obras: **Visão geral** (indicadores, leitura do período, Curva S, marcos e pontos de atenção), **Andamento
   das frentes** (avanço por atividade e campo no último RDO), **Valor agregado** (quando entra no report), **Registro
   fotográfico** (uma foto do serviço e, ao lado, a planta da frente com a área do serviço destacada; fotos sem frente no
   mapa, ou obra sem mapa, em grade de 12 por folha) e **Mapa de avanço** (uma ou duas plantas por folha; a folha de uma
   planta traz também o quadro da frente — início e término planejados, término atual quando há desvio, o que está em
   execução, e o quantitativo macro por situação, nº de áreas e % da planta — além da tabela por área e da legenda).
   Com espaço sobrando, as etapas do avanço por atividade abrem sozinhas; as que não cabem seguem numa folha de
   continuação. Listas longas mostram os primeiros itens; o aviso "+N na aba Obra" aparece só na tela, não no PDF.
   O **Manual de alimentação** (menu da conta, uso interno) traz a rotina semanal e mensal, o padrão de cada documento e
   a situação de cada obra (quanto do padrão aparece na carga, datas da última carga e da posição publicada), com a obra
   de referência de cada item e exemplos reais do RDO.
7. **Acessos** — aprovado um pedido, crie o acesso: o painel gera a senha e prepara o e-mail de envio.

Cada gravação vira um commit neste repositório; o site atualiza em cerca de um minuto.

**Sincronização automática com o Prevision** (`sync/`): toda quarta-feira às 07:15 a rotina do GitHub Actions pode coletar
os dados físicos e de valor agregado das obras configuradas e gravar como **rascunho** (a publicação continua manual). Ela
usa os mesmos parsers e as mesmas regras da tela Alimentar. Estado, segredos e operação: `sync/README.md`.

## Configuração inicial (uma vez)

Num repositório sem acessos (`data/acesso.json` vazio ou ausente), o painel mostra **Proteger o painel**: informe nome,
e-mail e senha do administrador e o token do GitHub. O painel cria as chaves e o primeiro acesso e, com a opção marcada,
reinicia o histórico do repositório. As obras são cadastradas depois, em **Cadastrar obra**.

## PDF por linha de comando

```
MP_EMAIL=... MP_SENHA=... node tools/gerar.cjs --obra 207 --saida ./saida
```

Precisa do Playwright. O PDF mostra o que a conta usada enxerga.

## Estrutura

```
index.html        página
css/              app.css (painel) · report.css (report executivo)
js/config.js      repositório e e-mail de acesso
js/cofre.js       criptografia e empacotamento (navegador e sincronização)
js/api.js         sessão, acessos e publicação no GitHub
js/parsers.js     leitura das planilhas do Prevision e do PDF de RDOs
js/core.js        cálculos e gráficos
js/carga.js       conferência e fusão da carga no rascunho (tela Alimentar e sincronização)
js/app.js         telas
data/             dados cifrados (gravados pelo próprio painel)
sync/             sincronização semanal com o Prevision (ver sync/README.md)
tools/gerar.cjs   exportação do report em PDF
```
