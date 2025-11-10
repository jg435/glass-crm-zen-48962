import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search, LayoutGrid, LayoutList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import AIAssistant from "@/components/AIAssistant";

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

const ExpandedDeals = () => {
  const navigate = useNavigate();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');

  useEffect(() => {
    fetchDeals();

    const channel = supabase
      .channel('deals-expanded')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        fetchDeals();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredDeals(deals);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredDeals(
        deals.filter(deal =>
          deal.name.toLowerCase().includes(query) ||
          deal.leads?.company?.toLowerCase().includes(query) ||
          deal.leads?.name?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, deals]);

  const fetchDeals = async () => {
    const { data } = await supabase
      .from('deals')
      .select('*, leads!deals_associated_contact_id_fkey(company, name)')
      .order('value', { ascending: false });

    setDeals(data || []);
    setFilteredDeals(data || []);
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
      year: 'numeric',
    });
  };

  const DealCard = ({ deal }: { deal: Deal }) => (
    <Card className="p-6 hover:bg-accent/50 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">{deal.name}</h3>
          <p className="text-sm text-muted-foreground">
            {deal.leads?.company || deal.leads?.name || 'No company'}
          </p>
        </div>
        <Badge className={getStageColor(deal.stage)}>
          {stages.find(s => s.id === deal.stage)?.name || deal.stage}
        </Badge>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Win Probability</span>
          <span className="font-semibold">{Math.round((deal.probability || 0) * 100)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-500"
            style={{ width: `${(deal.probability || 0) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-bold text-success text-xl">
          {formatCurrency(deal.value)}
        </span>
        <div className="text-right text-sm">
          <div className="text-muted-foreground">
            Close: {formatDate(deal.close_date)}
          </div>
        </div>
      </div>
    </Card>
  );

  const renderCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredDeals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  );

  const renderKanban = () => (
    <div className="flex gap-6 overflow-x-auto pb-4">
      {stages.map(stage => {
        const stageDeals = filteredDeals.filter(d => d.stage === stage.id);
        const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
        
        return (
          <div key={stage.id} className="min-w-[350px] flex flex-col">
            <div className="mb-4 p-4 bg-card rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{stage.name}</h3>
                <Badge variant="secondary">{stageDeals.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(stageValue)}
              </p>
            </div>
            <div className="space-y-4 flex-1">
              {stageDeals.map(deal => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Deals Pipeline</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredDeals.length} active deals
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="gap-2"
            >
              <LayoutList className="h-4 w-4" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className="gap-2"
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search deals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {viewMode === 'cards' ? renderCards() : renderKanban()}

        {filteredDeals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No deals found matching your search.</p>
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

export default ExpandedDeals;