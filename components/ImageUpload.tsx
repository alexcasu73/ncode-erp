import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  bucket: 'avatars' | 'company-logos';
  folder: string; // user_id for avatars, company_id for logos
  shape?: 'circle' | 'square';
  size?: 'small' | 'medium' | 'large';
  label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  currentImageUrl,
  onImageUploaded,
  bucket,
  folder,
  shape = 'circle',
  size = 'medium',
  label = 'Carica immagine',
}) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update preview when currentImageUrl changes
  useEffect(() => {
    setPreviewUrl(currentImageUrl);
  }, [currentImageUrl]);

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-24 h-24',
    large: 'w-32 h-32',
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setError('');

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (bucket === 'company-logos') {
        validTypes.push('image/svg+xml');
      }

      if (!validTypes.includes(file.type)) {
        setError('Formato non supportato. Usa JPG, PNG o WEBP.');
        return;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        setError('File troppo grande. Massimo 5MB.');
        return;
      }

      setUploading(true);

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Math.random().toString(36).substring(2)}.${fileExt}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // Update preview
      setPreviewUrl(publicUrl);

      // Notify parent component
      onImageUploaded(publicUrl);

      // Delete old image if exists and it's not the default
      if (currentImageUrl && !currentImageUrl.includes('picsum.photos')) {
        const oldPath = currentImageUrl.split(`/${bucket}/`)[1];
        if (oldPath) {
          await supabase.storage.from(bucket).remove([oldPath]);
        }
      }

    } catch (err: any) {
      console.error('Error uploading image:', err);
      setError(err.message || 'Errore durante l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!previewUrl) return;

    try {
      setUploading(true);

      // Delete from storage if not default
      if (!previewUrl.includes('picsum.photos')) {
        const path = previewUrl.split(`/${bucket}/`)[1];
        if (path) {
          await supabase.storage.from(bucket).remove([path]);
        }
      }

      setPreviewUrl(undefined);
      onImageUploaded('');

    } catch (err: any) {
      console.error('Error removing image:', err);
      setError('Errore durante la rimozione');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Image Preview */}
      <div className="relative">
        <div
          className={`${sizeClasses[size]} ${
            shape === 'circle' ? 'rounded-full' : 'rounded-lg'
          } bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-gray-200 dark:border-dark-border`}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <Upload className="text-gray-400" size={size === 'large' ? 32 : 24} />
          )}
        </div>

        {/* Remove button */}
        {previewUrl && !uploading && (
          <button
            onClick={handleRemoveImage}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            title="Rimuovi immagine"
          >
            <X size={14} />
          </button>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader className="text-white animate-spin" size={24} />
          </div>
        )}
      </div>

      {/* Upload button */}
      <div className="text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Caricamento...' : label}
        </button>

        {/* Error message */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</p>
        )}

        {/* Info */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          JPG, PNG o WEBP. Max 5MB.
        </p>
      </div>
    </div>
  );
};
