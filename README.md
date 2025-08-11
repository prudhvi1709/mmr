# District Health Performance Analyzer

A web application designed to help government administrators in Uttar Pradesh, India analyze health data, identify critical issues, compare performance across districts and blocks, and develop targeted interventions to improve public health outcomes.

## Features

- **Multi-level Analysis**
  - State-level analysis across all districts in Uttar Pradesh
  - District-level analysis with detailed block-wise breakdowns
  - Optional block-specific focus for targeted interventions

- **Interactive Health Data Exploration**
  - Performance comparison across geographic units
  - Identification of top-performing and underperforming areas
  - Key health indicator analysis and ranking

- **AI-Powered Insights**
  - Actionable recommendations based on data patterns
  - What-if simulations for potential interventions
  - Root cause analysis beyond available data points

- **Interactive Follow-up System**
  - Ask up to 5 follow-up questions about analysis results
  - Contextual responses based on previous analysis
  - Drill-down capabilities for deeper understanding

## Project Structure

The application follows a modular architecture for better maintainability:

- `index.html` - Main HTML structure and UI components
- `script.js` - Application entry point and core functionality
- `config.js` - Configuration settings and system prompts
- `data.js` - Data loading, parsing, and statistical analysis
- `api.js` - LLM API communication and chat management
- `analysis.js` - Health data context preparation and analysis
- `ui.js` - User interface rendering and interaction handling
- `data.csv` - Sample health data for Uttar Pradesh districts

## Setup and Usage

1. Open `index.html` in a web browser
2. Click "Configure LLM API" to set up your API credentials
   - The application uses bootstrap-llm-provider for API configuration
3. Wait for the health data to auto-load from data.csv (happens automatically on page load)
4. Select analysis level (State or District)
   - For district-level analysis, select a specific district and optionally a block
5. Enter your query about health issues (e.g., "How can we reduce maternal mortality in Agra?")
6. View analysis results with visualizations and recommendations
7. Ask follow-up questions for deeper insights

## Technologies Used

- **Frontend**
  - Modern JavaScript (ES6+)
  - Bootstrap 5 for responsive UI components
  - lit-html for efficient templating and rendering

- **Data Processing**
  - Custom CSV parsing and statistical analysis
  - Functional programming approach for data transformations

- **AI Integration**
  - OpenAI API for analysis and insights
  - Streaming responses for better user experience
  - Context-aware follow-up capabilities

## Requirements

- Modern web browser (Chrome, Firefox, Edge, etc.)
- No server setup required; runs fully client-side

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for improvements or bug fixes.

## Support

For questions or support, please open an issue on GitHub.

## Acknowledgments

If you used any third-party resources, datasets, or libraries, acknowledge them.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.