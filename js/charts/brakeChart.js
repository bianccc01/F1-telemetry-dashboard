window.BrakeChart = {
    create() {
        const container = d3.select('#brake-chart');
        container.selectAll('*').remove(); // Clear existing chart

        if (!state.telemetryData || Object.keys(state.telemetryData).length === 0) {
            container.append('div')
                .attr('class', 'no-data')
                .text('Select a lap to view telemetry data');
            return;
        }

        // Dimensioni e margini
        const containerRect = container.node().getBoundingClientRect();
        const margin = { top: 20, right: 100, bottom: 70, left: 70 };
        const width = containerRect.width - margin.left - margin.right;
        const height = containerRect.height - margin.top - margin.bottom;

        // Crea SVG
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Prepara i dati
        const allData = this.prepareData();

        if (allData.length === 0) {
            container.append('div')
                .attr('class', 'no-data')
                .text('No brake data available for selected lap');
            return;
        }

        // Scale
        const scales = this.createScales(allData, width, height);

        // Assi
        this.createAxes(g, scales, width, height, margin);

        // Linee
        this.createLines(g, allData, scales);

        // Legenda
        this.createLegend(g, allData, width);

        // Tooltip
        this.createTooltip(g, allData, scales, width, height);
    },

    prepareData() {
        const allData = [];
        const drivers = Object.keys(state.telemetryData);

        drivers.forEach(driverNumber => {
            const driverData = state.telemetryData[driverNumber];
            const data = driverData.data;
            const color = driverData.color;
            const driverName = driverData.driver.name_acronym;

            const validData = data
                .filter(d => d.brake != null && d.date != null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (validData.length > 0) {
                const dataWithDistance = this.calculateDistance(validData);

                allData.push({
                    driverNumber,
                    driverName,
                    color,
                    data: dataWithDistance,
                    sectorTimes: driverData.sectorTimes,
                });
            }
        });

        return allData;
    },

    calculateDistance(telemetryData) {
        const dataWithDistance = [];
        let cumulativeDistance = 0;

        for (let i = 0; i < telemetryData.length; i++) {
            const point = telemetryData[i];

            if (i > 0) {
                const prevPoint = telemetryData[i - 1];
                const timeDiff = (new Date(point.date) - new Date(prevPoint.date)) / 1000;
                const avgSpeed = (point.speed + prevPoint.speed) / 2;
                const speedMs = avgSpeed * 1000 / 3600;
                const distanceIncrement = speedMs * timeDiff;

                cumulativeDistance += distanceIncrement;
            }

            dataWithDistance.push({
                ...point,
                distance: cumulativeDistance
            });
        }
        return dataWithDistance;
    },

    createScales(allData, width, height) {
        const allPoints = allData.flatMap(d => d.data);
        const xExtent = d3.extent(allPoints, d => d.distance);

        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);

        return { xScale, yScale };
    },

    createAxes(g, scales, width, height, margin) {
        const xAxis = d3.axisBottom(scales.xScale)
            .tickFormat(d => d3.format('.0f')(d) + ' m');

        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .call(d3.axisLeft(scales.yScale).ticks(5));

        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('fill', '#fff')
            .text('Brake (%)');

        g.append('text')
            .attr('x', width / 2)
            .attr('y', height + margin.bottom - 15)
            .style('text-anchor', 'middle')
            .style('fill', '#fff')
            .style('font-size', '12px')
            .style('font-family', 'inherit')
            .text('Distance (m)');
    },

    createLines(g, allData, scales) {
        const line = d3.line()
            .x(d => scales.xScale(d.distance))
            .y(d => scales.yScale(d.brake))
            .curve(d3.curveMonotoneX);

        allData.forEach(driverData => {
            g.append('path')
                .datum(driverData.data)
                .attr('fill', 'none')
                .attr('stroke', driverData.color)
                .attr('stroke-width', 2)
                .attr('d', line);
        });
    },

    createLegend(g, allData, width) {
        const legend = g.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 20}, 20)`);

        allData.forEach((driverData, i) => {
            const legendRow = legend.append('g')
                .attr('transform', `translate(0, ${i * 20})`);

            legendRow.append('circle')
                .attr('r', 5)
                .attr('fill', driverData.color);

            legendRow.append('text')
                .attr('x', 15)
                .attr('y', 0)
                .attr('dy', '0.35em')
                .style('font-size', '12px')
                .style('fill', '#fff')
                .text(driverData.driverName);
        });
    },

    createTooltip(g, allData, scales, width, height) {
        const tooltip = d3.select('#brake-chart').append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);

        const tooltipLine = g.append('line')
            .attr('class', 'tooltip-line')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);

        const tooltipCircles = g.selectAll('.tooltip-circle')
            .data(allData)
            .enter().append('circle')
            .attr('class', 'tooltip-circle')
            .attr('r', 5)
            .attr('fill', d => d.color)
            .style('opacity', 0);

        const bisectDistance = d3.bisector(d => d.distance).left;

        const overlay = g.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mouseover', () => {
                tooltip.style('opacity', 1);
                tooltipLine.style('opacity', 1);
                tooltipCircles.style('opacity', 1);
            })
            .on('mouseout', () => {
                tooltip.style('opacity', 0);
                tooltipLine.style('opacity', 0);
                tooltipCircles.style('opacity', 0);
            })
            .on('mousemove', (event) => {
                const [x, y] = d3.pointer(event, g.node());
                const x0 = scales.xScale.invert(x);

                let tooltipData = [];

                allData.forEach(driver => {
                    const i = bisectDistance(driver.data, x0, 1);
                    const d0 = driver.data[i - 1];
                    const d1 = driver.data[i];
                    if (!d0 || !d1) return;
                    const d = x0 - d0.distance > d1.distance - x0 ? d1 : d0;

                    tooltipData.push({
                        driverName: driver.driverName,
                        brake: d.brake,
                        color: driver.color,
                        x: scales.xScale(d.distance),
                        y: scales.yScale(d.brake)
                    });
                });

                if(tooltipData.length > 0){
                    tooltipLine
                        .attr('x1', tooltipData[0].x)
                        .attr('x2', tooltipData[0].x)
                        .attr('y1', 0)
                        .attr('y2', height);

                    tooltipCircles
                        .data(tooltipData)
                        .attr('cx', d => d.x)
                        .attr('cy', d => d.y);

                    tooltip
                        .html(tooltipData.map(d => `
                            <div style="color: ${d.color}">
                                ${d.driverName}: ${d.brake.toFixed(0)}%
                            </div>
                        `).join(''))
                        .style('left', (event.pageX + 15) + 'px')
                        .style('top', (event.pageY - 28) + 'px');

                    if (tooltipData[0]) {
                        const i = bisectDistance(allData[0].data, scales.xScale.invert(tooltipData[0].x), 1);
                        const d0 = allData[0].data[i - 1];
                        const d1 = allData[0].data[i];
                        if (d0 && d1) {
                            const d = scales.xScale.invert(tooltipData[0].x) - d0.distance > d1.distance - scales.xScale.invert(tooltipData[0].x) ? d1 : d0;
                            TrackMap.updateCarPosition(d);
                        }
                    }
                }
            });
    }
};
