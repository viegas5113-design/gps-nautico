#!/usr/bin/env python3
"""
Servidor Autónomo para GPS Náutico PWA + Cloudflare Tunnel HTTPS
Garante acesso seguro e direto do telemóvel para instalação PWA permanente offline.
"""

import os
import re
import sys
import json
import time
import subprocess
import threading
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import qrcode

DIR_WEB = Path(__file__).resolve().parent
PORTA = 8099
LOG_TUNNEL = Path("/tmp/cf_tunnel_gps.log")
FICHEIRO_LINK = Path("/home/luis/Secretária/LINK_GPS.txt")
FICHEIRO_QR = Path("/home/luis/Secretária/QRCODE_GPS.png")
FICHEIRO_MARCAS = DIR_WEB / "dados" / "marcas_sincronizadas.json"
LOCK_MARCAS = threading.Lock()


def ler_marcas_sincronizadas():
    FICHEIRO_MARCAS.parent.mkdir(parents=True, exist_ok=True)
    if not FICHEIRO_MARCAS.is_file():
        return {"ultima_atualizacao": None, "marcas": []}
    try:
        dados = json.loads(FICHEIRO_MARCAS.read_text(encoding="utf-8"))
        if isinstance(dados, dict) and isinstance(dados.get("marcas"), list):
            return {
                "ultima_atualizacao": dados.get("ultima_atualizacao"),
                "marcas": dados["marcas"],
            }
    except Exception:
        pass
    return {"ultima_atualizacao": None, "marcas": []}


def gravar_marcas_sincronizadas(marcas):
    FICHEIRO_MARCAS.parent.mkdir(parents=True, exist_ok=True)
    agora = datetime.now().isoformat(timespec="seconds")
    conteudo = {
        "ultima_atualizacao": agora,
        "marcas": marcas,
    }
    tmp = FICHEIRO_MARCAS.with_suffix(".tmp")
    tmp.write_text(json.dumps(conteudo, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(FICHEIRO_MARCAS)
    return conteudo


class ManipuladorGPS(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIR_WEB), **kwargs)

    def end_headers(self):
        # Cabeçalhos essenciais para Service Worker, PWA e CORS na rede local
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def _enviar_json(self, status, payload):
        corpo = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        caminho = self.path.split("?", 1)[0]
        if caminho == "/api/marcas":
            with LOCK_MARCAS:
                dados = ler_marcas_sincronizadas()
            self._enviar_json(200, {
                "ok": True,
                "ultima_atualizacao": dados.get("ultima_atualizacao"),
                "total": len(dados.get("marcas", [])),
                "marcas": dados.get("marcas", []),
            })
            return
        super().do_GET()

    def do_POST(self):
        caminho = self.path.split("?", 1)[0]
        if caminho != "/api/marcas":
            self._enviar_json(404, {"ok": False, "erro": "Rota não encontrada"})
            return

        try:
            tamanho = int(self.headers.get("Content-Length", "0"))
            bruto = self.rfile.read(tamanho) if tamanho > 0 else b"{}"
            payload = json.loads(bruto.decode("utf-8"))
        except Exception as exc:
            self._enviar_json(400, {"ok": False, "erro": f"JSON inválido: {exc}"})
            return

        recebidas = payload.get("marcas", []) if isinstance(payload, dict) else payload
        if not isinstance(recebidas, list):
            self._enviar_json(400, {"ok": False, "erro": "Campo 'marcas' deve ser uma lista"})
            return

        with LOCK_MARCAS:
            atual = ler_marcas_sincronizadas()
            existentes = list(atual.get("marcas", []))
            indice_por_id = {}
            for idx, item in enumerate(existentes):
                if isinstance(item, dict) and item.get("id") is not None:
                    indice_por_id[str(item["id"])] = idx

            for item in recebidas:
                if not isinstance(item, dict):
                    continue
                item_id = item.get("id")
                if item_id is not None and str(item_id) in indice_por_id:
                    existentes[indice_por_id[str(item_id)]] = item
                else:
                    if item_id is not None:
                        indice_por_id[str(item_id)] = len(existentes)
                    existentes.append(item)

            guardado = gravar_marcas_sincronizadas(existentes)

        self._enviar_json(200, {
            "ok": True,
            "ultima_atualizacao": guardado["ultima_atualizacao"],
            "total": len(guardado["marcas"]),
            "recebidas": len(recebidas),
        })

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
