import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AIAssistant from "@/components/AIAssistant";

interface Contact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  lead_score: number;
  industry: string | null;
  created_at: string;
  last_contacted_at: string | null;
}

const ExpandedContacts = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  useEffect(() => {
    fetchContacts();
    fetchLastUpdated();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(contacts);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredContacts(
        contacts.filter(contact =>
          contact.name.toLowerCase().includes(query) ||
          contact.company?.toLowerCase().includes(query) ||
          contact.email?.toLowerCase().includes(query) ||
          contact.industry?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, contacts]);

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
    const { data } = await supabase
      .from('leads')
      .select('*')
      .order('lead_score', { ascending: false });
    
    if (data) {
      const uniqueContacts = data.reduce((acc: Contact[], current) => {
        const existingIndex = acc.findIndex(c => c.name.toLowerCase() === current.name.toLowerCase());
        if (existingIndex === -1) {
          acc.push(current);
        } else if (current.lead_score > acc[existingIndex].lead_score) {
          acc[existingIndex] = current;
        }
        return acc;
      }, []);
      
      setContacts(uniqueContacts);
      setFilteredContacts(uniqueContacts);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('refresh-leads');
      if (error) throw error;
      
      await fetchContacts();
      await fetchLastUpdated();
      toast.success('Contacts refreshed successfully!');
    } catch (error: any) {
      console.error('Refresh failed:', error);
      toast.error(error.message || 'Failed to refresh contacts');
    } finally {
      setRefreshing(false);
    }
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
              <h1 className="text-3xl font-bold">All Contacts</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredContacts.length} contacts • Last updated: {formatLastUpdated()}
              </p>
            </div>
          </div>
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
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts by name, company, email, or industry..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <Card
              key={contact.id}
              onClick={() => navigate(`/lead/${contact.id}`)}
              className="p-6 hover:bg-accent/50 transition-all cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{contact.name}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.company || contact.industry || 'Unknown'}
                  </p>
                </div>
                <Badge className={`${getScoreColor(contact.lead_score)} ml-2`}>
                  {getScoreLabel(contact.lead_score)}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                {contact.email && (
                  <p className="text-muted-foreground truncate">
                    📧 {contact.email}
                  </p>
                )}
                {contact.phone && (
                  <p className="text-muted-foreground">
                    📱 {contact.phone}
                  </p>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{contact.status}</span>
                  </span>
                  <span className="text-xs font-semibold text-primary">
                    Score: {contact.lead_score}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredContacts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No contacts found matching your search.</p>
          </div>
        )}
      </div>
      
      <AIAssistant 
        onNavigateToHome={() => navigate('/')}
        onNavigateToDashboard={() => navigate('/dashboard')}
        onNavigateToContacts={() => navigate('/contacts')}
        onNavigateToDeals={() => navigate('/deals')}
        onNavigateToLead={(leadId) => navigate(`/lead/${leadId}`)}
      />
    </div>
  );
};

export default ExpandedContacts;