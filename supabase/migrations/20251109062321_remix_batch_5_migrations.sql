
-- Migration: 20251108210021
-- Create manager profile table (single user)
CREATE TABLE IF NOT EXISTS public.manager_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  calendar_sync_token TEXT,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  industry TEXT,
  source TEXT NOT NULL CHECK (source IN ('social', 'scraping', 'ads', 'manual')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'responded', 'converted', 'meeting_scheduled', 'closed', 'lost')),
  sentiment_score DECIMAL(3,2) DEFAULT 0.5,
  lead_score INTEGER DEFAULT 0,
  linkedin_url TEXT,
  twitter_handle TEXT,
  website TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_contacted_at TIMESTAMPTZ,
  next_followup_at TIMESTAMPTZ
);

-- Create email campaigns table
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  draft_status TEXT NOT NULL DEFAULT 'draft' CHECK (draft_status IN ('draft', 'approved', 'sent', 'rejected')),
  agent_notes TEXT,
  manager_feedback TEXT,
  scheduled_send_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create email tracking table
CREATE TABLE IF NOT EXISTS public.email_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  reply_content TEXT,
  reply_sentiment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create meetings table
CREATE TABLE IF NOT EXISTS public.meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  google_meet_link TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  agent_joined_at TIMESTAMPTZ,
  manager_joined_at TIMESTAMPTZ,
  meeting_duration INTEGER,
  transcript TEXT,
  sentiment_analysis JSONB,
  outcome TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create agent actions table
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (agent_type IN ('lead_generation', 'email_drafter', 'followup', 'meeting_scheduler', 'meeting_agent')),
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'requires_approval')),
  data JSONB DEFAULT '{}'::jsonb,
  requires_approval BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create UI state table
CREATE TABLE IF NOT EXISTS public.ui_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  active_tile TEXT,
  expanded_tiles JSONB DEFAULT '[]'::jsonb,
  voice_mode_active BOOLEAN DEFAULT false,
  preferences JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.manager_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_state ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (single user CRM, no auth for MVP)
CREATE POLICY "Allow all operations on manager_profile" ON public.manager_profile FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on email_campaigns" ON public.email_campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on email_tracking" ON public.email_tracking FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on agent_actions" ON public.agent_actions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on ui_state" ON public.ui_state FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_manager_profile_updated_at BEFORE UPDATE ON public.manager_profile FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_campaigns_updated_at BEFORE UPDATE ON public.email_campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON public.meetings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ui_state_updated_at BEFORE UPDATE ON public.ui_state FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.email_campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meetings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_actions;

-- Insert sample manager profile
INSERT INTO public.manager_profile (email, name) VALUES ('manager@crm-x.com', 'CRM Manager') ON CONFLICT DO NOTHING;

-- Insert sample leads for demo
INSERT INTO public.leads (name, email, company, industry, source, status, lead_score) VALUES
  ('John Smith', 'john@techcorp.com', 'TechCorp Inc', 'Technology', 'scraping', 'new', 85),
  ('Sarah Johnson', 'sarah@startupco.com', 'StartupCo', 'SaaS', 'scraping', 'new', 92),
  ('Mike Chen', 'mike@enterprise.com', 'Enterprise Solutions', 'Enterprise', 'scraping', 'contacted', 78)
ON CONFLICT DO NOTHING;

-- Migration: 20251108210055
-- Fix search_path for the update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public;

-- Migration: 20251108225230
-- Create email_replies table to track incoming email responses
CREATE TABLE public.email_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  reply_content TEXT NOT NULL,
  sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= 0 AND sentiment_score <= 1),
  requires_manager_review BOOLEAN DEFAULT true,
  draft_response TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'sent', 'rejected')),
  replied_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_email_replies_lead_id ON public.email_replies(lead_id);
CREATE INDEX idx_email_replies_status ON public.email_replies(status);

-- Create agent_runs table to track background agent activity
CREATE TABLE public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type TEXT NOT NULL CHECK (agent_type IN ('lead_scoring', 'email_monitoring', 'meeting_prep', 'follow_up', 'deal_pipeline')),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  actions_taken JSONB DEFAULT '[]'::jsonb,
  errors JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_agent_runs_agent_type ON public.agent_runs(agent_type);
CREATE INDEX idx_agent_runs_started_at ON public.agent_runs(started_at DESC);

-- Add columns to meetings table for AI agent functionality
ALTER TABLE public.meetings 
ADD COLUMN IF NOT EXISTS ai_agent_confidence_score DECIMAL(3,2) CHECK (ai_agent_confidence_score >= 0 AND ai_agent_confidence_score <= 1),
ADD COLUMN IF NOT EXISTS manager_alert_triggered BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS manager_alert_reason TEXT,
ADD COLUMN IF NOT EXISTS real_time_transcript JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
ADD COLUMN IF NOT EXISTS agent_notes TEXT;

-- Add columns to email_campaigns table
ALTER TABLE public.email_campaigns
ADD COLUMN IF NOT EXISTS is_automated_followup BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS followup_sequence_number INTEGER DEFAULT 0;

-- Add last_contacted_at to leads table for follow-up tracking
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unresponsive_days INTEGER DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_replies (public access for now as this is a demo)
CREATE POLICY "Enable read access for all users" ON public.email_replies
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.email_replies
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON public.email_replies
  FOR UPDATE USING (true);

-- RLS policies for agent_runs
CREATE POLICY "Enable read access for all users" ON public.agent_runs
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON public.agent_runs
  FOR INSERT WITH CHECK (true);

-- Create trigger for updated_at on email_replies
CREATE TRIGGER update_email_replies_updated_at
  BEFORE UPDATE ON public.email_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migration: 20251109034853
-- Add new columns to leads table for intent and deal value
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS intent TEXT,
ADD COLUMN IF NOT EXISTS deal_value NUMERIC DEFAULT 0;

-- Create deals table
CREATE TABLE IF NOT EXISTS public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage TEXT NOT NULL DEFAULT 'qualified',
  value NUMERIC DEFAULT 0,
  close_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on deals
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Create policy for deals (public access for demo)
CREATE POLICY "Allow all operations on deals" 
ON public.deals 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create company_profile table
CREATE TABLE IF NOT EXISTS public.company_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  industry TEXT,
  target_industries JSONB DEFAULT '[]'::jsonb,
  target_roles JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on company_profile
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;

-- Create policy for company_profile
CREATE POLICY "Allow all operations on company_profile" 
ON public.company_profile 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Create trigger for deals updated_at
CREATE TRIGGER update_deals_updated_at
BEFORE UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for company_profile updated_at
CREATE TRIGGER update_company_profile_updated_at
BEFORE UPDATE ON public.company_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for leads and deals
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;

-- Migration: 20251109040354
-- Add new fields to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS probability numeric DEFAULT 0.5 CHECK (probability >= 0 AND probability <= 1);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS associated_contact_id uuid REFERENCES leads(id);
ALTER TABLE deals ADD COLUMN IF NOT EXISTS last_activity_at timestamp with time zone DEFAULT now();
ALTER TABLE deals ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Update stage column to use proper enum values
ALTER TABLE deals ALTER COLUMN stage DROP DEFAULT;
ALTER TABLE deals ALTER COLUMN stage TYPE text;
ALTER TABLE deals ALTER COLUMN stage SET DEFAULT 'prospect';

-- Update existing stages to new format (if any exist)
UPDATE deals SET stage = LOWER(stage);

-- Enable full replica identity for realtime
ALTER TABLE deals REPLICA IDENTITY FULL;
