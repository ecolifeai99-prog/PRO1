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
 * AI Risk Logic — rule-based scoring.
 *
 * Risk Score = severity × likelihood
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
 * Attach risk analysis to a stored event.
 */
export function withRisk(event: ProcessEvent): EventWithRisk {
  const risk = computeRisk(event.severity, event.likelihood);
  return { ...event, ...risk };
}

/**
 * Seed some initial sample events so the dashboard isn't empty on first load.
 */
function seedSampleData(): void {
  const samples: Omit<ProcessEvent, "id" | "timestamp">[] = [
    { process_name: "Payment Processing", event_type: "System Failure", severity: 5, likelihood: 4 },
    { process_name: "Data Pipeline", event_type: "Data Loss", severity: 4, likelihood: 3 },
    { process_name: "User Authentication", event_type: "Unauthorized Access", severity: 5, likelihood: 2 },
    { process_name: "Inventory Management", event_type: "Sync Error", severity: 2, likelihood: 3 },
    { process_name: "Order Fulfillment", event_type: "Delay", severity: 3, likelihood: 4 },
    { process_name: "Payment Processing", event_type: "Timeout", severity: 3, likelihood: 2 },
    { process_name: "Data Pipeline", event_type: "Schema Mismatch", severity: 4, likelihood: 4 },
    { process_name: "Audit Logging", event_type: "Log Failure", severity: 2, likelihood: 2 },
    { process_name: "User Authentication", event_type: "Brute Force Attempt", severity: 4, likelihood: 5 },
    { process_name: "Order Fulfillment", event_type: "Stock Discrepancy", severity: 3, likelihood: 3 },
  ];

  const now = Date.now();
  samples.forEach((s, i) => {
    const id = `seed-${i + 1}`;
    const timestamp = new Date(now - (samples.length - i) * 3_600_000).toISOString();
    events.push({ id, ...s, timestamp });
  });
}

seedSampleData();
