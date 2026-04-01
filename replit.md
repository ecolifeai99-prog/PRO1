# AI-Driven Process Intelligence and Risk Governance Platform

## Overview

Single-service Flask web application for tracking process events and assessing AI-driven risk scores. Uses in-memory storage (no database) — data resets on server restart.

## Architecture

All logic lives in a single Flask app at `artifacts/risk-platform/app.py`. HTML templates are rendered server-side via Jinja2. Client-side interactivity is handled by vanilla JavaScript in the templates, with Chart.js (via CDN) for visualizations.

## Artifacts

- `artifacts/risk-platform` — Flask app (Python), preview at `/`

## Stack

- **Language**: Python 3
- **Framework**: Flask
- **Frontend**: Jinja2 templates + Tailwind CSS (CDN) + Chart.js (CDN)
- **Storage**: In-memory Python list (resets on restart)
- **Port**: Reads from `PORT` environment variable

## File Structure

```
artifacts/risk-platform/
├── app.py              # Flask app — all routes, risk logic, in-memory store
├── requirements.txt    # Python dependencies (flask)
├── templates/
│   ├── base.html       # Base layout with nav, toast system, shared JS helpers
│   ├── dashboard.html  # Command Center (stat cards, recent events, high-risk feed)
│   ├── add_event.html  # Record Event form with live analysis result panel
│   ├── risk_analysis.html  # Risk Log with filter/search and delete
│   ├── analytics.html  # Risk distribution (donut) + events-per-process (bar) charts
│   └── ai_engine.html  # ML algorithms, anomaly table, health index, trends, predictions
└── static/             # Static assets (optional CSS/JS overrides)
```

## Risk Logic

Risk Score = severity × likelihood

| Score | Level  | Recommendation               |
|-------|--------|------------------------------|
| 1–5   | Low    | No immediate action needed   |
| 6–12  | Medium | Monitor closely              |
| 13–25 | High   | Immediate attention required |

## API Routes (all served from the same Flask app)

### Events
- `GET /api/events` — All events with risk analysis
- `POST /api/events` — Create event (body: process_name, event_type, severity, likelihood)
- `GET /api/events/<id>` — Single event
- `DELETE /api/events/<id>` — Delete event

### Analytics
- `GET /api/analytics/summary` — Dashboard stats (totals, recent events)
- `GET /api/analytics/risk-distribution` — Risk level breakdown
- `GET /api/analytics/events-per-process` — Events per process for bar chart
- `GET /api/analytics/recent-activity` — Recent high-risk events

### ML / Intelligence
- `GET /api/ml/model-info` — Algorithm descriptions and metadata
- `GET /api/ml/anomalies` — Z-score anomaly detection results
- `GET /api/ml/trends` — EMA trend analysis per process
- `GET /api/ml/process-health` — Multi-factor health index
- `GET /api/ml/predictions` — OLS linear regression risk velocity
- `GET /api/ml/model-stats` — Aggregate model performance metrics

### Pages
- `GET /` → redirects to `/dashboard`
- `GET /dashboard` — Command Center
- `GET /add-event` — Record Event
- `GET /risk-analysis` — Risk Log
- `GET /analytics` — Risk Analytics
- `GET /ai-engine` — Intelligence Engine

## AI Algorithms

1. **Weighted Risk Matrix** — `(severity × 0.6 + likelihood × 0.4) × severity`
2. **Z-Score Anomaly Detector** — flags events > ±2σ from the population mean
3. **EMA Trend Detector** — α=0.3 exponential moving average per process
4. **Multi-Factor Process Health Index** — composite score 0–100
5. **OLS Linear Regression Risk Velocity** — forecasts next risk score with 95% CI
