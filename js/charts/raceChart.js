const RaceChart = {
    tooltip: null, // Store tooltip reference
    hideOutliers: false, // Track outlier visibility state

    create: function(data) {
        const container = d3.select("#race-chart");
        container.selectAll("*").remove(); // Clear previous chart

        // Clean up existing tooltip if it exists
        this.cleanup();

        if (Object.keys(data).length === 0) {
            container.html("<p>No data for race chart.</p>");
            return;
        }

        // Add controls container
        const controlsContainer = container.append("div")
            .attr("class", "race-chart-controls")
            .style("margin-bottom", "10px");

        // Add outliers toggle button
        const outlierButton = controlsContainer.append("button")
            .attr("class", "outlier-toggle-btn")
            .style("padding", "5px 10px")
            .style("margin-right", "10px")
            .style("background-color", this.hideOutliers ? "#6c757d": "#dc3545")
            .style("color", "white")
            .style("border", "none")
            .style("border-radius", "4px")
            .style("cursor", "pointer")
            .text(this.hideOutliers ? "Show Outliers" : "Hide Outliers")
            .on("click", () => {
                this.hideOutliers = !this.hideOutliers;
                this.create(data); // Recreate chart with new setting
            });

        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = container.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        let allLaps = [];
        for (const driver in data) {
            const validLaps = data[driver].laps.filter(d => d.lap_duration !== null && !isNaN(d.lap_duration));
            data[driver].laps = validLaps;
            allLaps = allLaps.concat(validLaps);
        }

        // Calculate outlier threshold and Y domain
        let yDomainMin, yDomainMax;
        let outlierThreshold = null;
        let outlierCount = 0;

        if (this.hideOutliers && allLaps.length > 0) {
            // Calculate median lap time
            const sortedLaps = allLaps.map(d => d.lap_duration).sort((a, b) => a - b);
            const median = sortedLaps.length % 2 === 0
                ? (sortedLaps[sortedLaps.length / 2 - 1] + sortedLaps[sortedLaps.length / 2]) / 2
                : sortedLaps[Math.floor(sortedLaps.length / 2)];

            // Set threshold at 110% of median (similar to F1 Tempo)
            outlierThreshold = median * 1.1;

            // Count outliers
            outlierCount = allLaps.filter(d => d.lap_duration > outlierThreshold).length;

            // Only apply tighter Y domain if there are actually outliers to hide
            if (outlierCount > 0) {
                // Filter laps for Y domain calculation
                const filteredLaps = allLaps.filter(d => d.lap_duration <= outlierThreshold);

                if (filteredLaps.length > 0) {
                    // Tighter margins when hiding outliers for better visibility
                    const range = d3.max(filteredLaps, d => d.lap_duration) - d3.min(filteredLaps, d => d.lap_duration);
                    const margin = range * 0.05; // 5% margin
                    yDomainMin = d3.min(filteredLaps, d => d.lap_duration) - margin;
                    yDomainMax = d3.max(filteredLaps, d => d.lap_duration) + margin;
                } else {
                    // Fallback if all laps are outliers - use normal margins
                    yDomainMin = d3.min(allLaps, d => d.lap_duration) - 10;
                    yDomainMax = d3.max(allLaps, d => d.lap_duration) + 10;
                }
            } else {
                // No outliers found - use normal margins (no zoom)
                yDomainMin = d3.min(allLaps, d => d.lap_duration) - 10;
                yDomainMax = d3.max(allLaps, d => d.lap_duration) + 10;
            }

            // Show outlier count only if there are outliers
            if (outlierCount > 0) {
                controlsContainer.append("span")
                    .style("color", "#666")
                    .style("font-size", "14px")
                    .text(`(${outlierCount} outliers hidden)`);
            }
        } else {
            // Show all data with normal margins
            yDomainMin = d3.min(allLaps, d => d.lap_duration) - 10;
            yDomainMax = d3.max(allLaps, d => d.lap_duration) + 10;
        }

        const x = d3.scaleLinear()
            .domain([
                d3.min(allLaps, d => d.lap_number) - 0.5,  // Add padding on the left
                d3.max(allLaps, d => d.lap_number) + 0.5   // Add padding on the right
            ])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([yDomainMin, yDomainMax])
            .range([height, 0]);

        // Crea un gruppo per gli assi
        const axisGroup = g.append("g").attr("class", "axis-group");

        const xAxis = axisGroup.append("g")
            .attr("class", "x-axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).tickValues(d3.range(5, d3.max(allLaps, d => d.lap_number) + 1, 5)));

        const yAxis = axisGroup.append("g")
            .attr("class", "y-axis")
            .call(d3.axisLeft(y).tickFormat(d => {
                const minutes = Math.floor(d / 60);
                const seconds = (d % 60).toFixed(0);
                return `${minutes}:${seconds.padStart(2, '0')}`;
            }));

        // Crea un gruppo per il contenuto che sarà zoomato
        const zoomGroup = g.append("g").attr("class", "zoom-group");

        // Create tooltip only once and store reference
        this.tooltip = d3.select("body").append("div")
            .attr("class", "tooltip race-chart-tooltip")
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "10px")
            .style("border-radius", "5px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("z-index", "1000");

        const tyreImages = {
            'SOFT': 'https://upload.wikimedia.org/wikipedia/commons/d/df/F1_tire_Pirelli_PZero_Red.svg',
            'MEDIUM': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/F1_tire_Pirelli_PZero_Yellow.svg',
            'HARD': 'https://upload.wikimedia.org/wikipedia/commons/d/d6/F1_tire_Pirelli_PZero_White.svg',
            'INTERMEDIATE': 'https://upload.wikimedia.org/wikipedia/commons/8/86/F1_tire_Pirelli_Cinturato_Green.svg',
            'WET': 'https://upload.wikimedia.org/wikipedia/commons/6/63/F1_tire_Pirelli_Cinturato_Blue.svg'
        };

        const tyreColors = {
            'SOFT': 'red',
            'MEDIUM': 'yellow',
            'HARD': 'white',
            'INTERMEDIATE': 'green',
            'WET': 'blue'
        };

        // Create line generator that handles outliers
        const line = d3.line()
            .x(d => x(d.lap_number))
            .y(d => {
                const yValue = y(d.lap_duration);
                // Clamp outliers to chart boundaries when hidden
                if (this.hideOutliers) {
                    if (yValue < 0) return 0;
                    if (yValue > height) return height;
                }
                return yValue;
            });

        const lines = zoomGroup.append("g").attr("class", "lines-group");
        const dots = zoomGroup.append("g").attr("class", "dots-group");

        // Crea tutte le linee e i punti (una sola volta)
        for (const driverId in data) {
            const driverData = data[driverId];

            // Draw the line
            lines.append("path")
                .datum(driverData.laps)
                .attr("class", `line-${driverId}`)
                .attr("fill", "none")
                .attr("stroke", driverData.color)
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Draw the dots
            dots.selectAll(`.dot-${driverId}`)
                .data(driverData.laps)
                .enter().append("circle")
                .attr("class", `dot dot-${driverId}`)
                .attr("cx", d => x(d.lap_number))
                .attr("cy", d => {
                    const yValue = y(d.lap_duration);
                    // Don't render outlier dots when option is enabled
                    return yValue;
                })
                .attr("r", 5)
                .style("fill", d => tyreColors[d.compound] || driverData.color)
                .style("stroke", driverData.color)
                .style("cursor", "pointer")
                .style("display", d => {
                    // Hide outlier dots based on threshold
                    if (this.hideOutliers && outlierThreshold && d.lap_duration > outlierThreshold) {
                        return "none";
                    }
                    return "block";
                })
                .on("mouseover", (event, d) => {
                    if (this.tooltip) {
                        this.tooltip.transition()
                            .duration(200)
                            .style("opacity", 0.9);
                        this.tooltip.html(`
                            <strong>${driverData.driver.name_acronym}</strong><br/>
                            Lap: ${d.lap_number}<br/>
                            Time: ${Math.floor(d.lap_duration / 60)}:${(d.lap_duration % 60).toFixed(3).padStart(6, '0')}<br/>
                            <img src="${tyreImages[d.compound]}" alt="${d.compound}" class="tyre-image-tooltip"/>
                        `)
                            .style("left", (event.pageX + 10) + "px")
                            .style("top", (event.pageY - 40) + "px");
                    }
                })
                .on("mouseout", () => {
                    if (this.tooltip) {
                        this.tooltip.transition()
                            .duration(200)
                            .style("opacity", 0);
                    }
                })
                .on("click", (event, d) => {
                    event.stopPropagation();

                    const driverNumber = driverData.driver.driver_number;
                    const lapNumber = d.lap_number;

                    console.log("Race chart click:", { driverNumber, lapNumber });

                    if (typeof handleLapChange === 'function' && typeof updateLoadButtonState === 'function') {
                        const lapSelector = document.getElementById(`lap-select-${driverNumber}`);
                        if (lapSelector) {
                            lapSelector.value = lapNumber;
                        }

                        if (typeof state !== 'undefined' && state.selectedLaps) {
                            state.selectedLaps[driverNumber] = lapNumber;
                            handleLapChange({ target: { dataset: { driverNumber: driverNumber }, value: lapNumber } });
                            updateLoadButtonState();
                        } else {
                            console.error("State object or selectedLaps not available");
                        }
                    } else {
                        console.error("Required functions not available:", {
                            handleLapChange: typeof handleLapChange,
                            updateLoadButtonState: typeof updateLoadButtonState
                        });
                    }
                });
        }

        // Funzione per aggiornare il grafico con una trasformazione (solo asse X)
        const updateZoom = (transform) => {
            console.log("🔍 RaceChart: Updating zoom", { k: transform.k, x: transform.x, y: transform.y });

            // Calcola i limiti di traslazione in base al livello di zoom
            const maxTranslateX = 0; // Non può andare oltre il bordo destro
            const minTranslateX = -(transform.k - 1) * width; // Non può andare oltre il bordo sinistro scalato

            // Limita la traslazione X
            const clampedX = Math.max(minTranslateX, Math.min(maxTranslateX, transform.x));

            // Crea una trasformazione corretta
            const clampedTransform = d3.zoomIdentity
                .translate(clampedX, 0)
                .scale(transform.k, 1);

            // Aggiorna solo l'asse X con la scala trasformata
            const newX = clampedTransform.rescaleX(x);

            const newDomain = newX.domain();
            const tickValues = d3.range(Math.ceil(newDomain[0]), Math.floor(newDomain[1]) + 1, 5);
            xAxis.call(d3.axisBottom(newX).tickValues(tickValues));

            // Applica solo la trasformazione X al contenuto
            const line = d3.line()
                .x(d => newX(d.lap_number))
                .y(d => {
                    const yValue = y(d.lap_duration);
                    if (this.hideOutliers) {
                        if (yValue < 0) return 0;
                        if (yValue > height) return height;
                    }
                    return yValue;
                });

            // Aggiorna le linee
            zoomGroup.selectAll("path").attr("d", line);

            // Aggiorna le posizioni dei punti
            zoomGroup.selectAll("circle")
                .attr("cx", d => newX(d.lap_number));
        };

        // Zoom logic - solo orizzontale con limiti dinamici
        const zoom = d3.zoom()
            .scaleExtent([1, 20])  // Limite minimo 1 (originale), massimo 20
            .on("zoom", (event) => {
                const transform = event.transform;

                // Crea una trasformazione che mantiene Y invariato
                const xOnlyTransform = d3.zoomIdentity
                    .translate(transform.x, 0)  // Solo traslazione X
                    .scale(transform.k, 1);     // Solo scala X

                // Aggiorna tramite ZoomManager per coordinare con altri grafici
                if (typeof ZoomManager !== 'undefined') {
                    ZoomManager.setTransform(xOnlyTransform);
                } else {
                    // Fallback se ZoomManager non è disponibile
                    updateZoom(xOnlyTransform);
                }
            });

        svg.call(zoom)
            .on("wheel.zoom", null); // Disable default wheel zoom

        // Custom wheel zoom behavior - solo orizzontale, centrato sul mouse e con limiti intelligenti
        svg.on("wheel", (event) => {
            event.preventDefault();

            // Ottieni la posizione del mouse relativa al grafico
            const [mouseX, mouseY] = d3.pointer(event, g.node());

            const currentTransform = ZoomManager ? ZoomManager.getTransform() : d3.zoomIdentity;
            const scaleFactor = 1.1;

            // Calcola il nuovo fattore di scala
            let newScale = event.deltaY < 0 ?
                currentTransform.k * scaleFactor :
                currentTransform.k / scaleFactor;

            // Applica i limiti di zoom
            newScale = Math.max(1, Math.min(20, newScale));

            // Se il nuovo scale è uguale al corrente, non fare nulla (limite raggiunto)
            if (newScale === currentTransform.k) {
                return;
            }

            // Calcola la nuova traslazione per mantenere il punto del mouse fisso
            let newTranslateX = mouseX - (mouseX - currentTransform.x) * (newScale / currentTransform.k);

            // Applica limiti di traslazione dinamici in base al livello di zoom
            const maxTranslateX = 0; // Non può andare oltre il bordo destro
            const minTranslateX = -(newScale - 1) * width; // Non può andare oltre il bordo sinistro scalato

            newTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));

            const newTransform = d3.zoomIdentity
                .translate(newTranslateX, 0)  // Traslazione limitata
                .scale(newScale, 1);          // Solo scala X

            // Apply the new transform
            svg.call(zoom.transform, newTransform);
        });

        // Integrazione con ZoomManager
        if (typeof ZoomManager !== 'undefined') {
            // Ripristina lo stato di zoom esistente
            const currentTransform = ZoomManager.getTransform();
            if (ZoomManager.isZoomed()) {
                console.log("🔄 RaceChart: Restoring zoom state", ZoomManager.getZoomInfo());
                svg.call(zoom.transform, currentTransform);
                updateZoom(currentTransform);
            }

            // Salva il riferimento al listener per la pulizia
            this.zoomListener = updateZoom;

            // Aggiungi listener per sincronizzare con altri grafici
            ZoomManager.addListener(this.zoomListener);

            console.log("✅ RaceChart: Integrated with ZoomManager");
        } else {
            console.warn("⚠️ RaceChart: ZoomManager not available, using standalone zoom");
        }
    },

    cleanup: function() {
        // Rimuovi il listener dal ZoomManager
        if (typeof ZoomManager !== 'undefined' && this.zoomListener) {
            ZoomManager.removeListener(this.zoomListener);
            console.log("🧹 RaceChart: Removed zoom listener");
        }

        // Remove existing tooltip
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        // Clean up any orphaned tooltips
        d3.selectAll(".race-chart-tooltip").remove();
    },

    destroy: function() {
        // Call this when completely destroying the chart
        this.cleanup();
        const container = d3.select("#race-chart");
        container.selectAll("*").remove();
    }
};