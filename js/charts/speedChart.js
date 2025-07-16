window.SpeedChart = {

    parseLapTime(lapTimeStr) {
        if (typeof lapTimeStr !== 'string') return new Date(NaN);
        const [minSec, ms] = lapTimeStr.split('.');
        if (!minSec) return new Date(NaN);
        const [minutes, seconds] = minSec.split(':').map(Number);
        return new Date(0, 0, 0, 0, minutes, seconds, Number(ms || 0));
    },


    create() {
        const container = d3.select('#speed-chart');
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
                .text('No speed data available for selected lap');
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

            // Filtra e ordina i dati per tempo
            const validData = data
                .filter(d => d.speed != null && d.date != null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (validData.length > 0) {
                // 🏁 Calcola la distanza cumulativa dal punto di partenza
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
                const timeDiff = (new Date(point.date) - new Date(prevPoint.date)) / 1000; // secondi
                const avgSpeed = (point.speed + prevPoint.speed) / 2; // km/h media
                const speedMs = avgSpeed * 1000 / 3600; // converti in m/s
                const distanceIncrement = speedMs * timeDiff; // metri

                cumulativeDistance += distanceIncrement;
            }

            dataWithDistance.push({
                ...point,
                distance: cumulativeDistance
            });
        }

        console.log(`📏 Driver telemetry: ${dataWithDistance.length} points, total distance: ${(cumulativeDistance / 1000).toFixed(2)} km`);

        return dataWithDistance;
    },


    createScales(allData, width, height) {
        const allPoints = allData.flatMap(d => d.data);
        const xExtent = d3.extent(allPoints, d => d.distance); // 📏 Usa distanza invece di tempo
        const yExtent = d3.extent(allPoints, d => d.speed);

        const yRange = yExtent[1] - yExtent[0];
        const yPadding = yRange * 0.1; // 10% di padding
        const yDomainZoomed = [
            yExtent[0] - yPadding,
            yExtent[1] + yPadding
        ];

        const xScale = d3.scaleLinear()
            .domain(xExtent)
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain(yDomainZoomed) // 🔍 Usa il dominio zoomato
            .range([height, 0]);

        return { xScale, yScale };
    },

    createAxes(g, scales, width, height, margin) {
        const xAxis = d3.axisBottom(scales.xScale)
            .tickFormat(d => d3.format('.0f')(d) + ' m') // Formattazione distanza

        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(xAxis);

        g.append('g')
            .call(d3.axisLeft(scales.yScale));

        // Etichette assi aggiornate
        g.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - margin.left)
            .attr('x', 0 - (height / 2))
            .attr('dy', '1em')
            .style('text-anchor', 'middle')
            .style('fill', '#fff')
            .text('Speed (km/h)');

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
            .y(d => scales.yScale(d.speed))
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
            .attr('transform', `translate(${width - 80}, 20)`);

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
        const tooltip = d3.select('#speed-chart').append('div')
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

                    const lapTime = new Date(d.date) - new Date(driver.data[0].date);
                    let sector = 1;
                    if (lapTime > driver.sectorTimes.sector1) sector = 2;
                    if (lapTime > driver.sectorTimes.sector2) sector = 3;

                    tooltipData.push({
                        driverName: driver.driverName,
                        speed: d.speed,
                        color: driver.color,
                        x: scales.xScale(d.distance),
                        y: scales.yScale(d.speed),
                        sector: sector,
                    });

                    // Update track map for the first driver in the tooltip
                    if (tooltipData.length === 1) {
                        TrackMap.updateCarPosition({...d, sector});
                    }
                });

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
                            ${d.driverName}: ${d.speed.toFixed(0)} km/h
                        </div>
                    `).join(''))
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            });
    }
};