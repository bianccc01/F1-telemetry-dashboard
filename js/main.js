// Global application state
const state = {
    availableYears: [],
    selectedYear: null,

    availableGPs: [],
    selectedGP: null,

    availableSessions: [],
    selectedSession: null,

    availableDrivers: [],
    selectedDrivers: [null, null, null], // 3 driver slots

    telemetryData: {}, // Now stores telemetry data keyed by driver number
    lapsByDriver: {},   // Stores available laps for each driver
    selectedLaps: {},   // { driverNumber: 'fastest' or lapNumber }
    dataLoaded: false,

    // Colors for the 4 driver slots
    slotColors: ['#4477AA', '#EE6677', '#228833', '#CCBB44']

};

// Helper functions
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('F1 Dashboard starting...');

    try {
        showLoading();
        await initializeApp();
        hideLoading();
    } catch (error) {
        console.error('Failed to initialize app:', error);
        hideLoading();
        alert('Failed to initialize. Please check your connection.');
    }
});

// Initialize application
async function initializeApp() {
    state.availableYears = await API.getAvailableYears();
    console.log('Available years:', state.availableYears);

    populateYearSelector();
    initializeEmptySelectors();
    setupEventListeners();
    setupSidebarToggle();
    initializeZoomManager();
}

function initializeZoomManager() {
    if (window.ZoomManager) {
        window.ZoomManager.addListener((transform) => {
            // Add defensive check for chartInstances
            if (!window.chartInstances || !Array.isArray(window.chartInstances)) {
                console.warn("⚠️ ZoomManager: chartInstances not available or not an array");
                return;
            }

            console.log(`🔄 ZoomManager: Updating ${window.chartInstances.length} chart instances`);

            // Qui puoi aggiornare TUTTI i grafici quando lo zoom cambia
            window.chartInstances.forEach((chart, index) => {
                try {
                    // Add validation for chart structure
                    if (!chart || !chart.g || !chart.scales || !chart.id) {
                        console.warn(`⚠️ ZoomManager: Invalid chart instance at index ${index}`, chart);
                        return;
                    }

                    const { g, scales, id, svg, zoom } = chart;

                    // Check if scales.xScale exists
                    if (!scales.xScale) {
                        console.warn(`⚠️ ZoomManager: Missing xScale for chart ${id}`);
                        return;
                    }

                    const newXScale = transform.rescaleX(scales.xScale);

                    // Update x-axis
                    const xAxisSelection = g.select('.x-axis');
                    if (!xAxisSelection.empty()) {
                        xAxisSelection.call(d3.axisBottom(newXScale).tickFormat(d => d3.format('.0f')(d) + ' m'));
                    }

                    let lineGenerator;
                    switch (id) {
                        case 'speed-chart':
                            lineGenerator = d3.line()
                                .x(d => newXScale(d.distance))
                                .y(d => scales.yScale(d.speed))
                                .curve(d3.curveMonotoneX);
                            break;
                        case 'throttle-chart':
                            lineGenerator = d3.line()
                                .x(d => newXScale(d.distance))
                                .y(d => scales.yScale(d.throttle))
                                .curve(d3.curveMonotoneX);
                            break;
                        case 'brake-chart':
                            lineGenerator = d3.line()
                                .x(d => newXScale(d.distance))
                                .y(d => scales.yScale(d.brake))
                                .curve(d3.curveMonotoneX);
                            break;
                        case 'gear-chart':
                            lineGenerator = d3.line()
                                .x(d => newXScale(d.distance))
                                .y(d => scales.yScale(d.n_gear))
                                .curve(d3.curveStepAfter);
                            break;
                        default:
                            console.warn(`⚠️ ZoomManager: Unknown chart type ${id}`);
                            return;
                    }

                    if (lineGenerator) {
                        const lineSelection = g.selectAll('.line');
                        if (!lineSelection.empty()) {
                            lineSelection.attr('d', lineGenerator);
                        } else {
                            console.warn(`⚠️ ZoomManager: No .line elements found for chart ${id}`);
                        }
                    }


                    console.log(`✅ ZoomManager: Updated chart ${id}`);

                } catch (error) {
                    console.error(`❌ ZoomManager: Error updating chart at index ${index}:`, error);
                    console.error("Chart object:", chart);
                }
            });
        });

        console.log("✅ ZoomManager: Listener initialized successfully");
    } else {
        console.warn("⚠️ ZoomManager not available");
    }
}

// Alternative approach: Initialize chartInstances if it doesn't exist
function ensureChartInstances() {
    if (!window.chartInstances) {
        window.chartInstances = [];
        console.log("🔧 Initialized empty chartInstances array");
    }
}

// Call this before initializeZoomManager
function safeInitializeZoomManager() {
    ensureChartInstances();
    initializeZoomManager();
}

// Additional helper function to debug chartInstances
function debugChartInstances() {
    console.log("🔍 Chart Instances Debug:");
    console.log("- Exists:", !!window.chartInstances);
    console.log("- Type:", typeof window.chartInstances);
    console.log("- Is Array:", Array.isArray(window.chartInstances));
    console.log("- Length:", window.chartInstances?.length || 0);
    console.log("- Content:", window.chartInstances);
}

function setupSidebarToggle() {
    const toggleButton = document.getElementById('toggle-sidebar-button');
    const sidebarColumn = document.querySelector('.column:first-child');

    toggleButton.addEventListener('click', () => {
        sidebarColumn.classList.toggle('sidebar-hidden');

        // Change button text based on state
        if (sidebarColumn.classList.contains('sidebar-hidden')) {
            toggleButton.textContent = '▶';
            toggleButton.style.left = '';
        } else {
            toggleButton.textContent = '◀';
            toggleButton.style.left = '255px';
        }
    });
}

function hideSidebar() {
    const sidebarColumn = document.querySelector('.column:first-child');
    const toggleButton = document.getElementById('toggle-sidebar-button');

    if (sidebarColumn && !sidebarColumn.classList.contains('sidebar-hidden')) {
        sidebarColumn.classList.add('sidebar-hidden');
        if (toggleButton) {
            toggleButton.textContent = '▶';
            toggleButton.style.left = '';
        }
    }
}

// Populate year selector
function populateYearSelector() {
    const selector = document.getElementById('year-selector');

    const select = document.createElement('select');
    select.id = 'year-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select year...';
    select.appendChild(defaultOption);

    state.availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });

    selector.appendChild(select);
}

// Initialize empty selectors
function initializeEmptySelectors() {
    document.getElementById('gp-selector').innerHTML = '<select id="gp-select" disabled><option>Select year first...</option></select>';
    document.getElementById('session-selector').innerHTML = '<select id="session-select" disabled><option>Select GP first...</option></select>';

    for (let i = 1; i <= 3; i++) {
        const container = document.getElementById(`driver-${i}-container`);
        container.innerHTML = `
            <div class="driver-color-indicator" style="background-color: ${state.slotColors[i - 1]}"></div>
            <select id="driver-select-${i}" class="driver-select" disabled>
                <option>Select session first...</option>
            </select>
        `;
    }

    document.getElementById('lap-selectors-container').innerHTML = '';

    const chartsContainer = document.querySelector('.charts-container');
    const trackMapSidebar = document.querySelector('.track-map-sidebar');

    chartsContainer.addEventListener('scroll', () => {
        trackMapSidebar.style.top = `${-chartsContainer.scrollTop}px`;
    });

}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('year-select').addEventListener('change', handleYearChange);
    document.getElementById('gp-selector').addEventListener('change', handleGPChange);
    document.getElementById('session-selector').addEventListener('change', handleSessionChange);
    document.getElementById('back-to-race-button').addEventListener('click', handleBackToRace);


    for (let i = 1; i <= 3; i++) {
        document.getElementById(`driver-${i}-container`).addEventListener('change', (e) => {
            if (e.target.classList.contains('driver-select')) {
                handleDriverChange(i - 1, e.target.value);
            }
        });
    }

    document.getElementById('load-data-button').addEventListener('click', loadAllData);

    const chartsContainer = document.querySelector('.charts-container');
    const trackMapSidebar = document.querySelector('.track-map-sidebar');

    chartsContainer.addEventListener('scroll', () => {
        trackMapSidebar.style.top = `${-chartsContainer.scrollTop}px`;
    });
}

// Handle year change
async function handleYearChange(event) {
    const year = parseInt(event.target.value);
    if (!year) return;

    console.log('Year selected:', year);
    state.selectedYear = year;

    state.selectedGP = null;
    state.selectedSession = null;
    state.selectedDrivers = [null, null, null];

    // Show the track map sidebar
    document.querySelector('.track-map-sidebar').classList.remove('hidden-by-default');

    showLoading();

    try {
        state.availableGPs = await API.getGrandPrixByYear(year);
        console.log('Available GPs:', state.availableGPs);

        populateGPSelector();
        resetSessionSelector();
        resetDriverSelectors();
        resetLapSelector();
    } catch (error) {
        console.error('Error loading GPs:', error);
    }

    hideLoading();
}

// Populate GP selector
function populateGPSelector() {
    const selector = document.getElementById('gp-selector');

    const select = document.createElement('select');
    select.id = 'gp-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Grand Prix...';
    select.appendChild(defaultOption);

    state.availableGPs.forEach(gp => {
        const option = document.createElement('option');
        option.value = `${gp.location}|${gp.country_name}`;
        option.textContent = `${gp.country_name} - ${gp.location}`;
        select.appendChild(option);
    });

    selector.innerHTML = '';
    selector.appendChild(select);

    select.addEventListener('change', handleGPChange);
}

// Handle GP change
async function handleGPChange(event) {
    const value = event.target.value;
    if (!value) return;

    const [location, country] = value.split('|');
    console.log('GP selected:', location, country);

    state.selectedGP = { location, country };
    state.selectedSession = null;
    state.selectedDrivers = [null, null, null];

    showLoading();

    try {
        state.availableSessions = await API.getSessionsByGP(state.selectedYear, location, country);
        console.log('Available sessions:', state.availableSessions);

        populateSessionSelector();
        resetDriverSelectors();
        resetLapSelector();
        resetWeatherInfo();
        loadTrackData(state.selectedYear, location, country);
    } catch (error) {
        console.error('Error loading sessions:', error);
    }

    hideLoading();
}

// Populate session selector
function populateSessionSelector() {
    const selector = document.getElementById('session-selector');

    const select = document.createElement('select');
    select.id = 'session-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select session...';
    select.appendChild(defaultOption);

    state.availableSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.session_key;
        option.textContent = session.session_name;
        select.appendChild(option);
    });

    selector.innerHTML = '';
    selector.appendChild(select);

    select.addEventListener('change', handleSessionChange);
}

// Handle session change
async function handleSessionChange(event) {
    const sessionKey = event.target.value;
    if (!sessionKey) {
        // Se la sessione viene deselezionata, resetta tutto ciò che segue
        state.selectedSession = null;
        state.selectedDrivers = [null, null, null];
        state.telemetryData = {};
        state.lapsByDriver = {};
        state.selectedLaps = {};

        resetDriverSelectors();
        resetLapSelector();
        updateCharts(); // Aggiorna i grafici per riflettere lo stato resettato
        return;
    }

    console.log('Session selected:', sessionKey);

    state.selectedSession = state.availableSessions.find(s => s.session_key == sessionKey);

    // Show the charts container
    document.querySelector('.charts-container').classList.remove('hidden-by-default');


    // Resetta i dati dei piloti e dei giri quando la sessione cambia
    state.selectedDrivers = [null, null, null];
    state.telemetryData = {};
    state.lapsByDriver = {};
    state.selectedLaps = {};

    showLoading();

    try {
        // Fetch drivers and weather data in parallel
        const [drivers, weatherData] = await Promise.all([
            API.getDrivers(sessionKey),
            API.getWeatherData(sessionKey)
        ]);

        state.availableDrivers = drivers;
        console.log('Available drivers:', state.availableDrivers);
        console.log('Weather data:', weatherData);

        populateDriverSelectors();
        updateWeatherInfo(weatherData); // Update weather info immediately
        if (weatherData) {
            document.querySelector('.weather-container').classList.remove('hidden-by-default');
        }
        resetLapSelector();
        updateCharts(); // Pulisce i grafici precedenti

    } catch (error) {
        console.error('Error during session change handling:', error);
    }

    hideLoading();
}

async function loadTrackData(year, location, country) {
    const loader = document.getElementById('track-map-loader');
    loader.style.display = 'flex';
    try {
        const driverNumber = state.selectedDrivers[0] ? state.selectedDrivers[0].driver_number : null;
        const fastestLap = await API.getFastestLapOfGP(year, location, country, driverNumber);
        if (!fastestLap) {
            console.error('No fastest lap found for the GP.');
            loader.style.display = 'none';
            return;
        }

        const locationData = await API.getCarData(fastestLap.session_key, fastestLap.driver_number, fastestLap.lap_number);
        const trackData = {
            'track': {
                data: locationData,
                driver: { name_acronym: 'Track' },
                color: '#444'
            }
        };
        TrackMap.create(trackData);
    } catch (error) {
        console.error('Error loading track data:', error);
    } finally {
        loader.style.display = 'none';
    }
}

// Populate driver selectors
function populateDriverSelectors() {
    for (let i = 1; i <= 3; i++) {
        const select = document.getElementById(`driver-select-${i}`);
        select.innerHTML = '';

        const selected = state.selectedDrivers[i - 1];

        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select driver...';
        select.appendChild(defaultOption);

        state.availableDrivers.forEach(driver => {
            const alreadySelected = state.selectedDrivers.some((d, idx) =>
                d && d.driver_number === driver.driver_number && idx !== (i - 1)
            );

            if (!alreadySelected || (selected && selected.driver_number === driver.driver_number)) {
                const option = document.createElement('option');
                option.value = driver.driver_number;
                option.textContent = `${driver.driver_number} - ${driver.name_acronym} (${driver.team_name})`;

                if (selected && driver.driver_number === selected.driver_number) {
                    option.selected = true;
                }

                select.appendChild(option);
            }
        });

        if (i === 1) {
            select.disabled = !state.selectedSession; // abilita solo se sessione selezionata
        } else {
            select.disabled = !state.selectedDrivers[i - 2]; // abilita solo se precedente driver selezionato
        }
    }
}

// Handle driver change
async function handleDriverChange(slotIndex, driverNumber) {
    console.log(`Driver slot ${slotIndex + 1} changed to:`, driverNumber);

    const oldDriverNumber = state.selectedDrivers[slotIndex] ? state.selectedDrivers[slotIndex].driver_number : null;

    if (!driverNumber) {
        // Driver deselected
        if (oldDriverNumber) {
            delete state.lapsByDriver[oldDriverNumber];
            delete state.selectedLaps[oldDriverNumber];
            delete state.telemetryData[oldDriverNumber];
        }
        state.selectedDrivers[slotIndex] = null;
        // Also clear subsequent drivers
        for (let i = slotIndex + 1; i < 3; i++) {
            const subsequentDriver = state.selectedDrivers[i];
            if (subsequentDriver) {
                delete state.lapsByDriver[subsequentDriver.driver_number];
                delete state.selectedLaps[subsequentDriver.driver_number];
                delete state.telemetryData[subsequentDriver.driver_number];
                state.selectedDrivers[i] = null;
            }
        }
        populateDriverSelectors();
        updateLapSelectors();
        updateCharts();
    } else {
        // Driver selected
        const driver = state.availableDrivers.find(d => d.driver_number == driverNumber);
        showLoading();
        try {
            const laps = await API.getLaps(state.selectedSession.session_key, driver.driver_number);
            const hasValidLaps = laps.some(lap => lap.lap_duration !== null);

            if (!hasValidLaps) {
                alert('Error: The selected driver has no valid laps in this session.');
                // Deselect the driver by calling handleDriverChange again with null
                handleDriverChange(slotIndex, null);
            } else {
                state.selectedDrivers[slotIndex] = { ...driver, color: state.slotColors[slotIndex] };
                state.lapsByDriver[driver.driver_number] = laps; // Store the laps
                if (oldDriverNumber && oldDriverNumber !== driverNumber) {
                    delete state.lapsByDriver[oldDriverNumber];
                    delete state.selectedLaps[oldDriverNumber];
                    delete state.telemetryData[oldDriverNumber];
                }
                populateDriverSelectors();
                updateLapSelectors();
                updateCharts();

                const backToRaceButton = document.getElementById('back-to-race-button');
                const isRaceViewVisible = backToRaceButton.style.display !== 'none';

                if (!isRaceViewVisible && state.selectedSession && (state.selectedSession.session_name === 'Race' || state.selectedSession.session_name === 'Sprint')) {
                    hideSidebar();
                }
            }
        } catch (error) {
            console.error(`Error fetching laps for driver ${driver.driver_number}:`, error);
            // Optionally, handle the error case, e.g., by deselecting the driver
            handleDriverChange(slotIndex, null);
        } finally {
            hideLoading();
        }
    }
}

// Reset functions
function resetSessionSelector() {
    document.getElementById('session-selector').innerHTML = '<select id="session-select" disabled><option>Select GP first...</option></select>';
}

function resetDriverSelectors() {
    for (let i = 1; i <= 3; i++) {
        const select = document.getElementById(`driver-select-${i}`);
        select.disabled = true;
        select.innerHTML = '<option>Select session first...</option>';
    }
}

function resetLapSelector() {
    document.getElementById('lap-selectors-container').innerHTML = '';
}

function resetWeatherInfo() {
    const container = document.getElementById('weather-info');
    container.innerHTML = '<p>No weather data available.</p>';
}

function updateLapSelectors() {
    const container = document.getElementById('lap-selectors-container');
    container.innerHTML = ''; // Clear previous selectors

    state.selectedDrivers.forEach(driver => {
        if (!driver) return;

        const driverContainer = document.createElement('div');
        driverContainer.classList.add('control-section');
        driverContainer.innerHTML = `<h3>Lap - ${driver.name_acronym}</h3>`;

        const selector = document.createElement('select');
        selector.id = `lap-select-${driver.driver_number}`;
        selector.dataset.driverNumber = driver.driver_number;

        // Add options
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select lap...';
        selector.appendChild(defaultOption);

        const fastestOption = document.createElement('option');
        fastestOption.value = 'fastest';
        fastestOption.textContent = 'Fastest Lap';
        selector.appendChild(fastestOption);

        // Populate laps if available
        if (state.lapsByDriver[driver.driver_number]) {
            state.lapsByDriver[driver.driver_number]
                .filter(lap => lap.lap_duration !== null) // Filter out laps with null duration
                .forEach(lap => {
                    const option = document.createElement('option');
                    option.value = lap.lap_number;
                    let lapDuration = lap.lap_duration;
                    if (typeof lapDuration === 'number') {
                        // convert lap duration to a mm:ss format
                        const minutes = Math.floor(lapDuration / 60);
                        const seconds = (lapDuration % 60).toFixed(3);
                        lapDuration = `${minutes}:${seconds.padStart(6, '0')}`; // Ensure 2 digits for seconds
                    }
                    option.textContent = `Lap ${lap.lap_number} - ${lapDuration}`;
                    selector.appendChild(option);
                });
        }

        selector.value = state.selectedLaps[driver.driver_number] || '';

        driverContainer.appendChild(selector);

        // Tyre info
        const tyreInfo = document.createElement('div');
        tyreInfo.id = `tyre-info-${driver.driver_number}`;
        tyreInfo.classList.add('tyre-info');
        driverContainer.appendChild(tyreInfo);

        container.appendChild(driverContainer);

        selector.addEventListener('change', handleLapChange);

        // Fetch laps for the driver if not already fetched
        if (!state.lapsByDriver[driver.driver_number]) {
            API.getLaps(state.selectedSession.session_key, driver.driver_number)
                .then(laps => {
                    state.lapsByDriver[driver.driver_number] = laps;
                    updateLapSelectors(); // Re-render to populate the selector
                })
                .catch(error => console.error(`Error fetching laps for driver ${driver.driver_number}:`, error));
        }
    });
}



// Handle lap change
function handleLapChange(event) {
    const driverNumber = event.target.dataset.driverNumber;
    const selectedValue = event.target.value;

    state.selectedLaps[driverNumber] = selectedValue;
    updateLoadButtonState();
}
function handleBackToRace() {
    console.log("🔄 Starting back to race cleanup...");

    // 1. PRIMA pulisci tutto PRIMA di resettare lo state
    if (window.Tooltip && typeof Tooltip.cleanup === 'function') {
        console.log("🧹 Cleaning Telemetry tooltips...");
        Tooltip.cleanup();
    }

    if (typeof RaceChart !== 'undefined' && RaceChart.cleanup) {
        console.log("🧹 Cleaning RaceChart tooltips...");
        RaceChart.cleanup();
    }

    if (typeof ViolinPlot !== 'undefined' && ViolinPlot.cleanup) {
        console.log("🧹 Cleaning ViolinPlot tooltips...");
        ViolinPlot.cleanup();
    }

    // 2. Reset zoom manager
    if (window.ZoomManager && typeof ZoomManager.reset === 'function') {
        console.log("🔄 Resetting ZoomManager...");
        ZoomManager.reset();
    }

    // 3. Pulizia generale di sicurezza per tutti i tooltip
    console.log("🧹 General tooltip cleanup...");
    d3.selectAll(".tooltip").remove();
    d3.selectAll(".tooltip-line").remove();
    d3.selectAll(".overlay").remove(); // AGGIUNTO: rimuovi anche gli overlay

    // 4. Reset chart instances PRIMA di resettare lo state
    if (window.chartInstances) {
        console.log("📊 Clearing chart instances...");
        window.chartInstances = [];
    }

    // 5. SOLO ORA resetta lo state
    console.log("📊 Resetting state...");
    state.selectedLaps = {};
    state.dataLoaded = false;
    state.telemetryData = null; // AGGIUNTO: pulisci anche i dati di telemetria

    // 6. Update UI
    console.log("🔄 Updating UI...");
    updateLapSelectors();

    // 7. RITARDA l'aggiornamento dei chart per dare tempo al DOM di stabilizzarsi
    setTimeout(() => {
        console.log("📊 Updating charts after cleanup...");
        updateCharts();

        // 8. Debug info alla fine
        if (window.ZoomManager && typeof ZoomManager.debug === 'function') {
            ZoomManager.debug();
        }

        console.log("✅ Back to race cleanup completed!");
    }, 50);
}

function updateLoadButtonState() {
    const button = document.getElementById('load-data-button');
    const allLapsSelected = state.selectedDrivers.every(driver => {
        return !driver || state.selectedLaps[driver.driver_number];
    });
    button.disabled = !allLapsSelected;
}

async function loadAllData() {
    showLoading();
    clearCharts();
    state.telemetryData = {};
    state.dataLoaded = true;
    hideSidebar();


    const driversToLoad = state.selectedDrivers.filter(d => d && state.selectedLaps[d.driver_number]);

    try {
        for (const driver of driversToLoad) {
            const driverNumber = driver.driver_number;
            const selectedValue = state.selectedLaps[driverNumber];
            let lapNumber;

            if (selectedValue === 'fastest') {
                const fastestLap = await API.getFastestLap(state.selectedSession.session_key, driverNumber);
                if (fastestLap) {
                    lapNumber = fastestLap.lap_number;
                    // Update selector and info in the main thread
                    document.getElementById(`lap-select-${driverNumber}`).value = lapNumber;
                } else {
                    // Handle case where no fastest lap is found
                    console.warn(`No fastest lap found for driver ${driverNumber}`);
                    continue; // Skip this driver
                }
                const tyreInfo = document.getElementById(`tyre-info-${driverNumber}`);
                tyreInfo.innerHTML = `Fastest: Lap ${lapNumber}`;
            } else {
                lapNumber = selectedValue;
            }

            const carData = await API.getCarData(state.selectedSession.session_key, driverNumber, lapNumber);
            const lapInfo = state.lapsByDriver[driverNumber].find(l => l.lap_number == lapNumber);
            const tyreInfo = document.getElementById(`tyre-info-${driverNumber}`);
            const sectorTimes = {
                sector1: parseFloat(lapInfo.sector1_time),
                sector2: parseFloat(lapInfo.sector2_time),
                sector3: parseFloat(lapInfo.sector3_time),
            };
            if (selectedValue !== 'fastest') {
                tyreInfo.innerHTML = ''; // Clear previous info
            }
            if (lapInfo) {
                tyreInfo.innerHTML += ` | Compound: ${lapInfo.compound}`;
            }

            state.telemetryData[driverNumber] = {
                data: carData,
                driver: driver,
                color: driver.color,
                sectorTimes: sectorTimes,
            };
        }

        console.log("State Telemetry Data:", state.telemetryData);
    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
        updateCharts();
        hideLoading();
    }
}
function updateCharts() {
    const raceWideCharts = document.getElementById('race-wide-charts');
    const individualLapCharts = document.getElementById('individual-lap-charts');
    const violinPlotContainer = document.getElementById('violin-plot-container');
    const backToRaceButton = document.getElementById('back-to-race-button');

    const singleGPSelected = state.selectedGP;
    const noLapSelected = Object.values(state.selectedLaps).every(lap => !lap);

    // Condizione per mostrare i grafici "race-wide"
    const showRaceWideCharts = state.selectedSession &&
        (state.selectedSession.session_name === 'Race' || state.selectedSession.session_name === 'Sprint');

    // Show race-wide charts if no laps are selected OR if data has not been loaded yet
    if (singleGPSelected && (noLapSelected || !state.dataLoaded)) {
        if (showRaceWideCharts) {
            raceWideCharts.style.display = 'block';
            violinPlotContainer.style.display = 'block';
            ViolinPlot.create();
            if (state.selectedDrivers.some(d => d)) {
                fetchAllLapsForRaceChart().then(() => {
                    if (RaceChart.initializeTooltip) {
                        RaceChart.initializeTooltip();
                    }
                });
            } else {
                RaceChart.create({});
            }
        } else {
            raceWideCharts.style.display = 'none';
            violinPlotContainer.style.display = 'none';
        }
        individualLapCharts.style.display = 'none';
        backToRaceButton.style.display = 'none';
        d3.selectAll('.tooltip').remove();

    } else if (state.dataLoaded) {
        // Show individual lap charts only if data is loaded
        raceWideCharts.style.display = 'none';
        individualLapCharts.style.display = 'block';
        violinPlotContainer.style.display = 'none';
        backToRaceButton.style.display = 'block';
        d3.selectAll('.tooltip').remove();
    }


    SpeedChart.create(state.telemetryData);
    ThrottleChart.create(state.telemetryData);
    BrakeChart.create(state.telemetryData);
    GearChart.create(state.telemetryData);
    updateDriverInfo();

    const chartConfigs = [
        {
            id: 'speed-chart',
            prepareData: SpeedChart.prepareData,
            createScales: SpeedChart.createScales,
            yValue: d => d.speed,
            yLabel: 'km/h',
            yFormat: d => d.toFixed(0)
        },
        {
            id: 'throttle-chart',
            prepareData: ThrottleChart.prepareData,
            createScales: ThrottleChart.createScales,
            yValue: d => d.throttle,
            yLabel: '%',
            yFormat: d => d.toFixed(0)
        },
        {
            id: 'brake-chart',
            prepareData: BrakeChart.prepareData,
            createScales: BrakeChart.createScales,
            yValue: d => d.brake,
            yLabel: '%',
            yFormat: d => d.toFixed(0)
        },
        {
            id: 'gear-chart',
            prepareData: GearChart.prepareData,
            createScales: GearChart.createScales,
            yValue: d => d.n_gear,
            yLabel: 'Gear',
            yFormat: d => d
        }
    ];

    const charts = chartConfigs.map(config => {
        const container = d3.select(`#${config.id}`);
        const allData = config.prepareData();
        const width = container.node().getBoundingClientRect().width - 170;
        const height = container.node().getBoundingClientRect().height - 90;
        const scales = config.createScales(allData, width, height);
        const g = container.select('svg g');

        return {
            id: config.id,
            container,
            allData,
            scales,
            g,
            width,
            height,
            yValue: config.yValue,
            yLabel: config.yLabel,
            yFormat: config.yFormat
        };
    }).filter(c => c.g && !c.g.empty()); // Assicurati che il gruppo g esista

    if (charts.length > 0) {
        Tooltip.initialize(charts);
    }
}

function updateDriverInfo() {
    const container = document.getElementById('driver-info-container');
    container.innerHTML = ''; // Clear previous info

    const drivers = Object.values(state.telemetryData || {}); // Ensure telemetryData is an object

    if (drivers.length === 0) {
        container.innerHTML = '<p>No data loaded.</p>';
        return;
    }

    drivers.forEach(driverData => {
        const driver = driverData.driver;
        const lapNumber = state.selectedLaps[driver.driver_number];
        const lapInfo = state.lapsByDriver[driver.driver_number]?.find(l => l.lap_number == lapNumber);

        if (!lapInfo) return;

        let lapDuration = lapInfo.lap_duration;
        if (lapDuration === null) {
            lapDuration = 'N/A';
        } else if (typeof lapDuration === 'number') {
            const minutes = Math.floor(lapDuration / 60);
            const seconds = (lapDuration % 60).toFixed(3);
            lapDuration = `${minutes}:${seconds.padStart(6, '0')}`;
        }

        const infoElement = document.createElement('div');
        infoElement.classList.add('driver-info');
        infoElement.style.borderLeft = `5px solid ${driver.color}`;

        const tyreImages = {
            'soft': 'https://upload.wikimedia.org/wikipedia/commons/d/df/F1_tire_Pirelli_PZero_Red.svg',
            'medium': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/F1_tire_Pirelli_PZero_Yellow.svg',
            'hard': 'https://upload.wikimedia.org/wikipedia/commons/d/d6/F1_tire_Pirelli_PZero_White.svg',
            'intermediate': 'https://upload.wikimedia.org/wikipedia/commons/8/86/F1_tire_Pirelli_Cinturato_Green.svg',
            'wet': 'https://upload.wikimedia.org/wikipedia/commons/6/63/F1_tire_Pirelli_Cinturato_Blue.svg'
        };

        infoElement.innerHTML = `
            <div class="driver-details">
                <span class="driver-name">${driver.name_acronym}</span>
                <span class="lap-time">${lapDuration}</span>
            </div>
            <div class="tyre-info">
                <img src="${tyreImages[lapInfo.compound.toLowerCase()]}" alt="${lapInfo.compound}" class="tyre-image">
            </div>
        `;

        container.appendChild(infoElement);
    });
}

function updateWeatherInfo(weatherData) {
    const container = document.getElementById('weather-info');
    container.innerHTML = ''; // Clear previous info

    if (!weatherData) {
        container.innerHTML = '<p>No weather data available.</p>';
        return;
    }

    const weatherItems = {
        'Air Temperature': `${weatherData.air_temperature}°C`,
        'Track Temperature': `${weatherData.track_temperature}°C`,
        'Humidity': `${weatherData.humidity}%`,
        'Pressure': `${weatherData.pressure} mbar`,
        'Wind Speed': `${weatherData.wind_speed} m/s`,
        'Wind Direction': `${weatherData.wind_direction}°`,
        'Rainfall': weatherData.rainfall ? 'Yes' : 'No',
    };

    for (const [label, value] of Object.entries(weatherItems)) {
        const item = document.createElement('div');
        item.innerHTML = `<span class="label">${label}:</span> <span class="value">${value}</span>`;
        container.appendChild(item);
    }
}

function clearCharts() {
    d3.select('#speed-chart').selectAll('*').remove();
    d3.select('#throttle-chart').selectAll('*').remove();
    d3.select('#brake-chart').selectAll('*').remove();
    d3.select('#gear-chart').selectAll('*').remove();
}

async function fetchAllLapsForRaceChart() {
    const driversToLoad = state.selectedDrivers.filter(d => d);
    if (driversToLoad.length === 0) {
        RaceChart.create({});
        return;
    }

    showLoading();
    try {
        const lapData = {};
        for (const driver of driversToLoad) {
            const driverNumber = driver.driver_number;
            if (!state.lapsByDriver[driverNumber]) {
                state.lapsByDriver[driverNumber] = await API.getLaps(state.selectedSession.session_key, driverNumber);
            }
            lapData[driverNumber] = {
                laps: state.lapsByDriver[driverNumber],
                driver: driver,
                color: driver.color,
            };
        }
        RaceChart.create(lapData);
    } catch (error) {
        console.error('Error fetching laps for race chart:', error);
    } finally {
        hideLoading();
    }
}
