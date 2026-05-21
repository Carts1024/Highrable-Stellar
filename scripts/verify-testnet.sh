#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ARTIFACT_PATH="${REPO_ROOT}/deployments/testnet.json"

NETWORK="testnet"

fail() {
  printf "Error: %s\n" "$1" >&2
  exit 1
}

normalize_output() {
  printf "%s" "$1" | tr -d '[:space:]\"'
}

extract_json_value() {
  local key="$1"
  local file_path="$2"
  local value
  value="$(grep -E "\"${key}\"" "${file_path}" | head -n 1 | sed -E 's/.*"[^"]+"[[:space:]]*:[[:space:]]*"?([^",}]+)"?.*/\1/' || true)"
  printf "%s" "${value}"
}

verify_allowed_asset() {
  local source_identity="$1"
  local escrow_contract_id="$2"
  local asset_id="$3"
  local label="$4"

  if [[ -z "${asset_id}" ]]; then
    printf "  %s: not configured\n" "${label}"
    return 0
  fi

  [[ "${asset_id}" =~ ^C[A-Z2-7]{55}$ ]] || fail "Invalid ${label}: ${asset_id}"

  local allowed
  allowed="$(normalize_output "$(invoke_contract "${source_identity}" "${escrow_contract_id}" is_allowed_asset --asset "${asset_id}")")"
  [[ "${allowed}" == "true" ]] || fail "${label} is configured but not allowlisted in escrow contract."
  printf "  %s: %s allowlisted=true\n" "${label}" "${asset_id}"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command '$1' is not installed or not in PATH."
  fi
}

invoke_contract() {
  local source_identity="$1"
  local contract_id="$2"
  local method="$3"
  shift 3

  stellar contract invoke \
    --id "${contract_id}" \
    --source "${source_identity}" \
    --network "${NETWORK}" \
    -- \
    "${method}" \
    "$@"
}

main() {
  require_command stellar
  require_command grep
  require_command sed

  local source_identity
  source_identity="${DEPLOYER:-${SOURCE_IDENTITY:-${1:-}}}"
  [[ -n "${source_identity}" ]] || fail "Missing source identity. Use DEPLOYER=<identity> (or SOURCE_IDENTITY=<identity>)."

  if ! stellar keys address "${source_identity}" --network "${NETWORK}" >/dev/null 2>&1; then
    fail "Identity '${source_identity}' not found for network '${NETWORK}'."
  fi

  local reputation_contract_id
  local escrow_contract_id
  local expected_platform_admin

  reputation_contract_id="${REPUTATION_CONTRACT_ID:-}"
  escrow_contract_id="${ESCROW_CONTRACT_ID:-}"
  expected_platform_admin="${PLATFORM_ADMIN:-}"

  if [[ -z "${reputation_contract_id}" || -z "${escrow_contract_id}" || -z "${expected_platform_admin}" ]]; then
    [[ -f "${ARTIFACT_PATH}" ]] || fail "Missing required env vars and no artifact found at ${ARTIFACT_PATH}."
    reputation_contract_id="${reputation_contract_id:-$(extract_json_value "reputationContractId" "${ARTIFACT_PATH}")}"
    escrow_contract_id="${escrow_contract_id:-$(extract_json_value "escrowContractId" "${ARTIFACT_PATH}")}"
    expected_platform_admin="${expected_platform_admin:-$(extract_json_value "platformAdmin" "${ARTIFACT_PATH}")}"
  fi

  [[ "${reputation_contract_id}" =~ ^C[A-Z2-7]{55}$ ]] || fail "Invalid REPUTATION_CONTRACT_ID: ${reputation_contract_id}"
  [[ "${escrow_contract_id}" =~ ^C[A-Z2-7]{55}$ ]] || fail "Invalid ESCROW_CONTRACT_ID: ${escrow_contract_id}"
  [[ "${expected_platform_admin}" =~ ^G[A-Z2-7]{55}$ ]] || fail "Invalid PLATFORM_ADMIN: ${expected_platform_admin}"

  local authorized_escrow
  authorized_escrow="$(normalize_output "$(invoke_contract "${source_identity}" "${reputation_contract_id}" get_authorized_escrow_contract)")"

  local linked_reputation
  linked_reputation="$(normalize_output "$(invoke_contract "${source_identity}" "${escrow_contract_id}" get_reputation_contract)")"

  local linked_platform_admin
  linked_platform_admin="$(normalize_output "$(invoke_contract "${source_identity}" "${escrow_contract_id}" get_platform_admin)")"

  local next_escrow_id
  next_escrow_id="$(normalize_output "$(invoke_contract "${source_identity}" "${escrow_contract_id}" get_next_escrow_id)")"

  [[ "${authorized_escrow}" == "${escrow_contract_id}" ]] || fail "Verification failed: Reputation authorized escrow mismatch. got=${authorized_escrow} expected=${escrow_contract_id}"
  [[ "${linked_reputation}" == "${reputation_contract_id}" ]] || fail "Verification failed: Escrow reputation contract mismatch. got=${linked_reputation} expected=${reputation_contract_id}"
  [[ "${linked_platform_admin}" == "${expected_platform_admin}" ]] || fail "Verification failed: Escrow platform admin mismatch. got=${linked_platform_admin} expected=${expected_platform_admin}"
  [[ "${next_escrow_id}" == "1" ]] || fail "Verification failed: Expected get_next_escrow_id == 1, got ${next_escrow_id}"

  printf "Verification passed:\n"
  printf "  ReputationContract: %s\n" "${reputation_contract_id}"
  printf "  EscrowContract: %s\n" "${escrow_contract_id}"
  printf "  get_authorized_escrow_contract: %s\n" "${authorized_escrow}"
  printf "  get_reputation_contract: %s\n" "${linked_reputation}"
  printf "  get_platform_admin: %s\n" "${linked_platform_admin}"
  printf "  get_next_escrow_id: %s\n" "${next_escrow_id}"
  verify_allowed_asset "${source_identity}" "${escrow_contract_id}" "${NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID:-${STABLECOIN_TOKEN_CONTRACT_ID:-}}" "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID"
  verify_allowed_asset "${source_identity}" "${escrow_contract_id}" "${NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID:-${NATIVE_XLM_TOKEN_CONTRACT_ID:-}}" "NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID"
}

main "$@"
