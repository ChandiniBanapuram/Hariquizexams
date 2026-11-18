#!/usr/bin/env bash
# =============================================================================
# build-docker-runtimes.sh
# Builds all AI/ML exam sandbox Docker images.
#
# Usage:
#   chmod +x build-docker-runtimes.sh
#   ./build-docker-runtimes.sh
# =============================================================================

set -e
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Building AI/ML Exam Sandbox Runtime Images"
echo "════════════════════════════════════════════════════════"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOCKER_DIR="${SCRIPT_DIR}/docker"

build_image() {
  local NAME=$1
  local CONTEXT="${DOCKER_DIR}/${NAME}"
  echo "▶ Building exam-${NAME}:latest ..."
  docker build -t "exam-${NAME}:latest" "${CONTEXT}"
  echo "✓ exam-${NAME}:latest built"
  echo ""
}

build_image "c-runtime"
build_image "cpp-runtime"
build_image "java-runtime"
build_image "python-runtime"
build_image "ml-runtime"
build_image "cvpr-runtime"
build_image "rl-runtime"

echo "════════════════════════════════════════════════════════"
echo "  All runtime images built successfully! ✓"
echo ""
echo "  Available images:"
docker images | grep "exam-" | awk '{printf "  %-40s %s\n", $1":"$2, $7}'
echo ""
echo "  To use Docker execution, set in backend/.env:"
echo "  EXECUTION_STRATEGY=docker"
echo "════════════════════════════════════════════════════════"
