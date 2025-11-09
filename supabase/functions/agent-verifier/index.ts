import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { actionsTaken, actionResults } = await req.json();
    
    console.log("🔍 VERIFIER: Starting verification of actions:", actionsTaken);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const verificationReport: any[] = [];
    const fixedActions: any[] = [];

    // Build actions list from actionsTaken; if empty, parse actionResults claims
    const actionsToVerify: any[] = Array.isArray(actionsTaken) ? [...actionsTaken] : [];

    if (actionsToVerify.length === 0 && Array.isArray(actionResults) && actionResults.length > 0) {
      for (const res of actionResults) {
        if (typeof res !== 'string') continue;
        // Patterns like:
        // "✓ Lead created: John Doe from ACME (555-0000)"
        // "Added new lead John Doe (ACME)"
        let match = res.match(/Lead created:\s*([A-Za-z\s]+)\s+from\s+([A-Za-z\s&]+)/i);
        if (!match) match = res.match(/Added new lead\s+"?([A-Za-z\s]+)"?\s*(?:\(|from\s+)([A-Za-z\s&]+)/i);
        if (match) {
          const name = match[1].trim();
          const company = match[2].replace(/[()]/g, '').trim();
          actionsToVerify.push({ action: 'add_lead', name, company, email: null, phone: null });
          console.log("🧠 VERIFIER: Parsed claim from actionResults => add_lead:", { name, company });
        }
      }
    }

    // Verify each action claim
    for (const action of actionsToVerify || []) {
      console.log("🔍 Verifying action:", action.action);

      switch (action.action) {
        case "add_lead": {
          // Verify lead was actually created in database
          const { data: lead, error } = await supabase
            .from("leads")
            .select("*")
            .eq("id", action.lead_id)
            .single();

          if (error || !lead) {
            console.error("❌ VERIFICATION FAILED: Lead not found in database", action.lead_id);
            
            // Attempt to create the lead
            console.log("🔧 VERIFIER: Attempting to create lead:", action);
            const { data: newLead, error: createError } = await supabase
              .from("leads")
              .insert({
                name: action.name,
                email: action.email,
                company: action.company,
                phone: action.phone || null,
                status: "new",
                source: "manual",
                lead_score: 50,
              })
              .select()
              .single();

            if (createError) {
              console.error("❌ VERIFIER: Failed to create lead:", createError);
              verificationReport.push({
                action: "add_lead",
                status: "failed",
                issue: `Lead ${action.name} was not created. Error: ${createError.message}`,
                attempted_fix: true,
                fix_success: false,
              });
            } else {
              console.log("✅ VERIFIER: Successfully created lead:", newLead.id);
              fixedActions.push({
                action: "add_lead",
                lead_id: newLead.id,
                details: action,
              });
              verificationReport.push({
                action: "add_lead",
                status: "fixed",
                issue: `Lead ${action.name} was claimed created but missing. VERIFIER created it.`,
                lead_id: newLead.id,
              });
            }
          } else {
            console.log("✅ VERIFIED: Lead exists in database:", lead.id);
            verificationReport.push({
              action: "add_lead",
              status: "verified",
              lead_id: lead.id,
              details: `Lead ${lead.name} confirmed in database`,
            });
          }
          break;
        }

        case "draft_email": {
          // Verify email draft was created
          const { data: campaign, error } = await supabase
            .from("email_campaigns")
            .select("*")
            .eq("id", action.campaign_id)
            .single();

          if (error || !campaign) {
            console.error("❌ VERIFICATION FAILED: Email draft not found", action.campaign_id);
            
            // Attempt to create the draft
            console.log("🔧 VERIFIER: Attempting to create email draft for lead:", action.lead_id);
            const { data: draftResult, error: draftError } = await supabase.functions.invoke("draft-email", {
              body: { leadId: action.lead_id },
            });

            if (draftError || draftResult?.error) {
              console.error("❌ VERIFIER: Failed to create draft:", draftError || draftResult?.error);
              verificationReport.push({
                action: "draft_email",
                status: "failed",
                issue: `Email draft was not created. Error: ${draftError?.message || draftResult?.error}`,
                attempted_fix: true,
                fix_success: false,
              });
            } else {
              console.log("✅ VERIFIER: Successfully created email draft:", draftResult.campaign?.id);
              fixedActions.push({
                action: "draft_email",
                campaign_id: draftResult.campaign?.id,
                lead_id: action.lead_id,
              });
              verificationReport.push({
                action: "draft_email",
                status: "fixed",
                issue: "Email draft was claimed created but missing. VERIFIER created it.",
                campaign_id: draftResult.campaign?.id,
              });
            }
          } else {
            console.log("✅ VERIFIED: Email draft exists:", campaign.id);
            verificationReport.push({
              action: "draft_email",
              status: "verified",
              campaign_id: campaign.id,
              details: `Draft for ${campaign.subject} confirmed`,
            });
          }
          break;
        }

        case "send_email": {
          // Verify email was sent
          const { data: campaign, error } = await supabase
            .from("email_campaigns")
            .select("*")
            .eq("id", action.campaign_id)
            .single();

          if (error || !campaign || !campaign.sent_at) {
            console.error("❌ VERIFICATION FAILED: Email not sent", action.campaign_id);
            verificationReport.push({
              action: "send_email",
              status: "failed",
              issue: `Email was claimed sent but status shows: ${campaign?.draft_status || "not found"}`,
              attempted_fix: false,
              fix_success: false,
            });
          } else {
            console.log("✅ VERIFIED: Email was sent:", campaign.id);
            verificationReport.push({
              action: "send_email",
              status: "verified",
              campaign_id: campaign.id,
              sent_at: campaign.sent_at,
            });
          }
          break;
        }

        case "add_task": {
          // Verify task was created
          const { data: task, error } = await supabase
            .from("meetings")
            .select("*")
            .eq("id", action.task_id)
            .single();

          if (error || !task) {
            console.error("❌ VERIFICATION FAILED: Task not found", action.task_id);
            
            // Attempt to create the task
            console.log("🔧 VERIFIER: Attempting to create task:", action.title);
            const today = new Date();
            today.setHours(today.getHours() + 1);
            
            const { data: newTask, error: createError } = await supabase
              .from("meetings")
              .insert({
                title: action.title,
                scheduled_at: today.toISOString(),
                status: "scheduled",
                lead_id: "00000000-0000-0000-0000-000000000000",
              })
              .select()
              .single();

            if (createError) {
              console.error("❌ VERIFIER: Failed to create task:", createError);
              verificationReport.push({
                action: "add_task",
                status: "failed",
                issue: `Task "${action.title}" was not created. Error: ${createError.message}`,
                attempted_fix: true,
                fix_success: false,
              });
            } else {
              console.log("✅ VERIFIER: Successfully created task:", newTask.id);
              fixedActions.push({
                action: "add_task",
                task_id: newTask.id,
                title: action.title,
              });
              verificationReport.push({
                action: "add_task",
                status: "fixed",
                issue: `Task "${action.title}" was claimed created but missing. VERIFIER created it.`,
                task_id: newTask.id,
              });
            }
          } else {
            console.log("✅ VERIFIED: Task exists:", task.id);
            verificationReport.push({
              action: "add_task",
              status: "verified",
              task_id: task.id,
              title: task.title,
            });
          }
          break;
        }

        case "schedule_followup": {
          // Verify follow-up was scheduled
          const { data: lead, error } = await supabase
            .from("leads")
            .select("next_followup_at")
            .eq("name", action.lead_name)
            .single();

          if (error || !lead || !lead.next_followup_at) {
            console.error("❌ VERIFICATION FAILED: Follow-up not scheduled for", action.lead_name);
            verificationReport.push({
              action: "schedule_followup",
              status: "failed",
              issue: `Follow-up for ${action.lead_name} was not scheduled`,
              attempted_fix: false,
            });
          } else {
            console.log("✅ VERIFIED: Follow-up scheduled:", lead.next_followup_at);
            verificationReport.push({
              action: "schedule_followup",
              status: "verified",
              lead_name: action.lead_name,
              scheduled_at: lead.next_followup_at,
            });
          }
          break;
        }

        case "update_lead": {
          // Verify lead was updated
          const { data: lead, error } = await supabase
            .from("leads")
            .select("*")
            .eq("id", action.lead_id)
            .single();

          if (error || !lead) {
            console.error("❌ VERIFICATION FAILED: Lead update not found", action.lead_id);
            verificationReport.push({
              action: "update_lead",
              status: "failed",
              issue: `Lead ${action.lead_name} update failed`,
            });
          } else {
            console.log("✅ VERIFIED: Lead updated:", lead.id);
            verificationReport.push({
              action: "update_lead",
              status: "verified",
              lead_id: lead.id,
              updates: action.updates,
            });
          }
          break;
        }

        default:
          console.log("⚠️ Unknown action type, skipping verification:", action.action);
          verificationReport.push({
            action: action.action,
            status: "skipped",
            reason: "Unknown action type",
          });
      }
    }

    // Log agent action for verification run
    await supabase.from("agent_actions").insert({
      agent_type: "verifier",
      action_type: "verification_complete",
      status: "completed",
      data: {
        verified_count: verificationReport.filter(r => r.status === "verified").length,
        failed_count: verificationReport.filter(r => r.status === "failed").length,
        fixed_count: verificationReport.filter(r => r.status === "fixed").length,
        report: verificationReport,
      },
      executed_at: new Date().toISOString(),
    });

    const summary = {
      total_actions: actionsTaken?.length || 0,
      verified: verificationReport.filter(r => r.status === "verified").length,
      failed: verificationReport.filter(r => r.status === "failed").length,
      fixed: verificationReport.filter(r => r.status === "fixed").length,
    };

    console.log("✅ VERIFICATION COMPLETE:", summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        report: verificationReport,
        fixed_actions: fixedActions,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("❌ VERIFIER ERROR:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
