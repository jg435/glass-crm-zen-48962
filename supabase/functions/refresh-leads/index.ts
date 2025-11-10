import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting lead refresh...');

    // Update lead scores based on activity
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    let updatedCount = 0;

    for (const lead of leads || []) {
      let newScore = lead.lead_score || 0;
      
      // Increase score if recently contacted
      if (lead.last_contacted_at) {
        const daysSinceContact = Math.floor(
          (Date.now() - new Date(lead.last_contacted_at).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceContact < 7) {
          newScore = Math.min(100, newScore + 5);
        }
      }

      // Decrease score if unresponsive
      if (lead.unresponsive_days > 14) {
        newScore = Math.max(0, newScore - 10);
      }

      // Update if score changed
      if (newScore !== lead.lead_score) {
        const { error: updateError } = await supabase
          .from('leads')
          .update({ lead_score: newScore })
          .eq('id', lead.id);

        if (!updateError) {
          updatedCount++;
        }
      }
    }

    // Store the last refresh timestamp
    const { error: upsertError } = await supabase
      .from('ui_state')
      .upsert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user
        preferences: { last_lead_refresh: new Date().toISOString() }
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error('Error storing refresh timestamp:', upsertError);
    }

    console.log(`Lead refresh complete. Updated ${updatedCount} leads.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        updatedCount,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in refresh-leads function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});