import os
import json
import math
import random
import queue
import threading
import time
import uuid
import logging
import csv
import io
import psutil
from datetime import datetime, timezone
from flask import Flask, Response, render_template, request, jsonify, redirect, url_for, stream_with_context, session
from werkzeug.security import check_password_hash, generate_password_hash

logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-please-change')

MODEL_VERSION = "3.0.0"
SYSTEM_MONITOR_THREAD = None
SYSTEM_MONITOR_LOCK = threading.Lock()

users = {
    'admin': {
        'username': 'admin',
        'password_hash': generate_password_hash('Admin123!'),
        'role': 'admin',
        'created_at': datetime.now(timezone.utc).isoformat(),
    },
    'user': {
        'username': 'user',
        'password_hash': generate_password_hash('User123!'),
        'role': 'user',
        'created_at': datetime.now(timezone.utc).isoformat(),
    },
}

alerts = []


def get_current_user():
    username = session.get('user')
    return users.get(username)


def risk_level_from_score(score):
    if score >= 13:
        return "High"
    if score >= 6:
        return "Medium"
    return "Low"


def severity_from_percent(percent):
    return min(5, max(1, int(percent / 20) + 1))


@app.context_processor
def inject_user():
    return {'current_user': get_current_user()}


def create_alert(event):
    alerts.append({
        'id': str(uuid.uuid4()),
        'event_id': event['id'],
        'process_name': event['process_name'],
        'severity': event['risk_score'],
        'message': f"High risk event: {event['event_type']}",
        'status': 'Open',
        'created_at': datetime.now(timezone.utc).isoformat(),
    })


@app.before_request
def ensure_logged_in():
    allowed = {'login', 'static', 'api_health'}
    if request.endpoint in allowed:
        return
    if session.get('user') is None:
        return redirect(url_for('login'))

# ---------------------------------------------------------------------------
# In-memory store (resets on restart by design)
# ---------------------------------------------------------------------------
events = []
clients = []
automation_enabled = True


def send_sse_packet(payload):
    return f"data: {json.dumps(payload)}\n\n"


def register_client():
    q = queue.Queue()
    clients.append(q)
    return q


def notify_clients(payload):
    for q in list(clients):
        try:
            q.put_nowait(payload)
        except queue.Full:
            pass


def event_stream():
    q = register_client()
    try:
        while True:
            payload = q.get()
            yield send_sse_packet(payload)
    finally:
        try:
            clients.remove(q)
        except ValueError:
            pass


def create_event_entry(process_name, event_type, severity, likelihood, source='manual'):
    new_event = {
        'id': str(uuid.uuid4()),
        'process_name': process_name,
        'event_type': event_type,
        'severity': severity,
        'likelihood': likelihood,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'source': source,
    }
    events.append(new_event)
    rich_event = with_risk(new_event)
    if rich_event['risk_level'] == 'High':
        create_alert(rich_event)
    notify_clients({
        'action': 'reload',
        'source': source,
        'event': rich_event,
    })
    return new_event


def capture_system_snapshot(source='system-bootstrap'):
    if not os.environ.get("ENABLE_SYSTEM_MONITOR", "1") == "1":
        return

    try:
        cpu_percent = psutil.cpu_percent(interval=0.2)
        memory_percent = psutil.virtual_memory().percent
        disk_percent = psutil.disk_usage(os.path.abspath(os.sep)).percent

        snapshot_metrics = [
            ("CPU Monitor", f"CPU Usage Snapshot: {cpu_percent:.1f}%", cpu_percent),
            ("Memory Monitor", f"Memory Usage Snapshot: {memory_percent:.1f}%", memory_percent),
            ("Disk Monitor", f"Disk Usage Snapshot: {disk_percent:.1f}%", disk_percent),
        ]

        for process_name, event_type, percent in snapshot_metrics:
            severity = severity_from_percent(percent)
            create_event_entry(
                process_name=process_name,
                event_type=event_type,
                severity=severity,
                likelihood=max(1, min(5, severity - 1 if severity > 1 else 1)),
                source=source,
            )

        top_processes = sorted(
            psutil.process_iter(['name', 'cpu_percent']),
            key=lambda proc: proc.info['cpu_percent'] or 0,
            reverse=True,
        )[:3]

        for proc in top_processes:
            cpu = proc.info['cpu_percent'] or 0
            if cpu <= 0:
                continue
            create_event_entry(
                process_name=f"Process: {proc.info['name'] or 'Unknown'}",
                event_type=f"Observed Process Load ({cpu:.1f}%)",
                severity=severity_from_percent(cpu),
                likelihood=max(1, severity_from_percent(cpu) - 1),
                source=source,
            )
    except Exception:
        logging.exception("Unable to capture initial system snapshot")


# ---------------------------------------------------------------------------
# Risk computation helpers
# ---------------------------------------------------------------------------

def compute_risk(severity, likelihood):
    risk_score = severity * likelihood
    if risk_score >= 13:
        risk_level = "High"
        recommendation = "Immediate attention required"
    elif risk_score >= 6:
        risk_level = "Medium"
        recommendation = "Monitor closely"
    else:
        risk_level = "Low"
        recommendation = "No immediate action needed"
    return {"risk_score": risk_score, "risk_level": risk_level, "recommendation": recommendation}


def compute_weighted_score(severity, likelihood):
    return round((severity * 0.6 + likelihood * 0.4) * severity, 2)


def compute_confidence(severity, likelihood):
    raw = 1 - (abs(severity - 3) + abs(likelihood - 3)) / 8
    return round(raw, 2)


def compute_contributing_factors(severity, likelihood):
    factors = []
    if severity >= 4:
        factors.append("High severity impact detected")
    if likelihood >= 4:
        factors.append("High recurrence probability")
    if severity * likelihood >= 13:
        factors.append("Combined risk exceeds critical threshold")
    if severity == 5:
        factors.append("Maximum severity - critical business impact")
    if likelihood == 5:
        factors.append("Near-certain recurrence predicted")
    if severity <= 2 and likelihood <= 2:
        factors.append("Low exposure - within acceptable tolerance")
    if not factors:
        factors.append("Moderate risk - within monitored parameters")
    return factors


def with_risk(event):
    risk = compute_risk(event["severity"], event["likelihood"])
    return {**event, **risk}


def predict_risk_score(coefficients, severity, likelihood):
    return (
        coefficients[0]
        + coefficients[1] * severity
        + coefficients[2] * likelihood
        + coefficients[3] * severity * likelihood
    )


def solve_linear_system(matrix, vector):
    size = len(vector)
    augmented = [row[:] + [vector[i]] for i, row in enumerate(matrix)]

    for col in range(size):
        pivot_row = max(range(col, size), key=lambda row: abs(augmented[row][col]))
        pivot = augmented[pivot_row][col]
        if abs(pivot) < 1e-9:
            return None

        if pivot_row != col:
            augmented[col], augmented[pivot_row] = augmented[pivot_row], augmented[col]

        pivot = augmented[col][col]
        for j in range(col, size + 1):
            augmented[col][j] /= pivot

        for row in range(size):
            if row == col:
                continue
            factor = augmented[row][col]
            if abs(factor) < 1e-12:
                continue
            for j in range(col, size + 1):
                augmented[row][j] -= factor * augmented[col][j]

    return [augmented[i][size] for i in range(size)]


def compute_classification_metrics(actual_levels, predicted_levels):
    labels = ["Low", "Medium", "High"]
    total = len(actual_levels)
    accuracy = sum(1 for actual, predicted in zip(actual_levels, predicted_levels) if actual == predicted) / total if total else 0

    precisions = []
    recalls = []
    f1_scores = []
    for label in labels:
        true_positive = sum(1 for actual, predicted in zip(actual_levels, predicted_levels) if actual == label and predicted == label)
        false_positive = sum(1 for actual, predicted in zip(actual_levels, predicted_levels) if actual != label and predicted == label)
        false_negative = sum(1 for actual, predicted in zip(actual_levels, predicted_levels) if actual == label and predicted != label)

        precision = true_positive / (true_positive + false_positive) if (true_positive + false_positive) else 0
        recall = true_positive / (true_positive + false_negative) if (true_positive + false_negative) else 0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0

        precisions.append(precision)
        recalls.append(recall)
        f1_scores.append(f1)

    return {
        "accuracy": round(accuracy, 3),
        "precision": round(sum(precisions) / len(precisions), 3),
        "recall": round(sum(recalls) / len(recalls), 3),
        "f1_score": round(sum(f1_scores) / len(f1_scores), 3),
    }


def train_live_risk_model():
    wr = [with_risk(event) for event in events]
    if not wr:
        return {
            "trained": False,
            "training_samples": 0,
            "coefficients": [0.0, 0.0, 0.0, 1.0],
            "metrics": {
                "mae": 0,
                "rmse": 0,
                "r2_score": 0,
                "accuracy": 0,
                "precision": 0,
                "recall": 0,
                "f1_score": 0,
            },
            "predictions": [],
            "last_trained": None,
        }

    feature_count = 4
    regularization = 1e-3
    xtx = [[0.0 for _ in range(feature_count)] for _ in range(feature_count)]
    xty = [0.0 for _ in range(feature_count)]

    for event in wr:
        features = [1.0, float(event["severity"]), float(event["likelihood"]), float(event["severity"] * event["likelihood"])]
        target = float(event["risk_score"])
        for i in range(feature_count):
            xty[i] += features[i] * target
            for j in range(feature_count):
                xtx[i][j] += features[i] * features[j]

    for i in range(1, feature_count):
        xtx[i][i] += regularization

    coefficients = solve_linear_system(xtx, xty) or [0.0, 0.0, 0.0, 1.0]

    predictions = []
    actual_scores = []
    predicted_scores = []
    actual_levels = []
    predicted_levels = []

    for event in wr:
        predicted_score = max(1.0, min(25.0, predict_risk_score(coefficients, event["severity"], event["likelihood"])))
        predictions.append({"id": event["id"], "predicted_score": round(predicted_score, 2)})
        actual_scores.append(float(event["risk_score"]))
        predicted_scores.append(predicted_score)
        actual_levels.append(event["risk_level"])
        predicted_levels.append(risk_level_from_score(predicted_score))

    count = len(actual_scores)
    mae = sum(abs(actual - predicted) for actual, predicted in zip(actual_scores, predicted_scores)) / count
    mse = sum((actual - predicted) ** 2 for actual, predicted in zip(actual_scores, predicted_scores)) / count
    rmse = math.sqrt(mse)
    mean_actual = sum(actual_scores) / count
    ss_tot = sum((actual - mean_actual) ** 2 for actual in actual_scores)
    ss_res = sum((actual - predicted) ** 2 for actual, predicted in zip(actual_scores, predicted_scores))
    r2_score = 1 - (ss_res / ss_tot) if ss_tot else 1.0
    class_metrics = compute_classification_metrics(actual_levels, predicted_levels)

    return {
        "trained": True,
        "training_samples": count,
        "coefficients": [round(value, 4) for value in coefficients],
        "metrics": {
            "mae": round(mae, 3),
            "rmse": round(rmse, 3),
            "r2_score": round(r2_score, 3),
            **class_metrics,
        },
        "predictions": predictions,
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }


# ---------------------------------------------------------------------------
# Seed data removed, now using real-time psutil source only
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# HTML page routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    if session.get('user'):
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('user'):
        return redirect(url_for('dashboard'))

    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        user = users.get(username)
        if not user or not check_password_hash(user['password_hash'], password):
            error = 'Invalid username or password.'
        else:
            session['user'] = username
            session['role'] = user['role']
            return redirect(url_for('dashboard'))

    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


@app.route('/alerts')
def alerts_page():
    return render_template('alerts.html', active='alerts')


@app.route('/reports')
def reports_page():
    return render_template('reports.html', active='reports')


@app.route('/reports/download')
def reports_download():
    fieldnames = [
        'id', 'process_name', 'event_type', 'severity', 'likelihood',
        'risk_score', 'risk_level', 'recommendation', 'confidence', 'created_at', 'source'
    ]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(fieldnames)

    for e in events:
        e.setdefault('source', 'manual')
        e.setdefault('timestamp', '')
        try:
            risk = with_risk(e)
        except Exception:
            logging.exception('with_risk failed for event; using fallback compute_risk')
            risk = compute_risk(e.get('severity', 0), e.get('likelihood', 0))

        writer.writerow([
            e.get('id', ''),
            e.get('process_name', ''),
            e.get('event_type', ''),
            e.get('severity', ''),
            e.get('likelihood', ''),
            risk.get('risk_score', ''),
            risk.get('risk_level', ''),
            risk.get('recommendation', ''),
            compute_confidence(e.get('severity', 0), e.get('likelihood', 0)),
            e.get('timestamp', ''),
            e.get('source', 'manual'),
        ])

    data = output.getvalue()
    output.close()

    return Response(
        data,
        mimetype='text/csv',
        headers={'Content-Disposition': 'attachment; filename="risk-report.csv"'}
    )


@app.route('/api/alerts')
def api_get_alerts():
    return jsonify(alerts)


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", active="dashboard")


@app.route("/add-event")
def add_event():
    return render_template("add_event.html", active="add_event")


@app.route("/risk-analysis")
def risk_analysis():
    return render_template("risk_analysis.html", active="risk_analysis")


@app.route("/analytics")
def analytics():
    return render_template("analytics.html", active="analytics")


@app.route("/ai-engine")
def ai_engine():
    return render_template("ai_engine.html", active="ai_engine")


# ---------------------------------------------------------------------------
# API — Events
# ---------------------------------------------------------------------------

@app.route("/api/events", methods=["GET"])
def api_get_events():
    return jsonify([with_risk(e) for e in events])


@app.route("/api/events", methods=["POST"])
def api_create_event():
    data = request.get_json(force=True) or {}
    process_name = data.get("process_name", "").strip()
    event_type = data.get("event_type", "").strip()
    severity = data.get("severity")
    likelihood = data.get("likelihood")

    if not process_name:
        return jsonify({"error": "process_name is required"}), 400
    if not event_type:
        return jsonify({"error": "event_type is required"}), 400

    try:
        sev = int(severity)
        lik = int(likelihood)
    except (TypeError, ValueError):
        return jsonify({"error": "severity and likelihood must be integers"}), 400

    if not (1 <= sev <= 5):
        return jsonify({"error": "severity must be an integer between 1 and 5"}), 400
    if not (1 <= lik <= 5):
        return jsonify({"error": "likelihood must be an integer between 1 and 5"}), 400

    new_event = create_event_entry(process_name, event_type, sev, lik, source='manual')
    risk_data = with_risk(new_event)
    weighted_score = compute_weighted_score(sev, lik)
    confidence = compute_confidence(sev, lik)
    contributing_factors = compute_contributing_factors(sev, lik)

    all_scores = [e["severity"] * e["likelihood"] for e in events]
    mean = sum(all_scores) / len(all_scores)
    variance = sum((s - mean) ** 2 for s in all_scores) / len(all_scores)
    stddev = math.sqrt(variance) or 1
    z_score = (risk_data["risk_score"] - mean) / stddev
    max_abs_z = max(abs((s - mean) / stddev) for s in all_scores) or 1
    anomaly_score = round(abs(z_score) / max_abs_z, 2)
    is_anomaly = abs(z_score) > 2

    return jsonify({
        **risk_data,
        "weighted_score": weighted_score,
        "anomaly_score": anomaly_score,
        "is_anomaly": is_anomaly,
        "confidence": confidence,
        "contributing_factors": contributing_factors,
    }), 201


@app.route("/api/events/<event_id>", methods=["GET"])
def api_get_event(event_id):
    event = next((e for e in events if e["id"] == event_id), None)
    if not event:
        return jsonify({"error": "Event not found"}), 404
    return jsonify(with_risk(event))


@app.route("/api/events/<event_id>", methods=["DELETE"])
def api_delete_event(event_id):
    idx = next((i for i, e in enumerate(events) if e["id"] == event_id), None)
    if idx is None:
        return jsonify({"error": "Event not found"}), 404
    deleted = events.pop(idx)
    notify_clients({
        'action': 'reload',
        'source': 'delete',
        'event': with_risk(deleted),
    })
    return jsonify({"success": True, "message": "Event deleted successfully"})


# ---------------------------------------------------------------------------
# API — Analytics
# ---------------------------------------------------------------------------

@app.route("/api/analytics/summary")
def api_analytics_summary():
    wr = [with_risk(e) for e in events]
    high = sum(1 for e in wr if e["risk_level"] == "High")
    medium = sum(1 for e in wr if e["risk_level"] == "Medium")
    low = sum(1 for e in wr if e["risk_level"] == "Low")
    avg = round(sum(e["risk_score"] for e in wr) / len(wr), 1) if wr else 0
    recent = sorted(wr, key=lambda e: e["timestamp"], reverse=True)[:5]
    return jsonify({
        "total_events": len(wr),
        "active_alerts": len(alerts),
        "high_risk_count": high,
        "medium_risk_count": medium,
        "low_risk_count": low,
        "avg_risk_score": avg,
        "recent_events": recent,
    })


@app.route("/api/analytics/risk-distribution")
def api_risk_distribution():
    wr = [with_risk(e) for e in events]
    return jsonify({
        "high": sum(1 for e in wr if e["risk_level"] == "High"),
        "medium": sum(1 for e in wr if e["risk_level"] == "Medium"),
        "low": sum(1 for e in wr if e["risk_level"] == "Low"),
    })


@app.route("/api/analytics/events-per-process")
def api_events_per_process():
    wr = [with_risk(e) for e in events]
    counts = {}
    for e in wr:
        p = e["process_name"]
        if p not in counts:
            counts[p] = {"count": 0, "high_risk": 0, "medium_risk": 0, "low_risk": 0}
        counts[p]["count"] += 1
        if e["risk_level"] == "High":
            counts[p]["high_risk"] += 1
        elif e["risk_level"] == "Medium":
            counts[p]["medium_risk"] += 1
        else:
            counts[p]["low_risk"] += 1
    result = [{"process_name": k, **v} for k, v in counts.items()]
    result.sort(key=lambda x: x["count"], reverse=True)
    return jsonify(result)


@app.route("/api/analytics/recent-activity")
def api_recent_activity():
    wr = [with_risk(e) for e in events]
    high_risk = [e for e in wr if e["risk_level"] == "High"]
    high_risk.sort(key=lambda e: e["timestamp"], reverse=True)
    return jsonify(high_risk[:5])


# ---------------------------------------------------------------------------
# API — ML
# ---------------------------------------------------------------------------

@app.route("/api/ml/model-info")
def api_ml_model_info():
    model = train_live_risk_model()
    return jsonify({
        "model_version": MODEL_VERSION,
        "total_algorithms": 4,
        "last_trained": model["last_trained"],
        "training_samples": model["training_samples"],
        "coefficients": model["coefficients"],
        "algorithms": [
            {
                "name": "Polynomial Risk Regressor",
                "type": "Trained Regression Model",
                "description": "Learns live relationships between severity, likelihood, and their interaction term using regularized least-squares regression on the current event history.",
                "formula": "score = b0 + b1*severity + b2*likelihood + b3*(severity*likelihood)",
                "use_case": "Primary trained model used for score estimation and model quality metrics",
                "accuracy": model["metrics"]["accuracy"],
            },
            {
                "name": "Z-Score Anomaly Detector",
                "type": "Statistical Anomaly Detection",
                "description": "Computes how many standard deviations a risk score deviates from the population mean. Events beyond +/-2 standard deviations are flagged as statistical anomalies requiring out-of-band investigation.",
                "formula": "Z = (x - mean) / stddev | AnomalyScore = |Z| / max(|Z|) across events",
                "use_case": "Detecting unusual events that deviate from historical norms",
                "accuracy": max(0.5, model["metrics"]["precision"]),
            },
            {
                "name": "Exponential Moving Average (EMA) Trend Detector",
                "type": "Time-Series Analysis",
                "description": "Applies EMA with alpha=0.3 to a process's chronological risk scores. Recent observations are weighted more heavily than older ones. Trend direction is determined by comparing the current EMA to the prior period's EMA.",
                "formula": "EMA_t = alpha * score_t + (1 - alpha) * EMA_(t-1) | alpha = 0.3",
                "use_case": "Tracking whether a process's risk is rising, falling, or stable over time",
                "accuracy": max(0.5, model["metrics"]["recall"]),
            },
            {
                "name": "Multi-Factor Process Health Index",
                "type": "Composite Scoring",
                "description": "Synthesizes four weighted metrics: average severity (30%), average likelihood (25%), high-risk event ratio (30%), and recency penalty (15%). Yields a 0–100 health score where 100 is fully healthy.",
                "formula": "Health = 100 - (avgSev*0.3 + avgLik*0.25 + highRiskRatio*0.30 + recencyPenalty*0.15) * 20",
                "use_case": "Producing a unified operational health score per monitored process",
                "accuracy": max(0.5, model["metrics"]["f1_score"]),
            },
        ],
    })


@app.route("/api/ml/anomalies")
def api_ml_anomalies():
    wr = [with_risk(e) for e in events]
    if not wr:
        return jsonify([])
    scores = [e["risk_score"] for e in wr]
    mean = sum(scores) / len(scores)
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    stddev = math.sqrt(variance) or 1
    z_scores = [(e, (e["risk_score"] - mean) / stddev) for e in wr]
    max_abs_z = max(abs(z) for _, z in z_scores) or 1
    result = [
        {
            "id": e["id"],
            "process_name": e["process_name"],
            "event_type": e["event_type"],
            "risk_score": e["risk_score"],
            "z_score": round(z, 2),
            "anomaly_score": round(abs(z) / max_abs_z, 2),
            "is_anomaly": abs(z) > 2,
            "timestamp": e["timestamp"],
        }
        for e, z in z_scores
    ]
    result.sort(key=lambda x: x["anomaly_score"], reverse=True)
    return jsonify(result)


@app.route("/api/ml/trends")
def api_ml_trends():
    wr = [with_risk(e) for e in events]
    ALPHA = 0.3
    by_process = {}
    for e in wr:
        by_process.setdefault(e["process_name"], []).append(e)

    result = []
    for process_name, evts in by_process.items():
        sorted_evts = sorted(evts, key=lambda e: e["timestamp"])
        ema = sorted_evts[0]["risk_score"]
        time_series = []
        for e in sorted_evts:
            ema = ALPHA * e["risk_score"] + (1 - ALPHA) * ema
            time_series.append({"timestamp": e["timestamp"], "risk_score": e["risk_score"], "ema": round(ema, 2)})

        ema_current = time_series[-1]["ema"]
        ema_previous = time_series[-2]["ema"] if len(time_series) > 1 else ema_current
        diff = ema_current - ema_previous
        trend_direction = "rising" if diff > 0.3 else ("falling" if diff < -0.3 else "stable")
        trend_strength = round(min(1, abs(diff) / 5), 2)

        result.append({
            "process_name": process_name,
            "ema_current": ema_current,
            "ema_previous": round(ema_previous, 2),
            "trend_direction": trend_direction,
            "trend_strength": trend_strength,
            "event_count": len(sorted_evts),
            "time_series": time_series,
        })

    result.sort(key=lambda x: x["ema_current"], reverse=True)
    return jsonify(result)


@app.route("/api/ml/process-health")
def api_ml_process_health():
    wr = [with_risk(e) for e in events]
    now_ms = datetime.now(timezone.utc).timestamp() * 1000
    by_process = {}
    for e in wr:
        by_process.setdefault(e["process_name"], []).append(e)

    result = []
    for process_name, evts in by_process.items():
        count = len(evts)
        avg_severity = sum(e["severity"] for e in evts) / count
        avg_likelihood = sum(e["likelihood"] for e in evts) / count
        high_risk_ratio = sum(1 for e in evts if e["risk_level"] == "High") / count

        recent_high = sum(
            1 for e in evts
            if e["risk_level"] == "High" and now_ms - datetime.fromisoformat(e["timestamp"]).timestamp() * 1000 < 72 * 3_600_000
        )
        recency_penalty = min(1, recent_high / 3)

        penalty_score = (
            (avg_severity - 1) / 4 * 0.30
            + (avg_likelihood - 1) / 4 * 0.25
            + high_risk_ratio * 0.30
            + recency_penalty * 0.15
        )
        health_score = max(0, round((1 - penalty_score) * 100))

        if health_score >= 80:
            health_label = "Excellent"
        elif health_score >= 60:
            health_label = "Good"
        elif health_score >= 40:
            health_label = "Fair"
        elif health_score >= 20:
            health_label = "Poor"
        else:
            health_label = "Critical"

        result.append({
            "process_name": process_name,
            "health_score": health_score,
            "health_label": health_label,
            "event_count": count,
            "avg_severity": round(avg_severity, 2),
            "avg_likelihood": round(avg_likelihood, 2),
            "high_risk_ratio": round(high_risk_ratio, 2),
            "recency_penalty": round(recency_penalty, 2),
        })

    result.sort(key=lambda x: x["health_score"])
    return jsonify(result)


@app.route("/api/ml/predictions")
def api_ml_predictions():
    wr = [with_risk(e) for e in events]
    model = train_live_risk_model()
    by_process = {}
    for e in wr:
        by_process.setdefault(e["process_name"], []).append(e)

    result = []
    for process_name, evts in by_process.items():
        sorted_evts = sorted(evts, key=lambda e: e["timestamp"])
        n = len(sorted_evts)
        xs = list(range(n))
        ys = [e["risk_score"] for e in sorted_evts]

        x_mean = sum(xs) / n
        y_mean = sum(ys) / n

        ss_xy = sum((xs[i] - x_mean) * (ys[i] - y_mean) for i in range(n))
        ss_xx = sum((x - x_mean) ** 2 for x in xs)

        slope = ss_xy / ss_xx if ss_xx != 0 else 0
        intercept = y_mean - slope * x_mean

        recent_window = sorted_evts[-5:]
        avg_severity = sum(e["severity"] for e in recent_window) / len(recent_window)
        avg_likelihood = sum(e["likelihood"] for e in recent_window) / len(recent_window)
        trained_prediction = predict_risk_score(model["coefficients"], avg_severity, avg_likelihood)
        trend_prediction = intercept + slope * n
        predicted = (trained_prediction + trend_prediction) / 2
        residuals = [ys[i] - (intercept + slope * xs[i]) for i in range(n)]
        rse = math.sqrt(sum(r ** 2 for r in residuals) / (n - 2)) if n > 2 else 2
        ci_half = 1.96 * rse

        predicted_clamped = max(1, min(25, round(predicted, 1)))
        predicted_risk_level = "High" if predicted_clamped >= 13 else ("Medium" if predicted_clamped >= 6 else "Low")

        result.append({
            "process_name": process_name,
            "risk_velocity": round(slope, 2),
            "predicted_risk_score": predicted_clamped,
            "predicted_risk_level": predicted_risk_level,
            "confidence_interval_low": max(1, round(predicted - ci_half, 1)),
            "confidence_interval_high": min(25, round(predicted + ci_half, 1)),
            "model_score_estimate": round(max(1, min(25, trained_prediction)), 1),
            "regression_slope": round(slope, 3),
            "data_points": n,
        })

    result.sort(key=lambda x: x["risk_velocity"], reverse=True)
    return jsonify(result)


@app.route("/api/ml/model-stats")
def api_ml_model_stats():
    wr = [with_risk(e) for e in events]
    model = train_live_risk_model()
    n = len(wr)
    if n == 0:
        return jsonify({
            "total_events_analyzed": 0, "anomalies_detected": 0, "anomaly_rate": 0,
            "avg_confidence": 0, "processes_monitored": 0, "high_risk_processes": 0,
            "model_accuracy": 0, "precision": 0, "recall": 0, "f1_score": 0,
            "mae": 0, "rmse": 0, "r2_score": 0,
        })

    scores = [e["risk_score"] for e in wr]
    mean = sum(scores) / n
    variance = sum((s - mean) ** 2 for s in scores) / n
    stddev = math.sqrt(variance) or 1
    anomaly_count = sum(1 for s in scores if abs((s - mean) / stddev) > 2)
    anomaly_rate = round(anomaly_count / n, 3)

    processes = set(e["process_name"] for e in wr)
    high_risk_processes = set(e["process_name"] for e in wr if e["risk_level"] == "High")

    avg_confidence = round(
        sum(1 - (abs(e["severity"] - 3) + abs(e["likelihood"] - 3)) / 8 for e in wr) / n, 2
    )

    return jsonify({
        "total_events_analyzed": n,
        "anomalies_detected": anomaly_count,
        "anomaly_rate": anomaly_rate,
        "avg_confidence": avg_confidence,
        "processes_monitored": len(processes),
        "high_risk_processes": len(high_risk_processes),
        "model_accuracy": model["metrics"]["accuracy"],
        "precision": model["metrics"]["precision"],
        "recall": model["metrics"]["recall"],
        "f1_score": model["metrics"]["f1_score"],
        "mae": model["metrics"]["mae"],
        "rmse": model["metrics"]["rmse"],
        "r2_score": model["metrics"]["r2_score"],
    })


@app.route("/stream")
def stream():
    return Response(
        stream_with_context(event_stream()),
        content_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def ensure_system_monitor_started():
    global SYSTEM_MONITOR_THREAD

    if os.environ.get("ENABLE_SYSTEM_MONITOR", "1") != "1":
        return

    with SYSTEM_MONITOR_LOCK:
        if SYSTEM_MONITOR_THREAD and SYSTEM_MONITOR_THREAD.is_alive():
            return

        if not events:
            capture_system_snapshot()

        SYSTEM_MONITOR_THREAD = threading.Thread(target=sync_events_from_source, daemon=True)
        SYSTEM_MONITOR_THREAD.start()
        logging.info("System monitor started")


def sync_events_from_source():
    """
    Stable real-time monitoring using psutil
    Prevents event flooding + handles errors safely
    """
    last_cpu = psutil.cpu_percent(interval=None)
    last_memory = psutil.virtual_memory().percent
    last_disk = psutil.disk_usage(os.path.abspath(os.sep)).percent

    while True:
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory().percent
            disk = psutil.disk_usage(os.path.abspath(os.sep)).percent

            # Only log if change is significant (avoid spam)
            if abs(cpu_percent - last_cpu) > 5:
                severity = severity_from_percent(cpu_percent)
                likelihood = severity

                create_event_entry(
                    process_name="CPU Monitor",
                    event_type=f"CPU Usage: {cpu_percent:.1f}%",
                    severity=severity,
                    likelihood=likelihood,
                    source="system"
                )

                last_cpu = cpu_percent

            if abs(memory - last_memory) > 5:
                severity = severity_from_percent(memory)
                likelihood = severity

                create_event_entry(
                    process_name="Memory Monitor",
                    event_type=f"Memory Usage: {memory:.1f}%",
                    severity=severity,
                    likelihood=likelihood,
                    source="system"
                )

                last_memory = memory

            if abs(disk - last_disk) > 3:
                severity = severity_from_percent(disk)
                create_event_entry(
                    process_name="Disk Monitor",
                    event_type=f"Disk Usage: {disk:.1f}%",
                    severity=severity,
                    likelihood=max(1, severity - 1),
                    source="system"
                )
                last_disk = disk

            # Monitor suspicious processes (top 3 only)
            try:
                processes = sorted(
                    psutil.process_iter(['name', 'cpu_percent']),
                    key=lambda p: p.info['cpu_percent'] or 0,
                    reverse=True
                )[:3]

                for proc in processes:
                    cpu = proc.info['cpu_percent'] or 0

                    if cpu > 50:
                        create_event_entry(
                            process_name=f"Process: {proc.info['name'] or 'Unknown'}",
                            event_type=f"High CPU Process ({cpu:.1f}%)",
                            severity=4,
                            likelihood=4,
                            source="system"
                        )

            except Exception:
                pass

            time.sleep(5)

        except Exception as e:
            logging.error(f"[REAL-TIME ERROR]: {e}")
            time.sleep(5)


@app.route("/api/health")
def api_health():
    monitoring_active = SYSTEM_MONITOR_THREAD is not None and SYSTEM_MONITOR_THREAD.is_alive()
    return jsonify({
        "status": "ok",
        "monitoring_active": monitoring_active,
        "events_captured": len(events),
        "model_version": MODEL_VERSION,
    })


@app.route("/api/system/status")
def api_system_status():
    top_processes = sorted(
        psutil.process_iter(['name', 'cpu_percent', 'memory_percent']),
        key=lambda proc: proc.info['cpu_percent'] or 0,
        reverse=True,
    )[:5]

    return jsonify({
        "cpu_percent": round(psutil.cpu_percent(interval=0.2), 1),
        "memory_percent": round(psutil.virtual_memory().percent, 1),
        "disk_percent": round(psutil.disk_usage(os.path.abspath(os.sep)).percent, 1),
        "monitoring_active": SYSTEM_MONITOR_THREAD is not None and SYSTEM_MONITOR_THREAD.is_alive(),
        "events_captured": len(events),
        "top_processes": [
            {
                "name": proc.info['name'] or 'Unknown',
                "cpu_percent": round(proc.info['cpu_percent'] or 0, 1),
                "memory_percent": round(proc.info.get('memory_percent') or 0, 1),
            }
            for proc in top_processes
        ],
    })


ensure_system_monitor_started()


if __name__ == "__main__":
    ensure_system_monitor_started()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
