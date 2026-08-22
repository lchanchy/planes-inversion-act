# Jarvis en Raspberry Pi 5 — Hermes Gateway

Puente 24/7: la Pi corre el **Hermes Gateway** (Telegram), y el LLM vive en el PC
(Ollama, `hermes3-fast:latest`).

```
Telegram ──► Pi (jarvis-pi, 192.168.1.11) ──HTTP LAN──► PC (192.168.1.5:11434, Ollama)
                     │
                     └─► HUD local en pantalla 3.5" (Chromium kiosco)
```

## Diagnóstico: por qué decía "No messaging platforms enabled"

Tres causas, y las tres estaban activas a la vez:

1. **Ruta de configuración equivocada.** Hermes **no** lee `~/.config/hermes/config.yaml`.
   Lee `~/.hermes/config.yaml` y `~/.hermes/gateway-config.yaml`. Todo lo escrito en
   `~/.config/hermes/` fue ignorado en silencio — de ahí que el gateway arrancara
   sin ninguna plataforma.
2. **Esquema YAML equivocado.** Las plataformas van anidadas bajo `gateway.platforms.<nombre>`,
   no en un `platforms:` de primer nivel ni en un `telegram:` suelto. Cada plataforma
   arranca **deshabilitada** y necesita `enabled: true` explícito.
3. **`HERMES_GATEWAY_PLATFORMS` no existe.** No es una variable que Hermes lea; no tiene
   efecto. Las variables que sí se leen son `TELEGRAM_BOT_TOKEN`,
   `TELEGRAM_ALLOWED_USERS`, `TELEGRAM_GROUP_ALLOWED_USERS`, `TELEGRAM_GROUP_ALLOWED_CHATS`.

Sobre el siguiente paso que tenías planeado, `hermes --config ~/.config/hermes/config.yaml gateway`:
no lo intentes. Ese flag no está documentado en el CLI, y aunque existiera seguirías
apuntando al archivo con el esquema malo. La ruta correcta es arreglar el archivo en
`~/.hermes/`.

## Arreglo

Opción A — asistente interactivo (lo más rápido, y valida el token contra Telegram):

```bash
source ~/hermes-env/bin/activate
hermes gateway setup      # selección con flechas; ofrece arrancar el gateway al final
```

Opción B — manual, con los archivos de este directorio:

```bash
scp jarvis-pi/setup-hermes-gateway.sh libardo@192.168.1.11:~/
ssh libardo@192.168.1.11 'bash ~/setup-hermes-gateway.sh'
```

El script te pide el token por stdin (no queda en el historial del shell), escribe
`~/.hermes/gateway-config.yaml` con el esquema correcto, deja el token en
`~/.hermes/gateway.env` con permisos `600`, e instala el servicio systemd.

Verificación:

```bash
systemctl --user status jarvis-gateway
journalctl --user -u jarvis-gateway -f
```

En los logs debe aparecer el adaptador de Telegram haciendo *polling*. Si sigue
diciendo "No messaging platforms enabled", el archivo que Hermes está leyendo no es
el que editaste — confirma con `ls -la ~/.hermes/`.

## Seguridad del token

El token del bot que estaba en las notas del proyecto quedó expuesto en texto plano
en un chat. **Revócalo con `/revoke` en @BotFather y usa el nuevo.** Cualquiera con
ese token puede leer y escribir por tu bot.

Ningún token, ni el Chat ID, se versiona en este repo. `gateway.env` vive solo en la Pi.

## Orden de trabajo pendiente

1. **Telegram en el gateway** — este documento. Bloquea todo lo demás.
2. **Audio Bluetooth (barra OOYY)** — ver `bluetooth-ooyy.md`.
3. **HUD en la pantalla 3.5"** — ver `kiosk-hud.md`.
4. **Pipeline de voz local** (wake word + STT + TTS) — depende de (1) y (2).
