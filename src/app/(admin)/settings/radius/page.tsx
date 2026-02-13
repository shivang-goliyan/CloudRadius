import { requireTenantUser } from "@/lib/session";
import { authorize } from "@/lib/rbac";

export const metadata = { title: "RADIUS Configuration" };

export default async function RadiusConfigPage() {
  const user = await requireTenantUser();
  authorize(user.role, "settings", "view");

  const radiusServerIp = process.env.RADIUS_SERVER_IP || "your-radius-server.cloudradius.com";
  const authPort = process.env.RADIUS_AUTH_PORT || "1812";
  const acctPort = process.env.RADIUS_ACCT_PORT || "1813";
  const coaPort = process.env.RADIUS_COA_PORT || "3799";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">RADIUS Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Use these settings to configure your MikroTik router
        </p>
      </div>

      {/* Connection Details */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Connection Details</h3>
        {[
          { label: "RADIUS Server IP", value: radiusServerIp },
          { label: "Authentication Port", value: authPort },
          { label: "Accounting Port", value: acctPort },
          { label: "CoA Port", value: coaPort },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3"
          >
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <code className="rounded bg-muted px-2 py-1 text-sm font-mono text-foreground">
              {item.value}
            </code>
          </div>
        ))}
      </div>

      {/* MikroTik Setup Guide */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">MikroTik Setup Guide</h3>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>1. Open MikroTik Winbox or Terminal</p>
          <p>2. Navigate to RADIUS settings and add the CloudRadius server</p>
          <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto text-foreground">
{`/radius add address=${radiusServerIp} secret=YOUR_NAS_SECRET service=ppp,hotspot \\
  authentication-port=${authPort} accounting-port=${acctPort}`}
          </pre>
          <p>3. Enable RADIUS for PPPoE or Hotspot server</p>
          <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto text-foreground">
{`/ppp aaa set use-radius=yes accounting=yes
/ip hotspot profile set default use-radius=yes`}
          </pre>
          <p>4. Enable CoA (allows CloudRadius to disconnect users remotely)</p>
          <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-x-auto text-foreground">
{`/radius incoming set accept=yes port=${coaPort}`}
          </pre>
          <p>
            5. Make sure your NAS device is registered in CloudRadius with the matching IP address
            and shared secret
          </p>
        </div>
      </div>

      {/* Important Notes */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Important Notes</h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
          <li>
            The NAS shared secret must match exactly between your router and the NAS device
            configuration in CloudRadius
          </li>
          <li>
            Ensure your router&apos;s public IP is reachable and matches the IP set in the NAS
            device record
          </li>
          <li>
            For remote disconnect to work, you must enable CoA on your router with{" "}
            <code className="rounded bg-muted px-1 text-xs font-mono">/radius incoming set accept=yes port={coaPort}</code>
          </li>
          <li>
            Accounting interim updates are recommended every 5 minutes for accurate session tracking
          </li>
        </ul>
      </div>
    </div>
  );
}
