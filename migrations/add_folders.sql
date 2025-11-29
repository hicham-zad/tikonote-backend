-- Folder Organization System Migration
-- Run this in Supabase SQL Editor

-- 1. Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#E9D5FF',
  emoji TEXT DEFAULT '📁',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_folder_name UNIQUE(user_id, name)
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);

-- 3. Add folder_id column to topics table
ALTER TABLE topics 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL;

-- 4. Create index on folder_id for faster queries
CREATE INDEX IF NOT EXISTS idx_topics_folder_id ON topics(folder_id);

-- 5. Enable Row Level Security
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for folders
-- Users can only see their own folders
CREATE POLICY "Users can view their own folders"
  ON folders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own folders
CREATE POLICY "Users can insert their own folders"
  ON folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update their own folders"
  ON folders FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete their own folders"
  ON folders FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 8. Create trigger for folders table
DROP TRIGGER IF EXISTS update_folders_updated_at ON folders;
CREATE TRIGGER update_folders_updated_at
    BEFORE UPDATE ON folders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Migration complete!
-- You can now use the folders table to organize topics.
