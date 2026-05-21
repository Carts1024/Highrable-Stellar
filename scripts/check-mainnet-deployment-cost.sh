#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"

NETWORK="mainnet"
RPC_URL="${STELLAR_RPC_URL:-${NEXT_PUBLIC_STELLAR_RPC_URL:-}}"
NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-${NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:-Public Global Stellar Network ; September 2015}}"
DEPLOYER="${DEPLOYER:-${1:-}}"

fail() {
  printf "Error: %s\n" "$1" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command '$1' is not installed or not in PATH."
  fi
}

normalize_output() {
  printf "%s" "$1" | tr -d '[:space:]\"'
}

format_stroops_as_xlm() {
  local stroops="$1"
  printf "%d.%07d" "$((stroops / 10000000))" "$((stroops % 10000000))"
}

assert_mainnet_url() {
  local value="$1"
  local label="$2"
  local normalized
  normalized="$(printf "%s" "${value}" | tr '[:upper:]' '[:lower:]')"

  [[ -n "${value}" ]] || fail "${label} is required."
  [[ "${normalized}" =~ ^https:// ]] || fail "${label} must use HTTPS on mainnet."

  if [[ "${normalized}" =~ (testnet|futurenet|localhost|127\.0\.0\.1|0\.0\.0\.0) ]]; then
    fail "${label} does not look like a mainnet endpoint: ${value}"
  fi
}

assert_identity_exists() {
  local identity_name="$1"

  [[ -n "${identity_name}" ]] || fail "Missing DEPLOYER. Usage: DEPLOYER=<identity> bash scripts/check-mainnet-deployment-cost.sh"

  if [[ ! "${identity_name}" =~ ^[A-Za-z0-9._:-]{1,128}$ ]]; then
    fail "DEPLOYER must be a Stellar CLI identity name."
  fi

  if [[ "${identity_name}" =~ ^S[A-Z2-7]{55}$ ]]; then
    fail "DEPLOYER must be a Stellar CLI identity name. Do not pass secret keys to this script."
  fi

  if ! stellar keys address "${identity_name}" >/dev/null 2>&1; then
    fail "Identity '${identity_name}' was not found in Stellar CLI."
  fi
}

account_balance_xlm() {
  local account_id="$1"

  stellar ledger entry fetch account \
    --account "${account_id}" \
    --network "${NETWORK}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" \
    --output json 2>/dev/null |
    sed -n 's/.*"balance":[[:space:]]*"\{0,1\}\([0-9][0-9]*\)"\{0,1\}.*/\1/p' |
    head -n 1
}

resolve_wasm_path() {
  local crate_name="$1"
  local direct_v1="${CONTRACTS_DIR}/target/wasm32v1-none/release/${crate_name}.wasm"
  local direct_unknown="${CONTRACTS_DIR}/target/wasm32-unknown-unknown/release/${crate_name}.wasm"

  if [[ -f "${direct_v1}" ]]; then
    printf "%s" "${direct_v1}"
    return 0
  fi

  if [[ -f "${direct_unknown}" ]]; then
    printf "%s" "${direct_unknown}"
    return 0
  fi

  local discovered
  discovered="$(find "${CONTRACTS_DIR}/target" -type f -path "*/release/*.wasm" ! -path "*/deps/*" ! -path "*/build/*" | grep -E "${crate_name}|${crate_name//_/-}" | head -n 1 || true)"

  [[ -n "${discovered}" ]] || fail "Unable to locate wasm output for crate '${crate_name}'."
  printf "%s" "${discovered}"
}

decode_simulated_fee() {
  local simulated_xdr="$1"
  local decoded_transaction

  decoded_transaction="$(stellar tx decode --output json-formatted "${simulated_xdr}")"

  printf "%s\n" "${decoded_transaction}" |
    sed -n 's/^[[:space:]]*"fee":[[:space:]]*\([0-9][0-9]*\),[[:space:]]*$/\1/p' |
    head -n 1
}

estimate_upload_fee_stroops() {
  local wasm_path="$1"
  local transaction_xdr
  local simulated_xdr

  transaction_xdr="$(
    stellar -q contract upload \
      --wasm "${wasm_path}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --build-only |
      tail -n 1
  )"

  [[ -n "${transaction_xdr}" ]] || fail "Could not build upload transaction for ${wasm_path}."

  simulated_xdr="$(
    stellar -q tx simulate \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      "${transaction_xdr}" |
      tail -n 1
  )"

  [[ -n "${simulated_xdr}" ]] || fail "Could not simulate upload transaction for ${wasm_path}."
  decode_simulated_fee "${simulated_xdr}"
}

print_fee_row() {
  local label="$1"
  local fee_stroops="$2"
  local fee_xlm

  fee_xlm="$(format_stroops_as_xlm "${fee_stroops}")"
  printf "%-28s %14s stroops  %14s XLM\n" "${label}" "${fee_stroops}" "${fee_xlm}"
}

main() {
  require_command stellar
  require_command find
  require_command grep
  require_command sed
  require_command tail

  assert_mainnet_url "${RPC_URL}" "STELLAR_RPC_URL or NEXT_PUBLIC_STELLAR_RPC_URL"
  [[ "${NETWORK_PASSPHRASE}" == "Public Global Stellar Network ; September 2015" ]] || fail "Network passphrase does not match Stellar mainnet."
  assert_identity_exists "${DEPLOYER}"

  export STELLAR_RPC_URL="${RPC_URL}"
  export STELLAR_NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE}"

  local deployer_address
  deployer_address="$(normalize_output "$(stellar keys address "${DEPLOYER}")")"

  printf "Mainnet deployment cost check only. No transactions will be submitted.\n"
  printf "Deployer identity: %s\n" "${DEPLOYER}"
  printf "Deployer address:  %s\n" "${deployer_address}"
  printf "RPC URL:           %s\n\n" "${RPC_URL}"

  printf "Building contracts...\n"
  (
    cd "${CONTRACTS_DIR}"
    stellar contract build
  )

  local reputation_wasm
  local escrow_wasm
  reputation_wasm="$(resolve_wasm_path "highrable_reputation")"
  escrow_wasm="$(resolve_wasm_path "highrable_escrow")"

  printf "\nEstimating mainnet upload costs...\n"
  local reputation_fee
  local escrow_fee
  local total_fee
  reputation_fee="$(estimate_upload_fee_stroops "${reputation_wasm}")"
  escrow_fee="$(estimate_upload_fee_stroops "${escrow_wasm}")"
  total_fee="$((reputation_fee + escrow_fee))"

  print_fee_row "Reputation WASM upload" "${reputation_fee}"
  print_fee_row "Escrow WASM upload" "${escrow_fee}"
  printf "%-28s %14s stroops  %14s XLM\n" "Estimated upload total" "${total_fee}" "$(format_stroops_as_xlm "${total_fee}")"

  local balance_stroops
  if balance_stroops="$(account_balance_xlm "${deployer_address}")" && [[ -n "${balance_stroops}" ]]; then
    printf "\nAccount balance: %s stroops (%s XLM)\n" "${balance_stroops}" "$(format_stroops_as_xlm "${balance_stroops}")"
    if (( balance_stroops < total_fee )); then
      printf "Shortfall for uploads: %s stroops (%s XLM)\n" "$((total_fee - balance_stroops))" "$(format_stroops_as_xlm "$((total_fee - balance_stroops))")"
    else
      printf "Balance covers the estimated WASM upload total.\n"
    fi
  else
    printf "\nAccount balance: unavailable from Stellar RPC.\n"
  fi

  printf "\nNote: this script estimates the expensive upfront WASM upload transactions only.\n"
  printf "After those WASMs are uploaded, run a deploy fee check by --wasm-hash before submitting create/init transactions.\n"
}

main "$@"
