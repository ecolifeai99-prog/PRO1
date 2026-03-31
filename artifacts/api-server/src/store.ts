/**
 * In-memory storage for process events.
 * Data resets on server restart — this is by design for the prototype.
 */

export interface ProcessEvent {
  id: string;
  process_name: string;
  event_type: string;
  severity: number;
  likelihood: number;
  timestamp: string;
}

export interface EventWithRisk extends ProcessEvent {
  risk_score: number;
  risk_level: "Low" | "Medium" | "High";
  recommendation: string;
}

// Global in-memory list of events (resets on restart)
export const events: ProcessEvent[] = [];

/**
 * AI Risk Logic — Weighted Rule-Based Scoring (Algorithm 1: Weighted Risk Matrix)
 *
 * Risk Score = severity × likelihood
 * Weighted Score = (severity × 0.6 + likelihood × 0.4) × severity (captures asymmetric impact)
 *
 * Risk Levels:
 *  1–5   → Low Risk
 *  6–12  → Medium Risk
 *  13–25 → High Risk
 *
 * Recommendations:
 *  High   → "Immediate attention required"
 *  Medium → "Monitor closely"
 *  Low    → "No immediate action needed"
 */
export function computeRisk(
  severity: number,
  likelihood: number,
): { risk_score: number; risk_level: "Low" | "Medium" | "High"; recommendation: string } {
  const risk_score = severity * likelihood;

  let risk_level: "Low" | "Medium" | "High";
  let recommendation: string;

  if (risk_score >= 13) {
    risk_level = "High";
    recommendation = "Immediate attention required";
  } else if (risk_score >= 6) {
    risk_level = "Medium";
    recommendation = "Monitor closely";
  } else {
    risk_level = "Low";
    recommendation = "No immediate action needed";
  }

  return { risk_score, risk_level, recommendation };
}

/**
 * Weighted Score — gives more weight to severity than likelihood.
 * Formula: (severity × 0.6 + likelihood × 0.4) × severity
 */
export function computeWeightedScore(severity: number, likelihood: number): number {
  return Math.round(((severity * 0.6 + likelihood * 0.4) * severity) * 100) / 100;
}

/**
 * Confidence Score — how confident the model is based on extremity of values.
 * Formula: 1 - (|severity - 3| + |likelihood - 3|) / 8
 * Values near extremes (1 or 5) get lower confidence; midrange values get higher.
 */
export function computeConfidence(severity: number, likelihood: number): number {
  const raw = 1 - (Math.abs(severity - 3) + Math.abs(likelihood - 3)) / 8;
  return Math.round(raw * 100) / 100;
}

/**
 * Contributing factors for an event — explains which dimensions drove the score.
 */
export function computeContributingFactors(severity: number, likelihood: number): string[] {
  const factors: string[] = [];
  if (severity >= 4) factors.push("High severity impact detected");
  if (likelihood >= 4) factors.push("High recurrence probability");
  if (severity * likelihood >= 13) factors.push("Combined risk exceeds critical threshold");
  if (severity === 5) factors.push("Maximum severity — critical business impact");
  if (likelihood === 5) factors.push("Near-certain recurrence predicted");
  if (severity <= 2 && likelihood <= 2) factors.push("Low exposure — within acceptable tolerance");
  if (factors.length === 0) factors.push("Moderate risk — within monitored parameters");
  return factors;
}

/**
 * Attach risk analysis to a stored event.
 */
export function withRisk(event: ProcessEvent): EventWithRisk {
  const risk = computeRisk(event.severity, event.likelihood);
  return { ...event, ...risk };
}

/**
 * Seed a rich dataset of sample events across multiple processes and days
 * to demonstrate all ML algorithms effectively.
 */
function seedSampleData(): void {
  const samples: (Omit<ProcessEvent, "id" | "timestamp"> & { hoursAgo: number })[] = [
    // Payment Processing — mixed, trending worse over time
    { process_name: "Payment Processing", event_type: "Gateway Timeout", severity: 2, likelihood: 3, hoursAgo: 240 },
    { process_name: "Payment Processing", event_type: "Transaction Rollback", severity: 3, likelihood: 3, hoursAgo: 192 },
    { process_name: "Payment Processing", event_type: "Duplicate Charge", severity: 4, likelihood: 2, hoursAgo: 144 },
    { process_name: "Payment Processing", event_type: "System Failure", severity: 5, likelihood: 4, hoursAgo: 96 },
    { process_name: "Payment Processing", event_type: "Fraud Detection Bypass", severity: 5, likelihood: 5, hoursAgo: 24 },

    // Data Pipeline — consistently high risk
    { process_name: "Data Pipeline", event_type: "Schema Mismatch", severity: 3, likelihood: 4, hoursAgo: 220 },
    { process_name: "Data Pipeline", event_type: "Data Loss", severity: 4, likelihood: 3, hoursAgo: 180 },
    { process_name: "Data Pipeline", event_type: "ETL Failure", severity: 4, likelihood: 4, hoursAgo: 120 },
    { process_name: "Data Pipeline", event_type: "Corrupt Batch", severity: 5, likelihood: 3, hoursAgo: 60 },
    { process_name: "Data Pipeline", event_type: "Replication Lag", severity: 3, likelihood: 5, hoursAgo: 12 },

    // User Authentication — improving over time (falling trend)
    { process_name: "User Authentication", event_type: "Brute Force Attempt", severity: 5, likelihood: 5, hoursAgo: 230 },
    { process_name: "User Authentication", event_type: "Unauthorized Access", severity: 5, likelihood: 3, hoursAgo: 190 },
    { process_name: "User Authentication", event_type: "Session Hijack", severity: 4, likelihood: 2, hoursAgo: 150 },
    { process_name: "User Authentication", event_type: "MFA Bypass Attempt", severity: 3, likelihood: 2, hoursAgo: 100 },
    { process_name: "User Authentication", event_type: "Token Expiry Issue", severity: 2, likelihood: 2, hoursAgo: 30 },

    // Order Fulfillment — stable medium risk
    { process_name: "Order Fulfillment", event_type: "Delay", severity: 3, likelihood: 4, hoursAgo: 210 },
    { process_name: "Order Fulfillment", event_type: "Stock Discrepancy", severity: 3, likelihood: 3, hoursAgo: 170 },
    { process_name: "Order Fulfillment", event_type: "Carrier API Failure", severity: 3, likelihood: 3, hoursAgo: 130 },
    { process_name: "Order Fulfillment", event_type: "Address Validation Error", severity: 2, likelihood: 4, hoursAgo: 80 },
    { process_name: "Order Fulfillment", event_type: "Return Processing Failure", severity: 3, likelihood: 3, hoursAgo: 40 },

    // Inventory Management — low risk
    { process_name: "Inventory Management", event_type: "Sync Error", severity: 2, likelihood: 3, hoursAgo: 200 },
    { process_name: "Inventory Management", event_type: "Count Mismatch", severity: 2, likelihood: 2, hoursAgo: 160 },
    { process_name: "Inventory Management", event_type: "Supplier Feed Delay", severity: 1, likelihood: 3, hoursAgo: 110 },
    { process_name: "Inventory Management", event_type: "Barcode Scan Error", severity: 1, likelihood: 2, hoursAgo: 70 },
    { process_name: "Inventory Management", event_type: "Warehouse System Lag", severity: 2, likelihood: 2, hoursAgo: 20 },

    // Audit Logging — anomaly outlier (very high after being low)
    { process_name: "Audit Logging", event_type: "Log Write Failure", severity: 1, likelihood: 2, hoursAgo: 215 },
    { process_name: "Audit Logging", event_type: "Storage Full Warning", severity: 2, likelihood: 2, hoursAgo: 175 },
    { process_name: "Audit Logging", event_type: "Log Rotation Error", severity: 2, likelihood: 1, hoursAgo: 135 },
    { process_name: "Audit Logging", event_type: "Compliance Breach", severity: 5, likelihood: 5, hoursAgo: 48 }, // Anomaly!
    { process_name: "Audit Logging", event_type: "Tamper Detection Alert", severity: 5, likelihood: 4, hoursAgo: 6 },

    // Notification Service — new process, limited data
    { process_name: "Notification Service", event_type: "SMS Delivery Failure", severity: 2, likelihood: 4, hoursAgo: 90 },
    { process_name: "Notification Service", event_type: "Email Queue Overflow", severity: 3, likelihood: 3, hoursAgo: 45 },
    { process_name: "Notification Service", event_type: "Push Token Invalid", severity: 1, likelihood: 5, hoursAgo: 10 },

    // Reporting Engine — sporadic issues
    { process_name: "Reporting Engine", event_type: "Report Timeout", severity: 2, likelihood: 3, hoursAgo: 185 },
    { process_name: "Reporting Engine", event_type: "Data Export Failure", severity: 3, likelihood: 2, hoursAgo: 115 },
    { process_name: "Reporting Engine", event_type: "Dashboard Crash", severity: 4, likelihood: 3, hoursAgo: 55 },
  ];

  const now = Date.now();
  samples.forEach((s, i) => {
    const { hoursAgo, ...rest } = s;
    const id = `seed-${i + 1}`;
    const timestamp = new Date(now - hoursAgo * 3_600_000).toISOString();
    events.push({ id, ...rest, timestamp });
  });
}

seedSampleData();
