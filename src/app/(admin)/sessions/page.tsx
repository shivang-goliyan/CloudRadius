import { requireTenantUser } from "@/lib/session";
import { radiusService } from "@/services/radius.service";
import { SessionTable } from "./session-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Session History",
};

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    nasIp?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function SessionsPage({ searchParams }: PageProps) {
  const user = await requireTenantUser();

  if (!user.tenantSlug) {
    return <div>No tenant context</div>;
  }

  const page = parseInt(searchParams.page || "1");
  const startDate = searchParams.startDate ? new Date(searchParams.startDate) : undefined;
  const endDate = searchParams.endDate ? new Date(searchParams.endDate) : undefined;

  const result = await radiusService.getSessionHistory({
    tenantSlug: user.tenantSlug,
    subscriberUsername: searchParams.search,
    nasIp: searchParams.nasIp,
    startDate,
    endDate,
    page,
    pageSize: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session History</h1>
        <p className="text-muted-foreground">
          View complete RADIUS accounting logs for all subscriber sessions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounting Records</CardTitle>
          <CardDescription>
            Complete session history with data usage and connection details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionTable data={result.data} meta={result.meta} />
        </CardContent>
      </Card>
    </div>
  );
}
