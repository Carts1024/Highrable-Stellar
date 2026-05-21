#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export NETWORK="testnet"
export DEPLOYMENT_ARTIFACT_NAME="testnet"
export STELLAR_RPC_URL="${STELLAR_RPC_URL:-${NEXT_PUBLIC_STELLAR_RPC_URL:-https://soroban-testnet.stellar.org}}"
export STELLAR_HORIZON_URL="${STELLAR_HORIZON_URL:-${NEXT_PUBLIC_STELLAR_HORIZON_URL:-https://horizon-testnet.stellar.org}}"

exec bash "${SCRIPT_DIR}/deploy-contracts.sh" "$@"
