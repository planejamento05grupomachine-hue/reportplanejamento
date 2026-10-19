# Fluxo de trabalho Git — reportplanejamento

## Rotina do dia a dia

1. **Sincronizar** antes de começar a trabalhar:
   ```
   git pull
   ```
2. **Implementar** a mudança (direto na `main` se for pequena e segura; em branch se for maior — ver abaixo).
3. **Validar** localmente (abrir `index.html`, checar o painel, rodar `tools/gerar.cjs` se os dados mudaram).
4. **Commit**:
   ```
   git add <arquivos>
   git commit -m "mensagem curta e descritiva"
   ```
5. **Push**:
   ```
   git push
   ```

## Branches para mudanças maiores

Para upgrades mais complexos (nova funcionalidade, refatoração, mudança de estrutura de dados), evite trabalhar direto na `main`:

```
git checkout -b feature/nome-da-mudanca
# ... commits ...
git push -u origin feature/nome-da-mudanca
```

Depois, abra um Pull Request no GitHub para revisar e então mesclar na `main`. Isso mantém a `main` sempre estável e publicável.

## O que nunca fazer

- `git push --force` na `main`
- `git reset --hard` sem ter certeza do que será perdido
- Commitar segredos, chaves ou dados de clientes sem necessidade (ver `.gitignore`)
- Apagar branches de backup (`backup/...`) sem confirmar que não serão mais necessárias

## Recuperação em caso de problema

Se um merge ou push sair errado:

1. **Não** rode `reset --hard` ou `push --force` por conta própria.
2. Verifique o estado com `git status`, `git log --oneline --graph --all`.
3. Se existir uma branch `backup/...` recente, ela preserva o estado anterior — pode ser usada para comparar ou restaurar arquivos específicos.
4. Em caso de dúvida, pare e peça revisão antes de qualquer operação que reescreva histórico.

## Dados sensíveis

A pasta `tipos e arquivos/` (contratos, planilhas financeiras e relatórios por obra) é **ignorada pelo Git** (`.gitignore`) — ela alimenta `tools/gerar.cjs` para gerar os dados cifrados em `data/`, mas não deve ser versionada nem publicada.
