"""
=============================================================
  RELATORIO DE ORCAMENTOS - CASH-UP (PG QUIMICA / GRUPO PQ)
  Portal: https://www.cashup-pgquimica.com.br/
  Uso: python relatorio_cashup.py
=============================================================
Fluxo 100% automatico, sem pausa manual:
  1. Login no Cash-UP com credenciais do .env
  2. Abre "Orcamentos" (menu superior -> submenu "Orcamentos")
  3. Clica em "Carregar Filtros" e depois em "Relatorio Orcamentos"
     — o Cash-UP gera o relatorio e envia por email para o
     endereco cadastrado (WEBMAIL_USER)
  4. Aguarda esse email chegar na caixa de bruno@lmtreina.com.br
     (remetente do dominio cashup-pgquimica.com.br)
  5. Encaminha esse email (sem recompor) para sistemaorganon@gmail.com,
     usando as credenciais de bruno@lmtreina.com.br
  6. Aguarda o email chegar na caixa do sistemaorganon@gmail.com
  7. Encaminha esse email (sem recompor) para os destinatarios finais
     em CASHUP_EMAIL_PARA_PG (.env, lista separada por virgula)

DEPENDENCIAS:
  pip install playwright python-dotenv
  playwright install chromium
"""

import email
import email.header
import imaplib
import os
import smtplib
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
except ImportError as e:
    print(f"ERRO: dependencia nao instalada ({e.name}).")
    print("   Execute: pip install -r requirements.txt")
    sys.exit(1)

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env", override=True)

URL = os.getenv("CASHUP_PG_URL")
LOGIN_USER = os.getenv("CASHUP_PG_USER")
LOGIN_PASS = os.getenv("CASHUP_PG_PASS")
WEBMAIL_USER = os.getenv("CASHUP_WEBMAIL_PG_USER")
WEBMAIL_PASS = os.getenv("CASHUP_WEBMAIL_PG_PASS")
GMAIL_USER = os.getenv("CASHUP_WEBMAIL_GMAIL_PG_USER")
GMAIL_PASS = (os.getenv("CASHUP_WEBMAIL_GMAIL_PG_PASS") or "").replace(" ", "")
EMAIL_PARA_LIST = [e.strip() for e in (os.getenv("CASHUP_EMAIL_PARA_PG") or "").split(",") if e.strip()]

DEBUG_DIR = BASE_DIR / "debug"
DEBUG_DIR.mkdir(exist_ok=True)

ENV_OBRIGATORIAS = [
    "CASHUP_PG_URL", "CASHUP_PG_USER", "CASHUP_PG_PASS",
    "CASHUP_WEBMAIL_PG_USER", "CASHUP_WEBMAIL_PG_PASS",
    "CASHUP_WEBMAIL_GMAIL_PG_USER", "CASHUP_WEBMAIL_GMAIL_PG_PASS",
    "CASHUP_EMAIL_PARA_PG",
]

CASHUP_SENDER_MATCH = "cashup-pgquimica.com.br"
SUBJECT_MATCH_PARTES = ["relatorio", "orcamento"]  # comparado sem acento, minusculo
PROJETO_TAG = "PG"  # marcado no assunto do 1o encaminhamento p/ diferenciar de outros projetos Cash-UP
                     # que usam a mesma caixa bruno@lmtreina.com.br e o mesmo relay sistemaorganon@gmail.com

POLL_INTERVAL = 20  # segundos entre tentativas
TIMEOUT_EMAIL_CASHUP = 15 * 60   # espera maxima pelo email do Cash-UP (ja levou de ~1 a 15+ min)
TIMEOUT_EMAIL_ORGANON = 10 * 60  # espera maxima pelo encaminhamento chegar em GMAIL_USER


def verificar_ambiente() -> bool:
    print("\nVerificando ambiente...")
    faltando = [k for k in ENV_OBRIGATORIAS if not os.getenv(k)]
    if faltando:
        print(f"  ERRO: variaveis faltando no .env: {', '.join(faltando)}")
        return False
    if not EMAIL_PARA_LIST:
        print("  ERRO: CASHUP_EMAIL_PARA_PG nao tem nenhum destinatario valido")
        return False
    print("  OK: .env com todas as variaveis necessarias")
    return True


def normalizar(texto: str) -> str:
    """Remove acentos e coloca em minusculo, para comparacao tolerante."""
    nfkd = unicodedata.normalize("NFKD", texto or "")
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return sem_acento.lower()


def decodificar_header(raw) -> str:
    partes = email.header.decode_header(raw or "")
    resultado = []
    for parte, enc in partes:
        if isinstance(parte, bytes):
            charset = enc or "utf-8"
            if charset.lower() in ("unknown-8bit", "unknown"):
                charset = "latin-1"
            try:
                resultado.append(parte.decode(charset, errors="replace"))
            except LookupError:
                resultado.append(parte.decode("latin-1", errors="replace"))
        else:
            resultado.append(parte)
    return "".join(resultado)


def disparar_relatorio() -> None:
    """Faz login no Cash-UP, abre Orcamentos, carrega filtros e clica em 'Relatorio Orcamentos'."""
    hoje = datetime.now().strftime("%Y-%m-%d")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200})

        print("  Acessando Cash-UP...")
        page.goto(URL, wait_until="networkidle", timeout=60000)
        page.fill("#email", LOGIN_USER)
        page.fill("#passwd", LOGIN_PASS)

        try:
            with page.expect_navigation(wait_until="networkidle", timeout=20000):
                page.locator("button", has_text="Log In").first.click()
        except PWTimeout:
            page.screenshot(path=str(DEBUG_DIR / f"erro_login_{hoje}.png"))
            browser.close()
            raise RuntimeError("Falha ao fazer login no Cash-UP (timeout apos clicar em Log In).")

        if "orcamentos" not in page.url and page.locator("#email").count() > 0:
            page.screenshot(path=str(DEBUG_DIR / f"erro_login2_{hoje}.png"))
            browser.close()
            raise RuntimeError("Login parece ter falhado (ainda na tela de login).")

        # Menu superior "Orcamentos" abre um submenu com o item "Orcamentos"
        # (mesmo texto duas vezes) que precisa ser clicado para navegar de fato.
        print("  Login OK. Abrindo Orçamentos...")
        page.click("text=Orçamentos")
        page.wait_for_timeout(500)
        try:
            page.locator("text=Orçamentos").last.click(timeout=3000)
        except PWTimeout:
            pass  # alguns logins ja navegam direto no primeiro clique
        page.wait_for_load_state("networkidle", timeout=30000)

        try:
            page.wait_for_selector("text=Mostrando", timeout=30000)
        except PWTimeout:
            page.screenshot(path=str(DEBUG_DIR / f"erro_grid_{hoje}.png"))
            browser.close()
            raise RuntimeError("Grade de orcamentos nao carregou a tempo.")

        # Seletor com aspas = match EXATO. Sem aspas o Playwright casa por substring, e quando o
        # painel de filtros abre expandido a pagina tambem contem o rotulo "Carregar Filtros Salvos"
        # — o .first pegava esse rotulo em vez do botao e o clique falhava (visto na PQ em 27/08/2026).
        print("  Carregando filtros salvos...")
        try:
            page.locator('text="Carregar Filtros"').first.click(timeout=30000)
        except PWTimeout:
            page.screenshot(path=str(DEBUG_DIR / f"erro_carregar_filtros_{hoje}.png"))
            browser.close()
            raise RuntimeError("Botao 'Carregar Filtros' nao encontrado/clicavel.")
        try:
            page.wait_for_load_state("networkidle", timeout=15000)
        except PWTimeout:
            pass
        page.wait_for_timeout(2000)

        print("  Clicando em 'Relatorio Orcamentos'...")
        try:
            page.locator('text="Relatório Orçamentos"').first.click(timeout=30000)
        except PWTimeout:
            page.screenshot(path=str(DEBUG_DIR / f"erro_botao_relatorio_{hoje}.png"))
            browser.close()
            raise RuntimeError("Botao 'Relatorio Orcamentos' nao encontrado/clicavel.")

        page.wait_for_timeout(3000)
        page.screenshot(path=str(DEBUG_DIR / f"relatorio_disparado_{hoje}.png"))
        browser.close()

    print("  Relatorio disparado no Cash-UP (sera enviado por email pelo proprio sistema).")


def conectar_imap(user: str, password: str, hosts_portas: list[tuple[str, int]]):
    ultimo_erro = None
    for host, port in hosts_portas:
        try:
            imap = imaplib.IMAP4_SSL(host, port, timeout=30)
            imap.login(user, password)
            return imap
        except Exception as e:
            ultimo_erro = e
    raise RuntimeError(f"Nao foi possivel conectar via IMAP para {user}: {ultimo_erro}")


def conectar_imap_lmtreina():
    domain = WEBMAIL_USER.split("@")[1]
    hosts = [("mail." + domain, 993), (domain, 993), ("webmail." + domain, 993), ("imap." + domain, 993)]
    return conectar_imap(WEBMAIL_USER, WEBMAIL_PASS, hosts)


def conectar_imap_gmail():
    return conectar_imap(GMAIL_USER, GMAIL_PASS, [("imap.gmail.com", 993)])


def uid_maximo_atual(connector) -> int:
    imap = connector()
    imap.select("INBOX")
    typ, data = imap.uid("search", None, "ALL")
    uids = data[0].split()
    imap.logout()
    return int(uids[-1]) if uids else 0


def aguardar_email(connector, baseline: int, sender_match: str, subject_partes: list[str], timeout: int):
    """Faz polling na INBOX ate achar um email com UID > baseline que combine com sender/subject."""
    prazo = time.time() + timeout
    tentativa = 0
    while time.time() < prazo:
        tentativa += 1
        imap = connector()
        imap.select("INBOX")
        typ, data = imap.uid("search", None, "ALL")
        uids = sorted(int(u) for u in data[0].split() if int(u) > baseline)

        for uid in uids:
            typ, msg_data = imap.uid("fetch", str(uid).encode(), "(BODY.PEEK[HEADER])")
            if not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)
            remetente = decodificar_header(msg.get("From", ""))
            assunto = normalizar(decodificar_header(msg.get("Subject", "")))

            if sender_match.lower() in remetente.lower() and all(p in assunto for p in subject_partes):
                imap.logout()
                print(f"    Encontrado: From={remetente!r} Subject={decodificar_header(msg.get('Subject',''))!r}")
                return uid

        imap.logout()
        print(f"    [tentativa {tentativa}] ainda nao chegou, aguardando {POLL_INTERVAL}s...")
        time.sleep(POLL_INTERVAL)

    return None


def encaminhar_email(connector_imap, uid: int, de: str, para, smtp_user: str, smtp_pass: str, smtp_hosts: list[tuple[str, int]], subject_suffix: str = None) -> None:
    """Busca o email completo (com anexo) e reenvia como esta, so trocando From/To.

    `para` aceita um unico endereco (str) ou uma lista de enderecos. Se `subject_suffix` for
    passado, e anexado ao final do assunto (ex: "- PG") — usado no 1o encaminhamento pra marcar
    de qual projeto veio o relatorio, ja que caixa e relay sao compartilhados entre projetos.
    """
    destinatarios = [para] if isinstance(para, str) else list(para)

    imap = connector_imap()
    imap.select("INBOX")
    typ, msg_data = imap.uid("fetch", str(uid).encode(), "(RFC822)")
    raw = msg_data[0][1]
    imap.logout()

    msg = email.message_from_bytes(raw)
    for header in ("From", "To", "Return-Path", "DKIM-Signature"):
        if header in msg:
            del msg[header]
    msg["From"] = de
    msg["To"] = ", ".join(destinatarios)

    if subject_suffix:
        assunto_atual = decodificar_header(msg.get("Subject", ""))
        del msg["Subject"]
        msg["Subject"] = email.header.Header(f"{assunto_atual} {subject_suffix}", "utf-8").encode()

    ultimo_erro = None
    for host, port in smtp_hosts:
        try:
            if port == 465:
                srv = smtplib.SMTP_SSL(host, port, timeout=30)
            else:
                srv = smtplib.SMTP(host, port, timeout=30)
                srv.starttls()
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(de, destinatarios, msg.as_bytes())
            srv.quit()
            print(f"  Encaminhado de {de} para {', '.join(destinatarios)} via {host}:{port}")
            return
        except Exception as e:
            ultimo_erro = e

    raise RuntimeError(f"Nao foi possivel encaminhar o email de {de} para {', '.join(destinatarios)}: {ultimo_erro}")


def main():
    print("=" * 60)
    print("  RELATORIO DE ORCAMENTOS - CASH-UP")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    if not verificar_ambiente():
        sys.exit(1)

    domain_lm = WEBMAIL_USER.split("@")[1]
    smtp_hosts_lm = [("mail." + domain_lm, 587), (domain_lm, 587), ("smtp." + domain_lm, 587), ("mail." + domain_lm, 465)]
    smtp_hosts_gmail = [("smtp.gmail.com", 587)]

    try:
        print("\nRegistrando ponto de partida das caixas de entrada...")
        baseline_lm = uid_maximo_atual(conectar_imap_lmtreina)
        baseline_og = uid_maximo_atual(conectar_imap_gmail)

        print("\nDisparando relatorio no Cash-UP...")
        disparar_relatorio()

        print(f"\nAguardando email do Cash-UP em {WEBMAIL_USER} (ate {TIMEOUT_EMAIL_CASHUP // 60} min)...")
        uid1 = aguardar_email(conectar_imap_lmtreina, baseline_lm, CASHUP_SENDER_MATCH, SUBJECT_MATCH_PARTES, TIMEOUT_EMAIL_CASHUP)
        if uid1 is None:
            raise RuntimeError(f"Email do Cash-UP nao chegou em {WEBMAIL_USER} dentro do prazo.")

        print(f"\nEncaminhando para {GMAIL_USER} (marcado '- {PROJETO_TAG}' no assunto)...")
        encaminhar_email(conectar_imap_lmtreina, uid1, WEBMAIL_USER, GMAIL_USER, WEBMAIL_USER, WEBMAIL_PASS, smtp_hosts_lm, subject_suffix=f"- {PROJETO_TAG}")

        print(f"\nAguardando email chegar em {GMAIL_USER} (ate {TIMEOUT_EMAIL_ORGANON // 60} min)...")
        uid2 = aguardar_email(conectar_imap_gmail, baseline_og, WEBMAIL_USER, SUBJECT_MATCH_PARTES + [f"- {PROJETO_TAG.lower()}"], TIMEOUT_EMAIL_ORGANON)
        if uid2 is None:
            raise RuntimeError(f"Email encaminhado nao chegou em {GMAIL_USER} dentro do prazo.")

        print(f"\nEncaminhando para {', '.join(EMAIL_PARA_LIST)}...")
        encaminhar_email(conectar_imap_gmail, uid2, GMAIL_USER, EMAIL_PARA_LIST, GMAIL_USER, GMAIL_PASS, smtp_hosts_gmail)

    except Exception as e:
        print(f"\nERRO: {e}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  PROCESSO CONCLUIDO COM SUCESSO")
    print("=" * 60)


if __name__ == "__main__":
    main()
