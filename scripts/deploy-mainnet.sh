#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIRMATION_TOKEN="deploy-highrable-mainnet"

fail() {
  printf "Error: %s\n" "$1" >&2
  exit 1
}

assert_mainnet_url() {
  local value="$1"
  local label="$2"
  local normalized
  normalized="$(printf "%s" "${value}" | tr '[:upper:]' '[:lower:]')"

  [[ -n "${value}" ]] || fail "${label} is required for mainnet deployment."
  [[ "${normalized}" =~ ^https:// ]] || fail "${label} must use HTTPS on mainnet."

  if [[ "${normalized}" =~ (testnet|futurenet|localhost|127\.0\.0\.1|0\.0\.0\.0) ]]; then
    fail "${label} does not look like a mainnet endpoint: ${value}"
  fi
}

[[ "${MAINNET_DEPLOY_CONFIRM:-}" == "${CONFIRMATION_TOKEN}" ]] || fail "Set MAINNET_DEPLOY_CONFIRM=${CONFIRMATION_TOKEN} to deploy contracts on Stellar mainnet."

export NETWORK="mainnet"
export DEPLOYMENT_ARTIFACT_NAME="mainnet"
export STELLAR_RPC_URL="${STELLAR_RPC_URL:-${NEXT_PUBLIC_STELLAR_RPC_URL:-}}"
export STELLAR_HORIZON_URL="${STELLAR_HORIZON_URL:-${NEXT_PUBLIC_STELLAR_HORIZON_URL:-https://horizon.stellar.org}}"
export STELLAR_INCLUSION_FEE="${STELLAR_INCLUSION_FEE:-10000}"
export STELLAR_NO_CACHE="${STELLAR_NO_CACHE:-true}"

assert_mainnet_url "${STELLAR_RPC_URL}" "STELLAR_RPC_URL or NEXT_PUBLIC_STELLAR_RPC_URL"
assert_mainnet_url "${STELLAR_HORIZON_URL}" "STELLAR_HORIZON_URL or NEXT_PUBLIC_STELLAR_HORIZON_URL"

exec bash "${SCRIPT_DIR}/deploy-contracts.sh" "$@"
