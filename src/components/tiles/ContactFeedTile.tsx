import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Contact {
  id: string;
  leadName: string;
  dealName: string;
  stage: string;
  lastActivity: string;
}

const ContactFeedTile = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    fetchContacts();

    const channel = supabase
      .channel('contact-feed-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        fetchContacts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchContacts = async () => {
    const { data } = await supabase
      .from('deals')
      .select(`
        id,
        name,
        stage,
        last_activity_at,
        leads!deals_associated_contact_id_fkey(name)
      `)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .order('last_activity_at', { ascending: false })
      .limit(10);

    const formattedContacts = (data || []).map((deal: any) => ({
      id: deal.id,
      leadName: deal.leads?.name || 'Unknown',
      dealName: deal.name,
      stage: deal.stage,
      lastActivity: deal.last_activity_at,
    }));

    setContacts(formattedContacts);
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'prospecting':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'qualified':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      case 'proposal':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/20';
      case 'negotiation':
        return 'bg-purple-500/10 text-purple-700 border-purple-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="glass-tile gradient-contacts p-3 hover-scale h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Contact Feed</h2>
        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
          Active
        </span>
      </div>

      <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 p-1">
        {contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No active contacts
          </p>
        ) : (
          contacts.map((contact) => (
            <Card
              key={contact.id}
              className="p-3 bg-white/60 border-white/40 hover:bg-white/80 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-semibold text-sm mb-1">{contact.leadName}</h4>
                  <p className="text-xs text-muted-foreground mb-2">
                    {contact.dealName}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge className={getStageColor(contact.stage)} variant="outline">
                      {contact.stage}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(contact.lastActivity), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default ContactFeedTile;
