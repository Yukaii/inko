#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_FILE="${ZEABUR_TEMPLATE_FILE:-$ROOT_DIR/zeabur.yml}"

usage() {
  cat <<'EOF'
Usage:
  scripts/zeabur-deploy-template.sh [--services <service[,service...]> | --fzf] [options]

Options:
  --services <list>         Comma-separated Zeabur service names to keep
  --fzf                     Choose services interactively with fzf (multi-select)
  --env-file <path>         Load template variables from a dotenv-style file
  --project-id <id>         Zeabur project ID (or set ZEABUR_PROJECT_ID)
  --template <path>         Template file path (default: ./zeabur.yml)
  --var KEY=VALUE           Extra template variable, repeatable
  --skip-validation         Pass through to zeabur template deploy
  --dry-run                 Print filtered template and deploy command, do not deploy
  -h, --help                Show this help

Environment:
  ZEABUR_TOKEN              Optional; if set, the script runs zeabur auth login first
  ZEABUR_PROJECT_ID         Used when --project-id is omitted

Template variables can be supplied either as:
  API_DOMAIN=...
  ZEABUR_API_DOMAIN=...

Examples:
  scripts/zeabur-deploy-template.sh --services API
  scripts/zeabur-deploy-template.sh --fzf
  scripts/zeabur-deploy-template.sh --services API --env-file .env.zeabur
  scripts/zeabur-deploy-template.sh --services API,Frontend --skip-validation
  scripts/zeabur-deploy-template.sh --services API --var OBJECT_STORAGE_BUCKET=inko-media
EOF
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required tool: $1" >&2
    exit 1
  fi
}

require_tool ruby
require_tool jq
require_tool yq
require_tool npx

SERVICES_CSV=""
USE_FZF=false
ENV_FILE=""
PROJECT_ID="${ZEABUR_PROJECT_ID:-}"
SKIP_VALIDATION=false
DRY_RUN=false
EXTRA_VARS=()
VAR_KEYS=()
VAR_VALUES=()
ENV_FILE_VAR_KEYS=()
ENV_FILE_VAR_VALUES=()

set_var() {
  local key="$1"
  local value="$2"
  local i
  for i in "${!VAR_KEYS[@]}"; do
    if [[ "${VAR_KEYS[$i]}" == "$key" ]]; then
      VAR_VALUES[$i]="$value"
      return
    fi
  done
  VAR_KEYS+=("$key")
  VAR_VALUES+=("$value")
}

get_var() {
  local key="$1"
  local i
  for i in "${!VAR_KEYS[@]}"; do
    if [[ "${VAR_KEYS[$i]}" == "$key" ]]; then
      printf '%s' "${VAR_VALUES[$i]}"
      return 0
    fi
  done
  return 1
}

set_env_file_var() {
  local key="$1"
  local value="$2"
  local i
  for i in "${!ENV_FILE_VAR_KEYS[@]}"; do
    if [[ "${ENV_FILE_VAR_KEYS[$i]}" == "$key" ]]; then
      ENV_FILE_VAR_VALUES[$i]="$value"
      return
    fi
  done
  ENV_FILE_VAR_KEYS+=("$key")
  ENV_FILE_VAR_VALUES+=("$value")
}

get_env_file_var() {
  local key="$1"
  local i
  for i in "${!ENV_FILE_VAR_KEYS[@]}"; do
    if [[ "${ENV_FILE_VAR_KEYS[$i]}" == "$key" ]]; then
      printf '%s' "${ENV_FILE_VAR_VALUES[$i]}"
      return 0
    fi
  done
  return 1
}

trim_whitespace() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

strip_matching_quotes() {
  local value="$1"
  if [[ ${#value} -ge 2 ]]; then
    if [[ "${value:0:1}" == '"' && "${value: -1}" == '"' ]]; then
      printf '%s' "${value:1:${#value}-2}"
      return
    fi
    if [[ "${value:0:1}" == "'" && "${value: -1}" == "'" ]]; then
      printf '%s' "${value:1:${#value}-2}"
      return
    fi
  fi
  printf '%s' "$value"
}

load_env_file() {
  local path="$1"
  local line
  local lineno=0
  local key
  local value
  while IFS= read -r line || [[ -n "$line" ]]; do
    lineno=$((lineno + 1))
    line="$(trim_whitespace "$line")"
    [[ -z "$line" ]] && continue
    [[ "$line" == \#* ]] && continue
    line="${line#export }"
    if [[ "$line" != *=* ]]; then
      echo "Invalid line in env file $path:$lineno" >&2
      exit 1
    fi
    key="$(trim_whitespace "${line%%=*}")"
    value="$(trim_whitespace "${line#*=}")"
    if [[ -z "$key" ]]; then
      echo "Invalid key in env file $path:$lineno" >&2
      exit 1
    fi
    value="$(strip_matching_quotes "$value")"
    set_env_file_var "$key" "$value"
  done < "$path"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --services)
      SERVICES_CSV="${2:-}"
      shift 2
      ;;
    --fzf)
      USE_FZF=true
      shift
      ;;
    --env-file)
      ENV_FILE="${2:-}"
      shift 2
      ;;
    --project-id)
      PROJECT_ID="${2:-}"
      shift 2
      ;;
    --template)
      TEMPLATE_FILE="${2:-}"
      shift 2
      ;;
    --var)
      EXTRA_VARS+=("${2:-}")
      shift 2
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -n "$SERVICES_CSV" && "$USE_FZF" == true ]]; then
  echo "Use either --services or --fzf, not both" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "Template file not found: $TEMPLATE_FILE" >&2
  exit 1
fi

if [[ -n "$ENV_FILE" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "Env file not found: $ENV_FILE" >&2
    exit 1
  fi
  load_env_file "$ENV_FILE"
fi

AVAILABLE_SERVICES=()
while IFS= read -r service_name; do
  [[ -n "$service_name" ]] && AVAILABLE_SERVICES+=("$service_name")
done < <(yq eval '.spec.services[].name' "$TEMPLATE_FILE")

if [[ "$USE_FZF" == true ]]; then
  require_tool fzf
  FZF_SELECTION="$(
    printf '%s\n' "${AVAILABLE_SERVICES[@]}" | \
      fzf --multi --height=40% --border --prompt='Deploy services > ' --header='Tab marks, Enter confirms'
  )" || {
    echo "Service selection cancelled" >&2
    exit 1
  }
  SERVICES_CSV="$(printf '%s' "$FZF_SELECTION" | paste -sd, -)"
fi

if [[ -z "$SERVICES_CSV" ]]; then
  echo "Either --services or --fzf is required" >&2
  usage >&2
  exit 1
fi

IFS=',' read -r -a SELECTED_SERVICES <<< "$SERVICES_CSV"
if [[ ${#SELECTED_SERVICES[@]} -eq 0 ]]; then
  echo "No services selected" >&2
  exit 1
fi

for i in "${!SELECTED_SERVICES[@]}"; do
  SELECTED_SERVICES[$i]="$(echo "${SELECTED_SERVICES[$i]}" | xargs)"
done

for service in "${SELECTED_SERVICES[@]}"; do
  found=false
  for available in "${AVAILABLE_SERVICES[@]}"; do
    if [[ "$service" == "$available" ]]; then
      found=true
      break
    fi
  done
  if [[ "$found" != true ]]; then
    echo "Unknown service: $service" >&2
    echo "Available services: ${AVAILABLE_SERVICES[*]}" >&2
    exit 1
  fi
done

TMP_TEMPLATE="$(mktemp "${TMPDIR:-/tmp}/zeabur-template.XXXXXX")"
cleanup() {
  rm -f "$TMP_TEMPLATE"
}
trap cleanup EXIT

SELECTED_JSON="$(printf '%s\n' "${SELECTED_SERVICES[@]}" | jq -R . | jq -s .)"

EXPLICIT_VAR_JSON='[]'
if [[ ${#EXTRA_VARS[@]} -gt 0 ]]; then
  EXPLICIT_VAR_JSON="$(printf '%s\n' "${EXTRA_VARS[@]}" | sed 's/=.*$//' | jq -R . | jq -s .)"
fi

ruby -r yaml -r json -r set -e '
template_path = ARGV[0]
output_path = ARGV[1]
selected = Set.new(JSON.parse(ARGV[2]))
explicit_vars = Set.new(JSON.parse(ARGV[3]))

doc = YAML.load_file(template_path)
services = Array(doc.dig("spec", "services"))
kept = services.select { |svc| selected.include?(svc["name"]) }

if kept.empty?
  abort("No matching services after filtering")
end

kept.each do |svc|
  deps = Array(svc["dependencies"])
  svc["dependencies"] = deps.select { |dep| selected.include?(dep) }
end

needed_vars = Set.new(explicit_vars)

walker = lambda do |value|
  case value
  when String
    value.scan(/\$\{([A-Z0-9_]+)\}/) { |match| needed_vars << match.first }
  when Array
    value.each { |item| walker.call(item) }
  when Hash
    value.each_value { |item| walker.call(item) }
  end
end

kept.each do |svc|
  needed_vars << svc["domainKey"] if svc["domainKey"]
  walker.call(svc["spec"])
end

variables = Array(doc.dig("spec", "variables"))
doc["spec"]["variables"] = variables.select { |entry| needed_vars.include?(entry["key"]) }
doc["spec"]["services"] = kept

File.write(output_path, YAML.dump(doc))
' "$TEMPLATE_FILE" "$TMP_TEMPLATE" "$SELECTED_JSON" "$EXPLICIT_VAR_JSON"

if [[ -z "$PROJECT_ID" && "$DRY_RUN" != true ]]; then
  echo "Missing project ID. Use --project-id or ZEABUR_PROJECT_ID." >&2
  exit 1
fi

if [[ ${#EXTRA_VARS[@]:-0} -gt 0 ]]; then
  for pair in "${EXTRA_VARS[@]}"; do
    key="${pair%%=*}"
    value="${pair#*=}"
    if [[ -z "$key" || "$key" == "$value" ]]; then
      echo "Invalid --var value: $pair" >&2
      exit 1
    fi
    set_var "$key" "$value"
  done
fi

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  if value="$(get_var "$key" 2>/dev/null)"; then
    continue
  fi
  if [[ -n "${!key:-}" ]]; then
    set_var "$key" "${!key}"
    continue
  fi
  prefixed="ZEABUR_${key}"
  if [[ -n "${!prefixed:-}" ]]; then
    set_var "$key" "${!prefixed}"
    continue
  fi
  if value="$(get_env_file_var "$key" 2>/dev/null)"; then
    set_var "$key" "$value"
    continue
  fi
  if value="$(get_env_file_var "$prefixed" 2>/dev/null)"; then
    set_var "$key" "$value"
  fi
done < <(yq eval '.spec.variables[].key' "$TMP_TEMPLATE")

MISSING_VARS=()
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  if ! get_var "$key" >/dev/null 2>&1; then
    MISSING_VARS+=("$key")
  fi
done < <(yq eval '.spec.variables[].key' "$TMP_TEMPLATE")

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
  echo "Missing template variables for selected services: ${MISSING_VARS[*]}" >&2
  echo "Set them as KEY=value, ZEABUR_KEY=value, or pass --var KEY=value." >&2
  exit 1
fi

DEPLOY_CMD=(
  npx -y zeabur@latest template deploy
  -i=false
  --file "$TMP_TEMPLATE"
)

if [[ -n "$PROJECT_ID" ]]; then
  DEPLOY_CMD+=(--project-id "$PROJECT_ID")
fi

if [[ "$SKIP_VALIDATION" == true ]]; then
  DEPLOY_CMD+=(--skip-validation)
fi

while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  DEPLOY_CMD+=(--var "$key=$(get_var "$key")")
done < <(yq eval '.spec.variables[].key' "$TMP_TEMPLATE")

echo "Selected services: ${SELECTED_SERVICES[*]}"
echo "Filtered template: $TMP_TEMPLATE"
echo "Resolved template variables:"
while IFS= read -r key; do
  [[ -z "$key" ]] && continue
  echo "  $key=$(get_var "$key")"
done < <(yq eval '.spec.variables[].key' "$TMP_TEMPLATE")

if [[ "$DRY_RUN" == true ]]; then
  echo
  echo "Dry run only. Filtered template contents:"
  cat "$TMP_TEMPLATE"
  echo
  echo "Deploy command:"
  printf '%q ' "${DEPLOY_CMD[@]}"
  echo
  exit 0
fi

if [[ -n "${ZEABUR_TOKEN:-}" ]]; then
  npx -y zeabur@latest auth login --token "$ZEABUR_TOKEN" -i=false >/dev/null
fi

"${DEPLOY_CMD[@]}"
