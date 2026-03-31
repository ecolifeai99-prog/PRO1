import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useCreateEvent, 
  getGetEventsQueryKey, 
  getGetAnalyticsSummaryQueryKey,
  getGetRiskDistributionQueryKey,
  getGetEventsPerProcessQueryKey,
  getGetRecentActivityQueryKey,
  type EventWithFullAnalysis
} from "@workspace/api-client-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { RiskBadge } from "@/components/RiskBadge";
import { AlertCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  process_name: z.string().min(2, { message: "Process name must be at least 2 characters." }),
  event_type: z.string().min(2, { message: "Event type must be at least 2 characters." }),
  severity: z.number().min(1).max(5),
  likelihood: z.number().min(1).max(5),
});

type FormValues = z.infer<typeof formSchema>;

export default function AddEvent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const createEvent = useCreateEvent();
  const [successEvent, setSuccessEvent] = useState<EventWithFullAnalysis | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      process_name: "",
      event_type: "",
      severity: 3,
      likelihood: 3,
    },
  });

  const onSubmit = (data: FormValues) => {
    createEvent.mutate(
      { data },
      {
        onSuccess: (event) => {
          setSuccessEvent(event);
          toast({
            title: "Event Logged Successfully",
            description: "Risk score has been calculated.",
          });
          queryClient.invalidateQueries({ queryKey: getGetEventsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAnalyticsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRiskDistributionQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetEventsPerProcessQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
        },
        onError: () => {
          toast({
            title: "Submission Failed",
            description: "There was an error recording the event.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleReset = () => {
    form.reset();
    setSuccessEvent(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Record Process Event</h1>
        <p className="text-muted-foreground mt-1">
          Log a failure, delay, or risk indicator to trigger analysis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-sm border-t-4 border-t-primary h-fit">
          <CardHeader>
            <CardTitle>Event Details</CardTitle>
            <CardDescription>Enter the specifics of the process interruption.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="process_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Process Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Account Onboarding" data-testid="input-process-name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="event_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. API Timeout, Data Validation Error" data-testid="input-event-type" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem className="pt-2">
                      <div className="flex justify-between items-center pb-2 border-b mb-4">
                        <FormLabel className="text-base">Severity Impact</FormLabel>
                        <span className="font-bold text-lg text-primary w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">{field.value}</span>
                      </div>
                      <FormControl>
                        <Slider 
                          min={1} 
                          max={5} 
                          step={1} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])} 
                          data-testid="slider-severity"
                        />
                      </FormControl>
                      <FormDescription className="flex justify-between mt-2 text-xs">
                        <span>1: Negligible</span>
                        <span>5: Critical failure</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="likelihood"
                  render={({ field }) => (
                    <FormItem className="pt-2">
                      <div className="flex justify-between items-center pb-2 border-b mb-4">
                        <FormLabel className="text-base">Likelihood of Recurrence</FormLabel>
                        <span className="font-bold text-lg text-primary w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">{field.value}</span>
                      </div>
                      <FormControl>
                        <Slider 
                          min={1} 
                          max={5} 
                          step={1} 
                          value={[field.value]} 
                          onValueChange={(vals) => field.onChange(vals[0])}
                          data-testid="slider-likelihood" 
                        />
                      </FormControl>
                      <FormDescription className="flex justify-between mt-2 text-xs">
                        <span>1: Very rare</span>
                        <span>5: Highly probable</span>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={createEvent.isPending}
                  data-testid="button-submit-event"
                >
                  {createEvent.isPending ? "Analyzing..." : "Submit Event & Analyze"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="flex flex-col h-full">
          {successEvent ? (
            <Card className="shadow-lg border-primary/20 bg-primary/5 flex flex-col animate-in fade-in slide-in-from-bottom-4">
              <CardHeader className="bg-card border-b rounded-t-lg pb-4">
                <CardTitle className="flex items-center gap-2 text-primary">
                  <CheckCircle2 className="h-6 w-6" /> Analysis Complete
                </CardTitle>
                <CardDescription>Risk intelligence engine has processed the event.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 flex-1 space-y-6">
                {successEvent.is_anomaly && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 flex items-center gap-2 text-destructive" data-testid="anomaly-banner">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-semibold">Anomaly Detected</span>
                    <span className="text-sm ml-auto opacity-80">Score: {(successEvent.anomaly_score * 100).toFixed(0)}%</span>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Base Score</span>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-black font-mono" data-testid="text-risk-score">{successEvent.risk_score}</span>
                      <span className="text-xs text-muted-foreground ml-1">/ 25</span>
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Weighted Score</span>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-black font-mono text-primary" data-testid="text-weighted-score">{successEvent.weighted_score.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Confidence</span>
                    <div className="flex items-baseline">
                      <span className="text-3xl font-black font-mono" data-testid="text-confidence">{(successEvent.confidence * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-lg border shadow-sm flex flex-col items-center justify-center text-center">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Classification</span>
                    <RiskBadge level={successEvent.risk_level as any} />
                  </div>
                </div>

                <div className="bg-card border-l-4 border-l-primary p-5 rounded-r-lg shadow-sm">
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3 uppercase tracking-wider text-muted-foreground">
                    <ShieldAlert className="h-4 w-4 text-primary" /> Required Action
                  </h4>
                  <p className="text-base font-medium text-foreground leading-relaxed" data-testid="text-recommendation">{successEvent.recommendation}</p>
                </div>

                {successEvent.contributing_factors && successEvent.contributing_factors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contributing Factors</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {successEvent.contributing_factors.map((factor, idx) => (
                        <li key={idx} className="text-sm text-foreground/80" data-testid={`text-factor-${idx}`}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-4 bg-card rounded-b-lg border-t">
                <Button variant="outline" className="w-full" onClick={handleReset} data-testid="button-add-another">
                  Log Another Event
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="h-full border-dashed border-2 flex flex-col items-center justify-center text-center p-8 text-muted-foreground shadow-none bg-muted/20 min-h-[400px]">
              <div className="bg-muted p-4 rounded-full mb-6">
                <AlertCircle className="h-10 w-10 opacity-50" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2">Awaiting Input</h3>
              <p className="max-w-xs">Submit an event to view automated risk analysis, scoring, and remediation recommendations.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
