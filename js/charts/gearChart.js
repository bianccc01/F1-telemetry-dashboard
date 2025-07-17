window.GearChart = {
    create() {
        const container = d3.select('#gear-chart');
        container.selectAll('*').remove();

        if (!state.telemetryData || Object.keys(state.telemetryData).length === 0) {
            container.append('div').attr('class', 'no-data').text('Select a lap to view telemetry data');
            return;
        }

        const containerRect = container.node().getBoundingClientRect();
        const margin = { top: 20, right: 100, bottom: 70, left: 70 };
        const width = containerRect.width - margin.left - margin.right;
        const height = containerRect.height - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

        const allData = this.prepareData();

        if (allData.length === 0) {
            container.append('div').attr('class', 'no-data').text('No gear data available for selected lap');
            return;
        }

        const scales = this.createScales(allData, width, height);
        this.createAxes(g, scales, width, height, margin);
        this.createLines(g, allData, scales);
        this.createLegend(g, allData, width);
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
                .filter(d => d.n_gear != null && d.date != null)
                .sort((a, b) => new Date(a.date) - new Date(b.date));

            if (validData.length > 0) {
                const dataWithDistance = this.calculateDistance(validData);
                allData.push({
                    driverNumber,
                    driverName,
                    color,
                    data: dataWithDistance,
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
            dataWithDistance.push({ ...point, distance: cumulativeDistance });
        }
        return dataWithDistance;
    },

    createScales(allData, width, height) {
        const allPoints = allData.flatMap(d => d.data);
        const xExtent = d3.extent(allPoints, d => d.distance);
        const yExtent = d3.extent(allPoints, d => d.n_gear);

        const xScale = d3.scaleLinear().domain(xExtent).range([0, width]);
        const yScale = d3.scaleLinear().domain([0, 8]).range([height, 0]);

        return { xScale, yScale };
    },

    createAxes(g, scales, width, height, margin) {
        const xAxis = d3.axisBottom(scales.xScale).tickFormat(d => d3.format('.0f')(d) + ' m');
        g.append('g').attr('transform', `translate(0,${height})`).call(xAxis);
        g.append('g').call(d3.axisLeft(scales.yScale).ticks(8));

        g.append('text').attr('transform', 'rotate(-90)').attr('y', 0 - margin.left).attr('x', 0 - (height / 2)).attr('dy', '1em').style('text-anchor', 'middle').style('fill', '#fff').text('Gear');
        g.append('text').attr('x', width / 2).attr('y', height + margin.bottom - 15).style('text-anchor', 'middle').style('fill', '#fff').text('Distance (m)');
    },

    createLines(g, allData, scales) {
        const line = d3.line()
            .x(d => scales.xScale(d.distance))
            .y(d => scales.yScale(d.n_gear));

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
        const legend = g.append('g').attr('class', 'legend').attr('transform', `translate(${width - 80}, 20)`);
        allData.forEach((driverData, i) => {
            const legendRow = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
            legendRow.append('rect').attr('width', 10).attr('height', 10).attr('fill', driverData.color);
            legendRow.append('text').attr('x', 15).attr('y', 10).style('font-size', '12px').style('fill', '#fff').text(driverData.driverName);
        });
    },

    createTooltip() {
        // Tooltip non gestito direttamente qui, ma da un gestore eventi globale
    }
};
