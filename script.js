import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { DEFAULT_SYSTEM_PROMPT } from './config.js';
import { parseCSV } from './data.js';
import { loadLLMConfig, callLLMAPIStreaming, extractMainContent, createChatManager } from './api.js';
import { 
  showLoading, hideLoading, showError, showSuccess, updateDataStatus, 
  populateDistrictDropdown, setupAnalysisLevelToggle, setupSystemPromptUI,
  showResultsSection, updateStreamingResults, setupFollowUpEventListeners,
  showFollowUpLoading, hideFollowUpLoading, appendFollowUpQuestion,
  appendFollowUpResponsePlaceholder, updateFollowUpResponse, updateRemainingChats
} from './ui.js';
import { prepareStateAnalysisContext, prepareDistrictAnalysisContext, summarizeContext } from './analysis.js';

// Global state
let data = [];
let apiConfig = null;
const chatManager = createChatManager();

/**
 * Initialize the application
 */
async function init() {
  await loadLLMConfig();
  setupEventListeners();
  setupFormSaving();
  checkDataStatus();
  setupSystemPromptUI(DEFAULT_SYSTEM_PROMPT);
  setupAnalysisLevelToggle();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  document.getElementById('load-sample-btn').addEventListener('click', loadSampleData);
  document.getElementById('analysis-form').addEventListener('submit', handleAnalysis);
  document.getElementById('config-api-btn').addEventListener('click', configureAPI);
}

/**
 * Configure API settings
 */
async function configureAPI() {
  apiConfig = await loadLLMConfig(true);
}

/**
 * Set up form saving
 */
function setupFormSaving() {
  saveform("#analysis-form", {
    prefix: "health_analyzer_",
    events: ["change", "input"]
  });
}

/**
 * Check data status
 */
function checkDataStatus() {
  if (data.length === 0) {
    updateDataStatus("No data loaded. Click 'Load Sample Data' to begin.");
  }
}

/**
 * Load sample data
 */
async function loadSampleData() {
  try {
    showLoading("Loading sample data...");
    
    const response = await fetch('./data.csv');
    if (!response.ok) throw new Error('Failed to load data.csv');
    
    const csvText = await response.text();
    data = parseCSV(csvText);
    
    // Populate district dropdown
    populateDistrictDropdown(data);
    
    updateDataStatus(`Loaded ${data.length} records from sample data`);
    showSuccess(`Successfully loaded ${data.length} health records!`);
    
  } catch (error) {
    showError("Failed to load sample data: " + error.message);
    updateDataStatus("Failed to load data");
  } finally {
    hideLoading();
  }
}

/**
 * Handle analysis form submission
 * @param {Event} event - Form submit event
 */
async function handleAnalysis(event) {
  event.preventDefault();
  
  if (!apiConfig) {
    // Try to load config if not already loaded
    apiConfig = await loadLLMConfig();
  }
  if (!apiConfig) {
    showError("Please configure your LLM API first.");
    return;
  }

  if (data.length === 0) {
    showError("Please load sample data first.");
    return;
  }

  const formData = new FormData(event.target);
  const analysisLevel = formData.get('analysis-level');
  const districtName = formData.get('district-name');
  const blockName = formData.get('block-name');
  const userQuery = formData.get('user-query');

  if (!userQuery) {
    showError("Please enter your query.");
    return;
  }

  // Validate based on analysis level
  if (analysisLevel === 'district' && !districtName) {
    showError("Please select a district for district-level analysis.");
    return;
  }

  try {
    showLoading("Analyzing health data...");
    if (analysisLevel === 'state') {
      await performStateAnalysis(userQuery);
    } else {
      await performDistrictAnalysis(districtName, blockName, userQuery);
    }
  } catch (error) {
    showError("Analysis failed: " + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Perform state-level analysis
 * @param {string} userQuery - User's query
 */
async function performStateAnalysis(userQuery) {
  // For state-level analysis, use all data
  const stateData = data;
  
  // Prepare context for state-level LLM analysis
  const analysisContext = prepareStateAnalysisContext(stateData, userQuery);
  
  // Store the context for future chat interactions
  chatManager.setCurrentContext(summarizeContext(analysisContext, true));
  
  // Reset chat history for new analysis
  chatManager.resetChatHistory();
  
  // Call LLM API with streaming
  await callLLMWithContext(analysisContext, "Uttar Pradesh", null, true);
}

/**
 * Perform district-level analysis
 * @param {string} districtName - Name of district
 * @param {string|null} blockName - Name of block (optional)
 * @param {string} userQuery - User's query
 */
async function performDistrictAnalysis(districtName, blockName, userQuery) {
  // Filter data for the selected district
  const districtData = data.filter(record => 
    record['District Name'].toLowerCase().includes(districtName.toLowerCase())
  );

  if (districtData.length === 0) {
    throw new Error(`No data found for district: ${districtName}`);
  }

  // Further filter by block if specified
  const relevantData = blockName ? 
    districtData.filter(record => 
      record['Development Block Name'].toLowerCase().includes(blockName.toLowerCase())
    ) : districtData;

  // Prepare context for LLM
  const analysisContext = prepareDistrictAnalysisContext(relevantData, districtName, blockName, userQuery);
  
  // Store the context for future chat interactions
  chatManager.setCurrentContext(summarizeContext(analysisContext, false));
  
  // Reset chat history for new analysis
  chatManager.resetChatHistory();
  
  // Call LLM API with streaming
  await callLLMWithContext(analysisContext, districtName, blockName, false);
}

/**
 * Call LLM API with context and handle streaming response
 * @param {string} context - Analysis context
 * @param {string} districtName - Name of district or "Uttar Pradesh"
 * @param {string|null} blockName - Name of block (optional)
 * @param {boolean} isStateLevel - Whether analysis is state-level
 */
async function callLLMWithContext(context, districtName, blockName, isStateLevel) {
  // Get system prompt from textarea (or fallback)
  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  const textarea = document.getElementById('system-prompt-textarea');
  if (textarea && textarea.value.trim()) {
    systemPrompt = textarea.value.trim();
  }
  
  // Add request for follow-up questions to the context
  context += "\n\nPlease suggest 3-5 follow-up questions that would be relevant to this analysis at the end of your response, formatted as a Markdown section titled '## FOLLOW-UP QUESTIONS:' with each question as a bullet point starting with '* '.";
  
  // Show results section and hide loading
  showResultsSection(districtName, blockName, isStateLevel);
  hideLoading();
  
  // Call LLM API with streaming
  const content = await callLLMAPIStreaming(
    apiConfig, 
    systemPrompt, 
    context, 
    (accumulatedContent) => {
      updateStreamingResults(
        accumulatedContent, 
        districtName, 
        blockName, 
        isStateLevel, 
        handleFollowUpClick,
        chatManager.getChatCount(),
        chatManager.getMaxChats()
      );
    }
  );
  
  // Add the initial response to chat history
  const initialResponse = extractMainContent(content);
  chatManager.addToChatHistory('assistant', initialResponse);
  
  // Setup follow-up input event listeners
  setupFollowUpEventListeners(sendFollowUpQuestion);
}

/**
 * Handle follow-up question click
 * @param {Event} event - Click event
 * @param {string} question - Question text
 */
function handleFollowUpClick(event, question) {
  sendFollowUpQuestion(question);
}

/**
 * Send follow-up question to LLM
 * @param {string} question - Question text
 */
async function sendFollowUpQuestion(question) {
  if (chatManager.isMaxChatCountReached()) {
    showError("You've reached the maximum number of follow-up questions for this session. Please start a new analysis.");
    return;
  }
  
  try {
    showFollowUpLoading();
    
    // Add user message to chat history
    chatManager.addToChatHistory('user', question);
    
    // Append the user question to the follow-up section
    appendFollowUpQuestion(question);
    
    // Prepare context with summarized data and chat history
    const chatContext = chatManager.prepareChatContext(question);
    
    // Get system prompt
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    const textarea = document.getElementById('system-prompt-textarea');
    if (textarea && textarea.value.trim()) {
      systemPrompt = textarea.value.trim();
    }
    
    // Create a placeholder for the response
    const responseId = appendFollowUpResponsePlaceholder();
    
    // Call LLM API with streaming
    const content = await callLLMAPIStreaming(
      apiConfig, 
      systemPrompt, 
      chatContext, 
      (accumulatedContent) => {
        updateFollowUpResponse(responseId, accumulatedContent);
      }
    );
    
    // Add assistant response to chat history
    chatManager.addToChatHistory('assistant', content);
    
    // Update remaining chats counter
    updateRemainingChats(chatManager.getChatCount(), chatManager.getMaxChats());
    
  } catch (error) {
    showError("Failed to send message: " + error.message);
  } finally {
    hideFollowUpLoading();
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', init); 