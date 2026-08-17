# Relatório de Orçamentos — Cash-UP (Grupo PQ)

## Início Rápido
Dê **duplo clique em `executar_relatorio.bat`**. Ele verifica Python e dependências automaticamente antes de rodar.

Ou via terminal:
```bash
cd "C:\Claude\GRUPOPQ\PROJETOS\relatorio_cashup"
py -3 relatorio_cashup.py
```

## O que o script faz
1. Login automático no Cash-UP (`https://www.cashup-pgquimica.com.br/`) com as credenciais do `.env`.
2. Abre o menu **Orçamentos** — o próprio sistema já aplica por padrão o filtro
   **Período de Criação = últimos ~30 dias (rolling)** sem precisar de nenhuma configuração manual.
3. Clica em **Exportar Excel** e baixa o relatório (`.xls` binário real, não HTML disfarçado) em `relatorios/Orcamentos_AAAA-MM-DD.xls`.
4. Envia o arquivo por email (SMTP) para `EMAIL_PARA` definido no `.env`.

Fluxo 100% automático — sem pausa manual, sem interação humana.

## Decisão importante: por que "Exportar Excel" e não "Relatório Orçamentos"?
O passo a passo original (prints em `passoapasso/`) mostra um botão **"Relatório Orçamentos"**
ao lado de "Carregar Filtros". Ao testar com o login `bruno@lmtreina.com.br` (o mesmo do `.env`),
esse botão **não aparece** na tela — só existem `Salvar Filtros`, `Carregar Filtros`, `Limpar Filtros`
e `Exportar Excel`. É provável que "Relatório Orçamentos" dependa de um perfil de acesso diferente
(o print de login mostrava `graco@grupopq.com` como sugestão do navegador, não necessariamente o
mesmo perfil usado aqui).

Como `Exportar Excel` já entrega um arquivo `.xls` real com todos os orçamentos filtrados — o que
cumpre o pedido de "extrair o relatório" — o script usa esse caminho, testado e funcionando ponta a
ponta. Se no futuro for necessário o relatório específico "Relatório Orçamentos" (visão diferente,
talvez mais resumida), será preciso um login com esse botão habilitado.

## Configuração (`.env`)
```
URL=https://www.cashup-pgquimica.com.br/
USER=bruno@lmtreina.com.br
PASS=<senha do Cash-UP>

WEBMAIL_USER=bruno@lmtreina.com.br
WEBMAIL_PASS=<senha do webmail LM Treina>
EMAIL_PARA=bruno@lmtreina.com.br
```

## Estrutura de pastas
```
relatorio_cashup/
├── relatorio_cashup.py      ← script principal
├── executar_relatorio.bat   ← duplo clique para rodar
├── requirements.txt
├── .env                     ← credenciais (não versionado)
├── .gitignore
├── passoapasso/              ← prints originais do fluxo manual
├── relatorios/               ← .xls baixados (por data)
└── debug/                    ← screenshots salvos automaticamente em caso de erro
```

## Solução de problemas
- **Login falha**: script salva screenshot em `debug/erro_login_<data>.png`.
- **Grade de orçamentos não carrega**: screenshot em `debug/erro_grid_<data>.png` — pode ser lentidão do portal.
- **Exportar Excel não baixa a tempo**: screenshot em `debug/erro_export_<data>.png`.
- **Email não envia**: script tenta 4 combinações de servidor SMTP (`mail.<domínio>:587`, `<domínio>:587`,
  `smtp.<domínio>:587`, `mail.<domínio>:465`) antes de desistir — mesmo padrão usado no agente de email LM Treina.

## Agendamento
Roda sozinho todo dia às **6h (horário de Brasília)** via GitHub Actions —
`.github/workflows/relatorio-cashup.yml` (mesmo padrão do agente de email LM Treina).
Também pode ser disparado manualmente pela aba **Actions** do repositório no GitHub
(botão "Run workflow"), sem precisar do computador local ligado.

### Secrets necessários no GitHub (Settings → Secrets and variables → Actions)
- `CASHUP_URL` — `https://www.cashup-pgquimica.com.br/`
- `CASHUP_USER` — email de login do Cash-UP
- `CASHUP_PASS` — senha do Cash-UP
- `WEBMAIL_USER` / `WEBMAIL_PASS` — já existem no repo (usados pelo agente de email LM Treina); reaproveitados aqui para o envio SMTP
- `EMAIL_PARA` — `bruno@lmtreina.com.br`

Os valores devem ser copiados do `.env` local (que nunca é commitado, ver `.gitignore`).
