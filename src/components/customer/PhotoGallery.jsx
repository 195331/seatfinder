import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function PhotoGallery({ restaurantId, currentUser }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('food');
  const [caption, setCaption] = useState('');
  const [showUpload, setShowUpload] = useState(false);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['photos', restaurantId],
    queryFn: () => base44.entities.RestaurantPhoto.filter({ restaurant_id: restaurantId }, '-created_date'),
    enabled: !!restaurantId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.RestaurantPhoto.create({
        restaurant_id: restaurantId,
        user_id: currentUser?.id,
        photo_url: file_url,
        category,
        caption
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['photos']);
      setShowUpload(false);
      setCaption('');
      toast.success('Photo uploaded!');
    },
    onSettled: () => setUploading(false)
  });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  const foodPhotos = photos.filter(p => p.category === 'food');
  const interiorPhotos = photos.filter(p => p.category === 'interior');
  const exteriorPhotos = photos.filter(p => p.category === 'exterior');

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <ImageIcon className="w-5 h-5" />
          Photo Gallery
        </h3>
        {currentUser && (
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Upload className="w-4 h-4" />
                Add Photo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Photo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="food">🍽️ Food</SelectItem>
                      <SelectItem value="interior">🪑 Interior</SelectItem>
                      <SelectItem value="exterior">🏠 Exterior</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Caption (optional)</label>
                  <Input
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Describe this photo..."
                  />
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="photo-upload">
                    <Button asChild className="w-full" disabled={uploading}>
                      <span>
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose Photo
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl">
          <ImageIcon className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500">No photos yet</p>
        </div>
      ) : (
        <Tabs defaultValue="food">
          <TabsList className="mb-4">
            <TabsTrigger value="food">🍽️ Food ({foodPhotos.length})</TabsTrigger>
            <TabsTrigger value="interior">🪑 Interior ({interiorPhotos.length})</TabsTrigger>
            <TabsTrigger value="exterior">🏠 Exterior ({exteriorPhotos.length})</TabsTrigger>
          </TabsList>
          
          <TabsContent value="food">
            <PhotoGrid photos={foodPhotos} />
          </TabsContent>
          <TabsContent value="interior">
            <PhotoGrid photos={interiorPhotos} />
          </TabsContent>
          <TabsContent value="exterior">
            <PhotoGrid photos={exteriorPhotos} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function PhotoGrid({ photos }) {
  if (photos.length === 0) {
    return <p className="text-center py-8 text-slate-500">No photos in this category</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {photos.map((photo) => (
        <div key={photo.id} className="aspect-square rounded-lg overflow-hidden group cursor-pointer">
          <img
            src={photo.photo_url}
            alt={photo.caption || 'Restaurant photo'}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        </div>
      ))}
    </div>
  );
}