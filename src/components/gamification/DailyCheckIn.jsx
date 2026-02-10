import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Flame } from 'lucide-react';
import { dailyCheckIn } from './GamificationTracker';
import { cn } from "@/lib/utils";

export default function DailyCheckIn({ currentUser }) {
  const queryClient = useQueryClient();
  const [isChecking, setIsChecking] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['userStats', currentUser?.id],
    queryFn: async () => {
      const result = await base44.entities.UserStats.filter({ user_id: currentUser.id });
      return Array.isArray(result) ? result[0] : null;
    },
    enabled: !!currentUser,
  });

  const today = new Date().toISOString().split('T')[0];
  const hasCheckedIn = stats?.last_check_in === today;

  const handleCheckIn = async () => {
    setIsChecking(true);
    await dailyCheckIn(currentUser.id, currentUser.email, currentUser.full_name);
    queryClient.invalidateQueries(['userStats']);
    setIsChecking(false);
  };

  if (!currentUser) return null;

  return (
    <Card className={cn(
      "border-2 transition-all",
      hasCheckedIn 
        ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50" 
        : "border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {hasCheckedIn ? (
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center animate-pulse">
                <Flame className="w-7 h-7 text-white" />
              </div>
            )}
            
            <div>
              <h3 className="font-semibold text-lg">
                {hasCheckedIn ? 'Checked In Today!' : 'Daily Check-In'}
              </h3>
              <p className="text-sm text-slate-600">
                {hasCheckedIn 
                  ? `${stats?.check_in_streak || 0} day streak! Come back tomorrow`
                  : `Earn 20 points • ${stats?.check_in_streak || 0} day streak`
                }
              </p>
            </div>
          </div>

          <Button
            onClick={handleCheckIn}
            disabled={hasCheckedIn || isChecking}
            className={cn(
              "gap-2",
              hasCheckedIn 
                ? "bg-slate-400" 
                : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            )}
          >
            {isChecking ? 'Checking In...' : hasCheckedIn ? 'Done' : 'Check In'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}