#!/usr/bin/env python3
"""Agente de email LM Treina — classifica e move emails, envia resumo."""

import imaplib
import smtplib
import email
import email.header
import email.utils
import socket
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta

# ── Ler credenciais do .env ────────────────────────────────────────────────────────
def load_env():
    """Carrega variáveis de ambiente do .env"""
    env_vars = {}
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line and '=' in line:
                    key, val = line.split('=', 1)
                    env_vars[key.strip()] = val.strip()
    return env_vars

ENV = load_env()

# Horário de Brasília (UTC-3)
BRT = timezone(timedelta(hours=-3))
NOW = datetime.now(BRT)
TURNO = "Manha" if NOW.hour < 12 else "Tarde"
DATE_STR = NOW.strftime("%d/%m/%Y")

# Mapeamento nome-lógico → caminho IMAP real (prefixo INBOX.)
FOLDER_MAP = {
    "Helpdesk Grupo PQ": "INBOX.Helpdesk Grupo PQ",
    "JETSON PQ":         "INBOX.JETSON PQ",
    "GRUPOPQ":           "INBOX.GRUPOPQ",
    "coutinho":          "INBOX.COUTINHO",
    "COPERGAS":          "INBOX.COPERGAS",
    "Cora B4":           "INBOX.CORA B4",
    "SERVIDOR B4":       "INBOX.SERVIDOR B4",
    "VEREDA":            "INBOX.VEREDA",
    "B4":                "INBOX.B4",
    "XP":                "INBOX.XP",
    "Newsiga":           "INBOX.Newsiga",
    "QIVE_PQ":           "INBOX.QIVE_PQ",
    "PESSOAL":           "INBOX.PESSOAL",
    "DELETAR":           "INBOX.Trash",
}

# ── Classificação ──────────────────────────────────────────────────────────────────
def classify(sender: str) -> str:
    """Retorna o nome da pasta destino ou '' (não classificado)."""
    s = sender.lower()

    # Extrair domínio do endereço
    addr = s
    if "<" in addr and ">" in addr:
        addr = addr[addr.index("<")+1:addr.index(">")]
    addr = addr.strip()
    domain = addr.split("@")[-1] if "@" in addr else addr

    # ── Exceções específicas (maior prioridade) ────────────────────────────
    if addr == "helpdesk@grupopq.com":
        return "Helpdesk Grupo PQ"
    if addr == "jetson@grupopq.com":
        return "JETSON PQ"
    # Manter na caixa de entrada (não classificar)
    if domain in ("lmtreina.com.br", "safra.com.br", "comunicacao.sympla.com.br",
                  "grupofleury.com.br", "labmm.com.br"):
        return ""

    # ── Grupo PQ ──────────────────────────────────────────────────────────
    pq_exact = ["grupopq.com", "pernambucoquimica.com.br", "pgquimica.com.br",
                "symbolus.com.br", "sofisa.com.br", "vozdocliente.totvs.com.br",
                "bv.com.br", "bwa.global", "abcbrasil.com.br", "arquivei.com.br"]
    if domain in pq_exact:
        return "GRUPOPQ"
    if "totvs.com.br" in domain:
        return "GRUPOPQ"
    if "procenge.movidesk.com" in domain:
        return "GRUPOPQ"

    # ── Coutinho ──────────────────────────────────────────────────────────
    if domain == "coutinhocontadores.com.br":
        return "coutinho"

    # ── Copergas ──────────────────────────────────────────────────────────
    if domain == "copergas.com.br":
        return "COPERGAS"

    # ── Cora B4 ───────────────────────────────────────────────────────────
    if domain == "cora.com.br":
        return "Cora B4"

    # ── Servidor B4 ───────────────────────────────────────────────────────
    if "server4you" in domain or domain == "cloud.acronis.com":
        return "SERVIDOR B4"

    # ── Vereda ────────────────────────────────────────────────────────────
    if domain == "veredainc.com.br":
        return "VEREDA"

    # ── B4 ────────────────────────────────────────────────────────────────
    if domain in ["solucoesb4.com.br", "servhost.com.br", "email.openai.com", "thomsonreuters.com"]:
        return "B4"
    if "b4solucoes.tomticket.com" in domain:
        return "B4"

    # ── XP ────────────────────────────────────────────────────────────────
    if domain in ["vortx.com.br", "xpeducacao.com.br", "xpe.edu.br", "cuoreplatform.com", "emkt.b3.com.br"]:
        return "XP"
    if "xpi.com.br" in domain:
        return "XP"

    # ── Newsiga ───────────────────────────────────────────────────────────
    if domain == "newsiga.com.br":
        return "Newsiga"

    # ── QIVE PQ ───────────────────────────────────────────────────────────
    if domain == "qive.com.br":
        return "QIVE_PQ"

    # ── Pessoal ───────────────────────────────────────────────────────────
    if addr == "sistemaorganon@gmail.com":
        return "PESSOAL"
    pessoal_exact = [
        "uber.com", "comunicacao.inter.co", "ars3.acsoluti.com.br",
        "info.nissan.com.br", "jtnindustria.com.br", "bipa.app",
        "nomadglobal.com", "email.claude.com", "trello.com",
        "amazon.com.br", "acesseseucondominio.com.br",
        "meudemonstrativo.com.br", "asaas.com", "shop.tiktok.com",
        "contato.clubedevantagenshapvida.com.br", "cesar.school",
        "notification.circle.so", "comunicacao.meliuz.com.br",
        "certisign.com.br", "techmetria.com.br",
    ]
    if domain in pessoal_exact:
        return "PESSOAL"
    if "mail.anthropic.com" in domain:
        return "PESSOAL"

    # ── DELETAR ───────────────────────────────────────────────────────────
    delete_exact = [
        "tgfinancas.com.br",
        "freesider.com.br", "oracle.netsuite.com", "portalerp.com",
        "linkedin.com", "pravoce.petz.com.br", "novidades.petz.com.br", "promo.rentcars.com",
        "emailactivecampaign.duxnutrition.com", "gympass.com",
        "blockbusterfilmsuk.com", "ekyte.com", "mailing.buquebus.com.ar",
        "terra.com.br", "news.petlove.com.br", "id.atlassian.com",
        "symboluslog.com.br", "mail.vivo.com.br", "gruposkill.com.br",
        "emkt.zylumi.com", "danomoral.com.br", "ola.soustix.com.br",
        "gateway.cabparticipacoes.com.br",
        "reachcustomerdirect.com", "clube.wine.com.br",
        "email.connectmiles.com", "meuassai.com.br", "mail.nelogica.com.br",
        "viajarbarato.com.br", "mkt.amarantehoteis.com.br", "mv.com.br",
        "totvsassinatura.com.br", "ukblockbusterfilms.com", "mail.notion.so",
        "sovos.com", "mkt.outerletter.com.br", "impactamail.com.br",
        "lithiumminingproject.com", "ieptbpe1.emktlw-03.com", "polened.com",
        "empresas.ferreiracosta.com.br", "contato.clubefii.com.br",
        "viaflex10.com", "curadoria.fastshop.com.br",
        "marketing.meliuz.com.br", "figma.com", "sencon.com.br",
        "itau.com.br", "email.copa.com", "agrosummit.com.br",
        "info.wise.com", "boletimdo.com.br", "r.mercadopago.com.br",
        "viaverifica.com", "viaflex8.com", "viaflex7.com", "viaflex6.com",
        "viagerencia2.com", "neobrasil1.com", "e.drogasil.com.br",
        "voeazul-news.com.br", "br.didiglobal.com", "marketing.picpay.com",
        "mkt.viagens.zarpo.com.br", "info.totalpass.com.br",
        "mails.latam.com", "7zlo.quemaravilhososim.com.br",
        "email.samsclub.com.br", "global.fortinet.com",
        "multimodalnordeste.com.br", "kasolution.com.br", "info.laiob.com",
        "ndd.tech", "fiscal.io", "sankhya.com.br", "racebootcamp.com.br", "ibrcloud.com.br",
        "destaxa.com.br", "correspondenteone.com", "mkt.clubefii.com.br",
        "binds.co", "lmasouza.com.br", "emails.airalo.com",
        "supertroco.com.br", "mail.instagram.com",
        "bradescoseguroscontigo.com.br", "asisprojetos.com.br",
        "mktmail.visa.com", "mkt.mv.com.br", "em.linkedin.com",
        "outershoes.com.br", "telecom.dlfconsultoria.com", "umov.me",
        "newskmdevantagens.com.br", "marketingbancorci.com.br",
        "bradesco.com.br", "minhaband.com.br", "salesbud.com.br",
        "enews.united.com", "miro.com", "ecom.wine.com.br",
        "email5.singboxdaw.com", "trellobutler.com", "fi-group.com",
        "airbnb.com", "riobravo.com.br", "myconnectpe.com.br",
        "globalphoenix-news.com", "neloredesign.com", "ecrsolutions.com.br",
        "supabase.com", "newsolx.com.br", "brasil.santander.com.br",
        "comunica.ibmec.br", "selfitacademias.com.br",
        "consultordecreditos.com.br", "australiapreciousmetals.com",
        "negociosdrx.com", "smkt.hotmart.com",
        "comunicacao.serasaexperian.com.br", "activecs.com.br",
        "email.minhaclaro.com.br", "wikitec.com.br", "vivenciabosque.com",
        "tim.conectatim.com", "insider.promobit.com.br",
        "abecoi.com.br", "relacionamento.seara.com.br", "comunicacao-exame.com",
        "conteudo.agorainvestimentos.com", "traffordplazauk.com", "wgsn.com",
        "email.ferreiracosta.com", "oficial.nike.com.br", "everysys.com.br",
        "emkt.carolinaqueiroz.com",
        "legal.mercadolivre.com.br", "a.mercadolivre.com.br", "dio.me",
        "webpros.com", "sercorban.com", "infobradesco.com.br",
        "promolinks.com",
        "novidadeslojasrenner.com.br", "hyperbeyond.com", "solucx.com.br",
        "uraprods.com", "riocorban.com", "reachgccpeopledirect.com",
        "localiq.com", "academyalz.com", "congresidentes.com",
        "duogourmet.com.br", "wizard.com.br", "m.intvl.com.au",
        "news.iplace.com.br", "excrh.com.br", "primeira.app",
        "marketing.burgerking.com.br", "lupartners.com.br",
        "thanced.com", "trademarketme.com", "soluti.com.br", "objetivasolucao.com.br",
        "sensoarz.com", "reachpeopledirect.com", "duolingo.com",
        "boadigital.com.br", "userede.com.br",
        "skyone.solutions", "infoemail.microsoft.com",
    ]
    if domain in delete_exact:
        return "DELETAR"

    # Subdomínio-includes para DELETAR
    delete_includes = [
        "quemchegarprimeiro.com.br", "stanley1913.com.br", "basegeral",
        "resstinbwxiz", "speedentrega.com",
        "gestaofinanceira.de", "omalacaty.com", "acesso-documentos.com",
        "tripadvisor.com", "icarros.com.br", "coursera.org",
        "underarmour.com", "universalstudioshollywood.com", "udemymail.com",
        "consultoriavalentesinvest.com.br", "topsiterevista.com.br",
        "infomoney.com.br", "logisticanexar.com", "lenovo.com",
        "resolverax.com", "casasbahia.com.br", "casabrassp.com",
        "empresaecorp", "didiglobal.com", "garantidopravoce.com.br",
        "projetoapartamento.com", "pesquisaroutehsr.com.br",
        "grupolegale.com", "guiasimpl", "hces", "wesl-saf", "credit-segur",
    ]
    for pattern in delete_includes:
        if pattern in domain:
            return "DELETAR"

    return ""  # não classificado


def decode_header_value(raw) -> str:
    parts = email.header.decode_header(raw or "")
    result = []
    for part, enc in parts:
        if isinstance(part, bytes):
            charset = enc or "utf-8"
            if charset.lower() in ("unknown-8bit", "unknown"):
                charset = "latin-1"
            try:
                result.append(part.decode(charset, errors="replace"))
            except LookupError:
                result.append(part.decode("latin-1", errors="replace"))
        else:
            result.append(part)
    return "".join(result)


def ensure_folder(imap, imap_path: str):
    """Cria a pasta se nao existir — sem alterar a mailbox selecionada."""
    try:
        imap.create(imap_path)
        imap.subscribe(imap_path)
    except Exception:
        pass  # pasta ja existe — ignorar


def move_email(imap, uid: bytes, imap_path: str) -> tuple[bool, str]:
    """Move email via UID COPY + UID STORE. Retorna (ok, erro)."""
    result = imap.uid("COPY", uid, imap_path)
    if result[0] == "OK":
        imap.uid("STORE", uid, "+FLAGS", r"(\Deleted)")
        return True, ""
    return False, str(result[1])


def process_account(webmail_user: str, webmail_pass: str, summary_to: str, account_name: str) -> tuple[str, bool]:
    """Processa uma conta de email. Retorna (body, smtp_ok)"""
    # Determinar servidores IMAP / SMTP
    domain = webmail_user.split("@")[1]
    imap_servers = [
        ("mail." + domain, 993),
        (domain, 993),
        ("webmail." + domain, 993),
        ("imap." + domain, 993),
    ]
    smtp_servers = [
        ("mail." + domain, 587),
        (domain, 587),
        ("smtp." + domain, 587),
        ("mail." + domain, 465),
    ]

    # ── Conectar IMAP ─────────────────────────────────────────────────────
    imap = None
    connected_imap = None
    for host, port in imap_servers:
        try:
            print(f"\n[{account_name}] Tentando IMAP {host}:{port}…")
            m = imaplib.IMAP4_SSL(host, port, timeout=60)
            m.login(webmail_user, webmail_pass)
            imap = m
            connected_imap = (host, port)
            print(f"[{account_name}] IMAP conectado: {host}:{port}")
            break
        except Exception as e:
            print(f"  Falhou: {e}")

    if imap is None:
        print(f"[{account_name}] ERRO: Não foi possível conectar ao IMAP.")
        return "", False

    # ── Selecionar INBOX ──────────────────────────────────────────────────
    imap.select("INBOX")

    # Buscar todos os emails não deletados
    status, data = imap.uid("SEARCH", None, "NOT DELETED")
    if status != "OK" or not data[0]:
        print(f"[{account_name}] Nenhum email encontrado na caixa de entrada.")
        uids = []
    else:
        uids = data[0].split()

    print(f"[{account_name}] Emails na INBOX: {len(uids)}")

    # Estatísticas
    moved: dict[str, list[str]] = {}  # pasta → [descrições]
    deleted: list[str] = []
    unclassified: list[tuple[str, str]] = []  # (remetente, assunto)
    errors: list[str] = []

    for uid in uids:
        try:
            res, msg_data = imap.uid("FETCH", uid, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT)])")
            if res != "OK":
                continue
            raw = msg_data[0][1] if msg_data and msg_data[0] else b""
            msg = email.message_from_bytes(raw)
            sender  = decode_header_value(msg.get("From", ""))
            subject = decode_header_value(msg.get("Subject", "(sem assunto)"))

            folder = classify(sender)
            safe_sender = sender[:60].encode("ascii", "replace").decode()
            print(f"  [{uid.decode()}] {safe_sender} -> {folder or 'NAO CLASSIFICADO'}")

            if folder:
                imap_path = FOLDER_MAP.get(folder, f"INBOX.{folder}")
                ensure_folder(imap, imap_path)
                ok, err = move_email(imap, uid, imap_path)
                if ok:
                    if folder == "DELETAR":
                        deleted.append(f"{sender[:60]} - {subject[:60]}")
                    else:
                        moved.setdefault(folder, []).append(f"{sender[:60]} - {subject[:60]}")
                else:
                    errors.append(f"Falha ao mover UID {uid.decode()} para {imap_path}: {err[:80]}")
            else:
                unclassified.append((sender[:80], subject[:80]))

        except Exception as e:
            errors.append(f"Erro no UID {uid.decode()}: {e}")

    # Expunge para realmente deletar (precisa de INBOX selecionado)
    try:
        imap.select("INBOX")
        imap.expunge()
    except Exception as e:
        errors.append(f"Aviso: expunge falhou ({e}) — emails marcados como deletados serao removidos na proxima sessao.")
    try:
        imap.logout()
    except Exception:
        pass

    # ── Montar resumo ─────────────────────────────────────────────────────
    total = len(uids)
    total_moved = sum(len(v) for v in moved.values())
    total_deleted = len(deleted)
    total_unclass = len(unclassified)

    lines = []
    lines.append(f"[{account_name}] Execucao: {DATE_STR} - Turno: {TURNO}")
    lines.append(f"Servidor IMAP usado: {connected_imap[0]}:{connected_imap[1]}")
    lines.append("")
    lines.append(f"Total de emails processados: {total}")
    lines.append(f"  Movidos para pastas: {total_moved}")
    lines.append(f"  Deletados:           {total_deleted}")
    lines.append(f"  Nao classificados:   {total_unclass}")
    lines.append("")

    if moved:
        lines.append("-- Movidos por pasta ----------------------------------------")
        for pasta, items in sorted(moved.items()):
            lines.append(f"\n[{pasta}] ({len(items)} email(s))")
            for it in items:
                lines.append(f"  * {it}")

    if deleted:
        lines.append("")
        lines.append(f"-- Deletados ({len(deleted)}) -------------------------------------------")
        for it in deleted[:30]:
            lines.append(f"  * {it}")
        if len(deleted) > 30:
            lines.append(f"  ... e mais {len(deleted)-30} emails deletados.")

    if unclassified:
        lines.append("")
        lines.append("-- Nao classificados (requerem atencao manual) --------------")
        for sender, subj in unclassified:
            lines.append(f"  * De: {sender}")
            lines.append(f"    Assunto: {subj}")

    if errors:
        lines.append("")
        lines.append("-- Erros / situacoes que precisam atencao -------------------")
        for e in errors:
            lines.append(f"  ! {e}")

    # ── Revisão do processo ───────────────────────────────────────────────
    lines.append("")
    lines.append("=" * 60)
    lines.append("REVISAO DO PROCESSO")
    lines.append("=" * 60)
    lines.append("")
    lines.append("1 - O que funcionou?")
    if moved:
        for pasta in sorted(moved.keys()):
            lines.append(f"  OK Pasta '{pasta}': {len(moved[pasta])} email(s) recebidos e movidos corretamente.")
    else:
        lines.append("  - Nenhum email movido nesta execucao.")
    lines.append("  OK: Regras de subdominio (includes) aplicadas conforme CLAUDE.md.")
    lines.append("")
    lines.append("2 - O que ficou fraco?")
    if unclassified:
        lines.append(f"  - {len(unclassified)} email(s) nao classificado(s) - verificar se pertencem a algum grupo.")
        for s, _ in unclassified:
            lines.append(f"    * {s}")
    else:
        lines.append("  - Nenhum problema identificado nesta execucao.")
    lines.append("")
    lines.append("3 - O que adicionar para melhorar?")
    if unclassified:
        lines.append("  Dominios sem regra encontrados (sugestoes):")
        seen_domains = set()
        for sender, _ in unclassified:
            addr = sender
            if "<" in addr and ">" in addr:
                addr = addr[addr.index("<")+1:addr.index(">")]
            addr = addr.strip().lower()
            dom = addr.split("@")[-1] if "@" in addr else addr
            if dom and dom not in seen_domains:
                seen_domains.add(dom)
                lines.append(f"  * @{dom} -> pasta sugerida: ?")
    else:
        lines.append("  - Nenhum dominio novo identificado nesta execucao.")

    body = "\n".join(lines)
    print(("\n" + body).encode("ascii", "replace").decode())

    # ── Enviar resumo por email ───────────────────────────────────────────
    subject_email = f"[LM Treina] Resumo de emails — {DATE_STR} {TURNO} — {account_name}"

    msg_out = MIMEMultipart("alternative")
    msg_out["Subject"] = subject_email
    msg_out["From"]    = webmail_user
    msg_out["To"]      = summary_to
    msg_out.attach(MIMEText(body, "plain", "utf-8"))

    smtp_ok = False
    for smtp_host, smtp_port in smtp_servers:
        try:
            print(f"\n[{account_name}] Tentando SMTP {smtp_host}:{smtp_port}…")
            if smtp_port == 465:
                srv = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            else:
                srv = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                srv.ehlo()
                srv.starttls()
                srv.ehlo()
            srv.login(webmail_user, webmail_pass)
            srv.sendmail(webmail_user, [summary_to], msg_out.as_string())
            srv.quit()
            print(f"[{account_name}] Resumo enviado para {summary_to} via {smtp_host}:{smtp_port}")
            smtp_ok = True
            break
        except Exception as e:
            print(f"  SMTP falhou: {e}")

    if not smtp_ok:
        print(f"[{account_name}] AVISO: Nao foi possivel enviar o email de resumo.")

    return body, smtp_ok


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    print("=" * 70)
    print("AGENTE DE EMAIL LM TREINA — Múltiplas contas")
    print("=" * 70)

    # Contas a processar
    accounts = [
        ("WEBMAIL_USER", "WEBMAIL_PASS", "bruno@solucoesb4.com.br", "Bruno LM Treina"),
        ("WEBMAIL_USER_2", "WEBMAIL_PASS_2", "bruno@solucoesb4.com.br", "Bruno B4 Soluções"),
    ]

    all_reports = []
    for user_key, pass_key, summary_to, account_name in accounts:
        if user_key in ENV and pass_key in ENV:
            webmail_user = ENV[user_key]
            webmail_pass = ENV[pass_key]
            print(f"\n\n{'='*70}")
            print(f"Processando: {account_name} ({webmail_user})")
            print(f"{'='*70}")
            body, smtp_ok = process_account(webmail_user, webmail_pass, summary_to, account_name)
            all_reports.append((account_name, body, smtp_ok))
        else:
            print(f"\n[ERRO] Credenciais não encontradas para {account_name} ({user_key}, {pass_key})")

    print("\n\n" + "=" * 70)
    print("RESUMO GERAL DA EXECUCAO")
    print("=" * 70)
    for account_name, body, smtp_ok in all_reports:
        status = "[OK] ENVIADO" if smtp_ok else "[ERRO] NAO ENVIADO"
        print(f"\n{account_name}: {status}")

    print("\nExecucao concluida.")


if __name__ == "__main__":
    main()
