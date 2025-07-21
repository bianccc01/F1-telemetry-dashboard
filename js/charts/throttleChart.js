window.ThrottleChart = {
    create() {
        const container = d3.select('#throttle-chart');
        container.selectAll('*').remove(); // Clear existing chart

        if (!state.telemetryData || Object.keys(state.telemetryData).length === 0) {
            container.append('div')
                .attr('class', 'no-data')
                .text('Select a lap to view telemetry data');
            return;
        }

        const containerRect = container.node().getBoundingClientRect();
        const margin = { top: 20, right: 100, bottom: 70, left: 70 };
        const width = containerRect.width - margin.left - margin.right;
        const height = containerRect.height - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const allData = ThrottleChart.prepareData();

        if (allData.length === 0) {
            container.append('div')
                .attr('class', 'no-data')
                .text('No throttle data available for selected lap');
            return;
        }

        const scales = ThrottleChart.createScales(allData, width, height);
        ThrottleChart.createAxes(g, scales, width, height, margin);
        ThrottleChart.createLines(g, allData, scales);
        ThrottleChart.createLegend(g, allData, width);

        if (!window.chartInstances) window.chartInstances = [];

        // Pulisci le istanze precedenti per questo container
        window.chartInstances = window.chartInstances.filter(chart =>
            chart.container.attr('id') !== container.attr('id')
        );

        const zoom = d3.zoom()
            .scaleExtent([1, 10])
            .translateExtent([[0, 0], [width, height]])
            .extent([[0, 0], [width, height]])
            .on('zoom', (event) => {
                const transform = event.transform;

                if (event.sourceEvent && window.ZoomManager) {
                    window.ZoomManager.setTransform(transform);
                }
            });

        window.chartInstances.push({
            container: container,
            allData: allData,
            scales: scales,
            g: g,
            yValue: d => d.throttle,
            yLabel: '%',
            yFormat: d => d3.format('.0f')(d),
            id: 'throttle-chart',
            svg: svg,
            zoom: zoom
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
                    window.Tooltip.moveTooltips(event);
                }
            });

        if (window.Tooltip && window.chartInstances) {
            window.Tooltip.initialize(window.chartInstances);
        }
    },

    prepareData() {
        const allData = [];
        const drivers = Object.keys(state.telemetryData || {});

        drivers.forEach(driverNumber => {
            const driverData = state.telemetryData[driverNumber];
            const data = driverData?.data || [];
            const color = driverData?.color;
            const driverName = driverData?.driver?.name_acronym;

            const validData = data
                .filter(d => d.throttle != null && d.date != null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (validData.length > 0) {
                const dataWithDistance = ThrottleChart.calculateDistance(validData);

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
            .attr('class', 'x-axis')
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
            .text('Throttle (%)');

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
            .y(d => scales.yScale(d.throttle))
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
