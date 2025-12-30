import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarX, Plus, Trash2, Settings2 } from 'lucide-react';
import { toast } from "sonner";
import moment from 'moment';
import AutoReservationRules from './AutoReservationRules';

export default function AdvancedReservationRules({ restaurantId }) {
  const queryClient = useQueryClient();
  const [showBlackoutDialog, setShowBlackoutDialog] = useState(false);
  const [blackoutData, setBlackoutData] = useState({
    date: new Date(),
    reason: '',
    is_full_day: true,
    blocked_times: []
  });

  // Fetch blackout dates
  const { data: blackoutDates = [] } = useQuery({
    queryKey: ['blackoutDates', restaurantId],
    queryFn: () => base44.entities.BlackoutDate.filter({ restaurant_id: restaurantId }, 'date'),
    enabled: !!restaurantId,
  });

  // Mutations
  const createBlackoutMutation = useMutation({
    mutationFn: (data) => base44.entities.BlackoutDate.create({
      ...data,
      restaurant_id: restaurantId,
      date: moment(data.date).format('YYYY-MM-DD')
    }),
    onSuccess: () => {
      queryClient.invalidateQueries(['blackoutDates']);
      setShowBlackoutDialog(false);
      setBlackoutData({ date: new Date(), reason: '', is_full_day: true, blocked_times: [] });
      toast.success('Blackout date added');
    }
  });

  const deleteBlackoutMutation = useMutation({
    mutationFn: (id) => base44.entities.BlackoutDate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['blackoutDates']);
      toast.success('Blackout date removed');
    }
  });

  return (
    <div className="space-y-6">
      <Tabs defaultValue="rules">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rules">Auto Rules</TabsTrigger>
          <TabsTrigger value="blackouts">Blackout Dates</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-6">
          <AutoReservationRules restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="blackouts" className="mt-6">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarX className="w-5 h-5 text-red-600" />
                    Blackout Dates
                  </CardTitle>
                  <p className="text-sm text-slate-500 mt-1">
                    Block specific dates or times for private events or maintenance
                  </p>
                </div>
                <Dialog open={showBlackoutDialog} onOpenChange={setShowBlackoutDialog}>
                  <DialogTrigger asChild>
                    <Button className="gap-2">
                      <Plus className="w-4 h-4" />
                      Add Blackout
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Block Date/Time</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div>
                        <Label>Select Date</Label>
                        <Calendar
                          mode="single"
                          selected={blackoutData.date}
                          onSelect={(date) => setBlackoutData({ ...blackoutData, date: date || new Date() })}
                          className="rounded-md border mt-1.5"
                          disabled={(date) => date < new Date()}
                        />
                      </div>
                      <div>
                        <Label>Reason</Label>
                        <Input
                          value={blackoutData.reason}
                          onChange={(e) => setBlackoutData({ ...blackoutData, reason: e.target.value })}
                          placeholder="Private event, maintenance, etc."
                          className="mt-1.5"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="fullDay"
                          checked={blackoutData.is_full_day}
                          onChange={(e) => setBlackoutData({ ...blackoutData, is_full_day: e.target.checked })}
                          className="rounded"
                        />
                        <Label htmlFor="fullDay" className="cursor-pointer">Block entire day</Label>
                      </div>
                      <Button
                        onClick={() => createBlackoutMutation.mutate(blackoutData)}
                        disabled={createBlackoutMutation.isPending}
                        className="w-full"
                      >
                        {createBlackoutMutation.isPending ? 'Adding...' : 'Add Blackout Date'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {blackoutDates.length > 0 ? (
                <div className="space-y-2">
                  {blackoutDates.map((blackout) => (
                    <div key={blackout.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">
                          {moment(blackout.date).format('MMMM D, YYYY')}
                        </p>
                        {blackout.reason && (
                          <p className="text-sm text-slate-500">{blackout.reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={blackout.is_full_day ? "destructive" : "secondary"}>
                          {blackout.is_full_day ? 'Full Day' : 'Partial'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBlackoutMutation.mutate(blackout.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  No blackout dates configured
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}