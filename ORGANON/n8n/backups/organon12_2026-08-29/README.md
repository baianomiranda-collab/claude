# Backup dos workflows n8n — organon12.app.n8n.cloud (29/08/2026)

## Por que este backup existe

A conta n8n usada (Bruno) é a versão **free**, que expira a cada ~14 dias. Quando expira,
o Bruno cria outra conta/site free (foi assim que organon11 virou organon12) e **todos os
workflows daquela instância somem** — não há migração automática. Este backup existe pra
recriar rápido quando isso acontecer de novo.

## O que tem em cada arquivo

Cada workflow tem até 2 arquivos:

- **`*.json`** — export bruto via `get_workflow_details` (detailLevel full). É a fonte da
  verdade: nodes, parâmetros, conexões, credenciais referenciadas por nome. **Não é
  importável direto no n8n** (o n8n só aceita criar workflow via código do SDK, não import
  de JSON cru) — serve como referência pra reconstruir manualmente ou traduzir pro SDK.
- **`*.sdk.ts`** — código do n8n Workflow SDK, **já testado e validado** (rodei
  `create_workflow_from_code` de verdade numa cópia de teste, confirmei os 7 nodes e a
  credencial do GitHub associando sozinha, depois arquivei a cópia). Esse arquivo pode ser
  colado direto na tool `create_workflow_from_code` da próxima vez, sem precisar traduzir
  nada na hora.

## Workflows nesta pasta

| Arquivo | Nodes | Ativo | SDK testado? |
|---|---|---|---|
| `Disparo_CashUP_PGPQ.json` + `.sdk.ts` | 7 | Sim | **Sim** — recriado e validado ao vivo em 29/08/2026 |
| `AGENTE_ORGANON_V1.json` | grande (74KB) | Sim | Não — só JSON |
| `Projeto_RAG_Organon.json` | 27 | Não | Não — só JSON |
| `DesativarAgente_Organon.json` | 12 | Sim | Não — só JSON |
| `MCP_Server.json` | 6 | Não | Não — só JSON |
| `MCP_Client.json` | 5 | Não | Não — só JSON |

Só o workflow do Cash-UP (o mais crítico pro dia a dia — dispara os relatórios PG/PQ) tem
código SDK pronto e testado. Os outros 5 só têm o JSON por enquanto — reconstruir esses
segue o mesmo processo (ver abaixo), só que sem o atalho do arquivo `.sdk.ts` já pronto.

## Procedimento de restauração (quando a conta n8n expirar de novo)

1. Bruno cria a nova conta/site n8n free e conecta o MCP a ela.
2. Recriar credenciais manualmente na nova instância (Claude não consegue gravar segredos
   via MCP): "GitHub account" (token do repo `baianomiranda-collab/claude`), "MegaAPI
   Organon" (Bearer token do WhatsApp), e as demais usadas pelos outros workflows
   (Anthropic, OpenAI, Postgres, Supabase, Redis, Google Drive/Calendar — ver
   `project_n8n_organon11.md` na memória pro detalhe de cada uma).
3. **Cash-UP (prioridade):** colar o conteúdo de `Disparo_CashUP_PGPQ.sdk.ts` na tool
   `create_workflow_from_code`. A credencial do GitHub deve se auto-associar (aconteceu no
   teste); as duas credenciais do WhatsApp precisam ser atribuídas manualmente nos nodes
   "Avisar WhatsApp - PG Iniciando" / "PQ Iniciando" depois de criado.
4. **Atualizar o secret do GitHub** `N8N_WEBHOOK_PG_CONCLUIDO` (Settings > Secrets and
   variables > Actions do repo) com a nova Production URL do node "Recebe resultado PG"
   (pegar via `get_workflow_details` depois de publicar o workflow).
5. `publish_workflow` no final — `create_workflow_from_code`/`update_workflow` não
   publicam sozinhos.
6. Testar a cadeia: disparar a PG manualmente (`execute_workflow` ou esperar 18h07) e
   confirmar que a PQ dispara em seguida via webhook, igual foi validado em 29/08/2026
   (ver `CLAUDE.md` de `GRUPOPQ/PROJETOS/relatorio_cashup_PG/`).
7. Para os outros 5 workflows: usar o `.json` correspondente como referência exata de
   nodes/parâmetros/conexões e traduzir pro SDK seguindo `get_workflow_sdk_reference` —
   mesmo processo usado pro Cash-UP, só que ainda não foi pré-feito nem testado.
