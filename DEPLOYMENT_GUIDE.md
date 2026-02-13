# Raynet Deployment Guide — Oracle Cloud Free Tier

**Zero cost. Production-grade. Your brother points his MikroTik router to the public IP.**

---

# PART 1: ORACLE CLOUD SETUP (Web Console — 10 min)

## 1.1 Create Oracle Cloud Account

1. Go to https://cloud.oracle.com → Click **Sign Up**
2. Fill in email, name, country
3. Add credit card (for identity verification ONLY — you will NOT be charged)
4. Select **Home Region** → choose the one closest to your brother's location
   - India: **Mumbai** or **Hyderabad**
5. Wait 15-30 minutes for account provisioning

## 1.2 Create Virtual Cloud Network (VCN)

1. Go to **Networking → Virtual Cloud Networks**
2. Click **Start VCN Wizard → Create VCN with Internet Connectivity**
3. Name: `raynet-vcn`
4. Leave CIDR defaults (`10.0.0.0/16`)
5. Click **Next → Create**

## 1.3 Configure Firewall (Security List)

Go to **Networking → Virtual Cloud Networks → raynet-vcn → Public Subnet → Default Security List**

Click **Add Ingress Rules** and add these (SSH on port 22 is already there):

| Protocol | Source CIDR | Dest Port | Description |
|----------|-------------|-----------|-------------|
| TCP | 0.0.0.0/0 | 80 | HTTP |
| TCP | 0.0.0.0/0 | 443 | HTTPS |
| UDP | 0.0.0.0/0 | 1812 | RADIUS Auth |
| UDP | 0.0.0.0/0 | 1813 | RADIUS Accounting |
| UDP | 0.0.0.0/0 | 3799 | RADIUS CoA |

**Do NOT expose:** 5432 (PostgreSQL) or 6379 (Redis)

## 1.4 Create the ARM VM

1. Go to **Compute → Instances → Create Instance**
2. **Name:** `raynet-server`
3. **Image:** Ubuntu 22.04 (Canonical) — **ARM architecture** (Ampere)
4. **Shape:** VM.Standard.A1.Flex
   - OCPUs: **4**
   - Memory: **24 GB**
5. **Networking:** Select `raynet-vcn`, public subnet, assign public IPv4
6. **Boot Volume:** 50 GB (default, free)
7. **SSH Key:** Upload your public SSH key OR let OCI generate one (SAVE the private key!)
8. Click **Create**

**Note the Public IP** after creation — you need it for everything.

## 1.5 Reserve the Public IP (Persistent)

By default the IP changes on VM restart. Make it permanent:
1. Go to **Networking → Reserved Public IPs → Reserve Public IP**
2. Go to your VM → **Attached VNICs → Primary VNIC → IPv4 Addresses**
3. Click the three dots on the ephemeral IP → **Edit → Change to Reserved Public IP**
4. Select the reserved IP you created

---

# PART 2: SERVER SETUP (SSH — 20 min)

## 2.1 Connect to Your Server

```bash
ssh ubuntu@<YOUR_PUBLIC_IP>
```

If you downloaded OCI's generated key:
```bash
ssh -i /path/to/your-key.pem ubuntu@<YOUR_PUBLIC_IP>
```

## 2.2 System Updates + Swap

```bash
sudo apt update && sudo apt upgrade -y

# Add 2 GB swap (needed for next build memory spikes)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Set timezone
sudo timedatectl set-timezone Asia/Kolkata
```

## 2.3 Configure OS Firewall

OCI Ubuntu images block ports at the OS level even if the Security List allows them:

```bash
sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 1812 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 1813 -j ACCEPT
sudo iptables -I INPUT 1 -p udp --dport 3799 -j ACCEPT

sudo apt install -y iptables-persistent
sudo netfilter-persistent save
```

## 2.4 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu

# IMPORTANT: Log out and back in for group to take effect
exit
```

```bash
ssh ubuntu@<YOUR_PUBLIC_IP>
sudo apt install -y docker-compose-plugin
docker --version
```

## 2.5 Install Node.js 20 + Tools

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pnpm pm2 tsx

node --version    # Should show v20.x
pnpm --version
pm2 --version
```

## 2.6 Install FreeRADIUS

```bash
sudo apt install -y freeradius freeradius-postgresql freeradius-utils
sudo systemctl stop freeradius
sudo systemctl disable freeradius   # We'll enable after configuring
```

## 2.7 Install Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

# PART 3: START DATABASE + CACHE (5 min)

## 3.1 Create Production Docker Compose

```bash
sudo mkdir -p /opt/cloudradius
sudo chown ubuntu:ubuntu /opt/cloudradius
```

Generate a strong database password:
```bash
openssl rand -base64 24
# SAVE THIS — you'll need it in the app .env too
```

Create the Docker Compose file:
```bash
nano /opt/cloudradius/docker-compose.yml
```

Paste the content from the file `deploy/docker-compose.prod.yml` in this repo.

Create the Docker env file:
```bash
nano /opt/cloudradius/.env
```

```
POSTGRES_PASSWORD=<the-password-you-generated>
```

## 3.2 Start Containers

```bash
cd /opt/cloudradius
docker compose up -d

# Wait for healthy status
docker compose ps
# Both should show "healthy"
```

---

# PART 4: DEPLOY THE APP (15 min)

## 4.1 Clone the Repository

```bash
sudo mkdir -p /opt/cloudradius-app
sudo chown ubuntu:ubuntu /opt/cloudradius-app

git clone https://github.com/<YOUR_USERNAME>/Raynet.git /opt/cloudradius-app
cd /opt/cloudradius-app
```

## 4.2 Create Production Environment File

```bash
nano /opt/cloudradius-app/.env
```

```env
# Database
DATABASE_URL=postgresql://cloudradius:<YOUR_POSTGRES_PASSWORD>@localhost:5432/cloudradius

# Redis
REDIS_URL=redis://localhost:6379

# Auth (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=<YOUR_GENERATED_SECRET>
NEXTAUTH_URL=https://raynet.in
AUTH_TRUST_HOST=true

# App
NEXT_PUBLIC_APP_URL=https://raynet.in
NEXT_PUBLIC_APP_NAME=Raynet
NODE_ENV=production

# RADIUS
RADIUS_SERVER_IP=127.0.0.1
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
RADIUS_COA_PORT=3799
```

## 4.3 Build the App

```bash
cd /opt/cloudradius-app

pnpm install --frozen-lockfile
npx prisma generate
npx prisma migrate deploy
npx prisma db seed
pnpm build
```

## 4.4 Start with PM2

Copy the ecosystem config from this repo:
```bash
cp deploy/ecosystem.config.cjs /opt/cloudradius-app/ecosystem.config.cjs
```

Start the processes:
```bash
sudo mkdir -p /var/log/cloudradius
sudo chown ubuntu:ubuntu /var/log/cloudradius

cd /opt/cloudradius-app
pm2 start ecosystem.config.cjs
pm2 status    # Both should show "online"
pm2 save
pm2 startup   # Copy and run the sudo command it prints
```

---

# PART 5: CONFIGURE FREERADIUS (10 min)

## 5.1 Copy Config Files

```bash
# Backup defaults
sudo cp -r /etc/freeradius/3.0 /etc/freeradius/3.0.backup

# Copy production configs from repo
sudo cp /opt/cloudradius-app/deploy/freeradius/radiusd.conf /etc/freeradius/3.0/radiusd.conf
sudo cp /opt/cloudradius-app/deploy/freeradius/default /etc/freeradius/3.0/sites-enabled/default
sudo cp /opt/cloudradius-app/deploy/freeradius/sql.conf /etc/freeradius/3.0/mods-enabled/sql
sudo cp /opt/cloudradius-app/deploy/freeradius/clients.conf /etc/freeradius/3.0/clients.conf
sudo cp /opt/cloudradius-app/radius/dictionary.mikrotik /etc/freeradius/3.0/dictionary.mikrotik
```

## 5.2 Set Database Credentials

```bash
sudo systemctl edit freeradius
```

Paste:
```ini
[Service]
Environment="POSTGRES_HOST=127.0.0.1"
Environment="POSTGRES_PORT=5432"
Environment="POSTGRES_USER=cloudradius"
Environment="POSTGRES_PASSWORD=<YOUR_POSTGRES_PASSWORD>"
Environment="POSTGRES_DB=cloudradius"
```

## 5.3 Allow PM2/App to Restart FreeRADIUS

When you add a NAS device in the dashboard, FreeRADIUS needs a restart to pick it up:

```bash
echo "ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart freeradius" | sudo tee /etc/sudoers.d/cloudradius-freeradius
```

## 5.4 Find ARM64 Library Path

```bash
find /usr/lib -name "rlm_sql_postgresql*" -type f
# Note the directory (e.g., /usr/lib/aarch64-linux-gnu/freeradius/)
# If the radiusd.conf libdir doesn't match, edit it
```

## 5.5 Test and Start

```bash
# Test in debug mode
sudo freeradius -X
# Look for "Ready to process requests" → Ctrl+C

# Enable and start
sudo systemctl enable freeradius
sudo systemctl start freeradius
sudo systemctl status freeradius

# Verify ports
sudo ss -ulnp | grep -E '1812|1813'
```

---

# PART 6: DNS + NGINX + SSL (10 min)

## 6.1 Buy a Domain and Set DNS

Your domain is `raynet.in`.

Add these DNS records at your registrar:

| Type | Name | Value |
|------|------|-------|
| A | @ | `<YOUR_OCI_PUBLIC_IP>` |
| A | www | `<YOUR_OCI_PUBLIC_IP>` |
| A | * | `<YOUR_OCI_PUBLIC_IP>` |

Wait 5-10 minutes for DNS propagation. Verify:
```bash
dig raynet.in +short
# Should show your OCI public IP
```

## 6.2 Configure Nginx

```bash
sudo cp /opt/cloudradius-app/deploy/nginx/cloudradius /etc/nginx/sites-available/cloudradius
sudo ln -s /etc/nginx/sites-available/cloudradius /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Edit the config — replace "raynet.in" with your actual domain
sudo nano /etc/nginx/sites-available/cloudradius

sudo nginx -t
sudo systemctl reload nginx
```

## 6.3 Get SSL Certificate

```bash
sudo certbot --nginx -d raynet.in -d www.raynet.in
# Enter email, agree to ToS, optionally share email with EFF
```

Certbot automatically configures SSL in Nginx. Verify:
```bash
# Auto-renewal test
sudo certbot renew --dry-run
```

---

# PART 7: DATABASE BACKUPS (2 min)

```bash
sudo mkdir -p /opt/cloudradius/backups
sudo chown ubuntu:ubuntu /opt/cloudradius/backups
```

```bash
crontab -e
```

Add these lines:
```cron
# Daily database backup at 3 AM
0 3 * * * docker exec cloudradius-db pg_dump -U cloudradius cloudradius | gzip > /opt/cloudradius/backups/cloudradius-$(date +\%Y\%m\%d-\%H\%M).sql.gz

# Keep only last 7 days
0 4 * * * find /opt/cloudradius/backups -name "*.sql.gz" -mtime +7 -delete
```

---

# PART 8: CI/CD — AUTO DEPLOY ON GIT PUSH (5 min)

## 8.1 Create Deploy Key on Server

```bash
ssh-keygen -t ed25519 -f ~/.ssh/deploy_key -N ""
cat ~/.ssh/deploy_key.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/deploy_key
# COPY this private key
```

## 8.2 Add GitHub Secrets

In your GitHub repo → **Settings → Secrets and variables → Actions**, add:

| Secret Name | Value |
|-------------|-------|
| `SSH_PRIVATE_KEY` | The deploy private key content |
| `SSH_HOST` | Your OCI public IP |
| `SSH_USER` | `ubuntu` |

## 8.3 Push to Deploy

The workflow file `.github/workflows/deploy.yml` is already in the repo.
Every push to `main` will: pull → install → build → restart.

---

# PART 9: VERIFY EVERYTHING

Run the health check:
```bash
/opt/cloudradius/healthcheck.sh
```

Or check manually:
```bash
# App processes
pm2 status

# Database + Redis
cd /opt/cloudradius && docker compose ps

# FreeRADIUS
sudo systemctl status freeradius

# Nginx
sudo systemctl status nginx

# Test HTTPS
curl -I https://raynet.in

# Test RADIUS
echo "User-Name = test" | radclient localhost auth testing123
```

---

# PART 10: SET UP BROTHER'S TESTING

## On Raynet Dashboard:

1. Log in at `https://raynet.in`
2. **Add NAS:** Go to NAS page → Add NAS
   - Name: `Brother-Router`
   - IP: Brother's MikroTik public IP
   - Secret: Generate with `openssl rand -base64 16` (share with brother)
   - Type: MikroTik
3. **Restart FreeRADIUS:** `sudo systemctl restart freeradius`
4. **Create Plan:** Plans → Add → 10Mbps/5Mbps, 30 days, 500 price
5. **Create Subscriber:** Subscribers → Add → `testuser1` / `testpass123`

## Brother's MikroTik Setup (WinBox):

1. **RADIUS** → Add:
   - Address: `<YOUR_OCI_PUBLIC_IP>`
   - Secret: The shared secret from NAS config
   - Auth Port: `1812`, Acct Port: `1813`
2. **PPP → AAA:** Use RADIUS = Yes, Accounting = Yes, Interim Update = 5 min
3. Test: Connect a device with `testuser1` / `testpass123`
