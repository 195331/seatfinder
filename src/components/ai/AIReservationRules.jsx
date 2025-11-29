import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings, Plus, Trash2, Check, X, Clock, Users, Calendar, Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIME_SLOTS = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AIReservationRules({ restaurantId }) {
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    action: 'auto_approve',
    conditions: {
      min_party_size: 1,
      max_party_size: 6,
      time_slots: [],
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      min_advance_hours: 2,
      max_advance_days: 30,
      require_table_available: true
    },
    priority: 0
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['reservationRules', restaurantId],
    queryFn: () => base44.entities.ReservationRule.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId
  });

  const createRuleMutation = useMutation({
    mutationFn: (data) => base44.entities.ReservationRule.create({
      ...data,
      restaurant_id: restaurantId,
      is_active: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservationRules']);
      setShowNewDialog(false);
      resetNewRule();
      toast.success('Rule created');
    }
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ReservationRule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservationRules']);
      toast.success('Rule updated');
    }
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id) => base44.entities.ReservationRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['reservationRules']);
      toast.success('Rule deleted');
    }
  });

  const resetNewRule = () => {
    setNewRule({
      name: '',
      action: 'auto_approve',
      conditions: {
        min_party_size: 1,
        max_party_size: 6,
        time_slots: [],
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        min_advance_hours: 2,
        max_advance_days: 30,
        require_table_available: true
      },
      priority: 0
    });
  };

  const toggleTimeSlot = (slot) => {
    const current = newRule.conditions.time_slots || [];
    const updated = current.includes(slot)
      ? current.filter(s => s !== slot)
      : [...current, slot];
    setNewRule({
      ...newRule,
      conditions: { ...newRule.conditions, time_slots: updated }
    });
  };

  const toggleDay = (day) => {
    const current = newRule.conditions.days_of_week || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setNewRule({
      ...newRule,
      conditions: { ...newRule.conditions, days_of_week: updated }
    });
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'auto_approve':
        return <Badge className="bg-emerald-100 text-emerald-700"><Check className="w-3 h-3 mr-1" /> Auto Approve</Badge>;
      case 'auto_decline':
        return <Badge className="bg-red-100 text-red-700"><X className="w-3 h-3 mr-1" /> Auto Decline</Badge>;
      case 'flag_review':
        return <Badge className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" /> Flag for Review</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-violet-500" />
            AI Reservation Rules
          </CardTitle>
          <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="w-4 h-4" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Reservation Rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 pt-4">
                {/* Rule Name */}
                <div>
                  <Label>Rule Name</Label>
                  <Input
                    value={newRule.name}
                    onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                    placeholder="e.g., Weekday Lunch Auto-Approve"
                    className="mt-1"
                  />
                </div>

                {/* Action */}
                <div>
                  <Label>Action</Label>
                  <Select
                    value={newRule.action}
                    onValueChange={(v) => setNewRule({ ...newRule, action: v })}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_approve">Auto Approve</SelectItem>
                      <SelectItem value="auto_decline">Auto Decline</SelectItem>
                      <SelectItem value="flag_review">Flag for Review</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Party Size */}
                <div>
                  <Label>Party Size Range</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      min={1}
                      value={newRule.conditions.min_party_size}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, min_party_size: parseInt(e.target.value) || 1 }
                      })}
                      className="w-20"
                    />
                    <span className="text-slate-500">to</span>
                    <Input
                      type="number"
                      min={1}
                      value={newRule.conditions.max_party_size}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, max_party_size: parseInt(e.target.value) || 10 }
                      })}
                      className="w-20"
                    />
                    <span className="text-slate-500">guests</span>
                  </div>
                </div>

                {/* Days of Week */}
                <div>
                  <Label>Days of Week</Label>
                  <div className="flex gap-2 mt-2">
                    {DAYS.map((day, index) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(index)}
                        className={cn(
                          "w-10 h-10 rounded-lg text-sm font-medium transition-all",
                          newRule.conditions.days_of_week?.includes(index)
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Slots */}
                <div>
                  <Label>Time Slots (leave empty for all times)</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleTimeSlot(slot)}
                        className={cn(
                          "py-2 rounded-lg text-sm transition-all",
                          newRule.conditions.time_slots?.includes(slot)
                            ? "bg-violet-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        )}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Advance Booking */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Advance (hours)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={newRule.conditions.min_advance_hours}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, min_advance_hours: parseInt(e.target.value) || 0 }
                      })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Max Advance (days)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={newRule.conditions.max_advance_days}
                      onChange={(e) => setNewRule({
                        ...newRule,
                        conditions: { ...newRule.conditions, max_advance_days: parseInt(e.target.value) || 30 }
                      })}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Table Availability */}
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="tableAvail"
                    checked={newRule.conditions.require_table_available}
                    onCheckedChange={(checked) => setNewRule({
                      ...newRule,
                      conditions: { ...newRule.conditions, require_table_available: checked }
                    })}
                  />
                  <Label htmlFor="tableAvail" className="cursor-pointer">
                    Require table to be available
                  </Label>
                </div>

                {/* Priority */}
                <div>
                  <Label>Priority (higher = evaluated first)</Label>
                  <Input
                    type="number"
                    value={newRule.priority}
                    onChange={(e) => setNewRule({ ...newRule, priority: parseInt(e.target.value) || 0 })}
                    className="mt-1 w-24"
                  />
                </div>

                <Button
                  onClick={() => createRuleMutation.mutate(newRule)}
                  disabled={!newRule.name || createRuleMutation.isPending}
                  className="w-full"
                >
                  {createRuleMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                  ) : (
                    'Create Rule'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-violet-500 mx-auto" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Sparkles className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No rules created yet</p>
            <p className="text-xs mt-1">Add rules to automate reservation handling</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map((rule) => (
              <div
                key={rule.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  rule.is_active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-100 opacity-60"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{rule.name}</span>
                      {getActionBadge(rule.action)}
                      {rule.priority > 0 && (
                        <Badge variant="outline" className="text-xs">
                          Priority: {rule.priority}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {rule.conditions?.min_party_size || 1}-{rule.conditions?.max_party_size || 10} guests
                      </span>
                      {rule.conditions?.time_slots?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {rule.conditions.time_slots.length} time slots
                        </span>
                      )}
                      {rule.conditions?.days_of_week?.length < 7 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {rule.conditions.days_of_week.map(d => DAYS[d]).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => updateRuleMutation.mutate({
                        id: rule.id,
                        data: { is_active: checked }
                      })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => deleteRuleMutation.mutate(rule.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}