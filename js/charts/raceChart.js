const RaceChart = {
    tooltip: null,
    hideOutliers: false,
    zoomListener: null,

    create: function(data) {
        console.log("🚀 RaceChart: Starting create() function");

        // Clean up FIRST, before touching any DOM elements
        this.cleanup();

        const container = d3.select("#race-chart");
        container.selectAll("*").remove();

        if (Object.keys(data).length === 0) {
            container.html("<p>No data for race chart.</p>");
            return;
        }

        // Force cleanup of any existing race chart tooltips in the entire document
        d3.selectAll(".race-chart-tooltip").remove();
        d3.selectAll(".tooltip").filter(function() {
            return d3.select(this).classed("race-chart-tooltip");
        }).remove();

        // Create tooltip with UNIQUE class and HIGHER z-index to avoid conflicts
        console.log("🎯 RaceChart: Creating tooltip");
        this.tooltip = d3.select("body").append("div")
            .attr("class", "race-chart-tooltip-unique") // UNIQUE class to avoid conflicts
            .style("position", "absolute")
            .style("background", "rgba(0, 0, 0, 0.9)")
            .style("color", "white")
            .style("padding", "12px")
            .style("border-radius", "6px")
            .style("border", "1px solid #fff")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .style("z-index", "9999") // VERY HIGH z-index
            .style("display", "block") // Force display
            .style("visibility", "visible"); // Force visibility

        console.log("✅ RaceChart: Tooltip created:", this.tooltip.node());

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
                this.create(data);
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
            const sortedLaps = allLaps.map(d => d.lap_duration).sort((a, b) => a - b);
            const median = sortedLaps.length % 2 === 0
                ? (sortedLaps[sortedLaps.length / 2 - 1] + sortedLaps[sortedLaps.length / 2]) / 2
                : sortedLaps[Math.floor(sortedLaps.length / 2)];

            outlierThreshold = median * 1.1;
            outlierCount = allLaps.filter(d => d.lap_duration > outlierThreshold).length;

            if (outlierCount > 0) {
                const filteredLaps = allLaps.filter(d => d.lap_duration <= outlierThreshold);
                if (filteredLaps.length > 0) {
                    const range = d3.max(filteredLaps, d => d.lap_duration) - d3.min(filteredLaps, d => d.lap_duration);
                    const margin = range * 0.05;
                    yDomainMin = d3.min(filteredLaps, d => d.lap_duration) - margin;
                    yDomainMax = d3.max(filteredLaps, d => d.lap_duration) + margin;
                } else {
                    yDomainMin = d3.min(allLaps, d => d.lap_duration) - 10;
                    yDomainMax = d3.max(allLaps, d => d.lap_duration) + 10;
                }
            } else {
                yDomainMin = d3.min(allLaps, d => d.lap_duration) - 10;
                yDomainMax = d3.max(allLaps, d => d.lap_duration) + 10;
            }

            if (outlierCount > 0) {
                controlsContainer.append("span")
                    .style("color", "#666")
                    .style("font-size", "14px")
                    .text(`(${outlierCount} outliers hidden)`);
            }
        } else {
            yDomainMin = d3.min(allLaps, d => d.lap_duration) - 10;
            yDomainMax = d3.max(allLaps, d => d.lap_duration) + 10;
        }

        const x = d3.scaleLinear()
            .domain([
                d3.min(allLaps, d => d.lap_number) - 0.5,
                d3.max(allLaps, d => d.lap_number) + 0.5
            ])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([yDomainMin, yDomainMax])
            .range([height, 0]);

        // Create axis group
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

        // Create zoom group for content
        const zoomGroup = g.append("g").attr("class", "zoom-group");

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

        const line = d3.line()
            .x(d => x(d.lap_number))
            .y(d => {
                const yValue = y(d.lap_duration);
                if (this.hideOutliers) {
                    if (yValue < 0) return 0;
                    if (yValue > height) return height;
                }
                return yValue;
            });

        const lines = zoomGroup.append("g").attr("class", "lines-group");
        const dots = zoomGroup.append("g").attr("class", "dots-group");

        // Create lines and dots with proper event handling
        for (const driverId in data) {
            const driverData = data[driverId];

            // Draw the line FIRST (so it's behind the dots)
            lines.append("path")
                .datum(driverData.laps)
                .attr("class", `line-${driverId}`)
                .attr("fill", "none")
                .attr("stroke", driverData.color)
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Draw the dots AFTER lines (so they're on top and clickable)
            const dotsSelection = dots.selectAll(`.dot-${driverId}`)
                .data(driverData.laps)
                .enter().append("circle")
                .attr("class", `dot dot-${driverId}`)
                .attr("cx", d => x(d.lap_number))
                .attr("cy", d => y(d.lap_duration))
                .attr("r", 5)
                .style("fill", d => tyreColors[d.compound] || driverData.color)
                .style("stroke", driverData.color)
                .style("stroke-width", 2)
                .style("cursor", "pointer")
                .style("display", d => {
                    if (this.hideOutliers && outlierThreshold && d.lap_duration > outlierThreshold) {
                        return "none";
                    }
                    return "block";
                });

            console.log(`🎯 RaceChart: Adding event handlers to ${dotsSelection.size()} dots for driver ${driverId}`);

            dotsSelection
                .on("mouseover", (event, d) => {
                    console.log("🖱️ RaceChart: Mouseover on dot:", {
                        driver: driverData.driver.name_acronym,
                        lap: d.lap_number,
                        tooltipExists: !!this.tooltip,
                        tooltipNode: this.tooltip?.node(),
                        mousePos: { x: event.pageX, y: event.pageY }
                    });

                    // DISABLE any other tooltip systems temporarily
                    if (typeof window.Tooltip !== 'undefined' && window.Tooltip.hideTooltips) {
                        window.Tooltip.hideTooltips();
                    }

                    if (this.tooltip && this.tooltip.node()) {
                        // Set content first
                        this.tooltip.html(`
                            <strong>${driverData.driver.name_acronym}</strong><br/>
                            Lap: ${d.lap_number}<br/>
                            Time: ${Math.floor(d.lap_duration / 60)}:${(d.lap_duration % 60).toFixed(3).padStart(6, '0')}<br/>
                            <img src="${tyreImages[d.compound]}" alt="${d.compound}" style="width: 20px; height: 20px; vertical-align: middle; margin-top: 5px;"/>
                        `);

                        // Position the tooltip
                        const tooltipX = event.pageX + 15;
                        const tooltipY = event.pageY - 10;

                        console.log("🎯 RaceChart: Positioning tooltip at:", { tooltipX, tooltipY });

                        this.tooltip
                            .style("left", tooltipX + "px")
                            .style("top", tooltipY + "px")
                            .style("opacity", 0) // Start invisible
                            .style("display", "block")
                            .transition()
                            .duration(200)
                            .style("opacity", 1); // Fade in

                        // Log final styles for debugging
                        const node = this.tooltip.node();
                        const computedStyle = window.getComputedStyle(node);
                        console.log("🎯 RaceChart: Tooltip computed styles:", {
                            position: computedStyle.position,
                            left: computedStyle.left,
                            top: computedStyle.top,
                            zIndex: computedStyle.zIndex,
                            opacity: computedStyle.opacity,
                            display: computedStyle.display,
                            visibility: computedStyle.visibility
                        });
                    } else {
                        console.error("❌ RaceChart: Tooltip not available on mouseover!");
                    }
                })
                .on("mouseout", (event, d) => {
                    console.log("🖱️ RaceChart: Mouseout on dot:", {
                        driver: driverData.driver.name_acronym,
                        lap: d.lap_number
                    });

                    if (this.tooltip && this.tooltip.node()) {
                        this.tooltip.transition()
                            .duration(200)
                            .style("opacity", 0)
                            .on("end", () => {
                                // Hide completely after transition
                                this.tooltip.style("display", "none");
                            });
                    } else {
                        console.error("❌ RaceChart: Tooltip not available on mouseout!");
                    }
                })
                .on("click", (event, d) => {
                    console.log("Click on dot:", d); // Debug log
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

        // Update zoom function
        const updateZoom = (transform) => {
            console.log("🔍 RaceChart: Updating zoom", { k: transform.k, x: transform.x, y: transform.y });

            const maxTranslateX = 0;
            const minTranslateX = -(transform.k - 1) * width;
            const clampedX = Math.max(minTranslateX, Math.min(maxTranslateX, transform.x));

            const clampedTransform = d3.zoomIdentity
                .translate(clampedX, 0)
                .scale(transform.k, 1);

            const newX = clampedTransform.rescaleX(x);
            const newDomain = newX.domain();
            const tickValues = d3.range(Math.ceil(newDomain[0]), Math.floor(newDomain[1]) + 1, 5);
            xAxis.call(d3.axisBottom(newX).tickValues(tickValues));

            const zoomedLine = d3.line()
                .x(d => newX(d.lap_number))
                .y(d => {
                    const yValue = y(d.lap_duration);
                    if (this.hideOutliers) {
                        if (yValue < 0) return 0;
                        if (yValue > height) return height;
                    }
                    return yValue;
                });

            zoomGroup.selectAll("path").attr("d", zoomedLine);
            zoomGroup.selectAll("circle").attr("cx", d => newX(d.lap_number));
        };

        // Zoom setup
        const zoom = d3.zoom()
            .scaleExtent([1, 20])
            .on("zoom", (event) => {
                const transform = event.transform;
                const xOnlyTransform = d3.zoomIdentity
                    .translate(transform.x, 0)
                    .scale(transform.k, 1);

                if (typeof ZoomManager !== 'undefined') {
                    ZoomManager.setTransform(xOnlyTransform);
                } else {
                    updateZoom(xOnlyTransform);
                }
            });

        svg.call(zoom).on("wheel.zoom", null);

        // Custom wheel zoom
        svg.on("wheel", (event) => {
            event.preventDefault();
            const [mouseX, mouseY] = d3.pointer(event, g.node());
            const currentTransform = ZoomManager ? ZoomManager.getTransform() : d3.zoomIdentity;
            const scaleFactor = 1.1;

            let newScale = event.deltaY < 0 ?
                currentTransform.k * scaleFactor :
                currentTransform.k / scaleFactor;

            newScale = Math.max(1, Math.min(20, newScale));

            if (newScale === currentTransform.k) {
                return;
            }

            let newTranslateX = mouseX - (mouseX - currentTransform.x) * (newScale / currentTransform.k);
            const maxTranslateX = 0;
            const minTranslateX = -(newScale - 1) * width;
            newTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));

            const newTransform = d3.zoomIdentity
                .translate(newTranslateX, 0)
                .scale(newScale, 1);

            svg.call(zoom.transform, newTransform);
        });

        // ZoomManager integration
        if (typeof ZoomManager !== 'undefined') {
            const currentTransform = ZoomManager.getTransform();
            if (ZoomManager.isZoomed()) {
                console.log("🔄 RaceChart: Restoring zoom state", ZoomManager.getZoomInfo());
                svg.call(zoom.transform, currentTransform);
                updateZoom(currentTransform);
            }

            this.zoomListener = updateZoom;
            ZoomManager.addListener(this.zoomListener);
            console.log("✅ RaceChart: Integrated with ZoomManager");
        } else {
            console.warn("⚠️ RaceChart: ZoomManager not available, using standalone zoom");
        }

        // Debug: Log tooltip creation
        console.log("✅ RaceChart: Tooltip created and events attached");
    },

    cleanup: function() {
        // Remove zoom listener
        if (typeof ZoomManager !== 'undefined' && this.zoomListener) {
            ZoomManager.removeListener(this.zoomListener);
            this.zoomListener = null;
            console.log("🧹 RaceChart: Removed zoom listener");
        }

        // Remove tooltip
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        // Clean up orphaned tooltips with both class names
        d3.selectAll(".race-chart-tooltip").remove();
        d3.selectAll(".race-chart-tooltip-unique").remove();
        console.log("🧹 RaceChart: Cleaned up tooltips");
    },

    destroy: function() {
        this.cleanup();
        const container = d3.select("#race-chart");
        container.selectAll("*").remove();
        console.log("🗑️ RaceChart: Chart destroyed");
    }
};