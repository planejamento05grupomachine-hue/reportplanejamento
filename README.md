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
   mapa, ou obra sem mapa, em grade de 12 por folha) e **Mapa de avanço** (uma ou duas plantas por folha).
   Com espaço sobrando, as etapas do avanço por atividade abrem sozinhas; as que não cabem seguem numa folha de
   continuação. Listas longas mostram os primeiros itens; o aviso "+N na aba Obra" aparece só na tela, não no PDF.
   O **Manual do RDO** (menu da conta, uso interno) traz o padrão de preenchimento do diário e mede, nos RDOs carregados,
   quanto de cada campo cada obra preenche, com exemplos da obra de referência.
7. **Acessos** — aprovado um pedido, crie o acesso: o painel gera a senha e prepara o e-mail de envio.

Cada gravação vira um commit neste repositório; o site atualiza em cerca de um minuto.

## Configuração inicial (uma vez)

Na primeira abertura depois da atualização, o painel mostra **Proteger o painel**: informe nome, e-mail e senha
do administrador e o token do GitHub. O painel cifra a carga atual (`legado/seed.json` e `assets/fotos/`), cria o primeiro acesso,
apaga os arquivos em claro e, com a opção marcada, reinicia o histórico do repositório sem as versões antigas.

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
js/api.js         cofre (criptografia) e publicação no GitHub
js/parsers.js     leitura das planilhas do Prevision e do PDF de RDOs
js/core.js        cálculos e gráficos
js/app.js         telas
data/             dados cifrados (gravados pelo próprio painel)
tools/gerar.cjs   exportação do report em PDF
```
