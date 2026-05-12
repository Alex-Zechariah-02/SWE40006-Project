#!/usr/bin/env bash
# scripts/verify/monitoring.sh
# Verifies that the Level 2 observability stack is healthy on the production server.
# Run this on the production EC2 host after the monitoring stack is deployed.

set -euo pipefail

PASS=0
FAIL=0

check() {
  local label="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== Level 2 Monitoring Verification ==="
echo ""

echo "-- Host exporter --"
check "node_exporter service is active" "systemctl is-active --quiet node-exporter"
check "node_exporter metrics endpoint responds" "curl -fsSL http://127.0.0.1:9100/metrics"

echo ""
echo "-- Monitoring containers --"
check "Prometheus container is running" "docker ps --filter 'name=balance-prometheus' --filter 'status=running' | grep -q balance-prometheus"
check "Grafana container is running"    "docker ps --filter 'name=balance-grafana' --filter 'status=running' | grep -q balance-grafana"
check "cAdvisor container is running"  "docker ps --filter 'name=balance-cadvisor' --filter 'status=running' | grep -q balance-cadvisor"

echo ""
echo "-- Prometheus --"
check "Prometheus health endpoint responds"   "curl -fsSL http://127.0.0.1:9090/-/healthy"
check "Prometheus targets endpoint responds"  "curl -fsSL http://127.0.0.1:9090/api/v1/targets"
check "cAdvisor metrics reachable internally" "docker exec balance-prometheus wget -qO- http://cadvisor:8080/metrics | head -1"

echo ""
echo "-- Grafana --"
check "Grafana login page responds on port 3002" "curl -fsSL http://127.0.0.1:3002/login"

echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "One or more checks failed. Review the output above."
  exit 1
else
  echo "All checks passed. Level 2 monitoring stack is healthy."
fi
