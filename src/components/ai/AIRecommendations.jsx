import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Users, LayoutGrid, Clock, Lightbulb, Loader2, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import moment from 'moment';

export default function AIRecommendations({ restaurantId, restaurant }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateRecommendations = async () => {
      setLoading(true);
      try {
        const [seatingHistory, reservations, waitlistHistory] = await Promise.all([
          base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 200),
          base44.entities.Reservation.filter({ restaurant_id: restaurantId }, '-created_date', 100),
          base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId }, '-created_date', 100)
        ]);

        const recs = [];

        // Analyze peak hours
        const hourlyOccupancy = {};
        seatingHistory.forEach(h => {
          const hour = moment(h.recorded_at).hour();
          if (!hourlyOccupancy[hour]) hourlyOccupancy[hour] = [];
          hourlyOccupancy[hour].push(h.occupancy_percent || 0);
        });

        const peakHours = Object.entries(hourlyOccupancy)
          .map(([hour, values]) => ({
            hour: parseInt(hour),
            avg: values.reduce((a, b) => a + b, 0) / values.length
          }))
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 3);

        if (peakHours.length > 0 && peakHours[0].avg > 80) {
          recs.push({
            type: 'staffing',
            priority: 'high',
            icon: Users,
            title: 'Increase Staffing',
            description: `Peak hours (${peakHours.map(p => `${p.hour}:00`).join(', ')}) show ${Math.round(peakHours[0].avg)}% occupancy. Consider adding 1-2 extra staff during these times.`,
            action: 'View Schedule'
          });
        }

        // Analyze table utilization
        const avgPartySize = waitlistHistory.length > 0
          ? waitlistHistory.reduce((sum, w) => sum + (w.party_size || 2), 0) / waitlistHistory.length
          : 2.5;

        if (avgPartySize <= 2.5 && restaurant?.has_bar_seating === false) {
          recs.push({
            type: 'layout',
            priority: 'medium',
            icon: LayoutGrid,
            title: 'Consider Bar Seating',
            description: `Average party size is ${avgPartySize.toFixed(1)} guests. Adding bar seating could increase capacity for smaller parties and reduce wait times.`,
            action: 'Edit Layout'
          });
        }

        // Analyze wait times
        const seatedEntries = waitlistHistory.filter(w => w.status === 'seated' && w.seated_at);
        if (seatedEntries.length > 0) {
          const avgWait = seatedEntries.reduce((sum, w) => {
            const waitMs = new Date(w.seated_at) - new Date(w.created_date);
            return sum + waitMs / 60000;
          }, 0) / seatedEntries.length;

          if (avgWait > 25) {
            recs.push({
              type: 'efficiency',
              priority: 'high',
              icon: Clock,
              title: 'Reduce Wait Times',
              description: `Average wait time is ${Math.round(avgWait)} minutes. Consider implementing a table timer system or offering appetizer specials to encourage faster turnover.`,
              action: 'View Waitlist'
            });
          }
        }

        // Reservation patterns
        const approvedRes = reservations.filter(r => r.status === 'approved');
        const declinedRes = reservations.filter(r => r.status === 'declined');
        const declineRate = reservations.length > 0 
          ? (declinedRes.length / reservations.length) * 100 
          : 0;

        if (declineRate > 20) {
          recs.push({
            type: 'reservations',
            priority: 'medium',
            icon: Lightbulb,
            title: 'High Decline Rate',
            description: `${Math.round(declineRate)}% of reservation requests are declined. Consider adding more reservable tables or adjusting time slots to capture more bookings.`,
            action: 'Manage Tables'
          });
        }

        // Low occupancy suggestion
        const recentAvgOccupancy = seatingHistory.slice(0, 20).reduce((sum, h) => sum + (h.occupancy_percent || 0), 0) / 20;
        if (recentAvgOccupancy < 40) {
          recs.push({
            type: 'marketing',
            priority: 'medium',
            icon: Sparkles,
            title: 'Boost Visibility',
            description: `Recent occupancy averaging ${Math.round(recentAvgOccupancy)}%. Consider running promotions during slow hours or updating your restaurant photos to attract more customers.`,
            action: 'Edit Profile'
          });
        }

        setRecommendations(recs.slice(0, 4));
      } catch (error) {
        console.error('Recommendations error:', error);
      }
      setLoading(false);
    };

    if (restaurantId) {
      generateRecommendations();
    }
  }, [restaurantId, restaurant]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-8 flex flex-col items-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
          <p className="text-sm text-slate-500">Analyzing your restaurant data...</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-8 text-center">
          <Sparkles className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-medium text-slate-900">Looking good!</p>
          <p className="text-sm text-slate-500">No immediate recommendations at this time.</p>
        </CardContent>
      </Card>
    );
  }

  const priorityColors = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200'
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, index) => {
          const Icon = rec.icon;
          return (
            <div 
              key={index}
              className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900">{rec.title}</h4>
                      <Badge className={`text-xs ${priorityColors[rec.priority]}`}>
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600">{rec.description}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}