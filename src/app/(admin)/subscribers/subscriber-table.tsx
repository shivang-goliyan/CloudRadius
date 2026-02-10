"use client";

import { useState, useTransition } from "react";
import type { Subscriber, Plan, NasDevice, Location } from "@prisma/client";
import type { SubscriberStatus } from "@prisma/client";
import { DataTable } from "@/components/tables/data-table";
import { getSubscriberColumns } from "./columns";
import { SubscriberForm } from "./subscriber-form";
import { deleteSubscriber, updateSubscriberStatus } from "./actions";
import { Button } from "@/components/ui/button";
import { Plus, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

type SubscriberWithRelations = Subscriber & {
  plan: Pick<Plan, "id" | "name" | "downloadSpeed" | "uploadSpeed" | "speedUnit"> | null;
  nasDevice: Pick<NasDevice, "id" | "name" | "nasIp"> | null;
  location: Pick<Location, "id" | "name" | "type"> | null;
};

interface SubscriberTableProps {
  data: SubscriberWithRelations[];
  plans: Plan[];
  nasDevices: NasDevice[];
  locations: Location[];
}

export function SubscriberTable({
  data,
  plans,
  nasDevices,
  locations,
}: SubscriberTableProps) {
  const [editSubscriber, setEditSubscriber] = useState<Subscriber | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [, startTransition] = useTransition();

  const handleEdit = (subscriber: SubscriberWithRelations) => {
    setEditSubscriber(subscriber);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this subscriber?")) return;
    startTransition(async () => {
      const result = await deleteSubscriber(id);
      if (result.success) {
        toast.success("Subscriber deleted");
      } else {
        toast.error(result.error ?? "Failed to delete");
      }
    });
  };

  const handleStatusChange = (id: string, status: string) => {
    startTransition(async () => {
      const result = await updateSubscriberStatus(id, status as SubscriberStatus);
      if (result.success) {
        toast.success(`Subscriber ${status.toLowerCase()}`);
      } else {
        toast.error(result.error ?? "Failed to update status");
      }
    });
  };

  const columns = getSubscriberColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
  });

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        searchPlaceholder="Search by name, phone, username..."
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { label: "Active", value: "ACTIVE" },
              { label: "Expired", value: "EXPIRED" },
              { label: "Suspended", value: "SUSPENDED" },
              { label: "Disabled", value: "DISABLED" },
              { label: "Trial", value: "TRIAL" },
            ],
          },
          {
            key: "connectionType",
            label: "Connection",
            options: [
              { label: "PPPoE", value: "PPPOE" },
              { label: "Hotspot", value: "HOTSPOT" },
              { label: "Static IP", value: "STATIC_IP" },
              { label: "MAC Bind", value: "MAC_BIND" },
            ],
          },
        ]}
        toolbar={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/subscribers/import">
                <Upload className="mr-2 h-4 w-4" /> Import CSV
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/subscribers/export">
                <Download className="mr-2 h-4 w-4" /> Export
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditSubscriber(null);
                setShowForm(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Subscriber
            </Button>
          </div>
        }
      />

      <SubscriberForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditSubscriber(null);
        }}
        subscriber={editSubscriber}
        plans={plans}
        nasDevices={nasDevices as NasDevice[]}
        locations={locations as Location[]}
      />
    </>
  );
}
