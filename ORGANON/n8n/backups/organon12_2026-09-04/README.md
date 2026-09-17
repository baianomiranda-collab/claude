# Backup dos workflows n8n — organon12.app.n8n.cloud (04/09/2026)

## Por que este backup existe

A conta n8n usada (Bruno) é a versão **free**, que expira a cada ~14 dias. Quando expira,
o Bruno cria outra conta/site free (foi assim que organon11 virou organon12 em 23/08/2026)
e **todos os workflows daquela instância somem** — não há migração automática. Este backup
existe para recriar tudo rápido no link novo.

**Diferença deste backup em relação ao anterior (`organon12_2026-08-29`):** desta vez os
**6 workflows** têm código SDK **testado de verdade** — para cada um, criei uma cópia via
`create_workflow_from_code` na própria instância, confirmei que o número de nós e as
conexões batem exatamente com o original (comparação programática, não visual), e depois
arquivei a cópia de teste. Da vez passada só o Cash-UP tinha esse nível de confiança.

## O que tem em cada arquivo

Cada workflow tem 2 arquivos:

- **`*.json`** — export bruto via `get_workflow_details` (detailLevel full), puxado ao vivo
  em 04/09/2026. É a referência exata de nodes/parâmetros/conexões/credenciais por nome.
  **Não é importável direto no n8n** — serve como fonte da verdade caso algo no `.sdk.ts`
  precise ser conferido/corrigido.
- **`*.sdk.ts`** — código do n8n Workflow SDK, **testado e validado**: colar direto na tool
  `create_workflow_from_code` (ou pedir pro Claude fazer isso) recria o workflow.

## Workflows nesta pasta

| Arquivo | Nodes | Ativo no original | Testado? |
|---|---|---|---|
| `Disparo_CashUP_PGPQ.json` + `.sdk.ts` | 7 | Sim | Sim (reaproveitado do backup de 29/08 — workflow não mudou) |
| `DesativarAgente_Organon.json` + `.sdk.ts` | 12 | Sim | Sim — testado 04/09/2026 |
| `MCP_Server.json` + `.sdk.ts` | 6 | Não | Sim — testado 04/09/2026 |
| `MCP_Client.json` + `.sdk.ts` | 5 | Não | Sim — testado 04/09/2026 |
| `Projeto_RAG_Organon.json` + `.sdk.ts` | 26 | Sim | Sim — testado 04/09/2026 |
| `AGENTE_ORGANON_V1.json` + `.sdk.ts` | 114 | Sim | Sim — testado 04/09/2026 (o mais crítico e o mais complexo) |

Todos os 6 : criei uma cópia de teste (`BACKUP-TEST_<nome>`) na própria organon12 a partir do
`.sdk.ts`, confirmei nodeCount e (para os maiores) o conjunto exato de conexões via
comparação programática JSON-a-JSON, depois arquivei a cópia. Nenhuma cópia de teste ficou
para trás na conta.

## Coisas que exigem atenção manual na restauração (nenhuma delas é automática)

1. **Credenciais nunca são copiadas por segurança.** O Claude não consegue gravar segredos
   via MCP — só criar o placeholder da credencial (`newCredential('Nome')`), que auto-associa
   *se* já existir uma credencial com esse nome exato na instância nova. Recriar manualmente
   antes de importar os workflows (valores na página Notion "#B4 Nocode - Prompt"):
   - **Redis account** (Redis) — Upstash `apt-boa-43409.upstash.io`, SSL sim, token como password.
   - **Postgres account** (Postgres) — Supabase pooler `aws-1-sa-east-1.pooler.supabase.com:6543`,
     user `postgres.frqwciniadgqobmxlddb`.
   - **Supabase account** (Supabase API) — URL `https://frqwciniadgqobmxlddb.supabase.co` + secret key.
   - **Anthropic account** (Anthropic API).
   - **MySQL account** (MySQL) — GRUPO PQ.
   - **GitHub account** (GitHub API) — token do repo `baianomiranda-collab/claude`.
   - **MegaAPI Organon** (Bearer Auth genérico) — token: ver Notion "#B4 Nocode - Prompt".
   - **Google Drive account** (Google Drive OAuth2) — usado só pelo Projeto RAG Organon.
   - **n8n free OpenAI API credits** — ⚠️ **esta é uma credencial GERENCIADA pelo próprio n8n
     (créditos grátis de trial), não uma credencial normal.** Ela NÃO existe na conta nova.
     Os nodes que a usam (Transcribe a recording, Analyze image no AGENTE ORGANON V1;
     Embeddings OpenAI ×2, OpenAI Chat Model1 no Projeto RAG Organon; OpenAI Chat Model no
     MCP Client) precisam de uma credencial OpenAI **real** (chave da Notion) no lugar dela.

2. **`DesativarAgente` (tool dentro do AGENTE ORGANON V1) referencia o workflow
   `DesativarAgente_Organon` por ID interno** (`tbR0Zs35oyRFnT2J` no export original — note
   que esse ID já era diferente do ID atual do workflow standalone `DesativarAgente_Organon`
   na mesma instância, então provavelmente já estava desatualizado mesmo antes da migração).
   IDs de workflow nunca sobrevivem a uma migração de instância. **Depois de recriar os dois
   workflows na conta nova, abrir o node "DesativarAgente" dentro do AGENTE ORGANON V1 e
   reselecionar manualmente o workflow "DesativarAgente_Organon" no campo Workflow** — senão
   a tool de transferir pra atendimento humano fica apontando pro lugar errado.

3. **GitHub Actions:** depois de recriar o Cash-UP, atualizar o secret do GitHub
   `N8N_WEBHOOK_PG_CONCLUIDO` (Settings > Secrets and variables > Actions do repo
   `baianomiranda-collab/claude`) com a nova Production URL do node "Recebe resultado PG"
   (pegar via `get_workflow_details` depois de publicar).

4. **`publish_workflow` no final de cada um** — `create_workflow_from_code`/`update_workflow`
   não publicam sozinhos; sem isso o workflow fica "salvo" mas inativo/desatualizado em produção.

## Nós órfãos/desconectados — propositalmente preservados, não é bug

Alguns workflows têm nodes sem nenhuma conexão de entrada ou saída. Isso já existia assim no
original (confirmado via análise do grafo de conexões antes de traduzir), então foram
replicados fielmente em vez de removidos:

- **Projeto RAG Organon**: `OpenAI Chat Model1` (leftover, nunca conectado).
- **AGENTE ORGANON V1**:
  - `MEGA API` → `No Operation, do nothing` (ilha de 2 nodes, teste manual antigo).
  - `Edit Fields8` → `Split Out1` → `Loop Over Items1` (...) — uma segunda cópia da lógica de
    "quebrar e enviar mensagens em loop" que nunca ficou conectada ao fluxo principal
    (o fluxo real usa a cadeia que sai do `Basic LLM Chain`).
  - `Edit Fields9` → `downloadMediaMessage document1` → ... → `Redis9` — uma segunda cópia do
    tratamento de documento, também nunca conectada.
  - `buscar_produtos`, `buscar_pedidos`, `criar_pedido`, `atualizar_pedido` (4 tools Supabase)
    — leftover do template original ("NOCODE STARTUP"), nunca usados pelo AI Agent real.

Se algum dia quiser limpar isso na conta nova, é seguro deletar — mas o backup preserva
exatamente o que existe hoje em produção, sem "consertar" nada por conta própria.

## Bug de dados já existente no AGENTE ORGANON V1 (não é do backup)

Os 3 tools MySQL do agente (`criar_projeto`, `atualiza_projeto`, `pesquisar_projeto`) têm
**parâmetros idênticos** no export original — todos fazem o mesmo `SELECT * FROM projeto
WHERE CODSETOR = 'CNT'`, independente do nome sugerir create/update/search. Isso já estava
assim na instância viva em 04/09/2026 (não é uma perda do processo de backup) — provavelmente
uma versão antiga/incompleta que nunca foi finalizada. Vale revisar com o Bruno se isso é
esperado ou se essas 3 tools precisam de configuração de verdade.

## Procedimento de restauração (quando a conta n8n expirar de novo)

1. Bruno cria a nova conta/site n8n free e conecta o MCP a ela.
2. Recriar as 9 credenciais listadas acima (nomes exatos, incluindo trocar a credencial
   OpenAI free por uma de verdade).
3. Para cada um dos 6 `.sdk.ts` (ordem de prioridade: Cash-UP → AGENTE ORGANON V1 →
   DesativarAgente_Organon → Projeto RAG Organon → MCP Server/Client): colar o conteúdo na
   tool `create_workflow_from_code`, conferir que os nodes/credenciais auto-associaram, então
   `publish_workflow`.
4. Reselecionar manualmente o workflow no node "DesativarAgente" dentro do AGENTE ORGANON V1
   (item 2 acima).
5. Atualizar o secret do GitHub `N8N_WEBHOOK_PG_CONCLUIDO` (item 3 acima).
6. Testar a cadeia: mandar uma mensagem de teste pro WhatsApp do AGENTE ORGANON V1 e
   confirmar resposta; disparar a PG manualmente e confirmar que a PQ dispara em seguida.
