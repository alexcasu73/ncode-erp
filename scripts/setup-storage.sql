-- ============================================
-- SETUP SUPABASE STORAGE FOR IMAGES
-- ============================================
-- Create buckets for avatars and company logos
-- ============================================

-- Create avatars bucket (for user profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create company-logos bucket (for company logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket
-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to avatars
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Storage policies for company-logos bucket
-- Allow company admins to upload/update their company logo
CREATE POLICY "Admins can upload company logo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.role = 'admin'
      AND company_users.is_active = true
      AND (storage.foldername(name))[1] = company_users.company_id::text
  )
);

CREATE POLICY "Admins can update company logo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.role = 'admin'
      AND company_users.is_active = true
      AND (storage.foldername(name))[1] = company_users.company_id::text
  )
);

CREATE POLICY "Admins can delete company logo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-logos' AND
  EXISTS (
    SELECT 1 FROM company_users
    WHERE company_users.user_id = auth.uid()
      AND company_users.role = 'admin'
      AND company_users.is_active = true
      AND (storage.foldername(name))[1] = company_users.company_id::text
  )
);

-- Allow public read access to company logos
CREATE POLICY "Public can view company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');

-- Verify buckets were created
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id IN ('avatars', 'company-logos');
