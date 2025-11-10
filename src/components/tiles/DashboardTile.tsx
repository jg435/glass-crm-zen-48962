import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Calendar, DollarSign, Zap, Settings, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LeadSearchCustomizer } from "@/components/LeadSearchCustomizer";

const DashboardTile = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeDeals: 0,
    upcomingFollowups: 0,
    emailsSent: 0
  });
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchLastUpdated();
  }, []);

  const fetchLastUpdated = async () => {
    const { data } = await supabase
      .from('ui_state')
      .select('preferences')
      .eq('user_id', '00000000-0000-0000-0000-000000000000')
      .single();

    if (data?.preferences && typeof data.preferences === 'object' && 'last_lead_refresh' in data.preferences) {
      setLastUpdated((data.preferences as { last_lead_refresh?: string }).last_lead_refresh || null);
    }
  };

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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('refresh-leads');
      if (error) throw error;
      
      await fetchStats();
      await fetchLastUpdated();
      toast.success('Leads refreshed!');
    } catch (error: any) {
      console.error('Refresh failed:', error);
      toast.error(error.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
    }
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

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    return `${Math.floor(diffMinutes / 60)}h ago`;
  };

  const kpis = [
    { label: "Total Leads / Contacts", value: stats.totalLeads.toString(), icon: Users, color: "text-primary" },
    { label: "Active Deals", value: stats.activeDeals.toString(), icon: TrendingUp, color: "text-success" },
    { label: "Upcoming Follow-ups", value: stats.upcomingFollowups.toString(), icon: Calendar, color: "text-warning" },
    { label: "Emails Sent", value: stats.emailsSent.toString(), icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div 
      className="glass-tile gradient-dashboard p-3 hover-scale h-full flex flex-col cursor-pointer"
      onClick={() => navigate('/dashboard')}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          <p className="text-xs text-muted-foreground">Updated: {formatLastUpdated()}</p>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            data-action="refresh-leads"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
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
      
      <div className="grid grid-cols-2 gap-2 mb-2">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-2 bg-white/60 border-white/40">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">{kpi.label}</p>
                <p className="text-lg font-bold">{kpi.value}</p>
              </div>
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 flex-1 overflow-auto custom-scrollbar">
        <Card className="p-2 bg-white/60 border-white/40 h-fit">
          <h3 className="text-xs font-medium mb-1.5">Sales Funnel</h3>
          <div className="space-y-1">
            {[
              { stage: "Lead", value: 60 },
              { stage: "Qualified", value: 45 },
              { stage: "Proposal", value: 30 },
            ].map((stage) => (
              <div key={stage.stage}>
                <div className="flex justify-between text-[10px] mb-0.5">
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

        <Card className="p-2 bg-white/60 border-white/40 h-fit">
          <h3 className="text-xs font-medium mb-1.5">Revenue</h3>
          <div className="space-y-1.5">
            {[
              { stage: "Discovery", amount: "$120K" },
              { stage: "Proposal", amount: "$180K" },
              { stage: "Negotiation", amount: "$187K" },
            ].map((stage) => (
              <div key={stage.stage} className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">{stage.stage}</span>
                <span className="text-xs font-semibold">{stage.amount}</span>
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
