import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, TrendingUp, Calendar, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import moment from 'moment';

export default function OccupancyForecaster({ restaurantId }) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('today');

  useEffect(() => {
    const generateForecast = async () => {
      setLoading(true);
      try {
        // Fetch historical data
        const [seatingHistory, reservations] = await Promise.all([
          base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 500),
          base44.entities.Reservation.filter({ restaurant_id: restaurantId, status: 'approved' })
        ]);

        // Group by day of week and hour
        const patterns = {};
        seatingHistory.forEach(h => {
          const date = moment(h.recorded_at);
          const dayHour = `${date.day()}-${date.hour()}`;
          if (!patterns[dayHour]) {
            patterns[dayHour] = { total: 0, count: 0 };
          }
          patterns[dayHour].total += h.occupancy_percent || 0;
          patterns[dayHour].count++;
        });

        // Generate forecast for next 7 days
        const forecastData = [];
        for (let d = 0; d < 7; d++) {
          const date = moment().add(d, 'days');
          const dayData = [];
          
          for (let h = 11; h <= 22; h++) {
            const dayHour = `${date.day()}-${h}`;
            const pattern = patterns[dayHour];
            
            // Base prediction from historical data
            let predicted = pattern ? Math.round(pattern.total / pattern.count) : 50;
            
            // Adjust for confirmed reservations
            const dayReservations = reservations.filter(r => 
              moment(r.reservation_date).isSame(date, 'day') &&
              parseInt(r.reservation_time?.split(':')[0]) === h
            );
            predicted += dayReservations.length * 5; // Each reservation adds ~5% occupancy
            
            // Weekend boost
            if (date.day() === 0 || date.day() === 5 || date.day() === 6) {
              predicted = Math.min(100, predicted * 1.15);
            }
            
            dayData.push({
              hour: `${h}:00`,
              predicted: Math.min(100, Math.round(predicted)),
              reservations: dayReservations.length
            });
          }
          
          forecastData.push({
            date: date.format('YYYY-MM-DD'),
            label: d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : date.format('ddd'),
            data: dayData,
            peakHour: dayData.reduce((max, curr) => curr.predicted > max.predicted ? curr : max).hour,
            avgOccupancy: Math.round(dayData.reduce((sum, d) => sum + d.predicted, 0) / dayData.length)
          });
        }

        setForecast(forecastData);
      } catch (error) {
        console.error('Forecast error:', error);
      }
      setLoading(false);
    };

    if (restaurantId) {
      generateForecast();
    }
  }, [restaurantId]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
          <p className="text-slate-500">Generating AI forecast...</p>
        </CardContent>
      </Card>
    );
  }

  if (!forecast) return null;

  const selectedDay = forecast.find(f => 
    view === 'today' ? f.label === 'Today' : f.label === view
  ) || forecast[0];

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            AI Occupancy Forecast
          </CardTitle>
          <Badge className="bg-indigo-100 text-indigo-700">Predictive</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {forecast.map((day) => (
            <button
              key={day.date}
              onClick={() => setView(day.label)}
              className={`flex flex-col items-center px-4 py-2 rounded-xl border transition-all min-w-[80px] ${
                selectedDay.date === day.date 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700' 
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="text-xs font-medium">{day.label}</span>
              <span className="text-lg font-bold">{day.avgOccupancy}%</span>
              <span className="text-xs text-slate-500">avg</span>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={selectedDay.data}>
              <defs>
                <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="hour" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: 'none', 
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                formatter={(value, name) => [
                  name === 'predicted' ? `${value}%` : value,
                  name === 'predicted' ? 'Predicted Occupancy' : 'Reservations'
                ]}
              />
              <Area 
                type="monotone" 
                dataKey="predicted" 
                stroke="#6366f1" 
                fill="url(#occupancyGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Insights */}
        <div className="mt-4 p-4 bg-indigo-50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span className="font-medium text-indigo-900">AI Insight</span>
          </div>
          <p className="text-sm text-indigo-700">
            Peak expected at <strong>{selectedDay.peakHour}</strong> with ~{
              selectedDay.data.find(d => d.hour === selectedDay.peakHour)?.predicted
            }% occupancy. 
            {selectedDay.avgOccupancy > 70 
              ? ' Consider adding extra staff during peak hours.'
              : ' Normal staffing levels should be sufficient.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}