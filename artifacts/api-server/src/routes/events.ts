import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import {
  events,
  withRisk,
  computeWeightedScore,
  computeConfidence,
  computeContributingFactors,
  type ProcessEvent,
} from "../store";

const router: IRouter = Router();

/**
 * GET /api/events
 * Returns all events with risk analysis attached.
 */
router.get("/events", (_req, res) => {
  const result = events.map(withRisk);
  res.json(result);
});

/**
 * POST /api/events
 * Submit a new process event. AI risk logic is applied automatically.
 */
router.post("/events", (req, res) => {
  const { process_name, event_type, severity, likelihood } = req.body as {
    process_name?: string;
    event_type?: string;
    severity?: unknown;
    likelihood?: unknown;
  };

  // Validate required fields
  if (!process_name || typeof process_name !== "string" || !process_name.trim()) {
    res.status(400).json({ error: "process_name is required" });
    return;
  }
  if (!event_type || typeof event_type !== "string" || !event_type.trim()) {
    res.status(400).json({ error: "event_type is required" });
    return;
  }

  const sev = Number(severity);
  const lik = Number(likelihood);

  if (!Number.isInteger(sev) || sev < 1 || sev > 5) {
    res.status(400).json({ error: "severity must be an integer between 1 and 5" });
    return;
  }
  if (!Number.isInteger(lik) || lik < 1 || lik > 5) {
    res.status(400).json({ error: "likelihood must be an integer between 1 and 5" });
    return;
  }

  const newEvent: ProcessEvent = {
    id: randomUUID(),
    process_name: process_name.trim(),
    event_type: event_type.trim(),
    severity: sev,
    likelihood: lik,
    timestamp: new Date().toISOString(),
  };

  events.push(newEvent);

  // Compute full ML analysis for the response
  const riskData = withRisk(newEvent);
  const weighted_score = computeWeightedScore(sev, lik);
  const confidence = computeConfidence(sev, lik);
  const contributing_factors = computeContributingFactors(sev, lik);

  // Z-score anomaly detection against current population
  const allScores = events.map((e) => e.severity * e.likelihood);
  const mean = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  const variance = allScores.reduce((s, v) => s + (v - mean) ** 2, 0) / allScores.length;
  const stddev = Math.sqrt(variance) || 1;
  const zScore = (riskData.risk_score - mean) / stddev;
  const maxAbsZ = Math.max(
    ...allScores.map((s) => Math.abs((s - mean) / stddev)),
  ) || 1;
  const anomaly_score = Math.round((Math.abs(zScore) / maxAbsZ) * 100) / 100;
  const is_anomaly = Math.abs(zScore) > 2;

  res.status(201).json({
    ...riskData,
    weighted_score,
    anomaly_score,
    is_anomaly,
    confidence,
    contributing_factors,
  });
});

/**
 * GET /api/events/:id
 * Get a single event by ID with risk analysis.
 */
router.get("/events/:id", (req, res) => {
  const event = events.find((e) => e.id === req.params["id"]);
  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  res.json(withRisk(event));
});

/**
 * DELETE /api/events/:id
 * Delete an event by ID.
 */
router.delete("/events/:id", (req, res) => {
  const idx = events.findIndex((e) => e.id === req.params["id"]);
  if (idx === -1) {
    res.status(404).json({ error: "Event not found" });
    return;
  }
  events.splice(idx, 1);
  res.json({ success: true, message: "Event deleted successfully" });
});

export default router;
