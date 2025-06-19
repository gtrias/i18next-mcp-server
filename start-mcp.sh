#!/bin/bash

set -e

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Set environment variables if not already set
export I18N_PROJECT_ROOT="${I18N_PROJECT_ROOT:-/home/genar/src/galleries}"
export I18N_LOCALES_DIR="${I18N_LOCALES_DIR:-apps/client/public/locales}"
export I18N_LANGUAGES="${I18N_LANGUAGES:-en,es,ca}"
export I18N_NAMESPACES="${I18N_NAMESPACES:-translation,backoffice,landing,common,error}"
export I18N_DEFAULT_LANGUAGE="${I18N_DEFAULT_LANGUAGE:-en}"
export I18N_FALLBACK_LANGUAGE="${I18N_FALLBACK_LANGUAGE:-en}"
export NODE_ENV="${NODE_ENV:-development}"

# Log startup information
echo "Starting i18next MCP Server..." >&2
echo "Project root: $I18N_PROJECT_ROOT" >&2
echo "Locales dir: $I18N_LOCALES_DIR" >&2
echo "Languages: $I18N_LANGUAGES" >&2

# Check if we need to build
if [ ! -d "dist" ] || [ ! -f "dist/index.js" ]; then
    echo "Building TypeScript sources..." >&2
    npm run build >&2
fi

# Check if the built file exists
if [ ! -f "dist/index.js" ]; then
    echo "Error: dist/index.js not found after build" >&2
    exit 1
fi

# Start the MCP server
echo "Starting MCP server process..." >&2
exec node dist/index.js 