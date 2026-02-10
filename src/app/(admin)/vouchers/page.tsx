export const metadata = {
  title: "Vouchers",
};

export default function VouchersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vouchers</h1>
          <p className="text-sm text-muted-foreground">
            Generate and manage voucher/PIN codes
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Generate Vouchers
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Voucher module will be rendered here (Phase 5)
        </div>
      </div>
    </div>
  );
}
