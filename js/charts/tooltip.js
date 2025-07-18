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
        chartContainer.selectAll('.tooltip').remove();
        g.selectAll('.tooltip-line').remove();
        g.selectAll('.tooltip-circle').remove();

        chartContainer.append('div').attr('class', 'tooltip').style('opacity', 0);
        g.append('line').attr('class', 'tooltip-line').attr('stroke', '#fff').attr('stroke-width', 1).attr('stroke-dasharray', '3,3').style('opacity', 0);
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
        const x0 = this.charts[0].scales.xScale.invert(d3.pointer(event)[0]);

        this.charts.forEach(chart => {
            const { container, allData, scales, g, yValue, yLabel, yFormat } = chart;
            if (!container || !allData || !scales || !g) return;

            let tooltipData = [];
            allData.forEach(driver => {
                const i = this.bisectDistance(driver.data, x0, 1);
                const d0 = driver.data[i - 1];
                const d1 = driver.data[i];
                if (!d0 || !d1) return;
                const d = x0 - d0.distance > d1.distance - x0 ? d1 : d0;
                tooltipData.push({
                    driverName: driver.driverName,
                    value: yValue(d),
                    color: driver.color,
                    x: scales.xScale(d.distance),
                    y: scales.yScale(yValue(d)),
                });
            });

            if (tooltipData.length > 0) {
                g.select('.tooltip-line').attr('x1', tooltipData[0].x).attr('x2', tooltipData[0].x).attr('y1', 0).attr('y2', scales.yScale.range()[0]);

                const circles = g.selectAll('.tooltip-circle').data(tooltipData);
                circles.enter().append('circle')
                    .attr('class', 'tooltip-circle')
                    .attr('r', 5)
                    .merge(circles)
                    .attr('fill', d => d.color)
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);
                circles.exit().remove();

                container.select('.tooltip')
                    .html(tooltipData.map(d => `<div style="color: ${d.color}">${d.driverName}: ${yFormat(d.value)} ${yLabel}</div>`).join(''))
                    .style('left', (event.pageX + 15) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            }
        });
    }
};
