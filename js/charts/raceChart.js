const RaceChart = {
    create: function(data) {
        const container = d3.select("#race-chart");
        container.selectAll("*").remove(); // Clear previous chart

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

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        const tyreImages = {
            'SOFT': 'https://upload.wikimedia.org/wikipedia/commons/d/df/F1_tire_Pirelli_PZero_Red.svg',
            'MEDIUM': 'https://upload.wikimedia.org/wikipedia/commons/4/4d/F1_tire_Pirelli_PZero_Yellow.svg',
            'HARD': 'https://upload.wikimedia.org/wikipedia/commons/d/d6/F1_tire_Pirelli_PZero_White.svg',
            'INTERMEDIATE': 'https://upload.wikimedia.org/wikipedia/commons/8/86/F1_tire_Pirelli_Cinturato_Green.svg',
            'WET': 'https://upload.wikimedia.org/wikipedia/commons/6/63/F1_tire_Pirelli_Cinturato_Blue.svg'
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
                .style("fill", driverData.color)
                .on("mouseover", (event, d) => {
                    tooltip.transition()
                        .duration(200)
                        .style("opacity", .9);
                    tooltip.html(`
                        <strong>${driverData.driver.name_acronym}</strong><br/>
                        Lap: ${d.lap_number}<br/>
                        Time: ${Math.floor(d.lap_duration / 60)}:${(d.lap_duration % 60).toFixed(3).padStart(6, '0')}<br/>
                        <img src="${tyreImages[d.compound]}" alt="${d.compound}" class="tyre-image-tooltip"/>
                    `)
                        .style("left", (event.pageX + 5) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", () => {
                    tooltip.transition()
                        .duration(500)
                        .style("opacity", 0);
                })
                .on("click", (event, d) => {
                    const driverNumber = driverData.driver.driver_number;
                    const lapNumber = d.lap_number;

                    // Update the lap selector
                    const lapSelector = document.getElementById(`lap-select-${driverNumber}`);
                    if (lapSelector) {
                        lapSelector.value = lapNumber;
                    }

                    // Update the state
                    state.selectedLaps[driverNumber] = lapNumber;

                    // Trigger data loading
                    loadAllData();
                });
        }
    }
};
