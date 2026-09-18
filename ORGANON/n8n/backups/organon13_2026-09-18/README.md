# Backup dos workflows n8n — organon13.app.n8n.cloud (18/09/2026)

## Por que este backup existe

A conta n8n do Bruno é a versão **free**, que expira a cada ~14 dias. Quando expira, ele cria
outra conta/site free e recebe uma URL nova — **todos os workflows daquela instância somem**,
não há migração automática. organon12 → organon13 aconteceu em 05/09/2026; pelo padrão de
~14 dias, a próxima expiração é esperada por volta de **19-20/09/2026**.

**Este backup foi puxado com urgência real** porque o backup anterior (`organon12_2026-09-04\`)
estava desatualizado: depois de 04/09 apareceram 2 workflows novos e várias edições ao vivo na
organon13 que nunca tinham sido salvas em disco. Ver seção "O que mudou desde o backup de 04/09"
abaixo.

## O que tem em cada arquivo

Só **`*.json`** — export bruto via `get_workflow_details` (detailLevel full), puxado ao vivo em
18/09/2026. É a referência exata de nodes/parâmetros/conexões/credenciais (por nome) de cada
workflow. **Não é importável direto no n8n** — o n8n só aceita criar workflow via código do SDK
(`create_workflow_from_code`), não import de JSON cru. Diferente do backup de 04/09, **nenhum
`.sdk.ts` foi gerado/testado ainda** nesta rodada — prioridade era preservar o estado antes da
expiração, não traduzir para SDK. Ver "Próximos passos" abaixo.

## Workflows nesta pasta (8 — cresceu de 6 para 8 desde 04/09)

| Arquivo | Nodes | Ativo | Criado em | Novo desde 04/09? |
|---|---|---|---|---|
| `AGENTE_ORGANON_V1.json` | 120 (era 114 em 04/09) | Sim | 05/09 (reimportado) | Editado (+6 nodes) |
| `Disparo_CashUP_PGPQ.json` | 7 | Sim | 05/09 (reimportado) | Não mudou |
| `DesativarAgente_Organon.json` | 12 | Sim | 05/09 (reimportado) | Não mudou |
| `Projeto_RAG_Organon.json` | 26 | Sim | 05/09 (reimportado) | Não mudou |
| `MCP_Server.json` | 6 | Sim | 05/09 (reimportado) | Não mudou |
| `MCP_Client.json` | 5 | Sim | 05/09 (reimportado) | Endpoint URL corrigido pra organon13 |
| `Kardex_Wrapper_Seguro.json` | 2 | Sim | **07/09** | **SIM — nunca backupeado antes** |
| `Envio_Resultado_EmailWhatsApp.json` | 6 | Sim | **06/09** | **SIM — nunca backupeado antes** |

Existe um 9º workflow na instância, "AI Agent workflow" (`dm8iaayzj9Vw6fFV`, inativo) — é o demo
que o próprio n8n cria em conta nova, não é do Bruno, não foi backupeado (mesmo critério do
backup de 04/09).

## O que mudou desde o backup de 04/09/2026 (ver [[project_n8n_organon13]] na memória p/ detalhe)

1. **Novo sub-workflow "Kardex API - Wrapper Seguro (truncagem)"** — chamado como tool
   (`toolWorkflow`) pelo AGENTE ORGANON V1 no lugar do antigo `consultar_kardex` direto
   (`httpRequestTool`). Pagina a API do Kardex (até 50 páginas) e agrega quando o resultado
   passa de 200 movimentos, pra não estourar o contexto da conversa.
2. **Novo workflow "Envio de Resultado (Email + WhatsApp)"** — webhook genérico que recebe
   `{assunto, mensagem}`, manda email via Gmail pra `bruno@lmtreina.com.br` e avisa por
   WhatsApp que o email foi enviado. Destinatários fixos por enquanto.
3. **AGENTE ORGANON V1 ganhou 6 nodes** (114 → 120) e teve o `systemMessage`/regras do Módulo 5
   ajustadas por causa da mudança #1.
4. **MCP Client**: `endpointUrl` do node MCP Client corrigido de um domínio antigo
   (`bmiranda5.app.n8n.cloud`) para `https://organon13.app.n8n.cloud/mcp/mcp-calendar`.
5. **Credencial nova: "Gmail account"** (`gmailOAuth2`, usada só no workflow #2). **Credencial
   duplicada: "GitHub account" vs "GitHub account 2"** — o Cash-UP usa a "2"; a original ficou
   sem uso, decidir com o Bruno se remove.
6. Todas as 12 credenciais atuais (confirmado via `list_credentials` em 18/09): Redis account,
   Google Calendar account, **Gmail account**, Anthropic account, Google Drive account, Bearer
   Auth account, Supabase account, n8n free OpenAI API credits (gerenciada), GitHub account,
   Postgres account, **GitHub account 2**, MySQL account.

## Coisas que exigem atenção manual na restauração (nenhuma é automática)

Mesma lista de sempre — ver o README de `organon12_2026-09-04\` para o detalhe completo de cada
credencial (host Supabase/Upstash, etc.) e os 2 gotchas já conhecidos:

1. **Credenciais nunca são copiadas por segurança.** Recriar manualmente as 12 credenciais
   listadas acima na instância nova (valores na página Notion "#B4 Nocode - Prompt"). A
   credencial **"n8n free OpenAI API credits" é gerenciada pelo próprio n8n e NÃO existe na
   conta nova** — os nodes que a usam (Embeddings ×2 no Projeto RAG Organon, OpenAI Chat Model
   no MCP Client) precisam de uma credencial OpenAI real no lugar.
2. **A tool "DesativarAgente" dentro do AGENTE ORGANON V1 referencia o workflow
   `DesativarAgente_Organon` por ID interno** — IDs nunca sobrevivem a uma migração de
   instância. Reselecionar manualmente depois de recriar os dois workflows.
3. **GitHub Actions:** atualizar o secret `N8N_WEBHOOK_PG_CONCLUIDO` (repo
   `baianomiranda-collab/claude`) com a nova Production URL do node "Recebe resultado PG"
   depois de publicar o Cash-UP na instância nova.
4. **`publish_workflow` no final de cada um** — `create_workflow_from_code`/`update_workflow`
   não publicam sozinhos. Vale também para sub-workflows sem trigger próprio, como o Kardex
   Wrapper (achado real de 07/09: ficou `active:false` por esquecimento).
5. **Kardex Wrapper depende da API paginada do ScriptCase** (`blank_analista_estoque`, host
   `69.64.55.114:8093`) — não depende de credencial n8n, só do endpoint HTTP estar de pé.

## Próximos passos (prioridade nesta ordem)

1. **Traduzir e testar em SDK os 2 workflows novos** (Kardex Wrapper e Envio de Resultado) —
   são pequenos (2 e 6 nodes), rápido de fazer.
2. **Re-testar o `.sdk.ts` do AGENTE ORGANON V1 de 04/09** contra este JSON novo — ele cresceu
   6 nodes e mudou o tipo do node `consultar_kardex`; o `.sdk.ts` antigo (pasta
   `organon12_2026-09-04\`) está desatualizado nesse ponto específico, mesmo que o resto ainda
   sirva de base.
3. Os demais 4 (Cash-UP, DesativarAgente, Projeto RAG, MCP Server/Client) não mudaram de
   estrutura desde 04/09 — o `.sdk.ts` já testado daquela pasta continua válido.
