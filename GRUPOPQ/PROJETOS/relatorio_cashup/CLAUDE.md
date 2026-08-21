# Relatório de Orçamentos — Cash-UP (Grupo PQ)

## Início Rápido
Dê **duplo clique em `executar_relatorio.bat`**. Ele verifica Python e dependências automaticamente antes de rodar.

Ou via terminal:
```bash
cd "C:\Claude\GRUPOPQ\PROJETOS\relatorio_cashup"
py -3 relatorio_cashup.py
```

## O que o script faz
O relatório é gerado pelo próprio Cash-UP (botão **"Relatório Orçamentos"**), que **não** oferece
download direto — ele envia o arquivo por email, de forma assíncrona ("em alguns minutos"). O script
dispara essa geração e depois encaminha o email recebido em **duas etapas**, até chegar nos
destinatários finais:

1. Login automático no Cash-UP (`https://www.cashup-pgquimica.com.br/`) com `CASHUP_USER`/`CASHUP_PASS`.
2. Abre o menu **Orçamentos** — clica no item do menu superior e, se aparecer o submenu
   **Orçamentos** (mesmo nome), clica nele também para navegar de fato até a grade. O sistema já
   aplica por padrão o filtro **Período de Criação = últimos ~30 dias (rolling)**.
3. Clica em **"Carregar Filtros"** (carrega os filtros salvos) e, na sequência, em
   **"Relatório Orçamentos"**. O Cash-UP responde com o aviso "O Relatório de Orçamentos será
   enviado para seu email cadastrado no Cash-UP em alguns minutos." e fecha o navegador (não há
   nada mais a fazer no browser).
4. Faz **polling via IMAP** na caixa de `WEBMAIL_USER` (bruno@lmtreina.com.br, webmail LM Treina)
   até chegar um email novo de `cashup@cashup-pgquimica.com.br` com assunto
   `Excel Relatório Orçamento - Cash-UP` (checa a cada 20s, até 5 min).
5. **Encaminha esse email** (RFC822 completo, com o anexo original — não recompõe nada) para
   `WEBMAIL_GMAIL_USER` (sistemaorganon@gmail.com), autenticando como `WEBMAIL_USER`.
6. Faz polling via IMAP na caixa do Gmail (`sistemaorganon@gmail.com`) até esse encaminhamento
   chegar — de `bruno@lmtreina.com.br`, mesmo assunto (checa a cada 20s, até 5 min).
7. **Encaminha esse email** (de novo, sem recompor) para os destinatários finais em `EMAIL_PARA`
   (lista separada por vírgula), autenticando como `WEBMAIL_GMAIL_USER`.

Fluxo 100% automático — sem pausa manual, sem interação humana. Só existe espera (polling), nunca
intervenção.

## Histórico do salto intermediário (Gmail)
O relay por `sistemaorganon@gmail.com` já foi removido uma vez (para simplificar e reduzir pontos de
falha) e foi **reintroduzido a pedido do Bruno em 21/08/2026**, junto com a expansão do destinatário
único para 3 destinatários finais (`alexandre.azevedo@pgquimica.com.br`, `graco@grupopq.com`,
`bruno@solucoesb4.com.br`). Motivo da remoção anterior: mais um ponto de falha (esperar um segundo
email chegar) e, no caso do webmail B4 usado antes do Gmail, suspensão de envio pela hospedagem (erro
SMTP 550, por volume de testes) — o Gmail não tem esse problema de suspensão por hospedagem
compartilhada.

Antes disso, o script usava o botão **"Exportar Excel"** (download direto), porque na época
"Relatório Orçamentos" não aparecia para esse login. Isso mudou — hoje o botão está visível e habilitado.

## Configuração (`.env`)
```
CASHUP_URL=https://www.cashup-pgquimica.com.br/
CASHUP_USER=bruno@lmtreina.com.br
CASHUP_PASS=<senha do Cash-UP>

WEBMAIL_USER=bruno@lmtreina.com.br
WEBMAIL_PASS=<senha do webmail LM Treina>

WEBMAIL_GMAIL_USER=sistemaorganon@gmail.com
WEBMAIL_GMAIL_PASS=<senha de app do Gmail — NÃO é a senha normal da conta>

EMAIL_PARA=alexandre.azevedo@pgquimica.com.br,graco@grupopq.com,bruno@solucoesb4.com.br
```

`WEBMAIL_GMAIL_PASS` precisa ser uma **Senha de App** de 16 caracteres, gerada em
`https://myaccount.google.com/apppasswords` (exige verificação em duas etapas ativada na conta
`sistemaorganon@gmail.com`). A senha normal de login do Gmail não funciona para SMTP/IMAP.

`WEBMAIL_USER`/`WEBMAIL_PASS` são usados tanto para ler a caixa (IMAP, esperar o email do Cash-UP)
quanto para enviar o primeiro encaminhamento (SMTP). O servidor é descoberto automaticamente a partir
do domínio do email (`mail.<domínio>`, `<domínio>`, `smtp.<domínio>`) — não é preciso informar host
manualmente.

`EMAIL_PARA` aceita **múltiplos endereços separados por vírgula** — todos recebem o encaminhamento
final na mesma mensagem (campo `To` com todos, um só envio SMTP).

## Proteção contra emails antigos/duplicados
Antes de disparar o relatório, o script registra o maior UID já existente em cada caixa (LM Treina e
Gmail). Só considera "o email certo" um que chegue com UID **maior** que esse ponto de partida — assim
uma execução nunca pega por engano um relatório de um dia anterior (ou de outra pessoa) que já estava
parado na caixa.

## Estrutura de pastas
```
relatorio_cashup/
├── relatorio_cashup.py      ← script principal
├── executar_relatorio.bat   ← duplo clique para rodar
├── requirements.txt
├── .env                     ← credenciais (não versionado)
├── .gitignore
├── passoapasso/              ← prints originais do fluxo manual
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
  cadastrado no Cash-UP para receber o relatório — o sistema manda para "seu email cadastrado", não
  necessariamente para o que está logado. O tempo de entrega do Cash-UP é bem variável (já vimos de
  ~1 min a mais de 15 min) — com o timeout de 5 min, a execução pode falhar em dias que o Cash-UP
  demorar mais para gerar o relatório.
- **Encaminhamento não chega no Gmail (timeout de 5 min)**: pode ser Senha de App inválida/expirada,
  ou o email caiu em spam — checar a pasta de spam do `sistemaorganon@gmail.com`.
- **Erro de login SMTP/IMAP (LM Treina)**: verificar `WEBMAIL_PASS` (webmail LM Treina).
- **Erro SMTP 550 "Outgoing mail ... has been suspended"**: suspensão de anti-spam da hospedagem do
  domínio — não é bug do script. Evitar disparos manuais repetidos em sequência curta; a suspensão
  costuma se resolver sozinha depois de um tempo.

## Agendamento
Roda sozinho todo dia às **18h (horário de Brasília)** via GitHub Actions —
`.github/workflows/relatorio-cashup.yml` (mesmo padrão do agente de email LM Treina).
Também pode ser disparado manualmente pela aba **Actions** do repositório no GitHub
(botão "Run workflow"), sem precisar do computador local ligado. Timeout do job: 25 minutos.

### Secrets necessários no GitHub (Settings → Secrets and variables → Actions)
- `CASHUP_URL` — `https://www.cashup-pgquimica.com.br/`
- `CASHUP_USER` — email de login do Cash-UP
- `CASHUP_PASS` — senha do Cash-UP
- `WEBMAIL_USER` — `bruno@lmtreina.com.br`
- `WEBMAIL_PASS` — senha do webmail LM Treina
- `WEBMAIL_GMAIL_USER` — `sistemaorganon@gmail.com`
- `WEBMAIL_GMAIL_PASS` — Senha de App do Gmail (não é a senha normal da conta)
- `EMAIL_PARA` — `alexandre.azevedo@pgquimica.com.br,graco@grupopq.com,bruno@solucoesb4.com.br`

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`).

> **Atenção:** `WEBMAIL_GMAIL_USER`/`WEBMAIL_GMAIL_PASS` tinham sido marcados como não usados numa
> versão anterior deste projeto e podem ter sido apagados dos secrets do GitHub. Confirme que os dois
> existem e estão corretos em Settings → Secrets antes de confiar na próxima execução agendada —
> sem eles o job falha na etapa "Validar secrets configurados".
