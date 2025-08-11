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

CURRENT SITUATION:
- Total districts analyzed: ${stateStats.totalDistricts}
- Total blocks analyzed: ${data.length}
- State average Maternal Mortality Ratio: ${stateStats.avgMMR.toFixed(1)}
- State average Institutional Births: ${stateStats.avgInstitutionalBirths.toFixed(1)}%
- State average Full ANC: ${stateStats.avgFullANC.toFixed(1)}%

DISTRICT RANKING ANALYSIS:
${districtPerformance.map((district, index) => 
  `${index + 1}. ${district.districtName}: Rank ${index + 1} out of ${stateStats.totalDistricts} districts, MMR: ${district.avgMMR.toFixed(1)}, Institutional Births: ${district.avgInstitutionalBirths.toFixed(1)}%`
).join('\n')}

INDICATOR-WISE DISTRICT PERFORMANCE:
${KEY_INDICATORS.map(indicator => {
  const districtValues = districtPerformance.map(district => ({
    name: district.districtName,
    value: indicator === 'Maternal Mortality Ratio' ? district.avgMMR : 
           indicator === '% of institutional births' ? district.avgInstitutionalBirths : 
           district.avgFullANC
  })).sort((a, b) => indicator === 'Maternal Mortality Ratio' ? a.value - b.value : b.value - a.value);
  
  return `\n${indicator}:
${districtValues.slice(0, 5).map((d, i) => `  Rank ${i + 1}: ${d.name} (${d.value.toFixed(1)}${indicator === 'Maternal Mortality Ratio' ? '' : '%'})`).join('\n')}
  Districts needing attention: ${districtValues.slice(-3).map(d => `${d.name} (Rank ${districtValues.length - districtValues.indexOf(d)}, Value: ${d.value.toFixed(1)}${indicator === 'Maternal Mortality Ratio' ? '' : '%'})`).join(', ')}`;
}).join('\n')}
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

CURRENT SITUATION:
Maternal Mortality Rate for ${districtName} district is ${districtStats.avgMMR.toFixed(1)}. This district has ${data.length} blocks.
- District average Maternal Mortality Ratio: ${districtStats.avgMMR.toFixed(1)} 
- District average Institutional Births: ${districtStats.avgInstitutionalBirths.toFixed(1)}%
- District average Full ANC: ${districtStats.avgFullANC.toFixed(1)}%

BACKGROUND:
From the available data, maternal mortality rate depends on factors such as institutional births, antenatal care coverage, and other socio-economic factors. These are some of the indicators available in our dataset:

INDICATOR-WISE BLOCK ANALYSIS:

MATERNAL MORTALITY RATIO - Block-wise Ranking:
${data.map((record, index) => 
  `${index + 1}. ${record['Development Block Name']}: MMR ${record['Maternal Mortality Ratio']}, Block Rank ${record['Block Rank'] || 'N/A'} within district`
).join('\n')}

INSTITUTIONAL BIRTHS - Block-wise Performance:
${data.map((record, index) => {
  const value = parseFloat(record['% of institutional births']) || 0;
  return `${index + 1}. ${record['Development Block Name']}: ${value.toFixed(1)}%, Rank within district: ${index + 1}`;
}).sort((a, b) => parseFloat(b.split(': ')[1]) - parseFloat(a.split(': ')[1])).join('\n')}
Blocks needing attention for institutional births: ${data.filter(r => (parseFloat(r['% of institutional births']) || 0) < districtStats.avgInstitutionalBirths).map(r => r['Development Block Name']).join(', ')}

ANTENATAL CARE - Block-wise Performance:
${data.map((record, index) => {
  const value = parseFloat(record['% of Mothers who had full antenatal care']) || 0;
  return `${index + 1}. ${record['Development Block Name']}: ${value.toFixed(1)}%, Rank within district: ${index + 1}`;
}).sort((a, b) => parseFloat(b.split(': ')[1]) - parseFloat(a.split(': ')[1])).join('\n')}
Blocks needing attention for ANC coverage: ${data.filter(r => (parseFloat(r['% of Mothers who had full antenatal care']) || 0) < districtStats.avgFullANC).map(r => r['Development Block Name']).join(', ')}

FOCUS AREAS BY INDICATOR:
- For Maternal Mortality Rate: Focus on blocks ranking in bottom quartile
- For Institutional Births: Intervention required in blocks: ${data.filter(r => (parseFloat(r['% of institutional births']) || 0) < districtStats.avgInstitutionalBirths).map(r => r['Development Block Name']).join(', ')}
- For ANC Coverage: Intervention required in blocks: ${data.filter(r => (parseFloat(r['% of Mothers who had full antenatal care']) || 0) < districtStats.avgFullANC).map(r => r['Development Block Name']).join(', ')}
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

/**
 * Prepare simplified context for data inquiry questions about a specific district
 * @param {Array} data - Array of data records for a district
 * @param {string} districtName - Name of district
 * @param {string} userQuery - User's query
 * @returns {string} Simplified context for data inquiry
 */
export function prepareDataInquiryContext(data, districtName, userQuery) {
  if (!data?.length) return '';
  
  const districtStats = calculateDistrictStats(data);
  
  // Calculate district ranking (simplified)
  const allDistricts = [...new Set(data.map(d => d['District Name']))];
  const totalDistricts = 75; // Known from UP data
  
  const context = `
USER QUESTION: "${userQuery}"

DISTRICT: ${districtName}
- Total blocks: ${data.length}
- Maternal Mortality Ratio: ${districtStats.avgMMR.toFixed(1)} per 100k live births
- Institutional births: ${districtStats.avgInstitutionalBirths.toFixed(1)}%
- Full ANC coverage: ${districtStats.avgFullANC.toFixed(1)}%

BLOCK-WISE DATA:
${data.map(record => 
  `${record['Development Block Name']}: MMR ${record['Maternal Mortality Ratio']}, Institutional births ${record['% of institutional births']}%, Full ANC ${record['% of Mothers who had full antenatal care']}%`
).join('\n')}

STATE CONTEXT:
- Total districts in Uttar Pradesh: ${totalDistricts}
- This district has ${data.length} blocks
`;

  return context;
}

/**
 * Prepare simplified context for state-level data inquiry questions
 * @param {Array} data - Array of all data records
 * @param {string} userQuery - User's query
 * @returns {string} Simplified context for state data inquiry
 */
export function prepareStateDataInquiryContext(data, userQuery) {
  if (!data?.length) return '';
  
  const stateStats = calculateStateStats(data);
  const districtPerformance = analyzeDistrictPerformance(data);
  
  const context = `
USER QUESTION: "${userQuery}"

UTTAR PRADESH STATE DATA:
- Total districts: ${stateStats.totalDistricts}
- Total blocks: ${data.length}
- State average MMR: ${stateStats.avgMMR.toFixed(1)} per 100k live births
- State average institutional births: ${stateStats.avgInstitutionalBirths.toFixed(1)}%
- State average Full ANC: ${stateStats.avgFullANC.toFixed(1)}%

DISTRICT RANKINGS (by MMR - lower is better):
${districtPerformance.slice(0, 10).map((district, index) => 
  `${index + 1}. ${district.districtName}: MMR ${district.avgMMR.toFixed(1)}, Institutional births ${district.avgInstitutionalBirths.toFixed(1)}%`
).join('\n')}

BOTTOM PERFORMING DISTRICTS:
${districtPerformance.slice(-5).map((district, index) => 
  `${districtPerformance.length - 4 + index}. ${district.districtName}: MMR ${district.avgMMR.toFixed(1)}, Institutional births ${district.avgInstitutionalBirths.toFixed(1)}%`
).join('\n')}
`;

  return context;
} 