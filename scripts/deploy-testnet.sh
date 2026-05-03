#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
DEPLOYMENTS_DIR="${REPO_ROOT}/deployments"
ARTIFACT_PATH="${DEPLOYMENTS_DIR}/testnet.json"

NETWORK="testnet"
RPC_URL="https://soroban-testnet.stellar.org"
HORIZON_URL="https://horizon-testnet.stellar.org"

DEPLOYER="${DEPLOYER:-${1:-}}"
PLATFORM_ADMIN="${PLATFORM_ADMIN:-${2:-${DEPLOYER:-}}}"

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

invoke_contract() {
  local contract_id="$1"
  local method="$2"
  shift 2

  stellar contract invoke \
    --id "${contract_id}" \
    --source "${DEPLOYER}" \
    --network "${NETWORK}" \
    -- \
    "${method}" \
    "$@"
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

  if [[ -z "${discovered}" ]]; then
    fail "Unable to locate wasm output for crate '${crate_name}'. Build may have failed or output path changed."
  fi

  printf "%s" "${discovered}"
}

assert_identity_exists() {
  local identity_name="$1"
  if ! stellar keys address "${identity_name}" >/dev/null 2>&1; then
    fail "Identity '${identity_name}' was not found. Create/fund it first (e.g., stellar keys generate --global ${identity_name} --network ${NETWORK} --fund)."
  fi
}

assert_is_contract_id() {
  local value="$1"
  local label="$2"
  if [[ ! "${value}" =~ ^C[A-Z2-7]{55}$ ]]; then
    fail "${label} is not a valid Stellar contract ID: ${value}"
  fi
}

verify_contract_wiring() {
  local reputation_id="$1"
  local escrow_id="$2"

  local authorized_escrow_raw
  authorized_escrow_raw="$(invoke_contract "${reputation_id}" get_authorized_escrow_contract)"
  local authorized_escrow
  authorized_escrow="$(normalize_output "${authorized_escrow_raw}")"

  local linked_reputation_raw
  linked_reputation_raw="$(invoke_contract "${escrow_id}" get_reputation_contract)"
  local linked_reputation
  linked_reputation="$(normalize_output "${linked_reputation_raw}")"

  local platform_admin_raw
  platform_admin_raw="$(invoke_contract "${escrow_id}" get_platform_admin)"
  local linked_platform_admin
  linked_platform_admin="$(normalize_output "${platform_admin_raw}")"

  local next_escrow_id_raw
  next_escrow_id_raw="$(invoke_contract "${escrow_id}" get_next_escrow_id)"
  local next_escrow_id
  next_escrow_id="$(normalize_output "${next_escrow_id_raw}")"

  if [[ "${authorized_escrow}" != "${escrow_id}" ]]; then
    fail "Verification failed: reputation authorized escrow (${authorized_escrow}) does not match deployed escrow (${escrow_id})."
  fi

  if [[ "${linked_reputation}" != "${reputation_id}" ]]; then
    fail "Verification failed: escrow reputation contract (${linked_reputation}) does not match deployed reputation (${reputation_id})."
  fi

  if [[ "${linked_platform_admin}" != "${PLATFORM_ADMIN}" ]]; then
    fail "Verification failed: escrow platform admin (${linked_platform_admin}) does not match expected admin (${PLATFORM_ADMIN})."
  fi

  if [[ "${next_escrow_id}" != "1" ]]; then
    fail "Verification failed: escrow next escrow id expected 1 but got ${next_escrow_id}."
  fi

  printf "Verification passed.\n"
  printf "  Reputation authorized escrow: %s\n" "${authorized_escrow}"
  printf "  Escrow reputation contract: %s\n" "${linked_reputation}"
  printf "  Escrow platform admin: %s\n" "${linked_platform_admin}"
  printf "  Escrow next escrow id: %s\n" "${next_escrow_id}"
}

write_artifact() {
  local reputation_id="$1"
  local escrow_id="$2"
  local deployer_address="$3"

  mkdir -p "${DEPLOYMENTS_DIR}"

  cat >"${ARTIFACT_PATH}" <<EOF
{
  "network": "${NETWORK}",
  "rpcUrl": "${RPC_URL}",
  "horizonUrl": "${HORIZON_URL}",
  "reputationContractId": "${reputation_id}",
  "escrowContractId": "${escrow_id}",
  "platformAdmin": "${PLATFORM_ADMIN}",
  "deployerIdentity": "${DEPLOYER}",
  "deployerAddress": "${deployer_address}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

main() {
  require_command stellar
  require_command find

  [[ -n "${DEPLOYER}" ]] || fail "Missing DEPLOYER. Usage: DEPLOYER=<identity> [PLATFORM_ADMIN=<G...>] bash scripts/deploy-testnet.sh"
  [[ -n "${PLATFORM_ADMIN}" ]] || fail "Missing PLATFORM_ADMIN and no fallback available."
  [[ "${PLATFORM_ADMIN}" =~ ^G[A-Z2-7]{55}$ ]] || fail "PLATFORM_ADMIN must be a valid Stellar public key (G...)."

  [[ -d "${CONTRACTS_DIR}" ]] || fail "Contracts directory not found at ${CONTRACTS_DIR}."

  assert_identity_exists "${DEPLOYER}"

  local deployer_address
  deployer_address="$(stellar keys address "${DEPLOYER}")"
  deployer_address="$(normalize_output "${deployer_address}")"

  printf "Building contracts for %s...\n" "${NETWORK}"
  (
    cd "${CONTRACTS_DIR}"
    stellar contract build
  )

  local reputation_wasm
  reputation_wasm="$(resolve_wasm_path "highrable_reputation")"
  local escrow_wasm
  escrow_wasm="$(resolve_wasm_path "highrable_escrow")"

  [[ -f "${reputation_wasm}" ]] || fail "Reputation wasm not found after build."
  [[ -f "${escrow_wasm}" ]] || fail "Escrow wasm not found after build."

  printf "Deploying ReputationContract...\n"
  local reputation_deploy_output
  reputation_deploy_output="$(stellar contract deploy --wasm "${reputation_wasm}" --source "${DEPLOYER}" --network "${NETWORK}")"
  local reputation_contract_id
  reputation_contract_id="$(normalize_output "${reputation_deploy_output}")"
  assert_is_contract_id "${reputation_contract_id}" "Reputation contract ID"

  printf "Deploying EscrowContract...\n"
  local escrow_deploy_output
  escrow_deploy_output="$(stellar contract deploy --wasm "${escrow_wasm}" --source "${DEPLOYER}" --network "${NETWORK}")"
  local escrow_contract_id
  escrow_contract_id="$(normalize_output "${escrow_deploy_output}")"
  assert_is_contract_id "${escrow_contract_id}" "Escrow contract ID"

  printf "Initializing EscrowContract...\n"
  invoke_contract \
    "${escrow_contract_id}" \
    initialize \
    --reputation_contract_address "${reputation_contract_id}" \
    --platform_admin "${PLATFORM_ADMIN}" >/dev/null

  printf "Initializing ReputationContract...\n"
  invoke_contract \
    "${reputation_contract_id}" \
    initialize \
    --authorized_escrow_contract "${escrow_contract_id}" >/dev/null

  printf "Running deployment verification...\n"
  verify_contract_wiring "${reputation_contract_id}" "${escrow_contract_id}"

  write_artifact "${reputation_contract_id}" "${escrow_contract_id}" "${deployer_address}"

  printf "\nDeployment complete:\n"
  printf "ReputationContract ID: %s\n" "${reputation_contract_id}"
  printf "EscrowContract ID: %s\n" "${escrow_contract_id}"
  printf "Deployment artifact: %s\n" "${ARTIFACT_PATH}"

  printf "\nAdd these to apps/web/.env.local:\n"
  printf "NEXT_PUBLIC_STELLAR_NETWORK=%s\n" "${NETWORK}"
  printf "NEXT_PUBLIC_STELLAR_RPC_URL=%s\n" "${RPC_URL}"
  printf "NEXT_PUBLIC_STELLAR_HORIZON_URL=%s\n" "${HORIZON_URL}"
  printf "NEXT_PUBLIC_REPUTATION_CONTRACT_ID=%s\n" "${reputation_contract_id}"
  printf "NEXT_PUBLIC_ESCROW_CONTRACT_ID=%s\n" "${escrow_contract_id}"

  printf "\nAdd these to backend/Convex environment:\n"
  printf "STELLAR_NETWORK=%s\n" "${NETWORK}"
  printf "STELLAR_RPC_URL=%s\n" "${RPC_URL}"
  printf "STELLAR_HORIZON_URL=%s\n" "${HORIZON_URL}"
  printf "REPUTATION_CONTRACT_ID=%s\n" "${reputation_contract_id}"
  printf "ESCROW_CONTRACT_ID=%s\n" "${escrow_contract_id}"
}

main "$@"
