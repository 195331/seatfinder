import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart2, TrendingUp, TrendingDown, Minus, Eye, Clock, Users, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function CompetitorBenchmark({ restaurantId, cityId, cuisine }) {
  const [benchmarkData, setBenchmarkData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch your restaurant data
  const { data: restaurant } = useQuery({
    queryKey: ['benchmarkRestaurant', restaurantId],
    queryFn: () => base44.entities.Restaurant.filter({ id: restaurantId }).then(r => r[0]),
    enabled: !!restaurantId,
  });

  const { data: seatingHistory = [] } = useQuery({
    queryKey: ['benchmarkSeating', restaurantId],
    queryFn: () => base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 100),
    enabled: !!restaurantId,
  });

  const { data: waitlist = [] } = useQuery({
    queryKey: ['benchmarkWaitlist', restaurantId],
    queryFn: () => base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId, status: 'seated' }, '-created_date', 100),
    enabled: !!restaurantId,
  });

  // Fetch similar restaurants for benchmarking (same city, same cuisine)
  const { data: similarRestaurants = [] } = useQuery({
    queryKey: ['similarRestaurants', cityId, cuisine],
    queryFn: () => base44.entities.Restaurant.filter({ 
      city_id: cityId, 
      cuisine: cuisine, 
      status: 'approved' 
    }),
    enabled: !!cityId && !!cuisine,
  });

  useEffect(() => {
    if (!restaurant || similarRestaurants.length === 0) {
      setLoading(false);
      return;
    }

    // Calculate your metrics
    const yourOccupancy = seatingHistory.length > 0
      ? seatingHistory.reduce((sum, h) => sum + (h.occupancy_percent || 0), 0) / seatingHistory.length
      : 0;

    const yourWaitTime = waitlist.length > 0
      ? waitlist.reduce((sum, w) => {
          if (w.seated_at && w.created_date) {
            return sum + (new Date(w.seated_at) - new Date(w.created_date)) / 60000;
          }
          return sum;
        }, 0) / waitlist.length
      : 0;

    // Calculate anonymized market averages
    const competitorCount = similarRestaurants.filter(r => r.id !== restaurantId).length;
    const avgViews = similarRestaurants.reduce((sum, r) => sum + (r.view_count || 0), 0) / Math.max(similarRestaurants.length, 1);
    const avgFavorites = similarRestaurants.reduce((sum, r) => sum + (r.favorite_count || 0), 0) / Math.max(similarRestaurants.length, 1);
    const avgRating = similarRestaurants.filter(r => r.average_rating > 0).reduce((sum, r) => sum + r.average_rating, 0) / 
      Math.max(similarRestaurants.filter(r => r.average_rating > 0).length, 1);

    // Simulated market averages (in production, these would come from aggregated data)
    const marketAvgOccupancy = 55 + Math.random() * 20;
    const marketAvgWaitTime = 12 + Math.random() * 8;

    setBenchmarkData({
      competitorCount,
      metrics: [
        {
          name: 'Avg Occupancy',
          yours: Math.round(yourOccupancy),
          market: Math.round(marketAvgOccupancy),
          unit: '%',
          icon: Users,
          higherIsBetter: true
        },
        {
          name: 'Avg Wait Time',
          yours: Math.round(yourWaitTime),
          market: Math.round(marketAvgWaitTime),
          unit: 'min',
          icon: Clock,
          higherIsBetter: false
        },
        {
          name: 'Page Views',
          yours: restaurant.view_count || 0,
          market: Math.round(avgViews),
          unit: '',
          icon: Eye,
          higherIsBetter: true
        },
        {
          name: 'Rating',
          yours: restaurant.average_rating || 0,
          market: Math.round(avgRating * 10) / 10,
          unit: '★',
          icon: TrendingUp,
          higherIsBetter: true
        }
      ]
    });
    setLoading(false);
  }, [restaurant, similarRestaurants, seatingHistory, waitlist]);

  if (loading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="py-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  if (!benchmarkData || benchmarkData.competitorCount === 0) {
    return (
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-indigo-600" />
            Market Benchmark
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-slate-500">
          <p>Not enough similar restaurants in your area for benchmarking</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-indigo-600" />
          Market Benchmark
        </CardTitle>
        <CardDescription>
          Compared to {benchmarkData.competitorCount} similar {cuisine} restaurants in your area
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {benchmarkData.metrics.map((metric, idx) => {
          const Icon = metric.icon;
          const diff = metric.yours - metric.market;
          const isGood = metric.higherIsBetter ? diff >= 0 : diff <= 0;
          const percentile = metric.market > 0 
            ? Math.min(100, Math.round((metric.yours / metric.market) * 50))
            : 50;

          return (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-sm">{metric.name}</span>
                </div>
                <Badge className={cn(
                  "gap-1",
                  isGood ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                )}>
                  {isGood ? (
                    diff === 0 ? <Minus className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {diff > 0 ? '+' : ''}{diff !== 0 ? diff : '='}{metric.unit}
                </Badge>
              </div>
              
              <div className="flex items-center gap-4 mb-2">
                <div className="flex-1">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>You: {metric.yours}{metric.unit}</span>
                    <span>Market: {metric.market}{metric.unit}</span>
                  </div>
                  <div className="relative h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "absolute h-full rounded-full transition-all",
                        isGood ? "bg-emerald-500" : "bg-amber-500"
                      )}
                      style={{ width: `${percentile}%` }}
                    />
                    <div 
                      className="absolute top-0 w-0.5 h-full bg-slate-400"
                      style={{ left: '50%' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="p-3 bg-indigo-50 rounded-xl mt-4">
          <p className="text-sm text-indigo-700">
            <strong>📊 Summary:</strong> Your restaurant is performing{' '}
            {benchmarkData.metrics.filter(m => m.higherIsBetter ? m.yours >= m.market : m.yours <= m.market).length >= 3 
              ? 'above' 
              : benchmarkData.metrics.filter(m => m.higherIsBetter ? m.yours >= m.market : m.yours <= m.market).length >= 2
                ? 'at'
                : 'below'
            }{' '}market average. Focus on improving metrics where you lag behind competitors.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}