# CloudRadius Testing Guide — With Brother's MikroTik Router

**After deploying to Oracle Cloud, your brother points his router to the public IP.**
**No Tailscale, no tunnels, no relay scripts — just like XceedNet.**

---

# SECTION 1: YOUR WORK (After Deployment)

Follow `DEPLOYMENT_GUIDE.md` first. Once the server is live:

## Step 1.1: Add Brother's Router as NAS

1. Open `https://yourdomain.com` → log in as admin
2. Go to **NAS** page → Click **Add NAS**

| Field | Value |
|-------|-------|
| Name | `Brother-Router` |
| IP Address | Your brother's MikroTik **public IP** (he tells you this) |
| Secret | Generate: `openssl rand -base64 16` — **share this with brother** |
| Type | `MikroTik` |

3. Save
4. SSH into server and restart FreeRADIUS:
   ```bash
   sudo systemctl restart freeradius
   ```

## Step 1.2: Create Test Data

### Create a Plan:
- **Plans** → **Add Plan**
- Name: `Test-10Mbps`, Download: 10 Mbps, Upload: 5 Mbps, Price: 500, Validity: 30 days

### Create Test Subscribers:
- **Subscribers** → **Add Subscriber**
- `testuser1` / `testpass123` — Plan: Test-10Mbps, Status: Active
- `testuser2` / `testpass456` — Plan: Test-10Mbps, Status: Active

## What You Send to Your Brother

```
1. Dashboard URL: https://yourdomain.com
2. Dashboard login: (admin email + password)
3. RADIUS Server IP: <YOUR_OCI_PUBLIC_IP>
4. RADIUS Shared Secret: <the-secret-from-NAS-config>
5. Test credentials: testuser1 / testpass123
```

---

# SECTION 2: YOUR BROTHER'S WORK (WinBox)

## Step 2.1: Find Your Public IP

Open browser → go to `https://whatismyip.com` → note the IP.
Send this to your brother (he needs it for NAS config in Step 1.1).

## Step 2.2: Add CloudRadius as RADIUS Server

Open **WinBox** → connect to router:

1. Click **RADIUS** in the left menu → **+** (Add)

| Field | Value |
|-------|-------|
| Service | `ppp` (PPPoE) and/or `hotspot` |
| Address | `<OCI_PUBLIC_IP>` (your brother gave you this) |
| Secret | The shared secret (must match EXACTLY) |
| Authentication Port | `1812` |
| Accounting Port | `1813` |
| Timeout | `3000` |

2. Click **OK**

**Do NOT remove your existing RADIUS server.** CloudRadius is added alongside it.

## Step 2.3: Enable RADIUS Authentication

### For PPPoE:
1. **PPP** → **AAA** button → Use RADIUS: Yes, Accounting: Yes, Interim: `00:05:00`

### For Hotspot:
1. **IP** → **Hotspot** → **Server Profiles** → double-click profile → **RADIUS** tab
2. Use RADIUS: Yes, Accounting: Yes, Interim: `00:05:00`

## Step 2.4: Test

- Connect a device with `testuser1` / `testpass123`
- Run speed test at `https://fast.com`
- Check the dashboard → **Online Users** to see the session

---

# SECTION 3: TESTING CHECKLIST

## Basic Authentication

| # | Test | How | Expected | Pass? |
|---|------|-----|----------|-------|
| 1 | User connects | PPPoE/Hotspot with testuser1 | Online Users shows session | ☐ |
| 2 | Speed limit | Run speed test | ~10 Mbps down / ~5 Mbps up | ☐ |
| 3 | Session tracking | Stay connected 5 min | Sessions page shows data | ☐ |
| 4 | Disconnect (CoA) | Click "Disconnect" in dashboard | Connection drops | ☐ |
| 5 | Reconnect | Connect again after disconnect | Works normally | ☐ |

## Subscriber Management

| # | Test | How | Expected | Pass? |
|---|------|-----|----------|-------|
| 6 | Suspend user | Set status to "Suspended" | Cannot connect | ☐ |
| 7 | Reactivate | Set status back to "Active" | Can connect again | ☐ |
| 8 | Wrong password | Try wrong password | Rejected | ☐ |
| 9 | Non-existent user | Try `fakeuser` / `fakepass` | Rejected | ☐ |
| 10 | Expired account | Set expiry to yesterday | Cannot connect | ☐ |

## Plan & Speed

| # | Test | How | Expected | Pass? |
|---|------|-----|----------|-------|
| 11 | Change plan | Create 5Mbps plan, assign to user | Speed test shows ~5 Mbps | ☐ |
| 12 | Change back | Reassign 10Mbps plan | Speed test shows ~10 Mbps | ☐ |

## Advanced Features

| # | Test | How | Expected | Pass? |
|---|------|-----|----------|-------|
| 13 | MAC Binding | Set fake MAC for testuser1 | Cannot connect (MAC mismatch) | ☐ |
| 14 | Remove MAC | Clear MAC field | Can connect again | ☐ |
| 15 | Two users | Connect testuser2 on another device | Both online simultaneously | ☐ |
| 16 | Voucher (Hotspot) | Generate voucher, use code | Connects via voucher | ☐ |

## Dashboard & Reports

| # | Test | Where | Expected | Pass? |
|---|------|-------|----------|-------|
| 17 | Dashboard charts | Dashboard page | Charts show active users/bandwidth | ☐ |
| 18 | Session history | Sessions page | Completed sessions with duration + bytes | ☐ |
| 19 | Subscriber report | Reports → Subscribers | Shows test users with usage | ☐ |
| 20 | Session report | Reports → Sessions | Shows all test sessions | ☐ |
| 21 | Usage report | Reports → Usage | Shows bandwidth consumption | ☐ |

## Billing

| # | Test | Where | Expected | Pass? |
|---|------|-------|----------|-------|
| 22 | Create invoice | Billing → Invoices → New | Invoice created | ☐ |
| 23 | Record payment | Click "Record Payment" | Status changes to Paid | ☐ |
| 24 | Payment history | Billing → Payments | Payment visible | ☐ |
| 25 | Billing report | Reports → Billing | Invoice + payment data | ☐ |

---

# SECTION 4: TROUBLESHOOTING

## RADIUS Timeout (Router can't reach server)

| Check | Fix |
|-------|-----|
| OCI Security List | Must have UDP 1812/1813 ingress from 0.0.0.0/0 |
| OS iptables | `sudo iptables -L -n \| grep 1812` — must show ACCEPT |
| FreeRADIUS running | `sudo systemctl status freeradius` |
| Ports listening | `sudo ss -ulnp \| grep 1812` |
| NAS IP matches | Dashboard NAS IP must match brother's public IP |
| Secret matches | Must be identical in dashboard and WinBox |
| FreeRADIUS restarted | `sudo systemctl restart freeradius` after adding NAS |

## RADIUS Access Reject

| Check | Fix |
|-------|-----|
| Subscriber Active | Dashboard → Subscribers → check status |
| Plan exists | Dashboard → Plans → check plan is active |
| Credentials correct | Username/password exact match |
| Not expired | Check expiry date is in the future |
| RADIUS logs | `sudo journalctl -u freeradius --since "5 min ago"` |

## Dashboard Not Loading

| Check | Fix |
|-------|-----|
| PM2 running | `pm2 status` — web should be "online" |
| Nginx running | `sudo systemctl status nginx` |
| SSL valid | `sudo certbot certificates` |
| DNS pointing | `dig yourdomain.com +short` — should show OCI IP |

## Speed Limit Not Working

| Check | Fix |
|-------|-----|
| Plan configured | Dashboard → Plans → verify speeds set |
| MikroTik attributes | WinBox → PPP → Active → check rate-limit column |
| Reconnect | Disconnect and reconnect — attributes apply on new sessions |
