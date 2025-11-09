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

    // 0. UI Navigation Commands & Form Auto-Fill
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

    // Form Auto-Fill: Edit Lead
    if ((lowerMessage.includes("edit") || lowerMessage.includes("update")) && lowerMessage.includes("lead")) {
      const leadName = message.match(/(?:edit|update)\s+lead\s+(?:for\s+)?([A-Za-z\s]+)/i)?.[1]?.trim();
      
      if (leadName) {
        const { data: leads } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).limit(1);
        const lead = leads?.[0];
        
        if (lead) {
          // Extract field updates from voice input
          const formData: any = {};
          
          // Extract email
          const emailMatch = message.match(/e-?mail[:\s]+(?:is\s+|to\s+)?([\w.+-]+@[\w.-]+\.\w+)/i)?.[1];
          if (emailMatch) formData.email = emailMatch;
          
          // Extract phone
          const phoneMatch = message.match(/(?:phone|number)[:\s]+(?:is\s+|to\s+)?([\d\s\-\+\(\)]+)/i)?.[1]?.trim();
          if (phoneMatch) formData.phone = phoneMatch;
          
          // Extract company
          const companyMatch = message.match(/company[:\s]+(?:is\s+|to\s+)?([A-Za-z\s&]+?)(?:,|\.|$)/i)?.[1]?.trim();
          if (companyMatch) formData.company = companyMatch;
          
          // Extract industry
          const industryMatch = message.match(/industry[:\s]+(?:is\s+|to\s+)?([A-Za-z\s]+?)(?:,|\.|$)/i)?.[1]?.trim();
          if (industryMatch) formData.industry = industryMatch;
          
          // Extract notes
          const notesMatch = message.match(/notes?[:\s]+(.+?)(?:\.|$)/i)?.[1]?.trim();
          if (notesMatch) formData.notes = notesMatch;

          if (Object.keys(formData).length > 0) {
            uiActions.push({ 
              type: 'fill_form', 
              formType: 'lead_edit',
              leadId: lead.id,
              data: formData 
            });
            actionResults.push(`Editing ${lead.name} with: ${Object.keys(formData).join(', ')}`);
          } else {
            uiActions.push({ type: 'navigate_to_lead', leadId: lead.id });
            actionResults.push(`Opening ${lead.name} for editing`);
          }
        }
      }
    }

    // Form Auto-Fill: Schedule Meeting with data
    if ((lowerMessage.includes("schedule") || lowerMessage.includes("book")) && 
        lowerMessage.includes("meeting") && 
        (lowerMessage.includes("with") || lowerMessage.includes("for"))) {
      
      const leadName = message.match(/(?:with|for)\s+([A-Za-z\s]+?)(?:\s+on|\s+at|\s+titled|$)/i)?.[1]?.trim();
      const titleMatch = message.match(/titled\s+(.+?)(?:\s+on|\s+at|$)/i)?.[1]?.trim() ||
                        message.match(/meeting\s+(.+?)(?:\s+with|\s+for|\s+on|\s+at|$)/i)?.[1]?.trim();
      const dateMatch = message.match(/(?:on|at)\s+(.+?)(?:$)/i)?.[1]?.trim();

      if (leadName) {
        const { data: leads } = await supabase.from("leads").select("*").ilike("name", `%${leadName}%`).limit(1);
        const lead = leads?.[0];
        
        if (lead) {
          const formData: any = {};
          if (titleMatch) formData.title = titleMatch;
          if (dateMatch) {
            // Parse natural language dates
            const tomorrow = dateMatch.toLowerCase().includes('tomorrow');
            if (tomorrow) {
              const date = new Date();
              date.setDate(date.getDate() + 1);
              date.setHours(9, 0, 0, 0);
              formData.datetime = date.toISOString().slice(0, 16);
            }
          }

          uiActions.push({ 
            type: 'fill_form', 
            formType: 'meeting_scheduler',
            leadId: lead.id,
            data: formData 
          });
          actionResults.push(`Preparing meeting with ${lead.name}`);
        }
      }
    }

    // Form Submission Commands
    if ((lowerMessage.includes("submit") || lowerMessage.includes("save")) && 
        (lowerMessage.includes("form") || lowerMessage.includes("changes"))) {
      
      let formType = null;
      if (lowerMessage.includes("lead") || lowerMessage.includes("contact")) {
        formType = 'lead_edit';
      } else if (lowerMessage.includes("meeting")) {
        formType = 'meeting_scheduler';
      }

      if (formType) {
        const requiresConfirmation = !lowerMessage.includes("without confirm");
        uiActions.push({ 
          type: 'submit_form', 
          formType,
          requiresConfirmation 
        });
        actionResults.push(requiresConfirmation ? 
          `Preparing to submit ${formType}. I'll ask for confirmation first.` :
          `Submitting ${formType} immediately`
        );
      } else {
        actionResults.push("Please specify which form to submit (lead or meeting)");
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

    // 4a. Edit email draft (subject or body)
    if ((lowerMessage.includes("edit") || lowerMessage.includes("change") || lowerMessage.includes("update")) && 
        (lowerMessage.includes("email") || lowerMessage.includes("draft") || lowerMessage.includes("subject") || lowerMessage.includes("body"))) {
      
      // Determine what to edit
      const isSubject = lowerMessage.includes("subject");
      const isBody = lowerMessage.includes("body");
      
      // Extract the new content
      let newContent: string | null = null;
      
      if (isSubject) {
        // Extract new subject: "edit the subject line to [new subject]" or "change subject to [new subject]"
        const subjectMatch = message.match(/(?:subject|subject line)\s+(?:to|is)\s+(.+?)(?:\.|$)/i)?.[1]?.trim();
        if (subjectMatch) {
          newContent = subjectMatch;
        }
      } else if (isBody) {
        // Extract new body: "change the body to [new body]" or "edit body to [new body]"
        const bodyMatch = message.match(/body\s+(?:to|is)\s+(.+?)(?:\.|$)/i)?.[1]?.trim();
        if (bodyMatch) {
          newContent = bodyMatch;
        }
      }
      
      if (newContent) {
        // Extract lead name if specified, otherwise use most recent draft
        const leadMatch = message.match(/(?:for|to|from)\s+([A-Za-z\s]+?)(?:\s+(?:subject|body)|$)/i)?.[1]?.trim();
        
        if (leadMatch) {
          const { data: leads } = await supabase.from("leads").select("*").ilike("name", `%${leadMatch}%`).limit(1);
          const lead = leads?.[0];
          
          if (lead) {
            const { data: drafts } = await supabase
              .from("email_campaigns")
              .select("*")
              .eq("lead_id", lead.id)
              .eq("draft_status", "draft")
              .order("created_at", { ascending: false })
              .limit(1);
            
            const draft = drafts?.[0];
            
            if (draft) {
              const updateData: any = {};
              if (isSubject) updateData.subject = newContent;
              if (isBody) updateData.body = newContent;
              
              await supabase
                .from("email_campaigns")
                .update(updateData)
                .eq("id", draft.id);
              
              actionResults.push(`Updated email ${isSubject ? 'subject' : 'body'} for ${lead.name}`);
              actionsTaken.push({ 
                action: "edit_email_draft", 
                draft_id: draft.id,
                field: isSubject ? 'subject' : 'body',
                new_value: newContent
              });
            } else {
              actionResults.push(`No email draft found for ${lead.name}`);
            }
          } else {
            actionResults.push(`Lead "${leadMatch}" not found`);
          }
        } else {
          // Edit most recent draft
          const { data: drafts } = await supabase
            .from("email_campaigns")
            .select("*, leads(name)")
            .eq("draft_status", "draft")
            .order("created_at", { ascending: false })
            .limit(1);
          
          const draft = drafts?.[0];
          
          if (draft) {
            const updateData: any = {};
            if (isSubject) updateData.subject = newContent;
            if (isBody) updateData.body = newContent;
            
            await supabase
              .from("email_campaigns")
              .update(updateData)
              .eq("id", draft.id);
            
            actionResults.push(`Updated email ${isSubject ? 'subject' : 'body'} for ${draft.leads.name}`);
            actionsTaken.push({ 
              action: "edit_email_draft", 
              draft_id: draft.id,
              field: isSubject ? 'subject' : 'body',
              new_value: newContent
            });
          } else {
            actionResults.push("No email drafts found to edit");
          }
        }
      } else {
        actionResults.push(`Please specify the new ${isSubject ? 'subject' : 'body'} content`);
      }
    }
    // 4b. Close, Reject, or Approve actions in the preview dialog
    else if (lowerMessage.includes("close") && (lowerMessage.includes("preview") || lowerMessage.includes("email") || lowerMessage.includes("dialog"))) {
      uiActions.push({ type: 'close_preview' });
      actionResults.push("Closing email preview");
    }
    else if (lowerMessage.includes("reject") && (lowerMessage.includes("email") || lowerMessage.includes("draft") || lowerMessage.includes("this"))) {
      // Check if preview is open by looking for the reject button in preview
      uiActions.push({ type: 'reject_preview' });
      actionResults.push("Rejecting email draft");
    }
    else if ((lowerMessage.includes("approve") || lowerMessage.includes("send")) && 
        (lowerMessage.includes("email") || lowerMessage.includes("draft") || lowerMessage.includes("this")) &&
        (lowerMessage.includes("from preview") || lowerMessage.includes("in preview") || !lowerMessage.includes("for"))) {
      // If user says "approve this email" or "send this email" while in preview
      uiActions.push({ type: 'approve_preview' });
      actionResults.push("Approving and sending email from preview");
    }
    // 4c. Approve and send emails OR Preview/Open email drafts (from main list)
    else if ((lowerMessage.includes("approve") || lowerMessage.includes("send") || lowerMessage.includes("yes")) && 
        (lowerMessage.includes("email") || lowerMessage.includes("draft"))) {
      // Get the most recent draft email
      const { data: drafts } = await supabase
        .from("email_campaigns")
        .select("*, leads(name, email, company)")
        .eq("draft_status", "draft")
        .order("created_at", { ascending: false })
        .limit(1);

      const draft = drafts?.[0];

      if (draft) {
        // Check if this is actually a preview/open request
        const isPreviewRequest = lowerMessage.includes("preview") || 
                                lowerMessage.includes("open") || 
                                lowerMessage.includes("view") ||
                                lowerMessage.includes("show");
        
        if (isPreviewRequest) {
          // User wants to preview, not send
          uiActions.push({ 
            type: 'preview_email', 
            leadName: draft.leads.name,
            company: draft.leads.company
          });
          actionResults.push(`Opening email preview for ${draft.leads.name} (${draft.leads.company || 'Monitor Co'})`);
        } else {
          // User wants to approve and send
          const { data: emailResult, error: sendError } = await supabase.functions.invoke("send-email", {
            body: { campaignId: draft.id },
          });

          if (sendError) {
            console.error("Send email invoke error:", sendError);
            actionResults.push(`Failed to send email: ${sendError.message}`);
          } else if (emailResult?.error) {
            console.error("Send email function error:", emailResult.error);
            actionResults.push(`Failed to send email: ${emailResult.error}`);
          } else {
            console.log("Email sent successfully");
            actionResults.push(`Email sent to ${draft.leads.name} (${draft.leads.email || 'jgupta0700@gmail.com'})`);
            actionsTaken.push({ action: "email_sent", lead_id: draft.lead_id, campaign_id: draft.id });

            await supabase.from("agent_actions").insert({
              agent_type: "voice_assistant",
              action_type: "email_sent",
              status: "completed",
              data: { campaign_id: draft.id, lead_id: draft.lead_id },
              executed_at: new Date().toISOString(),
            });
          }
        }
      } else {
        actionResults.push("No draft emails found to approve. Would you like me to draft an email?");
      }
    }
    // 4d. Preview/Open specific email draft
    else if ((lowerMessage.includes("open") || lowerMessage.includes("preview") || lowerMessage.includes("view") || lowerMessage.includes("show")) && 
        (lowerMessage.includes("email") || lowerMessage.includes("draft"))) {
      
      // Extract lead name or company from the message
      const nameMatch = message.match(/(?:for|to|with|from)\s+([A-Za-z\s]+?)(?:\s+\(|\s+at|\s+email|$)/i)?.[1]?.trim();
      
      if (nameMatch) {
        const { data: leads } = await supabase.from("leads").select("*").ilike("name", `%${nameMatch}%`).limit(1);
        const lead = leads?.[0];
        
        if (lead) {
          // Check if there's a draft for this lead
          const { data: drafts } = await supabase
            .from("email_campaigns")
            .select("*, leads(name, email, company)")
            .eq("lead_id", lead.id)
            .eq("draft_status", "draft")
            .order("created_at", { ascending: false })
            .limit(1);
          
          const draft = drafts?.[0];
          
          if (draft) {
            uiActions.push({ 
              type: 'preview_email', 
              leadName: lead.name,
              company: lead.company
            });
            actionResults.push(`Opening email draft for ${lead.name} (${lead.company || 'Unknown Company'})`);
          } else {
            actionResults.push(`No email draft found for ${lead.name}. Would you like me to draft one?`);
          }
        } else {
          actionResults.push(`Lead "${nameMatch}" not found`);
        }
      } else {
        // No specific lead mentioned, show the most recent draft
        const { data: drafts } = await supabase
          .from("email_campaigns")
          .select("*, leads(name, email, company)")
          .eq("draft_status", "draft")
          .order("created_at", { ascending: false })
          .limit(1);
        
        const draft = drafts?.[0];
        
        if (draft) {
          uiActions.push({ 
            type: 'preview_email', 
            leadName: draft.leads.name,
            company: draft.leads.company
          });
          actionResults.push(`Opening email draft for ${draft.leads.name} (${draft.leads.company || 'Unknown Company'})`);
        } else {
          actionResults.push("No email drafts found to preview");
        }
      }
    }
    // 4e. Draft emails - only trigger on draft/create/write email commands
    else if (
      (lowerMessage.includes("draft") || lowerMessage.includes("write") || lowerMessage.includes("create")) && 
      lowerMessage.includes("email")
    ) {
      // Extract lead name - improved patterns that capture ONLY the name
      let leadName = null;
      
      // Pattern 1: "email to/for [Name]" followed by "about/with/regarding" or whitespace
      const pattern1 = /email\s+(?:to|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:about|with|regarding|and)/i;
      const match1 = message.match(pattern1);
      
      if (match1 && match1[1]) {
        leadName = match1[1].trim();
      } else {
        // Pattern 2: "to/for [Name]" followed by "about/with/regarding"
        const pattern2 = /(?:^|\s)(?:to|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(?:about|with|regarding)/i;
        const match2 = message.match(pattern2);
        
        if (match2 && match2[1]) {
          leadName = match2[1].trim();
        } else {
          // Pattern 3: "email to/for [Name]" at any position
          const pattern3 = /email\s+(?:to|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\b/i;
          const match3 = message.match(pattern3);
          
          if (match3 && match3[1]) {
            leadName = match3[1].trim();
          }
        }
      }

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

    // 5b. Show pending email drafts
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

    // 7. Add new leads - with conversational gathering
    if (lowerMessage.includes("add lead") || lowerMessage.includes("new lead") || lowerMessage.includes("create lead")) {
      // Extract information from current message - ALWAYS from the current message
      console.log("🔍 Attempting to extract lead data from:", message);
      
      // Extract lead information with improved patterns
      const nameMatch = message
        .match(/(?:lead\s+)?named\s+([A-Za-z\s]+?)(?:,|$)/i)?.[1]?.trim() ||
        message.match(/name[d]?\s+is\s+([A-Za-z\s]+?)(?:,|$)/i)?.[1]?.trim();
      
      const emailMatch = message
        .match(/e-?mail[:\s]+(?:is\s+)?([\w.+-]+@[\w.-]+\.\w+)/i)?.[1]
        ?.replace(/\s+/g, "")
        .trim();
      
      // Company: prioritize "works for/at" patterns
      const companyMatch = message.match(/works\s+(?:for|at)\s+([A-Za-z\s&]+?)(?:,|$)/i)?.[1]?.trim() ||
        message.match(/company\s+(?:is\s+)?([A-Za-z\s&]+?)(?:,|$)/i)?.[1]?.trim() ||
        message.match(/from\s+([A-Za-z\s&]+?)(?:,|$)/i)?.[1]?.trim();
      
      const phoneMatch = message.match(/(?:phone|mobile|number)[:\s]+(?:is\s+)?([\d\s\-\+\(\)]+)/i)?.[1]?.trim();

      const leadData = {
        name: nameMatch || null,
        email: emailMatch || null,
        company: companyMatch || null,
        phone: phoneMatch || null,
      };

      console.log("📋 Lead data extracted:", leadData);

      // Check if we have ALL required info before creating lead
      if (leadData.name && leadData.email && leadData.company) {
        console.log("✅ All required fields present, attempting database insert...");
        
        // We have minimum required info (name, email, company)
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({
            name: leadData.name,
            email: leadData.email,
            company: leadData.company,
            phone: leadData.phone || null,
            status: "new",
            source: "manual",
            lead_score: 50,
          })
          .select()
          .single();

        if (error) {
          console.error("❌ DATABASE INSERT FAILED:", error);
          actionResults.push(`FAILED to create lead ${leadData.name}: ${error.message}`);
        } else if (!newLead || !newLead.id) {
          console.error("❌ NO DATA RETURNED from insert");
          actionResults.push(`FAILED to create lead ${leadData.name}: No data returned`);
        } else {
          console.log("✅ DATABASE INSERT SUCCESS:", newLead.id);
          
          // Verify lead exists immediately after insert
          const { data: verifyLead, error: verifyError } = await supabase
            .from("leads")
            .select("id, name, email, company")
            .eq("id", newLead.id)
            .single();
          
          if (verifyError || !verifyLead) {
            console.error("❌ VERIFICATION FAILED: Lead not found after insert!", newLead.id);
            actionResults.push(`WARNING: Lead ${leadData.name} insert reported success but not found in database!`);
          } else {
            console.log("✅ VERIFIED: Lead exists in database:", verifyLead);
            
            uiActions.push({ type: 'highlight_tile', tile: 'contacts' });
            actionResults.push(
              `✓ Lead created: ${leadData.name} from ${leadData.company}${leadData.phone ? ` (${leadData.phone})` : ""}`
            );
            actionsTaken.push({ 
              action: "add_lead", 
              lead_id: newLead.id, 
              ...leadData 
            });

            // Log as agent action
            await supabase.from("agent_actions").insert({
              agent_type: "voice_assistant",
              action_type: "lead_created",
              status: "completed",
              data: { lead_id: newLead.id, ...leadData },
              executed_at: new Date().toISOString(),
            });
          }
        }
      } else {
        // We don't have all required info - tell them what's missing
        const missing = [];
        if (!leadData.name) missing.push("name");
        if (!leadData.email) missing.push("email");
        if (!leadData.company) missing.push("company");
        
        console.log("❌ Missing required fields:", missing);
        actionResults.push(
          `I need the following information to create the lead: ${missing.join(", ")}. Please provide all details together in one message.`
        );
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

    // 10. Run background agents
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

    // 11. Show agent activity
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

    // 12. Schedule meetings
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

    // 13. Update lead fields (email, phone, company, status, notes)
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

    // 14. Join meeting (prepare AI agent to join)
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

    // 🔍 CALL VERIFIER AGENT to check all claimed actions
    let verificationReport = null;
    if (((actionsTaken?.length ?? 0) > 0) || ((actionResults?.length ?? 0) > 0)) {
      console.log("🔍 Calling verifier agent to check",
        (actionsTaken?.length ?? 0), "actions and",
        (actionResults?.length ?? 0), "action results");
      try {
        const { data: verifierResult, error: verifierError } = await supabase.functions.invoke("agent-verifier", {
          body: {
            actionsTaken,
            actionResults,
          },
        });

        if (verifierError) {
          console.error("⚠️ Verifier call failed:", verifierError);
        } else {
          verificationReport = verifierResult;
          console.log("✅ Verification complete:", verifierResult.summary);
          
          // If verifier fixed any actions, append to actionsTaken
          if (verifierResult.fixed_actions && verifierResult.fixed_actions.length > 0) {
            actionsTaken.push(...verifierResult.fixed_actions);
            console.log("🔧 Verifier fixed", verifierResult.fixed_actions.length, "actions");
          }
        }
      } catch (e) {
        console.error("⚠️ Verifier invocation error:", e);
      }
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

${verificationReport ? `
VERIFICATION REPORT:
✅ Verified: ${verificationReport.summary.verified}
🔧 Fixed by Verifier: ${verificationReport.summary.fixed}
❌ Failed: ${verificationReport.summary.failed}

${verificationReport.report.filter((r: any) => r.status === 'fixed').length > 0 ? 
  `IMPORTANT: The following actions were NOT completed initially but VERIFIER FIXED them:\n${
    verificationReport.report
      .filter((r: any) => r.status === 'fixed')
      .map((r: any) => `- ${r.action}: ${r.issue}`)
      .join('\n')
  }` : ''}

${verificationReport.report.filter((r: any) => r.status === 'failed').length > 0 ? 
  `CRITICAL: The following actions FAILED and could not be fixed:\n${
    verificationReport.report
      .filter((r: any) => r.status === 'failed')
      .map((r: any) => `- ${r.action}: ${r.issue}`)
      .join('\n')
  }` : ''}
` : ''}
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
- DRAFTING emails to leads (HUMAN APPROVAL REQUIRED - you cannot send emails, only create drafts)
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
- You can SEND/APPROVE emails when the user confirms (says "yes", "approve", "send the email")
- You can FIND and SEARCH leads
- You can ADD new leads to the system - GATHER DETAILS CONVERSATIONALLY
  * Required fields: name, email, company (phone is optional)
  * User must provide ALL required fields in ONE message
  * Example: "Add new lead named John Smith, email john@acme.com, works for ACME Corporation"
  * If any required field is missing, tell user what's needed and ask them to provide all together
  * DO NOT create the lead until you have name, email, AND company
- You can UPDATE lead details (email, phone, company, status, notes)
- You can REVIEW email replies from leads (but CANNOT send replies - humans must handle that)
- You can RUN background agents (follow-up, lead scoring, pipeline)
- You can SHOW agent activity and status
- You can SCHEDULE meetings with leads
- You can PREPARE AI agent to join meetings (the AI will automatically join at the scheduled time)

EMAIL WORKFLOW:
1. Draft emails for leads with "draft email to [Lead Name] about [topic]"
2. Tell user to review the draft in the "Emails for Review" section
3. Edit email drafts with "edit the subject line to [new subject]" or "change the body to [new body]"
4. When user says "approve" or "send the email" or "yes", the most recent draft will be sent immediately
5. Confirm when email has been sent successfully

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
When users ask you to send emails, remind them you can only draft them for human approval.`,
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
