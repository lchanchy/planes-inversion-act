#!/usr/bin/env bash
# Configura el Hermes Gateway (Telegram) en la Raspberry Pi 5.
# Ejecutar en la Pi como el usuario 'libardo', NO con sudo.
#
#   bash setup-hermes-gateway.sh
#
# Idempotente: se puede volver a correr para cambiar token o chat id.
set -euo pipefail

HERMES_DIR="$HOME/.hermes"
VENV="$HOME/hermes-env"
ENV_FILE="$HERMES_DIR/gateway.env"
GATEWAY_CFG="$HERMES_DIR/gateway-config.yaml"
UNIT_DIR="$HOME/.config/systemd/user"
UNIT="$UNIT_DIR/jarvis-gateway.service"

# Valores por defecto del PC con Ollama; se pueden sobrescribir por entorno.
OLLAMA_HOST_IP="${OLLAMA_HOST_IP:-192.168.1.5}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
OLLAMA_MODEL="${OLLAMA_MODEL:-hermes3-fast:latest}"

die() { echo "error: $*" >&2; exit 1; }

[[ -d "$VENV" ]] || die "no existe el venv en $VENV"

# Hermes lee ~/.hermes, nunca ~/.config/hermes. Avisar si quedó basura vieja.
if [[ -e "$HOME/.config/hermes" ]]; then
  echo "aviso: $HOME/.config/hermes existe pero Hermes NO lo lee." >&2
  echo "       Es la causa de 'No messaging platforms enabled'. Borralo cuando" >&2
  echo "       confirmes que el gateway funciona con la config de ~/.hermes." >&2
fi

mkdir -p "$HERMES_DIR" "$UNIT_DIR"

# --- Token ---------------------------------------------------------------
# Se pide por stdin para que no quede en ~/.bash_history ni en la lista de
# procesos. Si ya hay uno guardado, se puede conservar con Enter.
existing_token=""
if [[ -f "$ENV_FILE" ]]; then
  existing_token="$(sed -n 's/^TELEGRAM_BOT_TOKEN=//p' "$ENV_FILE" | head -1)"
fi

if [[ -n "$existing_token" ]]; then
  read -rsp "Token del bot [Enter conserva el actual]: " TOKEN; echo
  TOKEN="${TOKEN:-$existing_token}"
else
  read -rsp "Token del bot de Telegram (de @BotFather): " TOKEN; echo
fi
[[ -n "$TOKEN" ]] || die "token vacío"
[[ "$TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]] || die "el token no tiene el formato <digitos>:<clave>"

# --- Chat ID -------------------------------------------------------------
existing_chat=""
if [[ -f "$GATEWAY_CFG" ]]; then
  existing_chat="$(sed -n 's/.*home_chat_id: *"\{0,1\}\([0-9-]*\)"\{0,1\}.*/\1/p' "$GATEWAY_CFG" | head -1)"
fi
read -rp "Chat ID autorizado${existing_chat:+ [$existing_chat]}: " CHAT_ID
CHAT_ID="${CHAT_ID:-$existing_chat}"
[[ "$CHAT_ID" =~ ^-?[0-9]+$ ]] || die "el chat id debe ser numérico"

# --- Validar el token contra Telegram antes de escribir nada -------------
echo "Verificando el token contra la API de Telegram..."
if command -v curl >/dev/null 2>&1; then
  resp="$(curl -sS --max-time 15 "https://api.telegram.org/bot${TOKEN}/getMe" || true)"
  if [[ "$resp" == *'"ok":true'* ]]; then
    echo "  ok: $(printf '%s' "$resp" | sed -n 's/.*"username":"\([^"]*\)".*/@\1/p')"
  elif [[ "$resp" == *'"ok":false'* ]]; then
    die "Telegram rechazó el token. ¿Lo revocaste en @BotFather? Generá uno nuevo."
  else
    echo "  aviso: no se pudo verificar (¿sin internet?). Sigo igual."
  fi
fi

# --- gateway.env ---------------------------------------------------------
umask 077
cat > "$ENV_FILE" <<EOF
# Secretos del gateway. NO versionar. Cargado por systemd (EnvironmentFile).
TELEGRAM_BOT_TOKEN=$TOKEN
TELEGRAM_ALLOWED_USERS=$CHAT_ID
EOF
chmod 600 "$ENV_FILE"

# --- gateway-config.yaml -------------------------------------------------
# Las plataformas van bajo gateway.platforms.<nombre> y arrancan deshabilitadas.
cat > "$GATEWAY_CFG" <<EOF
gateway:
  platforms:
    telegram:
      enabled: true
      home_chat_id: "$CHAT_ID"
      gateway_restart_notification: true
      typing_indicator: true
      extra:
        allow_from:
          - "$CHAT_ID"
EOF
chmod 600 "$GATEWAY_CFG"

# --- config.yaml (backend del modelo) ------------------------------------
# Solo se crea si no existe, para no pisar ajustes hechos a mano.
if [[ ! -f "$HERMES_DIR/config.yaml" ]]; then
  cat > "$HERMES_DIR/config.yaml" <<EOF
model:
  default: $OLLAMA_MODEL
  provider: custom
  base_url: http://${OLLAMA_HOST_IP}:${OLLAMA_PORT}/v1
  context_length: 64000
EOF
  echo "Creado $HERMES_DIR/config.yaml apuntando a ${OLLAMA_HOST_IP}:${OLLAMA_PORT}"
else
  echo "Conservo el $HERMES_DIR/config.yaml existente."
fi

# --- Comprobar que el Ollama del PC responde -----------------------------
if command -v curl >/dev/null 2>&1; then
  if curl -sS --max-time 5 "http://${OLLAMA_HOST_IP}:${OLLAMA_PORT}/api/tags" >/dev/null 2>&1; then
    echo "Ollama del PC alcanzable en ${OLLAMA_HOST_IP}:${OLLAMA_PORT}."
  else
    echo "aviso: no respondió Ollama en ${OLLAMA_HOST_IP}:${OLLAMA_PORT}." >&2
    echo "       El gateway va a arrancar igual, pero el bot no podrá responder." >&2
    echo "       En el PC: OLLAMA_HOST=0.0.0.0:11434 y abrir el puerto en el firewall." >&2
  fi
fi

# --- systemd (user) ------------------------------------------------------
install -m 644 /dev/stdin "$UNIT" <<EOF
[Unit]
Description=Jarvis - Hermes Gateway (Telegram)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=$ENV_FILE
ExecStart=$VENV/bin/hermes gateway
Restart=always
RestartSec=10
WorkingDirectory=$HOME

[Install]
WantedBy=default.target
EOF

# Sin lingering, los servicios de usuario mueren al cerrar la sesión SSH y no
# arrancan en el boot. En un puente 24/7 esto es obligatorio.
if ! loginctl show-user "$USER" -p Linger --value 2>/dev/null | grep -qi yes; then
  echo "Habilitando linger (pide sudo una vez, para que el servicio sobreviva al logout)..."
  sudo loginctl enable-linger "$USER"
fi

systemctl --user daemon-reload
systemctl --user enable --now jarvis-gateway
sleep 3
systemctl --user --no-pager status jarvis-gateway || true

cat <<'EOF'

Listo. Para seguir los logs:
    journalctl --user -u jarvis-gateway -f

En los logs debe verse el adaptador de Telegram haciendo polling. Si aparece
"No messaging platforms enabled", el archivo leído no es el que se escribió:
revisá  ls -la ~/.hermes/
EOF
