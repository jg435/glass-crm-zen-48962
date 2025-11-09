import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Video, Bot, User, AlertTriangle, Loader2, ExternalLink, Calendar } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import GeminiLiveVoice from "./GeminiLiveVoice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ActiveMeeting {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
  agent_joined_at: string | null;
  manager_joined_at: string | null;
  ai_agent_confidence_score: number | null;
  manager_alert_triggered: boolean;
  manager_alert_reason: string | null;
  conversation_summary: string | null;
  google_meet_link: string | null;
  leads: {
    name: string;
    company: string | null;
  };
}

const ActiveMeetingsView = () => {
  const [meetings, setMeetings] = useState<ActiveMeeting[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeLiveCall, setActiveLiveCall] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchActiveMeetings();
    
    const channel = supabase
      .channel('meetings-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'meetings' 
      }, () => fetchActiveMeetings())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveMeetings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('meetings')
        .select('*, leads(name, company)')
        .in('status', ['prepared', 'in_progress', 'scheduled'])
        .gte('scheduled_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      setMeetings(data || []);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinMeeting = async (meetingId: string) => {
    try {
      await supabase
        .from('meetings')
        .update({ 
          manager_joined_at: new Date().toISOString(),
          status: 'in_progress'
        })
        .eq('id', meetingId);

      toast({
        title: "Joined Meeting",
        description: "You've been added to the meeting",
      });
    } catch (error) {
      console.error('Error joining meeting:', error);
      toast({
        title: "Error",
        description: "Failed to join meeting",
        variant: "destructive"
      });
    }
  };

  const syncWithGoogleCalendar = async (meetingId: string) => {
    try {
      toast({
        title: "Syncing with Google Calendar",
        description: "Creating calendar event...",
      });

      // First get auth URL
      const { data: authData } = await supabase.functions.invoke('google-calendar-sync', {
        body: { action: 'get_auth_url' }
      });

      if (authData?.authUrl) {
        // Open Google auth in new window
        const authWindow = window.open(authData.authUrl, '_blank', 'width=600,height=600');
        
        // In production, you'd handle the OAuth callback properly
        toast({
          title: "Authorize Google Calendar",
          description: "Please authorize in the new window",
        });
      }
    } catch (error) {
      console.error('Error syncing calendar:', error);
      toast({
        title: "Error",
        description: "Failed to sync with Google Calendar",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      scheduled: "bg-primary/10 text-primary",
      prepared: "bg-warning/10 text-warning",
      in_progress: "bg-success/10 text-success animate-pulse",
      completed: "bg-muted text-muted-foreground"
    };
    return colors[status as keyof typeof colors] || "bg-muted text-muted-foreground";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No active meetings</p>
        <p className="text-sm">Scheduled meetings will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Active Meetings ({meetings.length})</h3>
      </div>

      {meetings.map((meeting) => (
        <Card key={meeting.id} className={`p-4 ${meeting.manager_alert_triggered ? 'border-destructive border-2' : ''}`}>
          {meeting.manager_alert_triggered && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-3 flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-destructive text-sm">Manager Attention Needed</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {meeting.manager_alert_reason || 'AI agent needs assistance'}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-semibold">{meeting.title}</h4>
              <p className="text-sm text-muted-foreground">
                {meeting.leads.name}
                {meeting.leads.company && ` - ${meeting.leads.company}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(meeting.scheduled_at).toLocaleString()}
              </p>
            </div>
            <Badge className={getStatusBadge(meeting.status)}>
              {meeting.status.replace('_', ' ')}
            </Badge>
          </div>

          {meeting.ai_agent_confidence_score !== null && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">AI Confidence</span>
                <span className="text-xs font-semibold">
                  {(meeting.ai_agent_confidence_score * 100).toFixed(0)}%
                </span>
              </div>
              <Progress 
                value={meeting.ai_agent_confidence_score * 100} 
                className="h-2"
              />
            </div>
          )}

          <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Bot className="h-4 w-4" />
              <span>{meeting.agent_joined_at ? 'AI Joined' : 'AI Standby'}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="h-4 w-4" />
              <span>{meeting.manager_joined_at ? 'You Joined' : 'Not Joined'}</span>
            </div>
          </div>

          {meeting.conversation_summary && (
            <div className="bg-muted/30 rounded-lg p-3 mb-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Summary:</p>
              <p className="text-sm">{meeting.conversation_summary}</p>
            </div>
          )}

          {meeting.google_meet_link && (
            <div className="mb-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(meeting.google_meet_link!, '_blank')}
                className="flex-1"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Meeting Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncWithGoogleCalendar(meeting.id)}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Sync Calendar
              </Button>
            </div>
          )}

          {meeting.status === 'in_progress' && !meeting.manager_joined_at && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleJoinMeeting(meeting.id)}
                className="flex-1"
              >
                <Video className="h-4 w-4 mr-2" />
                Join Meeting
              </Button>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => setActiveLiveCall(meeting.id)}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    Join Live Call
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Live Voice Call with {meeting.leads.name}</DialogTitle>
                    <DialogDescription>
                      Real-time voice conversation powered by Gemini Live
                    </DialogDescription>
                  </DialogHeader>
                  {activeLiveCall === meeting.id && (
                    <GeminiLiveVoice
                      meetingId={meeting.id}
                      leadName={meeting.leads.name}
                      onCallEnd={() => {
                        setActiveLiveCall(null);
                        fetchActiveMeetings();
                      }}
                    />
                  )}
                </DialogContent>
              </Dialog>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};

export default ActiveMeetingsView;
