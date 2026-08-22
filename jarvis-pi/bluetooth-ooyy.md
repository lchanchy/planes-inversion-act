# Barra OOYY — perfil de audio fallido

Síntoma: la barra se empareja, pero al conectar el perfil A2DP falla y el
dispositivo queda sin sink de audio.

En Raspberry Pi OS **Lite** la causa casi siempre es la misma: no hay sesión
gráfica, y PipeWire/PulseAudio corre como servicio de usuario que muere al
cerrar SSH. Sin él, BlueZ no tiene a quién entregarle el perfil A2DP y se queda
solo con HSP/HFP (o con nada).

## Orden de revisión

```bash
# 1. ¿Está el stack de audio y el puente de Bluetooth instalado?
sudo apt install -y pipewire pipewire-pulse wireplumber libspa-0.2-bluetooth
#    libspa-0.2-bluetooth es el que aporta A2DP. Sin él el perfil no existe
#    y el emparejamiento "funciona" pero nunca hay sink.

# 2. Que los servicios de usuario sobrevivan al logout (igual que el gateway).
sudo loginctl enable-linger "$USER"
systemctl --user enable --now pipewire pipewire-pulse wireplumber

# 3. Emparejar de nuevo, ya con el stack arriba.
bluetoothctl
  power on
  agent on
  default-agent
  scan on
  # esperar a que aparezca la MAC de la barra
  pair    AA:BB:CC:DD:EE:FF
  trust   AA:BB:CC:DD:EE:FF
  connect AA:BB:CC:DD:EE:FF
  scan off
  quit

# 4. Confirmar que quedó un sink A2DP y no HSP.
wpctl status
pactl list sinks short
```

`trust` es el paso que suele faltar: sin él la barra no se reconecta sola
después de un reinicio de la Pi, que es justo lo que se necesita en un
puente 24/7.

Si `wpctl status` muestra el dispositivo con perfil `headset-head-unit` en vez
de `a2dp-sink`, forzarlo:

```bash
pactl set-card-profile bluez_card.AA_BB_CC_DD_EE_FF a2dp-sink
```

Y fijarlo como salida por defecto:

```bash
wpctl set-default <ID-del-sink>
```

## Nota de secuencia

Esto es el paso 2 del plan, después de Telegram. No lo persigas antes: el audio
solo importa cuando entre el pipeline de voz (paso 4), y el gateway funcionando
es lo que valida que la arquitectura Pi↔PC sirve.
