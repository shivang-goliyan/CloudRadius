import { notFound } from "next/navigation";
import { requireTenantId } from "@/lib/session";
import { subscriberService } from "@/services/subscriber.service";
import { SubscriberProfile } from "./subscriber-profile";

export const metadata = {
  title: "Subscriber Profile",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SubscriberProfilePage({ params }: PageProps) {
  const { id } = await params;
  const tenantId = await requireTenantId();
  const subscriber = await subscriberService.getById(tenantId, id);

  if (!subscriber) {
    notFound();
  }

  return <SubscriberProfile subscriber={subscriber} />;
}
