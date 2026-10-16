#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
DEPLOYMENTS_DIR="${REPO_ROOT}/deployments"

NETWORK="${NETWORK:-testnet}"
DEPLOYER="${DEPLOYER:-}"
RPC_URL="${STELLAR_RPC_URL:-${NEXT_PUBLIC_STELLAR_RPC_URL:-}}"
ARTIFACT_PATH="${DEPLOYMENTS_DIR}/registry-${NETWORK}.json"

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

network_passphrase() {
  case "${NETWORK}" in
    mainnet) printf 'Public Global Stellar Network ; September 2015' ;;
    testnet) printf 'Test SDF Network ; September 2015' ;;
    *) fail "NETWORK must be testnet or mainnet." ;;
  esac
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command '$1' is not installed or not in PATH."
}

normalize_output() {
  printf '%s' "$1" | tr -d '[:space:]"'
}

main() {
  require_command stellar
  require_command shasum
  require_command tr

  local passphrase
  passphrase="${STELLAR_NETWORK_PASSPHRASE:-${NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:-$(network_passphrase)}}"
  [[ "${passphrase}" == "$(network_passphrase)" ]] || fail "Configured passphrase does not match ${NETWORK}."
  [[ -n "${RPC_URL}" ]] || fail "Set STELLAR_RPC_URL before deploying the registry."
  export STELLAR_RPC_URL="${RPC_URL}"
  [[ -n "${DEPLOYER}" ]] || fail "Set DEPLOYER to an existing Stellar CLI identity name."
  [[ "${DEPLOYER}" =~ ^[A-Za-z0-9._:-]{1,128}$ ]] || fail "DEPLOYER must be an identity name, not a key or shell value."
  [[ ! "${DEPLOYER}" =~ ^[SG][A-Z2-7]{55}$ ]] || fail "Pass a Stellar CLI identity name, never a secret or public key."
  [[ ! -e "${ARTIFACT_PATH}" ]] || fail "${ARTIFACT_PATH} already exists. Inspect the recorded registry deployment before proceeding."

  local deployer_address
  deployer_address="$(stellar keys address "${DEPLOYER}" 2>/dev/null)" || fail "Stellar CLI identity '${DEPLOYER}' was not found."
  deployer_address="$(normalize_output "${deployer_address}")"
  [[ "${deployer_address}" =~ ^G[A-Z2-7]{55}$ ]] || fail "Identity '${DEPLOYER}' did not resolve to a classic account."

  printf 'Building only highrable-registry for %s...\n' "${NETWORK}"
  stellar contract build \
    --manifest-path "${CONTRACTS_DIR}/Cargo.toml" \
    --package highrable-registry \
    --locked

  local wasm_path="${CONTRACTS_DIR}/target/wasm32v1-none/release/highrable_registry.wasm"
  [[ -f "${wasm_path}" ]] || fail "Registry WASM was not produced at ${wasm_path}."

  local local_wasm_hash
  local salt
  local expected_contract_id
  local upload_output
  local wasm_hash
  local deploy_output
  local contract_id
  local fetch_path
  local temp_artifact

  local_wasm_hash="$(shasum -a 256 "${wasm_path}" | awk '{print $1}')"
  [[ "${local_wasm_hash}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "Unable to calculate registry WASM hash."
  salt="$(printf '%s' "${NETWORK}:highrable-registry:v1:${local_wasm_hash}" | shasum -a 256 | awk '{print $1}')"
  [[ "${salt}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "Unable to derive the registry deployment salt."

  expected_contract_id="$(stellar -q contract id wasm \
    --source "${DEPLOYER}" \
    --salt "${salt}" \
    --network "${NETWORK}" \
    --network-passphrase "${passphrase}" | tail -n 1)"
  expected_contract_id="$(normalize_output "${expected_contract_id}")"
  [[ "${expected_contract_id}" =~ ^C[A-Z2-7]{55}$ ]] || fail "Could not derive the registry contract ID."

  fetch_path="$(mktemp)"
  if stellar contract fetch \
    --id "${expected_contract_id}" \
    --out-file "${fetch_path}" \
    --network "${NETWORK}" \
    --network-passphrase "${passphrase}" >/dev/null 2>&1; then
    printf 'Found existing registry at deterministic ID %s; recovering deployment metadata.\n' "${expected_contract_id}"
    contract_id="${expected_contract_id}"
    wasm_hash="$(shasum -a 256 "${fetch_path}" | awk '{print $1}')"
    rm -f "${fetch_path}"
  else
    rm -f "${fetch_path}"
    fetch_path="$(mktemp)"
    if stellar contract fetch \
      --wasm-hash "${local_wasm_hash}" \
      --out-file "${fetch_path}" \
      --network "${NETWORK}" \
      --network-passphrase "${passphrase}" >/dev/null 2>&1; then
      wasm_hash="${local_wasm_hash}"
      printf 'Registry WASM is already uploaded; reusing hash %s.\n' "${wasm_hash}"
    else
      upload_output="$(stellar -q contract upload \
        --wasm "${wasm_path}" \
        --source "${DEPLOYER}" \
        --network "${NETWORK}" \
        --network-passphrase "${passphrase}")" || fail "Registry WASM upload failed."
      wasm_hash="$(normalize_output "${upload_output}")"
      [[ "${wasm_hash}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "Stellar CLI did not return a valid uploaded WASM hash."
    fi

    deploy_output="$(stellar -q contract deploy \
      --wasm-hash "${wasm_hash}" \
      --salt "${salt}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${passphrase}")" || fail "Registry contract deployment failed."
    contract_id="$(normalize_output "${deploy_output}")"
    [[ "${contract_id}" == "${expected_contract_id}" ]] || fail "Deployed ID did not match the derived registry contract ID."
    rm -f "${fetch_path}"
  fi

  mkdir -p "${DEPLOYMENTS_DIR}"
  temp_artifact="$(mktemp "${ARTIFACT_PATH}.tmp.XXXXXX")"
  cat >"${temp_artifact}" <<EOF
{
  "network": "${NETWORK}",
  "networkPassphrase": "${passphrase}",
  "registryContractId": "${contract_id}",
    "wasmHash": "${wasm_hash}",
  "salt": "${salt}",
  "deployerAddress": "${deployer_address}",
  "deployedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
  if [[ -e "${ARTIFACT_PATH}" ]]; then
    rm -f "${temp_artifact}"
    fail "${ARTIFACT_PATH} appeared during deployment; refusing to overwrite it."
  fi
  mv "${temp_artifact}" "${ARTIFACT_PATH}"

  printf 'Registry deployment metadata saved to %s\n' "${ARTIFACT_PATH}"
  printf 'Registry contract ID: %s\n' "${contract_id}"
}

main "$@"
