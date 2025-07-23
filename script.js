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
        this.init();
    }

    async init() {
        await this.loadLLMConfig();
        this.setupEventListeners();
        this.setupFormSaving();
        this.checkDataStatus();
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
            
            this.updateDataStatus(`Loaded ${this.data.length} records from sample data`);
            this.showSuccess(`Successfully loaded ${this.data.length} health records!`);
            
        } catch (error) {
            this.showError("Failed to load sample data: " + error.message);
            this.updateDataStatus("Failed to load data");
        } finally {
            this.hideLoading();
        }
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
        const districtName = formData.get('district-name');
        const blockName = formData.get('block-name');
        const userQuery = formData.get('user-query');

        if (!districtName || !userQuery) {
            this.showError("Please fill in the district name and your query.");
            return;
        }

        try {
            this.showLoading("Analyzing health data...");
            await this.performAnalysis(districtName, blockName, userQuery);
        } catch (error) {
            this.showError("Analysis failed: " + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async performAnalysis(districtName, blockName, userQuery) {
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
        const analysisContext = this.prepareAnalysisContext(relevantData, districtName, blockName, userQuery);
        
        // Call LLM API with streaming
        await this.callLLMAPIStreaming(analysisContext, districtName, blockName);
    }

    prepareAnalysisContext(data, districtName, blockName, userQuery) {
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

    async callLLMAPIStreaming(context, districtName, blockName) {
        const systemPrompt = `You are a governance expert assistant helping district-level administrators in India.

The user wants to solve the following issue based on the available data from Uttar Pradesh.

Based on the available data, provide:

1. **Relevant Indicators** from national or state-level government programs (e.g., NHM, Aspirational Districts, NITI Aayog) tied to the problem.

2. **District Performance** and rank across the state on these indicators.

3. **Block-wise Breakdown** to identify weak-performing blocks that need immediate attention.

4. **Actionable Suggestions** with specific targets (e.g., "improving institutional deliveries from 75% to 85% may improve the ranking from 35 to 25").

5. **Predicted Impact** based on improvements in indicators with realistic timelines.

6. **Ranking** of the district and block based on the indicators, How much the rank will improve if the indicators are improved.

Present insights in a human-readable, decision-friendly format that government officers can act upon immediately. Use bullet points, numbers, and clear recommendations. Be concise but comprehensive.`;
        
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
        this.showResultsSection(districtName, blockName);
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
                                this.updateStreamingResults(accumulatedContent, districtName, blockName);
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
    }

    showResultsSection(districtName, blockName) {
        const resultsSection = document.getElementById('results-section');
        resultsSection.classList.remove('d-none');
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    updateStreamingResults(content, districtName, blockName) {
        const resultsContent = document.getElementById('results-content');
        
        if (resultsContent) {
            const htmlContent = marked.parse(content);
            
            const template = html`
                <div class="analysis-header mb-4">
                    <h5 class="text-primary">
                        <i class="bi bi-geo-alt-fill"></i>
                        Analysis for ${districtName}${blockName ? ` - ${blockName} Block` : ''}
                    </h5>
                    <p class="text-muted">Generated on ${new Date().toLocaleString()}</p>
                </div>
                
                <div class="analysis-content">
                    ${unsafeHTML(htmlContent)}
                </div>
                
                <div class="mt-4 p-3 bg-light rounded">
                    <small class="text-muted">
                        <i class="bi bi-info-circle"></i>
                        <strong>Data Sources:</strong> National Health Mission (NHM), NITI Aayog Health Index, 
                        Janani Suraksha Yojana (JSY) data, and state health department records.
                    </small>
                </div>
            `;
            
            render(template, resultsContent);
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