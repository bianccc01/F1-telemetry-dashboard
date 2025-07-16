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

                // Aggiungi dati di posizione X,Y
                const telemetryWithPosition = await this.enrichWithPositionData(
                    lapTelemetry,
                    sessionKey,
                    driverNumber
                );

                // Aggiungi calcolo della distanza cumulativa
                const telemetryWithDistance = this.calculateCumulativeDistance(telemetryWithPosition);

                // Aggiungi informazioni sui settori
                const telemetryWithSectors = await this.enrichWithSectorData(telemetryWithDistance, sessionKey);

                state.telemetryData[driverNumber] = {
                    data: telemetryWithSectors,
                    driver: driver,
                    driverName: driver.name_acronym || driver.full_name,
                    driverNumber: driverNumber,
                    acronym: driver.name_acronym,
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

    // Nuova funzione per aggiungere i dati di posizione X,Y
    async enrichWithPositionData(telemetryData, sessionKey, driverNumber) {
        try {
            console.log(`📍 Loading position data for driver ${driverNumber}`);

            // Carica i dati di posizione dall'endpoint /location
            const positionData = await API.fetchData('/location', {
                session_key: sessionKey,
                driver_number: driverNumber
            });

            if (!positionData || positionData.length === 0) {
                console.warn(`⚠️ No position data found for driver ${driverNumber}`);
                return telemetryData;
            }

            // Crea una mappa per accesso rapido ai dati di posizione per timestamp
            const positionMap = new Map();
            positionData.forEach(pos => {
                const timestamp = new Date(pos.date).getTime();
                positionMap.set(timestamp, { x: pos.x, y: pos.y, z: pos.z });
            });

            // Arricchisci i dati telemetria con le coordinate X,Y
            const enrichedData = telemetryData.map(point => {
                const pointTimestamp = new Date(point.date).getTime();

                // Cerca la posizione esatta o la più vicina
                let position = positionMap.get(pointTimestamp);

                if (!position) {
                    // Se non c'è match esatto, trova la posizione più vicina nel tempo
                    let closestTime = Infinity;
                    let closestPosition = null;

                    for (const [timestamp, pos] of positionMap) {
                        const timeDiff = Math.abs(timestamp - pointTimestamp);
                        if (timeDiff < closestTime && timeDiff < 1000) { // Max 1 secondo di differenza
                            closestTime = timeDiff;
                            closestPosition = pos;
                        }
                    }

                    position = closestPosition;
                }

                return {
                    ...point,
                    x: position ? position.x : 0,
                    y: position ? position.y : 0,
                    z: position ? position.z : 0
                };
            });

            console.log(`✅ Enriched ${enrichedData.length} telemetry points with position data`);
            return enrichedData;

        } catch (error) {
            console.error(`❌ Error loading position data for driver ${driverNumber}:`, error);
            // In caso di errore, ritorna i dati originali
            return telemetryData;
        }
    },

    async enrichWithSectorData(telemetryData, sessionKey) {
        try {
            console.log('🔄 Loading sector data...');
            const sectorData = await API.fetchData('/sectors', { session_key: sessionKey });

            if (!sectorData || Object.keys(sectorData).length === 0) {
                console.warn('⚠️ No sector data available for this session.');
                return telemetryData.map(p => ({ ...p, sector: null }));
            }

            // Ordina i punti di telemetria per distanza
            telemetryData.sort((a, b) => a.distance - b.distance);

            // Trova la distanza massima (lunghezza del giro)
            const maxDistance = Math.max(...telemetryData.map(p => p.distance));

            // Mappa le distanze dei settori
            const sectorBoundaries = [
                { distance: sectorData.sector_1_dist, sector: 1 },
                { distance: sectorData.sector_2_dist, sector: 2 },
                { distance: maxDistance, sector: 3 } // Il settore 3 finisce alla fine del giro
            ].sort((a, b) => a.distance - b.distance);

            let currentBoundaryIndex = 0;
            const enrichedData = telemetryData.map(point => {
                while (currentBoundaryIndex < sectorBoundaries.length - 1 && point.distance > sectorBoundaries[currentBoundaryIndex].distance) {
                    currentBoundaryIndex++;
                }
                return {
                    ...point,
                    sector: sectorBoundaries[currentBoundaryIndex].sector
                };
            });

            console.log('✅ Enriched telemetry with sector data.');
            return enrichedData;

        } catch (error) {
            console.error('❌ Error enriching with sector data:', error);
            return telemetryData.map(p => ({ ...p, sector: null })); // Ritorna i dati senza info sui settori in caso di errore
        }
    },

    // Calcola la distanza cumulativa se non presente
    calculateCumulativeDistance(telemetryData) {
        if (!telemetryData || telemetryData.length === 0) return telemetryData;

        // Se la distanza è già presente, ritorna i dati così come sono
        if (telemetryData[0].distance !== undefined) {
            return telemetryData;
        }

        // Altrimenti calcola la distanza cumulativa
        let cumulativeDistance = 0;
        const dataWithDistance = telemetryData.map((point, index) => {
            if (index > 0) {
                const prevPoint = telemetryData[index - 1];
                const timeDiff = (new Date(point.date) - new Date(prevPoint.date)) / 1000; // secondi
                const avgSpeed = (point.speed + prevPoint.speed) / 2 / 3.6; // m/s
                cumulativeDistance += avgSpeed * timeDiff;
            }

            return {
                ...point,
                distance: cumulativeDistance
            };
        });

        return dataWithDistance;
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

                    // Aggiungi dati di posizione X,Y
                    const telemetryWithPosition = await this.enrichWithPositionData(
                        lapTelemetry,
                        sessionKey,
                        parseInt(driverNumber)
                    );

                    // Aggiungi calcolo della distanza cumulativa
                    const telemetryWithDistance = this.calculateCumulativeDistance(telemetryWithPosition);

                    // Aggiungi informazioni sui settori
                    const telemetryWithSectors = await this.enrichWithSectorData(telemetryWithDistance, sessionKey);

                    const driver = state.selectedDrivers.find(d => d && d.driver_number == driverNumber);
                    const slotIndex = state.selectedDrivers.findIndex(d => d && d.driver_number == driverNumber);

                    state.telemetryData[driverNumber] = {
                        data: telemetryWithSectors,
                        driver: driver,
                        driverName: driver.name_acronym || driver.full_name,
                        driverNumber: parseInt(driverNumber),
                        acronym: driver.name_acronym,
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