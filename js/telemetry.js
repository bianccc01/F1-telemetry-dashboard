// Gestione dati telemetria e caricamento
const TelemetryManager = {

    // Carica telemetria per un lap specifico (tutti i driver stesso lap)
    async loadForLap(lap) {
        if (!state.selectedSession || state.selectedDrivers.every(d => !d)) return;

        console.log('Loading telemetry for lap:', lap);
        state.selectedLap = lap;

        showLoading();
        try {
            const selectedDrivers = state.selectedDrivers.filter(d => d);
            const sessionKey = state.selectedSession.session_key;
            const driverNumbers = selectedDrivers.map(d => d.driver_number);

            // 1. Carica TUTTI i dati telemetria (senza lap_number)
            const allTelemetryData = await API.getCarData(sessionKey, driverNumbers);

            // 2. Carica i dati dei lap per sapere i timing
            const lapData = await API.getLaps(sessionKey, driverNumbers);

            // 3. Associa telemetria ai lap usando i timing
            state.telemetryData = {};

            for (let i = 0; i < driverNumbers.length; i++) {
                const driverNumber = driverNumbers[i];
                const driverTelemetry = allTelemetryData[i];
                const driver = selectedDrivers.find(d => d.driver_number === driverNumber);

                // Filtra telemetria per il lap specifico
                const lapTelemetry = await this.filterTelemetryByLap(
                    driverTelemetry,
                    sessionKey,
                    driverNumber,
                    lap
                );

                state.telemetryData[driverNumber] = {
                    data: lapTelemetry,
                    driver: driver,
                    color: state.slotColors[state.selectedDrivers.findIndex(d => d && d.driver_number === driverNumber)],
                    lap: lap
                };
            }

            console.log('Telemetry data loaded and filtered:', state.telemetryData);
        } catch (error) {
            console.error('Error loading telemetry data:', error);
        } finally {
            hideLoading();
        }
    },

    async filterTelemetryByLap(telemetryData, sessionKey, driverNumber, targetLap) {
        try {
            // 📡 Carica i dati del lap specifico usando l'endpoint /laps
            const lapData = await API.fetchData('/laps', {
                session_key: sessionKey,
                driver_number: driverNumber,
                lap_number: targetLap
            });

            if (!lapData || lapData.length === 0) {
                console.warn(`❌ No lap data found for driver ${driverNumber}, lap ${targetLap}`);
                return [];
            }

            const lapInfo = lapData[0];

            // 🕐 Calcola l'intervallo temporale del lap
            const lapStart = new Date(lapInfo.date_start);
            const lapEnd = new Date(lapStart.getTime() + (lapInfo.lap_duration * 1000));

            console.log(`🔍 Filtering telemetry for driver ${driverNumber}, lap ${targetLap}:`);
            console.log(`📅 Lap start: ${lapStart.toISOString()}`);
            console.log(`📅 Lap end: ${lapEnd.toISOString()}`);
            console.log(`⏱️ Lap duration: ${lapInfo.lap_duration}s`);

            // 🎯 Filtra i dati telemetria nel range temporale del lap
            const filteredData = telemetryData.filter(point => {
                const pointDate = new Date(point.date);
                return pointDate >= lapStart && pointDate <= lapEnd;
            });

            console.log(`✅ Filtered ${filteredData.length} points from ${telemetryData.length} total`);

            if (filteredData.length === 0) {
                console.warn(`❌ No telemetry data found in lap time range for driver ${driverNumber}, lap ${targetLap}`);
                console.log('🔍 Available telemetry time range:',
                    telemetryData.length > 0 ? {
                        first: new Date(telemetryData[0].date).toISOString(),
                        last: new Date(telemetryData[telemetryData.length - 1].date).toISOString()
                    } : 'No telemetry data available'
                );
            }

            return filteredData;

        } catch (error) {
            console.error(`❌ Error filtering telemetry for driver ${driverNumber}, lap ${targetLap}:`, error);
            return [];
        }
    },


    // Carica telemetria per i giri più veloci (ogni driver sul suo giro migliore)
    async loadForFastestLaps(fastestLaps) {
        if (!state.selectedSession || state.selectedDrivers.every(d => !d)) return;

        state.selectedLap = fastestLaps;
        state.telemetryData = {};

        const sessionKey = state.selectedSession.session_key;

        showLoading();
        try {
            for (const [driverNumber, lapNumber] of Object.entries(fastestLaps)) {
                try {
                    // Carica tutti i dati telemetria per il driver
                    const allTelemetryData = await API.getCarData(sessionKey, [parseInt(driverNumber)]);

                    // Filtra per il lap specifico
                    const lapTelemetry = await this.filterTelemetryByLap(
                        allTelemetryData[0],
                        sessionKey,
                        parseInt(driverNumber),
                        lapNumber
                    );

                    const driver = state.selectedDrivers.find(d => d.driver_number == driverNumber);
                    const slotIndex = state.selectedDrivers.findIndex(d => d && d.driver_number == driverNumber);

                    state.telemetryData[driverNumber] = {
                        data: lapTelemetry,
                        driver: driver,
                        color: state.slotColors[slotIndex],
                        lap: lapNumber
                    };
                } catch (error) {
                    console.error(`Error loading telemetry for driver ${driverNumber}:`, error);
                }
            }

            console.log('Fastest laps telemetry loaded:', state.telemetryData);
        } catch (error) {
            console.error('Error loading fastest laps telemetry:', error);
        } finally {
            hideLoading();
        }
    }
};