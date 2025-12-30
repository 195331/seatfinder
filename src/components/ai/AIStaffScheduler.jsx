import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Sparkles, Loader2, Users, CalendarDays } from 'lucide-react';
import { toast } from "sonner";
import moment from 'moment';

export default function AIStaffScheduler({ restaurantId }) {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [suggestions, setSuggestions] = useState(null);

  const { data: staff = [] } = useQuery({
    queryKey: ['staff', restaurantId],
    queryFn: () => base44.entities.RestaurantStaff.filter({ restaurant_id: restaurantId, is_active: true }),
    enabled: !!restaurantId,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', restaurantId],
    queryFn: () => base44.entities.Reservation.filter({ restaurant_id: restaurantId }),
    enabled: !!restaurantId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules', restaurantId, selectedDate],
    queryFn: () => base44.entities.StaffSchedule.filter({ 
      restaurant_id: restaurantId,
      date: moment(selectedDate).format('YYYY-MM-DD')
    }),
    enabled: !!restaurantId,
  });

  const generateScheduleMutation = useMutation({
    mutationFn: async () => {
      const weekStart = moment(selectedDate).startOf('week');
      const weekReservations = reservations.filter(r => {
        const resDate = moment(r.reservation_date);
        return resDate.isBetween(weekStart, weekStart.clone().add(7, 'days'));
      });

      const prompt = `You are a restaurant staffing expert. Generate an optimal staff schedule for a restaurant.

Staff Available:
${staff.map(s => `- ${s.user_email} (${s.role})`).join('\n')}

Reservations this week: ${weekReservations.length}
Peak reservation times: ${weekReservations.map(r => r.reservation_time).join(', ')}

Generate a weekly schedule (7 days starting ${weekStart.format('YYYY-MM-DD')}) that:
- Assigns adequate staff for peak hours
- Balances workload across team
- Ensures manager coverage during busy periods
- Assigns hosts for reservation-heavy days

Return JSON array of shifts:
[
  {
    "staff_email": "email@example.com",
    "date": "2025-01-06",
    "shift_start": "17:00",
    "shift_end": "23:00",
    "role": "host"
  }
]`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            shifts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  staff_email: { type: "string" },
                  date: { type: "string" },
                  shift_start: { type: "string" },
                  shift_end: { type: "string" },
                  role: { type: "string" }
                }
              }
            }
          }
        }
      });

      return result.shifts || [];
    },
    onSuccess: (data) => {
      setSuggestions(data);
      toast.success('Schedule generated!');
    }
  });

  const applyScheduleMutation = useMutation({
    mutationFn: async () => {
      const creates = suggestions.map(shift => {
        const staffMember = staff.find(s => s.user_email === shift.staff_email);
        if (!staffMember) return null;
        
        return base44.entities.StaffSchedule.create({
          restaurant_id: restaurantId,
          staff_id: staffMember.id,
          staff_name: staffMember.user_email,
          date: shift.date,
          shift_start: shift.shift_start,
          shift_end: shift.shift_end,
          role_assignment: shift.role,
          status: 'scheduled'
        });
      }).filter(Boolean);

      await Promise.all(creates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['schedules']);
      setSuggestions(null);
      toast.success('Schedule applied!');
    }
  });

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              AI Staff Scheduler
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Generate optimal staff schedules based on forecasted demand
            </p>
          </div>
          <Button
            onClick={() => generateScheduleMutation.mutate()}
            disabled={generateScheduleMutation.isPending || staff.length === 0}
            className="gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {generateScheduleMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <CalendarDays className="w-4 h-4" />
                Generate Schedule
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => setSelectedDate(date || new Date())}
          className="rounded-md border mb-4"
        />

        {staff.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No staff members added yet</p>
            <p className="text-sm mt-1">Add staff in Settings to use scheduling</p>
          </div>
        ) : suggestions ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-900">
                AI generated {suggestions.length} shifts for the week
              </p>
              <Button
                onClick={() => applyScheduleMutation.mutate()}
                disabled={applyScheduleMutation.isPending}
                className="gap-2"
              >
                {applyScheduleMutation.isPending ? 'Applying...' : 'Apply Schedule'}
              </Button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {suggestions.map((shift, idx) => (
                <div key={idx} className="p-3 border rounded-lg bg-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{shift.staff_email}</p>
                      <p className="text-sm text-slate-500">
                        {moment(shift.date).format('MMM D')} • {shift.shift_start} - {shift.shift_end}
                      </p>
                    </div>
                    <Badge>{shift.role}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : schedules.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 mb-3">
              Schedule for {moment(selectedDate).format('MMMM D, YYYY')}
            </p>
            {schedules.map((schedule) => (
              <div key={schedule.id} className="p-3 border rounded-lg bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{schedule.staff_name}</p>
                    <p className="text-sm text-slate-500">
                      {schedule.shift_start} - {schedule.shift_end}
                    </p>
                  </div>
                  <Badge variant="secondary">{schedule.role_assignment}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">
            No schedule for this date. Generate one with AI!
          </p>
        )}
      </CardContent>
    </Card>
  );
}