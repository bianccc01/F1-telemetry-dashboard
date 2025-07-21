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
        container.selectAll('*').remove(); 

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

        if (!window.chartInstances) window.chartInstances = [];

        // Pulisci le istanze precedenti per questo container
        window.chartInstances = window.chartInstances.filter(chart =>
            chart.container.attr('id') !== container.attr('id')
        );

        // Aggiungi la nuova istanza
        window.chartInstances.push({
            container: container,
            allData: allData,
            scales: scales,
            g: g,
            yValue: d => d.speed,
            yLabel: 'km/h',
            yFormat: d => d3.format('.1f')(d)
        });

        // Zoom
        const zoom = d3.zoom()
            .scaleExtent([1, 10])
            .translateExtent([[0, 0], [width, height]])
            .extent([[0, 0], [width, height]])
            .on('zoom', (event) => {
                const transform = event.transform;

                if (window.ZoomManager) {
                    window.ZoomManager.setTransform(transform);
                }

                const newXScale = transform.rescaleX(scales.xScale);

                g.select('.x-axis').call(d3.axisBottom(newXScale).tickFormat(d => d3.format('.0f')(d) + ' m'));

                const lineGenerator = d3.line()
                    .x(d => newXScale(d.distance))
                    .y(d => scales.yScale(d.speed))
                    .curve(d3.curveMonotoneX);

                g.selectAll('.line').attr('d', lineGenerator);
            });

        svg.call(zoom);

        g.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mouseover', () => {
                if (window.Tooltip && window.Tooltip.showTooltips) {
                    window.Tooltip.showTooltips();
                }
            })
            .on('mouseout', () => {
                if (window.Tooltip && window.Tooltip.hideTooltips) {
                    window.Tooltip.hideTooltips();
                }
            })
            .on('mousemove', (event) => {
                if (window.Tooltip && window.Tooltip.moveTooltips) {
                    // Non passare più il transform, verrà preso automaticamente dal ZoomManager
                    window.Tooltip.moveTooltips(event);
                }
            });

        if (window.Tooltip && window.chartInstances) {
            window.Tooltip.initialize(window.chartInstances);
        }
    },

    prepareData() {
        const allData = [];
        const drivers = Object.keys(state.telemetryData || {}); // Ensure telemetryData is an object

        drivers.forEach(driverNumber => {
            const driverData = state.telemetryData[driverNumber];
            const data = driverData?.data || [];
            const color = driverData?.color;
            const driverName = driverData?.driver?.name_acronym;

            // Filter and sort data by time
            const validData = data
                .filter(d => d.speed != null && d.date != null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (validData.length > 0) {
                const dataWithDistance = SpeedChart.calculateDistance(validData);

                allData.push({
                    driverNumber,
                    driverName,
                    color,
                    data: dataWithDistance,
                    sectorTimes: driverData?.sectorTimes,
                });
            }
        });

        return allData;
    },

    calculateDistance: function(telemetryData) {
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
            .attr('class', 'x-axis')
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
                .attr('class', 'line')
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
};