#!/usr/bin/env bash

set -euo pipefail

NETWORK="${NETWORK:-testnet}"
REGISTRY_CONTRACT_ID="${REGISTRY_CONTRACT_ID:-${NEXT_PUBLIC_REGISTRY_CONTRACT_ID:-}}"
VERIFY_WALLET="${1:-${VERIFY_WALLET:-}}"
READ_SOURCE="${STELLAR_READ_SOURCE_ACCOUNT:-${REGISTRY_VERIFY_SOURCE:-}}"
RPC_URL="${STELLAR_RPC_URL:-${NEXT_PUBLIC_STELLAR_RPC_URL:-}}"

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

network_passphrase() {
  case "${NETWORK}" in
    mainnet) printf 'Public Global Stellar Network ; September 2015' ;;
    testnet) printf 'Test SDF Network ; September 2015' ;;
    *) fail "NETWORK must be testnet or mainnet for this verification script." ;;
  esac
}

normalize_output() {
  printf '%s' "$1" | tr -d '[:space:]"'
}

main() {
  command -v stellar >/dev/null 2>&1 || fail "stellar CLI is not installed or not in PATH."
  [[ "${REGISTRY_CONTRACT_ID}" =~ ^C[A-Z2-7]{55}$ ]] || fail "Set REGISTRY_CONTRACT_ID to the registry contract ID."
  [[ "${VERIFY_WALLET}" =~ ^G[A-Z2-7]{55}$ ]] || fail "Provide a valid G... wallet address as the first argument or VERIFY_WALLET."
  [[ -n "${READ_SOURCE}" ]] || fail "Set STELLAR_READ_SOURCE_ACCOUNT to a readable account or CLI identity."
  [[ ! "${READ_SOURCE}" =~ ^S[A-Z2-7]{55}$ ]] || fail "Use a public address or identity name, never a secret key."
  [[ -n "${RPC_URL}" ]] || fail "Set STELLAR_RPC_URL before verifying the registry."

  local passphrase
  passphrase="${STELLAR_NETWORK_PASSPHRASE:-${NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:-$(network_passphrase)}}"
  [[ "${passphrase}" == "$(network_passphrase)" ]] || fail "Configured passphrase does not match ${NETWORK}."
  export STELLAR_RPC_URL="${RPC_URL}"

  printf 'Registry contract: %s (%s)\n' "${REGISTRY_CONTRACT_ID}" "${NETWORK}"
  printf 'Wallet: %s\n' "${VERIFY_WALLET}"
  printf '\nget_registration (read-only):\n'
  stellar -q contract invoke \
    --id "${REGISTRY_CONTRACT_ID}" \
    --source "${READ_SOURCE}" \
    --network "${NETWORK}" \
    --network-passphrase "${passphrase}" \
    --send no \
    -- \
    get_registration \
    --user "${VERIFY_WALLET}"

  printf '\nis_registered (read-only):\n'
  local membership_output
  membership_output="$(stellar -q contract invoke \
    --id "${REGISTRY_CONTRACT_ID}" \
    --source "${READ_SOURCE}" \
    --network "${NETWORK}" \
    --network-passphrase "${passphrase}" \
    --send no \
    -- \
    is_registered \
    --user "${VERIFY_WALLET}")"
  printf '%s\n' "${membership_output}"

  case "$(normalize_output "${membership_output}")" in
    true) printf '\nRegistry read checks completed: this wallet is registered.\n' ;;
    false) printf '\nRegistry read checks completed: this wallet is not registered.\n' ;;
    *) fail "Registry returned an unexpected is_registered result." ;;
  esac
}

main "$@"
