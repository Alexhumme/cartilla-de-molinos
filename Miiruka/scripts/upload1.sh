#!/usr/bin/env bash
set -euo pipefail

# Carga variables desde .env si existe
if [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi

HOSTINGER_SSH_HOST="${HOSTINGER_SSH_HOST:-}"
HOSTINGER_SSH_USER="${HOSTINGER_SSH_USER:-}"
HOSTINGER_SSH_PORT="${HOSTINGER_SSH_PORT:-22}"
HOSTINGER_REMOTE_DIR="${HOSTINGER_REMOTE_DIR:-public_html}"

if [ -z "$HOSTINGER_SSH_HOST" ] || [ -z "$HOSTINGER_SSH_USER" ]; then
  echo "Faltan variables. Configura .env con:"
  echo "  HOSTINGER_SSH_HOST=tu-host"
  echo "  HOSTINGER_SSH_USER=tu-usuario"
  echo "  HOSTINGER_SSH_PORT=22"
  echo "  HOSTINGER_REMOTE_DIR=public_html"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "No se encontro rsync. Instala rsync e intenta de nuevo."
  exit 1
fi

echo "Subiendo archivos a ${HOSTINGER_SSH_USER}@${HOSTINGER_SSH_HOST}:${HOSTINGER_REMOTE_DIR}/"

# Seguridad minima para evitar borrados peligrosos.
case "${HOSTINGER_REMOTE_DIR}" in
  ""|"/"|".")
    echo "HOSTINGER_REMOTE_DIR no es seguro: '${HOSTINGER_REMOTE_DIR}'"
    exit 1
    ;;
esac

echo "Limpiando contenido previo en ${HOSTINGER_REMOTE_DIR}/ ..."
ssh -p "${HOSTINGER_SSH_PORT}" "${HOSTINGER_SSH_USER}@${HOSTINGER_SSH_HOST}" \
  "mkdir -p '${HOSTINGER_REMOTE_DIR}' && find '${HOSTINGER_REMOTE_DIR}' -mindepth 1 -maxdepth 1 -exec rm -rf {} +"

# Subida completa del proyecto (reemplazo limpio).
rsync -avz \
  --progress \
  --exclude='.git/' \
  --exclude='.DS_Store' \
  --exclude='node_modules/' \
  --exclude='.env' \
  --exclude='/scripts/' \
  -e "ssh -p ${HOSTINGER_SSH_PORT}" \
  ./ "${HOSTINGER_SSH_USER}@${HOSTINGER_SSH_HOST}:${HOSTINGER_REMOTE_DIR}/"

echo "Upload completado (limpieza + carga nueva)."
