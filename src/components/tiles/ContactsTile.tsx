import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Maximize2 } from "lucide-react";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  company: string | null;
  status: string;
  lead_score: number;
  industry: string | null;
}

const ContactsTile = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
    fetchLastUpdated();
    
    // Subscribe to realtime changes
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'leads' 
      }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const fetchContacts = async () => {
    // Fetch all leads to get count of unique names
    const { data, count } = await supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('lead_score', { ascending: false });
    
    if (data) {
      // Filter for unique names (keep the one with highest lead_score)
      const uniqueContacts = data.reduce((acc: Contact[], current) => {
        const existingIndex = acc.findIndex(c => c.name.toLowerCase() === current.name.toLowerCase());
        if (existingIndex === -1) {
          acc.push(current);
        } else if (current.lead_score > acc[existingIndex].lead_score) {
          acc[existingIndex] = current;
        }
        return acc;
      }, []);
      
      setContacts(uniqueContacts.slice(0, 5));
      setTotalCount(uniqueContacts.length);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('refresh-leads');
      if (error) throw error;
      
      await fetchContacts();
      await fetchLastUpdated();
      toast.success('Contacts refreshed!');
    } catch (error: any) {
      console.error('Refresh failed:', error);
      toast.error(error.message || 'Failed to refresh');
    } finally {
      setRefreshing(false);
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

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-success/10 text-success hover:bg-success/20";
    if (score >= 40) return "bg-warning/10 text-warning hover:bg-warning/20";
    return "bg-muted text-muted-foreground hover:bg-muted";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "High";
    if (score >= 40) return "Medium";
    return "Low";
  };

  return (
    <div className="glass-tile gradient-contacts p-4 hover-scale h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">Contacts</h2>
          <p className="text-xs text-muted-foreground">Updated: {formatLastUpdated()}</p>
        </div>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
              {totalCount}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate('/contacts')}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-2 overflow-auto custom-scrollbar flex-1">
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No contacts yet</p>
        ) : (
          contacts.map((contact) => (
            <Card
              key={contact.id}
              onClick={() => navigate(`/lead/${contact.id}`)}
              className="p-3 bg-white/60 border-white/40 hover:bg-white/80 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{contact.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {contact.company || contact.industry || 'Unknown'}
                  </p>
                </div>
                <Badge className={`${getScoreColor(contact.lead_score)} text-xs`}>
                  {getScoreLabel(contact.lead_score)}
                </Badge>
                <p className="font-semibold text-sm">{contact.status}</p>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactsTile;
