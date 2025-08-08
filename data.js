// Data loading and processing functions

/**
 * Parse CSV text into array of objects
 * @param {string} csvText - Raw CSV text
 * @returns {Array} Array of objects with headers as keys
 */
export function parseCSV(csvText) {
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

/**
 * Calculate state-level statistics from data
 * @param {Array} data - Array of data records
 * @returns {Object} State statistics
 */
export function calculateStateStats(data) {
  if (!data?.length) return {};
  
  const avgMMR = data.reduce((sum, d) => sum + (parseFloat(d['Maternal Mortality Ratio']) || 0), 0) / data.length;
  const avgInstitutionalBirths = data.reduce((sum, d) => sum + (parseFloat(d['% of institutional births']) || 0), 0) / data.length;
  const avgFullANC = data.reduce((sum, d) => sum + (parseFloat(d['% of Mothers who had full antenatal care']) || 0), 0) / data.length;
  const totalDistricts = [...new Set(data.map(d => d['District Name']))].length;
  
  return { avgMMR, avgInstitutionalBirths, avgFullANC, totalDistricts };
}

/**
 * Analyze district performance and return sorted results
 * @param {Array} data - Array of data records
 * @returns {Array} Sorted array of district performance data
 */
export function analyzeDistrictPerformance(data) {
  if (!data?.length) return [];
  
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
  return Object.keys(districtGroups)
    .map(districtName => {
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
    })
    .sort((a, b) => a.avgMMR - b.avgMMR); // Sort by MMR (lower is better)
}

/**
 * Calculate district-level statistics
 * @param {Array} data - Array of data records for a district
 * @returns {Object} District statistics
 */
export function calculateDistrictStats(data) {
  if (!data?.length) return {};
  
  const avgMMR = data.reduce((sum, d) => sum + (parseFloat(d['Maternal Mortality Ratio']) || 0), 0) / data.length;
  const avgInstitutionalBirths = data.reduce((sum, d) => sum + (parseFloat(d['% of institutional births']) || 0), 0) / data.length;
  const avgFullANC = data.reduce((sum, d) => sum + (parseFloat(d['% of Mothers who had full antenatal care']) || 0), 0) / data.length;
  
  return { avgMMR, avgInstitutionalBirths, avgFullANC };
}

/**
 * Analyze block performance within a district
 * @param {Array} data - Array of data records for blocks
 * @param {Array} keyIndicators - List of key indicators to analyze
 * @returns {Array} Sorted array of block performance data
 */
export function analyzeBlockPerformance(data, keyIndicators) {
  if (!data?.length) return [];
  
  return data.map(record => {
    const mmr = parseFloat(record['Maternal Mortality Ratio']) || 0;
    const institutionalBirths = parseFloat(record['% of institutional births']) || 0;
    const fullANC = parseFloat(record['% of Mothers who had full antenatal care']) || 0;
    const rank = parseInt(record['Block Rank']) || 999;

    return {
      blockName: record['Development Block Name'],
      rank,
      mmr,
      institutionalBirths,
      fullANC,
      indicators: {
        'Maternal Mortality Ratio': mmr,
        '% of institutional births': institutionalBirths,
        '% of Mothers who had full antenatal care': fullANC
      }
    };
  }).sort((a, b) => a.rank - b.rank);
} 