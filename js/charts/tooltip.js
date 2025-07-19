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
    },

    hideTooltips() {
        d3.selectAll('.tooltip:not(.violin-tooltip)').style('opacity', 0);
        d3.selectAll('.tooltip-line').style('opacity', 0);
    },

    moveTooltips(event, transform) {
        const pointer = d3.pointer(event);
        const mainChart = this.charts[0];
        if (!mainChart || !mainChart.scales) return;

        const currentXScale = transform ? transform.rescaleX(mainChart.scales.xScale) : mainChart.scales.xScale;
        const x0 = currentXScale.invert(pointer[0]);

        let pointForTrackMap = null;

        this.charts.forEach(chart => {
            const { container, allData, scales, g, yValue, yLabel, yFormat } = chart;
            if (!container || !allData || !scales || !g || allData.length === 0) return;

            const chartId = container.attr('id');
            const tooltip = d3.select(`body > .tooltip.tooltip-${chartId}`);
            let tooltipData = [];

            const effectiveXScale = transform ? transform.rescaleX(scales.xScale) : scales.xScale;

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
                    x: effectiveXScale(d.distance),
                    y: scales.yScale(yValue(d)),
                });
            });

            if (tooltipData.length > 0) {
                g.select('.tooltip-line')
                    .attr('x1', effectiveXScale(x0))
                    .attr('x2', effectiveXScale(x0))
                    .attr('y1', 0)
                    .attr('y2', scales.yScale.range()[0]);

                tooltip.html(tooltipData.map(d => `<div style="color: ${d.color}">${d.driverName}: ${yFormat(d.value)} ${yLabel}</div>`).join(''))
                    .style('opacity', 1)
                    .style('left', (g.node().getBoundingClientRect().left + effectiveXScale(x0) + 15) + 'px')
                    .style('top', (g.node().getBoundingClientRect().top + scales.yScale(tooltipData[0].value)) + 'px');
            }
        });

        if (pointForTrackMap) {
            TrackMap.updateCarPosition(pointForTrackMap);
        }
    },
};
