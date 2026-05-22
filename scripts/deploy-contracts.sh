#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTRACTS_DIR="${REPO_ROOT}/contracts"
DEPLOYMENTS_DIR="${REPO_ROOT}/deployments"

NETWORK="${NETWORK:-testnet}"
RPC_URL="${STELLAR_RPC_URL:-${NEXT_PUBLIC_STELLAR_RPC_URL:-}}"
HORIZON_URL="${STELLAR_HORIZON_URL:-${NEXT_PUBLIC_STELLAR_HORIZON_URL:-}}"
ARTIFACT_NAME="${DEPLOYMENT_ARTIFACT_NAME:-${NETWORK}}"
ARTIFACT_PATH="${DEPLOYMENTS_DIR}/${ARTIFACT_NAME}.json"

DEPLOYER="${DEPLOYER:-${1:-}}"
PLATFORM_ADMIN="${PLATFORM_ADMIN:-${2:-${DEPLOYER:-}}}"
STABLECOIN_TOKEN_CONTRACT_ID="${NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID:-${STABLECOIN_TOKEN_CONTRACT_ID:-}}"
NATIVE_XLM_TOKEN_CONTRACT_ID="${NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID:-${NATIVE_XLM_TOKEN_CONTRACT_ID:-}}"

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

normalize_hex() {
  normalize_output "$1" | tr '[:upper:]' '[:lower:]'
}

network_passphrase() {
  case "${NETWORK}" in
    mainnet)
      printf "Public Global Stellar Network ; September 2015"
      ;;
    testnet)
      printf "Test SDF Network ; September 2015"
      ;;
    *)
      fail "Unsupported deployment network '${NETWORK}'."
      ;;
  esac
}

NETWORK_PASSPHRASE="${STELLAR_NETWORK_PASSPHRASE:-${NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:-$(network_passphrase)}}"
export STELLAR_RPC_URL="${RPC_URL}"
export STELLAR_NETWORK_PASSPHRASE="${NETWORK_PASSPHRASE}"

format_stroops_as_xlm() {
  local stroops="$1"
  printf "%d.%07d" "$((stroops / 10000000))" "$((stroops % 10000000))"
}

assert_identity_exists() {
  local identity_name="$1"

  if [[ ! "${identity_name}" =~ ^[A-Za-z0-9._:-]{1,128}$ ]]; then
    fail "DEPLOYER must be a Stellar CLI identity name, not an arbitrary shell value."
  fi

  if [[ "${identity_name}" =~ ^S[A-Z2-7]{55}$ ]]; then
    fail "DEPLOYER must be a Stellar CLI identity name. Do not pass secret keys to deployment scripts."
  fi

  if ! stellar keys address "${identity_name}" >/dev/null 2>&1; then
    fail "Identity '${identity_name}' was not found. Create/fund it first (e.g., stellar keys generate --global ${identity_name} --network ${NETWORK})."
  fi
}

assert_account_exists_on_network() {
  local account_id="$1"

  if stellar ledger entry fetch account \
    --account "${account_id}" \
    --network "${NETWORK}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" >/dev/null 2>&1; then
    return 0
  fi

  if [[ "${NETWORK}" == "mainnet" ]]; then
    fail "Deployer account ${account_id} does not exist on Stellar mainnet. Fund it with real XLM before deploying contracts."
  fi

  fail "Deployer account ${account_id} does not exist on Stellar ${NETWORK}."
}

assert_is_contract_id() {
  local value="$1"
  local label="$2"
  if [[ ! "${value}" =~ ^C[A-Z2-7]{55}$ ]]; then
    fail "${label} is not a valid Stellar contract ID: ${value}"
  fi
}

estimate_transaction_fee_stroops() {
  local transaction_xdr="$1"
  local simulated_xdr
  local decoded_transaction

  [[ -n "${transaction_xdr}" ]] || return 1

  simulated_xdr="$(
    stellar -q tx simulate \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      "${transaction_xdr}" 2>/dev/null | tail -n 1
  )" || return 1

  [[ -n "${simulated_xdr}" ]] || return 1

  decoded_transaction="$(stellar tx decode --output json-formatted "${simulated_xdr}" 2>/dev/null)" || return 1
  printf "%s\n" "${decoded_transaction}" | sed -n 's/^[[:space:]]*"fee":[[:space:]]*\([0-9][0-9]*\),[[:space:]]*$/\1/p' | head -n 1
}

estimate_upload_fee_stroops() {
  local wasm_path="$1"
  local transaction_xdr

  transaction_xdr="$(
    stellar -q contract upload \
      --wasm "${wasm_path}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --build-only 2>/dev/null | tail -n 1
  )" || return 1

  [[ -n "${transaction_xdr}" ]] || return 1

  estimate_transaction_fee_stroops "${transaction_xdr}"
}

estimate_invoke_fee_stroops() {
  local contract_id="$1"
  local method="$2"
  local transaction_xdr
  shift 2

  transaction_xdr="$(
    stellar -q contract invoke \
      --id "${contract_id}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --build-only \
      -- \
      "${method}" \
      "$@" 2>/dev/null | tail -n 1
  )" || return 1

  [[ -n "${transaction_xdr}" ]] || return 1

  estimate_transaction_fee_stroops "${transaction_xdr}"
}

print_upload_fee_estimate() {
  local label="$1"
  local wasm_path="$2"
  local fee_stroops
  local fee_xlm

  if ! fee_stroops="$(estimate_upload_fee_stroops "${wasm_path}")" || [[ -z "${fee_stroops}" ]]; then
    printf "  %s WASM upload fee estimate: unavailable. Stellar CLI simulation did not return a fee.\n" "${label}"
    return 0
  fi

  fee_xlm="$(format_stroops_as_xlm "${fee_stroops}")"
  printf "  %s WASM upload fee estimate: %s stroops (%s XLM)\n" "${label}" "${fee_stroops}" "${fee_xlm}"
}

print_invoke_fee_estimate() {
  local contract_id="$1"
  local method="$2"
  local fee_stroops
  local fee_xlm
  shift 2

  if ! fee_stroops="$(estimate_invoke_fee_stroops "${contract_id}" "${method}" "$@")" || [[ -z "${fee_stroops}" ]]; then
    printf "  %s invocation fee estimate: unavailable. Stellar CLI simulation did not return a fee.\n" "${method}"
    return 0
  fi

  fee_xlm="$(format_stroops_as_xlm "${fee_stroops}")"
  printf "  %s invocation fee estimate: %s stroops (%s XLM)\n" "${method}" "${fee_stroops}" "${fee_xlm}"
}

wasm_hash_for_path() {
  local wasm_path="$1"
  sha256sum "${wasm_path}" | sed -n 's/^\([0-9a-fA-F]\{64\}\)[[:space:]].*$/\1/p' | head -n 1
}

deployment_salt() {
  local label="$1"
  local wasm_hash="$2"
  printf "%s:%s:%s:%s" "${NETWORK}" "${ARTIFACT_NAME}" "${label}" "${wasm_hash}" | sha256sum | sed -n 's/^\([0-9a-fA-F]\{64\}\)[[:space:]].*$/\1/p' | head -n 1
}

assert_deploy_salt() {
  local salt="$1"
  local label="$2"

  [[ "${salt}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "${label} must be a 32-byte hex salt."
}

is_timeout_error() {
  local stderr_path="$1"
  grep -qi "transaction submission timeout" "${stderr_path}"
}

wasm_is_uploaded() {
  local wasm_hash="$1"
  local fetch_out_path

  fetch_out_path="$(mktemp)"
  if stellar contract fetch \
    --wasm-hash "${wasm_hash}" \
    --out-file "${fetch_out_path}" \
    --network "${NETWORK}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" >/dev/null 2>&1; then
    rm -f "${fetch_out_path}"
    return 0
  fi

  rm -f "${fetch_out_path}"
  return 1
}

contract_exists() {
  local contract_id="$1"
  local fetch_out_path

  fetch_out_path="$(mktemp)"
  if stellar contract fetch \
    --id "${contract_id}" \
    --out-file "${fetch_out_path}" \
    --network "${NETWORK}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" >/dev/null 2>&1; then
    rm -f "${fetch_out_path}"
    return 0
  fi

  rm -f "${fetch_out_path}"
  return 1
}

wait_for_wasm_upload() {
  local wasm_hash="$1"
  local attempts="${CONTRACT_DEPLOY_TIMEOUT_CHECK_ATTEMPTS:-6}"
  local delay_seconds="${CONTRACT_DEPLOY_TIMEOUT_CHECK_DELAY_SECONDS:-5}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if wasm_is_uploaded "${wasm_hash}"; then
      return 0
    fi
    sleep "${delay_seconds}"
  done

  return 1
}

wait_for_contract() {
  local contract_id="$1"
  local attempts="${CONTRACT_DEPLOY_TIMEOUT_CHECK_ATTEMPTS:-6}"
  local delay_seconds="${CONTRACT_DEPLOY_TIMEOUT_CHECK_DELAY_SECONDS:-5}"
  local attempt

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if contract_exists "${contract_id}"; then
      return 0
    fi
    sleep "${delay_seconds}"
  done

  return 1
}

wait_for_contract_bool() {
  local contract_id="$1"
  local method="$2"
  local attempts="${CONTRACT_DEPLOY_TIMEOUT_CHECK_ATTEMPTS:-6}"
  local delay_seconds="${CONTRACT_DEPLOY_TIMEOUT_CHECK_DELAY_SECONDS:-5}"
  local attempt
  shift 2

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    if [[ "$(normalize_output "$(view_contract "${contract_id}" "${method}" "$@")")" == "true" ]]; then
      return 0
    fi
    sleep "${delay_seconds}"
  done

  return 1
}

contract_id_for_salt() {
  local salt="$1"

  stellar -q contract id wasm \
    --source "${DEPLOYER}" \
    --salt "${salt}" \
    --network "${NETWORK}" \
    --network-passphrase "${NETWORK_PASSPHRASE}" | tail -n 1
}

upload_contract_wasm() {
  local label="$1"
  local wasm_path="$2"
  local wasm_hash
  local upload_stderr_path
  local upload_stdout

  wasm_hash="$(wasm_hash_for_path "${wasm_path}")"
  [[ "${wasm_hash}" =~ ^[0-9a-fA-F]{64}$ ]] || fail "Unable to compute ${label} WASM hash."

  if wasm_is_uploaded "${wasm_hash}"; then
    printf "%s WASM is already uploaded; reusing hash %s.\n" "${label}" "${wasm_hash}" >&2
    printf "%s" "${wasm_hash}"
    return 0
  fi

  upload_stderr_path="$(mktemp)"

  if upload_stdout="$(
    stellar contract upload \
      --wasm "${wasm_path}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" 2>"${upload_stderr_path}"
  )"; then
    cat "${upload_stderr_path}" >&2
    rm -f "${upload_stderr_path}"
    upload_stdout="$(normalize_hex "${upload_stdout}")"
    if [[ "${upload_stdout}" =~ ^[0-9a-f]{64}$ ]]; then
      printf "%s" "${upload_stdout}"
    else
      printf "%s" "${wasm_hash}"
    fi
    return 0
  fi

  cat "${upload_stderr_path}" >&2

  if grep -q "TxInsufficientBalance" "${upload_stderr_path}"; then
    printf "\nInsufficient balance while uploading %s WASM.\n" "${label}" >&2
    printf "Estimated transaction cost for the current WASM upload:\n" >&2
    print_upload_fee_estimate "${label}" "${wasm_path}" >&2
  fi

  if is_timeout_error "${upload_stderr_path}"; then
    printf "\n%s WASM upload timed out after submission; checking whether hash %s reached the ledger...\n" "${label}" "${wasm_hash}" >&2
    if wait_for_wasm_upload "${wasm_hash}"; then
      printf "%s WASM upload was found on ledger; continuing with hash %s.\n" "${label}" "${wasm_hash}" >&2
      rm -f "${upload_stderr_path}"
      printf "%s" "${wasm_hash}"
      return 0
    fi

    printf "%s WASM upload was not found after the timeout check window. Re-run the same command; the script will reuse the upload if it appears later.\n" "${label}" >&2
  fi

  rm -f "${upload_stderr_path}"
  fail "${label} WASM upload failed."
}

deploy_uploaded_contract() {
  local label="$1"
  local wasm_hash="$2"
  local salt="$3"
  local expected_contract_id
  local deploy_stderr_path
  local deploy_stdout

  expected_contract_id="$(normalize_output "$(contract_id_for_salt "${salt}")")"
  assert_is_contract_id "${expected_contract_id}" "${label} contract ID derived from salt"

  if contract_exists "${expected_contract_id}"; then
    printf "%s already exists for salt %s; reusing %s.\n" "${label}" "${salt}" "${expected_contract_id}" >&2
    printf "%s" "${expected_contract_id}"
    return 0
  fi

  deploy_stderr_path="$(mktemp)"

  if deploy_stdout="$(
    stellar contract deploy \
      --wasm-hash "${wasm_hash}" \
      --salt "${salt}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" 2>"${deploy_stderr_path}"
  )"; then
    cat "${deploy_stderr_path}" >&2
    rm -f "${deploy_stderr_path}"
    deploy_stdout="$(normalize_output "${deploy_stdout}")"
    if [[ -n "${deploy_stdout}" ]]; then
      printf "%s" "${deploy_stdout}"
    else
      printf "%s" "${expected_contract_id}"
    fi
    return 0
  fi

  cat "${deploy_stderr_path}" >&2

  if is_timeout_error "${deploy_stderr_path}"; then
    printf "\n%s deployment timed out after submission; checking whether contract %s reached the ledger...\n" "${label}" "${expected_contract_id}" >&2
    if wait_for_contract "${expected_contract_id}"; then
      printf "%s deployment was found on ledger; continuing with %s.\n" "${label}" "${expected_contract_id}" >&2
      rm -f "${deploy_stderr_path}"
      printf "%s" "${expected_contract_id}"
      return 0
    fi

    printf "%s was not found after the timeout check window. Re-run the same command; the deterministic salt will resume if it appears later.\n" "${label}" >&2
  fi

  rm -f "${deploy_stderr_path}"
  fail "${label} deployment failed."
}

invoke_contract() {
  local contract_id="$1"
  local method="$2"
  local invoke_stderr_path
  local invoke_stdout
  shift 2

  invoke_stderr_path="$(mktemp)"

  if invoke_stdout="$(
    stellar contract invoke \
      --id "${contract_id}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      -- \
      "${method}" \
      "$@" 2>"${invoke_stderr_path}"
  )"; then
    cat "${invoke_stderr_path}" >&2
    rm -f "${invoke_stderr_path}"
    printf "%s" "${invoke_stdout}"
    return 0
  fi

  cat "${invoke_stderr_path}" >&2

  if grep -q "TxInsufficientBalance" "${invoke_stderr_path}"; then
    printf "\nInsufficient balance while invoking %s on %s.\n" "${method}" "${contract_id}" >&2
    printf "Estimated transaction cost for this invocation:\n" >&2
    print_invoke_fee_estimate "${contract_id}" "${method}" "$@" >&2
  fi

  rm -f "${invoke_stderr_path}"
  fail "Contract invocation failed: ${method}."
}

invoke_contract_with_bool_check() {
  local contract_id="$1"
  local method="$2"
  local check_method="$3"
  local success_message="$4"
  local failure_message="$5"
  local invoke_stderr_path
  local invoke_stdout
  shift 5

  invoke_stderr_path="$(mktemp)"

  if invoke_stdout="$(
    stellar contract invoke \
      --id "${contract_id}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      -- \
      "${method}" \
      "$@" 2>"${invoke_stderr_path}"
  )"; then
    cat "${invoke_stderr_path}" >&2
    rm -f "${invoke_stderr_path}"
    printf "%s" "${invoke_stdout}"
    return 0
  fi

  cat "${invoke_stderr_path}" >&2

  if grep -q "TxInsufficientBalance" "${invoke_stderr_path}"; then
    printf "\nInsufficient balance while invoking %s on %s.\n" "${method}" "${contract_id}" >&2
    printf "Estimated transaction cost for this invocation:\n" >&2
    print_invoke_fee_estimate "${contract_id}" "${method}" "$@" >&2
  fi

  if is_timeout_error "${invoke_stderr_path}"; then
    printf "\n%s timed out after submission; checking whether the contract state changed...\n" "${method}" >&2
    if wait_for_contract_bool "${contract_id}" "${check_method}"; then
      printf "%s\n" "${success_message}" >&2
      rm -f "${invoke_stderr_path}"
      return 0
    fi

    printf "%s\n" "${failure_message}" >&2
  fi

  rm -f "${invoke_stderr_path}"
  fail "Contract invocation failed: ${method}."
}

view_contract() {
  local contract_id="$1"
  local method="$2"
  local view_stderr_path
  local view_stdout
  shift 2

  view_stderr_path="$(mktemp)"

  if view_stdout="$(
    stellar contract invoke \
      --id "${contract_id}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      --send no \
      -- \
      "${method}" \
      "$@" 2>"${view_stderr_path}"
  )"; then
    cat "${view_stderr_path}" >&2
    rm -f "${view_stderr_path}"
    printf "%s" "${view_stdout}"
    return 0
  fi

  cat "${view_stderr_path}" >&2
  rm -f "${view_stderr_path}"
  fail "Contract view failed: ${method}."
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

verify_contract_wiring() {
  local reputation_id="$1"
  local escrow_id="$2"

  local authorized_escrow
  authorized_escrow="$(normalize_output "$(view_contract "${reputation_id}" get_authorized_escrow_contract)")"

  local linked_reputation
  linked_reputation="$(normalize_output "$(view_contract "${escrow_id}" get_reputation_contract)")"

  local linked_platform_admin
  linked_platform_admin="$(normalize_output "$(view_contract "${escrow_id}" get_platform_admin)")"

  local next_escrow_id
  next_escrow_id="$(normalize_output "$(view_contract "${escrow_id}" get_next_escrow_id)")"

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

allow_asset_if_configured() {
  local escrow_id="$1"
  local asset_id="$2"
  local label="$3"

  if [[ -z "${asset_id}" ]]; then
    printf "%s is not configured; skipping allowlist.\n" "${label}"
    return 0
  fi

  assert_is_contract_id "${asset_id}" "${label}"

  printf "Allowlisting %s...\n" "${label}"
  if [[ "$(normalize_output "$(view_contract "${escrow_id}" is_allowed_asset --asset "${asset_id}")")" == "true" ]]; then
    printf "%s is already allowlisted; skipping allowlist transaction.\n" "${label}"
    return 0
  fi

  local allow_stderr_path
  local allow_stdout
  allow_stderr_path="$(mktemp)"

  if allow_stdout="$(
    stellar contract invoke \
      --id "${escrow_id}" \
      --source "${DEPLOYER}" \
      --network "${NETWORK}" \
      --network-passphrase "${NETWORK_PASSPHRASE}" \
      -- \
      add_allowed_asset \
      --platform_admin "${PLATFORM_ADMIN}" \
      --asset "${asset_id}" 2>"${allow_stderr_path}"
  )"; then
    cat "${allow_stderr_path}" >&2
    rm -f "${allow_stderr_path}"
    printf "%s" "${allow_stdout}" >/dev/null
  else
    cat "${allow_stderr_path}" >&2

    if grep -q "TxInsufficientBalance" "${allow_stderr_path}"; then
      printf "\nInsufficient balance while allowlisting %s on %s.\n" "${label}" "${escrow_id}" >&2
      printf "Estimated transaction cost for this invocation:\n" >&2
      print_invoke_fee_estimate "${escrow_id}" add_allowed_asset --platform_admin "${PLATFORM_ADMIN}" --asset "${asset_id}" >&2
    fi

    if is_timeout_error "${allow_stderr_path}"; then
      printf "\nadd_allowed_asset timed out after submission; checking whether %s was allowlisted...\n" "${label}" >&2
      if wait_for_contract_bool "${escrow_id}" is_allowed_asset --asset "${asset_id}"; then
        printf "%s allowlist transaction was found on ledger; continuing.\n" "${label}" >&2
        rm -f "${allow_stderr_path}"
      else
        printf "%s was not allowlisted after the timeout check. Re-run the same command to retry this step.\n" "${label}" >&2
        rm -f "${allow_stderr_path}"
        fail "Contract invocation failed: add_allowed_asset."
      fi
    else
      rm -f "${allow_stderr_path}"
      fail "Contract invocation failed: add_allowed_asset."
    fi
  fi

  local allowed
  allowed="$(normalize_output "$(view_contract "${escrow_id}" is_allowed_asset --asset "${asset_id}")")"
  [[ "${allowed}" == "true" ]] || fail "Verification failed: ${label} was not allowlisted."
}

write_artifact() {
  local reputation_id="$1"
  local escrow_id="$2"
  local deployer_address="$3"

  mkdir -p "${DEPLOYMENTS_DIR}"

  cat >"${ARTIFACT_PATH}" <<EOF
{
  "network": "${NETWORK}",
  "networkPassphrase": "${NETWORK_PASSPHRASE}",
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
  require_command grep
  require_command mktemp
  require_command rm
  require_command sed
  require_command sha256sum
  require_command sleep
  require_command tail

  [[ "${NETWORK}" =~ ^(testnet|mainnet)$ ]] || fail "NETWORK must be testnet or mainnet."
  [[ "${NETWORK_PASSPHRASE}" == "$(network_passphrase)" ]] || fail "STELLAR_NETWORK_PASSPHRASE does not match ${NETWORK}."
  [[ -n "${RPC_URL}" ]] || fail "Missing STELLAR_RPC_URL or NEXT_PUBLIC_STELLAR_RPC_URL."
  [[ -n "${HORIZON_URL}" ]] || fail "Missing STELLAR_HORIZON_URL or NEXT_PUBLIC_STELLAR_HORIZON_URL."
  [[ -n "${DEPLOYER}" ]] || fail "Missing DEPLOYER. Usage: DEPLOYER=<identity> PLATFORM_ADMIN=<G...> bash scripts/deploy-${NETWORK}.sh"
  [[ -n "${PLATFORM_ADMIN}" ]] || fail "Missing PLATFORM_ADMIN and no fallback available."
  [[ "${PLATFORM_ADMIN}" =~ ^G[A-Z2-7]{55}$ ]] || fail "PLATFORM_ADMIN must be a valid Stellar public key (G...)."
  [[ -d "${CONTRACTS_DIR}" ]] || fail "Contracts directory not found at ${CONTRACTS_DIR}."

  assert_identity_exists "${DEPLOYER}"

  local deployer_address
  deployer_address="$(stellar keys address "${DEPLOYER}")"
  deployer_address="$(normalize_output "${deployer_address}")"
  assert_account_exists_on_network "${deployer_address}"

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

  printf "Estimating deployment upload costs...\n"
  print_upload_fee_estimate "ReputationContract" "${reputation_wasm}"
  print_upload_fee_estimate "EscrowContract" "${escrow_wasm}"

  printf "Deploying ReputationContract...\n"
  local reputation_wasm_hash
  reputation_wasm_hash="$(upload_contract_wasm "ReputationContract" "${reputation_wasm}")"
  local reputation_salt
  reputation_salt="${REPUTATION_DEPLOY_SALT:-$(deployment_salt "ReputationContract" "${reputation_wasm_hash}")}"
  assert_deploy_salt "${reputation_salt}" "REPUTATION_DEPLOY_SALT"
  local reputation_contract_id
  reputation_contract_id="$(deploy_uploaded_contract "ReputationContract" "${reputation_wasm_hash}" "${reputation_salt}")"
  assert_is_contract_id "${reputation_contract_id}" "Reputation contract ID"

  printf "Deploying EscrowContract...\n"
  local escrow_wasm_hash
  escrow_wasm_hash="$(upload_contract_wasm "EscrowContract" "${escrow_wasm}")"
  local escrow_salt
  escrow_salt="${ESCROW_DEPLOY_SALT:-$(deployment_salt "EscrowContract" "${escrow_wasm_hash}")}"
  assert_deploy_salt "${escrow_salt}" "ESCROW_DEPLOY_SALT"
  local escrow_contract_id
  escrow_contract_id="$(deploy_uploaded_contract "EscrowContract" "${escrow_wasm_hash}" "${escrow_salt}")"
  assert_is_contract_id "${escrow_contract_id}" "Escrow contract ID"

  if [[ "$(normalize_output "$(view_contract "${escrow_contract_id}" is_initialized)")" == "true" ]]; then
    printf "EscrowContract is already initialized; skipping initialization.\n"
  else
    printf "Initializing EscrowContract...\n"
    invoke_contract_with_bool_check \
      "${escrow_contract_id}" \
      initialize \
      is_initialized \
      "EscrowContract initialization was found on ledger; continuing." \
      "EscrowContract was not initialized after the timeout check. Re-run the same command to retry this step." \
      --reputation_contract_address "${reputation_contract_id}" \
      --platform_admin "${PLATFORM_ADMIN}" >/dev/null
  fi

  if [[ "$(normalize_output "$(view_contract "${reputation_contract_id}" is_initialized)")" == "true" ]]; then
    printf "ReputationContract is already initialized; skipping initialization.\n"
  else
    printf "Initializing ReputationContract...\n"
    invoke_contract_with_bool_check \
      "${reputation_contract_id}" \
      initialize \
      is_initialized \
      "ReputationContract initialization was found on ledger; continuing." \
      "ReputationContract was not initialized after the timeout check. Re-run the same command to retry this step." \
      --authorized_escrow_contract "${escrow_contract_id}" >/dev/null
  fi

  printf "Running deployment verification...\n"
  verify_contract_wiring "${reputation_contract_id}" "${escrow_contract_id}"
  allow_asset_if_configured "${escrow_contract_id}" "${STABLECOIN_TOKEN_CONTRACT_ID}" "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID"
  allow_asset_if_configured "${escrow_contract_id}" "${NATIVE_XLM_TOKEN_CONTRACT_ID}" "NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID"

  write_artifact "${reputation_contract_id}" "${escrow_contract_id}" "${deployer_address}"

  printf "\nDeployment complete:\n"
  printf "ReputationContract ID: %s\n" "${reputation_contract_id}"
  printf "EscrowContract ID: %s\n" "${escrow_contract_id}"
  printf "Deployment artifact: %s\n" "${ARTIFACT_PATH}"

  printf "\nAdd these to apps/web/.env.local:\n"
  printf "NEXT_PUBLIC_STELLAR_NETWORK=%s\n" "${NETWORK}"
  printf "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE=%s\n" "${NETWORK_PASSPHRASE}"
  printf "NEXT_PUBLIC_STELLAR_RPC_URL=%s\n" "${RPC_URL}"
  printf "NEXT_PUBLIC_STELLAR_HORIZON_URL=%s\n" "${HORIZON_URL}"
  printf "NEXT_PUBLIC_REPUTATION_CONTRACT_ID=%s\n" "${reputation_contract_id}"
  printf "NEXT_PUBLIC_ESCROW_CONTRACT_ID=%s\n" "${escrow_contract_id}"
  printf "NEXT_PUBLIC_STABLECOIN_TOKEN_CONTRACT_ID=%s\n" "${STABLECOIN_TOKEN_CONTRACT_ID}"
  printf "NEXT_PUBLIC_NATIVE_XLM_TOKEN_CONTRACT_ID=%s\n" "${NATIVE_XLM_TOKEN_CONTRACT_ID}"

  printf "\nAdd these to backend/Convex environment:\n"
  printf "STELLAR_NETWORK=%s\n" "${NETWORK}"
  printf "STELLAR_NETWORK_PASSPHRASE=%s\n" "${NETWORK_PASSPHRASE}"
  printf "STELLAR_RPC_URL=%s\n" "${RPC_URL}"
  printf "STELLAR_HORIZON_URL=%s\n" "${HORIZON_URL}"
  printf "REPUTATION_CONTRACT_ID=%s\n" "${reputation_contract_id}"
  printf "ESCROW_CONTRACT_ID=%s\n" "${escrow_contract_id}"
}

main "$@"
