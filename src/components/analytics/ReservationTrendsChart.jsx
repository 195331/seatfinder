import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import moment from 'moment';

export default function ReservationTrendsChart({ reservations }) {
  const [view, setView] = React.useState('daily');

  const chartData = useMemo(() => {
    if (view === 'daily') {
      const last30Days = {};
      for (let i = 29; i >= 0; i--) {
        const date = moment().subtract(i, 'days').format('MMM DD');
        last30Days[date] = { date, reservations: 0, approved: 0, cancelled: 0 };
      }
      
      reservations.forEach(r => {
        const date = moment(r.reservation_date).format('MMM DD');
        if (last30Days[date]) {
          last30Days[date].reservations++;
          if (r.status === 'approved') last30Days[date].approved++;
          if (r.status === 'cancelled') last30Days[date].cancelled++;
        }
      });
      
      return Object.values(last30Days);
    } else if (view === 'weekly') {
      const last12Weeks = {};
      for (let i = 11; i >= 0; i--) {
        const week = moment().subtract(i, 'weeks').format('MMM D');
        last12Weeks[week] = { week, reservations: 0, approved: 0, cancelled: 0 };
      }
      
      reservations.forEach(r => {
        const week = moment(r.reservation_date).startOf('week').format('MMM D');
        if (last12Weeks[week]) {
          last12Weeks[week].reservations++;
          if (r.status === 'approved') last12Weeks[week].approved++;
          if (r.status === 'cancelled') last12Weeks[week].cancelled++;
        }
      });
      
      return Object.values(last12Weeks);
    } else {
      const last12Months = {};
      for (let i = 11; i >= 0; i--) {
        const month = moment().subtract(i, 'months').format('MMM YYYY');
        last12Months[month] = { month, reservations: 0, approved: 0, cancelled: 0 };
      }
      
      reservations.forEach(r => {
        const month = moment(r.reservation_date).format('MMM YYYY');
        if (last12Months[month]) {
          last12Months[month].reservations++;
          if (r.status === 'approved') last12Months[month].approved++;
          if (r.status === 'cancelled') last12Months[month].cancelled++;
        }
      });
      
      return Object.values(last12Months);
    }
  }, [reservations, view]);

  const xKey = view === 'daily' ? 'date' : view === 'weekly' ? 'week' : 'month';

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Reservation Trends</CardTitle>
          <Tabs value={view} onValueChange={setView}>
            <TabsList>
              <TabsTrigger value="daily">Daily</TabsTrigger>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="reservations" stroke="#6366f1" strokeWidth={2} name="Total" />
            <Line type="monotone" dataKey="approved" stroke="#10b981" strokeWidth={2} name="Approved" />
            <Line type="monotone" dataKey="cancelled" stroke="#ef4444" strokeWidth={2} name="Cancelled" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}