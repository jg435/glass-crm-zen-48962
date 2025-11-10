import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Users, Calendar, DollarSign, Zap, Settings, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LeadSearchCustomizer } from "@/components/LeadSearchCustomizer";

const ExpandedDashboard = () => {
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
      toast.success('Leads refreshed successfully!');
    } catch (error: any) {
      console.error('Refresh failed:', error);
      toast.error(error.message || 'Failed to refresh leads');
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
      fetchStats();
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

  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Never';
    const date = new Date(lastUpdated);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Dashboard Overview</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Last updated: {formatLastUpdated()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
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
              onClick={() => setShowCustomizer(true)}
              title="Customize Lead Search"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">{kpi.label}</p>
                  <p className="text-4xl font-bold">{kpi.value}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-6">Sales Funnel</h3>
            <div className="space-y-6">
              {[
                { stage: "Lead", value: 60, count: Math.floor(stats.totalLeads * 0.6) },
                { stage: "Qualified", value: 45, count: Math.floor(stats.totalLeads * 0.45) },
                { stage: "Proposal", value: 30, count: Math.floor(stats.totalLeads * 0.3) },
                { stage: "Negotiation", value: 15, count: Math.floor(stats.totalLeads * 0.15) },
              ].map((stage) => (
                <div key={stage.stage}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="text-muted-foreground">{stage.count} leads ({stage.value}%)</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${stage.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-xl font-semibold mb-6">Revenue Pipeline</h3>
            <div className="space-y-4">
              {[
                { stage: "Discovery", amount: "$120K", deals: 8 },
                { stage: "Proposal", amount: "$180K", deals: 5 },
                { stage: "Negotiation", amount: "$187K", deals: 3 },
                { stage: "Closed Won", amount: "$250K", deals: 4 },
              ].map((stage) => (
                <div key={stage.stage} className="flex justify-between items-center p-4 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">{stage.stage}</span>
                    <p className="text-xs text-muted-foreground mt-1">{stage.deals} deals</p>
                  </div>
                  <span className="text-xl font-bold text-primary">{stage.amount}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <LeadSearchCustomizer open={showCustomizer} onOpenChange={setShowCustomizer} />
    </div>
  );
};

export default ExpandedDashboard;