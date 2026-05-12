# Level 2 Credit - Deployment Instructions

See README.md for what was added. Run these steps on the production EC2 after merging to main.

## Step 1 - Install node_exporter
```bash
chmod +x infra/monitoring/exporters/install-node-exporter.sh
bash infra/monitoring/exporters/install-node-exporter.sh
```

## Step 2 - Add GitHub secret
Add `GRAFANA_ADMIN_PASSWORD` to the production environment in GitHub secrets.

## Step 3 - Start monitoring stack
```bash
docker compose -f infra/compose/compose.production.yml up -d prometheus grafana cadvisor
```

## Step 4 - Open TCP 3002 temporarily
AWS console → EC2 → Security Groups → production → add TCP 3002 restricted to your IP only.

## Step 5 - Verify
```bash
bash scripts/verify/monitoring.sh
```

## Step 6 - Take evidence screenshots
1. `systemctl status node-exporter`
2. `docker ps` showing all 3 monitoring containers
3. Prometheus /targets page — all UP
4. Grafana host overview dashboard with data
5. Grafana containers overview dashboard with data

## Step 7 - Remove TCP 3002 rule
Delete the inbound rule after screenshots are done.
