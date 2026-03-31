import { Link, useLocation } from "wouter";
import { LayoutDashboard, PlusCircle, AlertTriangle, BarChart3, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Add Event", href: "/add-event", icon: PlusCircle },
  { name: "Risk Analysis", href: "/risk-analysis", icon: AlertTriangle },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex flex-col w-full md:w-64 bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex-shrink-0">
      <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
        <ShieldAlert className="h-6 w-6 text-primary" />
        <span className="font-semibold text-lg tracking-tight">RiskGovernance</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
            )} data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}>
              <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-sidebar-foreground/70")} />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
