"use client";

import type { Subscriber, Plan, NasDevice, Location } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  User,
  Wifi,
  MapPin,
  Calendar,
  Phone,
  Mail,
  Globe,
  Router,
  Package,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { useTransition } from "react";
import { updateSubscriberStatus } from "../actions";
import { toast } from "sonner";
import type { SubscriberStatus } from "@prisma/client";

type SubscriberFull = Subscriber & {
  plan: Plan | null;
  nasDevice: (NasDevice & { location: Location | null }) | null;
  location: Location | null;
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  EXPIRED: "destructive",
  DISABLED: "secondary",
  SUSPENDED: "destructive",
  TRIAL: "outline",
};

export function SubscriberProfile({ subscriber }: { subscriber: SubscriberFull }) {
  const [, startTransition] = useTransition();

  const handleStatusChange = (status: SubscriberStatus) => {
    startTransition(async () => {
      const result = await updateSubscriberStatus(subscriber.id, status);
      if (result.success) toast.success(`Status changed to ${status}`);
      else toast.error(result.error ?? "Failed");
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/subscribers">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{subscriber.name}</h1>
            <Badge variant={statusVariant[subscriber.status] ?? "secondary"}>
              {subscriber.status}
            </Badge>
            <Badge variant="outline">{subscriber.connectionType}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">@{subscriber.username}</p>
        </div>
        <div className="flex gap-2">
          {subscriber.status !== "ACTIVE" && (
            <Button size="sm" onClick={() => handleStatusChange("ACTIVE")}>
              Activate
            </Button>
          )}
          {subscriber.status === "ACTIVE" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleStatusChange("SUSPENDED")}
            >
              Suspend
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="details" className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="complaints">Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" /> Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Phone} label="Phone" value={subscriber.phone} />
                {subscriber.alternatePhone && (
                  <InfoRow icon={Phone} label="Alt Phone" value={subscriber.alternatePhone} />
                )}
                {subscriber.email && (
                  <InfoRow icon={Mail} label="Email" value={subscriber.email} />
                )}
                {subscriber.address && (
                  <InfoRow icon={MapPin} label="Address" value={subscriber.address} />
                )}
                <InfoRow
                  icon={User}
                  label="Type"
                  value={subscriber.subscriberType}
                />
                {subscriber.gpsCoordinates && (
                  <InfoRow icon={Globe} label="GPS" value={subscriber.gpsCoordinates} />
                )}
              </CardContent>
            </Card>

            {/* Plan & Network */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4" /> Connection Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <InfoRow icon={Package} label="Plan" value={subscriber.plan?.name ?? "No plan"} />
                {subscriber.plan && (
                  <InfoRow
                    icon={Wifi}
                    label="Speed"
                    value={`${subscriber.plan.downloadSpeed}/${subscriber.plan.uploadSpeed} ${subscriber.plan.speedUnit}`}
                  />
                )}
                <InfoRow
                  icon={Router}
                  label="NAS"
                  value={
                    subscriber.nasDevice
                      ? `${subscriber.nasDevice.name} (${subscriber.nasDevice.nasIp})`
                      : "Not assigned"
                  }
                />
                <InfoRow
                  icon={MapPin}
                  label="Location"
                  value={subscriber.location?.name ?? "Not set"}
                />
                {subscriber.macAddress && (
                  <InfoRow icon={Wifi} label="MAC" value={subscriber.macAddress} />
                )}
                {subscriber.ipAddress && (
                  <InfoRow icon={Globe} label="IP" value={subscriber.ipAddress} />
                )}
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-4 w-4" /> Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {subscriber.installationDate && (
                  <InfoRow
                    icon={Calendar}
                    label="Installed"
                    value={format(new Date(subscriber.installationDate), "dd MMM yyyy")}
                  />
                )}
                {subscriber.lastRenewalDate && (
                  <InfoRow
                    icon={Calendar}
                    label="Last Renewed"
                    value={format(new Date(subscriber.lastRenewalDate), "dd MMM yyyy")}
                  />
                )}
                {subscriber.expiryDate && (
                  <InfoRow
                    icon={Calendar}
                    label="Expires"
                    value={format(new Date(subscriber.expiryDate), "dd MMM yyyy")}
                  />
                )}
                <InfoRow
                  icon={Calendar}
                  label="Created"
                  value={format(new Date(subscriber.createdAt), "dd MMM yyyy")}
                />
              </CardContent>
            </Card>

            {/* Notes */}
            {subscriber.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {subscriber.notes}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
              Billing history will be available in Phase 3
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
              Session history will be available in Phase 2
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="complaints">
          <Card>
            <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
              Complaints will be available in Phase 5
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm">{value}</p>
      </div>
    </div>
  );
}
