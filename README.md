# District Health Performance Analyzer

A web application designed to help Indian government officers understand and improve their district's public health performance through AI-powered analysis.

## 🏥 Features

- **Data Loading**: Load health indicator data from CSV files
- **AI Analysis**: Use LLM APIs to analyze health performance and provide actionable insights
- **District Focus**: Analyze specific districts and blocks in Uttar Pradesh
- **Performance Comparison**: Compare block-wise performance within districts
- **Actionable Insights**: Get specific recommendations for improving health outcomes
- **What-if Simulations**: Understand potential impact of interventions

## 🚀 Quick Start

1. **Clone or download** this repository
2. **Open `index.html`** in a modern web browser
3. **Configure LLM API** by clicking "Configure LLM API" button
4. **Load sample data** by clicking "Load Sample Data" button
5. **Enter your query** and analyze district health performance

## 📊 Sample Data

The application includes sample health data (`data.csv`) with the following key indicators:

- Maternal Mortality Ratio (MMR)
- Institutional birth percentages
- Antenatal care coverage
- Janani Suraksha Yojana (JSY) implementation
- Iron and folic acid supplementation
- Block-wise performance rankings

## 🔧 API Configuration

The app supports multiple LLM providers:

- **OpenAI** (GPT models)
- **OpenRouter** (Multiple model access)
- **Anthropic** (Claude models)
- **Custom providers** (Any OpenAI-compatible API)

### Setup Steps:

1. Click "Configure LLM API"
2. Select your provider's base URL
3. Enter your API key
4. The app will test connectivity and save your settings

## 📝 Usage Examples

### Example Queries:

1. **"I want to reduce maternal mortality rate in Agra, Uttar Pradesh"**
   - Analyzes MMR-related indicators
   - Identifies underperforming blocks
   - Suggests specific interventions

2. **"How can we improve institutional delivery rates in Aligarh?"**
   - Focuses on delivery-related metrics
   - Compares with best-performing blocks
   - Provides actionable recommendations

3. **"What are the main health challenges in Fatehabad block?"**
   - Block-specific analysis
   - Identifies key weak areas
   - Suggests targeted interventions

## 🎯 Key Health Indicators

The application analyzes multiple health indicators:

### Maternal Health
- Maternal Mortality Ratio
- Institutional births percentage
- Full antenatal care coverage
- Iron and folic acid supplementation
- Postnatal care within 48 hours

### Program Implementation
- Janani Suraksha Yojana (JSY) coverage
- Free transport facility utilization
- JSSK (Janani Shishu Suraksha Karyakram) implementation
- ASHA worker engagement

### Quality Metrics
- C-section delivery rates
- Ultrasound coverage
- Blood transfusion availability
- Complaint resolution rates

## 🔍 Analysis Features

### 1. **Relevant Indicators**
- Identifies key metrics tied to your specific problem
- Links to national programs (NHM, Aspirational Districts, NITI Aayog)

### 2. **Performance Ranking**
- Shows district performance across the state
- Compares with similar districts

### 3. **Block-wise Breakdown**
- Identifies best and worst performing blocks
- Highlights specific areas needing attention

### 4. **Actionable Suggestions**
- Specific, measurable recommendations
- Target improvements with realistic timelines

### 5. **Impact Predictions**
- Estimates ranking improvements from interventions
- Provides "what-if" scenarios

### 6. **Root Cause Analysis**
- Considers factors beyond the data
- Addresses social, infrastructure, and systemic issues

## 🛠️ Technical Details

### Technologies Used
- **Frontend**: HTML5, CSS3 (Bootstrap 5), JavaScript ES6
- **Data Processing**: CSV parsing and analysis
- **AI Integration**: OpenAI-compatible APIs
- **Form Persistence**: saveform library
- **API Configuration**: bootstrap-llm-provider

### File Structure
```
├── index.html          # Main application interface
├── app.js              # Core JavaScript functionality
├── data.csv            # Sample health data
├── README.md           # This documentation
└── .gitignore          # Git ignore rules
```

### Browser Requirements
- Modern browser with ES6 support
- JavaScript enabled
- Internet connection for LLM API calls

## 📋 Data Format

The CSV data should include these key columns:

- `District Name`: Name of the district
- `Development Block Name`: Name of the block
- `Block Rank`: Performance ranking
- `Maternal Mortality Ratio`: MMR value
- `% of institutional births`: Institutional delivery percentage
- `% of Mothers who had full antenatal care`: ANC coverage
- Additional health indicators as per requirement

## 🎨 User Interface

The application features a clean, government-friendly interface:

- **Bootstrap-based design** for professional appearance
- **Responsive layout** works on desktop and mobile
- **Clear error handling** with user-friendly messages
- **Loading indicators** for better user experience
- **Form persistence** saves your inputs automatically

## 🔒 Privacy & Security

- **Local processing**: Data analysis happens in your browser
- **No data storage**: CSV data is not sent to external servers
- **API key security**: Your LLM API keys are stored locally
- **HTTPS recommended**: Use HTTPS for production deployments

## 🤝 Contributing

To contribute to this project:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

For technical support or questions:

- Check the browser console for error messages
- Verify your API configuration
- Ensure data.csv is in the correct format
- Test with a different LLM provider if needed

## 📄 License

This project is designed for government use in improving public health outcomes. Please ensure compliance with relevant data protection and government IT policies.

---

**Built for Indian government officers to make data-driven decisions in public health.** 