import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Skeleton } from "@/components/ui/skeleton";

export default function FoodDiscoveryGrid({ restaurants = [] }) {
  const navigate = useNavigate();

  // Fetch all menu items from all visible restaurants (with images)
  const restaurantIds = restaurants.map(r => r.id);

  const { data: allMenuItems = [], isLoading } = useQuery({
    queryKey: ['discoveryMenuItems', restaurantIds.join(',')],
    queryFn: async () => {
      if (restaurantIds.length === 0) return [];
      // Fetch menu items for up to 20 restaurants in parallel
      const chunks = restaurantIds.slice(0, 20);
      const results = await Promise.all(
        chunks.map(id => base44.entities.MenuItem.filter({ restaurant_id: id }).catch(() => []))
      );
      return results.flat();
    },
    enabled: restaurantIds.length > 0,
    staleTime: 30000,
  });

  // Only items with images, shuffled each render (stable per session)
  const featuredDishes = useMemo(() => {
    const withImages = allMenuItems.filter(item => item.image_url && item.is_available !== false);
    // Stable shuffle using sort on id hash
    return [...withImages]
      .sort((a, b) => (a.id > b.id ? 1 : -1))
      .slice(0, 6);
  }, [allMenuItems]);

  const getRestaurant = (restaurantId) => restaurants.find(r => r.id === restaurantId);

  const handleClick = (item) => {
    const restaurant = getRestaurant(item.restaurant_id);
    if (!restaurant) return;
    // Navigate to restaurant detail menu tab with item id as highlight param
    navigate(createPageUrl('RestaurantDetail') + `?id=${item.restaurant_id}&tab=menu&highlightItem=${item.id}`);
  };

  if (isLoading) {
    return (
      <div className="mb-12 p-6 rounded-3xl border-2 border-transparent bg-gradient-to-br from-purple-50 to-pink-50">
        <div className="text-center mb-6">
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-5 w-80 mx-auto" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (featuredDishes.length < 3) return null;

  return (
    <div className="mb-12">
      {/* Gradient border wrapper */}
      <div className="p-[2px] rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400">
        <div className="bg-white rounded-[22px] p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">
              Discover Culinary Excellence
            </h2>
            <p className="text-slate-500 text-sm md:text-base">
              Explore flavors that inspire your next dining adventure
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {featuredDishes.map((item, idx) => {
              const restaurant = getRestaurant(item.restaurant_id);
              return (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  className={`relative overflow-hidden rounded-2xl group cursor-pointer focus:outline-none focus:ring-4 focus:ring-purple-400 ${
                    idx === 1 ? 'md:col-span-1' : ''
                  }`}
                  style={{ aspectRatio: '4/3' }}
                >
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {/* Dark overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                  {/* Hover purple highlight ring */}
                  <div className="absolute inset-0 ring-0 group-hover:ring-4 group-hover:ring-purple-500/60 rounded-2xl transition-all duration-300" />
                  {/* Label */}
                  <div className="absolute bottom-0 left-0 p-3 text-left">
                    <p className="text-white font-semibold text-sm leading-tight drop-shadow">
                      {item.name}
                    </p>
                    {restaurant && (
                      <p className="text-white/75 text-xs mt-0.5 drop-shadow">
                        {restaurant.name} · {restaurant.neighborhood || restaurant.cuisine}
                      </p>
                    )}
                  </div>
                  {/* View menu badge on hover */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                    <span className="px-2 py-1 rounded-full bg-purple-600 text-white text-[10px] font-semibold shadow-lg">
                      View on Menu →
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}