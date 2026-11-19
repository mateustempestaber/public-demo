#!/bin/sh
# Instala o demo do Quintal do Carmo num servidor Linux (Ubuntu) e deixa rodando na porta 8787.
# Uso (no servidor):  curl -fsSL https://raw.githubusercontent.com/mateustempestaber/public-demo/homologacao/servidor/instalar.sh | sudo sh
set -e
PORTA=8787
BASE=https://raw.githubusercontent.com/mateustempestaber/public-demo/homologacao/bin
case "$(uname -m)" in
  aarch64|arm64) BIN=quintal-escalas-linux-arm64 ;;
  *)             BIN=quintal-escalas-linux ;;
esac

echo ">> Baixando o programa ($BIN)..."
mkdir -p /opt/quintal
curl -fsSL "$BASE/$BIN" -o /opt/quintal/quintal-escalas
chmod +x /opt/quintal/quintal-escalas
id quintal >/dev/null 2>&1 || useradd --system --home /opt/quintal --shell /usr/sbin/nologin quintal
chown -R quintal:quintal /opt/quintal

echo ">> Criando o serviço (liga sozinho quando o servidor reinicia)..."
cat > /etc/systemd/system/quintal.service <<UNIT
[Unit]
Description=Quintal do Carmo - demo de homologacao
After=network-online.target

[Service]
User=quintal
WorkingDirectory=/opt/quintal
ExecStart=/opt/quintal/quintal-escalas -porta $PORTA -dados /opt/quintal/dados.json
Restart=always
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/quintal
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now quintal

echo ">> Liberando a porta $PORTA no firewall do servidor..."
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q active; then ufw allow $PORTA/tcp; fi
if command -v iptables >/dev/null 2>&1; then
  iptables -C INPUT -p tcp --dport $PORTA -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport $PORTA -j ACCEPT
  command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save || true
fi

sleep 2
systemctl --no-pager --lines=3 status quintal || true
IP=$(curl -fsS https://api.ipify.org 2>/dev/null || echo SEU-IP)
echo ""
echo "Pronto. Abra: http://$IP:$PORTA"
echo "Se não abrir, libere a porta $PORTA também no painel da nuvem (regras de entrada / Security List)."
