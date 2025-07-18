window.Tooltip = {
    initialize(charts) {
        this.charts = charts;
        this.bisectDistance = d3.bisector(d => d.distance).left;

        const chartContainers = d3.selectAll('.chart');

        chartContainers.each((d, i, nodes) => {
            const chartContainer = d3.select(nodes[i]);
            const svg = chartContainer.select('svg');
            if (svg.empty()) return;

            const g = svg.select('g');
            const width = +svg.attr('width') - 170;
            const height = +svg.attr('height') - 90;

            this.addTooltipElements(chartContainer, g);
            this.addOverlay(chartContainer, g, width, height);
        });
    },

    addTooltipElements(chartContainer, g) {
        const chartId = chartContainer.attr('id');

        // Rimuovi tooltip esistenti per questo grafico
        d3.select(`body > .tooltip.tooltip-${chartId}`).remove();
        g.selectAll('.tooltip-line').remove();
        g.selectAll('.tooltip-circle').remove();

        // Aggiungi tooltip al body per evitare clipping
        d3.select('body').append('div')
            .attr('class', `tooltip tooltip-${chartId}`)
            .style('opacity', 0);

        g.append('line')
            .attr('class', 'tooltip-line')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);
    },

    addOverlay(chartContainer, g, width, height) {
        g.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all')
            .on('mouseover', () => this.showTooltips())
            .on('mouseout', () => this.hideTooltips())
            .on('mousemove', (event) => this.moveTooltips(event));
    },

    showTooltips() {
        d3.selectAll('.tooltip').style('opacity', 1);
        d3.selectAll('.tooltip-line').style('opacity', 1);
        d3.selectAll('.tooltip-circle').style('opacity', 1);
    },

    hideTooltips() {
        d3.selectAll('.tooltip').style('opacity', 0);
        d3.selectAll('.tooltip-line').style('opacity', 0);
        d3.selectAll('.tooltip-circle').style('opacity', 0);
    },

    moveTooltips(event) {
        // Determinare la posizione x del mouse su uno dei grafici (il primo)
        const pointer = d3.pointer(event);
        const x0 = this.charts[0].scales.xScale.invert(pointer[0]);

        let pointForTrackMap = null;

        // Itera su ogni grafico per aggiornare la sua linea di tooltip e i cerchi
        this.charts.forEach(chart => {
            const { container, allData, scales, g, yValue, yLabel, yFormat } = chart;
            if (!container || !allData || !scales || !g || allData.length === 0) return;

            const chartId = container.attr('id');
            const tooltip = d3.select(`body > .tooltip.tooltip-${chartId}`);
            let tooltipData = [];

            // Trova i dati per ogni pilota nel punto x0
            allData.forEach(driver => {
                const i = this.bisectDistance(driver.data, x0, 1);
                const d0 = driver.data[i - 1];
                const d1 = driver.data[i];
                if (!d0 || !d1) return;

                const d = x0 - d0.distance > d1.distance - x0 ? d1 : d0;
                if (!pointForTrackMap) pointForTrackMap = d;

                tooltipData.push({
                    driverName: driver.driverName,
                    value: yValue(d),
                    color: driver.color,
                    x: scales.xScale(d.distance),
                    y: scales.yScale(yValue(d)),
                });
            });

            if (tooltipData.length > 0) {
                // Aggiorna linea verticale
                g.select('.tooltip-line')
                    .attr('x1', tooltipData[0].x)
                    .attr('x2', tooltipData[0].x)
                    .attr('y1', 0)
                    .attr('y2', scales.yScale.range()[0]);

                // Aggiorna cerchi
                const circles = g.selectAll('.tooltip-circle').data(tooltipData);
                circles.enter().append('circle')
                    .attr('class', 'tooltip-circle')
                    .attr('r', 5)
                    .style('opacity', 0) // Inizia invisibile
                    .merge(circles)
                    .attr('fill', d => d.color)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y)
                    .style('opacity', 1); // Rendi visibile

                circles.exit().remove();

                // Aggiorna contenuto e posizione del tooltip
                tooltip.html(tooltipData.map(d => `<div style="color: ${d.color}">${d.driverName}: ${yFormat(d.value)} ${yLabel}</div>`).join(''))
                    .style('opacity', 1)
                    .style('left', (g.node().getBoundingClientRect().left + tooltipData[0].x + 15) + 'px')
                    .style('top', (g.node().getBoundingClientRect().top + tooltipData[0].y) + 'px');
            }
        });

        // Aggiorna la posizione sulla mappa
        if (pointForTrackMap) {
            TrackMap.updateCarPosition(pointForTrackMap);
        }
    },
};
