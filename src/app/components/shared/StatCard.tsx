import { Card, CardContent } from "../ui/card";
import { cn } from "../ui/utils";

interface StatCardProps {
  label: string;
  val: string | number;
  icon: React.ReactNode;
  color: string;
  isMoney?: boolean;
}

export function StatCard({ label, val, icon, color, isMoney }: StatCardProps) {
  return (
    <Card className="bg-card border-border shadow-lg rounded-2xl overflow-hidden group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
             <div className={cn("p-2 rounded-lg shadow-md group-hover:scale-110 transition-transform", color)}>{icon}</div>
          </div>
          <h3 className={cn("font-bold tracking-tight truncate", isMoney ? "text-xl" : "text-3xl")}>{val}</h3>
       </CardContent>
    </Card>
  );
}
