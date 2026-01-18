import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ImageUploadDragDrop({ onImageUploaded, maxImages = 5, existingImages = [] }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState(existingImages);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      toast.error('Please drop image files only');
      return;
    }

    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    await uploadFiles(files);
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }
    await uploadFiles(files);
  };

  const uploadFiles = async (files) => {
    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      const newImages = [...images, ...uploadedUrls];
      setImages(newImages);
      onImageUploaded?.(newImages);
      toast.success(`${files.length} image(s) uploaded`);
    } catch (error) {
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    onImageUploaded?.(newImages);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-all",
          isDragging ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-slate-50",
          uploading && "opacity-50 pointer-events-none"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
            <p className="text-slate-600">Uploading...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="w-10 h-10 text-slate-400" />
            <div>
              <p className="text-slate-700 font-medium mb-1">
                Drag & drop images here or{' '}
                <label className="text-emerald-600 cursor-pointer hover:text-emerald-700">
                  browse
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="text-xs text-slate-500">
                {images.length} / {maxImages} images
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {images.map((url, index) => (
            <div key={index} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100">
              <img src={url} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
              <Button
                size="icon"
                variant="destructive"
                className="absolute top-2 right-2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}