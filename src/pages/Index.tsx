import { useState } from "react";
import { useNavigate } from "react-router-dom";
import TopNav from "@/components/TopNav";
import DashboardTile from "@/components/tiles/DashboardTile";
import ContactsTile from "@/components/tiles/ContactsTile";
import DealsTile from "@/components/tiles/DealsTile";
import FollowUpsTile from "@/components/tiles/FollowUpsTile";
import CalendarTile from "@/components/tiles/CalendarTile";
import TodaysTasksTile from "@/components/tiles/TodaysTasksTile";
import EmailReviewTile from "@/components/tiles/EmailReviewTile";
import AIAssistant from "@/components/AIAssistant";
import SettingsModal from "@/components/SettingsModal";
import LeadGenerationModal from "@/components/LeadGenerationModal";
import EmailCampaignsView from "@/components/EmailCampaignsView";
import MeetingScheduler from "@/components/MeetingScheduler";
import { useBackgroundImage } from "@/hooks/useBackgroundImage";

const Index = () => {
  const navigate = useNavigate();
  const { backgroundImage, opacity } = useBackgroundImage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [leadGenOpen, setLeadGenOpen] = useState(false);
  const [emailsOpen, setEmailsOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);

  return (
    <div className="min-h-screen pb-6">
      <TopNav
        onSettingsClick={() => setSettingsOpen(true)}
        onAddLeadClick={() => setLeadGenOpen(true)}
        onEmailsClick={() => setEmailsOpen(true)}
        onScheduleClick={() => setMeetingOpen(true)}
      />
      
      <main className="px-4 max-w-[1800px] mx-auto">
        <div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-[calc(100vh-140px)]"
          style={{
            '--tile-opacity': backgroundImage ? opacity : 1,
          } as React.CSSProperties}
        >
          <div 
            className="lg:col-span-2 lg:row-span-2" 
            data-tile-id="dashboard"
          >
            <DashboardTile />
          </div>
          
          <div className="lg:row-span-2" data-tile-id="contacts">
            <ContactsTile />
          </div>
          
          <div data-tile-id="deals">
            <DealsTile />
          </div>
          
          <div data-tile-id="followups">
            <FollowUpsTile />
          </div>
          
          <div data-tile-id="tasks">
            <TodaysTasksTile />
          </div>
          
          <div data-tile-id="calendar">
            <CalendarTile />
          </div>

          <div className="lg:col-span-2" data-tile-id="email-review">
            <EmailReviewTile />
          </div>
        </div>
      </main>

      <AIAssistant 
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenLeadGen={() => setLeadGenOpen(true)}
        onOpenEmails={() => setEmailsOpen(true)}
        onOpenMeeting={() => setMeetingOpen(true)}
        onNavigateToLead={(leadId) => navigate(`/lead/${leadId}`)}
      />
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
      <LeadGenerationModal open={leadGenOpen} onOpenChange={setLeadGenOpen} />
      <EmailCampaignsView open={emailsOpen} onOpenChange={setEmailsOpen} />
      <MeetingScheduler open={meetingOpen} onOpenChange={setMeetingOpen} />
    </div>
  );
};

export default Index;
