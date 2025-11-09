import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Loader2 } from "lucide-react";

interface MeetingSchedulerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
}

const MeetingScheduler = ({ open, onOpenChange }: MeetingSchedulerProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchLeads();
    }
  }, [open]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, email, company')
        .order('name');

      if (error) throw error;
      
      // Filter out leads with invalid or missing emails
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validLeads = (data || []).filter(lead => 
        lead.email && emailRegex.test(lead.email)
      );
      
      setLeads(validLeads);
      
      // Show warning if some leads were filtered out
      if (data && data.length > validLeads.length) {
        console.warn(`${data.length - validLeads.length} leads excluded due to invalid email addresses`);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  const handleSchedule = async () => {
    if (!selectedLeadId || !title.trim() || !scheduledAt) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Validate selected lead has valid email
    const selectedLead = leads.find(l => l.id === selectedLeadId);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!selectedLead?.email || !emailRegex.test(selectedLead.email)) {
      toast({
        title: "Invalid Email",
        description: "This lead has an invalid email address. Please update their email before scheduling a meeting.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: meeting, error } = await supabase
        .from('meetings')
        .insert({
          lead_id: selectedLeadId,
          title: title.trim(),
          scheduled_at: scheduledAt,
          status: 'scheduled',
          google_meet_link: `https://meet.google.com/new`
        })
        .select('id')
        .single();

      if (error) throw error;

      // Send email invite automatically
      try {
        const { error: emailError } = await supabase.functions.invoke('send-email', {
          body: {
            meetingId: meeting.id,
          }
        });

        if (emailError) {
          console.error('Failed to send email invite:', emailError);
          toast({
            title: "Meeting Scheduled",
            description: "Meeting scheduled but failed to send email invite",
          });
        } else {
          toast({
            title: "Success",
            description: "Meeting scheduled and email invite sent",
          });
        }
      } catch (emailError) {
        console.error('Error sending email invite:', emailError);
        toast({
          title: "Meeting Scheduled",
          description: "Meeting scheduled but email invite may not have been sent",
        });
      }

      setTitle("");
      setScheduledAt("");
      setSelectedLeadId("");
      onOpenChange(false);
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      toast({
        title: "Error",
        description: "Failed to schedule meeting",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-tile max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Meeting
          </DialogTitle>
          <DialogDescription>
            Schedule a meeting with a lead
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="lead">Select Lead</Label>
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose a lead..." />
              </SelectTrigger>
              <SelectContent>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.name} {lead.company && `(${lead.company})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Meeting Title</Label>
            <Input
              id="title"
              placeholder="e.g., Product Demo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="datetime">Date & Time</Label>
            <Input
              id="datetime"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              className="rounded-xl"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Schedule
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingScheduler;
