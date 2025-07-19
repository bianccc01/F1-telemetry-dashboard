// Modulo API per OpenF1
const API = {
    // URL base dell'API
    baseURL: 'https://api.openf1.org/v1',

    // Cache per ottimizzare le richieste
    cache: {
        sessions: null,
        drivers: new Map(),
        laps: new Map()
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
    async getCarData(sessionKey, driverNumber, lapNumber) {
        if (!driverNumber) {
            const drivers = await this.getDrivers(sessionKey);
            if (drivers.length > 0) {
                driverNumber = drivers[0].driver_number;
            } else {
                return [];
            }
        }

        if (!lapNumber) {
            return await this.fetchData('/location', { session_key: sessionKey, driver_number: driverNumber });
        }

        const laps = await this.getLaps(sessionKey, driverNumber);
        const targetLap = laps.find(l => l.lap_number == lapNumber);

        if (!targetLap) {
            console.error(`Lap ${lapNumber} not found for driver ${driverNumber}`);
            return [];
        }

        const lapStartTime = new Date(targetLap.date_start);
        const lapEndTime = new Date(lapStartTime.getTime() + (targetLap.lap_duration * 1000));

        // Fetch both car data and location data
        const [carData, locationData] = await Promise.all([
            this.fetchData('/car_data', {
                session_key: sessionKey,
                driver_number: driverNumber,
                'date>': lapStartTime.toISOString(),
                'date<': lapEndTime.toISOString()
            }),
            this.fetchData('/location', {
                session_key: sessionKey,
                driver_number: driverNumber,
                'date>': lapStartTime.toISOString(),
                'date<': lapEndTime.toISOString()
            })
        ]);

        // Merge the two datasets
        const mergedData = carData.map(carPoint => {
            const locationPoint = locationData.find(locPoint =>
                Math.abs(new Date(locPoint.date) - new Date(carPoint.date)) < 100 // 100ms tolerance
            );
            return {
                ...carPoint,
                x: locationPoint ? locationPoint.x : null,
                y: locationPoint ? locationPoint.y : null,
            };
        });

        return mergedData.filter(d => d.x !== null && d.y !== null);
    },

    // Ottieni lista dei giri
    async getLaps(sessionKey, driverNumber) {
        const cacheKey = `${sessionKey}-${driverNumber}`;
        if (this.cache.laps.has(cacheKey)) {
            return this.cache.laps.get(cacheKey);
        }

        const lapsData = await this.fetchData('/laps', {
            session_key: sessionKey,
            driver_number: driverNumber
        });

        const stintsData = await this.fetchData('/stints', {
            session_key: sessionKey,
            driver_number: driverNumber
        });

        // Arricchisci i dati dei giri con la mescola degli pneumatici dagli stint
        const enrichedLaps = lapsData.map(lap => {
            const stint = stintsData.find(s => lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end);
            return {
                ...lap,
                compound: stint ? stint.compound : 'Unknown'
            };
        });

        const result = enrichedLaps.filter(l => l.lap_number).sort((a, b) => a.lap_number - b.lap_number);
        this.cache.laps.set(cacheKey, result);
        return result;
    },

    // Ottieni il giro più veloce per un pilota
    async getFastestLap(sessionKey, driverNumber) {
        const laps = await this.getLaps(sessionKey, driverNumber);
        if (!laps || laps.length === 0) return null;

        const validLaps = laps.filter(l => typeof l.lap_duration === 'number');
        if (validLaps.length === 0) return null;

        return validLaps.reduce((best, lap) =>
            lap.lap_duration < best.lap_duration ? lap : best
        );
    },

    async getFastestLapOfGP(year, location, country, driverNumber = null) {
        const sessions = await this.getSessionsByGP(year, location, country);
        const sessionKeys = sessions.map(s => s.session_key);

        let fastestLapOverall = null;

        for (const sessionKey of sessionKeys) {
            const params = { session_key: sessionKey, 'lap_duration>': 0 };
            if (driverNumber) {
                params.driver_number = driverNumber;
            }
            const laps = await this.fetchData('/laps', params);
            if (!laps || laps.length === 0) continue;

            let fastestLapInSession = laps[0];
            for (const lap of laps) {
                if (lap.lap_duration < fastestLapInSession.lap_duration) {
                    fastestLapInSession = lap;
                }
            }

            if (!fastestLapOverall || fastestLapInSession.lap_duration < fastestLapOverall.lap_duration) {
                fastestLapOverall = fastestLapInSession;
            }
        }
        return fastestLapOverall;
    },

    async getWeatherData(sessionKey) {
        if (!sessionKey) {
            console.error('Session key is required for weather forecast.');
            return null;
        }

        try {
            // The API returns a list, so we take the first element
            const weatherData = await this.fetchData('/weather', { session_key: sessionKey });
            return weatherData && weatherData.length > 0 ? weatherData[0] : null;
        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            return null;
        }
    },

    async getIntervals(sessionKey, driverNumber, lapNumber) {
        return await this.fetchData('/intervals', {
            session_key: sessionKey,
            driver_number: driverNumber,
            lap_number: lapNumber
        });
    }
};