# AI-Driven Process Intelligence and Risk Governance Platform

A single-service Flask web application for tracking process events and assessing risk using AI-driven scoring algorithms. All data is stored in memory — no external database required.

---

## Requirements

- Python 3.9+
- pip

---

## Setup

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd <repo-folder>
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows
```

### 3. Install dependencies

```bash
pip install -r artifacts/risk-platform/requirements.txt
```

---

## Running the app

```bash
cd artifacts/risk-platform
python app.py
```

The app will start on port **5000** by default.  
Open your browser at: [http://localhost:5000](http://localhost:5000)

To use a different port:

```bash
PORT=8080 python app.py
```

---

## Storage

All event data is stored **in memory only**. There is no database, no file writes, and no external dependencies. Data resets every time the server restarts. This is intentional — the application is designed to be fully self-contained and stateless between sessions.

The in-memory store is seeded with 36 sample events across 8 processes on startup, so the dashboard and analytics pages are populated immediately.

---

## Pages

| URL | Description |
|-----|-------------|
| `/dashboard` | Command Center — stats, recent events, high-risk feed |
| `/add-event` | Record a new process event and view live risk analysis |
| `/risk-analysis` | Full event log with filter, search, and delete |
| `/analytics` | Risk distribution chart and events-per-process bar chart |
| `/ai-engine` | ML model stats, anomaly detection, EMA trends, health index, predictions |

---

## API Endpoints

All endpoints are served by the same Flask process.

### Events

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | All events with risk analysis |
| `POST` | `/api/events` | Create a new event |
| `GET` | `/api/events/<id>` | Single event by ID |
| `DELETE` | `/api/events/<id>` | Delete an event |

**POST `/api/events` body (JSON):**
```json
{
  "process_name": "Payment Processing",
  "event_type": "Gateway Timeout",
  "severity": 4,
  "likelihood": 3
}
```
`severity` and `likelihood` must be integers between 1 and 5.

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/summary` | Totals, averages, and 5 most recent events |
| `GET` | `/api/analytics/risk-distribution` | Count of events per risk level |
| `GET` | `/api/analytics/events-per-process` | Event counts broken down by process and risk level |
| `GET` | `/api/analytics/recent-activity` | 5 most recent high-risk events |

### ML / Intelligence Engine

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ml/model-info` | Algorithm descriptions and metadata |
| `GET` | `/api/ml/model-stats` | Aggregate model performance metrics |
| `GET` | `/api/ml/anomalies` | Z-score anomaly detection results |
| `GET` | `/api/ml/trends` | EMA trend direction per process |
| `GET` | `/api/ml/process-health` | Multi-factor health index per process |
| `GET` | `/api/ml/predictions` | OLS linear regression risk forecasts |

---

## Risk Scoring

Risk Score = `severity × likelihood` (range: 1–25)

| Score Range | Level | Recommendation |
|-------------|-------|----------------|
| 1 – 5 | Low | No immediate action needed |
| 6 – 12 | Medium | Monitor closely |
| 13 – 25 | High | Immediate attention required |

---

## AI Algorithms

1. **Weighted Risk Matrix** — weighted score formula: `(severity × 0.6 + likelihood × 0.4) × severity`
2. **Z-Score Anomaly Detector** — flags events that deviate more than ±2σ from the population mean
3. **EMA Trend Detector** — exponential moving average (α = 0.3) to track risk direction per process
4. **Multi-Factor Process Health Index** — composite 0–100 health score per process
5. **OLS Linear Regression Risk Velocity** — predicts next risk score with 95% confidence interval

---

## Project Structure

```
artifacts/risk-platform/
├── app.py              # Flask application — all routes, risk logic, in-memory store
├── requirements.txt    # Python dependencies
├── templates/
│   ├── base.html           # Base layout with navigation and shared JS
│   ├── dashboard.html      # Command Center page
│   ├── add_event.html      # Record Event page
│   ├── risk_analysis.html  # Risk Log page
│   ├── analytics.html      # Analytics charts page
│   └── ai_engine.html      # Intelligence Engine page
└── static/             # Static assets (CSS/JS overrides if needed)
```
