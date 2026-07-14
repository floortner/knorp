# deploy/ — on-box provisioning & release scripts

These run on the beta EC2 box (provisioned by `../infra`). The GitHub Actions `api` job invokes
`release.sh` through SSM Run Command (no SSH). Everything is idempotent.

| File | Role |
|---|---|
| `release.sh` | On-box release: render env → build (on arm64) → `prisma migrate deploy` + seed → systemd unit + nginx + TLS → restart + health check. |
| `render-env.sh` | Pull `/blsb/beta/*` from SSM (with decryption) → root-only `/etc/blsb/env` systemd EnvironmentFile. |
| `blsb-api.service` | systemd unit for the API (User=blsb, EnvironmentFile=/etc/blsb/env). |
| `nginx-api.conf.template` | nginx site (HTTP form); `certbot --nginx` adds TLS on first run. |
| `backup.sh` + `blsb-backup.{service,timer}` | Daily `pg_dump` → `age`-encrypt → `rclone` to a non-AWS store. |

## How a deploy flows
1. `api` job (GitHub Actions): `tar` the backend + `deploy/` → `aws s3 cp` to the artifacts bucket →
   `aws ssm send-command` runs a 4-line bootstrap on the box that downloads + extracts the tarball and
   execs `deploy/release.sh` with `RELEASE=<sha>`.
2. `release.sh` does the rest and fails the command (non-zero) if the health check doesn't pass.

## First-deploy prerequisites (once)
- `infra` applied; `api.<domain>` A record resolves to the box (certbot needs this).
- Real secrets set in SSM (`infra/README.md` step 2); SES production access + verified domain (Terraform-managed DKIM).

## Backups (once)
`release.sh` already installs the root-owned backup script (`/usr/local/sbin/blsb-backup.sh`) and the
`blsb-backup.{service,timer}` units on every deploy — you only supply the config and enable the timer:
```bash
# age (static arm64 binary) and rclone
curl -fsSL https://github.com/FiloSottile/age/releases/latest/download/age-*-linux-arm64.tar.gz | tar xz
sudo install age/age age/age-keygen /usr/local/bin/
curl -fsSL https://rclone.org/install.sh | sudo bash

# generate the keypair OFF the box; put ONLY the public recipient on the box
age-keygen -o backup-key.txt          # keep this private key off-platform!
sudo tee /etc/blsb/backup.env >/dev/null <<'EOF'
AGE_RECIPIENT=age1...your_public_key
BACKUP_REMOTE=r2:blsb-backups
# HEALTHCHECK_URL=https://hc-ping.com/<uuid>   # recommended: alerts on a missed OR failed run
# PRUNE_MIN_AGE=35d                            # ONLY with a delete-capable token — prefer lifecycle rules
EOF
sudo chmod 600 /etc/blsb/backup.env
rclone config                         # add the "r2" (or b2) remote

sudo systemctl daemon-reload && sudo systemctl enable --now blsb-backup.timer
sudo systemctl start blsb-backup.service   # test run
```
**Make the backups survive an incident (security review P2-7):** use a **write-only** rclone token
(Backblaze B2 / Cloudflare R2 both support keys without delete) and do retention via the provider's
**object-lifecycle rules** — leave `PRUNE_MIN_AGE` unset. Then someone who roots the box can add backups
but cannot wipe the existing ones. Set `HEALTHCHECK_URL` so a missed/failed run pages you instead of
failing silently. Periodically run a **restore drill** (see the comment at the bottom of `backup.sh`) —
an untested backup is a hope, not a backup.

## Break-glass
`aws ssm start-session --target <instance_id>` — then `sudo journalctl -u blsb-api -f`, etc.
