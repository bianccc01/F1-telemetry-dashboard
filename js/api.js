// Modulo API per OpenF1
const API = {
    // URL base dell'API
    baseURL: 'https://api.openf1.org/v1',

    // Cache per ottimizzare le richieste
    cache: {
        sessions: null,
        drivers: new Map()
    },

    // Metodo helper per fare richieste
    async fetchData(endpoint, params = {}) {
        try {
            const url = new URL(`${this.baseURL}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });

            console.log('Fetching:', url.toString());

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Ottieni tutte le sessioni
    async getAllSessions() {
        if (!this.cache.sessions) {
            const data = await this.fetchData('/sessions');
            this.cache.sessions = data;
        }
        return this.cache.sessions;
    },

    // Ottieni anni disponibili
    async getAvailableYears() {
        const sessions = await this.getAllSessions();
        const years = [...new Set(sessions.map(s => new Date(s.date_start).getFullYear()))];
        return years.sort((a, b) => b - a); // Ordine decrescente
    },

    // Ottieni GP per un anno
    async getGrandPrixByYear(year) {
        const sessions = await this.getAllSessions();
        const yearSessions = sessions.filter(s =>
            new Date(s.date_start).getFullYear() === year
        );

        // Raggruppa per GP (location + country)
        const gpMap = new Map();
        yearSessions.forEach(session => {
            const gpKey = `${session.location}_${session.country_name}`;
            if (!gpMap.has(gpKey)) {
                gpMap.set(gpKey, {
                    location: session.location,
                    country_name: session.country_name,
                    country_code: session.country_code,
                    circuit_short_name: session.circuit_short_name,
                    sessions: []
                });
            }
            gpMap.get(gpKey).sessions.push(session);
        });

        return Array.from(gpMap.values());
    },

    // Ottieni sessioni per un GP
    async getSessionsByGP(year, location, country) {
        const sessions = await this.getAllSessions();
        return sessions.filter(s => {
            const sessionYear = new Date(s.date_start).getFullYear();
            return sessionYear === year &&
                s.location === location &&
                s.country_name === country;
        }).sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
    },

    // Ottieni i driver di una sessione (con cache)
    async getDrivers(sessionKey) {
        if (!this.cache.drivers.has(sessionKey)) {
            const data = await this.fetchData('/drivers', {
                session_key: sessionKey
            });

            // Rimuovi duplicati e mantieni l'ultimo record per ogni driver
            const driversMap = new Map();
            data.forEach(driver => {
                driversMap.set(driver.driver_number, driver);
            });

            const uniqueDrivers = Array.from(driversMap.values())
                .sort((a, b) => a.driver_number - b.driver_number);

            this.cache.drivers.set(sessionKey, uniqueDrivers);
        }

        return this.cache.drivers.get(sessionKey);
    },

    // Ottieni dati telemetria
    async getCarData(sessionKey, driverNumbers, lapNumber = null) {
        const promises = driverNumbers.map(driverNum =>
            this.fetchData('/car_data', {
                session_key: sessionKey,
                driver_number: driverNum,
                lap_number: lapNumber
            })
        );

        const results = await Promise.all(promises);
        return results;
    },

    // Ottieni lista dei giri
    async getLaps(sessionKey, driverNumbers) {
        const promises = driverNumbers.map(driverNum =>
            this.fetchData('/laps', {
                session_key: sessionKey,
                driver_number: driverNum
            })
        );

        const results = await Promise.all(promises);
        const allLaps = results.flat();
        const uniqueLaps = [...new Set(allLaps.map(lap => lap.lap_number))];
        return uniqueLaps.sort((a, b) => a - b);
    }
};

async function getFastestLap(sessionKey, driverNumbers) {
    const fastestLaps = {};

    for (const dn of driverNumbers) {
        const query = new URLSearchParams({
            session_key: sessionKey,
            driver_number: dn
        });

        const url = `https://api.openf1.org/v1/laps?${query.toString()}`;
        console.log(`Fetching laps for driver ${dn}:`, url);

        const response = await fetch(url);
        const data = await response.json();

        const validLaps = data.filter(l => typeof l.lap_duration === 'number' && l.lap_number);

        if (validLaps.length === 0) {
            console.warn(`No valid laps found for driver ${dn}`);
            continue;
        }

        const bestLap = validLaps.reduce((best, lap) =>
            lap.lap_duration < best.lap_duration ? lap : best
        );

        fastestLaps[dn] = bestLap.lap_number;
    }

    return fastestLaps;
}



API.getFastestLap = getFastestLap;