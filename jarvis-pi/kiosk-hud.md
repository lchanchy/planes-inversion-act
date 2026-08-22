# HUD en la pantalla 3.5" (Chromium en modo kiosco)

Pantalla GeeekPi 3.5": HDMI para video + USB para el táctil.

En Raspberry Pi OS Lite no hay escritorio, así que hace falta un servidor
gráfico mínimo. La vía más liviana es `cage` (compositor Wayland de una sola
ventana), que evita instalar un entorno de escritorio completo:

```bash
sudo apt install -y cage chromium-browser
```

Servicio de usuario:

```ini
# ~/.config/systemd/user/jarvis-hud.service
[Unit]
Description=Jarvis HUD (Chromium kiosco)
After=jarvis-gateway.service

[Service]
Type=simple
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=/usr/bin/cage -- /usr/bin/chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --check-for-update-interval=31536000 \
  --window-size=480,320 \
  file:///home/libardo/jarvis-hud/index.html
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload
systemctl --user enable --now jarvis-hud
```

## Detalles que muerden

- **Resolución.** La 3.5" por HDMI suele necesitar modo forzado en
  `/boot/firmware/config.txt` (`hdmi_group`/`hdmi_mode` o `video=` según el
  panel). Si arranca en negro o desbordado, es esto, no Chromium.
- **Rotación del táctil.** El panel y el digitalizador se rotan por separado.
  Si el toque queda invertido respecto a la imagen, hay que rotar también la
  matriz de entrada, no solo el video.
- **Apagado de pantalla.** Sin gestor de sesión no hay salvapantallas, lo cual
  para un HUD 24/7 es lo que se quiere. Si el panel se apaga igual, es DPMS del
  kernel.
- **Datos del HUD.** El HUD del PC ya expone 8765/8790. Para que la Pi los
  consuma, esos puertos deben escuchar en la LAN y no solo en localhost —
  mismo problema que Ollama con 11434.
