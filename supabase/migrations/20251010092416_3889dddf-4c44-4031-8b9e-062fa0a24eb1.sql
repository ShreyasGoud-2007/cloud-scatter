-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to files table
ALTER TABLE public.files ADD COLUMN user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Update files RLS policies
DROP POLICY IF EXISTS "Anyone can view files" ON public.files;
DROP POLICY IF EXISTS "Anyone can insert files" ON public.files;
DROP POLICY IF EXISTS "Anyone can update files" ON public.files;

CREATE POLICY "Users can view own files"
  ON public.files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
  ON public.files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files"
  ON public.files FOR UPDATE
  USING (auth.uid() = user_id);

-- Update file_parts RLS policies
DROP POLICY IF EXISTS "Anyone can view file parts" ON public.file_parts;
DROP POLICY IF EXISTS "Anyone can insert file parts" ON public.file_parts;

CREATE POLICY "Users can view own file parts"
  ON public.file_parts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = file_parts.file_id
      AND files.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own file parts"
  ON public.file_parts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.files
      WHERE files.id = file_parts.file_id
      AND files.user_id = auth.uid()
    )
  );

-- Update storage_nodes RLS policies
DROP POLICY IF EXISTS "Anyone can view storage nodes" ON public.storage_nodes;
DROP POLICY IF EXISTS "Anyone can insert storage nodes" ON public.storage_nodes;
DROP POLICY IF EXISTS "Anyone can update storage nodes" ON public.storage_nodes;

CREATE POLICY "Authenticated users can view storage nodes"
  ON public.storage_nodes FOR SELECT
  TO authenticated
  USING (true);