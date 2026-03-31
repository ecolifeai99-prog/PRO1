import { 
  useGetRiskDistribution, 
  useGetEventsPerProcess 
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, PieChart as PieChartIcon } from "lucide-react";

export default function Analytics() {
  const { data: distribution, isLoading: isLoadingDist } = useGetRiskDistribution();
  const { data: processData, isLoading: isLoadingProcess } = useGetEventsPerProcess();

  const pieData = distribution ? [
    { name: 'High Risk', value: distribution.high, color: 'hsl(var(--destructive))' },
    { name: 'Medium Risk', value: distribution.medium, color: '#f59e0b' },
    { name: 'Low Risk', value: distribution.low, color: '#10b981' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Risk Analytics</h1>
        <p className="text-muted-foreground mt-1">Macro-level intelligence on operational risks and vulnerabilities.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-primary" />
              <CardTitle>Risk Level Distribution</CardTitle>
            </div>
            <CardDescription>Breakdown of all events by severity classification.</CardDescription>
          </CardHeader>
          <CardContent className="h-[380px]">
            {isLoadingDist ? (
              <Skeleton className="w-full h-full rounded-full max-w-[300px] max-h-[300px] mx-auto" />
            ) : pieData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={130}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                    stroke="none"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} Events`, 'Count']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-t-4 border-t-secondary">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Events by Process</CardTitle>
            </div>
            <CardDescription>Volume and risk level composition per operation.</CardDescription>
          </CardHeader>
          <CardContent className="h-[380px]">
            {isLoadingProcess ? (
              <Skeleton className="w-full h-full" />
            ) : !processData || processData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={processData}
                  margin={{ top: 20, right: 30, left: 0, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="process_name" 
                    angle={-45} 
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} 
                    stroke="hsl(var(--border))" 
                  />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted)/0.5)' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }}
                  />
                  <Legend verticalAlign="top" wrapperStyle={{ paddingBottom: '20px' }} iconType="circle" />
                  <Bar dataKey="low_risk" name="Low Risk" stackId="a" fill="#10b981" />
                  <Bar dataKey="medium_risk" name="Medium Risk" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="high_risk" name="High Risk" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
