# 🤖 Robin — Agente de Collection (Alanube / A.R.C.O)

Robin es un agente de IA especializado en análisis de cartera, seguimiento de
cobros y consulta de características de clientes para **Alanube / A.R.C.O**.
Se ejecuta localmente sobre la CLI de Hermes (sin servidores externos).

## 📁 Estructura
```
Robin/
├── AGENTS.md           # Persona del agente (Hermes la inyecta en modo interactivo)
├── system_prompt.md    # Rol y reglas de Robin (fuente de la identidad)
├── context_negocio.md  # Datos reales de negocio: sociedades, plantillas, rutas, endpoints
├── run.sh              # Arrancador funcional (chat / one-shot / reanudar sesión)
└── README.md           # Este archivo
```

## 📌 Requisitos
- **Hermes CLI** instalado y disponible en el `PATH` (verifica con `hermes --version`).
- Permisos de ejecución en `run.sh` (solo la primera vez, ver abajo).

## 🚀 Uso

Desde una terminal (git-bash / MSYS en Windows, o bash en Linux/macOS), sitúate
en la carpeta `Robin` y ejecuta:

```bash
# Chat interactivo (recomendado)
./run.sh

# Reanudar la sesión "robin" (recuerda el contexto de conversaciones previas)
./run.sh -c

# Consulta rápida one-shot (sin abrir el chat)
./run.sh -q "¿Cuáles son las sociedades de Alanube y sus canales de pago?"

# Ayuda
./run.sh -h
```

### Permisos de ejecución (primera vez, en Linux/macOS o git-bash)
```bash
chmod +x run.sh
```
En Windows con git-bash esto ya funciona; si usas `cmd.exe`, ejecuta con
`bash run.sh`.

## 🧠 Cómo funciona
- **Modo interactivo** (`./run.sh` / `-c`): Hermes inyecta `AGENTS.md` como
  contexto estable. La sesión se guarda con el nombre `robin` (`--continue robin`),
  así que Robin "recuerda" entre llamadas.
- **Modo one-shot** (`./run.sh -q "..."`): como `hermes -z` no inyecta
  `AGENTS.md`, `run.sh` prefija la identidad y el contexto de negocio al prompt
  automáticamente. Útil para automatizaciones y scripts.

## ⚙️ Personalización
- Edita `system_prompt.md` para cambiar rol/tono de Robin.
- Edita `context_negocio.md` para actualizar sociedades, plantillas, rutas de
  documentos o endpoints de A.R.C.O.
- El modo interactivo lee `AGENTS.md` (derivado de `system_prompt.md`); mantén
  ambos alineados.

## 🔒 Seguridad
- No se incluyen credenciales. El `.env` de A.R.C.O está ignorado.
- En modo test, los correos de cobranza solo van a `alexander.martinez@alegra.com`.
