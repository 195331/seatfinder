import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Clock, Plus, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from "@/lib/utils";
import moment from 'moment';

import LiveSeatingFloor from './liveseating/LiveSeatingFloor';
import LiveSeatingWaitlist from './liveseating/LiveSeatingWaitlist';
import LiveSeatingTableDetails from './liveseating/LiveSeatingTableDetails';
import AddToWaitlistDialog from './liveseating/AddToWaitlistDialog';

export default function LiveSeating({ restaurant }) {
  const queryClient = useQueryClient();
  const [selectedTable, setSelectedTable] = useState(null);
  const [showAddWaitlist, setShowAddWaitlist] = useState(false);
  const [selectedWaitlistEntry, setSelectedWaitlistEntry] = useState(null);

  // Fetch live data
  const { data: tables = [] } = useQuery({
    queryKey: ['liveTables', restaurant.id],
    queryFn: () => base44.entities.Table.filter({ restaurant_id: restaurant.id }),
    enabled: !!restaurant.id,
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['liveWaitlist', restaurant.id],
    queryFn: () => base44.entities.WaitlistEntry.filter({ 
      restaurant_id: restaurant.id,
      status: 'waiting'
    }, '-created_date'),
    enabled: !!restaurant.id,
    refetchInterval: 5000
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['liveReservations', restaurant.id],
    queryFn: () => base44.entities.Reservation.filter({ 
      restaurant_id: restaurant.id,
      status: 'approved',
      reservation_date: moment().format('YYYY-MM-DD')
    }),
    enabled: !!restaurant.id,
    refetchInterval: 30000
  });

  // Calculate metrics
  const freeTables = tables.filter(t => t.status === 'free').length;
  const seatedTables = tables.filter(t => t.status === 'seated');
  const totalSeatedGuests = seatedTables.reduce((sum, t) => sum + (t.party_size || t.capacity), 0);
  const avgWaitTime = waitlist.length > 0 
    ? Math.round(waitlist.reduce((sum, w) => sum + moment().diff(moment(w.created_date), 'minutes'), 0) / waitlist.length)
    : 0;

  // Mutations
  const updateTableStatusMutation = useMutation({
    mutationFn: ({ tableId, updates }) => base44.entities.Table.update(tableId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['liveTables']);
    }
  });

  const seatPartyMutation = useMutation({
    mutationFn: async ({ tableId, waitlistEntryId, partyName, partySize, isWalkIn }) => {
      await base44.entities.Table.update(tableId, {
        status: 'seated',
        party_name: partyName,
        party_size: partySize,
        seated_at: new Date().toISOString()
      });
      if (waitlistEntryId) {
        await base44.entities.WaitlistEntry.update(waitlistEntryId, {
          status: 'seated',
          seated_at: new Date().toISOString()
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['liveTables']);
      queryClient.invalidateQueries(['liveWaitlist']);
      setSelectedWaitlistEntry(null);
    }
  });

  const handleTableClick = (table) => {
    if (selectedTable?.id === table.id) {
      setSelectedTable(null);
    } else {
      setSelectedTable(table);
    }
  };

  const handleStatusChange = (tableId, newStatus, additionalData = {}) => {
    updateTableStatusMutation.mutate({
      tableId,
      updates: { status: newStatus, ...additionalData }
    });
  };

  const handleSeatParty = (data) => {
    seatPartyMutation.mutate(data);
  };

  const floorPlan = restaurant?.floor_plan_data;

  if (!floorPlan || !floorPlan.publishedAt) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-16 text-center">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Floor Plan Published</h3>
          <p className="text-slate-600 mb-4">
            Please publish a floor plan in the Floor Plan tab to use Live Seating
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      {/* Left Panel - Waitlist */}
      <div className="col-span-3 space-y-4 overflow-y-auto">
        {/* Summary Bar */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Currently Seated</span>
              <Badge className="bg-emerald-100 text-emerald-700">{totalSeatedGuests} guests</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Free Tables</span>
              <Badge className="bg-blue-100 text-blue-700">{freeTables}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Waitlist</span>
              <Badge className="bg-purple-100 text-purple-700">
                {waitlist.length} ({avgWaitTime}m avg)
              </Badge>
            </div>
            <Link to={createPageUrl('OwnerDashboard') + `?tab=calendar`}>
              <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
                <Calendar className="w-4 h-4" />
                View Today's Reservations
              </Button>
            </Link>
          </CardContent>
        </Card>

        <LiveSeatingWaitlist
          waitlist={waitlist}
          reservations={reservations}
          onAddWaitlist={() => setShowAddWaitlist(true)}
          onSelectEntry={setSelectedWaitlistEntry}
          selectedEntry={selectedWaitlistEntry}
          onSeatParty={handleSeatParty}
          tables={tables}
        />

        <AddToWaitlistDialog
          open={showAddWaitlist}
          onOpenChange={setShowAddWaitlist}
          restaurantId={restaurant.id}
          areas={floorPlan.areas}
          onSuccess={() => queryClient.invalidateQueries(['liveWaitlist'])}
        />
      </div>

      {/* Center - Floor Plan */}
      <div className="col-span-6">
        <LiveSeatingFloor
          floorPlan={floorPlan}
          tables={tables}
          selectedTable={selectedTable}
          onTableClick={handleTableClick}
          highlightedTables={selectedWaitlistEntry ? tables.filter(t => 
            t.status === 'free' && 
            t.capacity >= selectedWaitlistEntry.party_size &&
            (!selectedWaitlistEntry.preferred_area || t.area_id === selectedWaitlistEntry.preferred_area)
          ).map(t => t.id) : []}
        />
      </div>

      {/* Right Panel - Table Details */}
      <div className="col-span-3">
        <LiveSeatingTableDetails
          table={selectedTable}
          onStatusChange={handleStatusChange}
          onSeatParty={handleSeatParty}
          waitlist={waitlist}
          tables={tables}
          isUpdating={updateTableStatusMutation.isPending || seatPartyMutation.isPending}
        />
      </div>
    </div>
  );
}