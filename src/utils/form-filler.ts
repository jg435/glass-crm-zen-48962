/**
 * Utility to programmatically fill form fields
 */

interface FormFieldData {
  [key: string]: string;
}

export interface FormFillAction {
  type: 'fill_form';
  formType: 'lead_edit' | 'meeting_scheduler' | 'lead_generation';
  data: FormFieldData;
}

/**
 * Fill form fields by finding inputs and setting their values
 */
export const fillFormFields = (formType: string, data: FormFieldData): boolean => {
  try {
    console.log(`Filling ${formType} form with data:`, data);

    // Map of form types to their field selectors
    const formSelectors: Record<string, Record<string, string>> = {
      lead_edit: {
        name: '#name',
        email: '#email',
        phone: '#phone',
        company: '#company',
        industry: '#industry',
        notes: '#notes'
      },
      meeting_scheduler: {
        title: '#title',
        datetime: '#datetime'
      },
      lead_generation: {
        name: 'input[placeholder*="name"]',
        email: 'input[type="email"]',
        company: 'input[placeholder*="company"]'
      }
    };

    const selectors = formSelectors[formType];
    if (!selectors) {
      console.error(`Unknown form type: ${formType}`);
      return false;
    }

    let filledCount = 0;

    // Fill each field
    Object.entries(data).forEach(([fieldName, value]) => {
      const selector = selectors[fieldName];
      if (!selector) return;

      const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
      
      if (element) {
        // Set value
        element.value = value;

        // Trigger events to ensure React state updates
        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });
        element.dispatchEvent(inputEvent);
        element.dispatchEvent(changeEvent);

        // Add visual feedback
        element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 2000);

        filledCount++;
        console.log(`✓ Filled field: ${fieldName} = ${value}`);
      } else {
        console.warn(`Field not found: ${fieldName} (selector: ${selector})`);
      }
    });

    console.log(`Form fill complete: ${filledCount}/${Object.keys(data).length} fields filled`);
    return filledCount > 0;
  } catch (error) {
    console.error('Error filling form:', error);
    return false;
  }
};

/**
 * Click a button in a dialog or form
 */
export const clickDialogButton = (buttonText: string): boolean => {
  try {
    const buttons = Array.from(document.querySelectorAll('button'));
    const button = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes(buttonText.toLowerCase())
    );

    if (button && !button.disabled) {
      button.click();
      console.log(`✓ Clicked button: ${buttonText}`);
      return true;
    }

    console.warn(`Button not found or disabled: ${buttonText}`);
    return false;
  } catch (error) {
    console.error('Error clicking button:', error);
    return false;
  }
};

/**
 * Open a specific dialog/modal
 */
export const openDialog = (dialogType: string): boolean => {
  try {
    console.log(`Opening dialog: ${dialogType}`);

    // Map dialog types to button text or actions
    const dialogTriggers: Record<string, string[]> = {
      lead_edit: ['edit', 'edit lead'],
      meeting_scheduler: ['schedule', 'schedule meeting'],
      lead_generation: ['find leads', 'generate leads']
    };

    const triggers = dialogTriggers[dialogType];
    if (!triggers) {
      console.error(`Unknown dialog type: ${dialogType}`);
      return false;
    }

    // Try to find and click the trigger button
    for (const trigger of triggers) {
      if (clickDialogButton(trigger)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error opening dialog:', error);
    return false;
  }
};
