import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Task {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  is_complete: boolean;
  deal_id: string | null;
}

const TasksTile = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    const { data, count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('is_complete', false)
      .order('due_date', { ascending: true, nullsFirst: false });

    setTasks(data || []);
    setTotalCount(count || 0);
  };

  const toggleTask = async (taskId: string, currentStatus: boolean) => {
    await supabase
      .from('tasks')
      .update({ is_complete: !currentStatus })
      .eq('id', taskId);
    fetchTasks();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-destructive text-destructive-foreground';
      case 'medium':
        return 'bg-warning/80 text-warning-foreground';
      case 'low':
        return 'bg-secondary text-secondary-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatDueDate = (date: string | null) => {
    if (!date) return 'No due date';
    const dueDate = new Date(date);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dueDate.toDateString() === now.toDateString()) {
      return 'Due Today';
    } else if (dueDate.toDateString() === tomorrow.toDateString()) {
      return 'Due Tomorrow';
    } else {
      return `Due ${formatDistanceToNow(dueDate, { addSuffix: true })}`;
    }
  };

  return (
    <div className="glass-tile gradient-calendar p-3 hover-scale h-[400px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">My Tasks</h2>
        {totalCount > 0 && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full font-medium">
            {totalCount}
          </span>
        )}
      </div>

      <div className="space-y-2 overflow-y-auto custom-scrollbar flex-1 p-1">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            All tasks completed! 🎉
          </p>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              className="p-3 bg-white/60 border-white/40 hover:bg-white/80 transition-all"
            >
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={task.is_complete}
                  onCheckedChange={() => toggleTask(task.id, task.is_complete)}
                  className="mt-0.5"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{task.title}</p>
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDueDate(task.due_date)}
                  </p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TasksTile;
