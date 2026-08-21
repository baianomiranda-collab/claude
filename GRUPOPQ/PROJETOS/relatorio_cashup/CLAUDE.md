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
dispara essa geração e, assim que o email chegar, encaminha ele direto para o destinatário final:

1. Login automático no Cash-UP (`https://www.cashup-pgquimica.com.br/`) com `CASHUP_USER`/`CASHUP_PASS`.
2. Abre o menu **Orçamentos** — o próprio sistema já aplica por padrão o filtro
   **Período de Criação = últimos ~30 dias (rolling)** sem precisar de nenhuma configuração manual.
3. Clica em **"Relatório Orçamentos"**. O Cash-UP responde com o aviso "O Relatório de Orçamentos
   será enviado para seu email cadastrado no Cash-UP em alguns minutos." e fecha o navegador (não há
   nada mais a fazer no browser).
4. Faz **polling via IMAP** na caixa de `WEBMAIL_USER` (bruno@lmtreina.com.br, webmail LM Treina)
   até chegar um email novo de `cashup@cashup-pgquimica.com.br` com assunto
   `Excel Relatório Orçamento - Cash-UP` (checa a cada 20s, até 15 min).
5. **Encaminha esse email direto** (RFC822 completo, com o anexo original — não recompõe nada) para
   `EMAIL_PARA`, autenticando como `WEBMAIL_USER`.

Fluxo 100% automático — sem pausa manual, sem interação humana. Só existe espera (polling), nunca
intervenção.

## Histórico: por que não tem mais um salto intermediário?
Versões anteriores relayavam o email por uma segunda conta (`sistemaorganon@gmail.com`, depois
`organon@solucoesb4.com.br`) antes de chegar ao destino final — provavelmente para padronizar o
remetente dos relatórios automatizados. Isso trouxe dois problemas: mais um ponto de falha (esperar
um segundo email chegar) e, no caso do webmail B4, uma suspensão de envio pela hospedagem (erro SMTP
550, por volume de testes). A pedido do Bruno, o fluxo foi simplificado para encaminhar direto de
`bruno@lmtreina.com.br` para o destinatário final — mais rápido e com menos pontos de falha.

Antes disso, o script usava o botão **"Exportar Excel"** (download direto), porque na época
"Relatório Orçamentos" não aparecia para esse login. Isso mudou — hoje o botão está visível e habilitado.

## Configuração (`.env`)
```
CASHUP_URL=https://www.cashup-pgquimica.com.br/
CASHUP_USER=bruno@lmtreina.com.br
CASHUP_PASS=<senha do Cash-UP>

WEBMAIL_USER=bruno@lmtreina.com.br
WEBMAIL_PASS=<senha do webmail LM Treina>

EMAIL_PARA=<destinatário final do relatório>
```

`WEBMAIL_USER`/`WEBMAIL_PASS` são usados tanto para ler a caixa (IMAP, esperar o email do Cash-UP)
quanto para enviar o encaminhamento final (SMTP). O servidor é descoberto automaticamente a partir do
domínio do email (`mail.<domínio>`, `<domínio>`, `smtp.<domínio>`, mesmo padrão usado no agente de
email LM Treina) — não é preciso informar host manualmente.

## Proteção contra emails antigos/duplicados
Antes de disparar o relatório, o script registra o maior UID já existente na caixa de `WEBMAIL_USER`.
Só considera "o email certo" um que chegue com UID **maior** que esse ponto de partida — assim uma
execução nunca pega por engano um relatório de um dia anterior (ou de outra pessoa) que já estava
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
  necessariamente para o que está logado. O tempo de entrega do Cash-UP é bem variável (já vimos de
  ~1 min a mais de 15 min).
- **Erro de login SMTP/IMAP**: verificar `WEBMAIL_PASS` (webmail LM Treina).
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
- `EMAIL_PARA` — destinatário final do relatório

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`). Os secrets
`WEBMAIL_GMAIL_USER`/`WEBMAIL_GMAIL_PASS`/`WEBMAIL_ORGANON_USER`/`WEBMAIL_ORGANON_PASS` de versões
anteriores não são mais usados — podem ser apagados.
