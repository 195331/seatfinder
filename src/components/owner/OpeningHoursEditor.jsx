import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const TIME_OPTIONS = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    const hour = h.toString().padStart(2, '0');
    const min = m.toString().padStart(2, '0');
    const time = `${hour}:${min}`;
    const label = formatTime(time);
    TIME_OPTIONS.push({ value: time, label });
  }
}

function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${m} ${ampm}`;
}

export default function OpeningHoursEditor({ hours = {}, onChange }) {
  const handleDayToggle = (day, isOpen) => {
    const newHours = { ...hours };
    if (isOpen) {
      newHours[day] = { open: '09:00', close: '21:00' };
    } else {
      delete newHours[day];
    }
    onChange(newHours);
  };

  const handleTimeChange = (day, field, value) => {
    onChange({
      ...hours,
      [day]: { ...hours[day], [field]: value }
    });
  };

  return (
    <div className="space-y-3">
      {DAYS.map((day) => {
        const dayHours = hours[day.key];
        const isOpen = !!dayHours;
        
        return (
          <div 
            key={day.key} 
            className={cn(
              "flex items-center justify-between p-3 rounded-xl transition-colors",
              isOpen ? "bg-emerald-50" : "bg-slate-50"
            )}
          >
            <div className="flex items-center gap-3">
              <Switch
                checked={isOpen}
                onCheckedChange={(checked) => handleDayToggle(day.key, checked)}
              />
              <span className={cn(
                "font-medium w-24",
                isOpen ? "text-slate-900" : "text-slate-400"
              )}>
                {day.label}
              </span>
            </div>
            
            {isOpen ? (
              <div className="flex items-center gap-2">
                <Select 
                  value={dayHours.open} 
                  onValueChange={(v) => handleTimeChange(day.key, 'open', v)}
                >
                  <SelectTrigger className="w-28 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-slate-400">to</span>
                <Select 
                  value={dayHours.close} 
                  onValueChange={(v) => handleTimeChange(day.key, 'close', v)}
                >
                  <SelectTrigger className="w-28 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <span className="text-sm text-slate-400">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function OpeningHoursDisplay({ hours = {} }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  
  if (Object.keys(hours).length === 0) return null;
  
  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const dayHours = hours[day.key];
        const isToday = day.key === today;
        
        return (
          <div 
            key={day.key} 
            className={cn(
              "flex items-center justify-between py-1.5 px-3 rounded-lg text-sm",
              isToday && "bg-emerald-50 font-medium"
            )}
          >
            <span className={isToday ? "text-emerald-700" : "text-slate-600"}>
              {day.label}
              {isToday && <span className="ml-2 text-xs text-emerald-600">(Today)</span>}
            </span>
            <span className={isToday ? "text-emerald-700" : "text-slate-900"}>
              {dayHours ? `${formatTime(dayHours.open)} - ${formatTime(dayHours.close)}` : 'Closed'}
            </span>
          </div>
        );
      })}
    </div>
  );
}