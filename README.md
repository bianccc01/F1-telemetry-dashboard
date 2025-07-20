# F1 Telemetry Visualization Dashboard

This project is an interactive web-based dashboard for visualizing Formula 1 telemetry data. It allows users to explore and compare lap data from different drivers, sessions, and Grand Prix events. The dashboard is built using D3.js for data visualization and fetches data from the Open F1 API.

## Features

*   **Interactive Data Exploration:** Select specific years, Grand Prix, sessions, and up to three drivers to compare their performance.
*   **Detailed Lap Telemetry:** Visualize key telemetry data for a selected lap, including:
    *   Speed (km/h)
    *   Throttle (%)
    *   Brake (%)
    *   Gear
*   **Race-Wide Analysis:**
    *   **Race Chart:** A comprehensive overview of the entire race, showing lap times for selected drivers.
    *   **Violin Plot:** A distribution of lap times for a selected driver, providing insights into their consistency.
*   **Track Map:** A visual representation of the circuit, with car markers showing the positions of the selected drivers.
*   **Weather Information:** View the weather conditions for the selected session.
*   **Driver Information:** See details about the selected drivers, including their team and the tyre compound used for a specific lap.
*   **Responsive Design:** The dashboard is designed to work on different screen sizes.

## How to Use

1.  **Open `index.html` in your web browser or click [here](https://bianccc01.github.io/Infoviz-f1-telemetry-dashboard/).**
2.  **Select a Year:** Use the dropdown menu in the sidebar to choose a year.
3.  **Select a Grand Prix:** Once a year is selected, the Grand Prix dropdown will be populated. Choose a Grand Prix to continue.
4.  **Select a Session:** After selecting a Grand Prix, choose a session (e.g., Race, Qualifying, Practice).
5.  **Select Drivers:** You can select up to three drivers to compare. The driver selection dropdowns will become active sequentially.
6.  **Load Data:** Once you have selected a lap for each driver, click the "Load Data" button to view the telemetry charts.
7.  **Explore the Charts:**
    *   Use the main chart area to view the detailed telemetry data for the selected laps.
    *   Hover over the charts to see tooltips with specific data points.
    *   Click on a lap in the Race Chart to load the telemetry data for that specific lap.
    *   Use the "Back to Race View" button to return to the race-wide charts.

## Technologies Used

*   **HTML5**
*   **CSS3**
*   **JavaScript (ES6+)**
*   **D3.js (v7):** For creating the interactive data visualizations.
*   **Open F1 API:** For fetching the telemetry data.

## Data Source

All the data used in this project is provided by the [Open F1 API](https://openf1.org/).

## Project Structure

```
.
├── css/
│   └── style.css         # Main stylesheet
├── js/
│   ├── api.js            # Handles communication with the Open F1 API
│   ├── main.js           # Main application logic
│   ├── telemetry.js      # Telemetry-related functions
│   └── charts/
│       ├── brakeChart.js
│       ├── gearChart.js
│       ├── raceChart.js
│       ├── speedChart.js
│       ├── throttleChart.js
│       ├── tooltip.js
│       ├── trackMap.js
│       ├── violinPlot.js
│       └── zoomManager.js
├── index.html            # Main HTML file
└── README.md             # This file
```

## Future Improvements

*   **Add more telemetry channels:** Such as RPM, DRS status, and energy recovery systems (ERS).
*   **Implement a live session mode:** To visualize telemetry data in real-time.
*   **Improve the user interface:** With more advanced filtering and comparison options.
*   **Add driver and team statistics:** To provide more context to the data.
