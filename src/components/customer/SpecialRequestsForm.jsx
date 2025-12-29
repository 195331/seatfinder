import React, { useState } from 'react';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

const QUICK_REQUESTS = [
  { id: 'window', label: 'Window seat', icon: '🪟' },
  { id: 'quiet', label: 'Quiet area', icon: '🤫' },
  { id: 'booth', label: 'Booth seating', icon: '🛋️' },
  { id: 'highchair', label: 'High chair needed', icon: '👶' },
  { id: 'wheelchair', label: 'Wheelchair accessible', icon: '♿' },
  { id: 'birthday', label: 'Birthday celebration', icon: '🎂' },
  { id: 'anniversary', label: 'Anniversary', icon: '💝' },
  { id: 'business', label: 'Business meeting', icon: '💼' },
];

export default function SpecialRequestsForm({ value = '', onChange }) {
  const [quickSelections, setQuickSelections] = useState([]);
  const [customNotes, setCustomNotes] = useState(value || '');

  const handleQuickSelect = (request) => {
    const newSelections = quickSelections.includes(request.id)
      ? quickSelections.filter(id => id !== request.id)
      : [...quickSelections, request.id];
    
    setQuickSelections(newSelections);
    
    // Build combined text
    const selectedLabels = QUICK_REQUESTS
      .filter(r => newSelections.includes(r.id))
      .map(r => r.label);
    
    const combined = selectedLabels.length > 0
      ? `${selectedLabels.join(', ')}${customNotes ? '. ' + customNotes : ''}`
      : customNotes;
    
    onChange(combined);
  };

  const handleCustomNotesChange = (notes) => {
    setCustomNotes(notes);
    
    const selectedLabels = QUICK_REQUESTS
      .filter(r => quickSelections.includes(r.id))
      .map(r => r.label);
    
    const combined = selectedLabels.length > 0
      ? `${selectedLabels.join(', ')}${notes ? '. ' + notes : ''}`
      : notes;
    
    onChange(combined);
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-3 block">Quick Selections</Label>
        <div className="grid grid-cols-2 gap-2">
          {QUICK_REQUESTS.map((request) => (
            <button
              key={request.id}
              type="button"
              onClick={() => handleQuickSelect(request)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                quickSelections.includes(request.id)
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-lg">{request.icon}</span>
              <span className="text-sm font-medium">{request.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="custom-notes">Additional Notes (Optional)</Label>
        <Textarea
          id="custom-notes"
          value={customNotes}
          onChange={(e) => handleCustomNotesChange(e.target.value)}
          placeholder="Dietary restrictions, allergies, or other special requests..."
          className="mt-2 h-24"
        />
      </div>
    </div>
  );
}