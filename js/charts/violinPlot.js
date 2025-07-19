window.ViolinPlot = {
    create() {
        const container = d3.select('#violin-plot-chart');
        container.selectAll('*').remove(); // Clear existing chart

        // Check conditions for displaying the chart
        if (state.selectedGP && !state.selectedLap) {
            // Fetch and process data
            this.prepareData().then(allData => {
                if (allData.length === 0) {
                    container.append('div').attr('class', 'no-data').text('No lap time data available for the selected drivers.');
                    return;
                }

                // Dimensions and margins
                const containerRect = container.node().getBoundingClientRect();
                const margin = { top: 50, right: 50, bottom: 60, left: 60 };
                const width = containerRect.width - margin.left - margin.right;
                const height = 400 - margin.top - margin.bottom; // Fixed height for the plot

                // Create SVG
                const svg = container.append('svg')
                    .attr('width', width + margin.left + margin.right)
                    .attr('height', height + margin.top + margin.bottom);

                const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

                // Create scales
                const scales = this.createScales(allData, width, height);

                // Create axes
                this.createAxes(g, scales, height);

                // Create violin plots
                this.createViolins(g, allData, scales, height);

            });
        }
    },

    async prepareData() {
        const allData = [];
        const drivers = state.selectedDrivers.filter(d => d);

        for (const driver of drivers) {
            const laps = await API.getLaps(state.selectedSession.session_key, driver.driver_number);
            const lapTimes = laps.map(l => l.lap_duration).filter(lt => lt != null);
            if (lapTimes.length > 0) {
                allData.push({
                    driverName: driver.name_acronym,
                    color: driver.color,
                    lapTimes: lapTimes
                });
            }
        }
        return allData;
    },

    createScales(allData, width, height) {
        const allLapTimes = allData.flatMap(d => d.lapTimes);

        const xScale = d3.scaleBand()
            .range([0, width])
            .domain(allData.map(d => d.driverName))
            .padding(0.05);

        const yScale = d3.scaleLinear()
            .domain([60, d3.max(allLapTimes) + 10]) // Start y-axis from 0
            .range([height, 0]);

        return { xScale, yScale };
    },

    createAxes(g, scales, height) {
        g.append("g")
            .attr("transform", "translate(0," + height + ")")
            .call(d3.axisBottom(scales.xScale));

        const yAxis = d3.axisLeft(scales.yScale)
            .tickFormat(d => {
                const minutes = Math.floor(d / 60);
                const seconds = d % 60;
                return `${minutes}:${seconds.toString().padStart(2, '0')}`;
            });

        g.append("g").call(yAxis);

        // Y-axis label
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -50)
            .attr('x', -height / 2)
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('fill', '#fff')
            .text('Lap Time');
    },

    createViolins(g, allData, scales, height) {
        const { xScale, yScale } = scales;
        const numDrivers = allData.length;

        // Adjust bandwidth based on the number of drivers
        const bandwidth = numDrivers === 1 ? xScale.bandwidth() / 2 : xScale.bandwidth();

        // Binning data for histogram
        const histogram = d3.histogram()
            .domain(yScale.domain())
            .thresholds(yScale.ticks(20))
            .value(d => d);

        const tooltip = d3.select("body").append("div")
            .attr("class", "tooltip violin-tooltip")
            .style("opacity", 0);

        allData.forEach(driverData => {
            const gViolin = g.append("g")
                .attr("transform", () => {
                    const x = numDrivers === 1 ? xScale(driverData.driverName) + bandwidth / 2 : xScale(driverData.driverName);
                    return `translate(${x}, 0)`;
                })
                .on("mouseover", function(event) {
                    tooltip.transition().duration(200).style("opacity", .9);
                    tooltip.html(`<strong>${driverData.driverName}</strong><br/>
                                Median: ${d3.quantile(driverData.lapTimes.sort(d3.ascending), 0.5).toFixed(3)}s<br/>
                                IQR: ${(d3.quantile(driverData.lapTimes, 0.75) - d3.quantile(driverData.lapTimes, 0.25)).toFixed(3)}s`)
                        .style("left", (event.pageX) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", function() {
                    tooltip.transition().duration(500).style("opacity", 0);
                });

            const bins = histogram(driverData.lapTimes);
            const maxNum = d3.max(bins, d => d.length);
            const xNum = d3.scaleLinear()
                .range([0, bandwidth])
                .domain([-maxNum, maxNum]);

            const area = d3.area()
                .x0(d => xNum(-d.length))
                .x1(d => xNum(d.length))
                .y(d => yScale(d.x0))
                .curve(d3.curveCatmullRom);

            gViolin.append("path")
                .datum(bins)
                .style("stroke", "#000")
                .style("stroke-width", "0.5px")
                .style("fill", driverData.color)
                .attr("d", area);

            // Add median and quartiles
            const sortedLapTimes = driverData.lapTimes.sort(d3.ascending);
            const q1 = d3.quantile(sortedLapTimes, 0.25);
            const median = d3.quantile(sortedLapTimes, 0.5);
            const q3 = d3.quantile(sortedLapTimes, 0.75);

            const interQuantileRange = gViolin.append("g");

            interQuantileRange.append("line")
                .attr("x1", bandwidth / 2 - 5)
                .attr("x2", bandwidth / 2 + 5)
                .attr("y1", yScale(q1))
                .attr("y2", yScale(q1))
                .attr("stroke", "black")
                .attr("stroke-width", 2);
            
            interQuantileRange.append("line")
                .attr("x1", bandwidth / 2 - 5)
                .attr("x2", bandwidth / 2 + 5)
                .attr("y1", yScale(q3))
                .attr("y2", yScale(q3))
                .attr("stroke", "black")
                .attr("stroke-width", 2);

            interQuantileRange.append("line")
                .attr("x1", bandwidth / 2)
                .attr("x2", bandwidth / 2)
                .attr("y1", yScale(q1))
                .attr("y2", yScale(q3))
                .attr("stroke", "black")
                .attr("stroke-width", 2);

            interQuantileRange.append("circle")
                .attr("cx", bandwidth / 2)
                .attr("cy", yScale(median))
                .attr("r", 5)
                .attr("fill", "white")
                .attr("stroke", "black")
                .attr("stroke-width", 1);
        });
    }
};
