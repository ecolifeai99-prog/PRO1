import { useState } from "react";
import { 
  useGetEvents, 
  useDeleteEvent,
  getGetEventsQueryKey,
  getGetAnalyticsSummaryQueryKey,
  getGetRiskDistributionQueryKey,
  getGetEventsPerProcessQueryKey,
  getGetRecentActivityQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RiskBadge } from "@/components/RiskBadge";
import { Search, Trash2, ShieldAlert, FileText, CalendarClock, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

export default function RiskAnalysis() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const { data: events, isLoading } = useGetEvents();
  const deleteEvent = useDeleteEvent();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: string) => {
    deleteEvent.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Event removed", description: "The event has been successfully deleted." });
          queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRiskDistributionQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEventsPerProcessQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        }
      }
    );
  };

  const filteredEvents = events?.filter(event => {
    if (filter !== "All" && event.risk_level !== filter) return false;
    if (search && !event.process_name.toLowerCase().includes(search.toLowerCase()) && !event.event_type.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Risk Log & Analysis</h1>
          <p className="text-muted-foreground mt-1">Complete historical record of all assessed process events.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <Tabs defaultValue="All" onValueChange={setFilter} className="w-full sm:w-auto">
          <TabsList className="grid grid-cols-4 w-full sm:w-auto h-10" data-testid="tabs-risk-filter">
            <TabsTrigger value="All" data-testid="tab-filter-all">All</TabsTrigger>
            <TabsTrigger value="High" data-testid="tab-filter-high" className="data-[state=active]:text-destructive">High</TabsTrigger>
            <TabsTrigger value="Medium" data-testid="tab-filter-medium" className="data-[state=active]:text-amber-500">Medium</TabsTrigger>
            <TabsTrigger value="Low" data-testid="tab-filter-low" className="data-[state=active]:text-emerald-500">Low</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search processes or event types..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-events"
          />
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredEvents?.length === 0 ? (
          <Card className="border-dashed bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium text-foreground">No events found</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </CardContent>
          </Card>
        ) : (
          filteredEvents?.map(event => (
            <Card key={event.id} className="shadow-sm overflow-hidden border-l-4 group" style={{ 
              borderLeftColor: event.risk_level === 'High' ? 'var(--color-destructive)' : 
                              event.risk_level === 'Medium' ? '#f59e0b' : '#10b981' 
            }} data-testid={`event-card-${event.id}`}>
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-stretch p-5 gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg truncate text-foreground">{event.process_name}</h3>
                      <RiskBadge level={event.risk_level} />
                      <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">ID: {event.id.slice(0, 8)}</span>
                    </div>
                    
                    <div className="flex flex-wrap items-center text-sm text-muted-foreground gap-y-2 gap-x-4">
                      <div className="flex items-center gap-1.5">
                        <Activity className="h-4 w-4" />
                        <span className="font-medium text-foreground">{event.event_type}</span>
                      </div>
                      <div className="hidden sm:block text-border">•</div>
                      <div>
                        Sev: <span className="font-semibold text-foreground">{event.severity}</span>
                      </div>
                      <div>
                        Likelihood: <span className="font-semibold text-foreground">{event.likelihood}</span>
                      </div>
                      <div className="hidden sm:block text-border">•</div>
                      <div className="flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" />
                        {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-row md:flex-col items-center justify-between md:justify-center gap-4 md:border-l md:pl-6">
                    <div className="text-center">
                      <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">Risk Score</div>
                      <div className="text-4xl font-black font-mono leading-none">{event.risk_score}</div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 md:w-full"
                      onClick={() => handleDelete(event.id)}
                      disabled={deleteEvent.isPending}
                      data-testid={`button-delete-${event.id}`}
                    >
                      <Trash2 className="h-4 w-4 md:mr-2" />
                      <span className="hidden md:inline">Delete</span>
                    </Button>
                  </div>
                </div>
                
                <div className="bg-muted/30 px-5 py-3 border-t flex items-start gap-3">
                  <ShieldAlert className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-0.5">Recommendation</span>
                    <p className="text-sm font-medium text-foreground">{event.recommendation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
