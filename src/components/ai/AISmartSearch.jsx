import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, Sparkles, Loader2, X } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import _ from 'lodash';

const EXAMPLE_QUERIES = [
  "quiet Italian spot for a date",
  "cheap eats with outdoor seating",
  "family-friendly brunch place",
  "fancy sushi under $50",
  "vegan options near downtown"
];

export default function AISmartSearch({ onFiltersExtracted, onSearchChange }) {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedFilters, setExtractedFilters] = useState(null);
  const [showExamples, setShowExamples] = useState(false);

  const processNaturalLanguage = async (searchQuery) => {
    if (!searchQuery.trim() || searchQuery.length < 5) {
      setExtractedFilters(null);
      onFiltersExtracted?.(null);
      onSearchChange?.(searchQuery);
      return;
    }

    setIsProcessing(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Parse this restaurant search query and extract filters. Query: "${searchQuery}"

Extract any of these attributes if mentioned or implied:
- cuisine: (Italian, Japanese, Mexican, Chinese, Indian, Thai, American, Mediterranean, Korean, French, Vietnamese, Seafood, Steakhouse, Pizza, Sushi, BBQ, Vegetarian, Cafe)
- priceLevel: 1 (cheap/budget), 2 (moderate), 3 (upscale), 4 (fine dining)
- seatingLevel: "chill" (quiet/low-key), "moderate", "busy"
- hasOutdoor: true if outdoor/patio seating mentioned
- hasBarSeating: true if bar seating mentioned
- isKidFriendly: true if family/kid friendly mentioned
- vibes: array of vibes like "romantic", "casual", "quiet", "lively", "cozy"
- searchText: any specific name or keyword to search

Only include fields that are clearly indicated by the query.`,
        response_json_schema: {
          type: "object",
          properties: {
            cuisine: { type: "string" },
            priceLevel: { type: "number" },
            seatingLevel: { type: "string" },
            hasOutdoor: { type: "boolean" },
            hasBarSeating: { type: "boolean" },
            isKidFriendly: { type: "boolean" },
            vibes: { type: "array", items: { type: "string" } },
            searchText: { type: "string" },
            interpretation: { type: "string", description: "Brief interpretation of query" }
          }
        }
      });

      // Clean up response - remove null/undefined values
      const filters = {};
      if (response.cuisine) filters.cuisines = [response.cuisine];
      if (response.priceLevel) filters.priceLevel = response.priceLevel;
      if (response.seatingLevel) filters.seatingLevel = response.seatingLevel;
      if (response.hasOutdoor) filters.hasOutdoor = true;
      if (response.hasBarSeating) filters.hasBarSeating = true;
      if (response.isKidFriendly) filters.isKidFriendly = true;

      const extractedData = {
        filters,
        vibes: response.vibes || [],
        searchText: response.searchText || '',
        interpretation: response.interpretation || ''
      };

      setExtractedFilters(extractedData);
      onFiltersExtracted?.(extractedData);
      onSearchChange?.(response.searchText || '');

    } catch (error) {
      console.error('AI search failed:', error);
      onSearchChange?.(searchQuery);
    }

    setIsProcessing(false);
  };

  // Debounce the AI processing
  const debouncedProcess = useCallback(
    _.debounce((q) => processNaturalLanguage(q), 800),
    []
  );

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setShowExamples(false);
    
    // For short queries, just do regular search
    if (value.length < 5) {
      setExtractedFilters(null);
      onFiltersExtracted?.(null);
      onSearchChange?.(value);
    } else {
      debouncedProcess(value);
    }
  };

  const handleExampleClick = (example) => {
    setQuery(example);
    setShowExamples(false);
    processNaturalLanguage(example);
  };

  const clearSearch = () => {
    setQuery('');
    setExtractedFilters(null);
    onFiltersExtracted?.(null);
    onSearchChange?.('');
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isProcessing ? (
            <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
          ) : extractedFilters ? (
            <Sparkles className="w-5 h-5 text-violet-500" />
          ) : (
            <Search className="w-5 h-5 text-slate-400" />
          )}
        </div>
        <Input
          value={query}
          onChange={handleInputChange}
          onFocus={() => !query && setShowExamples(true)}
          onBlur={() => setTimeout(() => setShowExamples(false), 200)}
          placeholder="Search by name, vibe, or craving..."
          className={cn(
            "pl-10 pr-10 rounded-full border-slate-200 bg-slate-50 h-12",
            "focus:ring-2 focus:ring-violet-200 focus:border-violet-300",
            extractedFilters && "border-violet-300 bg-violet-50/50"
          )}
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-slate-200 text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Examples Dropdown */}
      {showExamples && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white rounded-xl shadow-lg border border-slate-200 z-50">
          <p className="text-xs text-slate-500 mb-2">Try searching like:</p>
          <div className="space-y-1">
            {EXAMPLE_QUERIES.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-violet-50 hover:text-violet-700 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 inline-block mr-2 text-violet-400" />
                "{example}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Filters Display */}
      {extractedFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          {extractedFilters.interpretation && (
            <span className="text-xs text-slate-500 italic">
              {extractedFilters.interpretation}
            </span>
          )}
          <div className="flex flex-wrap gap-1.5">
            {extractedFilters.filters.cuisines?.map((c, i) => (
              <Badge key={i} className="bg-violet-100 text-violet-700 text-xs">
                {c}
              </Badge>
            ))}
            {extractedFilters.filters.priceLevel && (
              <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                {'$'.repeat(extractedFilters.filters.priceLevel)}
              </Badge>
            )}
            {extractedFilters.filters.seatingLevel && (
              <Badge className="bg-blue-100 text-blue-700 text-xs">
                {extractedFilters.filters.seatingLevel}
              </Badge>
            )}
            {extractedFilters.filters.hasOutdoor && (
              <Badge className="bg-amber-100 text-amber-700 text-xs">
                Outdoor
              </Badge>
            )}
            {extractedFilters.filters.isKidFriendly && (
              <Badge className="bg-pink-100 text-pink-700 text-xs">
                Family-friendly
              </Badge>
            )}
            {extractedFilters.vibes?.map((vibe, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {vibe}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}