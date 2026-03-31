import {
  useGetMlModelStats,
  useGetMlModelInfo,
  useGetMlAnomalies,
  useGetMlTrends,
  useGetMlProcessHealth,
  useGetMlPredictions,
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, TrendingDown, Minus, Activity, ShieldAlert, Target } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Components
function StatsSection() {
  const { data: stats, isLoading } = useGetMlModelStats();

  if (isLoading || !stats) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {[
        { label: "Events Analyzed", value: stats.total_events_analyzed.toLocaleString() },
        { label: "Anomalies", value: stats.anomalies_detected.toLocaleString() },
        { label: "Anomaly Rate", value: `${(stats.anomaly_rate * 100).toFixed(1)}%` },
        { label: "Model Accuracy", value: `${(stats.model_accuracy * 100).toFixed(1)}%` },
        { label: "F1 Score", value: stats.f1_score.toFixed(3) },
      ].map((s, i) => (
        <Card key={i} className="bg-card border-l-4 border-l-primary/50" data-testid={`stat-card-${i}`}>
          <CardContent className="p-4 flex flex-col justify-center items-center text-center h-full">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{s.label}</span>
            <span className="text-2xl font-black font-mono">{s.value}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AlgorithmShowcase() {
  const { data: modelInfo, isLoading } = useGetMlModelInfo();

  if (isLoading || !modelInfo) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tight">Intelligence Models</h2>
        <Badge variant="outline" className="ml-2 font-mono">v{modelInfo.model_version}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {modelInfo.algorithms.map((algo, i) => (
          <Card key={i} className="flex flex-col hover:border-primary/50 transition-colors" data-testid={`algo-card-${i}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start mb-2">
                <CardTitle className="text-lg leading-tight">{algo.name}</CardTitle>
                <Badge variant="secondary" className="whitespace-nowrap">{algo.type}</Badge>
              </div>
              <CardDescription className="text-sm line-clamp-2">{algo.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col space-y-4">
              <div className="bg-muted/50 rounded-md p-3 font-mono text-xs text-foreground overflow-x-auto border">
                {algo.formula}
              </div>
              <div className="text-sm">
                <span className="font-semibold text-foreground block mb-1">Primary Use Case:</span> 
                <span className="text-muted-foreground leading-snug">{algo.use_case}</span>
              </div>
              <div className="mt-auto pt-4 border-t border-border/50">
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span className="text-muted-foreground">Confidence Score</span>
                  <span className="font-mono">{(algo.accuracy * 100).toFixed(1)}%</span>
                </div>
                <Progress value={algo.accuracy * 100} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AnomalyDetection() {
  const { data: anomalies, isLoading } = useGetMlAnomalies();

  if (isLoading || !anomalies) return <Skeleton className="h-64 w-full" />;

  const sortedAnomalies = [...anomalies].sort((a, b) => b.anomaly_score - a.anomaly_score);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-destructive" />
          Z-Score Anomaly Detection
        </CardTitle>
        <CardDescription>Recent events exhibiting abnormal statistical deviations</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Process</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead className="text-right">Risk</TableHead>
                <TableHead className="text-right">Z-Score</TableHead>
                <TableHead>Anomaly Probability</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAnomalies.map((anomaly) => (
                <TableRow key={anomaly.id} className={cn(anomaly.is_anomaly && "bg-destructive/5")}>
                  <TableCell className="font-medium whitespace-nowrap">{anomaly.process_name}</TableCell>
                  <TableCell className="text-muted-foreground">{anomaly.event_type}</TableCell>
                  <TableCell className="text-right font-mono">{anomaly.risk_score}</TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{anomaly.z_score.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={anomaly.anomaly_score * 100} 
                        className={cn("h-1.5 w-16", anomaly.is_anomaly ? "[&>div]:bg-destructive" : "[&>div]:bg-primary")} 
                      />
                      <span className="text-xs font-mono">{(anomaly.anomaly_score * 100).toFixed(0)}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {anomaly.is_anomaly ? (
                      <Badge variant="destructive">Anomaly</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Normal</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {anomalies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No anomalies detected
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendAnalysis() {
  const { data: trends, isLoading } = useGetMlTrends();

  if (isLoading || !trends) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          EMA Trend Analysis
        </CardTitle>
        <CardDescription>Exponential Moving Average tracking across processes</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full border rounded-md">
          {trends.map((trend, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="last:border-b-0">
              <AccordionTrigger className="hover:no-underline hover:bg-muted/30 px-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-4 gap-2">
                  <span className="font-semibold text-left">{trend.process_name}</span>
                  <div className="flex items-center gap-4 text-sm font-normal bg-background px-3 py-1 rounded-full border shadow-sm">
                    <span className="text-muted-foreground">EMA: <span className="font-mono text-foreground font-medium">{trend.ema_current.toFixed(2)}</span></span>
                    <div className="w-px h-4 bg-border" />
                    <div className="flex items-center gap-1.5 w-24">
                      {trend.trend_direction === "rising" && <TrendingUp className="h-4 w-4 text-destructive" />}
                      {trend.trend_direction === "falling" && <TrendingDown className="h-4 w-4 text-green-500" />}
                      {trend.trend_direction === "stable" && <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className={cn(
                        "font-medium capitalize",
                        trend.trend_direction === "rising" && "text-destructive",
                        trend.trend_direction === "falling" && "text-green-500",
                        trend.trend_direction === "stable" && "text-muted-foreground",
                      )}>
                        {trend.trend_direction}
                      </span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <span className="text-muted-foreground font-mono">{(trend.trend_strength * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="h-[300px] w-full mt-4 bg-muted/10 rounded-md border p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend.time_series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={(val) => new Date(val).toLocaleDateString()} 
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickMargin={10}
                      />
                      <YAxis 
                        stroke="hsl(var(--muted-foreground))" 
                        fontSize={12} 
                        tickMargin={10}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                        labelFormatter={(val) => new Date(val).toLocaleString()}
                        itemStyle={{ fontWeight: 500 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: "10px" }} />
                      <Line 
                        type="monotone" 
                        dataKey="risk_score" 
                        name="Risk Score" 
                        stroke="hsl(var(--muted-foreground))" 
                        strokeWidth={1.5} 
                        dot={{ r: 3, fill: "hsl(var(--muted-foreground))" }} 
                        activeDot={{ r: 5 }} 
                        opacity={0.5}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="ema" 
                        name="EMA Trend" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2.5} 
                        dot={false} 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}

function HealthIndex() {
  const { data: healthData, isLoading } = useGetMlProcessHealth();

  if (isLoading || !healthData) return <Skeleton className="h-64 w-full" />;

  const getHealthColor = (label: string) => {
    switch(label) {
      case "Critical": return "bg-destructive text-destructive-foreground";
      case "Poor": return "bg-orange-500 text-white";
      case "Fair": return "bg-yellow-500 text-white";
      case "Good": return "bg-teal-500 text-white";
      case "Excellent": return "bg-green-500 text-white";
      default: return "bg-muted";
    }
  };

  const getProgressColor = (label: string) => {
    switch(label) {
      case "Critical": return "[&>div]:bg-destructive";
      case "Poor": return "[&>div]:bg-orange-500";
      case "Fair": return "[&>div]:bg-yellow-500";
      case "Good": return "[&>div]:bg-teal-500";
      case "Excellent": return "[&>div]:bg-green-500";
      default: return "";
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-primary" />
          Process Health Index
        </CardTitle>
        <CardDescription>Holistic health scoring based on severity, frequency, and recency</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-6">
          {healthData.map((health, i) => (
            <div key={i} className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{health.process_name}</span>
                <Badge className={cn("hover:bg-opacity-80 font-medium", getHealthColor(health.health_label))}>
                  {health.health_label}
                </Badge>
              </div>
              <Progress value={health.health_score} className={cn("h-2.5", getProgressColor(health.health_label))} />
              <div className="grid grid-cols-4 gap-2 text-xs text-center border-t pt-2 mt-2">
                <div className="flex flex-col">
                  <span className="text-muted-foreground mb-1">Score</span>
                  <span className="font-mono font-medium">{health.health_score.toFixed(1)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground mb-1">Events</span>
                  <span className="font-mono font-medium">{health.event_count}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground mb-1">Avg Sev</span>
                  <span className="font-mono font-medium">{health.avg_severity.toFixed(1)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-muted-foreground mb-1">High Risk</span>
                  <span className="font-mono font-medium">{(health.high_risk_ratio * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RiskPredictions() {
  const { data: predictions, isLoading } = useGetMlPredictions();

  if (isLoading || !predictions) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Linear Regression Predictions
        </CardTitle>
        <CardDescription>Forecasted risk levels based on historical data patterns</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Process</TableHead>
                <TableHead>Risk Velocity</TableHead>
                <TableHead className="text-right">Predicted Score</TableHead>
                <TableHead className="text-center">Forecast Level</TableHead>
                <TableHead className="text-center">95% Confidence Interval</TableHead>
                <TableHead className="text-right">Training Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {predictions.map((pred, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{pred.process_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-medium">
                      {pred.risk_velocity > 0.1 && <TrendingUp className="h-4 w-4 text-destructive" />}
                      {pred.risk_velocity < -0.1 && <TrendingDown className="h-4 w-4 text-green-500" />}
                      {Math.abs(pred.risk_velocity) <= 0.1 && <Minus className="h-4 w-4 text-muted-foreground" />}
                      <span className={cn(
                        "font-mono text-xs",
                        pred.risk_velocity > 0.1 && "text-destructive",
                        pred.risk_velocity < -0.1 && "text-green-500",
                        Math.abs(pred.risk_velocity) <= 0.1 && "text-muted-foreground"
                      )}>{pred.risk_velocity > 0 ? "+" : ""}{pred.risk_velocity.toFixed(3)} / day</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-base">
                    {pred.predicted_risk_score.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={
                      pred.predicted_risk_level === "High" ? "destructive" : 
                      pred.predicted_risk_level === "Medium" ? "secondary" : "outline"
                    }>
                      {pred.predicted_risk_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="bg-muted/50 px-2 py-1 rounded text-xs font-mono text-muted-foreground border">
                      [{pred.confidence_interval_low.toFixed(1)} — {pred.confidence_interval_high.toFixed(1)}]
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">
                    {pred.data_points}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AiEngine() {
  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Brain className="h-6 w-6" />
          </div>
          Intelligence Engine
        </h1>
        <p className="text-muted-foreground text-lg">
          Real-time machine learning analysis of process stability, risk anomalies, and predictive trends.
        </p>
      </div>

      <StatsSection />
      
      <AlgorithmShowcase />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <AnomalyDetection />
        <HealthIndex />
      </div>

      <TrendAnalysis />
      
      <RiskPredictions />
    </div>
  );
}
