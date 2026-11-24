#!/bin/sh
# Quintal do Carmo - Escala 5x2 (homologação). Sobe em http://localhost:8787
cd "$(dirname "$0")"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)            BIN=bin/quintal-escalas-mac ;;
  Darwin-*)                BIN=bin/quintal-escalas-mac-intel ;;
  Linux-aarch64|Linux-arm64) BIN=bin/quintal-escalas-linux-arm64 ;;
  *)                       BIN=bin/quintal-escalas-linux ;;
esac
xattr -d com.apple.quarantine "$BIN" 2>/dev/null || true
chmod +x "$BIN"
echo "Abra http://localhost:8787 no navegador (Ctrl+C para parar)"
( sleep 2; (xdg-open http://localhost:8787 || open http://localhost:8787) >/dev/null 2>&1 ) &
exec "$BIN" -porta 8787 -dados dados.json
