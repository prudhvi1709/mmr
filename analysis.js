import { KEY_INDICATORS } from './config.js';
import { calculateStateStats, analyzeDistrictPerformance, calculateDistrictStats, analyzeBlockPerformance } from './data.js';

/**
 * Prepare context for state-level analysis
 * @param {Array} data - Array of data records
 * @param {string} userQuery - User's query
 * @returns {string} Analysis context
 */
export function prepareStateAnalysisContext(data, userQuery) {
  if (!data?.length) return '';
  
  // Calculate state-level statistics
  const stateStats = calculateStateStats(data);
  
  // Get district-wise performance ranking
  const districtPerformance = analyzeDistrictPerformance(data);
  
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
${KEY_INDICATORS.map(indicator => {
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

/**
 * Prepare context for district-level analysis
 * @param {Array} data - Array of data records for a district
 * @param {string} districtName - Name of district
 * @param {string|null} blockName - Name of block (optional)
 * @param {string} userQuery - User's query
 * @returns {string} Analysis context
 */
export function prepareDistrictAnalysisContext(data, districtName, blockName, userQuery) {
  if (!data?.length) return '';
  
  // Calculate district-level statistics
  const districtStats = calculateDistrictStats(data);
  
  // Find best and worst performing blocks
  const blockPerformance = analyzeBlockPerformance(data, KEY_INDICATORS);

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
${KEY_INDICATORS.map(indicator => {
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

/**
 * Summarize context for more efficient follow-up chats
 * @param {string} fullContext - Full analysis context
 * @param {boolean} isStateLevel - Whether analysis is state-level
 * @returns {string} Summarized context
 */
export function summarizeContext(fullContext, isStateLevel) {
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