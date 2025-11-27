import React from 'react';
import { MapPin, ChevronDown, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function CitySelector({ cities, selectedCity, onCityChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="gap-2 px-3 py-2 h-auto font-medium text-base hover:bg-slate-100"
        >
          <MapPin className="w-5 h-5 text-emerald-600" />
          <span>{selectedCity?.name || 'Select City'}</span>
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {cities.map((city) => (
          <DropdownMenuItem
            key={city.id}
            onClick={() => onCityChange(city)}
            className={cn(
              "flex items-center justify-between py-3 cursor-pointer",
              selectedCity?.id === city.id && "bg-slate-50"
            )}
          >
            <div>
              <div className="font-medium">{city.name}</div>
              <div className="text-sm text-slate-500">{city.state}</div>
            </div>
            {selectedCity?.id === city.id && (
              <Check className="w-5 h-5 text-emerald-600" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}