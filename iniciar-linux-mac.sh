#!/bin/sh
# Quintal do Carmo - Escala 5x2 (homologação). Sobe em http://localhost:8787
cd "$(dirname "$0")"
case "$(uname -s)" in
  Darwin) BIN=bin/quintal-escalas-mac; xattr -d com.apple.quarantine "$BIN" 2>/dev/null ;;
  *)      BIN=bin/quintal-escalas-linux ;;
esac
chmod +x "$BIN"
echo "Abra http://localhost:8787 (Ctrl+C para parar)"
exec "$BIN" -porta 8787 -dados dados.json
