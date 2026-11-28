#!/usr/bin/env python3
"""
Servidor Autónomo para GPS Náutico PWA + Cloudflare Tunnel HTTPS
Garante acesso seguro e direto do telemóvel para instalação PWA permanente offline.
"""

import os
import re
import sys
import time
import subprocess
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import qrcode

DIR_WEB = Path(__file__).resolve().parent
PORTA = 8099
LOG_TUNNEL = Path("/tmp/cf_tunnel_gps.log")
FICHEIRO_LINK = Path("/home/luis/Secretária/LINK_GPS.txt")
FICHEIRO_QR = Path("/home/luis/Secretária/QRCODE_GPS.png")

class ManipuladorGPS(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR_WEB), **kwargs)

    def end_headers(self):
        # Cabeçalhos essenciais para Service Worker e PWA sem cache bloqueadora
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

def iniciar_servidor_http():
    os.chdir(DIR_WEB)
    servidor = HTTPServer(("0.0.0.0", PORTA), ManipuladorGPS)
    print(f"[*] Servidor local ativo em http://0.0.0.0:{PORTA}")
    servidor.serve_forever()

def iniciar_tunnel():
    caminho_cf = Path("/home/luis/.local/bin/cloudflared")
    if not caminho_cf.is_file():
        print("[ERRO] cloudflared não encontrado em ~/.local/bin/cloudflared")
        return None

    if LOG_TUNNEL.exists():
        LOG_TUNNEL.unlink()

    proc = subprocess.Popen(
        [str(caminho_cf), "tunnel", "--url", f"http://127.0.0.1:{PORTA}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    url_https = None
    padrao = re.compile(r"https://[-a-zA-Z0-9.]+\.trycloudflare\.com")

    with open(LOG_TUNNEL, "w") as f_log:
        for linha in proc.stdout:
            f_log.write(linha)
            f_log.flush()
            match = padrao.search(linha)
            if match and not url_https:
                url_https = match.group(0)
                print(f"\n=======================================================")
                print(f"🚀 GPS NÁUTICO INDEPENDENTE PRONTO COM HTTPS SEGURO:")
                print(f"👉 {url_https}")
                print(f"=======================================================\n")
                
                # Gerar ficheiro de texto no Ambiente de Trabalho
                FICHEIRO_LINK.write_text(
                    f"GPS NÁUTICO INDEPENDENTE\n\n"
                    f"Abre este link no telemóvel:\n{url_https}\n\n"
                    f"Depois clica em 'Instalar Aplicação' ou 'Adicionar ao Ecrã Principal'.\n"
                    f"A partir daí fica 100% gravado no telemóvel e funciona no mar sem Wi-Fi e sem PC.\n",
                    encoding="utf-8"
                )

                # Gerar imagem do QR Code
                qr = qrcode.QRCode(box_size=10, border=2)
                qr.add_data(url_https)
                qr.make(fit=True)
                img = qr.make_image(fill_color="black", back_color="white")
                img.save(str(FICHEIRO_QR))
                img.save(str(DIR_WEB / "static" / "qrcode_publico.png"))
                print(f"[OK] QR Code gerado em: {FICHEIRO_QR}")
                print(f"[OK] Link guardado em: {FICHEIRO_LINK}")
                print("\n📱 CÓDIGO QR PARA APONTAR A CÂMARA DO TELEMÓVEL:")
                qr.print_ascii(invert=True)

    proc.wait()
    return proc

if __name__ == "__main__":
    t = threading.Thread(target=iniciar_servidor_http, daemon=True)
    t.start()
    time.sleep(1)
    iniciar_tunnel()
