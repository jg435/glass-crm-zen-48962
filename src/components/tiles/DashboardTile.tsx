import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Calendar, DollarSign, Zap, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LeadSearchCustomizer } from "@/components/LeadSearchCustomizer";

const DashboardTile = () => {
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeDeals: 0,
    upcomingFollowups: 0,
    emailsSent: 0
  });
  const [loading, setLoading] = useState(false);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [leadsRes, dealsRes, followupsRes, emailsRes] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).in('status', ['qualified', 'proposal', 'negotiation']),
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('next_followup_at', 'is', null),
      supabase.from('email_campaigns').select('id', { count: 'exact', head: true }).not('sent_at', 'is', null)
    ]);

    setStats({
      totalLeads: leadsRes.count || 0,
      activeDeals: dealsRes.count || 0,
      upcomingFollowups: followupsRes.count || 0,
      emailsSent: emailsRes.count || 0
    });
  };

  const handleFindLeads = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('lead-generation-agent');

      if (error) throw error;

      toast.success(`Found ${data.leadsInserted || 0} new leads!`);
      fetchStats(); // Refresh stats
    } catch (error: any) {
      console.error('Lead generation failed:', error);
      toast.error(error.message || "Failed to generate leads");
    } finally {
      setLoading(false);
    }
  };

  const kpis = [
    { label: "Total Leads / Contacts", value: stats.totalLeads.toString(), icon: Users, color: "text-primary" },
    { label: "Active Deals", value: stats.activeDeals.toString(), icon: TrendingUp, color: "text-success" },
    { label: "Upcoming Follow-ups", value: stats.upcomingFollowups.toString(), icon: Calendar, color: "text-warning" },
    { label: "Emails Sent", value: stats.emailsSent.toString(), icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="glass-tile gradient-dashboard p-4 hover-scale h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleFindLeads} 
            disabled={loading}
            variant="default"
            size="sm"
            className="gap-2"
          >
            <Zap className="h-4 w-4" />
            {loading ? "Finding..." : "Find Leads"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowCustomizer(true)}
            title="Customize Lead Search"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-3 bg-white/60 border-white/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                <p className="text-xl font-bold">{kpi.value}</p>
              </div>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1">
        <Card className="p-3 bg-white/60 border-white/40">
          <h3 className="text-xs font-medium mb-2">Sales Funnel</h3>
          <div className="space-y-1.5">
            {[
              { stage: "Lead", value: 60 },
              { stage: "Qualified", value: 45 },
              { stage: "Proposal", value: 30 },
            ].map((stage) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span>{stage.stage}</span>
                  <span>{stage.value}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${stage.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-3 bg-white/60 border-white/40">
          <h3 className="text-xs font-medium mb-2">Revenue</h3>
          <div className="space-y-2">
            {[
              { stage: "Discovery", amount: "$120K" },
              { stage: "Proposal", amount: "$180K" },
              { stage: "Negotiation", amount: "$187K" },
            ].map((stage) => (
              <div key={stage.stage} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{stage.stage}</span>
                <span className="text-sm font-semibold">{stage.amount}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <LeadSearchCustomizer open={showCustomizer} onOpenChange={setShowCustomizer} />
    </div>
  );
};

export default DashboardTile;
