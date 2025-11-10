import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkedInProfile {
  name: string;
  linkedin_url: string;
  company?: string;
  title?: string;
  email?: string;
  phone?: string;
  location?: string;
  industry?: string;
  summary?: string;
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

    const profiles: LinkedInProfile[] = await req.json();
    console.log('Received LinkedIn profiles:', profiles.length);

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const profile of profiles) {
      try {
        // Check if lead already exists by LinkedIn URL
        const { data: existingLead } = await supabase
          .from('leads')
          .select('id, notes, company, email, phone, industry')
          .eq('linkedin_url', profile.linkedin_url)
          .single();

        if (existingLead) {
          console.log('Updating existing LinkedIn lead:', existingLead.id);
          
          // Update existing lead with new information
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              name: profile.name,
              company: profile.company || existingLead.company,
              email: profile.email || existingLead.email,
              phone: profile.phone || existingLead.phone,
              industry: profile.industry || existingLead.industry,
              notes: profile.summary 
                ? `${existingLead.notes || ''}\n\n[LinkedIn Update ${new Date().toISOString()}]\n${profile.summary}`
                : existingLead.notes,
              last_contacted_at: new Date().toISOString()
            })
            .eq('id', existingLead.id);

          if (updateError) {
            throw updateError;
          }

          results.updated++;
        } else {
          // Create new lead from LinkedIn profile
          const { error: insertError } = await supabase
            .from('leads')
            .insert({
              name: profile.name,
              linkedin_url: profile.linkedin_url,
              company: profile.company,
              email: profile.email,
              phone: profile.phone,
              industry: profile.industry,
              source: 'linkedin',
              status: 'new',
              notes: profile.summary 
                ? `LinkedIn Profile Import\nTitle: ${profile.title || 'N/A'}\nLocation: ${profile.location || 'N/A'}\n\n${profile.summary}`
                : `LinkedIn Profile Import\nTitle: ${profile.title || 'N/A'}\nLocation: ${profile.location || 'N/A'}`,
              last_contacted_at: new Date().toISOString(),
              lead_score: 40 // Higher initial score for LinkedIn leads (qualified)
            });

          if (insertError) {
            throw insertError;
          }

          results.created++;
          console.log('Created new LinkedIn lead for:', profile.name);
        }
      } catch (error) {
        console.error(`Error processing LinkedIn profile ${profile.name}:`, error);
        results.failed++;
        results.errors.push(`${profile.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log('LinkedIn import results:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing LinkedIn leads:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
