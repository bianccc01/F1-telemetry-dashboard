// Modulo API per OpenF1 con gestione avanzata del rate limiting
const API = {
    // URL base dell'API
    baseURL: 'https://api.openf1.org/v1',

    // Cache per ottimizzare le richieste
    cache: {
        sessions: null,
        drivers: new Map(),
        laps: new Map(),
        weather: new Map(),
        stints: new Map(),
        // Cache con TTL (Time To Live)
        ttl: 5 * 60 * 1000, // 5 minuti
        timestamps: new Map()
    },

    // Coda di richieste e rate limiting
    requestQueue: [],
    isProcessing: false,
    rateLimit: 3, // Ridotto ulteriormente per sicurezza
    burstLimit: 10, // Limite burst per finestra di 10 secondi
    lastRequestTime: 0,
    requestCounter: 0,
    requestWindowStart: 0,
    burstWindowStart: 0,
    burstCounter: 0,

    // Backoff esponenziale per errori 429
    backoffMultiplier: 1,
    maxBackoffMultiplier: 8,
    lastErrorTime: 0,

    // Statistiche per monitoraggio
    stats: {
        totalRequests: 0,
        errors429: 0,
        cacheHits: 0
    },

    // Verifica se un dato in cache è ancora valido
    isCacheValid(key) {
        const timestamp = this.cache.timestamps.get(key);
        if (!timestamp) return false;
        return Date.now() - timestamp < this.cache.ttl;
    },

    // Salva in cache con timestamp
    setCacheWithTTL(key, data) {
        this.cache.timestamps.set(key, Date.now());
        return data;
    },

    // Funzione per processare la coda con backoff esponenziale
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        const { endpoint, params, resolve, reject, priority } = this.requestQueue.shift();

        try {
            const now = Date.now();

            // Reset contatori se necessario
            if (now - this.requestWindowStart > 1000) {
                this.requestWindowStart = now;
                this.requestCounter = 0;
            }

            if (now - this.burstWindowStart > 10000) {
                this.burstWindowStart = now;
                this.burstCounter = 0;
            }

            // Calcola delay con backoff esponenziale
            const baseDelay = 1000 / this.rateLimit;
            const backoffDelay = baseDelay * this.backoffMultiplier;
            const timeSinceLastRequest = now - this.lastRequestTime;
            let delay = Math.max(0, backoffDelay - timeSinceLastRequest);

            // Verifica limiti
            if (this.requestCounter >= this.rateLimit) {
                const waitForNextWindow = (this.requestWindowStart + 1000) - now;
                delay = Math.max(delay, waitForNextWindow);
            }

            if (this.burstCounter >= this.burstLimit) {
                const waitForBurstWindow = (this.burstWindowStart + 10000) - now;
                delay = Math.max(delay, waitForBurstWindow);
            }

            // Attendi se necessario
            if (delay > 0) {
                console.log(`Rate limiting: waiting ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            const url = new URL(`${this.baseURL}${endpoint}`);
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });

            console.log('Fetching:', url.toString());
            this.stats.totalRequests++;

            const response = await fetch(url);

            if (response.status === 429) {
                this.stats.errors429++;
                this.lastErrorTime = Date.now();

                // Aumenta il backoff
                this.backoffMultiplier = Math.min(
                    this.backoffMultiplier * 2,
                    this.maxBackoffMultiplier
                );

                // Leggi il header Retry-After se presente
                const retryAfter = response.headers.get('Retry-After');
                const waitTime = retryAfter ?
                    (parseInt(retryAfter) * 1000) :
                    (backoffDelay * 2);

                console.warn(`Rate limit hit (429). Waiting ${waitTime}ms. Backoff: ${this.backoffMultiplier}x`);

                // Rimetti in coda con priorità alta
                this.requestQueue.unshift({
                    endpoint,
                    params,
                    resolve,
                    reject,
                    priority: 'high'
                });

                // Attendi prima di riprovare
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.lastRequestTime = Date.now();
            this.requestCounter++;
            this.burstCounter++;

            // Riduci gradualmente il backoff dopo successo
            if (now - this.lastErrorTime > 30000 && this.backoffMultiplier > 1) {
                this.backoffMultiplier = Math.max(1, this.backoffMultiplier / 2);
            }

            resolve(data);
        } catch (error) {
            console.error('API Error:', error);
            reject(error);
        } finally {
            this.isProcessing = false;
            // Processa la richiesta successiva con un piccolo delay
            setTimeout(() => this.processQueue(), 50);
        }
    },

    // Metodo helper per fare richieste con priorità
    fetchData(endpoint, params = {}, priority = 'normal') {
        return new Promise((resolve, reject) => {
            if (priority === 'high') {
                this.requestQueue.unshift({ endpoint, params, resolve, reject, priority });
            } else {
                this.requestQueue.push({ endpoint, params, resolve, reject, priority });
            }
            this.processQueue();
        });
    },

    // Batch di richieste correlate
    async batchFetch(requests) {
        // Ordina le richieste per priorità
        const sortedRequests = requests.sort((a, b) =>
            a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0
        );

        // Esegui con un delay tra ogni richiesta
        const results = [];
        for (const req of sortedRequests) {
            results.push(await this.fetchData(req.endpoint, req.params, req.priority));
            // Piccolo delay tra richieste nel batch
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return results;
    },

    // Ottieni tutte le sessioni (con cache migliorata)
    async getAllSessions() {
        const cacheKey = 'all_sessions';
        if (this.cache.sessions && this.isCacheValid(cacheKey)) {
            this.stats.cacheHits++;
            return this.cache.sessions;
        }

        const data = await this.fetchData('/sessions');
        this.cache.sessions = data;
        this.setCacheWithTTL(cacheKey, data);
        return data;
    },

    // Ottieni anni disponibili
    async getAvailableYears() {
        const sessions = await this.getAllSessions();
        const years = [...new Set(sessions.map(s => new Date(s.date_start).getFullYear()))];
        return years.sort((a, b) => b - a);
    },

    // Ottieni GP per un anno
    async getGrandPrixByYear(year) {
        const sessions = await this.getAllSessions();
        const yearSessions = sessions.filter(s =>
            new Date(s.date_start).getFullYear() === year
        );

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

    // Ottieni i driver di una sessione (con cache migliorata)
    async getDrivers(sessionKey) {
        const cacheKey = `drivers_${sessionKey}`;
        if (this.cache.drivers.has(sessionKey) && this.isCacheValid(cacheKey)) {
            this.stats.cacheHits++;
            return this.cache.drivers.get(sessionKey);
        }

        const data = await this.fetchData('/drivers', {
            session_key: sessionKey
        });

        const driversMap = new Map();
        data.forEach(driver => {
            driversMap.set(driver.driver_number, driver);
        });

        const uniqueDrivers = Array.from(driversMap.values())
            .sort((a, b) => a.driver_number - b.driver_number);

        this.cache.drivers.set(sessionKey, uniqueDrivers);
        this.setCacheWithTTL(cacheKey, uniqueDrivers);
        return uniqueDrivers;
    },

    // Ottieni dati telemetria (ottimizzato)
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
            return await this.fetchData('/location', {
                session_key: sessionKey,
                driver_number: driverNumber
            });
        }

        const laps = await this.getLaps(sessionKey, driverNumber);
        const targetLap = laps.find(l => l.lap_number == lapNumber);

        if (!targetLap) {
            console.error(`Lap ${lapNumber} not found for driver ${driverNumber}`);
            return [];
        }

        const lapStartTime = new Date(targetLap.date_start);
        const lapEndTime = new Date(lapStartTime.getTime() + (targetLap.lap_duration * 1000));

        // Usa batch fetch per richieste correlate
        const [carData, locationData] = await this.batchFetch([
            {
                endpoint: '/car_data',
                params: {
                    session_key: sessionKey,
                    driver_number: driverNumber,
                    'date>': lapStartTime.toISOString(),
                    'date<': lapEndTime.toISOString()
                },
                priority: 'normal'
            },
            {
                endpoint: '/location',
                params: {
                    session_key: sessionKey,
                    driver_number: driverNumber,
                    'date>': lapStartTime.toISOString(),
                    'date<': lapEndTime.toISOString()
                },
                priority: 'normal'
            }
        ]);

        // Merge dei dati
        const mergedData = carData.map(carPoint => {
            const locationPoint = locationData.find(locPoint =>
                Math.abs(new Date(locPoint.date) - new Date(carPoint.date)) < 100
            );
            return {
                ...carPoint,
                x: locationPoint ? locationPoint.x : null,
                y: locationPoint ? locationPoint.y : null,
            };
        });

        return mergedData.filter(d => d.x !== null && d.y !== null);
    },

    // Ottieni lista dei giri (con cache degli stint)
    async getLaps(sessionKey, driverNumber) {
        const cacheKey = `laps_${sessionKey}-${driverNumber}`;
        if (this.cache.laps.has(cacheKey) && this.isCacheValid(cacheKey)) {
            this.stats.cacheHits++;
            return this.cache.laps.get(cacheKey);
        }

        // Controlla se abbiamo già gli stint in cache
        const stintsCacheKey = `stints_${sessionKey}-${driverNumber}`;
        let stintsData;

        if (this.cache.stints.has(stintsCacheKey) && this.isCacheValid(stintsCacheKey)) {
            this.stats.cacheHits++;
            stintsData = this.cache.stints.get(stintsCacheKey);
        } else {
            // Usa batch fetch per ottimizzare
            const [lapsData, stints] = await this.batchFetch([
                {
                    endpoint: '/laps',
                    params: { session_key: sessionKey, driver_number: driverNumber },
                    priority: 'high'
                },
                {
                    endpoint: '/stints',
                    params: { session_key: sessionKey, driver_number: driverNumber },
                    priority: 'normal'
                }
            ]);

            stintsData = stints;
            this.cache.stints.set(stintsCacheKey, stints);
            this.setCacheWithTTL(stintsCacheKey, stints);

            // Arricchisci i dati
            const enrichedLaps = lapsData.map(lap => {
                const stint = stintsData.find(s =>
                    lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end
                );
                return {
                    ...lap,
                    compound: stint ? stint.compound : 'Unknown'
                };
            });

            const result = enrichedLaps.filter(l => l.lap_number)
                .sort((a, b) => a.lap_number - b.lap_number);

            this.cache.laps.set(cacheKey, result);
            this.setCacheWithTTL(cacheKey, result);
            return result;
        }

        // Se abbiamo gli stint ma non i laps
        const lapsData = await this.fetchData('/laps', {
            session_key: sessionKey,
            driver_number: driverNumber
        });

        const enrichedLaps = lapsData.map(lap => {
            const stint = stintsData.find(s =>
                lap.lap_number >= s.lap_start && lap.lap_number <= s.lap_end
            );
            return {
                ...lap,
                compound: stint ? stint.compound : 'Unknown'
            };
        });

        const result = enrichedLaps.filter(l => l.lap_number)
            .sort((a, b) => a.lap_number - b.lap_number);

        this.cache.laps.set(cacheKey, result);
        this.setCacheWithTTL(cacheKey, result);
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

    // Ottieni il giro più veloce del GP (ottimizzato)
    async getFastestLapOfGP(year, location, country, driverNumber = null) {
        const sessions = await this.getSessionsByGP(year, location, country);
        const sessionKeys = sessions.map(s => s.session_key);

        let fastestLapOverall = null;

        // Processa le sessioni in serie per evitare troppi request paralleli
        for (const sessionKey of sessionKeys) {
            const params = { session_key: sessionKey, 'lap_duration>': 0 };
            if (driverNumber) {
                params.driver_number = driverNumber;
            }

            try {
                const laps = await this.fetchData('/laps', params);
                if (!laps || laps.length === 0) continue;

                let fastestLapInSession = laps[0];
                for (const lap of laps) {
                    if (lap.lap_duration < fastestLapInSession.lap_duration) {
                        fastestLapInSession = lap;
                    }
                }

                if (!fastestLapOverall ||
                    fastestLapInSession.lap_duration < fastestLapOverall.lap_duration) {
                    fastestLapOverall = fastestLapInSession;
                }
            } catch (error) {
                console.warn(`Failed to fetch laps for session ${sessionKey}:`, error);
                // Continua con la prossima sessione invece di bloccarsi
            }

            // Piccolo delay tra le sessioni
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return fastestLapOverall;
    },

    // Ottieni dati meteo (con cache)
    async getWeatherData(sessionKey) {
        if (!sessionKey) {
            console.error('Session key is required for weather forecast.');
            return null;
        }

        const cacheKey = `weather_${sessionKey}`;
        if (this.cache.weather.has(cacheKey) && this.isCacheValid(cacheKey)) {
            this.stats.cacheHits++;
            return this.cache.weather.get(cacheKey);
        }

        try {
            const weatherData = await this.fetchData('/weather', {
                session_key: sessionKey
            });
            const result = weatherData && weatherData.length > 0 ? weatherData[0] : null;

            if (result) {
                this.cache.weather.set(cacheKey, result);
                this.setCacheWithTTL(cacheKey, result);
            }

            return result;
        } catch (error) {
            console.error('Failed to fetch weather data:', error);
            return null;
        }
    },

    // Ottieni intervalli
    async getIntervals(sessionKey, driverNumber, lapNumber) {
        return await this.fetchData('/intervals', {
            session_key: sessionKey,
            driver_number: driverNumber,
            lap_number: lapNumber
        });
    },

    // Metodo per monitorare le statistiche
    getStats() {
        return {
            ...this.stats,
            cacheHitRate: this.stats.totalRequests > 0 ?
                (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) + '%' :
                '0%',
            error429Rate: this.stats.totalRequests > 0 ?
                (this.stats.errors429 / this.stats.totalRequests * 100).toFixed(2) + '%' :
                '0%',
            currentBackoff: this.backoffMultiplier + 'x',
            queueLength: this.requestQueue.length
        };
    },

    // Reset delle statistiche
    resetStats() {
        this.stats = {
            totalRequests: 0,
            errors429: 0,
            cacheHits: 0
        };
    },

    // Pulizia cache scaduta
    cleanExpiredCache() {
        const now = Date.now();

        // Pulisci timestamp scaduti
        for (const [key, timestamp] of this.cache.timestamps) {
            if (now - timestamp > this.cache.ttl) {
                this.cache.timestamps.delete(key);

                // Pulisci anche i dati associati
                if (key.startsWith('drivers_')) {
                    const sessionKey = key.replace('drivers_', '');
                    this.cache.drivers.delete(sessionKey);
                } else if (key.startsWith('laps_')) {
                    this.cache.laps.delete(key.replace('laps_', ''));
                } else if (key.startsWith('weather_')) {
                    this.cache.weather.delete(key.replace('weather_', ''));
                } else if (key.startsWith('stints_')) {
                    this.cache.stints.delete(key.replace('stints_', ''));
                } else if (key === 'all_sessions') {
                    this.cache.sessions = null;
                }
            }
        }
    }
};

// Pulizia automatica cache ogni minuto
setInterval(() => {
    API.cleanExpiredCache();
}, 60000);

// Export per uso in altri moduli
if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
}