"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type RecordPaymentInput } from "@/lib/validations/payment.schema";
import type { Subscriber, Invoice } from "@prisma/client";
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
import { useTransition, useEffect, useState } from "react";
import { recordPayment } from "./actions";
import { toast } from "sonner";
import { PaymentMethod } from "@prisma/client";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscribers: Subscriber[];
  preSelectedInvoiceId?: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  subscribers,
  preSelectedInvoiceId,
}: RecordPaymentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedSubscriberId, setSelectedSubscriberId] = useState<string>("");
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      subscriberId: "",
      invoiceId: preSelectedInvoiceId || "",
      amount: 0,
      method: "CASH",
      transactionId: "",
      notes: "",
      status: "COMPLETED",
    },
  });

  // Fetch pending invoices when subscriber is selected
  useEffect(() => {
    if (selectedSubscriberId) {
      setLoadingInvoices(true);
      // In a real app, you'd fetch this from an API
      // For now, we'll just set it to empty
      setPendingInvoices([]);
      setLoadingInvoices(false);
    }
  }, [selectedSubscriberId]);

  const onSubmit = (data: RecordPaymentInput) => {
    startTransition(async () => {
      const result = await recordPayment(data);

      if (result.success) {
        toast.success("Payment recorded successfully");
        onOpenChange(false);
        form.reset();
      } else {
        toast.error(result.error ?? "Failed to record payment");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Subscriber Selection */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Subscriber</h4>
            <div className="space-y-2">
              <Label>Select Subscriber *</Label>
              <Select
                value={form.watch("subscriberId")}
                onValueChange={(value) => {
                  form.setValue("subscriberId", value);
                  setSelectedSubscriberId(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose subscriber..." />
                </SelectTrigger>
                <SelectContent>
                  {subscribers.map((subscriber) => (
                    <SelectItem key={subscriber.id} value={subscriber.id}>
                      {subscriber.name} ({subscriber.phone})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.subscriberId && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.subscriberId.message}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Invoice Selection (Optional) */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Invoice (Optional)</h4>
            <div className="space-y-2">
              <Label>Link to Invoice</Label>
              <Select
                value={form.watch("invoiceId")}
                onValueChange={(value) => form.setValue("invoiceId", value)}
                disabled={!selectedSubscriberId || loadingInvoices}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice (optional)..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No invoice</SelectItem>
                  {pendingInvoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {(invoice as any).invoiceNumber} - ₹
                      {Number((invoice as any).balanceDue).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!selectedSubscriberId && (
                <p className="text-xs text-muted-foreground">
                  Select a subscriber first to view pending invoices
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Payment Details</h4>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...form.register("amount", { valueAsNumber: true })}
                  placeholder="0.00"
                />
                {form.formState.errors.amount && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select
                  value={form.watch("method")}
                  onValueChange={(value) =>
                    form.setValue("method", value as PaymentMethod)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="PAYMENT_GATEWAY">Payment Gateway</SelectItem>
                    <SelectItem value="VOUCHER">Voucher</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors.method && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.method.message}
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Transaction ID / Reference Number</Label>
                <Input
                  {...form.register("transactionId")}
                  placeholder="e.g., UPI123456789, Cheque #12345"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Notes</h4>
            <div className="space-y-2">
              <Textarea
                {...form.register("notes")}
                placeholder="Additional notes (optional)..."
                rows={3}
              />
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
