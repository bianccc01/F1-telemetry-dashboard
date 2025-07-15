// main.js - Entry point dell'applicazione
import { OpenF1API } from './api/openf1.js';
import { SessionSelector } from './components/SessionSelector.js';
import { DriverSelector } from './components/DriverSelector.js';
import { TelemetryCharts } from './components/TelemetryCharts.js';
import { CircuitMap } from './components/CircuitMap.js';
import { State } from './store/state.js';
import { showLoading, hideLoading, showError } from './utils/helpers.js';

console.log('main.js caricato');

class F1Dashboard {
    constructor() {
        this.api = new OpenF1API();
        this.state = new State();
        this.components = {};

        // Inizializza solo quando il DOM è pronto
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    async init() {
        try {
            showLoading();

            // Inizializza componenti
            this.initializeComponents();

            // Carica dati iniziali
            await this.loadInitialData();

            // Setup event listeners
            this.setupEventListeners();

            hideLoading();

        } catch (error) {
            console.error('Errore inizializzazione dashboard:', error);
            showError('Errore nel caricamento della dashboard');
        }
    }

    initializeComponents() {
        // Check if required DOM elements exist
        const requiredElements = [
            '#driver-selector-container',
            '#session-selector-container',
            '#telemetry-charts-container',
            '#circuit-map-container'
        ];

        requiredElements.forEach(selector => {
            if (!document.querySelector(selector)) {
                throw new Error(`Elemento ${selector} non trovato nel DOM.`);
            }
        });

        // Inizializza i componenti principali
        this.components.sessionSelector = new SessionSelector(
            '#session-selector-container',
            this.state,
            this.api
        );

        this.components.driverSelector = new DriverSelector(
            '#driver-selector-container',
            this.state,
            this.api
        );

        this.components.telemetryCharts = new TelemetryCharts(
            '#telemetry-charts-container',
            this.state,
            this.api
        );

        this.components.circuitMap = new CircuitMap(
            '#circuit-map-container',
            this.state,
            this.api
        );

        console.log('Componenti inizializzati');
    }

    async loadInitialData() {
        try {
            // Carica l'ultima sessione disponibile
            const latestSession = await this.api.getLatestSession();

            if (latestSession) {
                this.state.setCurrentSession(latestSession);
                console.log('Sessione caricata:', latestSession);
            }

            // Carica i piloti disponibili
            const drivers = await this.api.getDrivers();
            this.state.setAvailableDrivers(drivers);
            console.log('Piloti caricati:', drivers.length);

        } catch (error) {
            console.error('Errore caricamento dati iniziali:', error);
            throw error;
        }
    }

    setupEventListeners() {
        // Listener per cambio sessione
        this.state.subscribe('currentSession', (session) => {
            this.onSessionChange(session);
        });

        // Listener per cambio piloti selezionati
        this.state.subscribe('selectedDrivers', (drivers) => {
            this.onDriversChange(drivers);
        });

        // Listener per retry button
        document.getElementById('retry-button')?.addEventListener('click', () => {
            this.init();
        });

        // Listener per selezione giri
        document.getElementById('lap-select')?.addEventListener('change', (e) => {
            const lapNumber = parseInt(e.target.value);
            if (lapNumber) {
                this.state.setSelectedLap(lapNumber);
            }
        });

        console.log('Event listeners configurati');
    }

    async onSessionChange(session) {
        if (!session) return;

        try {
            showLoading();

            // Aggiorna tutti i componenti con la nuova sessione
            await Promise.all([
                this.components.driverSelector.updateForSession(session),
                this.components.telemetryCharts.updateForSession(session),
                this.components.circuitMap.updateForSession(session)
            ]);

            hideLoading();

        } catch (error) {
            console.error('Errore cambio sessione:', error);
            showError('Errore nel caricamento della sessione');
        }
    }

    async onDriversChange(drivers) {
        if (!drivers || drivers.length === 0) return;

        try {
            showLoading();

            // Carica i dati telemetrici per i piloti selezionati
            const telemetryData = await this.loadTelemetryData(drivers);

            // Aggiorna i grafici
            this.components.telemetryCharts.updateData(telemetryData);
            this.components.circuitMap.updateDrivers(drivers);

            hideLoading();

        } catch (error) {
            console.error('Errore cambio piloti:', error);
            showError('Errore nel caricamento dei dati piloti');
        }
    }

    async loadTelemetryData(drivers) {
        const currentSession = this.state.getCurrentSession();
        if (!currentSession) return [];

        const telemetryPromises = drivers.map(driver =>
            this.api.getCarData(currentSession.session_key, driver.driver_number)
        );

        const results = await Promise.allSettled(telemetryPromises);

        return results
            .filter(result => result.status === 'fulfilled')
            .map(result => result.value);
    }
}

// Crea l’istanza della dashboard globalmente
window.f1Dashboard = new F1Dashboard();



// Debug helpers per lo sviluppo
const isDevelopment = window.location.hostname === 'localhost';
if (isDevelopment) {
    window.debugF1 = {
        getState: () => window.f1Dashboard.state.getState(),
        getAPI: () => window.f1Dashboard.api,
        getComponents: () => window.f1Dashboard.components
    };
}
