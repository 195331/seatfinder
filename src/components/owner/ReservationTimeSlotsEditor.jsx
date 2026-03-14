import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Clock } from 'lucide-react';
import { cn } from "@/lib/utils";

const DEFAULT_SLOTS = [
  "11:00","11:30","12:00","12:30","13:00","13:30","14:00",
  "17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00"
];

// Generate all half-hour slots from 07:00 to 23:00
const ALL_POSSIBLE_SLOTS = [];
for (let h = 7; h <= 23; h++) {
  ALL_POSSIBLE_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 23) ALL_POSSIBLE_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

const formatTime = (time) => {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${period}`;
};

export default function ReservationTimeSlotsEditor({ slots, onChange }) {
  const activeSlots = (slots && slots.length > 0) ? slots : DEFAULT_SLOTS;

  const toggleSlot = (slot) => {
    if (activeSlots.includes(slot)) {
      // Don't allow removing the last slot
      if (activeSlots.length <= 1) return;
      onChange(activeSlots.filter(s => s !== slot).sort());
    } else {
      onChange([...activeSlots, slot].sort());
    }
  };

  const resetToDefault = () => onChange(DEFAULT_SLOTS);

  const isDefault = JSON.stringify([...activeSlots].sort()) === JSON.stringify([...DEFAULT_SLOTS].sort());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Reservation Time Slots</Label>
          <p className="text-sm text-slate-500 mt-0.5">
            Select which times guests can choose when booking a table.
          </p>
        </div>
        {!isDefault && (
          <Button variant="outline" size="sm" onClick={resetToDefault} className="rounded-full text-xs">
            Reset to Default
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {ALL_POSSIBLE_SLOTS.map((slot) => {
          const active = activeSlots.includes(slot);
          return (
            <button
              key={slot}
              type="button"
              onClick={() => toggleSlot(slot)}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm font-medium transition-all",
                active
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
              )}
            >
              {formatTime(slot)}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-400">
        {activeSlots.length} slot{activeSlots.length !== 1 ? 's' : ''} selected
      </p>
    </div>
  );
}