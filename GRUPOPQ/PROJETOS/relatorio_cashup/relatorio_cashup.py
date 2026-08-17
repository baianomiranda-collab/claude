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
  3. Clica em "Exportar Excel" e baixa o relatorio (.xls)
  4. Envia o arquivo por email para EMAIL_PARA (.env)

DEPENDENCIAS:
  pip install playwright python-dotenv
  playwright install chromium
"""

import os
import sys
import smtplib
from datetime import datetime
from pathlib import Path
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email.mime.text import MIMEText
from email import encoders

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

URL = os.getenv("URL")
LOGIN_USER = os.getenv("USER")
LOGIN_PASS = os.getenv("PASS")
WEBMAIL_USER = os.getenv("WEBMAIL_USER")
WEBMAIL_PASS = os.getenv("WEBMAIL_PASS")
EMAIL_PARA = os.getenv("EMAIL_PARA")

RELATORIOS_DIR = BASE_DIR / "relatorios"
DEBUG_DIR = BASE_DIR / "debug"
RELATORIOS_DIR.mkdir(exist_ok=True)
DEBUG_DIR.mkdir(exist_ok=True)

ENV_OBRIGATORIAS = ["URL", "USER", "PASS", "WEBMAIL_USER", "WEBMAIL_PASS", "EMAIL_PARA"]


def verificar_ambiente() -> bool:
    print("\nVerificando ambiente...")
    faltando = [k for k in ENV_OBRIGATORIAS if not os.getenv(k)]
    if faltando:
        print(f"  ERRO: variaveis faltando no .env: {', '.join(faltando)}")
        return False
    print("  OK: .env com todas as variaveis necessarias")
    return True


def baixar_relatorio() -> Path:
    """Faz login no Cash-UP, abre Orcamentos e baixa o Exportar Excel. Retorna o caminho do arquivo salvo."""
    hoje = datetime.now().strftime("%Y-%m-%d")
    destino = RELATORIOS_DIR / f"Orcamentos_{hoje}.xls"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1200}, accept_downloads=True)

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

        print("  Exportando Excel...")
        try:
            with page.expect_download(timeout=30000) as dl_info:
                page.locator("text=Exportar Excel").first.click()
            download = dl_info.value
            download.save_as(str(destino))
        except PWTimeout:
            page.screenshot(path=str(DEBUG_DIR / f"erro_export_{hoje}.png"))
            browser.close()
            raise RuntimeError("Botao 'Exportar Excel' nao iniciou o download a tempo.")

        browser.close()

    if not destino.exists() or destino.stat().st_size == 0:
        raise RuntimeError("Arquivo de relatorio nao foi salvo corretamente.")

    print(f"  Relatorio salvo: {destino} ({destino.stat().st_size} bytes)")
    return destino


def enviar_email(anexo: Path) -> None:
    """Envia o relatorio por email usando as credenciais de webmail do .env."""
    domain = WEBMAIL_USER.split("@")[1]
    smtp_servers = [
        ("mail." + domain, 587),
        (domain, 587),
        ("smtp." + domain, 587),
        ("mail." + domain, 465),
    ]

    hoje_fmt = datetime.now().strftime("%d/%m/%Y")

    msg = MIMEMultipart()
    msg["From"] = WEBMAIL_USER
    msg["To"] = EMAIL_PARA
    msg["Subject"] = f"Relatorio de Orcamentos Cash-UP - {hoje_fmt}"

    corpo = (
        f"Ola,\n\n"
        f"Segue em anexo o relatorio de orcamentos extraido do Cash-UP em {hoje_fmt}, "
        f"com o filtro padrao de Periodo de Criacao (ultimos ~30 dias).\n\n"
        f"Este email foi enviado automaticamente.\n"
    )
    msg.attach(MIMEText(corpo, "plain", "utf-8"))

    with open(anexo, "rb") as f:
        part = MIMEBase("application", "octet-stream")
        part.set_payload(f.read())
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", f'attachment; filename="{anexo.name}"')
    msg.attach(part)

    ultimo_erro = None
    for host, port in smtp_servers:
        try:
            print(f"  Tentando SMTP {host}:{port}...")
            if port == 465:
                srv = smtplib.SMTP_SSL(host, port, timeout=30)
            else:
                srv = smtplib.SMTP(host, port, timeout=30)
                srv.starttls()
            srv.login(WEBMAIL_USER, WEBMAIL_PASS)
            srv.sendmail(WEBMAIL_USER, [EMAIL_PARA], msg.as_string())
            srv.quit()
            print(f"  Email enviado para {EMAIL_PARA} via {host}:{port}")
            return
        except Exception as e:
            print(f"    Falhou: {e}")
            ultimo_erro = e

    raise RuntimeError(f"Nao foi possivel enviar o email por nenhum servidor SMTP testado: {ultimo_erro}")


def main():
    print("=" * 60)
    print("  RELATORIO DE ORCAMENTOS - CASH-UP")
    print(f"  {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print("=" * 60)

    if not verificar_ambiente():
        sys.exit(1)

    try:
        arquivo = baixar_relatorio()
        enviar_email(arquivo)
    except Exception as e:
        print(f"\nERRO: {e}")
        sys.exit(1)

    print("\n" + "=" * 60)
    print("  PROCESSO CONCLUIDO COM SUCESSO")
    print("=" * 60)


if __name__ == "__main__":
    main()
