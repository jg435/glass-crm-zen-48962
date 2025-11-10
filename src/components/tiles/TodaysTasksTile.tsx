import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Task {
  id: string;
  title: string;
  scheduled_at: string;
  status: string;
}

const TodaysTasksTile = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data } = await supabase
      .from('meetings')
      .select('id, title, scheduled_at, status')
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at', { ascending: true });

    setTasks(data || []);
  };

  const toggleTask = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'scheduled' : 'completed';
    await supabase
      .from('meetings')
      .update({ status: newStatus })
      .eq('id', id);
    fetchTasks();
  };

  const getPriorityColor = (scheduledAt: string) => {
    const hours = (new Date(scheduledAt).getTime() - new Date().getTime()) / (1000 * 60 * 60);
    if (hours < 2) return "border-l-destructive";
    if (hours < 4) return "border-l-warning";
    return "border-l-success";
  };

  return (
    <div className="glass-tile gradient-ai p-4 hover-scale h-full flex flex-col">
      <h2 className="text-lg font-semibold mb-3">Today's Tasks</h2>
      
      <div className="space-y-2 overflow-auto custom-scrollbar flex-1">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks for today</p>
        ) : tasks.map((task) => (
          <Card
            key={task.id}
            className={`p-3 bg-white/60 border-white/40 border-l-4 ${getPriorityColor(task.scheduled_at)} hover:bg-white/80 transition-all cursor-pointer`}
            onClick={() => toggleTask(task.id, task.status)}
          >
            <div className="flex items-center gap-3">
              {task.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
              )}
              <div className="flex-1">
                <p className={`text-sm ${task.status === 'completed' ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(task.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {tasks.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/30">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{tasks.filter(t => t.status === 'completed').length} of {tasks.length} completed</span>
            <span>{tasks.filter(t => t.status !== 'completed' && getPriorityColor(t.scheduled_at).includes('destructive')).length} high priority</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TodaysTasksTile;
