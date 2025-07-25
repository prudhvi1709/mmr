import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";
import { render, html } from "https://cdn.jsdelivr.net/npm/lit-html@3/+esm";
import { unsafeHTML } from "https://cdn.jsdelivr.net/npm/lit-html@3/directives/unsafe-html.js";
import { Marked } from "https://cdn.jsdelivr.net/npm/marked@13/+esm";

const marked = new Marked();

class HealthAnalyzer {
    constructor() {
        this.data = [];
        this.apiConfig = null;
        this.defaultSystemPrompt = `You are a governance expert assistant helping administrators in India analyze health data.

The user wants to solve health issues based on available data from Uttar Pradesh.

For STATE-LEVEL ANALYSIS:
- Provide state-wide overview and district comparisons
- Identify top and underperforming districts
- Suggest state-level policy interventions
- Compare districts and recommend focus areas

For DISTRICT-LEVEL ANALYSIS:
- Focus on specific district performance
- Provide block-wise breakdown within the district
- Compare with state averages
- Suggest district-specific interventions

Based on the available data, provide:

1. **Relevant Indicators** from national or state-level government programs (e.g., NHM, Aspirational Districts, NITI Aayog) tied to the problem.

2. **Performance Analysis** and ranking across the state/district on these indicators.

3. **Sub-unit Breakdown** (districts for state analysis, blocks for district analysis) to identify weak-performing areas needing immediate attention.

4. **Actionable Suggestions** with specific targets (e.g., "improving institutional deliveries from 75% to 85% may improve the ranking from 35 to 25").

5. **Predicted Impact** based on improvements in indicators with realistic timelines.

6. **Ranking Analysis** showing current position and potential improvements if indicators are enhanced.

Present insights in a human-readable, decision-friendly format that government officers can act upon immediately. Use bullet points, numbers, and clear recommendations. Be concise but comprehensive.`;
        this.chatHistory = [];
        this.chatCount = 0;
        this.maxChats = 5;
        this.currentContext = null;
        this.init();
    }

    async init() {
        await this.loadLLMConfig();
        this.setupEventListeners();
        this.setupFormSaving();
        this.checkDataStatus();
        this.setupSystemPromptUI();
        this.setupAnalysisLevelToggle();
    }

    setupAnalysisLevelToggle() {
        const stateRadio = document.getElementById('state-level');
        const districtRadio = document.getElementById('district-level');
        const districtSelection = document.getElementById('district-selection');
        const districtSelect = document.getElementById('district-name');
        const userQueryTextarea = document.getElementById('user-query');

        // Handle toggle changes
        const handleToggleChange = () => {
            if (districtRadio.checked) {
                districtSelection.style.display = 'block';
                districtSelect.setAttribute('required', 'required');
                userQueryTextarea.placeholder = "e.g., I want to reduce maternal mortality rate in Agra district";
            } else {
                districtSelection.style.display = 'none';
                districtSelect.removeAttribute('required');
                userQueryTextarea.placeholder = "e.g., I want to reduce maternal mortality rate in Uttar Pradesh";
            }
        };

        stateRadio.addEventListener('change', handleToggleChange);
        districtRadio.addEventListener('change', handleToggleChange);
    }

    setupSystemPromptUI() {
        const textarea = document.getElementById('system-prompt-textarea');
        if (!textarea) return;
        // Load from localStorage or use default
        const savedPrompt = localStorage.getItem('systemPrompt');
        textarea.value = savedPrompt || this.defaultSystemPrompt;
        // Save on change
        textarea.addEventListener('input', () => {
            localStorage.setItem('systemPrompt', textarea.value);
        });
    }

    async loadLLMConfig(forceShow = false) {
        // Use openaiConfig with sessionStorage to persist config
        this.apiConfig = await openaiConfig({
            storage: sessionStorage,
            key: "llmProvider",
            show: forceShow
        });
    }

    setupEventListeners() {
        document.getElementById('load-sample-btn').addEventListener('click', () => this.loadSampleData());
        document.getElementById('analysis-form').addEventListener('submit', (e) => this.handleAnalysis(e));
        document.getElementById('config-api-btn').addEventListener('click', async () => {
            await openaiConfig({ storage: sessionStorage, key: "llmProvider", show: true });
        });
    }

    setupFormSaving() {
        saveform("#analysis-form", {
            prefix: "health_analyzer_",
            events: ["change", "input"]
        });
    }

    async loadSampleData() {
        try {
            this.showLoading("Loading sample data...");
            
            const response = await fetch('./data.csv');
            if (!response.ok) throw new Error('Failed to load data.csv');
            
            const csvText = await response.text();
            this.data = this.parseCSV(csvText);
            
            // Populate district dropdown
            this.populateDistrictDropdown();
            
            this.updateDataStatus(`Loaded ${this.data.length} records from sample data`);
            this.showSuccess(`Successfully loaded ${this.data.length} health records!`);
            
        } catch (error) {
            this.showError("Failed to load sample data: " + error.message);
            this.updateDataStatus("Failed to load data");
        } finally {
            this.hideLoading();
        }
    }

    populateDistrictDropdown() {
        const districtSelect = document.getElementById('district-name');
        if (!districtSelect) return;

        // Extract unique districts from data
        const districts = [...new Set(this.data.map(record => record['District Name']))].sort();
        
        // Clear existing options except the first one
        districtSelect.innerHTML = '<option value="">Select a district...</option>';
        
        // Add district options
        districts.forEach(district => {
            if (district && district.trim()) {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                districtSelect.appendChild(option);
            }
        });
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',');
            const record = {};
            headers.forEach((header, index) => {
                record[header] = values[index]?.trim() || '';
            });
            return record;
        });
    }

    async handleAnalysis(event) {
        event.preventDefault();
        
        if (!this.apiConfig) {
            // Try to load config if not already loaded
            await this.loadLLMConfig();
        }
        if (!this.apiConfig) {
            this.showError("Please configure your LLM API first.");
            return;
        }

        if (this.data.length === 0) {
            this.showError("Please load sample data first.");
            return;
        }

        const formData = new FormData(event.target);
        const analysisLevel = formData.get('analysis-level');
        const districtName = formData.get('district-name');
        const blockName = formData.get('block-name');
        const userQuery = formData.get('user-query');

        if (!userQuery) {
            this.showError("Please enter your query.");
            return;
        }

        // Validate based on analysis level
        if (analysisLevel === 'district' && !districtName) {
            this.showError("Please select a district for district-level analysis.");
            return;
        }

        try {
            this.showLoading("Analyzing health data...");
            if (analysisLevel === 'state') {
                await this.performStateAnalysis(userQuery);
            } else {
                await this.performDistrictAnalysis(districtName, blockName, userQuery);
            }
        } catch (error) {
            this.showError("Analysis failed: " + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async performStateAnalysis(userQuery) {
        // For state-level analysis, use all data
        const stateData = this.data;
        
        // Prepare context for state-level LLM analysis
        const analysisContext = this.prepareStateAnalysisContext(stateData, userQuery);
        
        // Store the context for future chat interactions
        this.currentContext = this.summarizeContext(analysisContext, true);
        
        // Reset chat history for new analysis
        this.resetChatHistory();
        
        // Call LLM API with streaming
        await this.callLLMAPIStreaming(analysisContext, "Uttar Pradesh", null, true);
    }

    async performDistrictAnalysis(districtName, blockName, userQuery) {
        // Filter data for the selected district
        const districtData = this.data.filter(record => 
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
        const analysisContext = this.prepareDistrictAnalysisContext(relevantData, districtName, blockName, userQuery);
        
        // Store the context for future chat interactions
        this.currentContext = this.summarizeContext(analysisContext, false);
        
        // Reset chat history for new analysis
        this.resetChatHistory();
        
        // Call LLM API with streaming
        await this.callLLMAPIStreaming(analysisContext, districtName, blockName, false);
    }

    prepareStateAnalysisContext(data, userQuery) {
        // Calculate state-level statistics
        const stateStats = this.calculateStateStats(data);
        
        // Get district-wise performance ranking
        const districtPerformance = this.analyzeDistrictPerformance(data);
        
        // Key indicators for state-level analysis
        const keyIndicators = [
            '% of institutional births',
            '% of Mothers who had full antenatal care',
            'Maternal Mortality Ratio',
            '% of pregnant women received 4 or more ANC against estimated PW',
            '% of pregnant women delivered in institution against estimated delivery',
            'Percentage of Pregnant women age 15-49 years who are anemic (<11.0g/dI)',
            '% of C-section delivery against reported delivery (70% weightage to CHC and 30% to DH)'
        ];

        const context = `
STATE: UTTAR PRADESH
Analysis Level: STATE-WIDE

USER PROBLEM: "${userQuery}"

STATE-WIDE DATA SUMMARY:
- Total districts analyzed: ${stateStats.totalDistricts}
- Total blocks analyzed: ${data.length}
- State average Maternal Mortality Ratio: ${stateStats.avgMMR.toFixed(1)}
- State average Institutional Births: ${stateStats.avgInstitutionalBirths.toFixed(1)}%
- State average Full ANC: ${stateStats.avgFullANC.toFixed(1)}%

KEY INDICATORS ANALYSIS (STATE-WIDE):
${keyIndicators.map(indicator => {
    const values = data.map(d => parseFloat(d[indicator]) || 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `- ${indicator}: State Avg: ${avg.toFixed(1)}%, Range: ${min.toFixed(1)}% - ${max.toFixed(1)}%`;
}).join('\n')}

TOP PERFORMING DISTRICTS:
${districtPerformance.slice(0, 5).map(district => 
    `- ${district.districtName}: Avg MMR: ${district.avgMMR.toFixed(1)}, Avg Institutional Births: ${district.avgInstitutionalBirths.toFixed(1)}%`
).join('\n')}

UNDERPERFORMING DISTRICTS:
${districtPerformance.slice(-5).map(district => 
    `- ${district.districtName}: Avg MMR: ${district.avgMMR.toFixed(1)}, Avg Institutional Births: ${district.avgInstitutionalBirths.toFixed(1)}%`
).join('\n')}

DISTRICT COMPARISON DATA:
${districtPerformance.slice(0, 10).map(district => 
    `District: ${district.districtName}, Blocks: ${district.blockCount}, Avg MMR: ${district.avgMMR.toFixed(1)}, Avg Institutional Births: ${district.avgInstitutionalBirths.toFixed(1)}%`
).join('\n')}
`;

        return context;
    }

    calculateStateStats(data) {
        const avgMMR = data.reduce((sum, d) => sum + (parseFloat(d['Maternal Mortality Ratio']) || 0), 0) / data.length;
        const avgInstitutionalBirths = data.reduce((sum, d) => sum + (parseFloat(d['% of institutional births']) || 0), 0) / data.length;
        const avgFullANC = data.reduce((sum, d) => sum + (parseFloat(d['% of Mothers who had full antenatal care']) || 0), 0) / data.length;
        const totalDistricts = [...new Set(data.map(d => d['District Name']))].length;
        
        return { avgMMR, avgInstitutionalBirths, avgFullANC, totalDistricts };
    }

    analyzeDistrictPerformance(data) {
        // Group data by district
        const districtGroups = {};
        data.forEach(record => {
            const districtName = record['District Name'];
            if (!districtGroups[districtName]) {
                districtGroups[districtName] = [];
            }
            districtGroups[districtName].push(record);
        });

        // Calculate district-level averages
        return Object.keys(districtGroups).map(districtName => {
            const districtData = districtGroups[districtName];
            const avgMMR = districtData.reduce((sum, d) => sum + (parseFloat(d['Maternal Mortality Ratio']) || 0), 0) / districtData.length;
            const avgInstitutionalBirths = districtData.reduce((sum, d) => sum + (parseFloat(d['% of institutional births']) || 0), 0) / districtData.length;
            const avgFullANC = districtData.reduce((sum, d) => sum + (parseFloat(d['% of Mothers who had full antenatal care']) || 0), 0) / districtData.length;
            
            return {
                districtName,
                blockCount: districtData.length,
                avgMMR,
                avgInstitutionalBirths,
                avgFullANC
            };
        }).sort((a, b) => a.avgMMR - b.avgMMR); // Sort by MMR (lower is better)
    }

    prepareDistrictAnalysisContext(data, districtName, blockName, userQuery) {
        // Calculate district-level statistics
        const districtStats = this.calculateDistrictStats(data);
        
        // Identify key indicators for maternal mortality
        const keyIndicators = [
            '% of institutional births',
            '% of Mothers who had full antenatal care',
            'Maternal Mortality Ratio',
            '% of pregnant women received 4 or more ANC against estimated PW',
            '% of pregnant women delivered in institution against estimated delivery',
            'Percentage of Pregnant women age 15-49 years who are anemic (<11.0g/dI)',
            '% of C-section delivery against reported delivery (70% weightage to CHC and 30% to DH)'
        ];

        // Find best and worst performing blocks
        const blockPerformance = this.analyzeBlockPerformance(data, keyIndicators);

        const context = `
District: ${districtName}
${blockName ? `Specific Block: ${blockName}` : 'All Blocks Analysis'}

USER PROBLEM: "${userQuery}"

AVAILABLE DATA SUMMARY:
- Total blocks analyzed: ${data.length}
- District average Maternal Mortality Ratio: ${districtStats.avgMMR.toFixed(1)}
- District average Institutional Births: ${districtStats.avgInstitutionalBirths.toFixed(1)}%
- District average Full ANC: ${districtStats.avgFullANC.toFixed(1)}%

KEY INDICATORS ANALYSIS:
${keyIndicators.map(indicator => {
    const values = data.map(d => parseFloat(d[indicator]) || 0);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return `- ${indicator}: Avg: ${avg.toFixed(1)}%, Range: ${min.toFixed(1)}% - ${max.toFixed(1)}%`;
}).join('\n')}

BLOCK-WISE PERFORMANCE:
${blockPerformance.map(block => 
    `- ${block.blockName} (Rank: ${block.rank}): MMR: ${block.mmr}, Institutional Births: ${block.institutionalBirths}%`
).join('\n')}

TOP PERFORMING BLOCKS:
${blockPerformance.slice(0, 3).map(block => 
    `- ${block.blockName}: MMR: ${block.mmr}, Strong areas: ${block.strengths.join(', ')}`
).join('\n')}

UNDERPERFORMING BLOCKS:
${blockPerformance.slice(-3).map(block => 
    `- ${block.blockName}: MMR: ${block.mmr}, Weak areas: ${block.weaknesses.join(', ')}`
).join('\n')}

DETAILED BLOCK DATA:
${data.slice(0, 5).map(record => 
    `Block: ${record['Development Block Name']}, Rank: ${record['Block Rank']}, MMR: ${record['Maternal Mortality Ratio']}, Institutional Births: ${record['% of institutional births']}%`
).join('\n')}
`;

        return context;
    }

    calculateDistrictStats(data) {
        const avgMMR = data.reduce((sum, d) => sum + (parseFloat(d['Maternal Mortality Ratio']) || 0), 0) / data.length;
        const avgInstitutionalBirths = data.reduce((sum, d) => sum + (parseFloat(d['% of institutional births']) || 0), 0) / data.length;
        const avgFullANC = data.reduce((sum, d) => sum + (parseFloat(d['% of Mothers who had full antenatal care']) || 0), 0) / data.length;
        
        return { avgMMR, avgInstitutionalBirths, avgFullANC };
    }

    analyzeBlockPerformance(data, keyIndicators) {
        return data.map(record => {
            const mmr = parseFloat(record['Maternal Mortality Ratio']) || 0;
            const institutionalBirths = parseFloat(record['% of institutional births']) || 0;
            const fullANC = parseFloat(record['% of Mothers who had full antenatal care']) || 0;
            const rank = parseInt(record['Block Rank']) || 999;

            // Identify strengths and weaknesses
            const strengths = [];
            const weaknesses = [];

            if (institutionalBirths > 85) strengths.push('High institutional births');
            else if (institutionalBirths < 70) weaknesses.push('Low institutional births');

            if (fullANC > 80) strengths.push('Good ANC coverage');
            else if (fullANC < 70) weaknesses.push('Poor ANC coverage');

            if (mmr < 120) strengths.push('Low MMR');
            else if (mmr > 160) weaknesses.push('High MMR');

            return {
                blockName: record['Development Block Name'],
                rank,
                mmr,
                institutionalBirths,
                fullANC,
                strengths,
                weaknesses
            };
        }).sort((a, b) => a.rank - b.rank);
    }

    summarizeContext(fullContext, isStateLevel) {
        // Extract key information from the full context for more efficient follow-up chats
        const lines = fullContext.split('\n').filter(line => line.trim());
        const summary = {};
        
        // Extract location info
        if (isStateLevel) {
            summary.location = "STATE: UTTAR PRADESH";
            summary.analysisLevel = "STATE-WIDE";
        } else {
            const districtLine = lines.find(line => line.startsWith('District:'));
            summary.location = districtLine || "District analysis";
            
            const blockLine = lines.find(line => line.startsWith('Specific Block:'));
            if (blockLine) summary.specificBlock = blockLine;
        }
        
        // Extract data summary
        summary.dataSummary = [];
        let inDataSummary = false;
        for (const line of lines) {
            if (line.includes('DATA SUMMARY:')) {
                inDataSummary = true;
                continue;
            } else if (inDataSummary && line.startsWith('-')) {
                summary.dataSummary.push(line);
            } else if (inDataSummary && !line.startsWith('-')) {
                inDataSummary = false;
            }
        }
        
        // Extract key indicators
        summary.keyIndicators = [];
        let inKeyIndicators = false;
        for (const line of lines) {
            if (line.includes('KEY INDICATORS ANALYSIS')) {
                inKeyIndicators = true;
                continue;
            } else if (inKeyIndicators && line.startsWith('-')) {
                summary.keyIndicators.push(line);
            } else if (inKeyIndicators && !line.startsWith('-') && line.trim()) {
                inKeyIndicators = false;
            }
        }
        
        // Extract top and underperforming areas
        summary.topPerforming = [];
        summary.underperforming = [];
        
        let inTopPerforming = false;
        let inUnderperforming = false;
        
        for (const line of lines) {
            if (line.includes('TOP PERFORMING')) {
                inTopPerforming = true;
                inUnderperforming = false;
                continue;
            } else if (line.includes('UNDERPERFORMING')) {
                inTopPerforming = false;
                inUnderperforming = true;
                continue;
            } else if (inTopPerforming && line.startsWith('-')) {
                summary.topPerforming.push(line);
            } else if (inUnderperforming && line.startsWith('-')) {
                summary.underperforming.push(line);
            } else if ((inTopPerforming || inUnderperforming) && !line.startsWith('-') && line.trim()) {
                inTopPerforming = false;
                inUnderperforming = false;
            }
        }
        
        // Format the summary as a string
        let summaryText = `${summary.location}\n${summary.analysisLevel || ''}\n`;
        
        if (summary.specificBlock) {
            summaryText += `${summary.specificBlock}\n`;
        }
        
        summaryText += "\nDATA SUMMARY:\n";
        summaryText += summary.dataSummary.slice(0, 3).join('\n') + '\n';
        
        summaryText += "\nKEY INDICATORS SUMMARY:\n";
        summaryText += summary.keyIndicators.slice(0, 5).join('\n') + '\n';
        
        summaryText += "\nTOP PERFORMING AREAS:\n";
        summaryText += summary.topPerforming.slice(0, 2).join('\n') + '\n';
        
        summaryText += "\nUNDERPERFORMING AREAS:\n";
        summaryText += summary.underperforming.slice(0, 2).join('\n');
        
        return summaryText;
    }

    resetChatHistory() {
        this.chatHistory = [];
        this.chatCount = 0;
    }

    async callLLMAPIStreaming(context, districtName, blockName, isStateLevel = false) {
        // Get system prompt from textarea (or fallback)
        let systemPrompt = this.defaultSystemPrompt;
        const textarea = document.getElementById('system-prompt-textarea');
        if (textarea && textarea.value.trim()) {
            systemPrompt = textarea.value.trim();
        }
        
        // Add request for follow-up questions to the context
        context += "\n\nPlease suggest 3-5 follow-up questions that would be relevant to this analysis at the end of your response, formatted as a section titled 'FOLLOW-UP QUESTIONS:' with each question on a new line starting with '- '";
        
        const response = await fetch(`${this.apiConfig.baseURL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4.1-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: context }
                ],
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`API call failed: ${error}`);
        }

        // Show results section and hide loading
        this.showResultsSection(districtName, blockName, isStateLevel);
        this.hideLoading();
        
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
                                this.updateStreamingResults(accumulatedContent, districtName, blockName, isStateLevel);
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete chunks
                        }
                    }
                }
            }
        } catch (error) {
            throw error;
        } finally {
            reader.releaseLock();
        }
        
        // Add the initial response to chat history
        const initialResponse = this.extractMainContent(accumulatedContent);
        this.addToChatHistory('assistant', initialResponse);
    }

    extractMainContent(content) {
        // Remove follow-up questions section for chat history
        const followUpRegex = /FOLLOW-UP QUESTIONS:[\s\n]+((?:- .*\n?)+)/i;
        return content.replace(followUpRegex, '').trim();
    }

    addToChatHistory(role, content) {
        this.chatHistory.push({ role, content });
        if (role === 'user') {
            this.chatCount++;
        }
    }

    async sendChatMessage(message) {
        if (this.chatCount >= this.maxChats) {
            this.showError("You've reached the maximum number of follow-up questions for this session. Please start a new analysis.");
            return;
        }
        
        if (!this.currentContext) {
            this.showError("No analysis context available. Please run an analysis first.");
            return;
        }
        
        try {
            this.showChatLoading();
            
            // Add user message to chat history
            this.addToChatHistory('user', message);
            
            // Update chat UI immediately
            this.updateChatUI();
            
            // Prepare context with summarized data and chat history
            const chatContext = `${this.currentContext}\n\nCHAT HISTORY:\n${this.formatChatHistory()}\n\nUSER QUESTION: ${message}`;
            
            // Get system prompt
            let systemPrompt = this.defaultSystemPrompt;
            const textarea = document.getElementById('system-prompt-textarea');
            if (textarea && textarea.value.trim()) {
                systemPrompt = textarea.value.trim();
            }
            
            // Call LLM API
            const response = await fetch(`${this.apiConfig.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4.1-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: chatContext }
                    ]
                }),
                stream: true
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API call failed: ${error}`);
            }
            
            const result = await response.json();
            const assistantResponse = result.choices[0].message.content;
            
            // Add assistant response to chat history
            this.addToChatHistory('assistant', assistantResponse);
            
            // Update chat UI
            this.updateChatUI();
            
            // Update remaining chats counter
            this.updateRemainingChats();
        } catch (error) {
            this.showError("Failed to send message: " + error.message);
        } finally {
            this.hideChatLoading();
        }
    }
    
    formatChatHistory() {
        return this.chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n');
    }
    
    updateChatUI() {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;
        
        // Clear existing messages
        const chatMessages = document.getElementById('chat-messages');
        
        // Create template for chat messages
        const template = html`
            <div class="chat-messages" id="chat-messages">
                ${this.chatHistory.map(msg => html`
                    <div class="chat-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}">
                        <div class="message-content">
                            ${unsafeHTML(marked.parse(msg.content))}
                        </div>
                    </div>
                `)}
            </div>
        `;
        
        render(template, chatMessages);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    showChatLoading() {
        const loadingIndicator = document.getElementById('chat-loading');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('d-none');
        }
    }
    
    hideChatLoading() {
        const loadingIndicator = document.getElementById('chat-loading');
        if (loadingIndicator) {
            loadingIndicator.classList.add('d-none');
        }
    }
    
    updateRemainingChats() {
        const remainingChats = document.getElementById('remaining-chats');
        if (remainingChats) {
            const remaining = this.maxChats - this.chatCount;
            remainingChats.textContent = `${remaining} of ${this.maxChats} follow-ups remaining`;
            
            if (remaining <= 1) {
                remainingChats.classList.add('text-danger');
            } else {
                remainingChats.classList.remove('text-danger');
            }
        }
    }

    showResultsSection(districtName, blockName, isStateLevel = false) {
        const resultsSection = document.getElementById('results-section');
        resultsSection.classList.remove('d-none');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    updateStreamingResults(content, districtName, blockName, isStateLevel = false) {
        const resultsContent = document.getElementById('results-content');
        
        if (resultsContent) {
            // Process the content to extract follow-up questions
            let mainContent = content;
            let followUpQuestions = [];
            
            // Check if there's a follow-up questions section
            const followUpRegex = /FOLLOW-UP QUESTIONS:[\s\n]+((?:- .*\n?)+)/i;
            const match = content.match(followUpRegex);
            
            if (match) {
                // Extract questions and remove them from main content for separate display
                followUpQuestions = match[1].split('\n')
                    .filter(line => line.trim().startsWith('- '))
                    .map(line => line.trim().substring(2).trim());
                
                // Remove the follow-up section from the main content
                mainContent = content.replace(followUpRegex, '').trim();
            }
            
            const htmlContent = marked.parse(mainContent);
            
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
                    ${unsafeHTML(htmlContent)}
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
                                        @click=${(e) => this.handleFollowUpClick(e, question)}>
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
                        <span class="badge bg-secondary" id="remaining-chats">${this.maxChats} of ${this.maxChats} follow-ups remaining</span>
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
                                ${this.chatCount >= this.maxChats ? 'disabled' : ''}>
                            <button class="btn btn-primary" id="follow-up-send-btn" 
                                ${this.chatCount >= this.maxChats ? 'disabled' : ''}>
                                <i class="bi bi-send"></i> Ask
                            </button>
                        </div>
                        <small class="text-muted mt-1">
                            You can ask up to ${this.maxChats} follow-up questions about the analysis results
                        </small>
                    </div>
                </div>
            `;
            
            render(template, resultsContent);
            
            // Setup follow-up input event listeners
            this.setupFollowUpEventListeners();
        }
    }
    
    setupFollowUpEventListeners() {
        const followUpInput = document.getElementById('follow-up-input');
        const sendButton = document.getElementById('follow-up-send-btn');
        
        if (!followUpInput || !sendButton) return;
        
        // Send on button click
        sendButton.addEventListener('click', () => {
            const message = followUpInput.value.trim();
            if (message) {
                this.sendFollowUpQuestion(message);
                followUpInput.value = '';
            }
        });
        
        // Send on Enter key
        followUpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const message = followUpInput.value.trim();
                if (message) {
                    this.sendFollowUpQuestion(message);
                    followUpInput.value = '';
                }
                e.preventDefault();
            }
        });
    }

    handleFollowUpClick(event, question) {
        // Send the follow-up question
        this.sendFollowUpQuestion(question);
    }
    
    async sendFollowUpQuestion(question) {
        if (this.chatCount >= this.maxChats) {
            this.showError("You've reached the maximum number of follow-up questions for this session. Please start a new analysis.");
            return;
        }
        
        if (!this.currentContext) {
            this.showError("No analysis context available. Please run an analysis first.");
            return;
        }
        
        try {
            this.showFollowUpLoading();
            
            // Add user message to chat history
            this.addToChatHistory('user', question);
            
            // Append the user question to the follow-up section
            this.appendFollowUpQuestion(question);
            
            // Prepare context with summarized data and chat history
            const chatContext = `${this.currentContext}\n\nCHAT HISTORY:\n${this.formatChatHistory()}\n\nUSER QUESTION: ${question}`;
            
            // Get system prompt
            let systemPrompt = this.defaultSystemPrompt;
            const textarea = document.getElementById('system-prompt-textarea');
            if (textarea && textarea.value.trim()) {
                systemPrompt = textarea.value.trim();
            }
            
            // Call LLM API with streaming
            const response = await fetch(`${this.apiConfig.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiConfig.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4.1-mini',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: chatContext }
                    ],
                    stream: true
                })
            });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API call failed: ${error}`);
            }
            
            // Create a placeholder for the response
            const responseId = this.appendFollowUpResponsePlaceholder();
            
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
                                    this.updateFollowUpResponse(responseId, accumulatedContent);
                                }
                            } catch (e) {
                                // Ignore parsing errors for incomplete chunks
                            }
                        }
                    }
                }
            } catch (error) {
                throw error;
            } finally {
                reader.releaseLock();
            }
            
            // Add assistant response to chat history
            this.addToChatHistory('assistant', accumulatedContent);
            
            // Update remaining chats counter
            this.updateRemainingChats();
        } catch (error) {
            this.showError("Failed to send message: " + error.message);
        } finally {
            this.hideFollowUpLoading();
        }
    }
    
    appendFollowUpQuestion(question) {
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
    
    appendFollowUpResponsePlaceholder() {
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
    
    updateFollowUpResponse(responseId, content) {
        if (!responseId) return;
        
        const responseContent = document.getElementById(`${responseId}-content`);
        if (responseContent) {
            responseContent.innerHTML = marked.parse(content);
        }
    }
    
    appendFollowUpResponse(response) {
        // This method is no longer used since we're using streaming responses
    }
    
    showFollowUpLoading() {
        const loadingIndicator = document.getElementById('follow-up-loading');
        if (loadingIndicator) {
            loadingIndicator.classList.remove('d-none');
        }
    }
    
    hideFollowUpLoading() {
        const loadingIndicator = document.getElementById('follow-up-loading');
        if (loadingIndicator) {
            loadingIndicator.classList.add('d-none');
        }
    }
    
    updateRemainingChats() {
        const remainingChats = document.getElementById('remaining-chats');
        if (remainingChats) {
            const remaining = this.maxChats - this.chatCount;
            remainingChats.textContent = `${remaining} of ${this.maxChats} follow-ups remaining`;
            
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
    }

    showLoading(message = "Loading...") {
        const loading = document.getElementById('loading-indicator');
        loading.querySelector('p').textContent = message;
        loading.classList.remove('d-none');
    }

    hideLoading() {
        document.getElementById('loading-indicator').classList.add('d-none');
    }

    showError(message) {
        document.getElementById('error-message').textContent = message;
        new bootstrap.Modal(document.getElementById('error-modal')).show();
    }

    showSuccess(message) {
        // Create a temporary alert
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

    updateDataStatus(message) {
        document.getElementById('data-status-text').textContent = message;
    }

    checkDataStatus() {
        if (this.data.length === 0) {
            this.updateDataStatus("No data loaded. Click 'Load Sample Data' to begin.");
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new HealthAnalyzer();
}); 