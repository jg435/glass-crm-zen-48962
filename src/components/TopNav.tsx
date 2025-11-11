import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Settings, Plus, Mail, Calendar, Play, Mic, Bell, Search } from "lucide-react";

interface TopNavProps {
  onSettingsClick: () => void;
  onAddLeadClick: () => void;
  onEmailsClick: () => void;
  onScheduleClick: () => void;
  onMicClick?: () => void;
}

const TopNav = ({ onSettingsClick, onAddLeadClick, onEmailsClick, onScheduleClick, onMicClick }: TopNavProps) => {
  const navigate = useNavigate();
  
  return (
    <nav className="glass-tile sticky top-4 mx-4 mb-6 z-50">
      <div className="px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex-shrink-0">
          <h1 className="text-2xl font-semibold text-foreground">CRM-X</h1>
          <p className="text-sm text-muted-foreground">AI-Powered Sales Co-Pilot</p>
        </div>
        
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search leads, deals, meetings..." 
              className="pl-9 bg-background/50 border-border/50 focus:bg-background"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="default"
            size="sm"
            onClick={onAddLeadClick}
            className="rounded-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Lead
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMicClick}
            className="rounded-full hover:bg-primary/20 hover:text-primary"
            title="Hey CRM Voice Assistant"
          >
            <Mic className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-secondary/50 relative"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onEmailsClick}
            className="rounded-full hover:bg-secondary/50"
            title="Email Campaigns"
          >
            <Mail className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onScheduleClick}
            className="rounded-full hover:bg-secondary/50"
            title="Schedule Meeting"
          >
            <Calendar className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/simulate')}
            className="rounded-full"
            title="Run Meeting Simulation"
          >
            <Play className="h-4 w-4 mr-2" />
            Simulate
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onSettingsClick}
            className="rounded-full hover:bg-secondary/50"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=user" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
