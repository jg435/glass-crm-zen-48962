import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WHATSAPP_ACCESS_TOKEN = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
const WHATSAPP_VERIFY_TOKEN = Deno.env.get('WHATSAPP_VERIFY_TOKEN');

interface WhatsAppMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: { body: string };
  type: string;
}

interface WhatsAppWebhook {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle webhook verification from WhatsApp
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
      console.log('WhatsApp webhook verified');
      return new Response(challenge, { status: 200 });
    }

    return new Response('Forbidden', { status: 403 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: WhatsAppWebhook = await req.json();
    console.log('Received WhatsApp webhook:', JSON.stringify(payload, null, 2));

    // Process incoming messages
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const { messages, contacts } = change.value;

        if (!messages || !contacts) continue;

        for (const message of messages) {
          const contact = contacts[0];
          const phoneNumber = message.from;
          const contactName = contact.profile.name;
          const messageText = message.text?.body || '';

          console.log(`Processing WhatsApp message from ${contactName} (${phoneNumber})`);

          // Check if lead already exists
          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .eq('phone', phoneNumber)
            .single();

          if (existingLead) {
            console.log('Lead already exists:', existingLead.id);
            
            // Update notes with new WhatsApp message
            const messageNote = `\n\n[WhatsApp message ${new Date().toISOString()}]\n${messageText}`;
            
            await supabase
              .from('leads')
              .update({ 
                last_contacted_at: new Date().toISOString(),
                notes: supabase.rpc('concat_notes', { 
                  lead_id: existingLead.id, 
                  new_note: messageNote 
                })
              })
              .eq('id', existingLead.id);

            continue;
          }

          // Create new lead from WhatsApp message
          const { data: newLead, error: insertError } = await supabase
            .from('leads')
            .insert({
              name: contactName,
              phone: phoneNumber,
              source: 'whatsapp',
              status: 'new',
              notes: `Initial contact via WhatsApp\n\n${messageText}`,
              last_contacted_at: new Date().toISOString(),
              lead_score: 35 // Initial score for WhatsApp leads (higher engagement)
            })
            .select()
            .single();

          if (insertError) {
            console.error('Error creating lead:', insertError);
            continue;
          }

          console.log('Created new lead from WhatsApp:', newLead.id);

          // Send automated response (optional)
          if (WHATSAPP_ACCESS_TOKEN) {
            await sendWhatsAppMessage(
              phoneNumber,
              `Hi ${contactName}! Thanks for reaching out. We've received your message and our team will get back to you soon.`
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing WhatsApp lead:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function sendWhatsAppMessage(to: string, message: string) {
  const PHONE_NUMBER_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('WhatsApp API error:', error);
    } else {
      console.log('WhatsApp message sent successfully');
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
  }
}
