import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import { MAX_FOLLOW_UP_QUESTIONS } from './config.js';

/**
 * Load LLM API configuration
 * @param {boolean} forceShow - Whether to force showing the config dialog
 * @returns {Promise<Object>} API configuration
 */
export async function loadLLMConfig(forceShow = false) {
  return await openaiConfig({
    storage: sessionStorage,
    key: "llmProvider",
    show: forceShow
  });
}

/**
 * Call LLM API with streaming response
 * @param {Object} apiConfig - API configuration
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @param {Function} onChunk - Callback for each chunk of streamed content
 * @returns {Promise<string>} Full response content
 */
export async function callLLMAPIStreaming(apiConfig, systemPrompt, userPrompt, onChunk) {
  if (!apiConfig) {
    throw new Error("API configuration not available");
  }

  // Ensure system prompt includes instruction to respond in Markdown format
  const enhancedSystemPrompt = `${systemPrompt}\n\nIMPORTANT: Always format your responses in Markdown. Use proper headings, lists, bold, italics, and other Markdown formatting to make your response clear and well-structured.`;

  const response = await fetch(`${apiConfig.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiConfig.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: enhancedSystemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: true
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed: ${error}`);
  }

  // Process streaming response
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulatedContent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim() && line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              accumulatedContent += content;
              if (onChunk) onChunk(accumulatedContent);
            }
          } catch (e) {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  
  return accumulatedContent;
}

/**
 * Extract main content by removing follow-up questions section
 * @param {string} content - Full response content
 * @returns {string} Main content without follow-up questions
 */
export function extractMainContent(content) {
  // Remove follow-up questions section for chat history (using Markdown format)
  const followUpRegex = /## FOLLOW-UP QUESTIONS:[\s\n]+((?:\* .*\n?)+)/i;
  return content.replace(followUpRegex, '').trim();
}

/**
 * Chat manager for handling conversation with LLM
 */
export function createChatManager() {
  const state = {
    chatHistory: [],
    chatCount: 0,
    maxChats: MAX_FOLLOW_UP_QUESTIONS,
    currentContext: null
  };

  /**
   * Reset chat history
   */
  function resetChatHistory() {
    state.chatHistory = [];
    state.chatCount = 0;
  }

  /**
   * Add message to chat history
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  function addToChatHistory(role, content) {
    state.chatHistory.push({ role, content });
    if (role === 'user') {
      state.chatCount++;
    }
  }

  /**
   * Format chat history as string
   * @returns {string} Formatted chat history
   */
  function formatChatHistory() {
    return state.chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
  }

  /**
   * Prepare chat context for follow-up questions
   * @param {string} message - User's follow-up question
   * @returns {string} Chat context
   */
  function prepareChatContext(message) {
    if (!state.currentContext) return '';
    return `${state.currentContext}\n\nCHAT HISTORY:\n${formatChatHistory()}\n\nUSER QUESTION: ${message}`;
  }

  /**
   * Store context for future chat interactions
   * @param {string} context - Context to store
   */
  function setCurrentContext(context) {
    state.currentContext = context;
  }

  /**
   * Check if maximum chat count reached
   * @returns {boolean} True if maximum reached
   */
  function isMaxChatCountReached() {
    return state.chatCount >= state.maxChats;
  }

  /**
   * Get remaining chat count
   * @returns {number} Remaining chats
   */
  function getRemainingChats() {
    return state.maxChats - state.chatCount;
  }

  /**
   * Get chat history
   * @returns {Array} Chat history
   */
  function getChatHistory() {
    return state.chatHistory;
  }

  /**
   * Get chat count
   * @returns {number} Chat count
   */
  function getChatCount() {
    return state.chatCount;
  }

  /**
   * Get max chats
   * @returns {number} Max chats
   */
  function getMaxChats() {
    return state.maxChats;
  }

  return {
    resetChatHistory,
    addToChatHistory,
    formatChatHistory,
    prepareChatContext,
    setCurrentContext,
    isMaxChatCountReached,
    getRemainingChats,
    getChatHistory,
    getChatCount,
    getMaxChats
  };
} 