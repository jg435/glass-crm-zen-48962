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
 * Submit the currently open form
 */
export const submitCurrentForm = (formType: string): boolean => {
  try {
    console.log(`Submitting ${formType} form`);

    // Map form types to their submit button text
    const submitButtons: Record<string, string[]> = {
      lead_edit: ['save changes', 'save'],
      meeting_scheduler: ['schedule', 'create meeting'],
      lead_generation: ['search', 'find leads', 'generate']
    };

    const buttonTexts = submitButtons[formType] || ['submit', 'save'];

    // Try each button text until one succeeds
    for (const buttonText of buttonTexts) {
      if (clickDialogButton(buttonText)) {
        console.log(`✓ Form submitted via: ${buttonText}`);
        return true;
      }
    }

    console.warn(`No submit button found for ${formType}`);
    return false;
  } catch (error) {
    console.error('Error submitting form:', error);
    return false;
  }
};

/**
 * Get summary of filled form data
 */
export const getFormSummary = (formType: string): string | null => {
  try {
    const formSelectors: Record<string, Record<string, string>> = {
      lead_edit: {
        name: '#name',
        email: '#email',
        phone: '#phone',
        company: '#company',
        industry: '#industry'
      },
      meeting_scheduler: {
        title: '#title',
        datetime: '#datetime'
      }
    };

    const selectors = formSelectors[formType];
    if (!selectors) return null;

    const summary: string[] = [];
    Object.entries(selectors).forEach(([fieldName, selector]) => {
      const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      if (element && element.value) {
        summary.push(`${fieldName}: ${element.value}`);
      }
    });

    return summary.length > 0 ? summary.join(', ') : null;
  } catch (error) {
    console.error('Error getting form summary:', error);
    return null;
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

/**
 * Preview an email draft by clicking the preview button
 */
export const previewEmailDraft = (leadName: string, company?: string): boolean => {
  console.log('Attempting to preview email for:', leadName, company);
  
  // Find the email draft card
  const cards = Array.from(document.querySelectorAll('[data-email-draft-id]'));
  const targetCard = cards.find(card => {
    const cardLeadName = card.getAttribute('data-lead-name') || '';
    const cardCompany = card.getAttribute('data-lead-company') || '';
    const searchName = leadName.toLowerCase();
    const searchCompany = company?.toLowerCase() || '';
    
    return cardLeadName.includes(searchName) || 
           (searchCompany && cardCompany.includes(searchCompany));
  });
  
  if (!targetCard) {
    console.log('Email draft card not found for:', leadName);
    return false;
  }
  
  // Find and click the preview button
  const previewButton = targetCard.querySelector('[data-action="preview-email"]') as HTMLElement;
  if (previewButton) {
    console.log('Found preview button, clicking');
    previewButton.click();
    return true;
  }
  
  console.log('Preview button not found');
  return false;
};

/**
 * Approve and send an email draft by clicking the approve button
 */
export const approveEmailDraft = (leadName: string, company?: string): boolean => {
  console.log('Attempting to approve email for:', leadName, company);
  
  // Find the email draft card
  const cards = Array.from(document.querySelectorAll('[data-email-draft-id]'));
  const targetCard = cards.find(card => {
    const cardLeadName = card.getAttribute('data-lead-name') || '';
    const cardCompany = card.getAttribute('data-lead-company') || '';
    const searchName = leadName.toLowerCase();
    const searchCompany = company?.toLowerCase() || '';
    
    return cardLeadName.includes(searchName) || 
           (searchCompany && cardCompany.includes(searchCompany));
  });
  
  if (!targetCard) {
    console.log('Email draft card not found for:', leadName);
    return false;
  }
  
  // Find and click the approve button
  const approveButton = targetCard.querySelector('[data-action="approve-email"]') as HTMLElement;
  if (approveButton) {
    console.log('Found approve button, clicking');
    approveButton.click();
    return true;
  }
  
  console.log('Approve button not found');
  return false;
};

/**
 * Close the email preview dialog
 */
export const closeEmailPreview = (): boolean => {
  console.log('Attempting to close email preview');
  
  const closeButton = document.querySelector('[data-action="close-preview"]') as HTMLElement;
  if (closeButton) {
    console.log('Found close button, clicking');
    closeButton.click();
    return true;
  }
  
  console.log('Close button not found');
  return false;
};

/**
 * Reject the email in the preview dialog
 */
export const rejectEmailPreview = (): boolean => {
  console.log('Attempting to reject email in preview');
  
  const rejectButton = document.querySelector('[data-action="reject-preview"]') as HTMLElement;
  if (rejectButton) {
    console.log('Found reject button, clicking');
    rejectButton.click();
    return true;
  }
  
  console.log('Reject button not found');
  return false;
};

/**
 * Approve and send the email in the preview dialog
 */
export const approveEmailPreview = (): boolean => {
  console.log('Attempting to approve email in preview');
  
  const approveButton = document.querySelector('[data-action="approve-preview"]') as HTMLElement;
  if (approveButton) {
    console.log('Found approve button in preview, clicking');
    approveButton.click();
    return true;
  }
  
  console.log('Approve button not found in preview');
  return false;
};
