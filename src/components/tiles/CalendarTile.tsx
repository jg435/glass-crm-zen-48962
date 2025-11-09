import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from "date-fns";

interface Meeting {
  id: string;
  title: string;
  scheduled_at: string;
  lead_id: string;
}

interface DealEvent {
  id: string;
  name: string;
  close_date: string;
  stage: string;
  value: number;
}

const CalendarTile = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [dealEvents, setDealEvents] = useState<DealEvent[]>([]);
  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([]);
  const [upcomingDeals, setUpcomingDeals] = useState<DealEvent[]>([]);

  useEffect(() => {
    fetchData();

    const meetingsChannel = supabase
      .channel('calendar-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
        fetchData();
      })
      .subscribe();

    const dealsChannel = supabase
      .channel('calendar-deals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(meetingsChannel);
      supabase.removeChannel(dealsChannel);
    };
  }, [currentDate]);

  const fetchData = async () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    // Fetch meetings
    const { data: meetingsData } = await supabase
      .from('meetings')
      .select('*')
      .gte('scheduled_at', monthStart.toISOString())
      .lte('scheduled_at', monthEnd.toISOString())
      .order('scheduled_at', { ascending: true });

    setMeetings(meetingsData || []);

    // Fetch deals with close dates
    const { data: dealsData } = await supabase
      .from('deals')
      .select('id, name, close_date, stage, value')
      .not('close_date', 'is', null)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .gte('close_date', monthStart.toISOString())
      .lte('close_date', monthEnd.toISOString());
    
    setDealEvents(dealsData || []);

    // Get upcoming meetings (next 2)
    const { data: upcomingMeet } = await supabase
      .from('meetings')
      .select('*')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(2);

    setUpcomingMeetings(upcomingMeet || []);

    // Get upcoming deals (next 2)
    const { data: upcomingDeal } = await supabase
      .from('deals')
      .select('id, name, close_date, stage, value')
      .not('close_date', 'is', null)
      .not('stage', 'in', '(closed_won,closed_lost)')
      .gte('close_date', new Date().toISOString())
      .order('close_date', { ascending: true })
      .limit(2);

    setUpcomingDeals(upcomingDeal || []);
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();

  const hasMeeting = (date: Date) => {
    return meetings.some(meeting => 
      isSameDay(new Date(meeting.scheduled_at), date)
    );
  };

  const hasDeal = (date: Date) => {
    return dealEvents.some(deal => 
      isSameDay(new Date(deal.close_date), date)
    );
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  return (
    <div className="glass-tile gradient-calendar p-4 hover-scale h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-3">Calendar</h2>
      
      <Card className="p-3 bg-white/60 border-white/40 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={handlePrevMonth}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <h3 className="font-semibold text-sm">{format(currentDate, 'MMMM yyyy')}</h3>
          <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={handleNextMonth}>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {days.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground">
              {day.slice(0, 1)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-3">
          {Array.from({ length: startDayOfWeek }).map((_, index) => (
            <div key={`empty-${index}`} />
          ))}
          {daysInMonth.map((date) => {
            const isToday = isSameDay(date, today);
            const hasMeetingOnDate = hasMeeting(date);
            const hasDealOnDate = hasDeal(date);
            
            return (
              <button
                key={date.toISOString()}
                className={`
                  aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-all relative
                  ${isToday ? "bg-primary text-primary-foreground" : ""}
                  ${(hasMeetingOnDate || hasDealOnDate) && !isToday ? "bg-primary/10 text-primary" : ""}
                  ${!isToday && !hasMeetingOnDate && !hasDealOnDate ? "hover:bg-muted" : ""}
                `}
              >
                {format(date, 'd')}
                {hasDealOnDate && (
                  <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-white/40 overflow-y-auto custom-scrollbar">
          <h4 className="text-xs font-medium mb-2">Upcoming</h4>
          <div className="space-y-1.5">
            {upcomingMeetings.length === 0 && upcomingDeals.length === 0 ? (
              <p className="text-xs text-muted-foreground">No upcoming events</p>
            ) : (
              <>
                {upcomingMeetings.map((meeting) => (
                  <div key={meeting.id} className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">
                      {format(new Date(meeting.scheduled_at), 'MMM d')}
                    </span>
                    <span className="font-medium truncate ml-2">{meeting.title}</span>
                    <Badge variant="secondary" className="ml-1 text-[10px] h-4">Meet</Badge>
                  </div>
                ))}
                {upcomingDeals.map((deal) => (
                  <div key={deal.id} className="flex justify-between text-xs items-center">
                    <span className="text-muted-foreground">
                      {format(new Date(deal.close_date), 'MMM d')}
                    </span>
                    <span className="font-medium truncate ml-2">{deal.name}</span>
                    <Badge variant="secondary" className="ml-1 text-[10px] h-4">Deal</Badge>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CalendarTile;
