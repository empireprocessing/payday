#!/usr/bin/env bash

set -euo pipefail

# Find all .env.example files in apps/ and packages/
find ./apps ./packages -type f -name ".env.example" | while read -r example_file; do
  env_file="${example_file%".env.example"}.env"
  echo "Generating $env_file from $example_file"

  # Create/overwrite the .env file
  > "$env_file"

  # Read each line in the .env.example
  while IFS= read -r line || [[ -n "$line" ]]; do
    # If the line is a comment or blank, copy as-is
    if [[ "$line" =~ ^[[:space:]]*# ]] || [[ -z "$line" ]]; then
      echo "$line" >> "$env_file"
      continue
    fi

    # Extract the variable name (before '=')
    var_name=$(echo "$line" | sed -E 's/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/\1/')
    # Get the value from the environment, or fallback to empty
    var_value="${!var_name:-}"

    # If the env var is set, use it; else, use the value from .env.example
    if [[ -n "$var_value" ]]; then
      echo "$var_name=$var_value" >> "$env_file"
    else
      echo "$line" >> "$env_file"
    fi
  done < "$example_file"
done

echo "All .env files generated."