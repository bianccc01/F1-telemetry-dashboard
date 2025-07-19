const RaceChart = {
    tooltip: null, // Store tooltip reference

    create: function(data) {
        const container = d3.select("#race-chart");
        container.selectAll("*").remove(); // Clear previous chart

        // Clean up existing tooltip if it exists
        this.cleanup();

        if (Object.keys(data).length === 0) {
            container.html("<p>No data for race chart.</p>");
            return;
        }

        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const width = container.node().getBoundingClientRect().width - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const svg = container.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        let allLaps = [];
        for (const driver in data) {
            const validLaps = data[driver].laps.filter(d => d.lap_duration !== null && !isNaN(d.lap_duration));
            data[driver].laps = validLaps;
            allLaps = allLaps.concat(validLaps);
        }

        const x = d3.scaleLinear()
            .domain(d3.extent(allLaps, d => d.lap_number))
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([d3.min(allLaps, d => d.lap_duration) - 10, d3.max(allLaps, d => d.lap_duration) + 10])
            .range([height, 0]);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(d3.max(allLaps, d => d.lap_number)));

        svg.append("g")
            .call(d3.axisLeft(y).tickFormat(d => {
                const minutes = Math.floor(d / 60);
                const seconds = (d % 60).toFixed(0);
                return `${minutes}:${seconds.padStart(2, '0')}`;
            }));

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

        const line = d3.line()
            .x(d => x(d.lap_number))
            .y(d => y(d.lap_duration));

        for (const driverId in data) {
            const driverData = data[driverId];

            // Draw the line
            svg.append("path")
                .datum(driverData.laps)
                .attr("fill", "none")
                .attr("stroke", driverData.color)
                .attr("stroke-width", 1.5)
                .attr("d", line);

            // Draw the dots
            svg.selectAll(`.dot-${driverId}`)
                .data(driverData.laps)
                .enter().append("circle")
                .attr("class", `dot dot-${driverId}`)
                .attr("cx", d => x(d.lap_number))
                .attr("cy", d => y(d.lap_duration))
                .attr("r", 5)
                .style("fill", d => tyreColors[d.compound] || driverData.color)
                .style("stroke", driverData.color)
                .style("cursor", "pointer")
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
                    event.stopPropagation(); // Prevent event bubbling

                    const driverNumber = driverData.driver.driver_number;
                    const lapNumber = d.lap_number;

                    console.log("Race chart click:", { driverNumber, lapNumber }); // Debug log

                    // Check if required functions exist
                    if (typeof handleLapChange === 'function' && typeof updateLoadButtonState === 'function') {
                        // Update the lap selector
                        const lapSelector = document.getElementById(`lap-select-${driverNumber}`);
                        if (lapSelector) {
                            lapSelector.value = lapNumber;
                        }

                        // Update the state, ensuring other drivers' selections are cleared
                        if (typeof state !== 'undefined' && state.selectedLaps) {
                            state.selectedLaps[driverNumber] = lapNumber;

                            // Manually trigger the lap change handler to update UI and state
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
    },

    cleanup: function() {
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