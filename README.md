# Level 2 Credit - Deployment Instructions

## What was added

This branch adds the Level 2 observability stack on top of the Level 1 foundation:

| File | Purpose |
|---|---|
| `infra/monitoring/prometheus/prometheus.yml` | Prometheus scrape config (3 targets) |
| `infra/monitoring/grafana/provisioning/datasources/prometheus.yml` | Auto-provisions Prometheus as Grafana datasource |
| `infra/monitoring/grafana/provisioning/dashboards/dashboards.yml` | Auto-loads dashboards from repo |
| `infra/monitoring/grafana/dashboards/host-overview.json` | Host CPU / RAM / disk / network / uptime dashboard |
| `infra/monitoring/grafana/dashboards/containers-overview.json` | Per-container CPU / memory / network dashboard |
| `infra/monitoring/exporters/node-exporter.service` | systemd unit for node_exporter |
| `infra/monitoring/exporters/install-node-exporter.sh` | One-shot install script for production EC2 |
| `infra/monitoring/exporters/cadvisor.md` | Notes on cAdvisor setup |
| `infra/compose/compose.production.yml` | Updated with prometheus, grafana, cadvisor services |
| `scripts/verify/monitoring.sh` | Verification script to confirm all services are healthy |

---

## Deployment steps (run on the production EC2)

### Step 1 - Pull the latest repo onto the production server

```bash
cd /opt/swe40006-project
git pull origin main
```

### Step 2 - Install node_exporter as a host service

node_exporter MUST run as a native host service, not a container.

```bash
chmod +x infra/monitoring/exporters/install-node-exporter.sh
bash infra/monitoring/exporters/install-node-exporter.sh
```

Verify it worked:
```bash
sudo systemctl status node-exporter
curl http://127.0.0.1:9100/metrics | head -5
```

### Step 3 - Set the Grafana admin password on the server

```bash
export GRAFANA_ADMIN_PASSWORD="your-strong-password-here"
# Or add it to your .env file on the server (never commit the real value)
```

### Step 4 - Start the monitoring stack

```bash
docker compose -f infra/compose/compose.production.yml up -d prometheus grafana cadvisor
```

Verify all 3 containers are running:
```bash
docker ps
```

### Step 5 - Open TCP 3002 in the AWS security group (for Grafana access)

In the AWS console: EC2 > Security Groups > production group > Inbound rules
- Add TCP 3002, source = **Your IP only**
- Remove this rule after taking your evidence screenshots

### Step 6 - Verify everything is healthy

```bash
bash scripts/verify/monitoring.sh
```

### Step 7 - Take evidence screenshots

Open in your browser:
- `http://<PRODUCTION_IP>:3002` - Grafana login (admin / your password)
- `http://127.0.0.1:9090/targets` - Prometheus targets (all 3 must show UP)

Required screenshots:
1. `systemctl status node-exporter` output
2. `docker ps` showing prometheus, grafana, cadvisor
3. Prometheus /targets page - all UP
4. Grafana host overview dashboard with data
5. Grafana containers overview dashboard with data

### Step 8 - Remove the TCP 3002 security group rule

After screenshots are taken, remove the inbound rule for TCP 3002.

---

## Port reference

| Service | Port | Exposed to |
|---|---|---|
| node_exporter | 9100 | Host only (no security group rule needed) |
| Prometheus | 9090 | 127.0.0.1 only (loopback, not public) |
| cAdvisor | 8080 | Docker internal network only |
| Grafana | 3002 | Your IP only, temporarily, for evidence |
| Web app | 80 | Public (unchanged from Level 1) |
