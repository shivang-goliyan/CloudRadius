export const metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your ISP account settings
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { title: "Company Profile", description: "Name, logo, address, domain" },
          { title: "Payment Gateway", description: "Configure payment providers" },
          { title: "SMS Gateway", description: "Configure SMS providers" },
          { title: "Email (SMTP)", description: "Email sending configuration" },
          { title: "Notifications", description: "Notification templates" },
          { title: "Users & Roles", description: "Team management and RBAC" },
          { title: "Billing Preferences", description: "Currency, tax, invoice settings" },
          { title: "RADIUS Config", description: "Server IP and ports for router setup" },
        ].map((item) => (
          <div
            key={item.title}
            className="cursor-pointer rounded-lg border border-border bg-card p-6 transition-colors hover:bg-accent"
          >
            <h3 className="font-semibold text-foreground">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
