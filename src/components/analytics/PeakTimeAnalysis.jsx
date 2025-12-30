import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Badge } from "@/components/ui/badge";
import moment from 'moment';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function PeakTimeAnalysis({ reservations, waitlistEntries }) {
  const peakDays = useMemo(() => {
    const dayCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    
    reservations.forEach(r => {
      const day = moment(r.reservation_date).day();
      dayCounts[day]++;
    });
    
    return Object.entries(dayCounts)
      .map(([day, count]) => ({ day: DAYS[parseInt(day)], count }))
      .sort((a, b) => b.count - a.count);
  }, [reservations]);

  const peakHours = useMemo(() => {
    const hourCounts = {};
    
    reservations.forEach(r => {
      const hour = parseInt(r.reservation_time?.split(':')[0] || 0);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    waitlistEntries.forEach(w => {
      const hour = moment(w.created_date).hour();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    return Object.entries(hourCounts)
      .map(([hour, count]) => {
        const h = parseInt(hour);
        const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
        return { hour: label, count, hourNum: h };
      })
      .sort((a, b) => a.hourNum - b.hourNum);
  }, [reservations, waitlistEntries]);

  const topDay = peakDays[0];
  const topHour = [...peakHours].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Peak Days */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Peak Days</CardTitle>
          <p className="text-sm text-slate-500">Busiest days of the week</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={peakDays}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" fontSize={11} angle={-45} textAnchor="end" height={80} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {peakDays.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#6366f1' : '#94a3b8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <strong>🏆 Peak Day:</strong> {topDay?.day} with {topDay?.count} bookings
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Peak Hours */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle>Peak Hours</CardTitle>
          <p className="text-sm text-slate-500">Busiest times of day</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={peakHours}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" fontSize={10} angle={-45} textAnchor="end" height={80} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {peakHours.map((entry, index) => {
                  const max = Math.max(...peakHours.map(h => h.count));
                  return <Cell key={`cell-${index}`} fill={entry.count === max ? '#10b981' : '#94a3b8'} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
            <p className="text-sm text-emerald-800">
              <strong>🕐 Peak Hour:</strong> {topHour?.hour} with {topHour?.count} bookings/walk-ins
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}