import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle, Clock, XCircle, Loader2 } from "lucide-react";

interface AgentRun {
  id: string;
  agent_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  actions_taken: any;
}

interface AgentAction {
  id: string;
  agent_type: string;
  action_type: string;
  status: string;
  created_at: string;
  data: any;
}

const AgentActivityTile = () => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    
    const runsChannel = supabase
      .channel('agent-runs-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agent_runs' 
      }, () => fetchActivity())
      .subscribe();

    const actionsChannel = supabase
      .channel('agent-actions-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agent_actions' 
      }, () => fetchActivity())
      .subscribe();

    return () => {
      supabase.removeChannel(runsChannel);
      supabase.removeChannel(actionsChannel);
    };
  }, []);

  const fetchActivity = async () => {
    setIsLoading(true);
    try {
      const [runsData, actionsData] = await Promise.all([
        supabase
          .from('agent_runs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(5),
        supabase
          .from('agent_actions')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      if (runsData.data) setRuns(runsData.data);
      if (actionsData.data) setActions(actionsData.data);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: "bg-success/10 text-success",
      running: "bg-primary/10 text-primary",
      failed: "bg-destructive/10 text-destructive",
      pending: "bg-warning/10 text-warning",
      approved: "bg-success/10 text-success"
    };
    return colors[status as keyof typeof colors] || "bg-muted text-muted-foreground";
  };

  const formatAgentType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="glass-tile gradient-success p-3 hover-scale h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Agent Activity</h2>
        {runs.some(r => r.status === 'running') && (
          <Badge className="bg-primary/10 text-primary ml-auto">Active</Badge>
        )}
      </div>
      
      <div className="space-y-3 overflow-auto custom-scrollbar flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">Recent Runs</h3>
              {runs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No agent runs yet</p>
              ) : (
                runs.map((run) => (
                  <Card
                    key={run.id}
                    className="p-3 bg-white/60 border-white/40 hover:bg-white/80 transition-all mb-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {getStatusIcon(run.status)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {formatAgentType(run.agent_type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(run.started_at)}
                          </p>
                          {run.actions_taken && Array.isArray(run.actions_taken) && run.actions_taken.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {run.actions_taken.length} action{run.actions_taken.length !== 1 ? 's' : ''} taken
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge className={`${getStatusBadge(run.status)} text-xs`}>
                        {run.status}
                      </Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {actions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">
                  Pending Approvals ({actions.length})
                </h3>
                {actions.map((action) => (
                  <Card
                    key={action.id}
                    className="p-3 bg-warning/10 border-warning/40 hover:bg-warning/20 transition-all mb-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {formatAgentType(action.action_type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatAgentType(action.agent_type)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimeAgo(action.created_at)}
                        </p>
                      </div>
                      <Badge className={`${getStatusBadge(action.status)} text-xs`}>
                        Needs Review
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AgentActivityTile;
