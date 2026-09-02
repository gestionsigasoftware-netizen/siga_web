import { BarChart3 } from "lucide-react";

export default function ChartEmpty({ message }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
      <BarChart3 className="w-6 h-6 text-border" strokeWidth={1.5} />
      <p className="text-sm text-muted max-w-[220px]">{message}</p>
    </div>
  );
}
