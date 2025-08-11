import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";

const marked = new Marked();

/**
 * Show loading indicator with custom message
 * @param {string} message - Message to display
 */
export function showLoading(message = "Loading...") {
  const loading = document.getElementById('loading-indicator');
  loading.querySelector('p').textContent = message;
  loading.classList.remove('d-none');
}

/**
 * Hide loading indicator
 */
export function hideLoading() {
  document.getElementById('loading-indicator').classList.add('d-none');
}

/**
 * Show error modal with message
 * @param {string} message - Error message
 */
export function showError(message) {
  document.getElementById('error-message').textContent = message;
  new bootstrap.Modal(document.getElementById('error-modal')).show();
}

/**
 * Show success notification
 * @param {string} message - Success message
 */
export function showSuccess(message) {
  const alert = document.createElement('div');
  alert.className = 'alert alert-success alert-dismissible fade show position-fixed';
  alert.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
  alert.innerHTML = `
    <i class="bi bi-check-circle"></i> ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
  `;
  document.body.appendChild(alert);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (alert.parentNode) alert.remove();
  }, 5000);
}

/**
 * Update data status message
 * @param {string} message - Status message
 */
export function updateDataStatus(message) {
  document.getElementById('data-status-text').textContent = message;
}


/**
 * Setup analysis level toggle behavior
 */
export function setupAnalysisLevelToggle() {
  const stateRadio = document.getElementById('state-level');
  const districtRadio = document.getElementById('district-level');
  const userQueryTextarea = document.getElementById('user-query');

  // Handle toggle changes
  const handleToggleChange = () => {
    if (districtRadio.checked) {
      userQueryTextarea.placeholder = "e.g., I want to reduce maternal mortality rate in Agra district";
    } else {
      userQueryTextarea.placeholder = "e.g., I want to reduce maternal mortality rate in Uttar Pradesh";
    }
  };

  stateRadio.addEventListener('change', handleToggleChange);
  districtRadio.addEventListener('change', handleToggleChange);
}

/**
 * Setup system prompt UI
 * @param {string} defaultPrompt - Default system prompt
 */
export function setupSystemPromptUI(defaultPrompt) {
  const textarea = document.getElementById('system-prompt-textarea');
  if (!textarea) return;
  
  // Load from localStorage or use default
  const savedPrompt = localStorage.getItem('systemPrompt');
  textarea.value = savedPrompt || defaultPrompt;
  
  // Save on change
  textarea.addEventListener('input', () => {
    localStorage.setItem('systemPrompt', textarea.value);
  });
}

/**
 * Show results section and prepare for display
 * @param {string} districtName - Name of district or "Uttar Pradesh"
 * @param {string|null} blockName - Name of block (optional)
 * @param {boolean} isStateLevel - Whether analysis is state-level
 */
export function showResultsSection(districtName, blockName, isStateLevel = false) {
  const resultsSection = document.getElementById('results-section');
  resultsSection.classList.remove('d-none');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

/**
 * Update streaming results in the UI
 * @param {string} content - Content to display
 * @param {string} districtName - Name of district or "Uttar Pradesh"
 * @param {string|null} blockName - Name of block (optional)
 * @param {boolean} isStateLevel - Whether analysis is state-level
 * @param {Function} handleFollowUpClick - Function to handle follow-up question clicks
 * @param {number} chatCount - Current chat count
 * @param {number} maxChats - Maximum allowed chats
 */
export function updateStreamingResults(content, districtName, blockName, isStateLevel, handleFollowUpClick, chatCount, maxChats) {
  const resultsContent = document.getElementById('results-content');
  if (!resultsContent) return;
  
  // Process the content to extract follow-up questions
  let mainContent = content;
  let followUpQuestions = [];
  
  // Check if there's a follow-up questions section (now in Markdown format)
  const followUpRegex = /## FOLLOW-UP QUESTIONS:[\s\n]+((?:\* .*\n?)+)/i;
  const match = content.match(followUpRegex);
  
  if (match) {
    // Extract questions and remove them from main content for separate display
    followUpQuestions = match[1].split('\n')
      .filter(line => line.trim().startsWith('* '))
      .map(line => line.trim().substring(2).trim());
    
    // Remove the follow-up section from the main content
    mainContent = content.replace(followUpRegex, '').trim();
  }
  
  const htmlContent = marked.parse(mainContent);
  
  // Add Bootstrap table classes to rendered tables
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  const tables = tempDiv.querySelectorAll('table');
  tables.forEach(table => {
    table.className = 'table table-striped table-bordered table-hover';
  });
  const styledHtmlContent = tempDiv.innerHTML;
  
  // Determine the title based on analysis level
  let analysisTitle;
  if (isStateLevel) {
    analysisTitle = `Analysis for ${districtName} State`;
  } else {
    analysisTitle = `Analysis for ${districtName}${blockName ? ` - ${blockName} Block` : ' District'}`;
  }
  
  const template = html`
    <div class="analysis-header mb-4">
      <h5 class="text-primary">
        <i class="bi bi-geo-alt-fill"></i>
        ${analysisTitle}
      </h5>
      <p class="text-muted">Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="analysis-content">
      ${unsafeHTML(styledHtmlContent)}
    </div>
    
    ${followUpQuestions.length > 0 ? html`
      <div class="follow-up-questions mt-4">
        <h6 class="text-primary">
          <i class="bi bi-question-circle"></i>
          Follow-up Questions
        </h6>
        <div class="d-flex flex-wrap gap-2 mt-3">
          ${followUpQuestions.map(question => html`
            <button class="btn btn-outline-primary btn-sm follow-up-btn" 
                    @click=${(e) => handleFollowUpClick(e, question)}>
              ${question}
            </button>
          `)}
        </div>
      </div>
    ` : ''}
    
    <div class="mt-4 p-3 bg-light rounded">
      <small class="text-muted">
        <i class="bi bi-info-circle"></i>
        <strong>Data Sources:</strong> National Health Mission (NHM), NITI Aayog Health Index, 
        Janani Suraksha Yojana (JSY) data, and state health department records.
      </small>
    </div>
    
    <!-- Follow-up Questions Section -->
    <div class="follow-up-section mt-4" id="follow-up-section">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-primary mb-0">
          <i class="bi bi-chat-dots"></i>
          Follow-up Questions
        </h6>
        <span class="badge bg-secondary" id="remaining-chats">${maxChats - chatCount} of ${maxChats} follow-ups remaining</span>
      </div>
      
      <div id="follow-up-conversations">
        <!-- Follow-up conversations will be appended here -->
      </div>
      
      <div id="follow-up-loading" class="text-center py-3 d-none">
        <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
        <span class="ms-2">Processing...</span>
      </div>
      
      <div class="follow-up-input mt-3">
        <div class="input-group">
          <input type="text" class="form-control" id="follow-up-input" 
              placeholder="Type your follow-up question here..." 
              ${chatCount >= maxChats ? 'disabled' : ''}>
          <button class="btn btn-primary" id="follow-up-send-btn" 
              ${chatCount >= maxChats ? 'disabled' : ''}>
              <i class="bi bi-send"></i> Ask
          </button>
        </div>
        <small class="text-muted mt-1">
          You can ask up to ${maxChats} follow-up questions about the analysis results
        </small>
      </div>
    </div>
  `;
  
  render(template, resultsContent);
}

/**
 * Setup follow-up input event listeners
 * @param {Function} sendFollowUpQuestion - Function to send follow-up question
 */
export function setupFollowUpEventListeners(sendFollowUpQuestion) {
  const followUpInput = document.getElementById('follow-up-input');
  const sendButton = document.getElementById('follow-up-send-btn');
  
  if (!followUpInput || !sendButton) return;
  
  // Send on button click
  sendButton.addEventListener('click', () => {
    const message = followUpInput.value.trim();
    if (message) {
      sendFollowUpQuestion(message);
      followUpInput.value = '';
    }
  });
  
  // Send on Enter key
  followUpInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const message = followUpInput.value.trim();
      if (message) {
        sendFollowUpQuestion(message);
        followUpInput.value = '';
      }
      e.preventDefault();
    }
  });
}

/**
 * Show loading indicator for follow-up questions
 */
export function showFollowUpLoading() {
  const loadingIndicator = document.getElementById('follow-up-loading');
  if (loadingIndicator) {
    loadingIndicator.classList.remove('d-none');
  }
}

/**
 * Hide loading indicator for follow-up questions
 */
export function hideFollowUpLoading() {
  const loadingIndicator = document.getElementById('follow-up-loading');
  if (loadingIndicator) {
    loadingIndicator.classList.add('d-none');
  }
}

/**
 * Append user question to follow-up section
 * @param {string} question - User's question
 */
export function appendFollowUpQuestion(question) {
  const followUpConversations = document.getElementById('follow-up-conversations');
  if (!followUpConversations) return;
  
  const questionElement = document.createElement('div');
  questionElement.className = 'follow-up-item user-question mb-3';
  
  questionElement.innerHTML = `
    <div class="card border-primary">
      <div class="card-header bg-primary text-white">
        <i class="bi bi-person-fill"></i> Your Question
      </div>
      <div class="card-body">
        <p class="card-text">${question}</p>
      </div>
    </div>
  `;
  
  followUpConversations.appendChild(questionElement);
  
  // Scroll to the question
  questionElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

/**
 * Create placeholder for follow-up response
 * @returns {string} Response ID
 */
export function appendFollowUpResponsePlaceholder() {
  const followUpConversations = document.getElementById('follow-up-conversations');
  if (!followUpConversations) return null;
  
  const responseId = 'response-' + Date.now();
  const responseElement = document.createElement('div');
  responseElement.className = 'follow-up-item assistant-response mb-4';
  responseElement.id = responseId;
  
  responseElement.innerHTML = `
    <div class="card">
      <div class="card-header bg-light">
        <i class="bi bi-robot"></i> Response
      </div>
      <div class="card-body">
        <div class="card-text" id="${responseId}-content">
          <div class="placeholder-glow">
            <span class="placeholder col-12"></span>
            <span class="placeholder col-10"></span>
            <span class="placeholder col-8"></span>
          </div>
        </div>
      </div>
    </div>
  `;
  
  followUpConversations.appendChild(responseElement);
  
  // Scroll to the response
  responseElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
  
  return responseId;
}

/**
 * Update follow-up response with content
 * @param {string} responseId - Response ID
 * @param {string} content - Response content
 */
export function updateFollowUpResponse(responseId, content) {
  if (!responseId) return;
  
  const responseContent = document.getElementById(`${responseId}-content`);
  if (responseContent) {
    const htmlContent = marked.parse(content);
    
    // Add Bootstrap table classes to rendered tables
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const tables = tempDiv.querySelectorAll('table');
    tables.forEach(table => {
      table.className = 'table table-striped table-bordered table-hover';
    });
    
    responseContent.innerHTML = tempDiv.innerHTML;
  }
}

/**
 * Update remaining chats counter
 * @param {number} chatCount - Current chat count
 * @param {number} maxChats - Maximum allowed chats
 */
export function updateRemainingChats(chatCount, maxChats) {
  const remainingChats = document.getElementById('remaining-chats');
  if (!remainingChats) return;
  
  const remaining = maxChats - chatCount;
  remainingChats.textContent = `${remaining} of ${maxChats} follow-ups remaining`;
  
  if (remaining <= 1) {
    remainingChats.classList.add('text-danger');
  } else {
    remainingChats.classList.remove('text-danger');
  }
  
  // Disable input if no remaining chats
  const followUpInput = document.getElementById('follow-up-input');
  const sendButton = document.getElementById('follow-up-send-btn');
  
  if (followUpInput && sendButton) {
    if (remaining <= 0) {
      followUpInput.disabled = true;
      sendButton.disabled = true;
      followUpInput.placeholder = "Maximum follow-up questions reached";
    }
  }
} 