import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LayoutGrid, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  name: string;
  stage: string;
  value: number;
  close_date: string | null;
  probability: number;
  last_activity_at: string;
  leads?: {
    company: string | null;
    name: string | null;
  };
}

type ViewMode = 'cards' | 'kanban';

const stages = [
  { id: 'prospect', name: 'Prospect', color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20' },
  { id: 'qualified', name: 'Qualified', color: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
  { id: 'proposal', name: 'Proposal', color: 'bg-orange-500/10 text-orange-700 border-orange-500/20' },
  { id: 'negotiation', name: 'Negotiation', color: 'bg-purple-500/10 text-purple-700 border-purple-500/20' },
  { id: 'closed_won', name: 'Closed Won', color: 'bg-success text-success-foreground' },
  { id: 'closed_lost', name: 'Closed Lost', color: 'bg-destructive/10 text-destructive border-destructive/20' },
];

const DealsTile = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [newDealIds, setNewDealIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDeals();

    const channel = supabase
      .channel('deals-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'deals' }, (payload) => {
        fetchDeals();
        // Add glow effect for new deals
        setNewDealIds(prev => new Set(prev).add(payload.new.id));
        setTimeout(() => {
          setNewDealIds(prev => {
            const updated = new Set(prev);
            updated.delete(payload.new.id);
            return updated;
          });
        }, 3000);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deals' }, () => {
        fetchDeals();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'deals' }, () => {
        fetchDeals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDeals = async () => {
    const { data, count } = await supabase
      .from('deals')
      .select('*, leads!deals_associated_contact_id_fkey(company, name)', { count: 'exact' })
      .order('value', { ascending: false });

    setDeals(data || []);
    setTotalCount(count || 0);
  };

  const getStageColor = (stage: string) => {
    const stageConfig = stages.find(s => s.id === stage);
    return stageConfig?.color || 'bg-muted';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return `${Math.floor(diffInDays / 7)}w ago`;
  };

  const DealCard = ({ deal, isNew }: { deal: Deal; isNew: boolean }) => (
    <Card 
      className={cn(
        "p-4 bg-white/60 border-white/40 hover:bg-white/80 transition-all",
        isNew && "animate-pulse ring-2 ring-primary/50"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">{deal.name}</h4>
          <p className="text-xs text-muted-foreground">
            {deal.leads?.company || deal.leads?.name || 'No company'}
          </p>
        </div>
        <Badge className={getStageColor(deal.stage)}>
          {stages.find(s => s.id === deal.stage)?.name || deal.stage}
        </Badge>
      </div>
      
      {/* Probability Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Win Probability</span>
          <span className="font-semibold">{Math.round((deal.probability || 0) * 100)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all duration-500"
            style={{ width: `${(deal.probability || 0) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-success text-base">
          {formatCurrency(deal.value)}
        </span>
        <div className="text-right">
          <div className="text-muted-foreground">
            Close: {formatDate(deal.close_date)}
          </div>
          <div className="text-muted-foreground text-[10px]">
            Active {formatTimeAgo(deal.last_activity_at)}
          </div>
        </div>
      </div>
    </Card>
  );

  const renderCards = () => (
    <div className="space-y-3 overflow-auto custom-scrollbar flex-1">
      {deals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No active deals</p>
      ) : deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} isNew={newDealIds.has(deal.id)} />
      ))}
    </div>
  );

  const renderKanban = () => (
    <div className="flex gap-3 overflow-x-auto custom-scrollbar flex-1 pb-2">
      {stages.filter(stage => deals.some(d => d.stage === stage.id)).map(stage => {
        const stageDeals = deals.filter(d => d.stage === stage.id);
        return (
          <div key={stage.id} className="min-w-[280px] flex flex-col">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-sm">{stage.name}</h3>
              <Badge variant="secondary" className="text-xs">
                {stageDeals.length}
              </Badge>
            </div>
            <div className="space-y-2 flex-1">
              {stageDeals.map(deal => (
                <DealCard key={deal.id} deal={deal} isNew={newDealIds.has(deal.id)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="glass-tile gradient-deals p-4 hover-scale h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Deals Pipeline</h2>
          {totalCount > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
              {totalCount}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode('cards')}
          >
            <LayoutList className={cn("h-4 w-4", viewMode === 'cards' && "text-primary")} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className={cn("h-4 w-4", viewMode === 'kanban' && "text-primary")} />
          </Button>
        </div>
      </div>
      
      {viewMode === 'cards' ? renderCards() : renderKanban()}
    </div>
  );
};

export default DealsTile;
