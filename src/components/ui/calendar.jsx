import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function Calendar({ className, selected, onSelect, mode = "single", disabled, ...props }) {
  const today = new Date();
  const [view, setView] = React.useState(() => {
    const d = selected ? new Date(selected) : new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const { year, month } = view;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
  const nextMonth = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });

  const isSelected = (day) => {
    if (!selected) return false;
    const s = new Date(selected);
    return s.getFullYear() === year && s.getMonth() === month && s.getDate() === day;
  };
  const isToday = (day) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  const isDisabled = (day) => {
    if (!disabled) return false;
    const d = new Date(year, month, day);
    return disabled(d);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className={cn("p-3 select-none", className)} {...props}>
      {/* Header */}
      <div className="flex justify-center pt-1 relative items-center mb-4">
        <button
          className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1")}
          onClick={prevMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{MONTHS[month]} {year}</span>
        <button
          className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1")}
          onClick={nextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* Day headers */}
      <div className="flex">
        {DAYS.map(d => (
          <div key={d} className="text-muted-foreground rounded-md w-8 font-normal text-[0.8rem] text-center">{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div className="mt-2">
        {Array.from({ length: Math.ceil(cells.length / 7) }).map((_, week) => (
          <div key={week} className="flex w-full mt-2">
            {cells.slice(week * 7, week * 7 + 7).map((day, i) => {
              if (!day) return <div key={i} className="w-8 h-8" />;
              const sel = isSelected(day);
              const tod = isToday(day);
              const dis = isDisabled(day);
              return (
                <button
                  key={day}
                  disabled={dis}
                  onClick={() => onSelect?.(new Date(year, month, day))}
                  className={cn(
                    buttonVariants({ variant: "ghost" }),
                    "h-8 w-8 p-0 font-normal",
                    sel && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    tod && !sel && "bg-accent text-accent-foreground",
                    dis && "text-muted-foreground opacity-50 pointer-events-none"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
Calendar.displayName = "Calendar"

export { Calendar }