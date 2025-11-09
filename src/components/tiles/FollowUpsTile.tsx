import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FollowUp {
  id: string;
  name: string;
  company: string | null;
  next_followup_at: string | null;
  notes: string | null;
}

const FollowUpsTile = () => {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchFollowUps();

    const channel = supabase
      .channel('followups-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchFollowUps();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFollowUps = async () => {
    const { data, count } = await supabase
      .from('leads')
      .select('id, name, company, next_followup_at, notes', { count: 'exact' })
      .not('next_followup_at', 'is', null)
      .order('next_followup_at', { ascending: true });

    setFollowUps(data?.slice(0, 4) || []);
    setTotalCount(count || 0);
  };

  const handleComplete = async (id: string) => {
    // Clear the follow-up date to mark as complete
    await supabase
      .from('leads')
      .update({ next_followup_at: null })
      .eq('id', id);
    fetchFollowUps();
  };

  const getUrgencyStyles = (date: string | null) => {
    if (!date) return "";
    const daysUntil = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 1) return "border-l-4 border-destructive bg-destructive/5";
    if (daysUntil <= 3) return "border-l-4 border-warning bg-warning/5";
    return "border-l-4 border-success bg-success/5";
  };

  const isHighUrgency = (date: string | null) => {
    if (!date) return false;
    const daysUntil = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil <= 1;
  };

  const getPriorityLevel = (date: string | null) => {
    if (!date) return "low";
    const daysUntil = Math.ceil((new Date(date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 1) return "high";
    if (daysUntil <= 3) return "medium";
    return "low";
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning/10 text-warning";
      default:
        return "bg-secondary text-secondary-foreground";
    }
  };

  return (
    <div className="glass-tile gradient-followups p-4 hover-scale h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Follow-ups</h2>
        {totalCount > 0 && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
            {totalCount}
          </span>
        )}
      </div>
      
      <div className="space-y-3 overflow-auto custom-scrollbar flex-1">
        {followUps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            All caught up! 🎉
          </p>
        ) : (
          followUps.map((followUp) => {
            const priority = getPriorityLevel(followUp.next_followup_at);
            return (
              <Card
                key={followUp.id}
                className={`p-4 bg-white/60 border-white/40 hover:bg-white/80 transition-all ${getUrgencyStyles(followUp.next_followup_at)}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm">{followUp.name}</h4>
                      <Badge className={getPriorityColor(priority)}>
                        {priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {followUp.company}
                    </p>
                    {followUp.notes && (
                      <p className="text-xs">{followUp.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Due: {followUp.next_followup_at 
                        ? new Date(followUp.next_followup_at).toLocaleDateString()
                        : 'Not scheduled'}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleComplete(followUp.id)}
                    className="h-8 w-8 p-0"
                    title="Mark as complete"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FollowUpsTile;