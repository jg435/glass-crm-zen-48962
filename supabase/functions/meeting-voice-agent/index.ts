import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { meetingId, action, transcript, duration, outcome } = body;
    
    console.log('Meeting voice agent called with action:', action, 'meetingId:', meetingId);
    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      throw new Error('GEMINI_API_KEY not configured');
    }

    console.log('Meeting voice agent processing action:', action);

    // Fetch meeting details
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*, leads(name, email, company, notes, status, lead_score)')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      throw new Error('Meeting not found');
    }

    const lead = meeting.leads;

    switch (action) {
      case 'prepare': {
        // Prepare context for AI agent before meeting starts
        const { data: previousCampaigns } = await supabase
          .from('email_campaigns')
          .select('*')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(3);

        const context = {
          leadName: lead.name,
          company: lead.company,
          leadScore: lead.lead_score,
          status: lead.status,
          notes: lead.notes,
          previousInteractions: previousCampaigns?.map(c => ({
            subject: c.subject,
            sentAt: c.sent_at,
            status: c.draft_status
          })) || [],
          meetingTitle: meeting.title,
          scheduledAt: meeting.scheduled_at
        };

        // Generate talking points using Gemini
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `You are preparing for a sales meeting. Generate 5 key talking points and 3 potential objections with responses.

Lead Context:
- Name: ${context.leadName}
- Company: ${context.company}
- Lead Score: ${context.leadScore}
- Status: ${context.status}
- Notes: ${context.notes}

Previous Interactions: ${JSON.stringify(context.previousInteractions)}

Format:
TALKING POINTS:
1. [Point]
2. [Point]
...

POTENTIAL OBJECTIONS:
1. [Objection] → [Response]
...`
                }]
              }]
            })
          }
        );

        const data = await response.json();
        const agentNotes = data.candidates[0]?.content?.parts[0]?.text || '';

        await supabase
          .from('meetings')
          .update({ 
            agent_notes: agentNotes,
            status: 'prepared'
          })
          .eq('id', meetingId);

        return new Response(
          JSON.stringify({ success: true, notes: agentNotes, context }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'join': {
        // Mark agent as joined
        await supabase
          .from('meetings')
          .update({ 
            agent_joined_at: new Date().toISOString(),
            status: 'in_progress'
          })
          .eq('id', meetingId);

        // Initialize Gemini Live session configuration
        const liveConfig = {
          model: "gemini-2.0-flash-exp",
          systemInstruction: `You are an AI sales agent in a meeting with ${lead.name} from ${lead.company}.

Your goal: Close the deal by addressing concerns, highlighting value, and moving toward commitment.

Context:
- Lead Score: ${lead.lead_score}
- Status: ${lead.status}
- Notes: ${lead.notes || 'No prior notes'}
- Meeting Notes: ${meeting.agent_notes || 'No preparation notes'}

Guidelines:
1. Be professional, friendly, and solution-focused
2. Listen actively and address objections directly
3. Continuously assess sentiment (0-1 scale)
4. If confidence drops below 0.5, prepare to alert manager
5. Try to identify next steps or commitment

Response format after each exchange:
[CONFIDENCE: 0.X] [SENTIMENT: positive/neutral/negative]
Then your verbal response.`,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 500
            }
          };
          
          console.log(`Meeting agent joining meeting ${meetingId} with ${lead.name}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Agent joined meeting',
            liveConfig,
            meetingContext: {
              leadName: lead.name,
              company: lead.company,
              agentNotes: meeting.agent_notes
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'analyze_transcript': {
        // Analyze ongoing conversation and update confidence
        if (!transcript) {
          throw new Error('Transcript is required for analyze_transcript action');
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Analyze this sales meeting transcript and provide a JSON response.

Transcript:
${JSON.stringify(transcript)}

Respond ONLY with valid JSON in this exact format (no other text):
{
  "confidence": 0.75,
  "sentiment": "positive",
  "concerns": ["budget", "timing"],
  "nextActions": ["send proposal", "schedule followup"],
  "alertManager": { "needed": false, "reason": "conversation going well" }
}

Your response:`
                }]
              }]
            })
          }
        );

        const data = await response.json();
        const analysisText = data.candidates[0]?.content?.parts[0]?.text || '{}';
        
        // Try to extract JSON from the response
        let analysis;
        try {
          // Remove markdown code blocks if present
          const cleanedText = analysisText.replace(/```json\n?|\n?```/g, '').trim();
          
          // Try to find JSON object in the text
          const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[0]);
          } else {
            // Fallback to default analysis
            analysis = {
              confidence: 0.5,
              sentiment: "neutral",
              concerns: ["Unable to parse AI analysis"],
              nextActions: ["Review transcript manually"],
              alertManager: { needed: false, reason: "Parsing error" }
            };
          }
        } catch (parseError) {
          console.error('Error parsing analysis:', parseError);
          // Fallback analysis
          analysis = {
            confidence: 0.5,
            sentiment: "neutral",
            concerns: ["AI response parsing failed"],
            nextActions: ["Review manually"],
            alertManager: { needed: false, reason: "Technical error" }
          };
        }

        // Update meeting with analysis
        await supabase
          .from('meetings')
          .update({ 
            real_time_transcript: transcript,
            ai_agent_confidence_score: analysis.confidence,
            sentiment_analysis: analysis,
            meeting_duration: duration
          })
          .eq('id', meetingId);

        // Alert manager if confidence/sentiment is low (< 0.6 = < 6 on 0-10 scale = CRISIS)
        // This aligns with flow diagram: "Sentiment < 6 (Crisis) → RED ALERT (Manager Summon)"
        if (analysis.alertManager.needed || analysis.confidence < 0.6) {
          await supabase
            .from('meetings')
            .update({ 
              manager_alert_triggered: true,
              manager_alert_reason: analysis.alertManager.reason || '🚨 RED ALERT: Low confidence in deal closure - Manager intervention needed'
            })
            .eq('id', meetingId);

          // Create HIGH PRIORITY agent action for manager summon
          await supabase.from('agent_actions').insert({
            agent_type: 'meeting_voice_agent',
            action_type: 'manager_alert',
            status: 'pending',
            requires_approval: false,
            data: {
              meeting_id: meetingId,
              lead_name: lead.name,
              company: lead.company,
              confidence: analysis.confidence,
              sentiment: analysis.sentiment,
              concerns: analysis.concerns,
              reason: analysis.alertManager.reason || 'Sentiment below threshold',
              alert_type: 'RED_ALERT',
              summary: `🚨 RED ALERT: Meeting with ${lead.name} (${lead.company}) requires immediate attention. Sentiment: ${(analysis.confidence * 10).toFixed(1)}/10. ${analysis.alertManager.reason || 'Deal at risk.'}`
            }
          });
          
          console.log(`🚨 RED ALERT triggered for meeting ${meetingId} - Manager summon initiated`);
        }

        return new Response(
          JSON.stringify({ success: true, analysis }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete': {
        // Meeting ended - generate summary
        if (!transcript) {
          throw new Error('Transcript is required for complete action');
        }

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Summarize this sales meeting in 3-4 sentences. Include:
- What was discussed
- Any commitments made
- Next steps
- Overall outcome

Transcript:
${transcript}`
                }]
              }]
            })
          }
        );

        const data = await response.json();
        const summary = data.candidates[0]?.content?.parts[0]?.text || '';

        await supabase
          .from('meetings')
          .update({ 
            status: 'completed',
            conversation_summary: summary,
            outcome: outcome,
            transcript: transcript
          })
          .eq('id', meetingId);

        return new Response(
          JSON.stringify({ success: true, summary }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Meeting voice agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error details:', errorMessage);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
