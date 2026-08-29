# Relatório de Orçamentos — Cash-UP PG (PG Química / Grupo PQ)

> Este é o projeto da **PG Química**. Existe um projeto irmão para a **Pernambuco Química**
> em `relatorio_cashup_PQ/` — mesmo funcionamento, portal diferente. Não confundir os dois.

## Início Rápido
Dê **duplo clique em `executar_relatorio.bat`**. Ele verifica Python e dependências automaticamente antes de rodar.

Ou via terminal:
```bash
cd "C:\Claude\GRUPOPQ\PROJETOS\relatorio_cashup_PG"
py -3 relatorio_cashup.py
```

## O que o script faz
O relatório é gerado pelo próprio Cash-UP (botão **"Relatório Orçamentos"**), que **não** oferece
download direto — ele envia o arquivo por email, de forma assíncrona ("em alguns minutos"). O script
dispara essa geração e depois encaminha o email recebido em **duas etapas**, até chegar nos
destinatários finais:

1. Login automático no Cash-UP (`https://www.cashup-pgquimica.com.br/`) com `CASHUP_PG_USER`/`CASHUP_PG_PASS`.
2. Abre o menu **Orçamentos** — clica no item do menu superior e, se aparecer o submenu
   **Orçamentos** (mesmo nome), clica nele também para navegar de fato até a grade. O sistema já
   aplica por padrão o filtro **Período de Criação = últimos ~30 dias (rolling)**.
3. Clica em **"Carregar Filtros"** (carrega os filtros salvos) e, na sequência, em
   **"Relatório Orçamentos"**. O Cash-UP responde com o aviso "O Relatório de Orçamentos será
   enviado para seu email cadastrado no Cash-UP em alguns minutos." e fecha o navegador (não há
   nada mais a fazer no browser).
4. Faz **polling via IMAP** na caixa de `CASHUP_WEBMAIL_PG_USER` (bruno@lmtreina.com.br, webmail LM Treina)
   até chegar um email novo de `cashup@cashup-pgquimica.com.br` com assunto
   `Excel Relatório Orçamento - Cash-UP` (checa a cada 20s, até 15 min).
5. **Encaminha esse email** (RFC822 completo, com o anexo original — não recompõe nada) para
   `CASHUP_WEBMAIL_GMAIL_PG_USER` (sistemaorganon@gmail.com), autenticando como `CASHUP_WEBMAIL_PG_USER`.
6. Faz polling via IMAP na caixa do Gmail (`sistemaorganon@gmail.com`) até esse encaminhamento
   chegar — de `bruno@lmtreina.com.br`, mesmo assunto (checa a cada 20s, até 10 min).
7. **Encaminha esse email** (de novo, sem recompor) para os destinatários finais em `CASHUP_EMAIL_PARA_PG`
   (lista separada por vírgula), autenticando como `CASHUP_WEBMAIL_GMAIL_PG_USER`.

Fluxo 100% automático — sem pausa manual, sem interação humana. Só existe espera (polling), nunca
intervenção.

## Correção de roteamento de pasta (28/08/2026)

Existe uma **regra de filtro na própria caixa** `bruno@lmtreina.com.br` que desvia automaticamente
qualquer email de domínio `cashup-*.com.br` (tanto PG quanto PQ) direto para a pasta
`INBOX.GRUPOPQ` — nunca cai na INBOX. Isso foi descoberto no projeto irmão `relatorio_cashup_PQ`
em 27/08/2026 (causa de vários timeouts no 1º salto) e confirmado que também afeta a PG (mesma
regra de filtro, mesma caixa física). Correção aplicada aqui em 28/08/2026, mesmo padrão da PQ:
`uid_maximo_atual`, `descrever_uid` e `encaminhar_email` aceitam um parâmetro `folder`. De brinde,
o filtro de assunto do 1º salto passou a usar `SUBJECT_MATCH_PARTES_CASHUP = ["cash-up"]` (ASCII
puro, sem acento) em vez de `["relatorio", "orcamento"]`, e o script agora loga o baseline
(UID/remetente/assunto/data) antes de disparar o relatório — mesmas melhorias de diagnóstico já
presentes na PQ.

**Ajuste seguinte, mesmo dia**: em vez de assumir cegamente que o email sempre vai cair em
`INBOX.GRUPOPQ` (a regra de filtro do webmail pode mudar ou ser removida no futuro), o
`aguardar_email` do 1º salto agora varre **as duas pastas a cada ciclo de polling**
(`CASHUP_FOLDERS_LM = ["INBOX", "INBOX.GRUPOPQ"]`, INBOX primeiro) — pedido do Bruno. Retorna
`(uid, pasta)`, e o `encaminhar_email` seguinte usa a pasta onde o email foi de fato encontrado.
Isso evita tanto o timeout de hoje (email cai em `INBOX.GRUPOPQ`) quanto uma futura falha se a
regra de filtro for removida (email voltaria a cair na `INBOX` normal) — sem precisar de deploy
nenhum quando isso acontecer.

Motivo de não ter sido corrigido antes: o `CLAUDE.md` desta pasta dizia explicitamente para não
alterar essa regra sem confirmação do Bruno — a confirmação veio ao pedir acompanhamento e ajuste
dos dois workflows em 28/08/2026, antes da execução agendada das 18h07.

**Ajuste seguinte, mesmo dia — email repetido**: se mais de um email bater no filtro na mesma
rodada de polling (ex: sobra de uma execução anterior que não foi consumida), `aguardar_email`
agora sempre escolhe o de **Date mais recente** entre os candidatos — antes escolhia o primeiro
em ordem crescente de UID, que podia ser o mais antigo. Evita encaminhar por engano um relatório
velho como se fosse o da execução atual. Pedido do Bruno.

## Histórico do salto intermediário (Gmail)
O relay por `sistemaorganon@gmail.com` já foi removido uma vez (para simplificar e reduzir pontos de
falha) e foi **reintroduzido a pedido do Bruno em 21/08/2026**, junto com a expansão do destinatário
único para 3 destinatários finais (`alexandre.azevedo@pgquimica.com.br`, `graco@grupopq.com`,
`bruno@solucoesb4.com.br`, hoje na variável `CASHUP_EMAIL_PARA_PG`). Motivo da remoção anterior: mais
um ponto de falha (esperar um segundo email chegar) e, no caso do webmail B4 usado antes do Gmail,
suspensão de envio pela hospedagem (erro SMTP 550, por volume de testes) — o Gmail não tem esse
problema de suspensão por hospedagem compartilhada.

Antes disso, o script usava o botão **"Exportar Excel"** (download direto), porque na época
"Relatório Orçamentos" não aparecia para esse login. Isso mudou — hoje o botão está visível e habilitado.

## Configuração (`.env`)
```
CASHUP_PG_URL=https://www.cashup-pgquimica.com.br/
CASHUP_PG_USER=bruno@lmtreina.com.br
CASHUP_PG_PASS=<senha do Cash-UP>

CASHUP_WEBMAIL_PG_USER=bruno@lmtreina.com.br
CASHUP_WEBMAIL_PG_PASS=<senha do webmail LM Treina>

CASHUP_WEBMAIL_GMAIL_PG_USER=sistemaorganon@gmail.com
CASHUP_WEBMAIL_GMAIL_PG_PASS=<senha de app do Gmail — NÃO é a senha normal da conta>

CASHUP_EMAIL_PARA_PG=alexandre.azevedo@pgquimica.com.br,graco@grupopq.com,bruno@solucoesb4.com.br
```

> Os nomes das variáveis (`CASHUP_PG_*`) são exatamente os mesmos usados nos secrets do GitHub — não
> há mais nenhuma "tradução" de nome entre o `.env` local e os secrets. Renomeado por Bruno em
> 26/08/2026 para todas as variáveis ficarem prefixadas com `CASHUP_` e sufixadas com `_PG`,
> diferenciando de `relatorio_cashup_PQ` (que usa sufixo `_PQ`) mesmo rodando no mesmo repositório.

`CASHUP_WEBMAIL_GMAIL_PG_PASS` precisa ser uma **Senha de App** de 16 caracteres, gerada em
`https://myaccount.google.com/apppasswords` (exige verificação em duas etapas ativada na conta
`sistemaorganon@gmail.com`). A senha normal de login do Gmail não funciona para SMTP/IMAP.

`CASHUP_WEBMAIL_PG_USER`/`CASHUP_WEBMAIL_PG_PASS` são usados tanto para ler a caixa (IMAP, esperar o
email do Cash-UP) quanto para enviar o primeiro encaminhamento (SMTP). O servidor é descoberto
automaticamente a partir do domínio do email (`mail.<domínio>`, `<domínio>`, `smtp.<domínio>`) — não
é preciso informar host manualmente.

`CASHUP_EMAIL_PARA_PG` aceita **múltiplos endereços separados por vírgula** — todos recebem o
encaminhamento final na mesma mensagem (campo `To` com todos, um só envio SMTP).

## Proteção contra emails antigos/duplicados
Antes de disparar o relatório, o script registra o maior UID já existente em cada caixa (LM Treina e
Gmail). Só considera "o email certo" um que chegue com UID **maior** que esse ponto de partida — assim
uma execução nunca pega por engano um relatório de um dia anterior (ou de outra pessoa) que já estava
parado na caixa.

As caixas físicas (`bruno@lmtreina.com.br` e `sistemaorganon@gmail.com`) são **as mesmas** nos dois
projetos (PG e PQ) — o login do Cash-UP é idêntico nos dois portais e não dá pra cadastrar um email
de recebimento diferente por portal (confirmado por Bruno em 27/08/2026), então não é possível
separar por conta. A distinção entre PG e PQ é feita por **tag no assunto**: o 1º encaminhamento
(LM Treina → Gmail) marca o assunto com `- PG` (constante `PROJETO_TAG` no início de
`relatorio_cashup.py`) antes de reenviar — como `encaminhar_email()` não recompõe o resto da
mensagem, essa marca persiste automaticamente no 2º encaminhamento (Gmail → destinatários finais)
sem precisar tocar nele de novo. A segunda espera (`aguardar_email` na caixa do Gmail) já exige essa
tag no assunto (`SUBJECT_MATCH_PARTES + ["- pg"]`), então mesmo que os dois workflows rodassem no
mesmo minuto, um não pegaria o encaminhamento do outro por engano — o agendamento com **30 minutos de
intervalo** (ver "Agendamento" no `CLAUDE.md` da PQ) continua existindo como camada extra de
segurança, mas não é mais a única proteção.

## Estrutura de pastas
```
relatorio_cashup_PG/
├── relatorio_cashup.py      ← script principal
├── executar_relatorio.bat   ← duplo clique para rodar
├── requirements.txt
├── .env                     ← credenciais (não versionado)
├── .gitignore
├── passoapasso/              ← prints originais do fluxo manual
└── debug/                    ← screenshots salvos automaticamente em caso de erro
```

## Solução de problemas
> Quando a execução falha via GitHub Actions, os screenshots de `debug/` são publicados como
> **artifact do run** (aba do run em Actions → "Artifacts", nome `debug-cashup-pg-<run_id>`,
> retido por 14 dias) — antes disso eles só existiam no runner efêmero e eram perdidos ao final
> da execução, mesmo em falha.

- **Login no Cash-UP falha**: screenshot em `debug/erro_login_<data>.png`.
- **Grade de orçamentos não carrega**: screenshot em `debug/erro_grid_<data>.png`.
- **Botão "Carregar Filtros" não encontrado/clicável**: screenshot em
  `debug/erro_carregar_filtros_<data>.png`.
- **Botão "Relatório Orçamentos" não encontrado/clicável**: screenshot em
  `debug/erro_botao_relatorio_<data>.png` — pode ser mudança de permissão de novo (já aconteceu antes).
- **Email do Cash-UP nunca chega (timeout de 15 min)**: verificar se `CASHUP_PG_USER` é realmente o
  email cadastrado no Cash-UP para receber o relatório — o sistema manda para "seu email cadastrado",
  não necessariamente para o que está logado. O tempo de entrega do Cash-UP é bem variável (já vimos
  de ~1 min a mais de 15 min) — o timeout foi subido de 5 para 15 min em 27/08/2026 justamente por
  isso.
- **Encaminhamento não chega no Gmail (timeout de 10 min)**: pode ser Senha de App inválida/expirada,
  ou o email caiu em spam — checar a pasta de spam do `sistemaorganon@gmail.com`.
- **Erro de login SMTP/IMAP (LM Treina)**: verificar `CASHUP_WEBMAIL_PG_PASS` (webmail LM Treina).
- **Erro SMTP 550 "Outgoing mail ... has been suspended"**: suspensão de anti-spam da hospedagem do
  domínio — não é bug do script. Evitar disparos manuais repetidos em sequência curta; a suspensão
  costuma se resolver sozinha depois de um tempo.
- **Falha imediata com "variaveis faltando no .env"**: os nomes no `.env` local precisam bater
  exatamente com os que o script lê (`CASHUP_PG_URL`, `CASHUP_PG_USER`, `CASHUP_PG_PASS`,
  `CASHUP_WEBMAIL_PG_USER`, `CASHUP_WEBMAIL_PG_PASS`, `CASHUP_WEBMAIL_GMAIL_PG_USER`,
  `CASHUP_WEBMAIL_GMAIL_PG_PASS`, `CASHUP_EMAIL_PARA_PG`) — ver "Configuração" acima.

## Agendamento
Roda sozinho todo dia às **18h07 (horário de Brasília)**, mas **não** mais via `schedule:` nativo
do GitHub Actions — esse trigger foi **removido em 29/08/2026** porque o agendamento nativo do
GitHub atrasava (já visto ~6h de atraso em dia de baixa atividade do repo, execução que deveria
sair às 18h07 saiu de fato 00h07 da madrugada seguinte). No lugar, o disparo vem de um workflow no
**n8n** (`Disparo Cash-UP PG/PQ (GitHub Actions)`, instância `organon12.app.n8n.cloud`, node
"Agendamento PG - 18h07" → node GitHub "Disparar Cash-UP PG"), que chama a API
`workflow_dispatch` do GitHub no horário exato (timezone do workflow fixado em
`America/Sao_Paulo`). `.github/workflows/relatorio-cashup-pg.yml` mantém só o trigger
`workflow_dispatch:` (permite tanto o disparo do n8n quanto o botão "Run workflow" manual na aba
Actions do GitHub). **Não reativar o `schedule:` no YAML sem antes desativar o agendamento no
n8n** — os dois juntos disparariam o relatório em dobro no mesmo dia. Roda sem precisar do
computador local ligado (nem o servidor Windows do Bruno — o n8n usado é cloud). Timeout do job:
35 minutos.

## Avisos por WhatsApp (29/08/2026)

Três momentos avisados via WhatsApp (MegaAPI, mesma instância/credencial "MegaAPI Organon" já
usada no workflow `DesativarAgente_Organon` do n8n):

1. **Disparado** — enviado pelo próprio n8n (node "Avisar WhatsApp - PG Iniciando"), logo após o
   `workflow_dispatch` ter sucesso. Não é o mesmo que "começou a rodar de fato" — pode haver
   alguns segundos de fila até o runner do GitHub pegar o job.
2. **Sucesso** — step `Avisar WhatsApp - sucesso` (`if: success()`) no fim do job, direto no
   runner do GitHub Actions.
3. **Falha** — step `Avisar WhatsApp - falha` (`if: failure()`), inclui link pro log do run
   (`github.run_id`) pra diagnóstico rápido sem precisar abrir a aba Actions manualmente.

Por que sucesso/erro saem do GitHub Actions e não do n8n: só o runner sabe o resultado real na
hora exata que termina — fazer o n8n *esperar* (polling) arriscaria estourar o timeout de
execução do n8n Cloud, já que o processo todo pode levar até ~25min (15min + 10min de espera por
email, ver "O que o script faz" acima). Decisão do Bruno.

### Secrets necessários no GitHub (Settings → Secrets and variables → Actions)
Além dos secrets `CASHUP_*` abaixo, os dois avisos de sucesso/falha (`.yml`) usam dois secrets
**compartilhados** entre PG e PQ (mesmo destinatário, mesma instância WhatsApp — sem sufixo
`_PG`/`_PQ`):

- `MEGAAPI_TOKEN` — o mesmo Bearer token da credencial "MegaAPI Organon" no n8n.
- `MEGAAPI_WHATSAPP_DESTINO` — número que recebe os avisos (formato `55DDNNNNNNNNN`).

Todos os secrets `CASHUP_*` deste projeto usam o prefixo `CASHUP_` e o sufixo `_PG` (recriados por
Bruno em 26/08/2026 para não colidir com os equivalentes da PQ — nenhum secret é mais compartilhado
entre os dois projetos, nem mesmo webmail/Gmail). Os nomes são idênticos aos das variáveis do
`.env` local:
- `CASHUP_PG_URL` — `https://www.cashup-pgquimica.com.br/`
- `CASHUP_PG_USER` — email de login do Cash-UP
- `CASHUP_PG_PASS` — senha do Cash-UP
- `CASHUP_WEBMAIL_PG_USER` — `bruno@lmtreina.com.br`
- `CASHUP_WEBMAIL_PG_PASS` — senha do webmail LM Treina
- `CASHUP_WEBMAIL_GMAIL_PG_USER` — `sistemaorganon@gmail.com`
- `CASHUP_WEBMAIL_GMAIL_PG_PASS` — Senha de App do Gmail (não é a senha normal da conta)
- `CASHUP_EMAIL_PARA_PG` — `alexandre.azevedo@pgquimica.com.br,graco@grupopq.com,bruno@solucoesb4.com.br`

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`). O workflow
(`relatorio-cashup-pg.yml`) monta o `.env` da execução direto a partir desses secrets, com os mesmos
nomes — não há tradução de nome nenhuma entre secret e variável de ambiente.
