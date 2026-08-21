"""
=============================================================
  RELATORIO DE ORCAMENTOS - CASH-UP (PG QUIMICA / GRUPO PQ)
  Portal: https://www.cashup-pgquimica.com.br/
  Uso: python relatorio_cashup.py
=============================================================
Fluxo 100% automatico, sem pausa manual:
  1. Login no Cash-UP com credenciais do .env
  2. Abre "Orcamentos" (o proprio sistema ja aplica o filtro
     padrao de "Periodo de Criacao" = ultimos ~30 dias)
  3. Clica em "Relatorio Orcamentos" — o Cash-UP gera o relatorio
     e envia por email para o endereco cadastrado (WEBMAIL_USER)
  4. Aguarda esse email chegar na caixa de bruno@lmtreina.com.br
     (remetente do dominio cashup-pgquimica.com.br)
  5. Encaminha esse email direto (sem recompor) para EMAIL_PARA (.env),
     usando as credenciais de bruno@lmtreina.com.br

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

URL = os.getenv("CASHUP_URL")
LOGIN_USER = os.getenv("CASHUP_USER")
LOGIN_PASS = os.getenv("CASHUP_PASS")
WEBMAIL_USER = os.getenv("WEBMAIL_USER")
WEBMAIL_PASS = os.getenv("WEBMAIL_PASS")
EMAIL_PARA = os.getenv("EMAIL_PARA")

DEBUG_DIR = BASE_DIR / "debug"
DEBUG_DIR.mkdir(exist_ok=True)

ENV_OBRIGATORIAS = [
    "CASHUP_URL", "CASHUP_USER", "CASHUP_PASS",
    "WEBMAIL_USER", "WEBMAIL_PASS",
    "EMAIL_PARA",
]

CASHUP_SENDER_MATCH = "cashup-pgquimica.com.br"
SUBJECT_MATCH_PARTES = ["relatorio", "orcamento"]  # comparado sem acento, minusculo

POLL_INTERVAL = 20  # segundos entre tentativas
TIMEOUT_EMAIL_CASHUP = 5 * 60  # espera maxima pelo email do Cash-UP


def verificar_ambiente() -> bool:
    print("\nVerificando ambiente...")
    faltando = [k for k in ENV_OBRIGATORIAS if not os.getenv(k)]
    if faltando:
        print(f"  ERRO: variaveis faltando no .env: {', '.join(faltando)}")
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
    """Faz login no Cash-UP, abre Orcamentos e clica em 'Relatorio Orcamentos'."""
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

        print("  Login OK. Abrindo Orcamentos...")
        page.click("text=Orçamentos")
        page.wait_for_load_state("networkidle", timeout=30000)

        try:
            page.wait_for_selector("text=Mostrando", timeout=30000)
        except PWTimeout:
            page.screenshot(path=str(DEBUG_DIR / f"erro_grid_{hoje}.png"))
            browser.close()
            raise RuntimeError("Grade de orcamentos nao carregou a tempo.")

        print("  Clicando em 'Relatorio Orcamentos'...")
        try:
            page.locator("text=Relatório Orçamentos").first.click(timeout=10000)
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


def encaminhar_email(connector_imap, uid: int, de: str, para: str, smtp_user: str, smtp_pass: str, smtp_hosts: list[tuple[str, int]]) -> None:
    """Busca o email completo (com anexo) e reenvia como esta, so trocando From/To."""
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
    msg["To"] = para

    ultimo_erro = None
    for host, port in smtp_hosts:
        try:
            if port == 465:
                srv = smtplib.SMTP_SSL(host, port, timeout=30)
            else:
                srv = smtplib.SMTP(host, port, timeout=30)
                srv.starttls()
            srv.login(smtp_user, smtp_pass)
            srv.sendmail(de, [para], msg.as_bytes())
            srv.quit()
            print(f"  Encaminhado de {de} para {para} via {host}:{port}")
            return
        except Exception as e:
            ultimo_erro = e

    raise RuntimeError(f"Nao foi possivel encaminhar o email de {de} para {para}: {ultimo_erro}")


def main():
    print("=" * 60)
    print("  RELATORIO DE ORCAMENTOS - CASH-UP")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    if not verificar_ambiente():
        sys.exit(1)

    domain_lm = WEBMAIL_USER.split("@")[1]
    smtp_hosts_lm = [("mail." + domain_lm, 587), (domain_lm, 587), ("smtp." + domain_lm, 587), ("mail." + domain_lm, 465)]

    try:
        print("\nRegistrando ponto de partida da caixa de entrada...")
        baseline_lm = uid_maximo_atual(conectar_imap_lmtreina)

        print("\nDisparando relatorio no Cash-UP...")
        disparar_relatorio()

        print(f"\nAguardando email do Cash-UP em {WEBMAIL_USER} (ate {TIMEOUT_EMAIL_CASHUP // 60} min)...")
        uid1 = aguardar_email(conectar_imap_lmtreina, baseline_lm, CASHUP_SENDER_MATCH, SUBJECT_MATCH_PARTES, TIMEOUT_EMAIL_CASHUP)
        if uid1 is None:
            raise RuntimeError(f"Email do Cash-UP nao chegou em {WEBMAIL_USER} dentro do prazo.")

        print(f"\nEncaminhando para {EMAIL_PARA}...")
        encaminhar_email(conectar_imap_lmtreina, uid1, WEBMAIL_USER, EMAIL_PARA, WEBMAIL_USER, WEBMAIL_PASS, smtp_hosts_lm)

    except Exception as e:
        print(f"\nERRO: {e}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  PROCESSO CONCLUIDO COM SUCESSO")
    print("=" * 60)


if __name__ == "__main__":
    main()
