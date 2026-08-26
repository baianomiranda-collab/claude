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

1. Login automático no Cash-UP (`https://www.cashup-pernambucoquimica.com.br/`) com `CASHUP_USER`/`CASHUP_PASS`.
2. Abre o menu **Orçamentos** — clica no item do menu superior e, se aparecer o submenu
   **Orçamentos** (mesmo nome), clica nele também para navegar de fato até a grade. O sistema já
   aplica por padrão o filtro **Período de Criação = últimos ~30 dias (rolling)**.
3. Clica em **"Carregar Filtros"** (carrega os filtros salvos) e, na sequência, em
   **"Relatório Orçamentos"**. O Cash-UP responde com o aviso "O Relatório de Orçamentos será
   enviado para seu email cadastrado no Cash-UP em alguns minutos." e fecha o navegador (não há
   nada mais a fazer no browser).
4. Faz **polling via IMAP** na caixa de `WEBMAIL_USER` (bruno@lmtreina.com.br, webmail LM Treina)
   até chegar um email novo de `cashup@cashup-pernambucoquimica.com.br` com assunto
   `Excel Relatório Orçamento - Cash-UP` (checa a cada 20s, até 5 min).
5. **Encaminha esse email** (RFC822 completo, com o anexo original — não recompõe nada) para
   `WEBMAIL_GMAIL_USER` (sistemaorganon@gmail.com), autenticando como `WEBMAIL_USER`.
6. Faz polling via IMAP na caixa do Gmail (`sistemaorganon@gmail.com`) até esse encaminhamento
   chegar — de `bruno@lmtreina.com.br`, mesmo assunto (checa a cada 20s, até 5 min).
7. **Encaminha esse email** (de novo, sem recompor) para os destinatários finais em `EMAIL_PARA_PQ`
   (lista separada por vírgula), autenticando como `WEBMAIL_GMAIL_USER`.

Fluxo 100% automático — sem pausa manual, sem interação humana. Só existe espera (polling), nunca
intervenção. Este fluxo é idêntico ao do projeto irmão `relatorio_cashup_PG` — a única diferença
funcional entre os dois é o portal Cash-UP acessado (`CASHUP_URL`) e o domínio do remetente esperado
no passo 4 (`CASHUP_SENDER_MATCH`, no início de `relatorio_cashup.py`).

## Origem deste projeto
Criado em 26/08/2026 como duplicata de `relatorio_cashup_PG` (que por sua vez foi renomeado de
`relatorio_cashup` nessa mesma data, para não confundir os dois projetos). Mesma lógica, mesmo
fluxo — só o portal de origem muda.

> **Confirmado por Bruno em 26/08/2026:**
> - `CASHUP_USER`/`CASHUP_PASS` iguais aos da PG (mesmo login) — mantido.
> - `EMAIL_PARA_PQ` da PQ **não** inclui `alexandre.azevedo@pgquimica.com.br` (esse é destinatário só
>   da PG). Lista final da PQ: `graco@grupopq.com,bruno@solucoesb4.com.br`. Por isso a PQ usa um
>   secret próprio no GitHub (`EMAIL_PARA_PQ`), já que as duas listas divergem — ver "Secrets"
>   abaixo.
>
> **Atenção — presunção ainda não confirmada:**
> - `CASHUP_SENDER_MATCH` foi ajustado para `cashup-pernambucoquimica.com.br` (mesmo padrão de
>   domínio do remetente da PG, só trocando a empresa) — **isto é uma suposição, não confirmada**.
>   Se o primeiro email real do Cash-UP da PQ chegar de um domínio diferente, o polling do passo 4
>   nunca vai encontrar o email e a execução vai falhar por timeout (5 min). Ajustar essa constante
>   assim que o primeiro relatório real chegar.
> - Agendamento no GitHub Actions definido para **18h40 (Brasília)**, 30 min depois da PG (18h10),
>   propositalmente — ver seção "Agendamento" abaixo para o motivo (evitar cruzamento de emails).

## Histórico do salto intermediário (Gmail) — herdado da PG
O relay por `sistemaorganon@gmail.com` já foi removido uma vez (para simplificar e reduzir pontos de
falha) e foi **reintroduzido a pedido do Bruno em 21/08/2026** no projeto PG, junto com a expansão do
destinatário único para 3 destinatários finais. Motivo da remoção anterior: mais um ponto de falha
(esperar um segundo email chegar) e, no caso do webmail B4 usado antes do Gmail, suspensão de envio
pela hospedagem (erro SMTP 550, por volume de testes) — o Gmail não tem esse problema de suspensão
por hospedagem compartilhada.

## Configuração (`.env`)
```
CASHUP_URL=https://www.cashup-pernambucoquimica.com.br/
CASHUP_USER=bruno@lmtreina.com.br
CASHUP_PASS=<senha do Cash-UP>

WEBMAIL_USER=bruno@lmtreina.com.br
WEBMAIL_PASS=<senha do webmail LM Treina>

WEBMAIL_GMAIL_USER=sistemaorganon@gmail.com
WEBMAIL_GMAIL_PASS=<senha de app do Gmail — NÃO é a senha normal da conta>

EMAIL_PARA_PQ=graco@grupopq.com,bruno@solucoesb4.com.br
```

`WEBMAIL_GMAIL_PASS` precisa ser uma **Senha de App** de 16 caracteres, gerada em
`https://myaccount.google.com/apppasswords` (exige verificação em duas etapas ativada na conta
`sistemaorganon@gmail.com`). A senha normal de login do Gmail não funciona para SMTP/IMAP.

`WEBMAIL_USER`/`WEBMAIL_PASS` são usados tanto para ler a caixa (IMAP, esperar o email do Cash-UP)
quanto para enviar o primeiro encaminhamento (SMTP). O servidor é descoberto automaticamente a partir
do domínio do email (`mail.<domínio>`, `<domínio>`, `smtp.<domínio>`) — não é preciso informar host
manualmente.

`EMAIL_PARA_PQ` aceita **múltiplos endereços separados por vírgula** — todos recebem o encaminhamento
final na mesma mensagem (campo `To` com todos, um só envio SMTP).

## Proteção contra emails antigos/duplicados
Antes de disparar o relatório, o script registra o maior UID já existente em cada caixa (LM Treina e
Gmail). Só considera "o email certo" um que chegue com UID **maior** que esse ponto de partida — assim
uma execução nunca pega por engano um relatório de um dia anterior (ou de outra pessoa) que já estava
parado na caixa.

Essa proteção **não** distingue PG de PQ no segundo salto (Gmail): o encaminhamento intermediário
chega sempre de `bruno@lmtreina.com.br` com o mesmo padrão de assunto para os dois projetos. Por isso
os dois workflows do GitHub estão agendados com **30 minutos de intervalo** (ver "Agendamento") — se
rodassem no mesmo minuto, poderia haver risco (ainda que baixo, dado o baseline de UID) de um projeto
capturar o encaminhamento do outro por engano.

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
- **Login no Cash-UP falha**: screenshot em `debug/erro_login_<data>.png`.
- **Grade de orçamentos não carrega**: screenshot em `debug/erro_grid_<data>.png`.
- **Botão "Carregar Filtros" não encontrado/clicável**: screenshot em
  `debug/erro_carregar_filtros_<data>.png`.
- **Botão "Relatório Orçamentos" não encontrado/clicável**: screenshot em
  `debug/erro_botao_relatorio_<data>.png` — pode ser mudança de permissão de novo (já aconteceu antes).
- **Email do Cash-UP nunca chega (timeout de 5 min)**: verificar se `CASHUP_USER` é realmente o email
  cadastrado no Cash-UP para receber o relatório, e se `CASHUP_SENDER_MATCH` (em `relatorio_cashup.py`)
  bate com o domínio real do remetente — ver aviso em "Origem deste projeto" acima.
- **Encaminhamento não chega no Gmail (timeout de 5 min)**: pode ser Senha de App inválida/expirada,
  ou o email caiu em spam — checar a pasta de spam do `sistemaorganon@gmail.com`.
- **Erro de login SMTP/IMAP (LM Treina)**: verificar `WEBMAIL_PASS` (webmail LM Treina).
- **Erro SMTP 550 "Outgoing mail ... has been suspended"**: suspensão de anti-spam da hospedagem do
  domínio — não é bug do script. Evitar disparos manuais repetidos em sequência curta; a suspensão
  costuma se resolver sozinha depois de um tempo.

## Agendamento
Roda sozinho todo dia às **18h40 (horário de Brasília)** via GitHub Actions —
`.github/workflows/relatorio-cashup-pq.yml`. Horário escolhido 30 minutos depois do projeto PG
(18h10) de propósito, para não rodar em paralelo com ele — ver "Proteção contra emails
antigos/duplicados" acima. Também pode ser disparado manualmente pela aba **Actions** do
repositório no GitHub (botão "Run workflow"), sem precisar do computador local ligado. Timeout do
job: 25 minutos.

### Secrets necessários no GitHub (Settings → Secrets and variables → Actions)
Nomes de secrets específicos da PQ (para não colidir com os da PG no mesmo repositório — os dois
projetos usam portais e listas de destinatários diferentes):
- `CASHUP_PQ_URL` — `https://www.cashup-pernambucoquimica.com.br/`
- `CASHUP_PQ_USER` — email de login do Cash-UP
- `CASHUP_PQ_PASS` — senha do Cash-UP
- `EMAIL_PARA_PQ` — `graco@grupopq.com,bruno@solucoesb4.com.br` (diferente do `EMAIL_PARA_PG` da PG,
  que inclui também `alexandre.azevedo@pgquimica.com.br`)

Secrets reaproveitados da PG (mesmos valores, já devem existir no repositório):
- `WEBMAIL_USER` — `bruno@lmtreina.com.br`
- `WEBMAIL_PASS` — senha do webmail LM Treina
- `WEBMAIL_GMAIL_USER` — `sistemaorganon@gmail.com`
- `WEBMAIL_GMAIL_PASS` — Senha de App do Gmail (não é a senha normal da conta)

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`).
