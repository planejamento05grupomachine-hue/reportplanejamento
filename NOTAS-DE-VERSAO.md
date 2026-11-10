# Notas de versão — Painel de Obras Machine

## 2026-11-10c · Report coerente com as ferramentas

Revisão completa feita com Sienge, Prevision, Diário de Obra e o próprio painel. A régua do avanço da obra é sempre a
**perspectiva física (duração) do Prevision**.

**Números e regras**
- Farol de prazo compara o índice como ele aparece (2 casas): o mesmo número nunca tem duas cores.
- Prazo com dois números, cada um com o seu nome: *Hoje: N dias de atraso* (prazo ganho) e *Variação do término*
  (cronograma × contrato). Farol verde com alguns dias atrás do plano aparece como "N dias, na tolerância".
- Contrato vencido aparece como "Vencido há N dias" (antes, "A vencer 0 dias").
- Dashboard mostra a data da última medição física quando ela é anterior ao corte.
- Tabela Previsto × Realizado: marcos, aditivos condicionados e taxa de administração num bloco à parte, sem setas de
  desvio; nome da obra pelo cadastro; a tabela compacta sozinha até caber na folha (nada cortado no PDF).
- Medições: nota explicando que a "Medição Machine realizada" é antes dos impostos; entrada de mobilização identificada;
  boletim de medição em análise com selo; "Total da obra" só quando difere do contrato.
- Mês da capa automático (corte até o dia 15 = mês anterior), com a escolha manual mantida.

**Desenho**
- Fotos das frentes na largura da coluna, sem moldura.
- Portfólio na paleta da marca; linha de restrições só quando o mapa de restrições está em uso; "Obras em dia" no lugar.
- Desvio positivo em verde na tabela da EAP.

**Funcionamento**
- Login tenta de novo quando o GitHub Pages devolve erro passageiro (5xx); o arquivo de restrições é opcional.
- README e GOVERNANCA atualizados (sincronização na sexta 14:00, PowerPoint nativo, regras de coerência).

**Dados atualizados em rascunho no mesmo dia** (pelo próprio painel, sem publicar)
- 208: Controle de Medição REV4 (medição de setembro liberada no Sienge) e carga do Prevision de 10/11.
- 198: planta do porcelanato sem a barra de rolagem e carga do Prevision de 10/11 (nova linha de base).

**Pendências conhecidas**
- Token do GitHub do robô de sincronização (segredo `PAINEL_GH_TOKEN`) expirado: a rotina de sexta falha até renovar.
- RDOs no painel até meados de outubro: falta enviar o PDF exportado do Diário de Obra.
- Leitura direta do Sienge e do Diário de Obra depende dos usuários de API.
