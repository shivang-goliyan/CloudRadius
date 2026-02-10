import { requireTenantId } from "@/lib/session";
import { subscriberService } from "@/services/subscriber.service";
import { planService } from "@/services/plan.service";
import { InvoiceForm } from "./invoice-form";

export const metadata = {
  title: "Create Invoice",
};

export default async function NewInvoicePage() {
  const tenantId = await requireTenantId();

  const [subscribers, plans] = await Promise.all([
    subscriberService.list({ tenantId, pageSize: 1000 }).then((res) => res.data),
    planService.listAll(tenantId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Invoice</h1>
        <p className="text-sm text-muted-foreground">
          Generate a new invoice for a subscriber
        </p>
      </div>

      <InvoiceForm subscribers={subscribers} plans={plans} />
    </div>
  );
}
