-- Create storage buckets for avatars and company logos
-- This migration sets up the necessary buckets and policies for image uploads

-- Enable storage if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create avatars bucket (for user profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true, -- Public bucket so images can be accessed without auth
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create company-logos bucket (for company logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true, -- Public bucket so images can be accessed without auth
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- ===== AVATARS BUCKET POLICIES =====

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all avatars
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ===== COMPANY LOGOS BUCKET POLICIES =====

-- Allow company admins to upload company logo
CREATE POLICY "Admins can upload company logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid()
    AND company_id::text = (storage.foldername(name))[1]
    AND role = 'admin'
    AND is_active = true
  )
);

-- Allow company admins to update company logo
CREATE POLICY "Admins can update company logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid()
    AND company_id::text = (storage.foldername(name))[1]
    AND role = 'admin'
    AND is_active = true
  )
)
WITH CHECK (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid()
    AND company_id::text = (storage.foldername(name))[1]
    AND role = 'admin'
    AND is_active = true
  )
);

-- Allow company admins to delete company logo
CREATE POLICY "Admins can delete company logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos'
  AND EXISTS (
    SELECT 1 FROM company_users
    WHERE user_id = auth.uid()
    AND company_id::text = (storage.foldername(name))[1]
    AND role = 'admin'
    AND is_active = true
  )
);

-- Allow public read access to all company logos
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Add helpful comment
COMMENT ON TABLE storage.buckets IS 'Storage buckets for user avatars and company logos. Avatars: users can manage their own. Company logos: only admins can manage.';
