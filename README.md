# AI-Driven Process Intelligence and Risk Governance Platform

This project is a Flask-based risk monitoring dashboard with login protection, live system telemetry, in-memory event tracking, and a trained risk model for analytics and prediction.

## What It Does

- Captures manual risk events through the UI and API
- Monitors the local machine with `psutil` for CPU, memory, disk, and high-usage processes
- Streams live updates to the dashboard with Server-Sent Events
- Computes risk scoring, anomaly detection, trend analysis, health scoring, and predictions
- Exposes a trained regression-based model from current event history instead of fixed placeholder metrics

## Requirements

- Python 3.11+ recommended
- `pip`

## Setup

From the project root:

```powershell
cd C:\Users\Lenovo\Desktop\anuseai\prod1\prod
python -m venv venv
venv\Scripts\activate
pip install -r artifacts\risk-platform\requirements.txt
```

If the bundled virtual environment already exists, you can reuse it.

## Run The App

```powershell
cd C:\Users\Lenovo\Desktop\anuseai\prod1\prod\artifacts\risk-platform
..\..\venv\Scripts\python.exe app.py
```

The app starts on `http://localhost:5000` by default.

To use a different port on Windows PowerShell:

```powershell
$env:PORT=8080
..\..\venv\Scripts\python.exe app.py
```

## Login

Default accounts:

- `admin / Admin123!`
- `user / User123!`

## Current Behavior

- Data is stored in memory only and resets on restart
- System monitoring starts automatically when the app loads
- Initial machine snapshots are captured on startup so the dashboard is not empty
- Realtime updates are available after login through `/stream`
- Health checks are available without login through `/api/health`

## Pages

| URL | Description |
|-----|-------------|
| `/login` | Sign-in page |
| `/dashboard` | Main command center with live metrics |
| `/add-event` | Create a manual event and view risk analysis |
| `/risk-analysis` | Full event log with delete support |
| `/analytics` | Aggregate charts and summaries |
| `/alerts` | High-risk alert feed |
| `/reports` | CSV export and summary data |
| `/ai-engine` | Model metrics, anomalies, trends, health, and predictions |

## API Endpoints

### Core

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | App health, monitor status, event count, model version |
| `GET` | `/api/system/status` | Live local-system telemetry and top processes |
| `GET` | `/stream` | Server-Sent Events stream for live UI refresh |

### Events

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/events` | All events with computed risk |
| `POST` | `/api/events` | Create a manual event |
| `GET` | `/api/events/<id>` | Fetch a single event |
| `DELETE` | `/api/events/<id>` | Delete an event |

Example request:

```json
{
  "process_name": "Payment Processing",
  "event_type": "Gateway Timeout",
  "severity": 4,
  "likelihood": 3
}
```

### Analytics

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/summary` | Totals, averages, and recent events |
| `GET` | `/api/analytics/risk-distribution` | Counts by risk level |
| `GET` | `/api/analytics/events-per-process` | Per-process event rollup |
| `GET` | `/api/analytics/recent-activity` | Most recent high-risk events |
| `GET` | `/api/alerts` | Current alert list |

### Intelligence / ML

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ml/model-info` | Live model metadata and algorithm descriptions |
| `GET` | `/api/ml/model-stats` | Trained-model metrics and aggregate statistics |
| `GET` | `/api/ml/anomalies` | Z-score anomaly results |
| `GET` | `/api/ml/trends` | EMA-based trend analysis per process |
| `GET` | `/api/ml/process-health` | Composite health score per process |
| `GET` | `/api/ml/predictions` | Forecasted risk scores using trained model plus trend data |

## Risk Model

The application uses two layers:

- Rule-based risk scoring: `severity * likelihood`
- Trained regression model: learns from current event history using severity, likelihood, and their interaction term

The AI engine also reports:

- Classification-style accuracy, precision, recall, and F1
- Regression metrics including MAE, RMSE, and R-squared
- Statistical anomaly detection
- EMA trend tracking
- Per-process health scoring

## Dependencies

- `flask>=3.0.0`
- `psutil>=5.9.0`

## Project Structure

```text
prod/
├── README.md
├── artifacts/
│   └── risk-platform/
│       ├── app.py
│       ├── requirements.txt
│       ├── templates/
│       │   ├── base.html
│       │   ├── login.html
│       │   ├── dashboard.html
│       │   ├── add_event.html
│       │   ├── risk_analysis.html
│       │   ├── analytics.html
│       │   ├── alerts.html
│       │   ├── reports.html
│       │   └── ai_engine.html
│       └── test_events.py
├── main.py
├── pyproject.toml
└── package.json
```
