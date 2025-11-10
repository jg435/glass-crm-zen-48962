import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailWebhook {
  from: string;
  subject?: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: EmailWebhook = await req.json();
    console.log('Received email webhook:', payload);

    // Extract email and name from "from" field (format: "Name <email@domain.com>")
    const fromMatch = payload.from.match(/(.+?)\s*<(.+?)>/);
    const senderName = fromMatch ? fromMatch[1].trim() : payload.from;
    const senderEmail = fromMatch ? fromMatch[2].trim() : payload.from;

    // Extract potential company from email domain
    const emailDomain = senderEmail.split('@')[1];
    const potentialCompany = emailDomain?.split('.')[0] || '';

    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('email', senderEmail)
      .single();

    if (existingLead) {
      console.log('Lead already exists:', existingLead.id);
      
      // Update notes with new email content
      const emailNote = `\n\n[Email received ${new Date().toISOString()}]\nSubject: ${payload.subject || 'No subject'}\n${payload.text || payload.html || 'No content'}`;
      
      await supabase
        .from('leads')
        .update({ 
          notes: supabase.rpc('concat_notes', { 
            lead_id: existingLead.id, 
            new_note: emailNote 
          }),
          last_contacted_at: new Date().toISOString()
        })
        .eq('id', existingLead.id);

      return new Response(
        JSON.stringify({ success: true, leadId: existingLead.id, updated: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new lead from email
    const { data: newLead, error: insertError } = await supabase
      .from('leads')
      .insert({
        name: senderName,
        email: senderEmail,
        company: potentialCompany,
        source: 'email',
        status: 'new',
        notes: `Initial contact via email\nSubject: ${payload.subject || 'No subject'}\n\n${payload.text || payload.html || 'No content'}`,
        last_contacted_at: new Date().toISOString(),
        lead_score: 30 // Initial score for email leads
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    console.log('Created new lead:', newLead.id);

    return new Response(
      JSON.stringify({ success: true, leadId: newLead.id, created: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing email lead:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
