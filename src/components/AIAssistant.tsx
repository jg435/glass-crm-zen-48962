import { useState, useEffect, useRef } from "react";
import { Mic, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WakeWordDetector } from "@/utils/WakeWordDetection";
import { fillFormFields, clickDialogButton, type FormFillAction } from "@/utils/form-filler";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type AssistantState = 'listening-wake' | 'active' | 'processing';

interface HighlightedTile {
  id: string;
  name: string;
}

interface AIAssistantProps {
  onOpenSettings?: () => void;
  onOpenLeadGen?: () => void;
  onOpenEmails?: () => void;
  onOpenMeeting?: () => void;
  onNavigateToLead?: (leadId: string) => void;
}

interface PendingSubmission {
  formType: string;
  summary: string;
}

const AIAssistant = ({ 
  onOpenSettings, 
  onOpenLeadGen, 
  onOpenEmails, 
  onOpenMeeting,
  onNavigateToLead 
}: AIAssistantProps) => {
  const [isActive, setIsActive] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [assistantState, setAssistantState] = useState<AssistantState>('listening-wake');
  const [highlightedTile, setHighlightedTile] = useState<HighlightedTile | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
  const [pendingSubmission, setPendingSubmission] = useState<PendingSubmission | null>(null);
  const { toast } = useToast();
  const wakeWordDetectorRef = useRef<WakeWordDetector | null>(null);
  const queryRecognitionRef = useRef<any>(null);
  const isProcessingRef = useRef(false);

  const startWakeWordDetection = () => {
    if (wakeWordDetectorRef.current || isProcessingRef.current) return;
    
    try {
      console.log('Starting wake word detection...');
      
      const handleEndCommand = () => {
        console.log('End CRM command detected via wake word detector');
        setIsActive(false);
        setCurrentMessage("");
        setUserQuery("");
        setHighlightedTile(null);
        setConversationHistory([]);
        isProcessingRef.current = false;
        if (wakeWordDetectorRef.current) {
          wakeWordDetectorRef.current.stop();
          wakeWordDetectorRef.current = null;
        }
        if (queryRecognitionRef.current) {
          queryRecognitionRef.current.stop();
          queryRecognitionRef.current = null;
        }
      };
      
      wakeWordDetectorRef.current = new WakeWordDetector(() => {
        console.log('Wake word "Hey CRM" detected - listening for query');
        isProcessingRef.current = true;
        setAssistantState('active');
        setIsActive(true);
        setUserQuery("");
        setCurrentMessage("");
        
        // Stop wake word detection while processing query
        if (wakeWordDetectorRef.current) {
          wakeWordDetectorRef.current.stop();
          wakeWordDetectorRef.current = null;
        }
        
        startQueryRecognition();
      }, handleEndCommand);
      
      wakeWordDetectorRef.current.start();
      setAssistantState('listening-wake');
    } catch (error) {
      console.error('Error starting wake word detection:', error);
      toast({
        title: "Error",
        description: "Voice activation not supported in your browser",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    // Start listening for wake word immediately on mount
    startWakeWordDetection();

    return () => {
      if (wakeWordDetectorRef.current) {
        wakeWordDetectorRef.current.stop();
        wakeWordDetectorRef.current = null;
      }
      if (queryRecognitionRef.current) {
        queryRecognitionRef.current.stop();
        queryRecognitionRef.current = null;
      }
    };
  }, []);

  const startQueryRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast({
        title: "Error",
        description: "Speech recognition not supported",
        variant: "destructive"
      });
      handleDismiss();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log('Query:', transcript);
      
      // Check for "End CRM" command
      if (transcript.toLowerCase().includes('end crm')) {
        console.log('End CRM detected in query');
        if (queryRecognitionRef.current) {
          queryRecognitionRef.current.stop();
          queryRecognitionRef.current = null;
        }
        await handleQuery(transcript);
        return;
      }
      
      if (event.results[0].isFinal) {
        setUserQuery(transcript);
        if (queryRecognitionRef.current) {
          queryRecognitionRef.current.stop();
          queryRecognitionRef.current = null;
        }
        await handleQuery(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      handleDismiss();
    };

    recognition.onend = () => {
      console.log('Query recognition ended');
    };

    queryRecognitionRef.current = recognition;
    recognition.start();
  };

  const handleQuery = async (query: string) => {
    setAssistantState('processing');

    // Check for "End CRM" command
    if (query.toLowerCase().includes('end crm')) {
      setCurrentMessage("Goodbye! Say 'Hey CRM' anytime you need me.");
      setPendingSubmission(null);
      setTimeout(() => {
        setIsActive(false);
        setCurrentMessage("");
        setUserQuery("");
        setHighlightedTile(null);
        setConversationHistory([]);
        isProcessingRef.current = false;
        setAssistantState('listening-wake');
        setTimeout(() => startWakeWordDetection(), 500);
      }, 2000);
      return;
    }

    // Handle form submission confirmation
    if (pendingSubmission) {
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('yes') || lowerQuery.includes('confirm') || lowerQuery.includes('submit')) {
        const { submitCurrentForm } = await import('@/utils/form-filler');
        const success = submitCurrentForm(pendingSubmission.formType);
        
        if (success) {
          setCurrentMessage("Form submitted successfully!");
          setPendingSubmission(null);
          
          setTimeout(() => {
            setIsActive(false);
            setCurrentMessage("");
            setUserQuery("");
            setHighlightedTile(null);
            isProcessingRef.current = false;
            setAssistantState('listening-wake');
            setTimeout(() => startWakeWordDetection(), 500);
          }, 2000);
        } else {
          setCurrentMessage("Failed to submit form. Please try manually.");
          setPendingSubmission(null);
          setTimeout(() => {
            startQueryRecognition();
          }, 2000);
        }
        return;
      } else if (lowerQuery.includes('no') || lowerQuery.includes('cancel')) {
        setCurrentMessage("Form submission cancelled.");
        setPendingSubmission(null);
        setTimeout(() => {
          startQueryRecognition();
        }, 2000);
        return;
      }
    }

    try {
      // Add user message to history
      const userMessage: Message = { role: 'user', content: query };
      const newHistory = [...conversationHistory, userMessage];

      const { data, error } = await supabase.functions.invoke('voice-assistant', {
        body: { 
          message: query,
          conversationHistory: newHistory.map(m => ({
            role: m.role,
            parts: [{ text: m.content }]
          }))
        }
      });

      if (error) throw error;

      // Handle UI actions from response
      if (data.actions) {
        for (const action of data.actions) {
          switch (action.type) {
            case 'open_settings':
              onOpenSettings?.();
              break;
            case 'open_lead_generation':
              onOpenLeadGen?.();
              break;
            case 'open_emails':
              onOpenEmails?.();
              break;
            case 'open_meeting_scheduler':
              onOpenMeeting?.();
              break;
            case 'navigate_to_lead':
              if (action.leadId) {
                onNavigateToLead?.(action.leadId);
              }
              break;
            case 'fill_form':
              await handleFormFill(action as FormFillAction & { leadId?: string });
              break;
            case 'submit_form':
              await handleFormSubmit(action.formType, action.requiresConfirmation);
              break;
          }
        }
      }

      // Add assistant message to history
      const assistantMessage: Message = { role: 'assistant', content: data.message };
      const updatedHistory = [...newHistory, assistantMessage];
      setConversationHistory(updatedHistory);
      setCurrentMessage(data.message);
      
      // Determine which tile to highlight based on the query
      const lowerQuery = query.toLowerCase();
      if (lowerQuery.includes('lead') || lowerQuery.includes('contact')) {
        setHighlightedTile({ id: 'contacts', name: 'Contacts' });
      } else if (lowerQuery.includes('deal') || lowerQuery.includes('proposal')) {
        setHighlightedTile({ id: 'deals', name: 'Deals' });
      } else if (lowerQuery.includes('follow') || lowerQuery.includes('followup')) {
        setHighlightedTile({ id: 'followups', name: 'Follow-ups' });
      } else if (lowerQuery.includes('task') || lowerQuery.includes('today') || lowerQuery.includes('remind')) {
        setHighlightedTile({ id: 'tasks', name: 'Tasks' });
      } else if (lowerQuery.includes('meeting') || lowerQuery.includes('calendar')) {
        setHighlightedTile({ id: 'calendar', name: 'Calendar' });
      } else if (lowerQuery.includes('dashboard') || lowerQuery.includes('overview')) {
        setHighlightedTile({ id: 'dashboard', name: 'Dashboard' });
      } else if (lowerQuery.includes('email') || lowerQuery.includes('draft') || lowerQuery.includes('review')) {
        setHighlightedTile({ id: 'email-review', name: 'Emails for Review' });
      }

      console.log('Response received, will hide overlay to show tile');
      
      // Show response for 4 seconds, then hide overlay to show tile
      setTimeout(() => {
        setIsActive(false);
        console.log('Overlay hidden, showing highlighted tile');
        
        // After 5 seconds of showing the tile, bring overlay back with conversation history
        setTimeout(() => {
          setIsActive(true);
          setUserQuery(""); // Clear current query for next input
          setCurrentMessage(""); // Clear current message but keep history
          console.log('Overlay back, ready for next command');
          
          // Restart query recognition for follow-up
          startQueryRecognition();
        }, 5000);
      }, 4000);
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: "Error",
        description: "Failed to get response from AI assistant",
        variant: "destructive"
      });
      handleDismiss();
    }
  };

  const handleFormFill = async (action: FormFillAction & { leadId?: string }) => {
    console.log('Form fill action:', action);
    
    try {
      // Navigate to the lead first if needed
      if (action.leadId && action.formType === 'lead_edit') {
        onNavigateToLead?.(action.leadId);
        // Wait for navigation and page to render
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else if (action.formType === 'meeting_scheduler') {
        onOpenMeeting?.();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Wait a bit more for dialog to open
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fill the form fields
      const success = fillFormFields(action.formType, action.data);
      
      if (success) {
        toast({
          title: "Form Auto-Filled",
          description: `Filled ${Object.keys(action.data).length} field(s) based on your voice input`,
        });
      } else {
        toast({
          title: "Partial Fill",
          description: "Some fields couldn't be filled automatically",
          variant: "destructive"
        });
      }

      // If meeting scheduler and we have a leadId, select it
      if (action.formType === 'meeting_scheduler' && action.leadId) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const selectTrigger = document.querySelector('[role="combobox"]') as HTMLElement;
        if (selectTrigger) {
          selectTrigger.click();
          await new Promise(resolve => setTimeout(resolve, 200));
          const options = Array.from(document.querySelectorAll('[role="option"]'));
          const leadOption = options.find(opt => 
            opt.getAttribute('data-value') === action.leadId
          ) as HTMLElement;
          if (leadOption) leadOption.click();
        }
      }
    } catch (error) {
      console.error('Error in form fill:', error);
      toast({
        title: "Error",
        description: "Failed to auto-fill form",
        variant: "destructive"
      });
    }
  };

  const handleFormSubmit = async (formType: string, requiresConfirmation: boolean = true) => {
    console.log('Form submit action:', formType, 'requires confirmation:', requiresConfirmation);
    
    try {
      if (requiresConfirmation) {
        const { getFormSummary } = await import('@/utils/form-filler');
        const summary = getFormSummary(formType);
        
        if (summary) {
          setPendingSubmission({ formType, summary });
          setCurrentMessage(`Ready to submit. Current values: ${summary}. Say "yes" to confirm or "no" to cancel.`);
          
          // Continue listening for confirmation
          setTimeout(() => {
            startQueryRecognition();
          }, 3000);
        } else {
          setCurrentMessage("No form data to submit.");
        }
      } else {
        const { submitCurrentForm } = await import('@/utils/form-filler');
        const success = submitCurrentForm(formType);
        
        if (success) {
          setCurrentMessage("Form submitted successfully!");
          toast({
            title: "Form Submitted",
            description: "Your changes have been saved"
          });
        } else {
          setCurrentMessage("Failed to submit form. Please try manually.");
        }
      }
    } catch (error) {
      console.error('Error in form submit:', error);
      toast({
        title: "Error",
        description: "Failed to submit form",
        variant: "destructive"
      });
    }
  };

  const handleDismiss = () => {
    console.log('Dismissing overlay, restarting wake word detection');
    setIsActive(false);
    setCurrentMessage("");
    setUserQuery("");
    setHighlightedTile(null);
    setPendingSubmission(null);
    isProcessingRef.current = false;
    
    if (queryRecognitionRef.current) {
      queryRecognitionRef.current.stop();
      queryRecognitionRef.current = null;
    }
    
    // Restart wake word detection
    setAssistantState('listening-wake');
    setTimeout(() => {
      startWakeWordDetection();
    }, 500);
  };

  const getStateIndicator = () => {
    switch (assistantState) {
      case 'listening-wake':
        return { color: 'bg-blue-500', text: 'Say "Hey CRM" to activate', pulse: true };
      case 'active':
        return { color: 'bg-green-500', text: 'Listening... (Say "End CRM" to stop)', pulse: true };
      case 'processing':
        return { color: 'bg-yellow-500', text: 'Processing... (Say "End CRM" to stop)', pulse: false };
    }
  };

  const stateIndicator = getStateIndicator();

  return (
    <>
      {/* Status Indicator - Always visible */}
      <div className="fixed top-24 right-6 z-40 glass-tile px-4 py-2 rounded-full">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${stateIndicator.color} ${stateIndicator.pulse ? 'animate-pulse' : ''}`} />
          <span className="text-xs font-medium">{stateIndicator.text}</span>
        </div>
      </div>

      {/* Fullscreen Overlay */}
      {isActive && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="max-w-4xl w-full space-y-6 max-h-screen overflow-y-auto">
              {/* Conversation History */}
              {conversationHistory.length > 0 && (
                <div className="space-y-4">
                  {conversationHistory.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`glass-tile p-6 rounded-2xl animate-in slide-in-from-${msg.role === 'user' ? 'top' : 'bottom'} duration-300`}
                    >
                      {msg.role === 'user' ? (
                        <>
                          <p className="text-sm text-muted-foreground mb-2">You asked:</p>
                          <p className="text-xl font-semibold">{msg.content}</p>
                        </>
                      ) : (
                        <div className="flex items-start gap-4">
                          <div className="shrink-0">
                            <Mic className="h-6 w-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-base leading-relaxed">{msg.content}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Current Query Being Processed */}
              {userQuery && !conversationHistory.find(m => m.content === userQuery) && (
                <div className="glass-tile p-6 rounded-2xl animate-in slide-in-from-top duration-300">
                  <p className="text-sm text-muted-foreground mb-2">You asked:</p>
                  <p className="text-2xl font-semibold">{userQuery}</p>
                </div>
              )}

              {/* Current AI Response Being Generated */}
              {currentMessage && !conversationHistory.find(m => m.content === currentMessage) && (
                <div className="glass-tile gradient-ai p-8 rounded-2xl animate-in slide-in-from-bottom duration-500">
                  <div className="flex items-start gap-4">
                    <div className="shrink-0">
                      <Mic className="h-8 w-8 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-lg leading-relaxed">{currentMessage}</p>
                      {pendingSubmission && (
                        <div className="mt-4 p-4 bg-warning/10 rounded-xl border border-warning/20">
                          <p className="text-sm font-semibold text-warning mb-2">⚠️ Confirmation Required</p>
                          <p className="text-sm opacity-90">Say "yes" to submit or "no" to cancel</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Highlighted Tile Info */}
              {highlightedTile && (
                <div className="glass-tile p-6 rounded-2xl border-2 border-primary animate-in zoom-in duration-300">
                  <p className="text-sm text-muted-foreground mb-2">Relevant section:</p>
                  <p className="text-xl font-semibold text-primary">{highlightedTile.name}</p>
                </div>
              )}

              {/* Processing State */}
              {assistantState === 'processing' && !currentMessage && (
                <div className="glass-tile p-8 rounded-2xl animate-in slide-in-from-bottom duration-300">
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-3 w-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-3 w-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-3 w-3 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Dismiss Button */}
            <Button
              onClick={handleDismiss}
              size="icon"
              variant="ghost"
              className="absolute top-6 right-6 h-12 w-12 rounded-full hover:bg-white/20"
            >
              <X className="h-6 w-6" />
            </Button>
          </div>
        </div>
      )}

      {/* Apply highlight effect to tiles */}
      {highlightedTile && (
        <style>{`
          [data-tile-id="${highlightedTile.id}"] {
            animation: highlight-pulse 2s ease-in-out infinite;
            box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.5);
          }
          @keyframes highlight-pulse {
            0%, 100% { box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.5); }
            50% { box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0.8); }
          }
        `}</style>
      )}
    </>
  );
};

export default AIAssistant;
