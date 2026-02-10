export const metadata = {
  title: "Complaints",
};

export default function ComplaintsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Complaints</h1>
          <p className="text-sm text-muted-foreground">
            Support tickets and complaint management
          </p>
        </div>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Create Ticket
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Complaints module will be rendered here (Phase 5)
        </div>
      </div>
    </div>
  );
}
