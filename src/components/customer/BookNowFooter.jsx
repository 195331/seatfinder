import React from 'react';
import { Button } from "@/components/ui/button";
import { Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BookNowFooter({ onBookClick, onAIClick, className }) {
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50 md:hidden",
      "bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-2xl",
      className
    )}>
      <div className="px-4 py-3 flex gap-3">
        <Button
          onClick={onAIClick}
          variant="outline"
          className="flex-1 gap-2 h-12"
        >
          <Sparkles className="w-5 h-5" />
          Ask AI
        </Button>
        <Button
          onClick={onBookClick}
          className="flex-1 gap-2 h-12 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg"
        >
          <Calendar className="w-5 h-5" />
          Book Now
        </Button>
      </div>
    </div>
  );
}