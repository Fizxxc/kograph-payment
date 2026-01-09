-- Run this in your Supabase SQL Editor

-- 1. Add is_withdraw_blocked to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_withdraw_blocked BOOLEAN DEFAULT FALSE;

-- 2. Create Notifications table
CREATE TABLE IF NOT EXISTS public.kograph_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.kograph_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent errors
DROP POLICY IF EXISTS "Notifications readable by owner" ON public.kograph_notifications;
DROP POLICY IF EXISTS "Notifications update by owner" ON public.kograph_notifications;
DROP POLICY IF EXISTS "Notifications insert by admin/service" ON public.kograph_notifications;

CREATE POLICY "Notifications readable by owner" ON public.kograph_notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Notifications update by owner" ON public.kograph_notifications
  FOR UPDATE USING (auth.uid() = user_id);
  
-- Allow admins/service role to insert notifications
CREATE POLICY "Notifications insert by admin/service" ON public.kograph_notifications
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role' OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. Update Policies for Profiles (to allow admins to update blocked status)
DROP POLICY IF EXISTS "Profiles update by admin" ON public.profiles;

CREATE POLICY "Profiles update by admin" ON public.profiles
  FOR UPDATE USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Add Destination Columns to Withdrawals
ALTER TABLE public.kograph_withdrawals 
ADD COLUMN IF NOT EXISTS channel_category TEXT, -- 'bank' or 'ewallet'
ADD COLUMN IF NOT EXISTS channel_code TEXT,     -- 'BCA', 'GOPAY', etc.
ADD COLUMN IF NOT EXISTS account_number TEXT;
