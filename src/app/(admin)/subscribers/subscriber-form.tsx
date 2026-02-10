"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  subscriberSchema,
  subscriberUpdateSchema,
  type CreateSubscriberInput,
  type UpdateSubscriberInput,
} from "@/lib/validations/subscriber.schema";
import type { Subscriber, Plan, NasDevice, Location } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";
import { createSubscriber, updateSubscriber } from "./actions";
import { toast } from "sonner";

interface SubscriberFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriber?: Subscriber | null;
  plans: Plan[];
  nasDevices: NasDevice[];
  locations: Location[];
}

export function SubscriberForm({
  open,
  onOpenChange,
  subscriber,
  plans,
  nasDevices,
  locations,
}: SubscriberFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEditing = !!subscriber;

  const form = useForm<CreateSubscriberInput | UpdateSubscriberInput>({
    resolver: zodResolver(isEditing ? subscriberUpdateSchema : subscriberSchema),
    defaultValues: subscriber
      ? {
          name: subscriber.name,
          phone: subscriber.phone,
          email: subscriber.email ?? "",
          alternatePhone: subscriber.alternatePhone ?? "",
          address: subscriber.address ?? "",
          gpsCoordinates: subscriber.gpsCoordinates ?? "",
          subscriberType: subscriber.subscriberType,
          connectionType: subscriber.connectionType,
          username: subscriber.username,
          password: "",
          planId: subscriber.planId,
          nasDeviceId: subscriber.nasDeviceId,
          locationId: subscriber.locationId,
          macAddress: subscriber.macAddress ?? "",
          ipAddress: subscriber.ipAddress ?? "",
          staticIp: subscriber.staticIp ?? "",
          installationDate: subscriber.installationDate
            ? new Date(subscriber.installationDate).toISOString().split("T")[0]
            : "",
          expiryDate: subscriber.expiryDate
            ? new Date(subscriber.expiryDate).toISOString().split("T")[0]
            : "",
          status: subscriber.status,
          notes: subscriber.notes ?? "",
        }
      : {
          name: "",
          phone: "",
          email: "",
          username: "",
          password: "",
          subscriberType: "RESIDENTIAL",
          connectionType: "PPPOE",
          status: "ACTIVE",
        },
  });

  const onSubmit = (data: CreateSubscriberInput | UpdateSubscriberInput) => {
    startTransition(async () => {
      const result = subscriber
        ? await updateSubscriber(subscriber.id, data)
        : await createSubscriber(data);

      if (result.success) {
        toast.success(subscriber ? "Subscriber updated" : "Subscriber created");
        onOpenChange(false);
        form.reset();
      } else {
        toast.error(result.error ?? "Something went wrong");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {subscriber ? "Edit Subscriber" : "Add Subscriber"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Personal Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Personal Details</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Name *</Label>
                <Input {...form.register("name")} />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input {...form.register("phone")} />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...form.register("email")} />
              </div>
              <div className="space-y-2">
                <Label>Alternate Phone</Label>
                <Input {...form.register("alternatePhone")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea rows={2} {...form.register("address")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Subscriber Type</Label>
                <Select
                  value={form.watch("subscriberType")}
                  onValueChange={(v) =>
                    form.setValue("subscriberType", v as "RESIDENTIAL" | "COMMERCIAL")
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                    <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>GPS Coordinates</Label>
                <Input {...form.register("gpsCoordinates")} placeholder="lat,lng" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Connection Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Connection Details</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Username *</Label>
                <Input {...form.register("username")} />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.username.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{isEditing ? "Password (leave blank to keep)" : "Password *"}</Label>
                <Input type="password" {...form.register("password")} />
                {form.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Connection Type</Label>
                <Select
                  value={form.watch("connectionType")}
                  onValueChange={(v) =>
                    form.setValue(
                      "connectionType",
                      v as "PPPOE" | "HOTSPOT" | "STATIC_IP" | "MAC_BIND"
                    )
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PPPOE">PPPoE</SelectItem>
                    <SelectItem value="HOTSPOT">Hotspot</SelectItem>
                    <SelectItem value="STATIC_IP">Static IP</SelectItem>
                    <SelectItem value="MAC_BIND">MAC Binding</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>MAC Address</Label>
                <Input {...form.register("macAddress")} placeholder="AA:BB:CC:DD:EE:FF" />
              </div>
              <div className="space-y-2">
                <Label>IP Address</Label>
                <Input {...form.register("ipAddress")} />
              </div>
              <div className="space-y-2">
                <Label>Static IP</Label>
                <Input {...form.register("staticIp")} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Plan & Network Assignment */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Plan & Network</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select
                  value={form.watch("planId") ?? "none"}
                  onValueChange={(v) => form.setValue("planId", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No plan</SelectItem>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - ₹{Number(plan.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>NAS Device</Label>
                <Select
                  value={form.watch("nasDeviceId") ?? "none"}
                  onValueChange={(v) => form.setValue("nasDeviceId", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select NAS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No NAS</SelectItem>
                    {nasDevices.map((nas) => (
                      <SelectItem key={nas.id} value={nas.id}>
                        {nas.name} ({nas.nasIp})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Select
                  value={form.watch("locationId") ?? "none"}
                  onValueChange={(v) => form.setValue("locationId", v === "none" ? null : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No location</SelectItem>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name} ({loc.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue(
                      "status",
                      v as "ACTIVE" | "EXPIRED" | "DISABLED" | "SUSPENDED" | "TRIAL"
                    )
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="TRIAL">Trial</SelectItem>
                    <SelectItem value="EXPIRED">Expired</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                    <SelectItem value="DISABLED">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Dates & Notes */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Installation Date</Label>
                <Input type="date" {...form.register("installationDate")} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" {...form.register("expiryDate")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea rows={2} {...form.register("notes")} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {subscriber ? "Update Subscriber" : "Add Subscriber"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
