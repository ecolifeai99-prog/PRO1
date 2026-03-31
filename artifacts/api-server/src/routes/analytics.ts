import { Router, type IRouter } from "express";
import { events, withRisk } from "../store";

const router: IRouter = Router();

/**
 * GET /api/analytics/summary
 * Returns aggregate dashboard statistics.
 */
router.get("/analytics/summary", (_req, res) => {
  const eventsWithRisk = events.map(withRisk);

  const high_risk_count = eventsWithRisk.filter((e) => e.risk_level === "High").length;
  const medium_risk_count = eventsWithRisk.filter((e) => e.risk_level === "Medium").length;
  const low_risk_count = eventsWithRisk.filter((e) => e.risk_level === "Low").length;

  const avg_risk_score =
    eventsWithRisk.length === 0
      ? 0
      : Math.round(
          (eventsWithRisk.reduce((sum, e) => sum + e.risk_score, 0) / eventsWithRisk.length) * 10,
        ) / 10;

  // Return the 5 most recent events for the dashboard table
  const recent_events = [...eventsWithRisk]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  res.json({
    total_events: eventsWithRisk.length,
    high_risk_count,
    medium_risk_count,
    low_risk_count,
    avg_risk_score,
    recent_events,
  });
});

/**
 * GET /api/analytics/risk-distribution
 * Returns count of events per risk level (for pie chart).
 */
router.get("/analytics/risk-distribution", (_req, res) => {
  const eventsWithRisk = events.map(withRisk);

  const high = eventsWithRisk.filter((e) => e.risk_level === "High").length;
  const medium = eventsWithRisk.filter((e) => e.risk_level === "Medium").length;
  const low = eventsWithRisk.filter((e) => e.risk_level === "Low").length;

  res.json({ high, medium, low });
});

/**
 * GET /api/analytics/events-per-process
 * Returns event counts per process name, with breakdown by risk level (for bar chart).
 */
router.get("/analytics/events-per-process", (_req, res) => {
  const eventsWithRisk = events.map(withRisk);

  const processCounts: Record<
    string,
    { count: number; high_risk: number; medium_risk: number; low_risk: number }
  > = {};

  for (const event of eventsWithRisk) {
    if (!processCounts[event.process_name]) {
      processCounts[event.process_name] = { count: 0, high_risk: 0, medium_risk: 0, low_risk: 0 };
    }
    processCounts[event.process_name].count++;
    if (event.risk_level === "High") processCounts[event.process_name].high_risk++;
    else if (event.risk_level === "Medium") processCounts[event.process_name].medium_risk++;
    else processCounts[event.process_name].low_risk++;
  }

  const result = Object.entries(processCounts).map(([process_name, counts]) => ({
    process_name,
    ...counts,
  }));

  // Sort by count descending
  result.sort((a, b) => b.count - a.count);

  res.json(result);
});

/**
 * GET /api/analytics/recent-activity
 * Returns the 5 most recent high-risk events for the activity feed.
 */
router.get("/analytics/recent-activity", (_req, res) => {
  const eventsWithRisk = events.map(withRisk);

  const highRiskRecent = eventsWithRisk
    .filter((e) => e.risk_level === "High")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  res.json(highRiskRecent);
});

export default router;
