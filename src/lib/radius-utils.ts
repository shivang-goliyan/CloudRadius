import type { Plan, SpeedUnit } from "@prisma/client";

/**
 * Builds MikroTik-Rate-Limit attribute value from Plan
 * Format: "{rx}/{tx} {burst_rx}/{burst_tx} {threshold_rx}/{threshold_tx} {burst_time}/{burst_time} {priority}"
 * Example: "50M/30M 100M/50M 100k/50k 10s/10s 1"
 */
export function buildMikroTikRateLimit(plan: Plan): string {
  const unit = plan.speedUnit === "MBPS" ? "M" : "k";
  const rx = `${plan.downloadSpeed}${unit}`;
  const tx = `${plan.uploadSpeed}${unit}`;

  // Burst parameters (optional)
  let burstRx = rx;
  let burstTx = tx;
  let thresholdRx = "0";
  let thresholdTx = "0";
  let time = "0s/0s";

  if (plan.burstDownloadSpeed && plan.burstUploadSpeed) {
    burstRx = `${plan.burstDownloadSpeed}${unit}`;
    burstTx = `${plan.burstUploadSpeed}${unit}`;

    if (plan.burstThreshold) {
      thresholdRx = `${plan.burstThreshold}k`;
      thresholdTx = `${plan.burstThreshold}k`;
    }

    if (plan.burstTime) {
      time = `${plan.burstTime}s/${plan.burstTime}s`;
    }
  }

  return `${rx}/${tx} ${burstRx}/${burstTx} ${thresholdRx}/${thresholdTx} ${time} ${plan.priority}`;
}

/**
 * Builds MikroTik-Rate-Limit for FUP (reduced speed after quota exceeded)
 */
export function buildFupRateLimit(
  fupDownloadSpeed: number,
  fupUploadSpeed: number,
  speedUnit: SpeedUnit,
  priority: number = 8
): string {
  const unit = speedUnit === "MBPS" ? "M" : "k";
  const rx = `${fupDownloadSpeed}${unit}`;
  const tx = `${fupUploadSpeed}${unit}`;

  return `${rx}/${tx} ${rx}/${tx} 0/0 0s/0s ${priority}`;
}

/**
 * Builds RADIUS username with tenant prefix for multi-tenant isolation
 * Format: {tenantSlug}_{subscriberUsername}
 */
export function buildRadiusUsername(
  tenantSlug: string,
  username: string
): string {
  return `${tenantSlug}_${username}`;
}

/**
 * Builds RADIUS groupname with tenant prefix for multi-tenant isolation
 * Format: {tenantSlug}_{planId}
 */
export function buildRadiusGroupname(
  tenantSlug: string,
  planId: string
): string {
  return `${tenantSlug}_${planId}`;
}

/**
 * Extracts subscriber username from RADIUS username (removes tenant prefix)
 */
export function extractSubscriberUsername(radiusUsername: string): string {
  const parts = radiusUsername.split("_");
  parts.shift(); // Remove tenant slug
  return parts.join("_"); // Handle usernames with underscores
}

/**
 * Converts Plan model to RADIUS group reply attributes
 */
export function planToRadiusAttributes(
  plan: Plan
): Array<{ attribute: string; value: string; priority: number }> {
  const attributes = [];

  // Primary bandwidth limit
  const rateLimit = buildMikroTikRateLimit(plan);
  attributes.push({
    attribute: "Mikrotik-Rate-Limit",
    value: rateLimit,
    priority: 1,
  });

  // IP pool assignment (if specified)
  if (plan.poolName) {
    attributes.push({
      attribute: "Framed-Pool",
      value: plan.poolName,
      priority: 2,
    });
  }

  // Session timeout for hour-based plans
  if (plan.validityUnit === "HOURS") {
    const seconds = plan.validityDays * 3600;
    attributes.push({
      attribute: "Session-Timeout",
      value: String(seconds),
      priority: 3,
    });
  }

  return attributes;
}
