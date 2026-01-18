import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown, Star, Crown, Users, Plus, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function WaitlistPriorityManager({ restaurantId }) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPriority, setNewPriority] = useState({
    priority_name: '',
    priority_level: 1
  });

  const { data: priorities = [] } = useQuery({
    queryKey: ['waitlist-priorities', restaurantId],
    queryFn: () => base44.entities.WaitlistPriority.filter({ restaurant_id: restaurantId }, '-priority_level'),
    enabled: !!restaurantId,
  });

  const createPriorityMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.WaitlistPriority.create({
        restaurant_id: restaurantId,
        ...newPriority,
        is_active: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['waitlist-priorities']);
      setShowAddDialog(false);
      setNewPriority({ priority_name: '', priority_level: 1 });
      toast.success('Priority tier created');
    }
  });

  const deletePriorityMutation = useMutation({
    mutationFn: (id) => base44.entities.WaitlistPriority.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['waitlist-priorities']);
      toast.success('Priority tier deleted');
    }
  });

  const priorityIcons = {
    VIP: Crown,
    Member: Star,
    Regular: Users
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Waitlist Priority Tiers</CardTitle>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Tier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Priority Tier</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Priority Name</Label>
                <Input
                  value={newPriority.priority_name}
                  onChange={(e) => setNewPriority({ ...newPriority, priority_name: e.target.value })}
                  placeholder="VIP, Member, Regular..."
                />
              </div>
              <div>
                <Label>Priority Level (higher = more priority)</Label>
                <Input
                  type="number"
                  value={newPriority.priority_level}
                  onChange={(e) => setNewPriority({ ...newPriority, priority_level: parseInt(e.target.value) || 1 })}
                />
              </div>
              <Button
                onClick={() => createPriorityMutation.mutate()}
                disabled={!newPriority.priority_name || createPriorityMutation.isPending}
                className="w-full"
              >
                {createPriorityMutation.isPending ? 'Creating...' : 'Create Tier'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {priorities.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No priority tiers configured</p>
          ) : (
            priorities.map((priority) => {
              const Icon = priorityIcons[priority.priority_name] || Users;
              return (
                <div key={priority.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="font-medium">{priority.priority_name}</p>
                      <p className="text-xs text-slate-500">Level {priority.priority_level}</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deletePriorityMutation.mutate(priority.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}