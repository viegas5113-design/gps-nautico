#!/bin/bash
pkill -f "http.server 8099" 2>/dev/null
pkill -f "cloudflared tunnel.*8099" 2>/dev/null

cd /home/luis/Vigilante_GPS_Web
nohup python3 -m http.server 8099 --directory /home/luis/Vigilante_GPS_Web > /tmp/http_8099.log 2>&1 &
HTTP_PID=$!

nohup /home/luis/.local/bin/cloudflared tunnel --url http://127.0.0.1:8099 > /tmp/cf_tunnel.log 2>&1 &
CF_PID=$!

URL=""
for i in {1..30}; do
    URL=$(grep -o 'https://[-a-zA-Z0-9.]*\.trycloudflare\.com' /tmp/cf_tunnel.log | head -n 1)
    if [ -n "$URL" ]; then
        break
    fi
    sleep 0.5
done

if [ -n "$URL" ]; then
    cat << EOF > /home/luis/Secretária/LINK_GPS.txt
GPS NÁUTICO INDEPENDENTE

1. No telemóvel, abre este link no navegador (Chrome / Safari):
$URL

2. O telemóvel vai pedir permissão para aceder à Localização (GPS): clica em "Permitir".

3. Clica no menu do navegador (três pontinhos ou botão partilhar) e escolhe:
   "Instalar Aplicação" ou "Adicionar ao Ecrã Principal".

4. As 54 Bolinhas Esferas e todo o mapa batimétrico ficam guardados no telemóvel!
   Podes desligar o Wi-Fi de casa e o computador. No mar funciona 100% sozinho!
EOF

    /home/luis/.venv/bin/python -c "
import qrcode
url = '$URL'
qr = qrcode.QRCode(box_size=10, border=2)
qr.add_data(url)
qr.make(fit=True)
img = qr.make_image(fill_color='black', back_color='white')
img.save('/home/luis/Secretária/QRCODE_GPS.png')
img.save('/home/luis/Vigilante_GPS_Web/static/qrcode_publico.png')
print('=== URL OBTIDO COM SUCESSO ===')
print(url)
"
    echo "Sucesso: $URL"
else
    echo "Falha ao obter URL Cloudflare"
    cat /tmp/cf_tunnel.log
fi
