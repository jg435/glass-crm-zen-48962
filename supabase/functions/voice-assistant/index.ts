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
    const { message, conversationHistory } = await req.json();
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY not configured");
    }

    console.log("Processing voice command:", message);

    // Initialize Supabase client to fetch data
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch relevant data from database
    const [leadsData, campaignsData, meetingsData, actionsData, emailRepliesData, agentRunsData] = await Promise.all([
      supabase.from("leads").select("*").order("lead_score", { ascending: false }).limit(20),
      supabase
        .from("email_campaigns")
        .select("*, leads(name, company)")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.from("meetings").select("*, leads(name, company)").order("scheduled_at", { ascending: false }).limit(10),
      supabase.from("agent_actions").select("*").eq("status", "pending").limit(5),
      supabase
        .from("email_replies")
        .select("*, leads(name, company)")
        .eq("status", "pending")
        .order("replied_at", { ascending: false })
        .limit(5),
      supabase.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(5),
    ]);

    // Create an agent run to log this interaction
    const { data: agentRun } = await supabase
      .from("agent_runs")
      .insert({
        agent_type: "voice_assistant",
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const runId = agentRun?.id;

    // Detect and execute action items
    const lowerMessage = message.toLowerCase();
    let actionResults: string[] = [];
    let actionsTaken: any[] = [];
    let uiActions: any[] = [];

    // 0. UI Navigation Commands
    // Open Settings
    if (lowerMessage.includes("open settings") || lowerMessage.includes("show settings")) {
      uiActions.push({ type: 'open_settings' });
      actionResults.push("Opening settings");
    }
    
    // Open Lead Generation
    if ((lowerMessage.includes("find") || lowerMessage.includes("generate") || lowerMessage.includes("search")) && 
        lowerMessage.includes("new lead")) {
      uiActions.push({ type: 'open_lead_generation' });
      actionResults.push("Opening lead generation");
    }
    
    // Open Email Campaigns
    if ((lowerMessage.includes("show") || lowerMessage.includes("open") || lowerMessage.includes("view")) && 
        (lowerMessage.includes("email campaign") || lowerMessage.includes("all emails"))) {
      uiActions.push({ type: 'open_emails' });
      actionResults.push("Opening email campaigns");
    }
    
    // Open Meeting Scheduler
    if ((lowerMessage.includes("schedule") || lowerMessage.includes("book") || lowerMessage.includes("create")) && 
        lowerMessage.includes("meeting") && !lowerMessage.includes("show")) {
      uiActions.push({ type: 'open_meeting_scheduler' });
      actionResults.push("Opening meeting scheduler");
    }
    
    // Navigate to specific lead
    if ((lowerMessage.includes("show") || lowerMessage.includes("open") || lowerMessage.includes("view")) && 
        lowerMessage.includes("lead")) {
      const leadName = message.match(/(?:show|open|view)\s+lead\s+(?:for\s+)?([A-Za-z\s]+)/i)?.[1]?.trim();
      
      if (leadName) {
        const { data: leads } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).limit(1);
        const lead = leads?.[0];
        
        if (lead) {
          uiActions.push({ type: 'navigate_to_lead', leadId: lead.id });
          actionResults.push(`Opening details for ${lead.name}`);
        } else {
          actionResults.push(`Lead "${leadName}" not found`);
        }
      }
    }

    // 1. Set follow-ups (check this FIRST before tasks/reminders)
    if (lowerMessage.includes("follow up") || lowerMessage.includes("followup")) {
      const leadName = message.match(/with\s+([A-Za-z\s]+?)(?:\s+on\s+|\s+tomorrow|\s+next|$)/i)?.[1]?.trim();
      const dateMatch = message.match(/on\s+(\w+\s+\d+)/i)?.[1] || message.match(/(tomorrow|next\s+\w+)/i)?.[1];

      if (leadName) {
        const { data: leads } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).limit(1);
        const lead = leads?.[0];

        if (lead) {
          let followupDate;
          if (dateMatch) {
            if (dateMatch.toLowerCase() === "tomorrow") {
              followupDate = new Date();
              followupDate.setDate(followupDate.getDate() + 1);
              followupDate.setHours(9, 0, 0, 0);
            } else if (dateMatch.toLowerCase().includes("next")) {
              followupDate = new Date();
              followupDate.setDate(followupDate.getDate() + 7);
              followupDate.setHours(9, 0, 0, 0);
            } else {
              followupDate = new Date(dateMatch);
            }
          } else {
            followupDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          }

          // Update lead's next_followup_at
          await supabase.from("leads").update({ next_followup_at: followupDate.toISOString() }).eq("id", lead.id);
          
          // Also create a meeting/task for the follow-up
          await supabase.from("meetings").insert({
            title: `Follow-up with ${lead.name}`,
            scheduled_at: followupDate.toISOString(),
            status: "scheduled",
            lead_id: lead.id,
          });
          
          actionResults.push(`Follow-up scheduled with ${lead.name}`);
          actionsTaken.push({
            type: "schedule_followup",
            lead_name: lead.name,
            scheduled_at: followupDate.toISOString(),
          });
        }
      }
    }
    // 2. Add tasks/reminders (but NOT if it's a follow-up)
    else if (
      lowerMessage.includes("remind") || 
      lowerMessage.includes("add task") || 
      lowerMessage.includes("create task") ||
      lowerMessage.includes("create a task") ||
      lowerMessage.includes("todo")
    ) {
      // Extract task title by removing command phrases
      let taskTitle = message;
      const patterns = [
        /^remind me to\s+/i,
        /^add task of\s+/i,
        /^add task to\s+/i,
        /^create a task of\s+/i,
        /^create a task to\s+/i,
        /^create task of\s+/i,
        /^create task to\s+/i,
        /^todo:\s*/i
      ];
      
      for (const pattern of patterns) {
        taskTitle = taskTitle.replace(pattern, "");
      }
      taskTitle = taskTitle.trim();
      
      if (taskTitle) {
        const today = new Date();
        today.setHours(today.getHours() + 1);
        const { data: newTask, error } = await supabase.from("meetings").insert({
          title: taskTitle,
          scheduled_at: today.toISOString(),
          status: "scheduled",
          lead_id: leadsData.data?.[0]?.id || "00000000-0000-0000-0000-000000000000",
        }).select().single();
        
        if (!error && newTask) {
          actionResults.push(`Task "${taskTitle}" added successfully`);
          actionsTaken.push({ action: "add_task", task_id: newTask.id, title: taskTitle });
        } else {
          console.error("Task creation error:", error);
          actionResults.push(`Failed to create task: ${error?.message || 'Unknown error'}`);
        }
      }
    }

    // 3. Mark tasks complete
    if (lowerMessage.includes("complete") || lowerMessage.includes("done") || lowerMessage.includes("finish")) {
      if (lowerMessage.includes("task") || lowerMessage.includes("today")) {
        const { data: todayTasks } = await supabase
          .from("meetings")
          .select("*")
          .gte("scheduled_at", new Date().toISOString().split("T")[0])
          .eq("status", "scheduled");

        if (todayTasks && todayTasks.length > 0) {
          for (const task of todayTasks) {
            await supabase.from("meetings").update({ status: "completed" }).eq("id", task.id);
          }
          actionResults.push(`Marked ${todayTasks.length} task(s) as complete`);
        }
      }
    }

    // 4. Draft emails - only trigger on draft/create/write email commands
    if (
      !lowerMessage.includes("approve") && 
      !lowerMessage.includes("reject") && 
      !lowerMessage.includes("send") &&
      (lowerMessage.includes("draft") || lowerMessage.includes("write") || lowerMessage.includes("create")) && 
      lowerMessage.includes("email")
    ) {
      const leadName = message.match(/(?:to|for|about)\s+([A-Za-z\s]+?)(?:\s+about|\s+regarding|$)/i)?.[1]?.trim();

      console.log("Attempting to draft email for lead:", leadName);

      if (leadName) {
        const { data: leads, error: leadError } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`);
        
        if (leadError) {
          console.error("Lead lookup error:", leadError);
          actionResults.push(`Error finding lead: ${leadError.message}`);
        } else if (!leads || leads.length === 0) {
          console.log("No leads found matching:", leadName);
          actionResults.push(`Lead "${leadName}" not found in the system`);
        } else {
          const lead = leads[0];
          console.log("Found lead:", lead.name, "with ID:", lead.id);

          const { data: campaignData, error: draftError } = await supabase.functions.invoke("draft-email", {
            body: { leadId: lead.id, context: message },
          });

          if (draftError) {
            console.error("Draft email invoke error:", draftError);
            actionResults.push(`Failed to draft email: ${draftError.message}`);
          } else if (campaignData?.error) {
            console.error("Draft email function error:", campaignData.error);
            actionResults.push(`Failed to draft email: ${campaignData.error}`);
          } else if (campaignData?.success) {
            console.log("Email draft created successfully:", campaignData.campaign?.id);
            actionResults.push(
              `Email draft created for ${lead.name}. Check the Emails for Review section to approve it.`,
            );
            actionsTaken.push({ action: "draft_email", lead_id: lead.id, campaign_id: campaignData.campaign?.id });

            await supabase.from("agent_actions").insert({
              agent_type: "voice_assistant",
              action_type: "email_drafted",
              status: "completed",
              data: { lead_id: lead.id, campaign_id: campaignData.campaign?.id },
              executed_at: new Date().toISOString(),
            });
          } else {
            console.error("Unexpected draft-email response:", campaignData);
            actionResults.push("Email draft request completed but response unclear");
          }
        }
      } else {
        actionResults.push("Please specify which lead you want to email (e.g., 'draft email to Mike Chen')");
      }
    }

    // 5. Approve and send emails
    if ((lowerMessage.includes("approve") || lowerMessage.includes("send")) && lowerMessage.includes("email")) {
      const leadName = message.match(/to\s+([A-Za-z\s]+)/i)?.[1]?.trim();

      if (leadName) {
        const { data: lead } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).single();

        if (lead) {
          const { data: campaign } = await supabase
            .from("email_campaigns")
            .select("*")
            .eq("lead_id", lead.id)
            .eq("draft_status", "draft")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (campaign) {
            const { data: sendData, error: sendError } = await supabase.functions.invoke("send-email", {
              body: { campaignId: campaign.id },
            });

            if (sendError) {
              console.error("Send email invoke error:", sendError);
              actionResults.push(`Failed to send email: ${sendError.message}`);
            } else if (sendData?.error) {
              console.error("Send email function error:", sendData.error);
              actionResults.push(`Failed to send email: ${sendData.error}`);
            } else if (sendData?.success) {
              actionResults.push(`Email sent to ${lead.name} successfully`);
              actionsTaken.push({ action: "send_email", lead_id: lead.id, campaign_id: campaign.id });

              await supabase.from("agent_actions").insert({
                agent_type: "voice_assistant",
                action_type: "email_sent",
                status: "completed",
                data: { lead_id: lead.id, campaign_id: campaign.id },
                executed_at: new Date().toISOString(),
              });
            }
          } else {
            actionResults.push(`No draft email found for ${lead.name}`);
          }
        }
      }
    }

    // 5b. Reject email drafts
    if (lowerMessage.includes("reject") && lowerMessage.includes("email")) {
      const leadName = message.match(/(?:to|for)\s+([A-Za-z\s]+)/i)?.[1]?.trim();

      if (leadName) {
        const { data: lead } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).single();

        if (lead) {
          const { data: campaign } = await supabase
            .from("email_campaigns")
            .select("*")
            .eq("lead_id", lead.id)
            .eq("draft_status", "draft")
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          if (campaign) {
            await supabase.from("email_campaigns").delete().eq("id", campaign.id);
            
            actionResults.push(`Email draft for ${lead.name} has been rejected and deleted`);
            actionsTaken.push({ action: "reject_email", lead_id: lead.id, campaign_id: campaign.id });

            await supabase.from("agent_actions").insert({
              agent_type: "voice_assistant",
              action_type: "email_rejected",
              status: "completed",
              data: { lead_id: lead.id, campaign_id: campaign.id },
              executed_at: new Date().toISOString(),
            });
          } else {
            actionResults.push(`No draft email found for ${lead.name}`);
          }
        }
      }
    }

    // 5c. Show pending email drafts
    if ((lowerMessage.includes("show") || lowerMessage.includes("list")) && 
        (lowerMessage.includes("draft") || lowerMessage.includes("pending email"))) {
      const { data: drafts } = await supabase
        .from("email_campaigns")
        .select("*, leads(name, company)")
        .eq("draft_status", "draft")
        .order("created_at", { ascending: false })
        .limit(5);

      if (drafts && drafts.length > 0) {
        const draftList = drafts.map((d: any) => `${d.leads?.name} - ${d.subject}`).join(", ");
        actionResults.push(`You have ${drafts.length} pending email draft(s): ${draftList}`);
      } else {
        actionResults.push("No pending email drafts");
      }
    }

    // 6. Find/search leads
    if (lowerMessage.includes("find") || lowerMessage.includes("search") || lowerMessage.includes("show me")) {
      if (lowerMessage.includes("lead")) {
        const industry = message.match(/in\s+([A-Za-z\s]+)/i)?.[1]?.trim();
        const status = message.match(/status\s+(\w+)/i)?.[1]?.trim();

        let query = supabase.from("leads").select("*");
        if (industry) query = query.ilike("industry", `%${industry}%`);
        if (status) query = query.eq("status", status);

        const { data: foundLeads } = await query.limit(5);
        if (foundLeads && foundLeads.length > 0) {
          actionResults.push(`Found ${foundLeads.length} lead(s)`);
        }
      }
    }

    // 7. Add new leads
    if (lowerMessage.includes("add lead") || lowerMessage.includes("new lead")) {
      const nameMatch = message
        .match(/(?:name[d]?\s+|called\s+)([A-Za-z\s]+?)(?:\s+and|\s+with|\s+e-?mail|$)/i)?.[1]
        ?.trim();
      const emailMatch = message
        .match(/e-?mail[:\s]+([\w.+-]+@[\w.-]+\.\w+)/i)?.[1]
        ?.replace(/\s+/g, "")
        .trim();
      const companyMatch = message.match(/(?:from|at|company)\s+([A-Za-z\s]+)/i)?.[1]?.trim();

      if (nameMatch) {
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({
            name: nameMatch,
            email: emailMatch || null,
            company: companyMatch || null,
            status: "new",
            source: "voice_assistant",
            lead_score: 50,
          })
          .select()
          .single();

        if (!error && newLead) {
          actionResults.push(`Lead ${nameMatch} added successfully`);
          actionsTaken.push({ action: "add_lead", lead_id: newLead.id, name: nameMatch, email: emailMatch });

          // Log as agent action
          await supabase.from("agent_actions").insert({
            agent_type: "voice_assistant",
            action_type: "lead_created",
            status: "completed",
            data: { lead_id: newLead.id, name: nameMatch, email: emailMatch },
            executed_at: new Date().toISOString(),
          });
        }
      }
    }

    // 8. Review email replies
    if (
      lowerMessage.includes("review") &&
      (lowerMessage.includes("reply") || lowerMessage.includes("replies") || lowerMessage.includes("email"))
    ) {
      const { data: pendingReplies } = await supabase
        .from("email_replies")
        .select("*, leads(name, company)")
        .eq("status", "pending")
        .eq("requires_manager_review", true)
        .order("replied_at", { ascending: false })
        .limit(3);

      if (pendingReplies && pendingReplies.length > 0) {
        actionResults.push(`Found ${pendingReplies.length} email reply(ies) waiting for review`);
      } else {
        actionResults.push("No email replies pending review");
      }
    }

    // 9. Approve email reply
    if (lowerMessage.includes("approve") && lowerMessage.includes("reply")) {
      const leadName = message.match(/(?:to|for|from)\s+([A-Za-z\s]+)/i)?.[1]?.trim();

      if (leadName) {
        const { data: lead } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).single();

        if (lead) {
          const { data: reply } = await supabase
            .from("email_replies")
            .select("*")
            .eq("lead_id", lead.id)
            .eq("status", "pending")
            .order("replied_at", { ascending: false })
            .limit(1)
            .single();

          if (reply) {
            // Update reply status
            await supabase
              .from("email_replies")
              .update({
                status: "approved",
                reviewed_at: new Date().toISOString(),
              })
              .eq("id", reply.id);

            // Send the reply via email
            const { error: sendError } = await supabase.functions.invoke("send-email", {
              body: {
                to: lead.email,
                subject: `Re: Previous conversation`,
                body: reply.draft_response,
              },
            });

            if (!sendError) {
              actionResults.push(`Email reply to ${lead.name} approved and sent`);
            }
          }
        }
      }
    }

    // 10. Approve follow-up emails
    if (lowerMessage.includes("approve") && lowerMessage.includes("follow")) {
      const { data: followupActions } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("action_type", "followup_email_approval")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);

      if (followupActions && followupActions.length > 0) {
        for (const action of followupActions) {
          // Update action status
          await supabase
            .from("agent_actions")
            .update({
              status: "approved",
              approved_at: new Date().toISOString(),
            })
            .eq("id", action.id);

          // Send the follow-up email
          const campaignId = action.data.campaign_id;
          await supabase.functions.invoke("send-email", {
            body: { campaignId },
          });
        }
        actionResults.push(`Approved and sent ${followupActions.length} follow-up email(s)`);
      } else {
        actionResults.push("No follow-up emails pending approval");
      }
    }

    // 11. Run background agents
    if (lowerMessage.includes("run agent") || lowerMessage.includes("start agent")) {
      const agentType = lowerMessage.includes("follow")
        ? "follow_up"
        : lowerMessage.includes("scoring")
          ? "lead_scoring"
          : lowerMessage.includes("pipeline")
            ? "deal_pipeline"
            : null;

      if (agentType === "follow_up") {
        await supabase.functions.invoke("auto-followup-scheduler", {});
        actionResults.push("Follow-up agent started");
      } else {
        await supabase.functions.invoke("agent-orchestrator", {
          body: { agentType },
        });
        actionResults.push("Background agents started");
      }
    }

    // 12. Show agent activity
    if (
      lowerMessage.includes("agent") &&
      (lowerMessage.includes("activity") || lowerMessage.includes("status") || lowerMessage.includes("working"))
    ) {
      const { data: recentRuns } = await supabase
        .from("agent_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(3);

      if (recentRuns && recentRuns.length > 0) {
        actionResults.push(`${recentRuns.length} recent agent runs found`);
      }
    }

    // 13. Schedule meetings
    if (lowerMessage.includes("schedule") && lowerMessage.includes("meeting")) {
      const leadName = message.match(/(?:with|for)\s+([A-Za-z\s]+?)(?:\s+and|\s+on|$)/i)?.[1]?.trim();

      if (leadName) {
        const { data: lead } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).single();

        if (lead) {
          const scheduledTime = new Date();
          scheduledTime.setHours(scheduledTime.getHours() + 2); // Default to 2 hours from now

          const { data: meeting, error } = await supabase
            .from("meetings")
            .insert({
              title: `Follow-up meeting with ${lead.name}`,
              lead_id: lead.id,
              scheduled_at: scheduledTime.toISOString(),
              status: "scheduled",
              google_meet_link: `https://meet.google.com/${Date.now()}`,
            })
            .select()
            .single();

          if (!error && meeting) {
            actionResults.push(`Meeting scheduled with ${lead.name}`);
            actionsTaken.push({ action: "schedule_meeting", meeting_id: meeting.id, lead_name: lead.name });

            // Log as agent action
            await supabase.from("agent_actions").insert({
              agent_type: "voice_assistant",
              action_type: "meeting_scheduled",
              status: "completed",
              data: { meeting_id: meeting.id, lead_id: lead.id, lead_name: lead.name },
              executed_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    // 14. Update lead fields (email, phone, company, status, notes)
    if (
      (lowerMessage.includes("change") || lowerMessage.includes("update") || lowerMessage.includes("set")) &&
      (lowerMessage.includes("email") ||
        lowerMessage.includes("phone") ||
        lowerMessage.includes("company") ||
        lowerMessage.includes("status") ||
        lowerMessage.includes("note"))
    ) {
      const leadName = message
        .match(/(?:change|update|set)\s+([A-Za-z\s]+?)(?:'s|\s+email|\s+phone|\s+company|\s+status|\s+note)/i)?.[1]
        ?.trim();

      if (leadName) {
        const { data: lead } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).single();

        if (lead) {
          const updates: any = {};
          let fieldUpdated = "";

          // Email update
          if (lowerMessage.includes("email")) {
            const emailMatch = message
              .match(/(?:to|email)\s+([\w.+-]+@[\w.-]+\.\w+)/i)?.[1]
              ?.replace(/\s+/g, "")
              .trim();
            if (emailMatch) {
              updates.email = emailMatch;
              fieldUpdated = `email to ${emailMatch}`;
            }
          }

          // Phone update
          if (lowerMessage.includes("phone")) {
            const phoneMatch = message.match(/(?:phone|number)\s+([\d\s\-\+\(\)]+)/i)?.[1]?.trim();
            if (phoneMatch) {
              updates.phone = phoneMatch;
              fieldUpdated = `phone to ${phoneMatch}`;
            }
          }

          // Company update
          if (lowerMessage.includes("company")) {
            const companyMatch = message.match(/company\s+(?:to\s+)?([A-Za-z\s]+)/i)?.[1]?.trim();
            if (companyMatch) {
              updates.company = companyMatch;
              fieldUpdated = `company to ${companyMatch}`;
            }
          }

          // Status update
          if (lowerMessage.includes("status")) {
            const statusMatch = message
              .match(/status\s+(?:to\s+)?(new|contacted|qualified|proposal|negotiation|won|lost)/i)?.[1]
              ?.toLowerCase();
            if (statusMatch) {
              updates.status = statusMatch;
              fieldUpdated = `status to ${statusMatch}`;
            }
          }

          // Notes update
          if (lowerMessage.includes("note")) {
            const noteMatch = message.match(/note[s]?\s+(?:to\s+)?(.+)$/i)?.[1]?.trim();
            if (noteMatch) {
              updates.notes = noteMatch;
              fieldUpdated = `notes`;
            }
          }

          if (Object.keys(updates).length > 0) {
            const { error } = await supabase.from("leads").update(updates).eq("id", lead.id);

            if (!error) {
              actionResults.push(`Updated ${lead.name}'s ${fieldUpdated}`);
              actionsTaken.push({ action: "update_lead", lead_id: lead.id, lead_name: lead.name, updates });

              // Log as agent action
              await supabase.from("agent_actions").insert({
                agent_type: "voice_assistant",
                action_type: "lead_updated",
                status: "completed",
                data: { lead_id: lead.id, updates },
                executed_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    // 15. Join meeting (prepare AI agent to join)
    if (lowerMessage.includes("join") && lowerMessage.includes("meet")) {
      const leadName = message.match(/(?:with|for)\s+([A-Za-z\s]+)/i)?.[1]?.trim();

      if (leadName) {
        const { data: lead } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).single();

        if (lead) {
          // Find the upcoming or in-progress meeting
          const { data: meeting } = await supabase
            .from("meetings")
            .select("*")
            .eq("lead_id", lead.id)
            .in("status", ["scheduled", "prepared"])
            .order("scheduled_at", { ascending: false })
            .limit(1)
            .single();

          if (meeting) {
            // Prepare the AI agent to join
            const { data: prepData, error: prepError } = await supabase.functions.invoke("meeting-voice-agent", {
              body: {
                action: "prepare",
                meetingId: meeting.id,
              },
            });

            if (prepError) {
              console.error("Meeting prep invoke error:", prepError);
              actionResults.push(`Failed to prepare AI agent: ${prepError.message}`);
            } else if (prepData?.error) {
              console.error("Meeting prep function error:", prepData.error);
              actionResults.push(`Failed to prepare AI agent: ${prepData.error}`);
            } else if (prepData?.success) {
              // Update meeting status to prepared
              await supabase.from("meetings").update({ status: "prepared" }).eq("id", meeting.id);

              actionResults.push(
                `AI agent prepared to join meeting with ${lead.name}. The agent will automatically join at the scheduled time.`,
              );
              actionsTaken.push({ action: "prepare_meeting", meeting_id: meeting.id, lead_name: lead.name });

              await supabase.from("agent_actions").insert({
                agent_type: "voice_assistant",
                action_type: "meeting_prepared",
                status: "completed",
                data: { meeting_id: meeting.id, lead_id: lead.id },
                executed_at: new Date().toISOString(),
              });
            }
          } else {
            actionResults.push(`No upcoming meeting found with ${lead.name}. Would you like me to schedule one?`);
          }
        }
      }
    }

    // Complete the agent run
    if (runId) {
      await supabase
        .from("agent_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          actions_taken: actionsTaken,
        })
        .eq("id", runId);
    }

    // Build context with actual data
    const dataContext = `
Current Sales Data:

LEADS (${leadsData.data?.length || 0} total, showing top 20):
${
  leadsData.data
    ?.map(
      (lead) =>
        `- ${lead.name} (${lead.company || "Unknown Company"})
    Status: ${lead.status} | Score: ${lead.lead_score} | Industry: ${lead.industry || "N/A"}
    Email: ${lead.email || "N/A"} | Source: ${lead.source}
    ${lead.notes ? `Notes: ${lead.notes}` : ""}`,
    )
    .join("\n") || "No leads yet"
}

EMAIL CAMPAIGNS (${campaignsData.data?.length || 0} recent):
${
  campaignsData.data
    ?.map(
      (c) =>
        `- To: ${c.leads?.name} (${c.leads?.company})
    Subject: ${c.subject}
    Status: ${c.draft_status}
    ${c.sent_at ? `Sent: ${c.sent_at}` : "Not sent yet"}`,
    )
    .join("\n") || "No campaigns yet"
}

MEETINGS (${meetingsData.data?.length || 0} upcoming):
${
  meetingsData.data
    ?.map(
      (m) =>
        `- ${m.title} with ${m.leads?.name} (${m.leads?.company})
    Scheduled: ${m.scheduled_at}
    Status: ${m.status}`,
    )
    .join("\n") || "No meetings scheduled"
}

PENDING ACTIONS (${actionsData.data?.length || 0}):
${actionsData.data?.map((a) => `- ${a.action_type} (${a.agent_type}): ${a.status}`).join("\n") || "No pending actions"}

EMAIL REPLIES (${emailRepliesData.data?.length || 0} pending review):
${
  emailRepliesData.data
    ?.map(
      (r) =>
        `- From: ${r.leads?.name} (${r.leads?.company})
    Sentiment: ${r.sentiment_score}
    Replied: ${r.replied_at}
    Draft response ready: ${r.draft_response ? "Yes" : "No"}`,
    )
    .join("\n") || "No email replies pending"
}

AGENT ACTIVITY (${agentRunsData.data?.length || 0} recent runs):
${
  agentRunsData.data
    ?.map(
      (a) =>
        `- ${a.agent_type}: ${a.status}
    Started: ${a.started_at}
    ${a.actions_taken ? `Actions: ${JSON.stringify(a.actions_taken).slice(0, 100)}...` : ""}`,
    )
    .join("\n") || "No recent agent activity"
}

${actionResults.length > 0 ? `\n[ACTIONS COMPLETED: ${actionResults.join("; ")}]` : ""}
`;

    console.log("Data context prepared with live database info");

    // Build conversation context
    const messages = conversationHistory || [];
    messages.push({
      role: "user",
      parts: [{ text: `${dataContext}\n\nUser query: ${message}` }],
    });

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages,
          systemInstruction: {
            parts: [
              {
                text: `You are an AI sales assistant with full access to real-time sales data and ability to execute actions. You help managers with:
- Analyzing leads and their scores
- Finding and adding new leads
- Setting follow-ups automatically
- Drafting emails to leads
- Approving and sending emails
- Creating and completing tasks
- Managing meeting schedules
- Opening different sections of the CRM
- Providing actionable insights from the sales pipeline

IMPORTANT CAPABILITIES:
- You can OPEN settings, lead generation, email campaigns, and meeting scheduler
- You can NAVIGATE to specific lead details pages
- You can ADD tasks/reminders when asked
- You can MARK tasks complete when requested
- You can SET follow-ups with leads
- You can DRAFT emails to leads
- You can SEND emails after voice approval
- You can FIND and SEARCH leads
- You can ADD new leads to the system
- You can UPDATE lead details (email, phone, company, status, notes)
- You can REVIEW email replies from leads
- You can APPROVE and SEND reply emails
- You can APPROVE follow-up emails in bulk
- You can RUN background agents (follow-up, lead scoring, pipeline)
- You can SHOW agent activity and status
- You can SCHEDULE meetings with leads
- You can PREPARE AI agent to join meetings (the AI will automatically join at the scheduled time)

UI NAVIGATION COMMANDS:
- "Open settings" - Opens the settings modal
- "Find new leads" / "Generate leads" - Opens the lead generation modal
- "Show email campaigns" / "View all emails" - Opens email campaigns view
- "Schedule a meeting" / "Book a meeting" - Opens meeting scheduler
- "Show lead for [Name]" / "Open lead [Name]" - Navigates to lead details page

When actions are performed, you'll see [ACTIONS COMPLETED] in the context - acknowledge what was done.
Always be proactive in suggesting and executing actions.
Be concise, actionable, and professional. Keep responses under 2-3 sentences.
Reference actual lead names and numbers when available.
When reviewing emails, summarize sentiment and suggest approve/reject.`,
              },
            ],
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const assistantMessage = data.candidates[0]?.content?.parts[0]?.text || "Sorry, I could not process that.";

    console.log("Assistant response:", assistantMessage);

    return new Response(JSON.stringify({ 
      message: assistantMessage,
      actions: uiActions 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
