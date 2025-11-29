import React from 'react';
import { Tag, Clock, Sparkles } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, isAfter, isBefore } from 'date-fns';

const PROMO_COLORS = {
  discount: 'from-red-500 to-orange-500',
  happy_hour: 'from-amber-500 to-yellow-500',
  special_menu: 'from-purple-500 to-pink-500',
  event: 'from-blue-500 to-indigo-500',
  loyalty_bonus: 'from-emerald-500 to-teal-500'
};

export default function PromotionBanner({ promotions = [], compact = false }) {
  const now = new Date();
  
  // Filter active promotions
  const activePromos = promotions.filter(p => {
    if (!p.is_active) return false;
    if (p.valid_until && isBefore(new Date(p.valid_until), now)) return false;
    if (p.valid_from && isAfter(new Date(p.valid_from), now)) return false;
    return true;
  });

  if (activePromos.length === 0) return null;

  if (compact) {
    return (
      <div className="flex gap-2 overflow-x-auto py-2 -mx-4 px-4">
        {activePromos.slice(0, 3).map((promo) => (
          <div
            key={promo.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full text-white text-sm whitespace-nowrap",
              "bg-gradient-to-r",
              PROMO_COLORS[promo.type] || PROMO_COLORS.discount
            )}
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="font-medium">{promo.title}</span>
            {promo.discount_percent && (
              <Badge className="bg-white/20 text-white border-0 text-xs">
                {promo.discount_percent}% off
              </Badge>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activePromos.map((promo) => (
        <div
          key={promo.id}
          className={cn(
            "relative overflow-hidden rounded-xl p-4 text-white",
            "bg-gradient-to-r",
            PROMO_COLORS[promo.type] || PROMO_COLORS.discount
          )}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {promo.type === 'loyalty_bonus' && <Sparkles className="w-4 h-4" />}
                  <Badge className="bg-white/20 text-white border-0 text-xs capitalize">
                    {promo.type?.replace('_', ' ')}
                  </Badge>
                </div>
                <h3 className="text-lg font-bold">{promo.title}</h3>
                {promo.description && (
                  <p className="text-sm opacity-90 mt-1">{promo.description}</p>
                )}
              </div>
              {promo.discount_percent && (
                <div className="text-right">
                  <span className="text-3xl font-bold">{promo.discount_percent}%</span>
                  <p className="text-xs opacity-80">OFF</p>
                </div>
              )}
            </div>

            {(promo.time_start || promo.valid_until) && (
              <div className="flex items-center gap-2 mt-3 text-xs opacity-80">
                <Clock className="w-3 h-3" />
                {promo.time_start && promo.time_end && (
                  <span>{promo.time_start} - {promo.time_end}</span>
                )}
                {promo.valid_until && (
                  <span>• Until {format(new Date(promo.valid_until), 'MMM d')}</span>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}