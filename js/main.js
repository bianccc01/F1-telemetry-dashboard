// Stato globale dell'applicazione
const state = {
    availableYears: [],
    selectedYear: null,

    availableGPs: [],
    selectedGP: null,

    availableSessions: [],
    selectedSession: null,

    availableDrivers: [],
    selectedDrivers: [null, null, null, null], // 4 slot per driver

    telemetryData: {},
    laps: [],
    selectedLap: null,

    // Colori per i 4 slot driver
    slotColors: ['#FF1801', '#0600EF', '#00D2BE', '#FF8700']
};

// Funzioni helper
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

// Inizializzazione
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

// Inizializza applicazione
async function initializeApp() {
    // Carica anni disponibili
    state.availableYears = await API.getAvailableYears();
    console.log('Available years:', state.availableYears);

    // Popola selettore anni
    populateYearSelector();

    // Inizializza selettori vuoti
    initializeEmptySelectors();

    // Setup event listeners
    setupEventListeners();
}

// Popola selettore anni
function populateYearSelector() {
    const selector = document.getElementById('year-selector');

    const select = document.createElement('select');
    select.id = 'year-select';

    // Opzione default
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select year...';
    select.appendChild(defaultOption);

    // Aggiungi anni
    state.availableYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    });

    selector.appendChild(select);
}

// Inizializza selettori vuoti
function initializeEmptySelectors() {
    // GP selector
    const gpSelector = document.getElementById('gp-selector');
    gpSelector.innerHTML = '<select id="gp-select" disabled><option>Select year first...</option></select>';

    // Session selector
    const sessionSelector = document.getElementById('session-selector');
    sessionSelector.innerHTML = '<select id="session-select" disabled><option>Select GP first...</option></select>';

    // Driver selectors
    for (let i = 1; i <= 4; i++) {
        const container = document.getElementById(`driver-${i}-container`);
        container.innerHTML = `
            <div class="driver-color-indicator" style="background-color: ${state.slotColors[i-1]}"></div>
            <select id="driver-select-${i}" class="driver-select" disabled>
                <option>Select session first...</option>
            </select>
        `;
    }

    // Lap selector
    const lapSelector = document.getElementById('lap-selector');
    lapSelector.innerHTML = '<select id="lap-select" disabled><option>Select drivers first...</option></select>';
}

// Setup event listeners
function setupEventListeners() {
    // Year change
    document.getElementById('year-select').addEventListener('change', handleYearChange);

    // GP change
    document.getElementById('gp-selector').addEventListener('change', handleGPChange);

    // Session change
    document.getElementById('session-selector').addEventListener('change', handleSessionChange);

    // Driver changes
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

    // Reset selezioni successive
    state.selectedGP = null;
    state.selectedSession = null;
    state.selectedDrivers = [null, null, null, null];

    showLoading();

    try {
        // Carica GP per l'anno
        state.availableGPs = await API.getGrandPrixByYear(year);
        console.log('Available GPs:', state.availableGPs);

        // Popola GP selector
        populateGPSelector();

        // Reset selettori successivi
        resetSessionSelector();
        resetDriverSelectors();
        resetLapSelector();

    } catch (error) {
        console.error('Error loading GPs:', error);
    }

    hideLoading();
}

// Popola GP selector
function populateGPSelector() {
    const selector = document.getElementById('gp-selector');

    const select = document.createElement('select');
    select.id = 'gp-select';

    // Opzione default
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select Grand Prix...';
    select.appendChild(defaultOption);

    // Aggiungi GP
    state.availableGPs.forEach(gp => {
        const option = document.createElement('option');
        option.value = `${gp.location}|${gp.country_name}`;
        option.textContent = `${gp.country_name} - ${gp.location}`;
        select.appendChild(option);
    });

    selector.innerHTML = '';
    selector.appendChild(select);

    // Re-attach listener
    select.addEventListener('change', handleGPChange);
}

// Handle GP change
async function handleGPChange(event) {
    const value = event.target.value;
    if (!value) return;

    const [location, country] = value.split('|');
    console.log('GP selected:', location, country);

    state.selectedGP = { location, country };

    // Reset selezioni successive
    state.selectedSession = null;
    state.selectedDrivers = [null, null, null, null];

    showLoading();

    try {
        // Carica sessioni per il GP
        state.availableSessions = await API.getSessionsByGP(
            state.selectedYear,
            location,
            country
        );
        console.log('Available sessions:', state.availableSessions);

        // Popola session selector
        populateSessionSelector();

        // Reset selettori successivi
        resetDriverSelectors();
        resetLapSelector();

    } catch (error) {
        console.error('Error loading sessions:', error);
    }

    hideLoading();
}

// Popola session selector
function populateSessionSelector() {
    const selector = document.getElementById('session-selector');

    const select = document.createElement('select');
    select.id = 'session-select';

    // Opzione default
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select session...';
    select.appendChild(defaultOption);

    // Aggiungi sessioni
    state.availableSessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.session_key;
        option.textContent = session.session_name;
        select.appendChild(option);
    });

    selector.innerHTML = '';
    selector.appendChild(select);

    // Re-attach listener
    select.addEventListener('change', handleSessionChange);
}

// Handle session change
async function handleSessionChange(event) {
    const sessionKey = event.target.value;
    if (!sessionKey) return;

    console.log('Session selected:', sessionKey);

    state.selectedSession = state.availableSessions.find(
        s => s.session_key == sessionKey
    );

    showLoading();

    try {
        // Carica driver per la sessione
        state.availableDrivers = await API.getDrivers(sessionKey);
        console.log('Available drivers:', state.availableDrivers);

        // Abilita e popola driver selectors
        populateDriverSelectors();

        // Reset lap selector
        resetLapSelector();

    } catch (error) {
        console.error('Error loading drivers:', error);
    }

    hideLoading();
}

// Popola driver selectors
function populateDriverSelectors() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`driver-select-${i}`);
        select.disabled = false;
        select.innerHTML = '';

        // Opzione default
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select driver...';
        select.appendChild(defaultOption);

        // Aggiungi driver
        state.availableDrivers.forEach(driver => {
            // Controlla se driver già selezionato in altro slot
            const alreadySelected = state.selectedDrivers.some(
                d => d && d.driver_number === driver.driver_number
            );

            if (!alreadySelected) {
                const option = document.createElement('option');
                option.value = driver.driver_number;
                option.textContent = `${driver.driver_number} - ${driver.name_acronym}`;
                select.appendChild(option);
            }
        });
    }
}

// Handle driver change
function handleDriverChange(slotIndex, driverNumber) {
    console.log(`Driver slot ${slotIndex + 1} changed to:`, driverNumber);

    if (!driverNumber) {
        state.selectedDrivers[slotIndex] = null;
    } else {
        const driver = state.availableDrivers.find(
            d => d.driver_number == driverNumber
        );
        state.selectedDrivers[slotIndex] = {
            ...driver,
            color: state.slotColors[slotIndex]
        };
    }

    // Aggiorna altri selettori per riflettere la selezione
    populateDriverSelectors();

    // Se almeno un driver selezionato, possiamo caricare dati
    const hasSelectedDrivers = state.selectedDrivers.some(d => d !== null);
    if (hasSelectedDrivers) {
        console.log('Selected drivers:', state.selectedDrivers.filter(d => d));
        // TODO: Caricare dati telemetria
    }
}

// Reset functions
function resetSessionSelector() {
    const selector = document.getElementById('session-selector');
    selector.innerHTML = '<select id="session-select" disabled><option>Select GP first...</option></select>';
}

function resetDriverSelectors() {
    for (let i = 1; i <= 4; i++) {
        const select = document.getElementById(`driver-select-${i}`);
        select.disabled = true;
        select.innerHTML = '<option>Select session first...</option>';
    }
}

function resetLapSelector() {
    const selector = document.getElementById('lap-selector');
    selector.innerHTML = '<select id="lap-select" disabled><option>Select drivers first...</option></select>';
}