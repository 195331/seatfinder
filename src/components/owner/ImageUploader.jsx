import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ImageUploader({ 
  currentImage, 
  onImageUploaded, 
  aspectRatio = "16/10",
  placeholder = "Upload restaurant image"
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setPreview(file_url);
      onImageUploaded(file_url);
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image: ' + error.message);
    }
    setUploading(false);
  };

  const handleRemove = () => {
    setPreview(null);
    onImageUploaded(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {preview ? (
        <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio }}>
          <img 
            src={preview} 
            alt="Restaurant" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change'}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleRemove}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full border-2 border-dashed border-slate-200 rounded-xl",
            "flex flex-col items-center justify-center gap-3 p-8",
            "hover:border-slate-300 hover:bg-slate-50 transition-colors",
            "cursor-pointer"
          )}
          style={{ aspectRatio }}
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-slate-400" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-700">{placeholder}</p>
                <p className="text-sm text-slate-500">PNG, JPG up to 5MB</p>
              </div>
            </>
          )}
        </button>
      )}
    </div>
  );
}