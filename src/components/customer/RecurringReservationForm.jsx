import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Repeat, CalendarDays } from 'lucide-react';
import { toast } from "sonner";
import SpecialRequestsForm from './SpecialRequestsForm';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function RecurringReservationForm({ 
  restaurantId, 
  currentUser,
  tables = []
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    party_size: 2,
    frequency: 'weekly',
    day_of_week: 1, // Monday
    time: '19:00',
    start_date: new Date(),
    table_id: '',
    special_requests: '',
    dietary_needs: [],
    notes: ''
  });

  const createRecurringMutation = useMutation({
    mutationFn: async () => {
      if (!currentUser) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }

      // Create the recurring series
      const series = await base44.entities.RecurringReservation.create({
        user_id: currentUser.id,
        restaurant_id: restaurantId,
        table_id: formData.table_id,
        party_size: formData.party_size,
        frequency: formData.frequency,
        day_of_week: formData.day_of_week,
        time: formData.time,
        start_date: formData.start_date.toISOString().split('T')[0],
        is_active: true,
        special_requests: formData.special_requests,
        dietary_needs: formData.dietary_needs,
        notes: formData.notes,
        next_reservation_date: formData.start_date.toISOString().split('T')[0]
      });

      // Create first reservation in the series
      await base44.entities.Reservation.create({
        restaurant_id: restaurantId,
        table_id: formData.table_id,
        user_id: currentUser.id,
        user_name: currentUser.full_name,
        user_email: currentUser.email,
        party_size: formData.party_size,
        reservation_date: formData.start_date.toISOString().split('T')[0],
        reservation_time: formData.time,
        special_requests: formData.special_requests,
        dietary_needs: formData.dietary_needs,
        notes: `Recurring ${formData.frequency} reservation`,
        is_recurring: true,
        recurring_series_id: series.id,
        status: 'pending'
      });

      return series;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringReservations']);
      queryClient.invalidateQueries(['myReservations']);
      setOpen(false);
      toast.success('Recurring reservation created! We\'ll automatically create your weekly reservations.');
    },
    onError: (error) => {
      toast.error('Failed to create recurring reservation: ' + error.message);
    }
  });

  const handleSubmit = () => {
    if (!formData.table_id) {
      toast.error('Please select a table');
      return;
    }
    createRecurringMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Repeat className="w-4 h-4" />
          Set Up Recurring
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-purple-600" />
            Recurring Reservation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>For frequent diners:</strong> Set up automatic weekly or monthly reservations at your favorite spot
            </p>
          </div>

          {/* Party Size */}
          <div>
            <Label>Party Size</Label>
            <Select 
              value={String(formData.party_size)} 
              onValueChange={(val) => setFormData({ ...formData, party_size: Number(val) })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'person' : 'people'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Frequency */}
          <div>
            <Label>Frequency</Label>
            <Select value={formData.frequency} onValueChange={(val) => setFormData({ ...formData, frequency: val })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Every Week</SelectItem>
                <SelectItem value="biweekly">Every 2 Weeks</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day of Week */}
          <div>
            <Label>Day of Week</Label>
            <Select 
              value={String(formData.day_of_week)} 
              onValueChange={(val) => setFormData({ ...formData, day_of_week: Number(val) })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OF_WEEK.map((day, idx) => (
                  <SelectItem key={idx} value={String(idx)}>{day}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Time */}
          <div>
            <Label>Time</Label>
            <Input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="mt-1.5"
            />
          </div>

          {/* Table Selection */}
          <div>
            <Label>Preferred Table</Label>
            <Select value={formData.table_id} onValueChange={(val) => setFormData({ ...formData, table_id: val })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select a table" />
              </SelectTrigger>
              <SelectContent>
                {tables.filter(t => t.status === 'free').map(table => (
                  <SelectItem key={table.id} value={table.id}>
                    {table.label} ({table.capacity} seats)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start Date */}
          <div>
            <Label>Start Date</Label>
            <Calendar
              mode="single"
              selected={formData.start_date}
              onSelect={(date) => setFormData({ ...formData, start_date: date || new Date() })}
              className="rounded-md border mt-1.5"
              disabled={(date) => date < new Date()}
            />
          </div>

          {/* Special Requests */}
          <SpecialRequestsForm
            specialRequests={formData.special_requests}
            dietaryNeeds={formData.dietary_needs}
            onSpecialRequestsChange={(val) => setFormData({ ...formData, special_requests: val })}
            onDietaryNeedsChange={(val) => setFormData({ ...formData, dietary_needs: val })}
            onOccasionChange={() => {}}
            showAITip={true}
          />

          <Button
            onClick={handleSubmit}
            disabled={createRecurringMutation.isPending}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {createRecurringMutation.isPending ? 'Creating...' : 'Create Recurring Reservation'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}