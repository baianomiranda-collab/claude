# Notícias Tributárias BR — Briefing Diário ⚖️📊

## OBJETIVO
Todo dia às 7h00 (horário de Brasília), executar uma varredura nas fontes abaixo,
coletar as principais notícias tributárias/fiscais do Brasil das últimas 24h,
notícias internacionais que possam impactar o cenário tributário brasileiro,
e notícias políticas e econômicas relevantes para compor o cenário completo,
gerando um resumo em português brasileiro, exibido diretamente no chat em markdown.

---

## FONTES
Acessar os seguintes sites e extrair os links/títulos das matérias mais recentes:

Oficiais / Governo
https://www.gov.br/receitafederal/pt-br/assuntos/noticias
https://www.in.gov.br/leiturajornal
https://www.gov.br/fazenda/pt-br/assuntos/noticias
https://www.gov.br/carf/pt-br
https://www.gov.br/planalto/pt-br/acompanhe-o-planalto
https://www.camara.leg.br/noticias/
https://www12.senado.leg.br/noticias
https://www.gov.br/receitafederal/pt-br/assuntos/reforma-tributaria
https://www.bcb.gov.br/detalhenoticia

Jurisprudência / Tribunais
https://portal.stf.jus.br/noticias/
https://www.stj.jus.br/sites/portalp/Paginas/Comunicacao/Noticias.aspx
https://www.conjur.com.br/tributario/
https://www.jota.info/tributos-e-empresas

Imprensa especializada em tributário/jurídico
https://www.jota.info/
https://www.migalhas.com.br/area/tributario
https://tributario.com.br/
https://www.ibpt.com.br/noticias/
https://www.contabeis.com.br/
https://www.jornalcontabil.com.br/

Economia & Mercado (contexto)
https://valor.globo.com/
https://www.infomoney.com.br/
https://www.estadao.com.br/economia/
https://g1.globo.com/economia/
https://www.cnnbrasil.com.br/economia/

Política (cenário fiscal e tramitações)
https://www.poder360.com.br/
https://congressoemfoco.uol.com.br/

Cenário internacional (impacto no tributário BR)
https://www.oecd.org/tax/
https://taxfoundation.org/
https://news.bloombergtax.com/
https://www.reuters.com/legal/tax/

Reforma Tributaria
https://dfe-portal.svrs.rs.gov.br/CFF
https://www.camara.leg.br/reforma-tributaria/
https://www12.senado.leg.br/noticias/especiais/reforma-tributaria
https://www.gov.br/fazenda/pt-br/acesso-a-informacao/acoes-e-programas/reforma-tributaria
https://www.gov.br/cgibs/pt-br
https://www.confaz.fazenda.gov.br/
https://www12.senado.leg.br/ifi
https://fenacon.org.br/
https://www.jota.info/tributos-e-empresas/reforma-tributaria

--

## FILTRO DE RELEVÂNCIA
Priorizar notícias relacionadas a **pelo menos um** dos seguintes tópicos:
1. **Legislação e Reforma Tributária** — leis, medidas provisórias, PLs, instruções
   normativas da Receita Federal, regulamentação do IBS/CBS/Imposto Seletivo
2. **Judicial & Administrativo** — decisões do STF, STJ e CARF com repercussão
   tributária, mudanças de teses, julgamentos de repetitivos
3. **Economia & Política Fiscal** — arrecadação, meta fiscal, Copom/Selic, câmbio,
   dívida pública, contas públicas, quando conectados a impacto tributário
4. **Cenário Internacional** — OCDE/BEPS, Pillar Two (tributação mínima global),
   tarifas e acordos comerciais, tratados de bitributação, decisões de outros
   países com efeito sobre empresas brasileiras
5. **Obrigações Acessórias & Prazos** — SPED, eSocial, NF-e/NFS-e, calendário
   fiscal, mudanças de prazo de entrega
6. **Cenário Político** — tramitação legislativa, movimentações do Congresso/
   Executivo com efeito direto sobre a agenda fiscal e tributária

Ignorar: notícias de opinião sem base normativa, política partidária sem relação
fiscal/tributária direta, e duplicatas (mesma notícia em fontes diferentes →
manter apenas a mais completa).

---

## OUTPUT FORMAT

Exibir o seguinte bloco em markdown no chat:

---

# ⚖️ Notícias Tributárias BR — {DATA_HOJE} | 7h Briefing

## 🔥 Destaques do Dia
> _{1 a 3 frases resumindo o que há de mais relevante hoje}_

---

## 📌 Notícias por Categoria

### ⚖️ Legislação & Reforma Tributária
- **[Título da Notícia](URL)** — Resumo em 1–2 frases. `[Fonte]`

### 🏛️ Judicial & Administrativo (STF/STJ/CARF)
- **[Título da Notícia](URL)** — Resumo em 1–2 frases. `[Fonte]`

### 💰 Economia & Política Fiscal
- **[Título da Notícia](URL)** — Resumo em 1–2 frases. `[Fonte]`

### 🌍 Cenário Internacional
- **[Título da Notícia](URL)** — Resumo em 1–2 frases. `[Fonte]`

### 📋 Obrigações Acessórias & Prazos
- **[Título da Notícia](URL)** — Resumo em 1–2 frases. `[Fonte]`

---

## 💡 Insight do Dia
> _{Uma observação estratégica ou padrão identificado nas notícias de hoje,
  útil para quem precisa se planejar fiscal/tributariamente}_

---
_Fontes consultadas: JOTA, ConJur, Receita Federal, STF, Valor Econômico | Gerado às 07:00 BRT_
