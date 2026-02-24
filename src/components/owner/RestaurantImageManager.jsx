import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Star, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RestaurantImageManager({ restaurant }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['restaurantImages', restaurant?.id],
    queryFn: () => base44.entities.RestaurantImage.filter({ restaurant_id: restaurant.id }, 'sort_order'),
    enabled: !!restaurant?.id
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const maxOrder = Math.max(0, ...images.map(i => i.sort_order || 0));
      const isCover = images.length === 0;
      
      const newImage = await base44.entities.RestaurantImage.create({
        restaurant_id: restaurant.id,
        url: file_url,
        sort_order: maxOrder + 1,
        is_cover: isCover,
        alt: `${restaurant.name} photo`
      });
      
      // Update restaurant cover_image if this is the first image
      if (isCover) {
        await base44.entities.Restaurant.update(restaurant.id, { 
          cover_image: file_url 
        });
      }
      
      return newImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurantImages']);
      queryClient.invalidateQueries(['restaurants']);
      toast.success('Image uploaded');
    }
  });

  const reorderMutation = useMutation({
    mutationFn: async (reordered) => {
      await Promise.all(
        reordered.map((img, idx) =>
          base44.entities.RestaurantImage.update(img.id, { sort_order: idx })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurantImages']);
    }
  });

  const setCoverMutation = useMutation({
    mutationFn: async (imageId) => {
      await Promise.all([
        ...images.map(i => base44.entities.RestaurantImage.update(i.id, { is_cover: false })),
        base44.entities.RestaurantImage.update(imageId, { is_cover: true })
      ]);
      
      // Update restaurant cover_image field
      const coverImg = images.find(i => i.id === imageId);
      if (coverImg) {
        await base44.entities.Restaurant.update(restaurant.id, { cover_image: coverImg.url });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurantImages']);
      queryClient.invalidateQueries(['restaurants']);
      toast.success('Cover image updated');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId) => {
      const img = images.find(i => i.id === imageId);
      await base44.entities.RestaurantImage.delete(imageId);
      
      // If deleting cover, set first remaining as cover
      if (img?.is_cover && images.length > 1) {
        const nextCover = images.find(i => i.id !== imageId);
        if (nextCover) {
          await base44.entities.RestaurantImage.update(nextCover.id, { is_cover: true });
          await base44.entities.Restaurant.update(restaurant.id, { cover_image: nextCover.url });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['restaurantImages']);
      queryClient.invalidateQueries(['restaurants']);
      toast.success('Image deleted');
    }
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      for (const file of files.slice(0, 5)) {
        await uploadMutation.mutateAsync(file);
      }
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    
    const reordered = Array.from(images);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    
    queryClient.setQueryData(['restaurantImages', restaurant?.id], reordered);
    reorderMutation.mutate(reordered);
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="aspect-[4/3] bg-slate-200 rounded" />)}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">Restaurant Images</h3>
        <label>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={uploading}
          />
          <Button disabled={uploading} asChild>
            <span className="cursor-pointer">
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Upload Images
            </span>
          </Button>
        </label>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <Upload className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <p className="text-slate-600 mb-2">No images yet</p>
          <p className="text-sm text-slate-500">Upload images to showcase your restaurant</p>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="images" direction="horizontal">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {images.map((img, idx) => (
                  <Draggable key={img.id} draggableId={img.id} index={idx}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        className={cn(
                          "relative group rounded-lg overflow-hidden border-2 transition-all",
                          img.is_cover ? "border-emerald-500 shadow-lg" : "border-slate-200",
                          snapshot.isDragging && "shadow-2xl rotate-2 scale-105"
                        )}
                      >
                        <div className="aspect-[4/3] relative">
                          <img
                            src={img.url}
                            alt={img.alt || `Restaurant photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            srcSet={`${img.url}?w=400 1x, ${img.url}?w=800 2x`}
                          />
                          
                          {/* Drag handle */}
                          <div
                            {...provided.dragHandleProps}
                            className="absolute top-2 left-2 w-8 h-8 bg-black/60 rounded-lg flex items-center justify-center cursor-move opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <GripVertical className="w-4 h-4 text-white" />
                          </div>

                          {/* Cover badge */}
                          {img.is_cover && (
                            <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-white" />
                              Cover
                            </div>
                          )}

                          {/* Actions */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2">
                              {!img.is_cover && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="flex-1"
                                  onClick={() => setCoverMutation.mutate(img.id)}
                                >
                                  <Star className="w-3 h-3 mr-1" />
                                  Set Cover
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm('Delete this image?')) {
                                    deleteMutation.mutate(img.id);
                                  }
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      <p className="text-sm text-slate-500 mt-4">
        Drag to reorder • First image or starred image is the cover • Images auto-cycle on hover in search results
      </p>
    </Card>
  );
}