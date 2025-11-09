export interface TileAction {
  type: 'scroll' | 'click' | 'expand' | 'open-modal';
  selector?: string;
  modalTrigger?: () => void;
}

export interface TileRoute {
  id: string;
  name: string;
  selector: string;
  keywords: string[];
  actions: {
    view?: TileAction;
    interact?: TileAction;
  };
}

export const tileRoutes: TileRoute[] = [
  {
    id: 'dashboard',
    name: 'Dashboard Overview',
    selector: '[data-tile-id="dashboard"]',
    keywords: ['dashboard', 'overview', 'kpi', 'metrics', 'stats', 'performance'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="dashboard"]' },
    }
  },
  {
    id: 'contacts',
    name: 'Contacts',
    selector: '[data-tile-id="contacts"]',
    keywords: ['contacts', 'leads', 'prospects', 'people', 'customers'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="contacts"]' },
      interact: { type: 'click', selector: '[data-tile-id="contacts"] button' },
    }
  },
  {
    id: 'deals',
    name: 'Deals Pipeline',
    selector: '[data-tile-id="deals"]',
    keywords: ['deals', 'pipeline', 'opportunities', 'sales', 'revenue'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="deals"]' },
    }
  },
  {
    id: 'calendar',
    name: 'Calendar',
    selector: '[data-tile-id="calendar"]',
    keywords: ['calendar', 'meetings', 'schedule', 'appointments', 'events'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="calendar"]' },
      interact: { type: 'click', selector: '[data-tile-id="calendar"] button' },
    }
  },
  {
    id: 'email-review',
    name: 'Email Review',
    selector: '[data-tile-id="email-review"]',
    keywords: ['email', 'inbox', 'messages', 'drafts', 'replies'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="email-review"]' },
    }
  },
  {
    id: 'followups',
    name: 'Follow-ups',
    selector: '[data-tile-id="followups"]',
    keywords: ['followup', 'follow-up', 'follow up', 'reminders', 'pending'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="followups"]' },
    }
  },
  {
    id: 'tasks',
    name: 'Today\'s Tasks',
    selector: '[data-tile-id="tasks"]',
    keywords: ['tasks', 'todo', 'to-do', 'action items', 'checklist'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="tasks"]' },
    }
  },
  {
    id: 'agent-activity',
    name: 'Agent Activity',
    selector: '[data-tile-id="agent-activity"]',
    keywords: ['agent', 'activity', 'automation', 'ai activity', 'background tasks'],
    actions: {
      view: { type: 'scroll', selector: '[data-tile-id="agent-activity"]' },
    }
  },
];

export const findTileByQuery = (query: string): TileRoute | undefined => {
  const lowerQuery = query.toLowerCase();
  return tileRoutes.find(tile => 
    tile.keywords.some(keyword => lowerQuery.includes(keyword))
  );
};

export const executeAction = (action: TileAction): boolean => {
  try {
    if (!action.selector) return false;

    const element = document.querySelector(action.selector);
    if (!element) return false;

    switch (action.type) {
      case 'scroll':
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add visual highlight
        element.classList.add('ring-4', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-4', 'ring-primary', 'ring-offset-2');
        }, 2000);
        return true;

      case 'click':
        if (element instanceof HTMLElement) {
          element.click();
          return true;
        }
        return false;

      case 'expand':
        if (element instanceof HTMLElement) {
          const expandButton = element.querySelector('[data-expand]');
          if (expandButton instanceof HTMLElement) {
            expandButton.click();
            return true;
          }
        }
        return false;

      default:
        return false;
    }
  } catch (error) {
    console.error('Error executing action:', error);
    return false;
  }
};
