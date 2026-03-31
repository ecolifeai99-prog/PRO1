import { 
  useGetAnalyticsSummary, 
  useGetRecentActivity,
  useHealthCheck
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, CheckCircle2, AlertTriangle, Activity, ShieldAlert } from "lucide-react";
import { RiskBadge } from "@/components/RiskBadge";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary, isError: isErrorSummary } = useGetAnalyticsSummary();
  const { data: recent, isLoading: isLoadingRecent } = useGetRecentActivity();
  const { data: health } = useHealthCheck();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Command Center</h1>
          <p className="text-muted-foreground mt-1">
            Real-time process intelligence and risk governance overview.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm bg-card border px-3 py-1.5 rounded-full shadow-sm" data-testid="status-system-health">
          <div className={`h-2 w-2 rounded-full ${health?.status === 'ok' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
          <span className="font-medium text-muted-foreground">System: {health?.status === 'ok' ? 'Online' : 'Degraded'}</span>
        </div>
      </div>

      {isErrorSummary ? (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md border border-destructive/20 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load analytics summary. Please try again later.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Total Events" 
            value={isLoadingSummary ? null : summary?.total_events} 
            icon={<Activity className="h-4 w-4 text-muted-foreground" />} 
            testId="stat-total-events"
          />
          <StatCard 
            title="High Risk Alerts" 
            value={isLoadingSummary ? null : summary?.high_risk_count} 
            valueClassName="text-destructive"
            icon={<AlertCircle className="h-4 w-4 text-destructive" />} 
            testId="stat-high-risk"
          />
          <StatCard 
            title="Medium Risk Warnings" 
            value={isLoadingSummary ? null : summary?.medium_risk_count} 
            valueClassName="text-amber-500"
            icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} 
            testId="stat-medium-risk"
          />
          <StatCard 
            title="Avg Risk Score" 
            value={isLoadingSummary ? null : summary?.avg_risk_score.toFixed(1)} 
            icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />} 
            testId="stat-avg-score"
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>Recent Risk Events</CardTitle>
            <CardDescription>Latest process events recorded in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingSummary ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : summary?.recent_events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No events recorded yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 font-medium">Process</th>
                      <th className="px-4 py-3 font-medium">Event Type</th>
                      <th className="px-4 py-3 font-medium">Risk Level</th>
                      <th className="px-4 py-3 font-medium">Score</th>
                      <th className="px-4 py-3 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary?.recent_events.map((event) => (
                      <tr key={event.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-recent-event-${event.id}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{event.process_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{event.event_type}</td>
                        <td className="px-4 py-3">
                          <RiskBadge level={event.risk_level} />
                        </td>
                        <td className="px-4 py-3 font-mono">{event.risk_score}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" /> High-Risk Feed
            </CardTitle>
            <CardDescription>Immediate attention required</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingRecent ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-full bg-card" />
                <Skeleton className="h-16 w-full bg-card" />
              </div>
            ) : recent?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2 bg-card rounded-lg border">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p>No active high-risk alerts.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recent?.map((event) => (
                  <div key={event.id} className="bg-card p-4 rounded-md border shadow-sm relative overflow-hidden group hover:border-destructive/50 transition-colors" data-testid={`card-high-risk-${event.id}`}>
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-destructive" />
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-sm text-foreground">{event.process_name}</h4>
                      <span className="text-xs font-bold bg-destructive/10 text-destructive px-2 py-0.5 rounded font-mono">
                        Score: {event.risk_score}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">{event.event_type}</p>
                    <p className="text-xs text-foreground font-medium bg-muted p-2 rounded border-l-2 border-primary">
                      {event.recommendation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, valueClassName = "", icon, testId }: { title: string, value: React.ReactNode, valueClassName?: string, icon: React.ReactNode, testId?: string }) {
  return (
    <Card className="shadow-sm border-l-4 border-l-border" data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {value === null ? (
          <Skeleton className="h-8 w-16 mt-1" />
        ) : (
          <div className={`text-3xl font-bold ${valueClassName}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}
