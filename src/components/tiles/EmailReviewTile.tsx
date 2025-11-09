import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, XCircle, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EmailDraft {
  id: string;
  lead_id: string;
  subject: string;
  body: string;
  leads: {
    name: string;
    company: string | null;
    email: string | null;
  };
  is_automated_followup: boolean;
  agent_notes: string | null;
}

const EmailReviewTile = () => {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchDrafts();

    const channel = supabase
      .channel('email-drafts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_campaigns' }, () => {
        fetchDrafts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDrafts = async () => {
    const { data, count } = await supabase
      .from('email_campaigns')
      .select('*, leads(name, company, email)', { count: 'exact' })
      .eq('draft_status', 'draft')
      .order('created_at', { ascending: false })
      .limit(10);

    setDrafts(data || []);
    setTotalCount(count || 0);
  };

  const handleApprove = async (draft: EmailDraft) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: { campaignId: draft.id }
      });
      
      if (error) throw error;
      
      toast({
        title: "Email Sent",
        description: `Email sent to ${draft.leads.name} successfully`,
      });
      
      fetchDrafts();
      setSelectedDraft(null);
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (draftId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('email_campaigns')
        .delete()
        .eq('id', draftId);
      
      if (error) throw error;
      
      toast({
        title: "Draft Rejected",
        description: "Email draft has been deleted",
      });
      
      fetchDrafts();
      setSelectedDraft(null);
    } catch (error) {
      console.error('Error rejecting draft:', error);
      toast({
        title: "Error",
        description: "Failed to reject draft",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="glass-tile gradient-emails p-4 hover-scale h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Emails for Review</h2>
          </div>
          {totalCount > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
              {totalCount}
            </span>
          )}
        </div>
        
        <div className="space-y-2 overflow-auto custom-scrollbar flex-1">
          {drafts.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No emails pending review</p>
            </div>
          ) : (
            drafts.map((draft) => (
              <Card
                key={draft.id}
                className="p-3 bg-white/60 border-white/40 hover:bg-white/80 transition-all border-l-4 border-warning"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-sm">{draft.leads.name}</h3>
                    {draft.leads.company && (
                      <p className="text-xs text-muted-foreground">{draft.leads.company}</p>
                    )}
                  </div>
                  {draft.is_automated_followup && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Auto Follow-up
                    </span>
                  )}
                </div>
                
                <p className="text-xs font-medium mb-1 text-primary">{draft.subject}</p>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {draft.body.substring(0, 100)}...
                </p>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedDraft(draft)}
                    className="h-7 text-xs flex-1"
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Preview
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={() => handleApprove(draft)}
                    disabled={isProcessing}
                    className="h-7 text-xs flex-1"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleReject(draft.id)}
                    disabled={isProcessing}
                    className="h-7 text-xs"
                  >
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={!!selectedDraft} onOpenChange={(open) => !open && setSelectedDraft(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Email Preview</DialogTitle>
            <DialogDescription>
              Review email to {selectedDraft?.leads.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedDraft && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">To:</p>
                <p className="text-sm">{selectedDraft.leads.name} ({selectedDraft.leads.email || 'jgupta0700@gmail.com'})</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Subject:</p>
                <p className="text-sm font-semibold">{selectedDraft.subject}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Body:</p>
                <div className="bg-muted/30 p-4 rounded-md text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                  {selectedDraft.body}
                </div>
              </div>
              
              {selectedDraft.agent_notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Agent Notes:</p>
                  <p className="text-xs text-muted-foreground italic">{selectedDraft.agent_notes}</p>
                </div>
              )}
              
              <div className="flex gap-2 justify-end pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedDraft(null)}
                  disabled={isProcessing}
                >
                  Close
                </Button>
                <Button 
                  variant="destructive"
                  onClick={() => handleReject(selectedDraft.id)}
                  disabled={isProcessing}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  onClick={() => handleApprove(selectedDraft)}
                  disabled={isProcessing}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailReviewTile;
