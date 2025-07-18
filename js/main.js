// Global application state
const state = {
    availableYears: [],
    selectedYear: null,

    availableGPs: [],
    selectedGP: null,

    availableSessions: [],
    selectedSession: null,

    availableDrivers: [],
    selectedDrivers: [null, null, null, null], // 4 driver slots

    telemetryData: {}, // Now stores telemetry data keyed by driver number
    lapsByDriver: {},   // Stores available laps for each driver
    selectedLaps: {},   // { driverNumber: 'fastest' or lapNumber }

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
}

function setupSidebarToggle() {
    const toggleButton = document.getElementById('toggle-sidebar-button');
    const mainContainer = document.querySelector('.main-container');

    toggleButton.addEventListener('click', () => {
        mainContainer.classList.toggle('sidebar-hidden');

        // Change button text based on state
        if (mainContainer.classList.contains('sidebar-hidden')) {
            toggleButton.textContent = '▶';
        } else {
            toggleButton.textContent = '◀';
        }
    });
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

    for (let i = 1; i <= 4; i++) {
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

    for (let i = 1; i <= 4; i++) {
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
    state.selectedDrivers = [null, null, null, null];

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
    state.selectedDrivers = [null, null, null, null];

    showLoading();

    try {
        state.availableSessions = await API.getSessionsByGP(state.selectedYear, location, country);
        console.log('Available sessions:', state.availableSessions);

        populateSessionSelector();
        resetDriverSelectors();
        resetLapSelector();
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
    if (!sessionKey) return;

    console.log('Session selected:', sessionKey);

    state.selectedSession = state.availableSessions.find(s => s.session_key == sessionKey);

    showLoading();

    try {
        state.availableDrivers = await API.getDrivers(sessionKey);
        console.log('Available drivers:', state.availableDrivers);

        populateDriverSelectors();
        resetLapSelector();
        loadTrackData(sessionKey);
    } catch (error) {
        console.error('Error loading drivers:', error);
    }

    hideLoading();
}

async function loadTrackData(sessionKey) {
    try {
        const locationData = await API.getCarData(sessionKey);
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
    }
}

// Populate driver selectors
function populateDriverSelectors() {
    for (let i = 1; i <= 4; i++) {
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

        // Abilita il dropdown in modo sequenziale:
        // Abilita il primo driver sempre se sessione selezionata
        // Per gli altri: abilita solo se il driver precedente è selezionato
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
        for (let i = slotIndex + 1; i < 4; i++) {
            const subsequentDriver = state.selectedDrivers[i];
            if (subsequentDriver) {
                delete state.lapsByDriver[subsequentDriver.driver_number];
                delete state.selectedLaps[subsequentDriver.driver_number];
                delete state.telemetryData[subsequentDriver.driver_number];
                state.selectedDrivers[i] = null;
            }
        }
    } else {
        // Driver selected
        const driver = state.availableDrivers.find(d => d.driver_number == driverNumber);
        state.selectedDrivers[slotIndex] = { ...driver, color: state.slotColors[slotIndex] };
        if (oldDriverNumber && oldDriverNumber !== driverNumber) {
            delete state.lapsByDriver[oldDriverNumber];
            delete state.selectedLaps[oldDriverNumber];
            delete state.telemetryData[oldDriverNumber];
        }
    }

    populateDriverSelectors();
    updateLapSelectors();
    updateCharts();
}

// Reset functions
function resetSessionSelector() {
    document.getElementById('session-selector').innerHTML = '<select id="session-select" disabled><option>Select GP first...</option></select>';
}

function resetDriverSelectors() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`driver-select-${i}`);
        select.disabled = true;
        select.innerHTML = '<option>Select session first...</option>';
    }
}

function resetLapSelector() {
    document.getElementById('lap-selectors-container').innerHTML = '';
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
            state.lapsByDriver[driver.driver_number].forEach(lap => {
                const option = document.createElement('option');
                option.value = lap.lap_number;
                let lapDuration = lap.lap_duration;
                if (lapDuration === null) {
                    lapDuration = 'N/A'; // Handle null duration
                } else if (typeof lapDuration === 'number') {
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

    const driversToLoad = state.selectedDrivers.filter(d => d && state.selectedLaps[d.driver_number]);

    try {
        const dataPromises = driversToLoad.map(async (driver) => {
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
                    return null; // Skip this driver
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

            return {
                driverNumber,
                data: {
                    data: carData,
                    driver: driver,
                    color: driver.color,
                    sectorTimes: sectorTimes,
                }
            };
        });

        const [results, weatherData] = await Promise.all([
            Promise.all(dataPromises),
            API.getWeatherData(state.selectedSession)
        ]);
        console.log("Weather Data:", weatherData);
        console.log("API Results:", results);
        results.forEach(result => {
            if (result) { // Check if the result is not null
                state.telemetryData[result.driverNumber] = result.data;
            }
        });
        console.log("State Telemetry Data:", state.telemetryData);
        updateWeatherInfo(weatherData);
    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
        updateCharts();
        hideLoading();
    }
}

async function handleSelectFastestLap() {
    const selectedDrivers = state.selectedDrivers.filter(d => d);
    if (!selectedDrivers.length) return;

    showLoading();
    try {
        const sessionKey = state.selectedSession.session_key;
        const driverNumbers = selectedDrivers.map(d => d.driver_number);

        // Mappa dei migliori giri per ciascun pilota
        const fastestLaps = await API.getFastestLap(sessionKey, driverNumbers);

        if (!fastestLaps || Object.keys(fastestLaps).length === 0) {
            alert('Nessun giro più veloce trovato.');
            return;
        }

        console.log('Fastest laps:', fastestLaps);

        for (const driver of selectedDrivers) {
            const lapNumber = fastestLaps[driver.driver_number];
            if (!lapNumber) continue;

            console.log(`Driver ${driver.full_name} -> lap ${lapNumber}`);

            // Aggiorna selezione manualmente per ogni pilota
            await handleLapChange({ target: { value: lapNumber } }, driver.driver_number);
        }

    } catch (err) {
        console.error('Error selecting fastest lap:', err);
    } finally {
        hideLoading();
    }
}

async function loadTelemetryForLap(lap) {
    if (!state.selectedSession || state.selectedDrivers.every(d => !d)) return;

    console.log('Loading telemetry for lap:', lap);
    state.selectedLap = lap;

    showLoading();
    try {
        const selectedDrivers = state.selectedDrivers.filter(d => d);
        const sessionKey = state.selectedSession.session_key;
        const driverNumbers = selectedDrivers.map(d => d.driver_number);

        const telemetryData = await API.getCarData(sessionKey, driverNumbers, lap);
        state.telemetryData = {};

        driverNumbers.forEach((driverNumber, idx) => {
            state.telemetryData[driverNumber] = {
                data: telemetryData[idx],
                driver: selectedDrivers.find(d => d.driver_number === driverNumber),
                color: state.slotColors[state.selectedDrivers.findIndex(d => d && d.driver_number === driverNumber)]
            };
        });

        console.log('Telemetry data loaded:', state.telemetryData);
    } catch (error) {
        console.error('Error loading telemetry data:', error);
    } finally {
        hideLoading();
    }
}

function updateCharts() {
    SpeedChart.create(state.telemetryData);
    ThrottleChart.create(state.telemetryData);
    BrakeChart.create(state.telemetryData);
    GearChart.create(state.telemetryData);
    TrackMap.create(state.telemetryData);
    updateDriverInfo();

    const charts = [
        {
            container: d3.select('#speed-chart'),
            allData: SpeedChart.prepareData(),
            scales: SpeedChart.createScales(SpeedChart.prepareData(), d3.select('#speed-chart').node().getBoundingClientRect().width - 170, d3.select('#speed-chart').node().getBoundingClientRect().height - 90),
            g: d3.select('#speed-chart svg g'),
            yValue: d => d.speed,
            yLabel: 'km/h',
            yFormat: d => d.toFixed(0)
        },
        {
            container: d3.select('#throttle-chart'),
            allData: ThrottleChart.prepareData(),
            scales: ThrottleChart.createScales(ThrottleChart.prepareData(), d3.select('#throttle-chart').node().getBoundingClientRect().width - 170, d3.select('#throttle-chart').node().getBoundingClientRect().height - 90),
            g: d3.select('#throttle-chart svg g'),
            yValue: d => d.throttle,
            yLabel: '%',
            yFormat: d => d.toFixed(0)
        },
        {
            container: d3.select('#brake-chart'),
            allData: BrakeChart.prepareData(),
            scales: BrakeChart.createScales(BrakeChart.prepareData(), d3.select('#brake-chart').node().getBoundingClientRect().width - 170, d3.select('#brake-chart').node().getBoundingClientRect().height - 90),
            g: d3.select('#brake-chart svg g'),
            yValue: d => d.brake,
            yLabel: '%',
            yFormat: d => d.toFixed(0)
        },
        {
            container: d3.select('#gear-chart'),
            allData: GearChart.prepareData(),
            scales: GearChart.createScales(GearChart.prepareData(), d3.select('#gear-chart').node().getBoundingClientRect().width - 170, d3.select('#gear-chart').node().getBoundingClientRect().height - 90),
            g: d3.select('#gear-chart svg g'),
            yValue: d => d.n_gear,
            yLabel: 'Gear',
            yFormat: d => d
        }
    ];

    Tooltip.initialize(charts);
}

function updateDriverInfo() {
    const container = document.getElementById('driver-info-container');
    container.innerHTML = ''; // Clear previous info

    const drivers = Object.values(state.telemetryData);

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

    if (!weatherData || !weatherData.current_weather) {
        container.innerHTML = '<p>No weather data available.</p>';
        return;
    }

    const currentWeather = weatherData.current_weather;

    const weatherItems = {
        'Temperature': `${currentWeather.temperature}°C`,
        'Wind Speed': `${currentWeather.windspeed} km/h`,
        'Wind Direction': `${currentWeather.winddirection}°`,
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
