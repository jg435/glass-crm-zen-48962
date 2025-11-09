import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Globe, Upload } from "lucide-react";

interface LeadGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LeadGenerationModal = ({ open, onOpenChange }: LeadGenerationModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'scrape' | 'manual'>('scrape');
  const { toast } = useToast();

  // Scrape mode state
  const [url, setUrl] = useState("");
  const [industry, setIndustry] = useState("");

  // Manual mode state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const handleScrape = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a website URL",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-leads', {
        body: { url: url.trim(), industry: industry.trim() }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead generated successfully from website",
      });
      
      setUrl("");
      setIndustry("");
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating lead:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate lead",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualAdd = async () => {
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.from('leads').insert({
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        phone: phone.trim() || null,
        industry: industry.trim() || null,
        notes: notes.trim() || null,
        source: 'manual',
        status: 'new',
        lead_score: 50
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Lead added successfully",
      });
      
      setName("");
      setEmail("");
      setCompany("");
      setPhone("");
      setIndustry("");
      setNotes("");
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding lead:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add lead",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-tile max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Scrape a website or manually add lead information
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant={mode === 'scrape' ? 'default' : 'outline'}
            onClick={() => setMode('scrape')}
            className="flex-1 rounded-xl"
          >
            <Globe className="h-4 w-4 mr-2" />
            Scrape Website
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => setMode('manual')}
            className="flex-1 rounded-xl"
          >
            <Upload className="h-4 w-4 mr-2" />
            Manual Entry
          </Button>
        </div>

        {mode === 'scrape' ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="url">Website URL</Label>
              <Input
                id="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry (Optional)</Label>
              <Input
                id="industry"
                placeholder="e.g., Technology, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleScrape}
                className="rounded-xl"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Lead
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="Acme Inc"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="manual-industry">Industry</Label>
              <Input
                id="manual-industry"
                placeholder="e.g., Technology, Healthcare"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional information about this lead..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl min-h-[100px]"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualAdd}
                className="rounded-xl"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Lead
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeadGenerationModal;
