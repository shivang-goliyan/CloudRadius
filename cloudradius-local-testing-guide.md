# CloudRadius Local Testing Guide — Complete Novice Edition

> **Goal:** Test the entire CloudRadius product on your Ubuntu laptop — RADIUS authentication, MikroTik PPPoE, and optionally share it via Cloudflare Tunnel so your brother (or anyone) in another city can access the web dashboard.

---

## What We're Building (The Big Picture)

```
YOUR LAPTOP (Ubuntu)
├── Docker Compose
│   ├── PostgreSQL           (port 5432)    — cloudradius-db container
│   ├── Redis                (port 6379)    — cloudradius-redis container
│   └── FreeRADIUS           (port 1812/1813/3799 UDP) — cloudradius-radius container
├── CloudRadius Web App      (http://localhost:3000) — runs via `pnpm dev`
├── VirtualBox
│   ├── MikroTik CHR VM      — simulates a real ISP router (NAS device)
│   │   └── PPPoE Server     — subscribers connect here
│   └── Alpine Linux VM      — simulates a subscriber's computer (PPPoE client)
└── Cloudflare Tunnel (optional) — makes the web app accessible via your domain
```

When everything is set up:
1. You open `http://localhost:3000` → CloudRadius admin panel
2. Subscribers, plans, and NAS devices are already seeded
3. A PPPoE client (Alpine VM) connects to MikroTik → MikroTik asks FreeRADIUS → FreeRADIUS checks PostgreSQL → user gets internet with speed limits
4. You see the user appear on the "Online Users" page in real-time
5. (Optional) Your brother accesses the web dashboard via Cloudflare Tunnel from his city

---

## PART 1: Prerequisites Check (5 minutes)

### Step 1.1: Find Your Laptop's Local IP Address

You'll need this for MikroTik's RADIUS config later.

```bash
hostname -I - 172.20.10.8 (Test1)
```

**What you'll see:** Something like `172.20.10.8 192.168.1.100`

**Which one to use:** Pick the one that starts with `192.168.x.x` or `10.x.x.x` — this is your LAN IP. Ignore `172.17.0.1` (that's Docker's internal bridge).

To confirm which interface you're using:
```bash
ip route | grep default
```
**Example output:** `default via 192.168.1.1 dev wlp4s0` — here `192.168.1.100` (or whatever shows in `hostname -I` on that interface) is your IP.

**Write it down!** We'll call this `YOUR_LAPTOP_IP` throughout this guide.

### Step 1.2: Check Docker is Running

```bash
docker --version
docker compose version
```

**Expected:** Version numbers for both. If not installed, install Docker Engine: https://docs.docker.com/engine/install/ubuntu/

### Step 1.3: Check Node.js and pnpm

```bash
node --version   # Should show v18+ or v20+
pnpm --version   # Should show v9+ or v10+
```

### Step 1.4: Check VirtualBox is Installed

```bash
VBoxManage --version
```

If not installed, we'll install it in Part 3.

---

## PART 2: Start CloudRadius Services (5 minutes)

All backend services (PostgreSQL, Redis, FreeRADIUS) run via Docker Compose. The config is already set up in your project.

### Step 2.1: Start Docker Containers

```bash
cd "/home/ggtwo/Development And Hacking/Product-Build/CloudRadius"
docker compose up -d
```

### Step 2.2: Verify All 3 Containers Are Running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

**Expected output — all 3 must show "Up" and "(healthy)" where applicable:**
```
NAMES                STATUS                    PORTS
cloudradius-radius   Up X minutes              0.0.0.0:1812-1813->1812-1813/udp, 0.0.0.0:3799->3799/udp
cloudradius-redis    Up X minutes (healthy)    0.0.0.0:6379->6379/tcp
cloudradius-db       Up X minutes (healthy)    0.0.0.0:5432->5432/tcp
```

**If a container isn't running:**
```bash
# Check logs for the failing container
docker logs cloudradius-db
docker logs cloudradius-redis
docker logs cloudradius-radius
```

### Step 2.3: Verify PostgreSQL Has Data

```bash
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT slug, name FROM tenants;"
```

**Expected:**
```
   slug   |   name
----------+----------
 demo-isp | Demo ISP
 new-isp  | New ISP
 test-isp | Test ISP
```

If the table is empty or doesn't exist, you need to run the seed:
```bash
cd "/home/ggtwo/Development And Hacking/Product-Build/CloudRadius"
pnpm prisma db push
npx tsx prisma/seed.ts
npx tsx scripts/seed-radius.ts
```

### Step 2.4: Verify RADIUS Tables Have Data

```bash
# Check subscribers in RADIUS
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c \
  "SELECT username, attribute, value FROM radcheck ORDER BY username;"
```

**Expected — you should see 12 entries like:**
```
            username            |     attribute      |     value
--------------------------------+--------------------+---------------
 demo-isp_amit_kumar            | Cleartext-Password | subscriber123
 demo-isp_cafe_darshana         | Cleartext-Password | subscriber123
 demo-isp_deepak_j              | Cleartext-Password | subscriber123
 ...
```

```bash
# Check plan bandwidth attributes
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c \
  "SELECT groupname, attribute, value FROM radgroupreply;"
```

**Expected — 9 plans with Mikrotik-Rate-Limit:**
```
                   groupname                   |      attribute      |                 value
-----------------------------------------------+---------------------+---------------------------------------
 demo-isp_9e652a55-...                         | Mikrotik-Rate-Limit | 50M/50M 50M/50M 0/0 0s/0s 6
 demo-isp_fe8b2cf0-...                         | Mikrotik-Rate-Limit | 100M/100M 120M/120M 80k/80k 10s/10s 4
 ...
```

### Step 2.5: Verify FreeRADIUS is Working

```bash
# Install radtest if not already available
sudo apt install freeradius-utils -y 2>/dev/null

# Test authentication
radtest demo-isp_amit_kumar subscriber123 127.0.0.1 0 testing123
```

**Expected output:**
```
Received Access-Accept Id X from 127.0.0.1:1812 to 127.0.0.1:XXXXX length XX
    Mikrotik-Rate-Limit = "50M/50M 50M/50M 0/0 0s/0s 6"
```

**If you get `Access-Reject`:**
```bash
# Check FreeRADIUS logs
docker logs cloudradius-radius --tail 50
```

### Step 2.6: Start the CloudRadius Web App

```bash
cd "/home/ggtwo/Development And Hacking/Product-Build/CloudRadius"
pnpm dev
```

**Expected:** `✓ Ready in XXXms` on `http://localhost:3000`

Open browser: `http://localhost:3000` and login:
- Email: `admin@demo-isp.com`
- Password: `Admin@123`

**Verify dashboard loads with stats and charts.** Leave the dev server running in this terminal.

---

## PART 3: Install VirtualBox and MikroTik CHR (15 minutes)

This creates a virtual MikroTik router — identical to real ISP hardware.

### Step 3.1: Install VirtualBox

```bash
sudo apt install virtualbox -y
```

If it asks about UEFI Secure Boot, select "OK" and set a password. After reboot, enroll the key in MOK manager.

**Verify installation:**
```bash
VBoxManage --version
```
**Expected:** A version number like `7.0.20_Ubuntur163906`

**If you get "kernel driver not installed":**
```bash
sudo apt install virtualbox-dkms -y
sudo modprobe vboxdrv
```

### Step 3.2: Download MikroTik CHR

```bash
# Create a folder for MikroTik files
mkdir -p ~/mikrotik-chr
cd ~/mikrotik-chr

# Download the CHR VDI image (VirtualBox disk format)
# Check https://mikrotik.com/download for latest version — look under "Cloud Hosted Router"
wget https://download.mikrotik.com/routeros/7.16.2/chr-7.16.2.vdi.zip

# Unzip it
unzip chr-7.16.2.vdi.zip
```

**If version 7.16.2 doesn't exist** (MikroTik updates frequently):
1. Open browser: `https://mikrotik.com/download`
2. Scroll to "Cloud Hosted Router" section
3. Download the `.vdi` file (VirtualBox format)
4. Move it to `~/mikrotik-chr/`

**Verify the file exists:**
```bash
ls -la ~/mikrotik-chr/*.vdi
```
**Expected:** A `.vdi` file around 30-70MB.

### Step 3.3: Find Your Active Network Interface Name

We need this to bridge the VM to your physical network:

```bash
ip route | grep default
```

**Example output:** `default via 192.168.1.1 dev wlp4s0`

The word after `dev` is your interface name (e.g., `wlp4s0` for WiFi, `enp3s0` for Ethernet).

**Write this down!** We'll call it `YOUR_INTERFACE`.
interface name (test1) - wlp3s0

### Step 3.4: Create the MikroTik VM

Replace `chr-7.16.2.vdi` with your actual filename and `YOUR_INTERFACE` with your interface from Step 3.3:

```bash
cd ~/mikrotik-chr

# Create the VM
VBoxManage createvm --name "MikroTik-CHR" --ostype Linux_64 --register

# Give it 256MB RAM and 1 CPU
VBoxManage modifyvm "MikroTik-CHR" --memory 256 --cpus 1

# Create a storage controller and attach the disk
VBoxManage storagectl "MikroTik-CHR" --name "SATA" --add sata
VBoxManage storageattach "MikroTik-CHR" --storagectl "SATA" --port 0 --device 0 --type hdd --medium ~/mikrotik-chr/chr-7.16.2.vdi

# Network Adapter 1: Bridged (so CHR gets a real IP on your network)
VBoxManage modifyvm "MikroTik-CHR" --nic1 bridged --bridgeadapter1 "YOUR_INTERFACE"

# Network Adapter 2: Internal network (for PPPoE clients to connect to)
VBoxManage modifyvm "MikroTik-CHR" --nic2 intnet --intnet2 "pppoe-lan"
```

**Example with real values:**
```bash
VBoxManage modifyvm "MikroTik-CHR" --nic1 bridged --bridgeadapter1 "wlp4s0"
```

### Step 3.5: Start the MikroTik VM

```bash
VBoxManage startvm "MikroTik-CHR"
```

This opens a VirtualBox window. Wait 10-15 seconds for it to boot.

**Login:**
- Username: `admin`
- Password: (leave empty, just press Enter)

### Step 3.6: Find the MikroTik CHR's IP Address

In the MikroTik console (the VirtualBox window), type:

```
/ip address print
```

**What you'll see:**
```
Flags: D - DYNAMIC
 #   ADDRESS            NETWORK         INTERFACE
 0 D 192.168.1.150/24   192.168.1.0     ether1
```

The IP under `ADDRESS` (e.g., `192.168.1.150`) is the CHR's IP. **Write this down!** We'll call it `CHR_IP`.
CHR_IP (test1) - 172.20.10.2/28

**If you don't see any IP address:**
```
/ip dhcp-client add interface=ether1 disabled=no
```
Wait a few seconds, then `/ip address print` again.

### Step 3.7: Set a Password on MikroTik

```
/user set admin password=admin123
```

### Step 3.8: Verify MikroTik Can Reach Your Laptop

```
/ping YOUR_LAPTOP_IP count=3
```

Replace `YOUR_LAPTOP_IP` with the IP from Step 1.1. You should see 3 successful ping replies. If not, check that both devices are on the same network.

---

## PART 4: Configure MikroTik as a RADIUS-Authenticated PPPoE Server (10 minutes)

This is the core setup — telling MikroTik to ask your FreeRADIUS server to authenticate subscribers.

### Step 4.1: Configure RADIUS on MikroTik

In the MikroTik console, paste these commands **one by one**. Replace `YOUR_LAPTOP_IP` with the IP from Step 1.1:

```
# 1. Tell MikroTik where the RADIUS server is (your laptop running Docker FreeRADIUS)
/radius add address=YOUR_LAPTOP_IP secret=testing123 service=ppp,hotspot timeout=3000

# 2. Enable RADIUS authentication for PPP (PPPoE)
/ppp aaa set use-radius=yes accounting=yes

# 3. Create an IP pool for PPPoE clients
/ip pool add name=pppoe-pool ranges=10.10.10.2-10.10.10.254

# 4. Create a PPPoE profile
/ppp profile add name=radius-profile local-address=10.10.10.1 remote-address=pppoe-pool dns-server=8.8.8.8,8.8.4.4

# 5. Create the PPPoE server on ether2 (the internal network adapter)
/interface pppoe-server server add service-name=CloudRadius-ISP interface=ether2 default-profile=radius-profile authentication=pap,chap,mschap2
```

### Step 4.2: Verify RADIUS Config on MikroTik

```
/radius print
```

**Expected:**
```
 #   SERVICE        CALLED-ID  DOMAIN  ADDRESS           SECRET
 0   ppp,hotspot                        YOUR_LAPTOP_IP    testing123
```

### Step 4.3: Register MikroTik as a NAS Device in CloudRadius

Open your browser at `http://localhost:3000` and:

1. Go to **NAS Devices** page (sidebar)
2. Click **Add NAS**
3. Fill in:
   - **Name:** `MikroTik CHR Test`
   - **NAS IP:** `CHR_IP` (the MikroTik's IP from Step 3.6, e.g., `192.168.1.150`)
   - **Secret:** `testing123`
   - **Type:** `MikroTik` (or `other`)
4. Click **Save**

**Why through the web UI?** The app's NAS form automatically syncs to both the app database AND the RADIUS `nas` table via `radiusService.syncNasDevice()`. This is the proper way — don't insert directly into the database.

### Step 4.4: Verify the NAS Was Synced to RADIUS

```bash
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c \
  "SELECT nasname, shortname, secret FROM nas WHERE nasname = 'CHR_IP';"
```

Replace `CHR_IP` with the actual IP. You should see one row.

### Step 4.5: Restart FreeRADIUS to Pick Up the New NAS

FreeRADIUS reads the `nas` table on startup (because `read_clients = yes` in sql.conf). Restart it:

```bash
docker restart cloudradius-radius
```

Wait 5 seconds, then verify it's back:
```bash
docker ps | grep cloudradius-radius
```

### Step 4.6: Test RADIUS Auth From MikroTik's Perspective

On your laptop, test that FreeRADIUS still responds:

```bash
radtest demo-isp_amit_kumar subscriber123 127.0.0.1 0 testing123
```

**Expected:** `Access-Accept` with `Mikrotik-Rate-Limit`

---

## PART 5: Test PPPoE Connection With a Client VM (15 minutes)

This simulates what happens when a real subscriber's computer connects to the ISP router.

### Step 5.1: Download Alpine Linux (Lightweight — Only 60MB)

```bash
cd ~/mikrotik-chr

# Download Alpine Linux virtual edition
wget https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/alpine-virt-3.20.3-x86_64.iso
```

If this specific version doesn't exist, go to https://alpinelinux.org/downloads/ and download the "Virtual" x86_64 ISO.

### Step 5.2: Create the PPPoE Client VM

```bash
# Create VM
VBoxManage createvm --name "PPPoE-Client" --ostype Linux_64 --register
VBoxManage modifyvm "PPPoE-Client" --memory 512 --cpus 1

# Create a virtual hard disk (2GB)
VBoxManage createhd --filename ~/mikrotik-chr/pppoe-client.vdi --size 2000

# Attach storage
VBoxManage storagectl "PPPoE-Client" --name "SATA" --add sata
VBoxManage storageattach "PPPoE-Client" --storagectl "SATA" --port 0 --device 0 --type hdd --medium ~/mikrotik-chr/pppoe-client.vdi

# Attach the Alpine ISO for boot
VBoxManage storagectl "PPPoE-Client" --name "IDE" --add ide
VBoxManage storageattach "PPPoE-Client" --storagectl "IDE" --port 0 --device 0 --type dvddrive --medium ~/mikrotik-chr/alpine-virt-3.20.3-x86_64.iso

# CRITICAL: Network must be on the same "pppoe-lan" internal network as MikroTik's ether2
VBoxManage modifyvm "PPPoE-Client" --nic1 intnet --intnet1 "pppoe-lan"

# Boot order: DVD first, then disk
VBoxManage modifyvm "PPPoE-Client" --boot1 dvd --boot2 disk

# Start it
VBoxManage startvm "PPPoE-Client"
```

### Step 5.3: Set Up Alpine Linux

When Alpine boots, login as `root` (no password needed).

You can either install Alpine to disk or just use the live session for testing:

**Option A — Quick test without installing (recommended for first time):**
```bash
# Just install PPPoE packages in the live session
apk add ppp ppp-pppoe
```

**Option B — Full install (persists across reboots):**
```bash
setup-alpine
```
For most prompts, press Enter for defaults. When asked about disk, type `sda` and `sys`. Reboot, then:
```bash
apk add ppp ppp-pppoe
```

### Step 5.4: Configure and Start PPPoE Connection

In the Alpine VM, create the PPPoE config:

```bash
cat > /etc/ppp/peers/isp << 'EOF'
plugin pppoe.so
eth0
user "demo-isp_amit_kumar"
password "subscriber123"
noauth
defaultroute
persist
maxfail 3
holdoff 5
EOF
```

**Important:** The username MUST include the tenant prefix `demo-isp_` because that's how CloudRadius stores it in the RADIUS tables.

Now connect:

```bash
pon isp
```

### Step 5.5: Verify the PPPoE Connection

Wait 3-5 seconds, then check:

```bash
# Check if ppp0 interface exists with an IP
ifconfig ppp0
```

**Expected:** You should see `ppp0` with an IP address like `10.10.10.X`:
```
ppp0      Link encap:Point-to-Point Protocol
          inet addr:10.10.10.2  P-t-P:10.10.10.1  Mask:255.255.255.255
          UP POINTOPOINT RUNNING NOARP MULTICAST  MTU:1480
```

**If `ppp0` doesn't appear or has no IP:**
```bash
# Check PPPoE logs
cat /var/log/messages | tail -20
```

Common issues:
- Wrong username/password → check `radcheck` table
- VMs not on same internal network → both must be on `pppoe-lan`
- MikroTik PPPoE server not running → check `/interface pppoe-server server print` on MikroTik

### Step 5.6: Verify on MikroTik

In the MikroTik console:

```
# Check active PPPoE sessions
/ppp active print
```

**Expected:**
```
 #   NAME                 SERVICE         CALLER-ID    ADDRESS     UPTIME
 0   demo-isp_amit_kumar  CloudRadius-ISP ...          10.10.10.2  00:00:XX
```

```
# Check bandwidth queue was applied
/queue simple print
```

**Expected:** A queue entry showing the rate limit from the plan (e.g., `50M/50M`).

### Step 5.7: Verify on CloudRadius Web UI

Open `http://localhost:3000` in your browser:

1. **Online Users page** → You should see `amit_kumar` listed as online with:
   - IP address: `10.10.10.X`
   - NAS IP: `CHR_IP`
   - Session duration counting up

2. **Dashboard** → Online users count should show at least 1

### Step 5.8: Test Disconnect

In the Alpine VM:
```bash
poff isp
```

Then check:
1. **MikroTik:** `/ppp active print` → should be empty
2. **CloudRadius Sessions page** → Should show a completed session with start/end time and data usage
3. **Online Users page** → The user should disappear

---

## PART 6: Full RADIUS Flow Testing Checklist

Run through each test and mark pass/fail:

### Authentication Tests

| # | Test | Command / Action | Expected Result |
|---|------|-----------------|-----------------|
| 1 | Valid subscriber auth | `radtest demo-isp_amit_kumar subscriber123 127.0.0.1 0 testing123` | Access-Accept with Mikrotik-Rate-Limit |
| 2 | Wrong password | `radtest demo-isp_amit_kumar wrongpass 127.0.0.1 0 testing123` | Access-Reject |
| 3 | Non-existent user | `radtest demo-isp_nobody test123 127.0.0.1 0 testing123` | Access-Reject |
| 4 | Different subscriber | `radtest demo-isp_pooja_k subscriber123 127.0.0.1 0 testing123` | Access-Accept (may have different rate limit) |
| 5 | Voucher auth | `radtest demo-isp_voucher_WIFI-WFG3M6BX WIFI-WFG3M6BX 127.0.0.1 0 testing123` | Access-Accept |
| 6 | Wrong tenant prefix | `radtest new-isp_amit_kumar subscriber123 127.0.0.1 0 testing123` | Access-Reject (cross-tenant isolation) |

### PPPoE Flow Tests

| # | Test | How to Verify |
|---|------|--------------|
| 1 | PPPoE connect | Alpine VM gets `ppp0` interface with IP `10.10.10.X` |
| 2 | Online Users | Subscriber appears on Online Users page with session info |
| 3 | Speed limit applied | MikroTik `/queue simple print` shows correct rate limit |
| 4 | PPPoE disconnect | Run `poff isp` in Alpine VM, user disappears from Online Users |
| 5 | Session recorded | After disconnect, session appears on Sessions page with duration and data |
| 6 | Reconnect | Run `pon isp` again — subscriber reconnects successfully |

### Admin Panel Verification (during PPPoE test)

| # | Test | How to Verify |
|---|------|--------------|
| 1 | Dashboard stats | Cards show correct online user count |
| 2 | NAS device listed | MikroTik CHR Test appears in NAS Devices page |
| 3 | RADIUS accounting | `docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT username, nasipaddress, framedipaddress, acctstarttime, acctstoptime FROM radacct ORDER BY acctstarttime DESC LIMIT 5;"` |

### Subscriber Lifecycle Tests

| # | Test | Steps |
|---|------|-------|
| 1 | Create new subscriber via UI | Add subscriber "test_pppoe" with password "test123", plan "Basic 10Mbps". Then test: `radtest demo-isp_test_pppoe test123 127.0.0.1 0 testing123` → Access-Accept |
| 2 | Change subscriber password | Edit subscriber, change password to "newpass123". Test: old password → Reject, new password → Accept |
| 3 | Change subscriber plan | Switch plan, verify `radgroupreply` has new rate limit |
| 4 | Disable subscriber | Set status to Suspended/Inactive. Test: `radtest` → Access-Reject |
| 5 | Re-enable subscriber | Set status back to Active. Test: `radtest` → Access-Accept |

---

## PART 7: Expose to the Internet via Cloudflare Tunnel (Optional — 15 minutes)

This lets your brother access the CloudRadius **web dashboard** from another city. Note: RADIUS (UDP) cannot go through Cloudflare Tunnel — this is only for the web app.

### Step 7.1: Prerequisites

You need:
- A domain name
- A Cloudflare account (free): https://dash.cloudflare.com/sign-up
- Your domain's DNS managed by Cloudflare

### Step 7.2: Add Your Domain to Cloudflare (if not already)

1. Go to `https://dash.cloudflare.com`
2. Click **Add a Site**
3. Enter your domain (e.g., `yourdomain.com`)
4. Select the **Free** plan
5. Cloudflare scans existing DNS records — review and confirm
6. Cloudflare gives you two nameservers — update them at your domain registrar
7. Wait for propagation (minutes to hours)

### Step 7.3: Install Cloudflared

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
sudo mv cloudflared /usr/local/bin/
sudo chmod +x /usr/local/bin/cloudflared

# Verify
cloudflared --version
```

### Step 7.4: Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser. Select your domain and authorize. A certificate is saved to `~/.cloudflared/cert.pem`.

### Step 7.5: Create a Tunnel

```bash
cloudflared tunnel create cloudradius
```

**Write down the tunnel ID** (a long UUID like `a1b2c3d4-e5f6-7890-abcd-ef1234567890`).

### Step 7.6: Create the Tunnel Config

```bash
nano ~/.cloudflared/config.yml
```

Add this content (replace `YOUR_TUNNEL_ID` and `yourdomain.com`):

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/ggtwo/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: app.yourdomain.com
    service: http://localhost:3000
  - hostname: portal.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Step 7.7: Create DNS Records

```bash
cloudflared tunnel route dns cloudradius app.yourdomain.com
cloudflared tunnel route dns cloudradius portal.yourdomain.com
```

### Step 7.8: Start the Tunnel

```bash
cloudflared tunnel run cloudradius
```

**Expected:** Lines showing `Connection registered` (usually 4 connections).

Keep this terminal open — the tunnel only works while this command is running.

### Step 7.9: Test It

1. Open a browser: `https://app.yourdomain.com` → CloudRadius login page
2. Subscriber portal: `https://portal.yourdomain.com/portal`
3. Ask your brother to open the same URL from his city

### Step 7.10: Run Tunnel as a Background Service (Optional)

So you don't need to keep a terminal open:

```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

## PART 8: Admin Panel Tests (via Web UI)

Open `http://localhost:3000` (or `https://app.yourdomain.com` if tunnel is running):

| # | Test | How to Verify |
|---|------|--------------|
| 1 | Login | Login with `admin@demo-isp.com` / `Admin@123` |
| 2 | Dashboard | Cards show stats (subscribers, revenue, online users), charts load |
| 3 | View plans | Plans page lists all seeded plans with speed/price |
| 4 | Add a plan | Create plan "Test 5Mbps" (5/3 Mbps, 30 days, 300 price). Verify: `radtest` a subscriber on that plan gets correct rate limit |
| 5 | View subscribers | Subscribers page lists all seeded subscribers |
| 6 | Add subscriber | Create subscriber, verify RADIUS auth works |
| 7 | Edit subscriber | Change plan/password, verify RADIUS is updated |
| 8 | Online users | Shows connected PPPoE users (needs active PPPoE connection) |
| 9 | Sessions | Shows historical PPPoE sessions after disconnect |
| 10 | NAS devices | MikroTik CHR Test shows in the list |
| 11 | Generate invoice | Go to billing → invoices → create invoice for a subscriber |
| 12 | Record payment | Record a payment against an invoice |
| 13 | Voucher batch | Go to vouchers → generate a batch of 5 vouchers → view codes |
| 14 | Create complaint | Go to complaints → add a support ticket |
| 15 | Reports | Open each report type (revenue, subscribers, sessions, etc.) |
| 16 | Settings | Check company, SMS, email, payment gateway, RADIUS settings pages |
| 17 | Dark mode | Toggle dark mode from the topbar — all pages should render correctly |
| 18 | Mobile responsive | Open browser DevTools (F12) → toggle device toolbar → check at 390px width |

### Subscriber Portal Tests

Open `http://localhost:3000/portal`:

| # | Test | How to Verify |
|---|------|--------------|
| 1 | Login | Login with subscriber credentials (e.g., username: `amit_kumar`, password: `subscriber123`) |
| 2 | Dashboard | Shows plan details, usage, expiry date |
| 3 | View invoices | Lists invoices with status |
| 4 | Raise complaint | Submit a ticket, verify it appears in admin panel complaints page |
| 5 | Edit profile | Update phone/email |

---

## PART 9: Quick Start / Daily Startup

Every time you restart your laptop or want to test, run these commands in order:

```bash
# 1. Start Docker services (PostgreSQL, Redis, FreeRADIUS)
cd "/home/ggtwo/Development And Hacking/Product-Build/CloudRadius"
docker compose up -d

# 2. Wait for services to be healthy (5 seconds)
sleep 5

# 3. Verify services
docker ps --format "table {{.Names}}\t{{.Status}}"

# 4. Start CloudRadius app
pnpm dev

# 5. Start MikroTik VM (if testing RADIUS/PPPoE)
VBoxManage startvm "MikroTik-CHR"

# 6. Start PPPoE Client VM (if testing PPPoE flow)
VBoxManage startvm "PPPoE-Client"

# 7. Start Cloudflare tunnel (if sharing externally)
cloudflared tunnel run cloudradius
```

### One-Command Startup Script

```bash
nano ~/start-cloudradius.sh
```

Paste:

```bash
#!/bin/bash
echo "=============================="
echo " Starting CloudRadius Environment"
echo "=============================="

echo ""
echo "[1/4] Starting Docker services (PostgreSQL, Redis, FreeRADIUS)..."
cd "/home/ggtwo/Development And Hacking/Product-Build/CloudRadius"
docker compose up -d
sleep 3

echo ""
echo "[2/4] Checking services..."
docker ps --format "  {{.Names}}: {{.Status}}"

echo ""
echo "[3/4] Starting MikroTik CHR VM..."
VBoxManage startvm "MikroTik-CHR" --type headless 2>/dev/null && echo "  MikroTik CHR started" || echo "  MikroTik CHR already running or not found"

echo ""
echo "[4/4] Starting CloudRadius web app..."
echo "  Open http://localhost:3000 in your browser"
echo "  Login: admin@demo-isp.com / Admin@123"
echo ""
pnpm dev
```

Make it executable:
```bash
chmod +x ~/start-cloudradius.sh
```

Run with:
```bash
~/start-cloudradius.sh
```

### Shutdown Script

```bash
nano ~/stop-cloudradius.sh
```

```bash
#!/bin/bash
echo "Stopping CloudRadius environment..."

echo "[1/3] Stopping MikroTik CHR VM..."
VBoxManage controlvm "MikroTik-CHR" poweroff 2>/dev/null

echo "[2/3] Stopping PPPoE Client VM..."
VBoxManage controlvm "PPPoE-Client" poweroff 2>/dev/null

echo "[3/3] Stopping Docker services..."
cd "/home/ggtwo/Development And Hacking/Product-Build/CloudRadius"
docker compose down

echo "Done!"
```

```bash
chmod +x ~/stop-cloudradius.sh
```

---

## Troubleshooting

### Docker containers won't start
```bash
# Check what's wrong
docker compose logs

# Restart everything
docker compose down && docker compose up -d
```

### "Connection refused" on port 3000
The app isn't running. Start it with `pnpm dev`.

### "Access-Reject" from radtest
```bash
# 1. Check the username exists in radcheck
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c \
  "SELECT * FROM radcheck WHERE username LIKE '%amit_kumar%';"

# 2. Check FreeRADIUS debug logs
docker logs cloudradius-radius --tail 100

# 3. If needed, restart FreeRADIUS and watch logs
docker restart cloudradius-radius
docker logs -f cloudradius-radius
```

### MikroTik can't reach RADIUS server
```bash
# From MikroTik console, ping your laptop
/ping YOUR_LAPTOP_IP

# If firewall is blocking, allow RADIUS ports
sudo ufw allow 1812/udp
sudo ufw allow 1813/udp
sudo ufw allow 3799/udp

# Or check if ufw is even active
sudo ufw status
```

### PPPoE client can't connect
1. **Check both VMs are on the same internal network:**
   - MikroTik: nic2 should be `intnet` with name `pppoe-lan`
   - Alpine: nic1 should be `intnet` with name `pppoe-lan`

   Verify:
   ```bash
   VBoxManage showvminfo "MikroTik-CHR" | grep -i "nic 2"
   VBoxManage showvminfo "PPPoE-Client" | grep -i "nic 1"
   ```

2. **Check MikroTik PPPoE server is running:**
   ```
   /interface pppoe-server server print
   ```
   Should show `CloudRadius-ISP` running on `ether2`.

3. **Check MikroTik RADIUS config:**
   ```
   /radius print
   ```
   Should show your laptop's IP.

4. **Check the username includes the tenant prefix:**
   The PPPoE config file must use `demo-isp_amit_kumar`, NOT just `amit_kumar`.

### Online Users page is empty even though PPPoE is connected
```bash
# Check if FreeRADIUS is writing accounting data
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c \
  "SELECT username, nasipaddress, framedipaddress, acctstarttime FROM radacct ORDER BY acctstarttime DESC LIMIT 5;"

# If empty, check FreeRADIUS logs for accounting errors
docker logs cloudradius-radius --tail 50
```

### MikroTik VM won't boot
```bash
# Check disk is attached
VBoxManage showvminfo "MikroTik-CHR" | grep "SATA"

# If the VDI file was moved, re-attach it
VBoxManage storageattach "MikroTik-CHR" --storagectl "SATA" --port 0 --device 0 --type hdd --medium ~/mikrotik-chr/chr-7.16.2.vdi
```

### VirtualBox says "kernel driver not installed"
```bash
sudo apt install virtualbox-dkms -y
sudo modprobe vboxdrv
```

### Cloudflare tunnel shows "connection refused"
Make sure the app is running on `localhost:3000` BEFORE starting the tunnel.

### radtest command not found
```bash
sudo apt install freeradius-utils -y
```

### Your brother can't access the site
```bash
# Check tunnel is running
cloudflared tunnel info cloudradius

# Check DNS propagation
nslookup app.yourdomain.com

# Make sure Cloudflare shows your domain as "Active"
```

---

## Reference: Test Credentials

| What | Value |
|------|-------|
| **Admin login** | `admin@demo-isp.com` / `Admin@123` |
| **Subscriber username** | `demo-isp_amit_kumar` (RADIUS) or `amit_kumar` (portal) |
| **Subscriber password** | `subscriber123` (all seeded subscribers) |
| **RADIUS secret** | `testing123` |
| **MikroTik login** | `admin` / `admin123` |
| **PostgreSQL** | `cloudradius` / `cloudradius` / `cloudradius` (user/pass/db) |
| **Database access** | `docker exec -it cloudradius-db psql -U cloudradius -d cloudradius` |

## Reference: Available Test Subscribers

| RADIUS Username | Password | Notes |
|----------------|----------|-------|
| `demo-isp_amit_kumar` | `subscriber123` | General test |
| `demo-isp_pooja_k` | `subscriber123` | Second subscriber |
| `demo-isp_deepak_j` | `subscriber123` | Third subscriber |
| `demo-isp_cafe_darshana` | `subscriber123` | Business subscriber |
| `demo-isp_rajesh_p` | `subscriber123` | |
| `demo-isp_vikram_s` | `subscriber123` | |
| `demo-isp_sunita_d` | `subscriber123` | |
| `demo-isp_meena_j` | `subscriber123` | |
| `demo-isp_newsub` | `subscriber123` | |
| `demo-isp_potent` | `subscriber123` | |
| `demo-isp_voucher_WIFI-WFG3M6BX` | `WIFI-WFG3M6BX` | Voucher user |
| `demo-isp_voucher_WIFI-782GRPH4` | `WIFI-782GRPH4` | Voucher user |

## Reference: Key Docker Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker logs cloudradius-db
docker logs cloudradius-redis
docker logs cloudradius-radius

# Follow logs in real-time
docker logs -f cloudradius-radius

# Restart a specific service
docker restart cloudradius-radius

# Access PostgreSQL shell
docker exec -it cloudradius-db psql -U cloudradius -d cloudradius

# Check RADIUS tables
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT * FROM radcheck;"
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT * FROM radgroupreply;"
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT * FROM radusergroup;"
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT * FROM radacct ORDER BY acctstarttime DESC LIMIT 10;"
docker exec cloudradius-db psql -U cloudradius -d cloudradius -c "SELECT * FROM nas;"
```
