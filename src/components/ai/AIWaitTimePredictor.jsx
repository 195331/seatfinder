import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Clock, Sparkles, Loader2 } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function AIWaitTimePredictor({ restaurantId, partySize, currentWaitlistLength }) {
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const predictWaitTime = async () => {
      setLoading(true);
      try {
        // Fetch historical data
        const [seatingHistory, waitlistHistory] = await Promise.all([
          base44.entities.SeatingHistory.filter({ restaurant_id: restaurantId }, '-recorded_at', 50),
          base44.entities.WaitlistEntry.filter({ restaurant_id: restaurantId, status: 'seated' }, '-seated_at', 30)
        ]);

        // Calculate average turnover time from seated waitlist entries
        const turnoverTimes = waitlistHistory
          .filter(w => w.seated_at && w.created_date)
          .map(w => {
            const waitedMs = new Date(w.seated_at) - new Date(w.created_date);
            return waitedMs / 60000; // Convert to minutes
          });

        const avgTurnover = turnoverTimes.length > 0 
          ? turnoverTimes.reduce((a, b) => a + b, 0) / turnoverTimes.length 
          : 15;

        // Calculate current occupancy trend
        const recentOccupancy = seatingHistory.slice(0, 10);
        const avgOccupancy = recentOccupancy.length > 0
          ? recentOccupancy.reduce((sum, h) => sum + (h.occupancy_percent || 0), 0) / recentOccupancy.length
          : 50;

        // AI prediction factors
        const baseWait = currentWaitlistLength * 8; // 8 min per party ahead
        const occupancyFactor = avgOccupancy > 80 ? 1.3 : avgOccupancy > 60 ? 1.1 : 0.9;
        const partySizeFactor = partySize > 4 ? 1.2 : partySize > 2 ? 1.0 : 0.8;
        
        const predictedMinutes = Math.round(baseWait * occupancyFactor * partySizeFactor + avgTurnover * 0.3);
        
        // Confidence based on data availability
        const confidence = Math.min(90, 50 + turnoverTimes.length * 2 + recentOccupancy.length * 2);

        setPrediction({
          estimatedMinutes: Math.max(5, predictedMinutes),
          confidence,
          factors: {
            currentQueue: currentWaitlistLength,
            occupancyLevel: Math.round(avgOccupancy),
            historicalAvg: Math.round(avgTurnover)
          }
        });
      } catch (error) {
        setPrediction({
          estimatedMinutes: currentWaitlistLength * 10,
          confidence: 40,
          factors: null
        });
      }
      setLoading(false);
    };

    if (restaurantId) {
      predictWaitTime();
    }
  }, [restaurantId, partySize, currentWaitlistLength]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Calculating wait time...</span>
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-indigo-500" />
        <span className="text-sm font-medium text-indigo-700">AI Wait Time Prediction</span>
        <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-600">
          {prediction.confidence}% confident
        </Badge>
      </div>
      
      <div className="flex items-center gap-3">
        <Clock className="w-8 h-8 text-indigo-500" />
        <div>
          <p className="text-2xl font-bold text-slate-900">
            ~{prediction.estimatedMinutes} min
          </p>
          <p className="text-xs text-slate-500">
            Based on {currentWaitlistLength} parties ahead & current occupancy
          </p>
        </div>
      </div>

      {prediction.factors && (
        <div className="mt-3 pt-3 border-t border-indigo-100 grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <p className="font-medium text-slate-600">{prediction.factors.currentQueue}</p>
            <p className="text-slate-400">In queue</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-600">{prediction.factors.occupancyLevel}%</p>
            <p className="text-slate-400">Occupancy</p>
          </div>
          <div className="text-center">
            <p className="font-medium text-slate-600">{prediction.factors.historicalAvg}m</p>
            <p className="text-slate-400">Avg turnover</p>
          </div>
        </div>
      )}
    </div>
  );
}