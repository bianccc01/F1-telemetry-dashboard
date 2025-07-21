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

## Charts

This section provides a detailed explanation of each chart available on the dashboard.

### Race Chart

The Race Chart provides a comprehensive overview of the entire race for the selected drivers. It plots the lap times for each driver against the lap number.

**Features:**

*   **Lap Times:** Each point on the chart represents a lap, with the y-axis showing the lap time and the x-axis showing the lap number.
*   **Driver Comparison:** The chart displays data for up to three drivers, each represented by a different color.
*   **Tyre Compound:** The color of each point indicates the tyre compound used for that lap (Soft, Medium, Hard, Intermediate, or Wet).
*   **Interactive Tooltip:** Hovering over a point reveals a tooltip with detailed information, including the driver's name, lap number, lap time, and an image of the tyre compound.
*   **Lap Selection:** Clicking on a point in the Race Chart will load the detailed telemetry data for that specific lap in the individual lap charts.
*   **Zoom and Pan:** You can zoom in on specific sections of the race and pan horizontally to explore the data in more detail.

![Race Chart](httpshttps://i.imgur.com/example-race-chart.png)

### Violin Plot

The Violin Plot provides a visual representation of the distribution of lap times for each selected driver, offering insights into their consistency.

**Features:**

*   **Lap Time Distribution:** The width of the violin shape represents the density of lap times at that particular value. A wider section indicates a higher concentration of lap times.
*   **Median and Interquartile Range:** The chart displays the median lap time (as a white dot) and the interquartile range (as a black bar), which represents the middle 50% of the data.
*   **Driver Comparison:** The chart displays violin plots for each selected driver, allowing for a direct comparison of their consistency.
*   **Interactive Tooltip:** Hovering over a violin plot reveals a tooltip with the driver's name, median lap time, and interquartile range.

![Violin Plot](https://i.imgur.com/example-violin-plot.png)

### Speed Chart

The Speed Chart displays the speed of the car in km/h over the distance of a single lap.

**Features:**

*   **Speed Profile:** The chart shows how the driver's speed changes throughout the lap, highlighting acceleration and deceleration zones.
*   **Driver Comparison:** The chart can display data for up to three drivers, allowing for a direct comparison of their speed profiles.
*   **Interactive Tooltip:** Hovering over the chart reveals a tooltip with the exact speed of each driver at that specific distance.
*   **Zoom and Pan:** You can zoom in on specific sections of the lap and pan horizontally to explore the data in more detail.

![Speed Chart](https://i.imgur.com/example-speed-chart.png)

### Throttle Chart

The Throttle Chart displays the percentage of throttle application over the distance of a single lap.

**Features:**

*   **Throttle Application:** The chart shows when and how much the driver is applying the throttle, from 0% (coasting) to 100% (full throttle).
*   **Driver Comparison:** The chart can display data for up to three drivers, allowing for a direct comparison of their throttle application strategies.
*   **Interactive Tooltip:** Hovering over the chart reveals a tooltip with the exact throttle percentage of each driver at that specific distance.
*   **Zoom and Pan:** You can zoom in on specific sections of the lap and pan horizontally to explore the data in more detail.

![Throttle Chart](https://i.imgur.com/example-throttle-chart.png)

### Brake Chart

The Brake Chart displays the percentage of brake application over the distance of a single lap.

**Features:**

*   **Brake Application:** The chart shows when and how much the driver is applying the brakes, from 0% to 100%.
*   **Driver Comparison:** The chart can display data for up to three drivers, allowing for a direct comparison of their braking points and techniques.
*   **Interactive Tooltip:** Hovering over the chart reveals a tooltip with the exact brake percentage of each driver at that specific distance.
*   **Zoom and Pan:** You can zoom in on specific sections of the lap and pan horizontally to explore the data in more detail.

![Brake Chart](https://i.imgur.com/example-brake-chart.png)

### Gear Chart

The Gear Chart displays the gear number used by the driver over the distance of a single lap.

**Features:**

*   **Gear Shifting:** The chart shows the gear shifting pattern of the driver throughout the lap, from 1st to 8th gear.
*   **Driver Comparison:** The chart can display data for up to three drivers, allowing for a direct comparison of their gear shifting strategies.
*   **Interactive Tooltip:** Hovering over the chart reveals a tooltip with the exact gear number of each driver at that specific distance.
*   **Zoom and Pan:** You can zoom in on specific sections of the lap and pan horizontally to explore the data in more detail.

![Gear Chart](https://i.imgur.com/example-gear-chart.png)

### Track Map

The Track Map provides a visual representation of the circuit and the positions of the selected drivers.

**Features:**

*   **Circuit Layout:** The map displays the layout of the track for the selected Grand Prix.
*   **Driver Positions:** The map shows the positions of the selected drivers on the track for the selected lap. Each driver is represented by a colored marker.
*   **Weather Information:** The sidebar next to the track map displays the weather conditions for the selected session.
*   **Driver Information:** The sidebar also displays information about the selected drivers, including their team and the tyre compound used for the selected lap.

![Track Map](https://i.imgur.com/example-track-map.png)

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

## Data Source

All the data used in this project is provided by the [Open F1 API](https://openf1.org/).
