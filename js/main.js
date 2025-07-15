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

    telemetryData: {},
    laps: [],
    selectedLap: null,

    // Colors for the 4 driver slots
    slotColors: ['#FF1801', '#0600EF', '#00D2BE', '#FF8700']
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

    document.getElementById('lap-selector').innerHTML = '<select id="lap-select" disabled><option>Select drivers first...</option></select>';
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
    } catch (error) {
        console.error('Error loading drivers:', error);
    }

    hideLoading();
}

// Populate driver selectors
function populateDriverSelectors() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`driver-select-${i}`);
        select.disabled = false;
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
    }
}

// Handle driver change
async function handleDriverChange(slotIndex, driverNumber) {
    console.log(`Driver slot ${slotIndex + 1} changed to:`, driverNumber);

    if (!driverNumber) {
        state.selectedDrivers[slotIndex] = null;
    } else {
        const driver = state.availableDrivers.find(d => d.driver_number == driverNumber);
        state.selectedDrivers[slotIndex] = { ...driver, color: state.slotColors[slotIndex] };
    }

    populateDriverSelectors();

    const selectedDrivers = state.selectedDrivers.filter(d => d);
    if (selectedDrivers.length > 0) {
        try {
            showLoading();
            const laps = await API.getLaps(state.selectedSession.session_key, selectedDrivers.map(d => d.driver_number));
            state.laps = laps;
            console.log('Available laps:', laps);

            populateLapSelector();
        } catch (error) {
            console.error('Error loading laps:', error);
        } finally {
            hideLoading();
        }
    } else {
        resetLapSelector();
    }
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
    document.getElementById('lap-selector').innerHTML = '<select id="lap-select" disabled><option>Select drivers first...</option></select>';
}

function populateLapSelector() {
    const container = document.getElementById('lap-selector');
    container.innerHTML = '';

    const select = document.createElement('select');
    select.id = 'lap-select';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select lap...';
    select.appendChild(defaultOption);

    // Aggiungi giri
    state.laps.forEach(lap => {
        const option = document.createElement('option');
        option.value = lap;
        option.textContent = `Lap ${lap}`;
        select.appendChild(option);
    });

    // Bottone per selezionare giro più veloce
    const fastestButton = document.createElement('button');
    fastestButton.textContent = 'Giro più veloce';
    fastestButton.className = 'btn btn-secondary ml-2';
    fastestButton.addEventListener('click', handleSelectFastestLap);

    // Bottone placeholder per modalità interattiva futura
    const interactiveButton = document.createElement('button');
    interactiveButton.textContent = 'Seleziona da grafico (coming soon)';
    interactiveButton.className = 'btn btn-disabled ml-2';
    interactiveButton.disabled = true;

    // Event listener per select
    select.addEventListener('change', handleLapChange);

    // Appendi tutto
    container.appendChild(select);
    container.appendChild(fastestButton);
    container.appendChild(interactiveButton);
}


// Handle lap change
async function handleLapChange(event) {
    const lap = parseInt(event.target.value);
    if (!lap) return;

    console.log('Lap selected:', lap);
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
                driver: selectedDrivers.find(d => d.driver_number === driverNumber)
            };
        });

        console.log('Telemetry data:', state.telemetryData);
    } catch (error) {
        console.error('Error loading telemetry data:', error);
    } finally {
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



