import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: "Low" | "Medium" | "High" | string;
}

export function RiskBadge({ level }: RiskBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold uppercase tracking-wider text-xs",
        level === "High" && "border-destructive text-destructive bg-destructive/10",
        level === "Medium" && "border-amber-500 text-amber-600 bg-amber-500/10",
        level === "Low" && "border-emerald-500 text-emerald-600 bg-emerald-500/10"
      )}
      data-testid={`risk-badge-${level.toLowerCase()}`}
    >
      {level} Risk
    </Badge>
  );
}
