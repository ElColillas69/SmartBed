# SmartBed hardware (Raspberry Pi)

## Quick start
```bash
ssh pi@172.20.10.9
source .venv/bin/activate
sudo pigpiod
pigs t ( if you want to check its running )
python3 main.py
```

## Wiring
## (Used Claude to help me with this diagram)

| Part | Pi pin | GPIO | Notes |
|------|--------|------|-------|
| DHT22 data | 7 | GPIO 4 | Temperature and humidity |
| MCP3008 (SPI) | 19, 21, 23, 24 | GPIO 10, 9, 11, 8 | Reads the FSR402 on channel 0 |
| Heater LED | 11 | GPIO 17 | Long leg to GPIO, short leg to resistor to GND |
| Buzzer | 13 | GPIO 27 | Not wired yet |

The LEDs use 4.7 kΩ resistors (220–330 Ω would make them brighter).

## Testing parts on their own
```bash
python3 sensors/fsr402.py
python3 actuators/leds.py
```