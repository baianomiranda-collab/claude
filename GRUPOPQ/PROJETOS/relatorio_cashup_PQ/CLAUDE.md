# Relatório de Orçamentos — Cash-UP PQ (Pernambuco Química / Grupo PQ)

> Este é o projeto da **Pernambuco Química**. Existe um projeto irmão para a **PG Química**
> em `relatorio_cashup_PG/` — mesmo funcionamento, portal diferente. Não confundir os dois.

## Início Rápido
Dê **duplo clique em `executar_relatorio.bat`**. Ele verifica Python e dependências automaticamente antes de rodar.

Ou via terminal:
```bash
cd "C:\Claude\GRUPOPQ\PROJETOS\relatorio_cashup_PQ"
py -3 relatorio_cashup.py
```

## O que o script faz
O relatório é gerado pelo próprio Cash-UP (botão **"Relatório Orçamentos"**), que **não** oferece
download direto — ele envia o arquivo por email, de forma assíncrona ("em alguns minutos"). O script
dispara essa geração e depois encaminha o email recebido em **duas etapas**, até chegar nos
destinatários finais:

1. Login automático no Cash-UP (`https://www.cashup-pernambucoquimica.com.br/`) com `CASHUP_PQ_USER`/`CASHUP_PQ_PASS`.
2. Abre o menu **Orçamentos** — clica no item do menu superior e, se aparecer o submenu
   **Orçamentos** (mesmo nome), clica nele também para navegar de fato até a grade. O sistema já
   aplica por padrão o filtro **Período de Criação = últimos ~30 dias (rolling)**.
3. Clica em **"Carregar Filtros"** (carrega os filtros salvos) e, na sequência, em
   **"Relatório Orçamentos"**. O Cash-UP responde com o aviso "O Relatório de Orçamentos será
   enviado para seu email cadastrado no Cash-UP em alguns minutos." e fecha o navegador (não há
   nada mais a fazer no browser).
4. Faz **polling via IMAP** na caixa de `CASHUP_WEBMAIL_PQ_USER` (bruno@lmtreina.com.br, webmail LM Treina)
   até chegar um email novo de `cashup@cashup-pernambucoquimica.com.br` com assunto
   `Excel Relatório Orçamento - Cash-UP` (checa a cada 20s, até 15 min).
5. **Encaminha esse email** (RFC822 completo, com o anexo original — não recompõe nada) para
   `CASHUP_WEBMAIL_GMAIL_PQ_USER` (sistemaorganon@gmail.com), autenticando como `CASHUP_WEBMAIL_PQ_USER`.
6. Faz polling via IMAP na caixa do Gmail (`sistemaorganon@gmail.com`) até esse encaminhamento
   chegar — de `bruno@lmtreina.com.br`, mesmo assunto (checa a cada 20s, até 10 min).
7. **Encaminha esse email** (de novo, sem recompor) para os destinatários finais em `CASHUP_EMAIL_PARA_PQ`
   (lista separada por vírgula), autenticando como `CASHUP_WEBMAIL_GMAIL_PQ_USER`.

Fluxo 100% automático — sem pausa manual, sem interação humana. Só existe espera (polling), nunca
intervenção. Este fluxo é idêntico ao do projeto irmão `relatorio_cashup_PG` — a única diferença
funcional entre os dois é o portal Cash-UP acessado (`CASHUP_PQ_URL`) e o domínio do remetente
esperado no passo 4 (`CASHUP_SENDER_MATCH`, no início de `relatorio_cashup.py`).

## Origem deste projeto
Criado em 26/08/2026 como duplicata de `relatorio_cashup_PG` (que por sua vez foi renomeado de
`relatorio_cashup` nessa mesma data, para não confundir os dois projetos). Mesma lógica, mesmo
fluxo — só o portal de origem muda.

> **Confirmado por Bruno em 26/08/2026:**
> - `CASHUP_PQ_USER`/`CASHUP_PQ_PASS` iguais aos da PG (mesmo login) — mantido.
> - `CASHUP_EMAIL_PARA_PQ` **não** inclui `alexandre.azevedo@pgquimica.com.br` (esse é destinatário só
>   da PG). Lista final da PQ: `graco@grupopq.com,bruno@solucoesb4.com.br`.
> - Todos os secrets do GitHub foram recriados com prefixo `CASHUP_` e sufixo `_PG`/`_PQ` — nenhum
>   secret é mais compartilhado entre os dois projetos, nem mesmo webmail/Gmail (que antes eram
>   secrets únicos reaproveitados). Os nomes das variáveis no `.env` local seguem o mesmo padrão.
> - **27/08/2026**: o portal Cash-UP da PQ usa o **mesmo login** do Cash-UP da PG e não permite
>   cadastrar um email de recebimento diferente por portal — ou seja, PG e PQ vão continuar usando
>   fisicamente a mesma caixa `bruno@lmtreina.com.br` e o mesmo relay `sistemaorganon@gmail.com` para
>   sempre, não é algo que dá pra "arrumar" trocando cadastro. Por isso os dois projetos agora marcam
>   o assunto do encaminhamento com `- PG`/`- PQ` (`PROJETO_TAG` no script) — ver "Proteção contra
>   emails antigos/duplicados" abaixo.
> - **27/08/2026**: o erro "Grade de orcamentos nao carregou a tempo" (falha nas primeiras tentativas
>   de execução automática) foi corrigido pelo Bruno diretamente na conta/portal da PQ — a navegação
>   até a grade de Orçamentos e o disparo do relatório já foram confirmados funcionando (print do
>   Bruno mostrando "Mostrando 1 até 10 de 605 registros" e o aviso de envio do relatório).
>
> **27/08/2026 — diagnóstico fechado do timeout no 1º salto:**
> - `CASHUP_SENDER_MATCH = "cashup-pernambucoquimica.com.br"` estava **certo** — confirmado com um
>   email real (`cashup@cashup-pernambucoquimica.com.br`, assunto "Excel Relatório Orçamento -
>   Cash-UP"). O email chegava normalmente em `bruno@lmtreina.com.br` (~1-2 min após o disparo), mas
>   o script mesmo assim estourava os 15 min de espera sem reconhecê-lo — ou seja, não era demora de
>   entrega, era falha no reconhecimento do email que já estava na caixa.
> - Causa mais provável: **charset do assunto**. O servidor da PQ pode declarar uma codificação
>   diferente da que a PG usa para acentuação — se "Orçamento" (com cedilha) vier mal decodificado,
>   a comparação por `"orcamento" in assunto_normalizado` falha silenciosamente, mesmo removendo
>   acentos, porque o caractere corrompido não é o "ç" esperado. Não foi possível confirmar 100% sem
>   acesso aos bytes brutos do header, mas é a explicação mais consistente com os fatos.
> - **Correção**: o 1º salto (email original do Cash-UP) agora usa `SUBJECT_MATCH_PARTES_CASHUP =
>   ["cash-up"]` em vez de `["relatorio", "orcamento"]` — "cash-up" é ASCII puro (sem acento),
>   sempre presente no assunto observado, e imune a esse tipo de problema de charset. O 2º salto
>   (nosso próprio reenvio, que nós mesmos codificamos em UTF-8) continua usando o filtro original,
>   sem risco. Além disso, `aguardar_email()` agora loga, em caso de timeout, o remetente/assunto
>   bruto de qualquer email que tenha passado pela caixa sem bater no filtro — se travar de novo, o
>   log do run já mostra o motivo exato, sem precisar repetir esse processo de diagnóstico.
> - Agendamento no GitHub Actions definido para **18h40 (Brasília)**, 30 min depois da PG (18h10) —
>   mantido como camada extra de segurança mesmo após a tag no assunto resolver a ambiguidade de
>   verdade (ver "Proteção contra emails antigos/duplicados" abaixo).
>
> **27/08/2026 — causa real do timeout encontrada (não era charset):** o diagnóstico acima
> (`SUBJECT_MATCH_PARTES_CASHUP`) não resolveu — o timeout persistiu mesmo depois. O log de
> "vistos" (emails novos que não bateram no filtro) mostrou que **nenhum email do Cash-UP sequer
> aparecia como novo na INBOX**, mesmo o Bruno confirmando que o email chegava normalmente em
> `bruno@lmtreina.com.br`. Causa raiz: existe uma **regra de filtro na própria caixa** que desvia
> automaticamente qualquer email de domínio `cashup-*.com.br` (tanto PG quanto PQ) direto para a
> pasta `INBOX.GRUPOPQ` — nunca cai na INBOX. Como UID no IMAP é numerado **por pasta** (não é
> global), o `baseline` tirado da INBOX nunca teria correspondência nenhuma com o que chega em
> `INBOX.GRUPOPQ` de qualquer forma. Corrigido fazendo `uid_maximo_atual`, `descrever_uid`,
> `aguardar_email` e `encaminhar_email` aceitarem um parâmetro `folder`, e usando
> `CASHUP_FOLDER_LM = "INBOX.GRUPOPQ"` (constante no topo do script) em todas as chamadas do 1º
> salto (LM Treina). O 2º salto (Gmail) continua na INBOX normal, sem mudança.
>
> **Isso também afetava a PG** — os emails de `cashup-pgquimica.com.br` foram confirmados na
> mesma pasta `INBOX.GRUPOPQ` durante essa investigação. Corrigido no projeto `relatorio_cashup_PG`
> em 28/08/2026 (mesmo padrão), a pedido do Bruno, antes da execução agendada daquele dia.
>
> **28/08/2026 — polling passou a varrer as duas pastas:** em vez de assumir cegamente que o email
> sempre vai cair em `INBOX.GRUPOPQ` (a regra de filtro do webmail pode mudar ou ser removida no
> futuro), o `aguardar_email` do 1º salto agora varre `CASHUP_FOLDERS_LM = ["INBOX", "INBOX.GRUPOPQ"]`
> a cada ciclo de polling (INBOX primeiro), em vez de uma única pasta fixa. Retorna `(uid, pasta)`,
> e o `encaminhar_email` seguinte usa a pasta onde o email foi de fato encontrado. Mesmo ajuste
> aplicado na PG. Sugestão do Bruno — evita uma futura falha se a regra de filtro for removida
> (email voltaria a cair na `INBOX` normal) sem precisar de deploy nenhum quando isso acontecer.
>
> **28/08/2026 — email repetido:** se mais de um email bater no filtro na mesma rodada de polling
> (ex: sobra de uma execução anterior que não foi consumida), `aguardar_email` agora sempre escolhe
> o de **Date mais recente** entre os candidatos — antes escolhia o primeiro em ordem crescente de
> UID, que podia ser o mais antigo. Evita encaminhar por engano um relatório velho como se fosse o
> da execução atual. Mesmo ajuste aplicado na PG. Pedido do Bruno.

## Histórico do salto intermediário (Gmail) — herdado da PG
O relay por `sistemaorganon@gmail.com` já foi removido uma vez (para simplificar e reduzir pontos de
falha) e foi **reintroduzido a pedido do Bruno em 21/08/2026** no projeto PG, junto com a expansão do
destinatário único para 3 destinatários finais. Motivo da remoção anterior: mais um ponto de falha
(esperar um segundo email chegar) e, no caso do webmail B4 usado antes do Gmail, suspensão de envio
pela hospedagem (erro SMTP 550, por volume de testes) — o Gmail não tem esse problema de suspensão
por hospedagem compartilhada.

## Configuração (`.env`)
```
CASHUP_PQ_URL=https://www.cashup-pernambucoquimica.com.br/
CASHUP_PQ_USER=bruno@lmtreina.com.br
CASHUP_PQ_PASS=<senha do Cash-UP>

CASHUP_WEBMAIL_PQ_USER=bruno@lmtreina.com.br
CASHUP_WEBMAIL_PQ_PASS=<senha do webmail LM Treina>

CASHUP_WEBMAIL_GMAIL_PQ_USER=sistemaorganon@gmail.com
CASHUP_WEBMAIL_GMAIL_PQ_PASS=<senha de app do Gmail — NÃO é a senha normal da conta>

CASHUP_EMAIL_PARA_PQ=graco@grupopq.com,bruno@solucoesb4.com.br
```

> Os nomes das variáveis (`CASHUP_PQ_*`) são exatamente os mesmos usados nos secrets do GitHub — não
> há nenhuma "tradução" de nome entre o `.env` local e os secrets.

`CASHUP_WEBMAIL_GMAIL_PQ_PASS` precisa ser uma **Senha de App** de 16 caracteres, gerada em
`https://myaccount.google.com/apppasswords` (exige verificação em duas etapas ativada na conta
`sistemaorganon@gmail.com`). A senha normal de login do Gmail não funciona para SMTP/IMAP.

`CASHUP_WEBMAIL_PQ_USER`/`CASHUP_WEBMAIL_PQ_PASS` são usados tanto para ler a caixa (IMAP, esperar o
email do Cash-UP) quanto para enviar o primeiro encaminhamento (SMTP). O servidor é descoberto
automaticamente a partir do domínio do email (`mail.<domínio>`, `<domínio>`, `smtp.<domínio>`) — não
é preciso informar host manualmente.

`CASHUP_EMAIL_PARA_PQ` aceita **múltiplos endereços separados por vírgula** — todos recebem o
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
(LM Treina → Gmail) marca o assunto com `- PQ` (constante `PROJETO_TAG` no início de
`relatorio_cashup.py`) antes de reenviar — como `encaminhar_email()` não recompõe o resto da
mensagem, essa marca persiste automaticamente no 2º encaminhamento (Gmail → destinatários finais)
sem precisar tocar nele de novo. A segunda espera (`aguardar_email` na caixa do Gmail) já exige essa
tag no assunto (`SUBJECT_MATCH_PARTES + ["- pq"]`), então mesmo que os dois workflows rodassem no
mesmo minuto, um não pegaria o encaminhamento do outro por engano — o agendamento com **30 minutos de
intervalo** (ver "Agendamento" abaixo) continua existindo como camada extra de segurança, mas não é
mais a única proteção.

## Estrutura de pastas
```
relatorio_cashup_PQ/
├── relatorio_cashup.py      ← script principal
├── executar_relatorio.bat   ← duplo clique para rodar
├── requirements.txt
├── .env                     ← credenciais (não versionado)
├── .gitignore
├── passoapasso/              ← prints herdados do fluxo manual da PG (mesma plataforma Cash-UP)
└── debug/                    ← screenshots salvos automaticamente em caso de erro
```

## Solução de problemas
> Quando a execução falha via GitHub Actions, os screenshots de `debug/` são publicados como
> **artifact do run** (aba do run em Actions → "Artifacts", nome `debug-cashup-pq-<run_id>`,
> retido por 14 dias) — antes disso eles só existiam no runner efêmero e eram perdidos ao final
> da execução, mesmo em falha. Foi assim que a falha do run manual de 26/08/2026 ficou sem
> diagnóstico (nenhum artifact disponível) — ver "Origem deste projeto" acima.

- **Login no Cash-UP falha**: screenshot em `debug/erro_login_<data>.png`.
- **Grade de orçamentos não carrega**: screenshot em `debug/erro_grid_<data>.png`.
- **Botão "Carregar Filtros" não encontrado/clicável**: screenshot em
  `debug/erro_carregar_filtros_<data>.png`.
- **Botão "Relatório Orçamentos" não encontrado/clicável**: screenshot em
  `debug/erro_botao_relatorio_<data>.png` — pode ser mudança de permissão de novo (já aconteceu antes).
- **Email do Cash-UP nunca chega (timeout de 15 min)**: verificar se `CASHUP_PQ_USER` é realmente o
  email cadastrado no Cash-UP para receber o relatório, e se `CASHUP_SENDER_MATCH` (em
  `relatorio_cashup.py`) bate com o domínio real do remetente — ver aviso em "Origem deste projeto"
  acima.
- **Encaminhamento não chega no Gmail (timeout de 10 min)**: pode ser Senha de App inválida/expirada,
  ou o email caiu em spam — checar a pasta de spam do `sistemaorganon@gmail.com`.
- **Erro de login SMTP/IMAP (LM Treina)**: verificar `CASHUP_WEBMAIL_PQ_PASS` (webmail LM Treina).
- **Erro SMTP 550 "Outgoing mail ... has been suspended"**: suspensão de anti-spam da hospedagem do
  domínio — não é bug do script. Evitar disparos manuais repetidos em sequência curta; a suspensão
  costuma se resolver sozinha depois de um tempo.
- **Falha imediata com "variaveis faltando no .env"**: os nomes no `.env` local precisam bater
  exatamente com os que o script lê (`CASHUP_PQ_URL`, `CASHUP_PQ_USER`, `CASHUP_PQ_PASS`,
  `CASHUP_WEBMAIL_PQ_USER`, `CASHUP_WEBMAIL_PQ_PASS`, `CASHUP_WEBMAIL_GMAIL_PQ_USER`,
  `CASHUP_WEBMAIL_GMAIL_PQ_PASS`, `CASHUP_EMAIL_PARA_PQ`) — ver "Configuração" acima.

## Agendamento
**Não tem mais horário fixo próprio.** Até 29/08/2026 rodava sozinha às 18h23 Brasília via um
node de agendamento independente no n8n; esse node foi removido e substituído por uma cadeia
disparada pela PG — ver "Cadeia PG → PQ" abaixo para os detalhes completos. Roda sem precisar do
computador local ligado (nem o servidor Windows do Bruno — o n8n usado é cloud). Timeout do job:
35 minutos. `.github/workflows/relatorio-cashup-pq.yml` mantém só o trigger `workflow_dispatch:`
(permite tanto o disparo pelo node GitHub do n8n quanto o botão "Run workflow" manual na aba
Actions do GitHub).

> **27/08/2026 — atraso do `schedule:` nativo do GitHub (histórico):** execuções agendadas por
> cron não têm horário garantido — o GitHub enfileira por carga do sistema, e em repositórios sem
> atividade constante o atraso observado passou de 3h (ex: agendado p/ 21h40 UTC, rodou de fato às
> 01h01 UTC do dia seguinte). Não é bug do workflow. Mitigação tentada: minuto do cron fora de
> horário redondo (`:23` em vez de `:30`) — reduziu a chance de concorrência, mas não garantiu o
> horário exato (em 28/08/2026 o atraso chegou a ~6h mesmo assim).
>
> **29/08/2026 — trocado por gatilho externo no n8n, depois virou cadeia:** primeiro trocamos o
> `schedule:` nativo por um agendamento próprio no n8n (18h23 Brasília, timezone fixado em
> `America/Sao_Paulo`) — resolveu o atraso porque o relógio do n8n não depende da fila de runners
> do GitHub. No mesmo dia, ao tentar testar PG e PQ juntas, descobrimos que a ferramenta de teste
> do n8n só dispara o primeiro trigger de um workflow com múltiplos agendamentos — não dava pra
> testar as duas de forma confiável. O Bruno pediu pra trocar por uma cadeia orientada a evento
> (PG termina → PQ dispara) em vez de dois agendamentos independentes — ver "Cadeia PG → PQ"
> abaixo. Se o disparo parar de acontecer, checar primeiro se o workflow n8n
> (`Disparo Cash-UP PG/PQ (GitHub Actions)`, `organon12.app.n8n.cloud`) continua **ativo**
> (`active: true`) antes de qualquer outra investigação.

## Cadeia PG → PQ (29/08/2026)

A PQ dispara automaticamente logo que a **PG termina** — sucesso ou falha, tanto faz, o
importante é nunca rodar em paralelo com a PG. Mecanismo (detalhado no `CLAUDE.md` da PG): o
job da PG tem um step `if: always()` que faz `POST` pro webhook do node "Recebe resultado PG"
no workflow n8n; esse webhook está conectado direto no node "Disparar Cash-UP PQ", então
qualquer POST recebido dispara a PQ (não é um gate — não checa se a PG teve sucesso, só reage
ao fato dela ter terminado). Do lado da PQ não muda nada no `.yml` — quem mudou foi só o
mecanismo de disparo, upstream, no n8n.

**Trade-off aceito:** a PQ passa a depender inteiramente desse webhook ser chamado pela PG. Se o
job da PG for interrompido pela infraestrutura do GitHub antes de chegar nesse step (raro), a PQ
não dispara naquele dia — não há mais agendamento de fallback independente pra ela. Decisão
consciente do Bruno, trocando robustez de fallback por simplicidade e teste mais fácil.

## Avisos por WhatsApp (29/08/2026)

Três momentos avisados via WhatsApp (MegaAPI, mesma instância/credencial "MegaAPI Organon" já
usada no workflow `DesativarAgente_Organon` do n8n):

1. **Disparado** — enviado pelo próprio n8n (node "Avisar WhatsApp - PQ Iniciando"), logo após o
   `workflow_dispatch` ter sucesso. Não é o mesmo que "começou a rodar de fato" — pode haver
   alguns segundos de fila até o runner do GitHub pegar o job.
2. **Sucesso** — step `Avisar WhatsApp - sucesso` (`if: success()`) no fim do job, direto no
   runner do GitHub Actions.
3. **Falha** — step `Avisar WhatsApp - falha` (`if: failure()`), inclui link pro log do run
   (`github.run_id`) pra diagnóstico rápido sem precisar abrir a aba Actions manualmente.

Por que sucesso/erro saem do GitHub Actions e não do n8n: só o runner sabe o resultado real na
hora exata que termina — fazer o n8n *esperar* (polling) arriscaria estourar o timeout de
execução do n8n Cloud, já que o processo todo pode levar até ~25min (15min + 10min de espera por
email, ver "O que o script faz" acima). Decisão do Bruno. Mesmo ajuste aplicado na PG.

Os `curl` dos avisos terminam com `|| echo "AVISO: ..."` — se a notificação em si falhar (ex:
instabilidade de rede até a MegaAPI), isso não derruba o job (os steps `run:` do GitHub Actions
rodam com `set -e` por padrão, então sem esse `||` uma falha de rede ao notificar marcaria o job
inteiro como `failure` mesmo com o relatório enviado com sucesso). Mesmo ajuste na PG — lá é
ainda mais importante, porque o `job.status` da PG é repassado no webhook que dispara a PQ (ver
"Cadeia PG → PQ" acima).

### Secrets necessários no GitHub (Settings → Secrets and variables → Actions)
Além dos secrets `CASHUP_*` abaixo, os dois avisos de sucesso/falha (`.yml`) usam dois secrets
**compartilhados** entre PG e PQ (mesmo destinatário, mesma instância WhatsApp — sem sufixo
`_PG`/`_PQ`, já cadastrados junto com os da PG). O secret `N8N_WEBHOOK_PG_CONCLUIDO` (que dispara
essa cadeia) só é usado no `.yml` da PG — não precisa ser cadastrado aqui:

- `MEGAAPI_TOKEN` — o mesmo Bearer token da credencial "MegaAPI Organon" no n8n.
- `MEGAAPI_WHATSAPP_DESTINO` — número que recebe os avisos (formato `55DDNNNNNNNNN`).

Todos os secrets `CASHUP_*` deste projeto usam o prefixo `CASHUP_` e o sufixo `_PQ` (recriados por
Bruno em 26/08/2026 — nenhum secret é mais compartilhado com o projeto PG, nem mesmo webmail/Gmail).
Os nomes são idênticos aos das variáveis do `.env` local:
- `CASHUP_PQ_URL` — `https://www.cashup-pernambucoquimica.com.br/`
- `CASHUP_PQ_USER` — email de login do Cash-UP
- `CASHUP_PQ_PASS` — senha do Cash-UP
- `CASHUP_WEBMAIL_PQ_USER` — `bruno@lmtreina.com.br`
- `CASHUP_WEBMAIL_PQ_PASS` — senha do webmail LM Treina
- `CASHUP_WEBMAIL_GMAIL_PQ_USER` — `sistemaorganon@gmail.com`
- `CASHUP_WEBMAIL_GMAIL_PQ_PASS` — Senha de App do Gmail (não é a senha normal da conta)
- `CASHUP_EMAIL_PARA_PQ` — `graco@grupopq.com,bruno@solucoesb4.com.br` (diferente do
  `CASHUP_EMAIL_PARA_PG` da PG, que inclui também `alexandre.azevedo@pgquimica.com.br`)

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`). O workflow
(`relatorio-cashup-pq.yml`) monta o `.env` da execução direto a partir desses secrets, com os mesmos
nomes — não há tradução de nome nenhuma entre secret e variável de ambiente.
