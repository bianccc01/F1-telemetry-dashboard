# 🏎️ F1 Telemetry Dashboard

[![Live Demo](https://img.shields.io/badge/🚀-Live%20Demo-blue?style=for-the-badge)](https://bianccc01.github.io/F1-telemetry-dashboard/)
[![Data Source](https://img.shields.io/badge/📊-Open%20F1%20API-orange?style=for-the-badge)](https://openf1.org/)

![Demo](assets/demo.gif)

> An interactive web-based dashboard for visualizing and analyzing Formula 1 telemetry data with real-time comparison capabilities across drivers, sessions, and Grand Prix events.

## 🌟 Features

### 🔍 **Interactive Data Exploration**
- **Multi-dimensional Selection**: Choose specific years, Grand Prix, sessions, and compare up to 3 drivers simultaneously
- **Real-time Data Fetching**: Live data from the Open F1 API for the most up-to-date race information
- **Responsive Design**: Optimized for desktop, tablet, and mobile viewing

### 📊 **Advanced Telemetry Analysis**
- **Speed Analysis**: Track speed variations (km/h) throughout the lap with precision
- **Throttle Monitoring**: Analyze throttle application percentage and driving techniques
- **Brake Performance**: Study braking points, pressure, and techniques
- **Gear Optimization**: Visualize gear shifting patterns and transmission strategies

### 🏁 **Race Intelligence Features**
- **Race Chart**: Comprehensive race overview with lap-by-lap performance analysis
- **Violin Plot**: Statistical distribution of lap times revealing driver consistency
- **Tyre Strategy Visualization**: Color-coded tyre compound analysis (Soft, Medium, Hard, Intermediate, Wet)
- **Track Map**: Real-time circuit visualization with driver position markers

### 🌤️ **Contextual Information**
- **Weather Integration**: Session weather conditions and their impact on performance
- **Driver Profiles**: Team information and detailed driver statistics
- **Interactive Tooltips**: Hover for detailed data points and insights

## 🚀 Quick Start

### **Option 1: Live Demo** 
Click [here](https://bianccc01.github.io/F1-telemetry-dashboard/) to access the live dashboard immediately.

### **Option 2: Local Setup**
1. **Clone the Repository**
   ```bash
   git clone https://github.com/bianccc01/F1-telemetry-dashboard.git
   cd F1-telemetry-dashboard
   ```

2. **Launch the Application**
   ```bash
   # Simple HTTP server (Python 3)
   python -m http.server 8000
   
   # Or using Node.js
   npx http-server
   
   # Or simply open index.html in your browser
   open index.html
   ```

## 📋 User Guide

### **Step-by-Step Workflow**

1. **🗓️ Select Year**: Choose from available Formula 1 seasons
2. **🏁 Choose Grand Prix**: Pick from the race calendar for your selected year  
3. **⏱️ Pick Session**: Select from Race, Qualifying, or Practice sessions
4. **👥 Select Drivers**: Choose up to 3 drivers for comparative analysis
5. **📊 Load & Analyze**: Click "Load Data" to generate visualizations
6. **🔍 Explore**: Interactive charts with zoom, pan, and detailed tooltips

### **Navigation Tips**
- **Race Chart Interaction**: Click any lap point to dive into detailed telemetry
- **Zoom Controls**: Use mouse wheel or pinch gestures for detailed analysis
- **Back Navigation**: Use "Back to Race View" to return to overview charts
- **Multi-Driver Comparison**: Toggle driver visibility for focused analysis

## 📊 Chart Reference

| Chart Type | Purpose | Key Features |
|------------|---------|--------------|
| **🏁 Race Chart** | Full race performance overview | Lap times, tyre strategies, clickable lap selection |
| **🎻 Violin Plot** | Lap time consistency analysis | Statistical distribution, median indicators, consistency metrics |
| **⚡ Speed Chart** | Velocity analysis per lap | Speed profiles, acceleration zones, comparative analysis |
| **🚗 Throttle Chart** | Throttle application patterns | Acceleration techniques, corner exit analysis |
| **🛑 Brake Chart** | Braking performance analysis | Braking points, pressure application, technique comparison |
| **⚙️ Gear Chart** | Transmission strategy | Gear shifting patterns, optimization analysis |
| **🗺️ Track Map** | Circuit visualization | Real-time positioning, weather integration |

## 🏗️ Technical Architecture

```
📁 Project Structure
├── 🎨 css/
│   └── style.css              # Responsive styling & themes
├── ⚡ js/
│   ├── api.js                 # Open F1 API integration
│   ├── main.js                # Core application logic
│   ├── telemetry.js           # Telemetry data processing
│   └── 📊 charts/
│       ├── brakeChart.js      # Brake analysis visualization
│       ├── gearChart.js       # Gear pattern charts
│       ├── raceChart.js       # Race overview visualization  
│       ├── speedChart.js      # Speed profile charts
│       ├── throttleChart.js   # Throttle analysis
│       ├── tooltip.js         # Interactive tooltip system
│       ├── trackMap.js        # Circuit mapping & positioning
│       ├── violinPlot.js      # Statistical distribution plots
│       └── zoomManager.js     # Chart interaction management
├── 🌐 index.html              # Main application interface
└── 📖 README.md               # Documentation
```

### **Technology Stack**
- **Frontend**: HTML5, CSS3, JavaScript
- **Visualization**: D3.js for advanced data visualization
- **Data Source**: Open F1 API for real-time telemetry

## 📡 Data Source

This project leverages the comprehensive [**Open F1 API**](https://openf1.org/) which provides:
- Real-time telemetry data
- Historical race information
- Driver and team statistics  
- Weather and track conditions
- Tyre strategy data

## 👨‍💻 Authors

| Developer | Contact |
|-----------|---------|
| **Giorgio Biancini** | [GitHub](https://github.com/bianccc01) • [Email](mailto:gio.biancini@stud.uniroma3.it) |
| **Gabriel Pentimalli** | [GitHub](https://github.com/GabrielPentimalli) • [Email](mailto:gab.pentimalli@stud.uniroma3.it) |

---
