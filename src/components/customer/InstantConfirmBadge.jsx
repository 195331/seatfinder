import React from 'react';
import { Zap } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function InstantConfirmBadge({ size = 'sm' }) {
  return (
    <Badge className="bg-purple-600 text-white border-0 gap-1">
      <Zap className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      Instant Confirm
    </Badge>
  );
}