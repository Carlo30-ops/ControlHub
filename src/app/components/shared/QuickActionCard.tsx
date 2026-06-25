import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { cn } from "../ui/utils";

interface QuickActionCardProps {
  title: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

export function QuickActionCard({ title, label, desc, icon, color, onClick }: QuickActionCardProps) {
  return (
    <Card
      className="bg-card border-border shadow-sm hover:border-primary/50 transition-all cursor-pointer group rounded-lg overflow-hidden"
      onClick={onClick}
    >
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("p-3 rounded-lg text-[#64748B] bg-muted group-hover:bg-accent transition-colors")}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-foreground text-sm uppercase tracking-tight">{title}</h3>
            <Badge variant="secondary" className="bg-muted text-muted-foreground text-[9px] font-bold px-1.5 h-3.5 border-none">{label}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground font-medium truncate">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}
