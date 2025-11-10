# CRM System Architecture - Flow Diagram Implementation

## System Overview

This document describes how the CRM system is implemented according to the flow diagram provided. The system features a Master Orchestrator (Gemini 1.5 Pro) that manages multiple specialized agents with full database access.

## Architecture Components

### 1. Input Sources

#### Voice Command ("Hey CRM")
- **Component**: `src/components/AIAssistant.tsx`
- **Implementation**: Wake word detection using `WakeWordDetection.ts`
- **Flow**: Activates → Speech recognition → Sends to Master Orchestrator

#### Live Email Incoming
- **Table**: `email_replies`
- **Flow**: Email received → Stored in DB → Reviewed by assistant
- **Actions**: Draft responses, sentiment analysis

#### Active Meeting Audio
- **Component**: Live meeting integration
- **Agent**: `meeting-voice-agent`
- **Flow**: Audio → Transcript → Real-time analysis → Manager alerts if needed

#### Admin Simulate Button
- **Location**: Dashboard tiles
- **Purpose**: Manual trigger for agent actions

### 2. Master Orchestrator (Gemini 1.5 Pro)

**Edge Function**: `supabase/functions/voice-assistant/index.ts`

#### Responsibilities:
1. Process user queries
2. Route to specialized agents
3. Manage database operations (Full CRUD)
4. Return UI actions and responses
5. Log all activities in `agent_runs`

#### Database Access (Full CRUD):
```typescript
// The Master Orchestrator has complete database access:

// CREATE
await supabase.from("leads").insert({ name, email, company, ... })
await supabase.from("meetings").insert({ title, lead_id, ... })
await supabase.from("email_campaigns").insert({ subject, body, ... })

// READ
await supabase.from("leads").select("*")
await supabase.from("email_campaigns").select("*, leads(name)")
await supabase.from("meetings").select("*, leads(*)")

// UPDATE  
await supabase.from("leads").update({ status, phone, ... }).eq("id", leadId)
await supabase.from("email_campaigns").update({ subject, body }).eq("id", id)
await supabase.from("meetings").update({ status, outcome }).eq("id", id)

// DELETE (when needed)
await supabase.from("leads").delete().eq("id", leadId)
```

### 3. Specialized Agents

#### Meeting Agent (Outreach, FnCall)
**Edge Function**: `supabase/functions/meeting-voice-agent/index.ts`

**Actions**:
- `prepare`: Generate talking points before meeting
- `join`: Initialize AI agent in meeting
- `analyze_transcript`: Real-time sentiment analysis
- `complete`: Generate meeting summary

**Critical Flow - Sentiment Monitoring**:
```
Meeting in progress
  ↓
Real-time transcript analysis
  ↓
Sentiment calculation (0-10 scale)
  ↓
IF sentiment < 6 (confidence < 0.6)
  ↓
🚨 RED ALERT → Manager Summon
  ↓
Create agent_action with alert_type: 'RED_ALERT'
  ↓
Manager notified immediately
```

**Database Operations**:
- READ: meetings, leads, email_campaigns (context)
- UPDATE: meetings (status, sentiment, alerts)
- CREATE: agent_actions (manager alerts)

#### Footprint Agent (Edit Meeting)
**Integrated in**: `voice-assistant/index.ts`

**Actions**:
- Update lead information
- Fill forms via voice commands
- Navigate to lead details
- Schedule/reschedule meetings

**Database Operations**:
- UPDATE: leads (all fields: email, phone, company, status, notes)
- UPDATE: meetings (scheduled_at, title, status)

#### Outreach Agent (Drafting)
**Edge Function**: `supabase/functions/draft-email/index.ts`

**Actions**:
- Draft emails using AI
- Edit subject lines and bodies
- Approve and send emails
- Track email campaigns

**Database Operations**:
- CREATE: email_campaigns (drafts)
- UPDATE: email_campaigns (edit subject/body)
- UPDATE: email_campaigns (mark as sent)
- CREATE: agent_actions (track sent emails)

#### Scheduling Agent (Calendar, AI)
**Integrated in**: `voice-assistant/index.ts`

**Actions**:
- Schedule meetings with leads
- Set follow-up reminders
- Create tasks
- Sync with Google Calendar

**Database Operations**:
- CREATE: meetings (new meetings, follow-ups, tasks)
- UPDATE: leads (next_followup_at)
- UPDATE: meetings (status, completion)

### 4. Database Tables (Real-time DB)

All tables are accessible to the Master Orchestrator:

#### Core Tables:
- **leads**: Contact information, scoring, status tracking
- **email_campaigns**: Draft, send, and track emails
- **meetings**: Schedule, conduct, analyze meetings
- **email_replies**: Incoming emails requiring review
- **agent_runs**: Log all agent activities
- **agent_actions**: Track pending and completed actions

#### Real-time Sync:
- All database changes are immediately reflected in the UI
- Uses Supabase real-time subscriptions where needed
- Agent runs are logged for full transparency

### 5. UI Integration (Lovable.dev Dashboard)

**Component**: `src/pages/Index.tsx`

**Features**:
- Real-time dashboard updates
- Tile-based UI with voice-triggered highlighting
- Form auto-fill via voice commands
- Email preview and approval dialogs
- Meeting scheduler integration

**UI Actions Supported**:
```typescript
// Navigation
- open_settings
- open_lead_generation
- open_emails
- open_meeting_scheduler
- navigate_to_lead

// Forms
- fill_form (lead_edit, meeting_scheduler)
- submit_form

// Email Actions
- preview_email
- approve_preview
- reject_preview
- close_preview

// Highlighting
- highlight_tile
```

## Complete Flow Examples

### Example 1: Voice Command to Draft Email
```
User: "Hey CRM, draft an email to John Smith about our new product"
  ↓
Wake word detected → Speech recognition
  ↓
Master Orchestrator (voice-assistant)
  ↓
Extract lead name → Query leads table
  ↓
Invoke draft-email agent with context
  ↓
Create email_campaigns record (draft_status: 'draft')
  ↓
Log agent_runs activity
  ↓
Return response: "Email draft created for John Smith"
  ↓
UI updates → Email appears in "Emails for Review"
```

### Example 2: Meeting Sentiment Alert
```
Meeting in progress with AI agent
  ↓
Real-time transcript streaming
  ↓
Periodic analysis every 30 seconds
  ↓
meeting-voice-agent: analyze_transcript
  ↓
Gemini AI: Calculate sentiment and confidence
  ↓
Confidence = 0.45 (< 0.6 threshold) 🚨
  ↓
Trigger RED ALERT
  ↓
UPDATE meetings: manager_alert_triggered = true
  ↓
CREATE agent_actions: alert_type = 'RED_ALERT'
  ↓
Manager dashboard shows notification
  ↓
Manager can join meeting immediately
```

### Example 3: Add New Lead via Voice
```
User: "Hey CRM, add new lead named Sarah Johnson, email sarah@techcorp.com, works at Tech Corp"
  ↓
Master Orchestrator parses command
  ↓
Extracts: name, email, company
  ↓
Validates all required fields present
  ↓
INSERT into leads table
  ↓
Log in agent_actions
  ↓
Verify lead exists in database
  ↓
Return: "Lead created: Sarah Johnson from Tech Corp"
  ↓
UI: Highlight Contacts tile → Show new lead
```

## Key Features

### 1. Full Database Access
The personal assistant has complete CRUD access to all tables:
- ✓ Create new records (leads, meetings, emails, tasks)
- ✓ Read all data for context and analysis
- ✓ Update existing records (status, fields, content)
- ✓ Delete when necessary (with confirmation)

### 2. Real-time Synchronization
- All changes sync immediately to UI
- Agent runs logged for transparency
- Manager alerts trigger instantly
- Dashboard updates in real-time

### 3. Multi-Agent Orchestration
- Master Orchestrator routes to specialized agents
- Each agent focuses on specific domain
- Agents can invoke other agents as needed
- All activity logged in agent_runs

### 4. Intelligent Monitoring
- Sentiment analysis during meetings
- Automatic manager alerts when needed
- Lead scoring and pipeline management
- Email engagement tracking

## Security & Permissions

### Service Role Access
- Edge functions use `SUPABASE_SERVICE_ROLE_KEY`
- Full database access with bypassed RLS
- Intended for trusted backend operations only

### Frontend Access
- Uses `SUPABASE_PUBLISHABLE_KEY`
- Read-only or limited write access
- RLS policies enforce security

## Configuration

### Required Environment Variables
```bash
# Edge Functions
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
RESEND_API_KEY=your_resend_api_key

# Frontend
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

### Edge Functions Configuration
Located in `supabase/config.toml`:
```toml
[functions.voice-assistant]
verify_jwt = false  # Public access for voice commands

[functions.meeting-voice-agent]
verify_jwt = false  # Accessible for meeting integration

[functions.draft-email]
verify_jwt = false  # Accessible for email drafting
```

## Development & Debugging

### Viewing Agent Activity
```sql
-- Recent agent runs
SELECT * FROM agent_runs 
ORDER BY started_at DESC 
LIMIT 10;

-- Pending actions
SELECT * FROM agent_actions 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- Manager alerts
SELECT * FROM agent_actions 
WHERE action_type = 'manager_alert'
ORDER BY created_at DESC;
```

### Console Logging
Edge functions include comprehensive logging:
- Request received with parameters
- Database operations performed
- Agent invocations
- Responses returned
- Errors with stack traces

View logs in Lovable Cloud → Functions → Select function → Logs

## Future Enhancements

1. **Enhanced Sentiment Analysis**: More granular emotion detection
2. **Automated Follow-ups**: AI-driven follow-up scheduling
3. **Deal Predictions**: ML models for deal closure probability
4. **Voice Synthesis**: AI speaking responses in meetings
5. **Multi-language Support**: International lead management

---

**Last Updated**: Based on flow diagram implementation
**Maintained By**: Development Team
