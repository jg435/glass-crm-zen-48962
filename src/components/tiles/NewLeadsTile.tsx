import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  lead_score: number;
  status: string;
}

const NewLeadsTile = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchNewLeads();

    const channel = supabase
      .channel('new-leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchNewLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNewLeads = async () => {
    const { data, count } = await supabase
      .from('leads')
      .select('id, name, company, email, lead_score, status', { count: 'exact' })
      .eq('status', 'new')
      .order('lead_score', { ascending: false });

    setLeads(data || []);
    setTotalCount(count || 0);
  };

  const handleApproveOutreach = async (leadId: string, leadName: string) => {
    try {
      // Update lead status to "Contacted"
      await supabase
        .from('leads')
        .update({ status: 'contacted' })
        .eq('id', leadId);

      toast({
        title: "Outreach Approved",
        description: `${leadName} moved to contacted. AI will draft outreach email.`,
      });

      fetchNewLeads();
    } catch (error) {
      console.error('Error approving outreach:', error);
      toast({
        title: "Error",
        description: "Failed to approve outreach",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="glass-tile gradient-contacts p-3 hover-scale h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">New Leads</h2>
        {totalCount > 0 && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
            {totalCount}
          </span>
        )}
      </div>

      <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 p-1">
        {leads.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No new leads to review
          </p>
        ) : (
          leads.map((lead) => (
            <Card
              key={lead.id}
              className="p-3 bg-white/60 border-white/40 hover:bg-white/80 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{lead.name}</h4>
                  <p className="text-xs text-muted-foreground mb-1">
                    {lead.company || 'No company'}
                  </p>
                  {lead.email && (
                    <p className="text-xs text-muted-foreground mb-2">
                      {lead.email}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      Score: {lead.lead_score}%
                    </Badge>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleApproveOutreach(lead.id, lead.name)}
                  className="flex-shrink-0"
                >
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Approve
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default NewLeadsTile;
