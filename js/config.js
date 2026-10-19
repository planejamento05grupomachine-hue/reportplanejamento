// Painel de Obras Machine — configuração pública (sem segredos).
window.MP_CONFIG = {
  // Repositório onde o painel publica os dados cifrados (GitHub Pages)
  github: { owner: 'planejamento05grupomachine-hue', repo: 'reportplanejamento', branch: null /* null = branch padrão do repositório */ },
  // Pedidos de acesso e de nova senha
  emailAcesso: 'planejamento05@grupomachine.com.br',
  // Custo da derivação da senha (PBKDF2-SHA256). Não reduzir.
  iteracoes: 600000,
};
