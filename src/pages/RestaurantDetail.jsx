import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

import FloorPlanViewPremium from "@/components/customer/FloorPlanViewPremium";

export default function RestaurantDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const restaurantId = urlParams.get('id') || urlParams.get('restaurantId');

  // ---- Fetch restaurant (robust + won't crash on Base44 method differences) ----
  const {
    data: restaurant,
    isLoading: restaurantLoading,
    error: restaurantError,
    refetch: refetchRestaurant
  } = useQuery({
    queryKey: ["restaurant", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) throw new Error("Missing restaurant id in route params.");

      // Try common Base44 patterns (one of these will match your project)
      try {
        if (base44?.entities?.Restaurant?.get) return await base44.entities.Restaurant.get(restaurantId);
      } catch (_) {}
      try {
        if (base44?.entities?.Restaurant?.retrieve) return await base44.entities.Restaurant.retrieve(restaurantId);
      } catch (_) {}
      try {
        if (base44?.entities?.Restaurant?.find) return await base44.entities.Restaurant.find(restaurantId);
      } catch (_) {}

      // Fallback: filter
      if (base44?.entities?.Restaurant?.filter) {
        const rows = await base44.entities.Restaurant.filter({ id: restaurantId });
        const r = Array.isArray(rows) ? rows[0] : rows?.data?.[0];
        if (!r) throw new Error(`Restaurant not found for id=${restaurantId}`);
        return r;
      }

      throw new Error("No supported Restaurant fetch method found on base44.entities.Restaurant.");
    }
  });

  // ---- Fetch tables for this restaurant ----
  const { data: tablesRaw = [], isLoading: tablesLoading, error: tablesError } = useQuery({
    queryKey: ["tables", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      if (!restaurantId) return [];
      const res = await base44.entities.Table.filter({ restaurant_id: restaurantId });
      return Array.isArray(res) ? res : (res?.data || []);
    },
    refetchInterval: 15000
  });

  const tables = useMemo(() => (Array.isArray(tablesRaw) ? tablesRaw : []), [tablesRaw]);

  // ---- Reserve mutation ----
  const reserveMutation = useMutation({
    mutationFn: async (payload) => {
      // payload includes: table_id, reservation_date, reservation_time, party_size, notes, etc.
      if (!restaurantId) throw new Error("Missing restaurantId for reservation.");
      return await base44.entities.Reservation.create({
        restaurant_id: restaurantId,
        status: "pending",
        ...payload
      });
    },
    onSuccess: () => toast.success("Reservation request sent!"),
    onError: (e) => toast.error(e?.message || "Reservation failed.")
  });

  const floorPlanData =
    restaurant?.floor_plan_data ||
    restaurant?.floorPlanData ||
    restaurant?.floorplan_data ||
    restaurant?.floorplanData ||
    null;

  // ---- UI states ----
  if (!restaurantId) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-lg font-semibold">Restaurant page is missing an ID</div>
          <div className="text-sm text-slate-600 mt-2">
            Your route must include <code>:id</code> or <code>:restaurantId</code>.
          </div>
        </Card>
      </div>
    );
  }

  if (restaurantLoading) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-lg font-semibold">Loading restaurant…</div>
          <div className="text-sm text-slate-600 mt-2">ID: {restaurantId}</div>
        </Card>
      </div>
    );
  }

  if (restaurantError || !restaurant) {
    const msg = restaurantError?.message || "Unknown error";
    return (
      <div className="p-6">
        <Card className="p-6 space-y-3">
          <div className="text-lg font-semibold text-red-600">Can’t load this restaurant</div>
          <div className="text-sm text-slate-700">
            <div><span className="font-medium">Restaurant ID:</span> {restaurantId}</div>
            <div className="mt-2"><span className="font-medium">Error:</span> {msg}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => refetchRestaurant()}>Retry</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
          </div>
          <div className="text-xs text-slate-500">
            If the error says “not found”, the ID in the URL doesn’t exist in your Restaurants table.
            If it says “missing permissions”, your Base44 rules require auth.
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <div className="text-2xl font-bold">{restaurant.name || restaurant.title || "Restaurant"}</div>
        <div className="text-sm text-slate-600">{restaurant.address || restaurant.location || ""}</div>
      </div>

      {(tablesError || restaurantError) && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="text-sm text-red-700">
            {tablesError?.message ? `Tables error: ${tablesError.message}` : null}
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="text-lg font-semibold mb-3">Live Floor Plan</div>

        {/* If you don’t have FloorPlanViewPremium at that path, update the import line at top. */}
        <FloorPlanViewPremium
          restaurantId={restaurant.id || restaurantId}
          floorPlanData={floorPlanData}
          tables={tables}
          isSubmitting={reserveMutation.isPending}
          onReserveTable={(payload) => reserveMutation.mutate(payload)}
        />

        {tablesLoading && (
          <div className="text-xs text-slate-500 mt-2">Loading table availability…</div>
        )}
      </Card>
    </div>
  );
}