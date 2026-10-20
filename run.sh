#!/usr/bin/env bash
set -euo pipefail

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if ! command -v hermes &> /dev/null; then
    echo "❌ Error: el comando 'hermes' no está disponible en el PATH."
    exit 1
fi

# Exporta ROBIN_API_KEY / ARCO_API_URL (y cualquier otra var de .env) para que
# las herramientas de Hermes (terminal/code_execution) puedan usarlas al
# consultar el backend de A.R.C.O.
if [ -f "$DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$DIR/.env"
    set +a
fi

case "${1:-}" in
    gateway)
        echo "🤖 Iniciando gateway de Robin (Google Chat)..."
        cd "$DIR"
        # --replace: si un proceso anterior murió sin liberar el candado interno
        # de Hermes (kill -9, corte de luz, etc.), esto lo reemplaza en vez de
        # fallar con "Another gateway instance is already running".
        exec hermes gateway run --replace "${@:2}"
        ;;
    -c|--continue)
        echo "🤖 Reanudando sesión de Robin..."
        cd "$DIR"
        exec hermes chat --continue robin
        ;;
    -h|--help)
        echo "🤖 Robin — Agente de Collection (Alanube / A.R.C.O)"
        echo "Uso:"
        echo "  ./run.sh                  Iniciar chat interactivo (nuevo o existente)"
        echo "  ./run.sh -c               Reanudar sesión 'robin'"
        echo "  ./run.sh -q \"pregunta\"    Consulta one-shot (sin chat interactivo)"
        exit 0
        ;;
    -q|--query)
        QUERY="${2:-}"
        if [[ -z "$QUERY" ]]; then
            echo "❌ Error: debes indicar una consulta. Uso: ./run.sh -q \"tu pregunta\"" >&2
            exit 1
        fi
        # hermes -z no inyecta AGENTS.md, así que prefijamos la identidad y el
        # contexto de negocio (ya combinados en system_prompt.md) al prompt.
        SYSTEM_PROMPT="$(cat "$DIR/system_prompt.md")"
        FULL_PROMPT="$SYSTEM_PROMPT"$'\n\n---\n\nCONSULTA DEL USUARIO:\n'"$QUERY"
        cd "$DIR"
        exec hermes -z "$FULL_PROMPT" --cli
        ;;
    *)
        echo "🤖 Iniciando Robin (chat interactivo)..."
        cd "$DIR"
        # Iniciamos el chat sin forzar --continue si falla la sesión
        exec hermes chat || exec hermes chat --continue robin
        ;;
esac