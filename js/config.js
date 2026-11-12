// Painel de Obras Machine — configuração pública (sem segredos).
window.MP_CONFIG = {
  // Repositório onde o painel publica os dados cifrados (GitHub Pages)
  github: { owner: 'planejamento05grupomachine-hue', repo: 'reportplanejamento', branch: null /* null = branch padrão do repositório */ },
  // Pedidos de acesso e de nova senha
  emailAcesso: 'planejamento05@grupomachine.com.br',
  // Custo da derivação da senha (PBKDF2-SHA256). Não reduzir.
  iteracoes: 600000,
  // Atualização pelas APIs (tela Alimentar): o botão dispara o robô do GitHub Actions. Só aparece para estes logins de
  // administrador; quem garante de fato é o GitHub, que só aceita o disparo com um token com permissão de Actions.
  // As credenciais do Prevision/Sienge/Diário ficam nos segredos do repositório, nunca no navegador.
  robo: { workflow: 'sync-prevision.yml', liberadoPara: ['planejamento05@grupomachine.com.br'] },
};
