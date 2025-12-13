import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, GripVertical, Trash2, Settings, Play, Check, X, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function AutoReservationRules({ restaurantId }) {
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState(null);
  const [testScenario, setTestScenario] = useState({ day: 1, time: '18:00', partySize: 2 });
  const [showTest, setShowTest] = useState(false);

  // Fetch rules
  const { data: rules = [] } = useQuery({
    queryKey: ['reservationRules', restaurantId],
    queryFn: () => base44.entities.ReservationRule.filter({ restaurant_id: restaurantId }, 'priority'),
    enabled: !!restaurantId,
  });

  // Create default rules if none exist
  React.useEffect(() => {
    if (rules.length === 0 && restaurantId) {
      const defaultRule = {
        restaurant_id: restaurantId,
        name: 'Weeknight small parties (auto-approve)',
        action: 'auto_approve',
        is_active: true,
        priority: 0,
        conditions: {
          days_of_week: [1, 2, 3, 4], // Mon-Thu
          time_slots: ['17:00-19:00', '20:30-22:00'],
          min_party_size: 1,
          max_party_size: 4,
          min_advance_hours: 2,
          max_advance_days: 14
        }
      };
      base44.entities.ReservationRule.create(defaultRule).then(() => {
        queryClient.invalidateQueries(['reservationRules']);
      });
    }
  }, [rules.length, restaurantId]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ReservationRule.create({ ...data, restaurant_id: restaurantId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservationRules']);
      toast.success('Rule created');
      setEditingRule(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ReservationRule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservationRules']);
      toast.success('Rule updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReservationRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservationRules']);
      toast.success('Rule deleted');
    }
  });

  // Rule matching test
  const testRule = () => {
    const matchingRule = rules.find(rule => {
      if (!rule.is_active) return false;
      const conditions = rule.conditions || {};
      
      if (conditions.days_of_week && !conditions.days_of_week.includes(testScenario.day)) return false;
      
      if (conditions.time_slots) {
        const testTime = testScenario.time;
        const matches = conditions.time_slots.some(slot => {
          const [start, end] = slot.split('-');
          return testTime >= start && testTime <= end;
        });
        if (!matches) return false;
      }
      
      if (conditions.min_party_size && testScenario.partySize < conditions.min_party_size) return false;
      if (conditions.max_party_size && testScenario.partySize > conditions.max_party_size) return false;
      
      return true;
    });
    
    return matchingRule;
  };

  const testResult = showTest ? testRule() : null;

  // Validation warnings
  const allDecline = rules.filter(r => r.is_active).every(r => r.action === 'auto_decline');
  const noActiveRules = rules.filter(r => r.is_active).length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Auto Reservation Rules
              </CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                Define when to auto-approve, review, or decline reservation requests
              </p>
            </div>
            <Dialog open={!!editingRule} onOpenChange={(open) => !open && setEditingRule(null)}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingRule({ conditions: {} })} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingRule?.id ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
                </DialogHeader>
                <RuleEditor
                  rule={editingRule}
                  onSave={(data) => {
                    if (editingRule?.id) {
                      updateMutation.mutate({ id: editingRule.id, data });
                    } else {
                      createMutation.mutate({ ...data, priority: rules.length });
                    }
                  }}
                  onCancel={() => setEditingRule(null)}
                />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Warnings */}
          {allDecline && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                All active rules auto-decline. Consider adding an auto-approve or manual review rule.
              </AlertDescription>
            </Alert>
          )}

          {noActiveRules && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertDescription className="text-blue-800">
                No active rules. All reservations will go to manual review by default.
              </AlertDescription>
            </Alert>
          )}

          {/* Rules List */}
          <div className="space-y-3">
            {rules.map((rule, index) => (
              <div
                key={rule.id}
                className={cn(
                  "p-4 rounded-xl border bg-white",
                  rule.is_active ? "border-slate-200" : "border-slate-100 bg-slate-50"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <GripVertical className="w-5 h-5 text-slate-300 mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-slate-900">{rule.name}</h4>
                        <Badge
                          className={cn(
                            rule.action === 'auto_approve' && "bg-emerald-100 text-emerald-700",
                            rule.action === 'flag_review' && "bg-amber-100 text-amber-700",
                            rule.action === 'auto_decline' && "bg-red-100 text-red-700"
                          )}
                        >
                          {rule.action === 'auto_approve' ? 'Auto-approve' : 
                           rule.action === 'flag_review' ? 'Manual review' : 'Auto-decline'}
                        </Badge>
                        {!rule.is_active && <Badge variant="outline">Inactive</Badge>}
                      </div>
                      
                      <div className="space-y-1 text-sm text-slate-600">
                        {rule.conditions?.days_of_week && (
                          <p>
                            Days: {rule.conditions.days_of_week.map(d => DAYS[d].slice(0, 3)).join(', ')}
                          </p>
                        )}
                        {rule.conditions?.time_slots && (
                          <p>Times: {rule.conditions.time_slots.join(', ')}</p>
                        )}
                        {rule.conditions?.min_party_size || rule.conditions?.max_party_size ? (
                          <p>
                            Party size: {rule.conditions.min_party_size || 1}–{rule.conditions.max_party_size || '∞'}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => updateMutation.mutate({
                        id: rule.id,
                        data: { is_active: checked }
                      })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(rule.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Test Scenario */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-900">Test Scenario</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTest(true)}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Run Test
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Day</Label>
                <Select 
                  value={testScenario.day.toString()} 
                  onValueChange={(v) => setTestScenario({ ...testScenario, day: parseInt(v) })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS.map((day, i) => (
                      <SelectItem key={i} value={i.toString()}>{day}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Time</Label>
                <Input
                  type="time"
                  value={testScenario.time}
                  onChange={(e) => setTestScenario({ ...testScenario, time: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Party Size</Label>
                <Input
                  type="number"
                  min="1"
                  value={testScenario.partySize}
                  onChange={(e) => setTestScenario({ ...testScenario, partySize: parseInt(e.target.value) })}
                  className="mt-1"
                />
              </div>
            </div>

            {showTest && testResult && (
              <Alert className="mt-3 border-emerald-200 bg-emerald-50">
                <Check className="w-4 h-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800">
                  Matched rule: <strong>{testResult.name}</strong> → {testResult.action}
                </AlertDescription>
              </Alert>
            )}

            {showTest && !testResult && (
              <Alert className="mt-3 border-blue-200 bg-blue-50">
                <AlertDescription className="text-blue-800">
                  No rule matched. This request would go to <strong>manual review</strong>.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RuleEditor({ rule, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    action: rule?.action || 'auto_approve',
    is_active: rule?.is_active !== false,
    conditions: {
      days_of_week: rule?.conditions?.days_of_week || [],
      time_slots: rule?.conditions?.time_slots || [''],
      min_party_size: rule?.conditions?.min_party_size || 1,
      max_party_size: rule?.conditions?.max_party_size || 10,
      min_advance_hours: rule?.conditions?.min_advance_hours || 0,
      max_advance_days: rule?.conditions?.max_advance_days || 30
    }
  });

  const toggleDay = (day) => {
    const current = formData.conditions.days_of_week;
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => a - b);
    setFormData({
      ...formData,
      conditions: { ...formData.conditions, days_of_week: updated }
    });
  };

  const updateTimeSlot = (index, value) => {
    const slots = [...formData.conditions.time_slots];
    slots[index] = value;
    setFormData({
      ...formData,
      conditions: { ...formData.conditions, time_slots: slots.filter(Boolean) }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Rule Name</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Weekend small parties"
          className="mt-1.5"
        />
      </div>

      <div>
        <Label>Action</Label>
        <Select value={formData.action} onValueChange={(v) => setFormData({ ...formData, action: v })}>
          <SelectTrigger className="mt-1.5">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto_approve">✅ Auto-approve</SelectItem>
            <SelectItem value="flag_review">⏳ Send to manual review</SelectItem>
            <SelectItem value="auto_decline">❌ Auto-decline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Days of Week</Label>
        <div className="flex flex-wrap gap-2 mt-1.5">
          {DAYS.map((day, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-sm transition-all",
                formData.conditions.days_of_week.includes(i)
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200"
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Time Slots</Label>
        <div className="space-y-2 mt-1.5">
          {formData.conditions.time_slots.map((slot, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="17:00-19:00"
                value={slot}
                onChange={(e) => updateTimeSlot(i, e.target.value)}
              />
              {i === formData.conditions.time_slots.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateTimeSlot(formData.conditions.time_slots.length, '')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Min Party Size</Label>
          <Input
            type="number"
            min="1"
            value={formData.conditions.min_party_size}
            onChange={(e) => setFormData({
              ...formData,
              conditions: { ...formData.conditions, min_party_size: parseInt(e.target.value) }
            })}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Max Party Size</Label>
          <Input
            type="number"
            min="1"
            value={formData.conditions.max_party_size}
            onChange={(e) => setFormData({
              ...formData,
              conditions: { ...formData.conditions, max_party_size: parseInt(e.target.value) }
            })}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Min Advance (hours)</Label>
          <Input
            type="number"
            min="0"
            value={formData.conditions.min_advance_hours}
            onChange={(e) => setFormData({
              ...formData,
              conditions: { ...formData.conditions, min_advance_hours: parseInt(e.target.value) }
            })}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label>Max Advance (days)</Label>
          <Input
            type="number"
            min="1"
            value={formData.conditions.max_advance_days}
            onChange={(e) => setFormData({
              ...formData,
              conditions: { ...formData.conditions, max_advance_days: parseInt(e.target.value) }
            })}
            className="mt-1.5"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(formData)}>
          {rule?.id ? 'Update Rule' : 'Create Rule'}
        </Button>
      </div>
    </div>
  );
}