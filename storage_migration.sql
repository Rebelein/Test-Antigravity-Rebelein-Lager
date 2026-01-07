-- Storage Bucket for Workwear Images
-- Enables public read access and authenticated upload access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('workwear', 'workwear', true)
ON CONFLICT (id) DO NOTHING;

-- Policies
CREATE POLICY "Workwear images are publicly accessible"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'workwear' );

CREATE POLICY "Authenticated users can upload workwear images"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'workwear' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can update workwear images"
  ON storage.objects FOR UPDATE
  WITH CHECK ( bucket_id = 'workwear' AND auth.role() = 'authenticated' );

CREATE POLICY "Authenticated users can delete workwear images"
  ON storage.objects FOR DELETE
  USING ( bucket_id = 'workwear' AND auth.role() = 'authenticated' );
