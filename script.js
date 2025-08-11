import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { DEFAULT_SYSTEM_PROMPT } from './config.js';
import { parseCSV, extractDistrictNames, findBestDistrictMatch } from './data.js';
import { loadLLMConfig, callLLMAPIStreaming, extractMainContent, createChatManager, callLLMAPI } from './api.js';
import { 
  showLoading, hideLoading, showError, showSuccess, updateDataStatus, 
  setupAnalysisLevelToggle, setupSystemPromptUI,
  showResultsSection, updateStreamingResults, setupFollowUpEventListeners,
  showFollowUpLoading, hideFollowUpLoading, appendFollowUpQuestion,
  appendFollowUpResponsePlaceholder, updateFollowUpResponse, updateRemainingChats,
  updateGeneralQueryResults, updateDataInquiryResults
} from './ui.js';
import { prepareStateAnalysisContext, prepareDistrictAnalysisContext, summarizeContext, prepareDataInquiryContext, prepareStateDataInquiryContext } from './analysis.js';

// Global state
let data = [];
let apiConfig = null;
let districtNames = [];
const chatManager = createChatManager();

/**
 * Initialize the application
 */
async function init() {
  await loadLLMConfig();
  setupEventListeners();
  setupFormSaving();
  setupSystemPromptUI(DEFAULT_SYSTEM_PROMPT);
  setupAnalysisLevelToggle();
  
  // Auto-load sample data on page load
  await loadSampleData();
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
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
 * Load sample data
 */
async function loadSampleData() {
  try {
    showLoading("Loading sample data...");
    
    const response = await fetch('./data.csv');
    if (!response.ok) throw new Error('Failed to load data.csv');
    
    const csvText = await response.text();
    data = parseCSV(csvText);
    
    // Extract district names for fuzzy matching
    districtNames = extractDistrictNames(data);
    
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
    showError("Data not loaded. Please refresh the page.");
    return;
  }

  const formData = new FormData(event.target);
  const analysisLevel = formData.get('analysis-level');
  const userQuery = formData.get('user-query');

  if (!userQuery) {
    showError("Please enter your query.");
    return;
  }

  let districtName = null;
  let blockName = null;

  // First, check if the query is related to health/MMR data
  try {
    showLoading("Analyzing your question...");
    const isHealthRelated = await checkQueryRelevance(userQuery, apiConfig);
    
    if (!isHealthRelated) {
      // Handle non-health related queries with general knowledge
      showLoading("Generating response based on general knowledge...");
      await handleGeneralQuery(userQuery);
      return;
    }

    // Classify intent for health-related queries
    const queryIntent = await classifyQueryIntent(userQuery, apiConfig);
    
    if (queryIntent === 'DATA_INQUIRY') {
      // Handle data inquiry questions with brief answers
      showLoading("Looking up data...");
      await handleDataInquiry(userQuery);
      return;
    }
    
    // Continue with full analysis for improvement/intervention questions
  } catch (error) {
    showError("Failed to process query: " + error.message);
    hideLoading();
    return;
  }

  // Extract district name from query using LLM (only for health-related queries)
  try {
    showLoading("Identifying district from your query...");
    districtName = await extractDistrictNameWithLLM(userQuery, districtNames, apiConfig);
    if (!districtName) {
      showError("Could not identify a district name in your query. Please mention a district name from Uttar Pradesh.");
      hideLoading();
      return;
    }
    // Show which district was identified
    showSuccess(`Analyzing data for: ${districtName}`);
  } catch (error) {
    showError("Failed to identify district: " + error.message);
    hideLoading();
    return;
  }

  try {
    showLoading("Analyzing health data...");
    await performDistrictAnalysis(districtName, blockName, userQuery);
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

/**
 * Classify the intent of a health-related query
 * @param {string} userQuery - User's query text
 * @param {Object} apiConfig - API configuration
 * @returns {Promise<string>} Intent type: 'DATA_INQUIRY' or 'IMPROVEMENT'
 */
async function classifyQueryIntent(userQuery, apiConfig) {
  const systemPrompt = `You are a query intent classifier for health data questions. Classify user queries into one of these categories:

1. DATA_INQUIRY: Questions asking for specific data points, rankings, comparisons, or factual information
   - Examples: "What is the rank of Lucknow?", "Show me MMR for Agra", "Which district has highest institutional births?", "Compare Kanpur and Allahabad", "What are the statistics for...", "Tell me about performance of..."

2. IMPROVEMENT: Questions asking for recommendations, strategies, interventions, or how to improve something
   - Examples: "How can I improve maternal mortality?", "What should I do to reduce MMR?", "Strategies for increasing institutional births", "How to improve performance?", "What interventions are needed?"

Return only "DATA_INQUIRY" or "IMPROVEMENT" based on the query intent.`;

  const userPrompt = `Classify this health data query: "${userQuery}"`;
  
  try {
    const response = await callLLMAPI(apiConfig, systemPrompt, userPrompt);
    const intent = response.trim().toUpperCase();
    return intent === 'DATA_INQUIRY' ? 'DATA_INQUIRY' : 'IMPROVEMENT';
  } catch (error) {
    console.error('Error classifying query intent:', error);
    // Default to improvement to maintain existing functionality
    return 'IMPROVEMENT';
  }
}

/**
 * Handle data inquiry questions with brief, direct answers
 * @param {string} userQuery - User's query
 */
async function handleDataInquiry(userQuery) {
  // Try to extract district name for data lookup
  let districtName = null;
  try {
    districtName = await extractDistrictNameWithLLM(userQuery, districtNames, apiConfig);
  } catch (error) {
    console.error('Error extracting district name for data inquiry:', error);
  }

  // Prepare simplified context for data inquiry
  let context = '';
  if (districtName) {
    const districtData = data.filter(record => 
      record['District Name'].toLowerCase().includes(districtName.toLowerCase())
    );
    if (districtData.length > 0) {
      context = prepareDataInquiryContext(districtData, districtName, userQuery);
    }
  }
  
  // If no specific district, provide state-level context
  if (!context) {
    context = prepareStateDataInquiryContext(data, userQuery);
  }

  // Get system prompt for data inquiry
  const systemPrompt = `You are a health data assistant. Answer the user's question directly and briefly (2-4 sentences max). 
  
  Provide specific numbers, rankings, and comparisons. Be factual and concise. Do not use templates or lengthy analysis.
  
  Examples of good responses:
  - "Lucknow district ranks 15th out of 75 districts with an MMR of 89.2 per 100k live births, better than the state average of 112.3."
  - "Agra has 6 blocks with institutional births ranging from 21% to 67%. The district average is 35.5%."`;

  // Show results section
  showResultsSection(`Data: ${districtName || 'State-wide'}`, null, !districtName);
  hideLoading();

  try {
    // Call LLM API with streaming
    const content = await callLLMAPIStreaming(
      apiConfig, 
      systemPrompt, 
      context, 
      (accumulatedContent) => {
        updateDataInquiryResults(accumulatedContent, userQuery, districtName);
      }
    );
  } catch (error) {
    showError("Failed to retrieve data: " + error.message);
  }
}

/**
 * Check if user query is related to available health data
 * @param {string} userQuery - User's query text
 * @param {Object} apiConfig - API configuration
 * @returns {Promise<boolean>} True if health-related, false otherwise
 */
async function checkQueryRelevance(userQuery, apiConfig) {
  const systemPrompt = `You are a query classifier that determines if a user question is related to available health data in Uttar Pradesh, India.

The available data includes:
- Maternal Mortality Ratio (MMR)
- Institutional births percentage
- Antenatal care coverage
- Maternal health indicators
- District and block-level health performance

Your task is to determine if the user's query is related to these health topics. 

Return only "YES" if the query is related to maternal health, institutional births, antenatal care, maternal mortality, or general health performance in Uttar Pradesh districts.

Return only "NO" if the query is about unrelated topics like agriculture, education, economy, technology, politics, etc.`;

  const userPrompt = `Is this query related to available health data: "${userQuery}"`;
  
  try {
    const response = await callLLMAPI(apiConfig, systemPrompt, userPrompt);
    return response.trim().toUpperCase() === 'YES';
  } catch (error) {
    console.error('Error checking query relevance:', error);
    // Default to true to maintain backward compatibility
    return true;
  }
}

/**
 * Handle general (non-health related) queries with LLM knowledge
 * @param {string} userQuery - User's query
 */
async function handleGeneralQuery(userQuery) {
  // Get system prompt from textarea (or fallback)
  let systemPrompt = `You are a helpful assistant. The user has asked a question that is not related to the specific health data available in this system. 

Please respond with: "I don't have specific data available to answer your question about [topic]. However, based on my general knowledge: [provide helpful general information about the topic]"

Be informative and helpful while acknowledging the data limitation.`;
  
  // Show results section
  showResultsSection("General Query", null, false);
  hideLoading();
  
  try {
    // Call LLM API with streaming
    const content = await callLLMAPIStreaming(
      apiConfig, 
      systemPrompt, 
      userQuery, 
      (accumulatedContent) => {
        // Update results without the usual health data formatting
        updateGeneralQueryResults(accumulatedContent, userQuery);
      }
    );
  } catch (error) {
    showError("Failed to generate response: " + error.message);
  }
}

/**
 * Extract district name from user query using LLM
 * @param {string} userQuery - User's query text
 * @param {Array} districtNames - Array of available district names
 * @param {Object} apiConfig - API configuration
 * @returns {Promise<string|null>} Extracted district name or null
 */
async function extractDistrictNameWithLLM(userQuery, districtNames, apiConfig) {
  const systemPrompt = `You are a helper that extracts district names from user queries about health data analysis in Uttar Pradesh, India.

Your task is to:
1. Identify any district name mentioned in the user's query
2. Match it to the exact district name from the provided list
3. Handle typos and variations (e.g., "Aghra" should match "Agra")
4. Return ONLY the exact district name from the list, or "NONE" if no valid district is found

Available districts: ${districtNames.join(', ')}

Rules:
- Return only the exact district name from the list above
- If you find a close match despite typos, return the correct spelling
- If no district is mentioned or found, return "NONE"
- Do not return any explanation, just the district name or "NONE"`;

  const userPrompt = `Extract the district name from this query: "${userQuery}"`;
  
  try {
    const response = await callLLMAPI(apiConfig, systemPrompt, userPrompt);
    const extractedDistrict = response.trim();
    
    // Validate that the response is in our district list
    if (extractedDistrict === "NONE" || !districtNames.includes(extractedDistrict)) {
      return null;
    }
    
    return extractedDistrict;
  } catch (error) {
    console.error('Error extracting district name:', error);
    throw error;
  }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', init); 