export const metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Leads</h1>
          <p className="text-sm text-muted-foreground">
            Track and convert potential subscribers
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Add Lead
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Leads module will be rendered here (Phase 5)
        </div>
      </div>
    </div>
  );
}
