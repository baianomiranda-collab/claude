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
dispara essa geração e depois relata (encaminha) o email recebido em duas etapas, até chegar no
destinatário final:

1. Login automático no Cash-UP (`https://www.cashup-pgquimica.com.br/`) com `CASHUP_USER`/`CASHUP_PASS`.
2. Abre o menu **Orçamentos** — o próprio sistema já aplica por padrão o filtro
   **Período de Criação = últimos ~30 dias (rolling)** sem precisar de nenhuma configuração manual.
3. Clica em **"Relatório Orçamentos"**. O Cash-UP responde com o aviso "O Relatório de Orçamentos
   será enviado para seu email cadastrado no Cash-UP em alguns minutos." e fecha o navegador (não há
   nada mais a fazer no browser).
4. Faz **polling via IMAP** na caixa de `WEBMAIL_USER` (bruno@lmtreina.com.br, webmail LM Treina)
   até chegar um email novo de `cashup@cashup-pgquimica.com.br` com assunto
   `Excel Relatório Orçamento - Cash-UP` (checa a cada 20s, até 15 min).
5. **Encaminha esse email** (RFC822 completo, com o anexo original — não recompõe nada) para
   `WEBMAIL_GMAIL_USER` (sistemaorganon@gmail.com), autenticando como `WEBMAIL_USER`.
6. Faz polling via IMAP na caixa do Gmail (`sistemaorganon@gmail.com`) até esse encaminhamento chegar
   (até 5 min).
7. **Encaminha esse email** (de novo, sem recompor) para `EMAIL_PARA` — o destinatário final da regra,
   autenticando como `WEBMAIL_GMAIL_USER`.

Fluxo 100% automático — sem pausa manual, sem interação humana. Só existe espera (polling), nunca
intervenção.

## Por que esse relay de 2 saltos em vez de anexar direto?
Pedido explícito: usar o botão real **"Relatório Orçamentos"** (que só entrega por email, não por
download) e fazer o email passar pela conta `sistemaorganon@gmail.com` antes de chegar ao destino
final — provavelmente para que todo relatório automatizado do Bruno chegue com a mesma "assinatura"
de remetente consistente, em vez de vir direto de um domínio externo (`cashup-pgquimica.com.br`).

Versão anterior deste projeto usava o botão **"Exportar Excel"** (download direto), porque na época
"Relatório Orçamentos" não aparecia para esse login. Isso mudou — hoje o botão está visível e habilitado.
O salto intermediário já passou por 3 estados: começou em `sistemaorganon@gmail.com` (Gmail), foi trocado
para `organon@solucoesb4.com.br` (webmail próprio B4), e voltou para `sistemaorganon@gmail.com` depois
que a conta `organon@solucoesb4.com.br` foi **suspensa pela hospedagem por volume de envio** (erro SMTP
550 "Outgoing mail ... has been suspended") durante os testes — Gmail não tem esse problema de suspensão
por hospedagem compartilhada.

## Configuração (`.env`)
```
CASHUP_URL=https://www.cashup-pgquimica.com.br/
CASHUP_USER=bruno@lmtreina.com.br
CASHUP_PASS=<senha do Cash-UP>

WEBMAIL_USER=bruno@lmtreina.com.br
WEBMAIL_PASS=<senha do webmail LM Treina>

WEBMAIL_GMAIL_USER=sistemaorganon@gmail.com
WEBMAIL_GMAIL_PASS=<senha de app do Gmail — NÃO é a senha normal da conta>

EMAIL_PARA=<destinatário final do relatório>
```

`WEBMAIL_GMAIL_PASS` precisa ser uma **Senha de App** de 16 caracteres, gerada em
`https://myaccount.google.com/apppasswords` (exige verificação em duas etapas ativada na conta
`sistemaorganon@gmail.com`). A senha normal de login do Gmail não funciona para SMTP/IMAP.

`WEBMAIL_USER`/`WEBMAIL_PASS` são usados tanto para ler a caixa (IMAP, esperar o email do Cash-UP)
quanto para enviar o primeiro encaminhamento (SMTP).

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
- **Botão "Relatório Orçamentos" não encontrado/clicável**: screenshot em
  `debug/erro_botao_relatorio_<data>.png` — pode ser mudança de permissão de novo (já aconteceu antes).
- **Email do Cash-UP nunca chega (timeout de 15 min)**: verificar se `CASHUP_USER` é realmente o email
  cadastrado no Cash-UP para receber o relatório — o sistema manda para "seu email cadastrado", não
  necessariamente para o que está logado.
- **Encaminhamento não chega no Gmail (timeout de 5 min)**: pode ser Senha de App inválida/expirada, ou
  o email caiu em spam — checar a pasta de spam do `sistemaorganon@gmail.com`.
- **Erro de login SMTP/IMAP**: verificar `WEBMAIL_PASS` (webmail LM Treina) e `WEBMAIL_GMAIL_PASS`
  (Senha de App do Gmail — não a senha normal).
- **Erro SMTP 550 "Outgoing mail ... has been suspended"**: suspensão de anti-spam da hospedagem do
  domínio (aconteceu com `organon@solucoesb4.com.br` depois de testes seguidos) — não é bug do script.
  Evitar disparos manuais repetidos em sequência curta; a suspensão costuma se resolver sozinha depois
  de um tempo.

## Agendamento
Roda sozinho todo dia às **18h (horário de Brasília)** via GitHub Actions —
`.github/workflows/relatorio-cashup.yml` (mesmo padrão do agente de email LM Treina).
Também pode ser disparado manualmente pela aba **Actions** do repositório no GitHub
(botão "Run workflow"), sem precisar do computador local ligado. Timeout do job: 30 minutos
(o fluxo tem duas esperas por email que podem levar alguns minutos cada).

### Secrets necessários no GitHub (Settings → Secrets and variables → Actions)
- `CASHUP_URL` — `https://www.cashup-pgquimica.com.br/`
- `CASHUP_USER` — email de login do Cash-UP
- `CASHUP_PASS` — senha do Cash-UP
- `WEBMAIL_USER` — `bruno@lmtreina.com.br`
- `WEBMAIL_PASS` — senha do webmail LM Treina
- `WEBMAIL_GMAIL_USER` — `sistemaorganon@gmail.com`
- `WEBMAIL_GMAIL_PASS` — Senha de App do Gmail (16 caracteres, não a senha normal)
- `EMAIL_PARA` — destinatário final do relatório

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`).
