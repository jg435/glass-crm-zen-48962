-- Add 'verifier' to agent_type check constraints

-- Drop existing check constraints
ALTER TABLE agent_actions DROP CONSTRAINT IF EXISTS agent_actions_agent_type_check;
ALTER TABLE agent_runs DROP CONSTRAINT IF EXISTS agent_runs_agent_type_check;

-- Recreate constraints with 'verifier' included
ALTER TABLE agent_actions ADD CONSTRAINT agent_actions_agent_type_check 
  CHECK (agent_type IN (
    'lead_generation', 
    'email_drafter', 
    'follow_up', 
    'deal_creator', 
    'pipeline_analyzer', 
    'voice_assistant',
    'verifier'
  ));

ALTER TABLE agent_runs ADD CONSTRAINT agent_runs_agent_type_check 
  CHECK (agent_type IN (
    'lead_generation', 
    'email_drafter', 
    'follow_up', 
    'deal_creator', 
    'pipeline_analyzer', 
    'voice_assistant',
    'verifier'
  ));