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
        d3.selectAll('.tooltip:not(.race-chart-tooltip):not(.violin-tooltip)').style('opacity', 0);
        d3.selectAll('.tooltip-line').style('opacity', 0);
    },

    moveTooltips(event, transform) {
        const pointer = d3.pointer(event);
        const mainChart = this.charts[0];
        if (!mainChart || !mainChart.scales) return;

        // CORREZIONE PRINCIPALE: Ottieni sempre il transform corrente dal ZoomManager
        const currentTransform = window.ZoomManager ? window.ZoomManager.getTransform() : d3.zoomIdentity;
        const isZoomed = currentTransform.k !== 1;

        // Usa sempre il transform corrente, non quello passato come parametro
        let effectiveTransform = isZoomed ? currentTransform : null;

        // Converti la posizione del mouse usando il transform corrente
        let x0;
        if (effectiveTransform) {
            const transformedScale = effectiveTransform.rescaleX(mainChart.scales.xScale);
            x0 = transformedScale.invert(pointer[0]);
        } else {
            x0 = mainChart.scales.xScale.invert(pointer[0]);
        }

        let pointForTrackMap = null;

        this.charts.forEach(chart => {
            const { container, allData, scales, g, yValue, yLabel, yFormat } = chart;
            if (!container || !allData || !scales || !g || allData.length === 0) return;

            const chartId = container.attr('id');
            const tooltip = d3.select(`body > .tooltip.tooltip-${chartId}`);
            let tooltipData = [];

            // Usa lo stesso transform per questo chart
            let chartXScale;
            if (effectiveTransform) {
                chartXScale = effectiveTransform.rescaleX(scales.xScale);
            } else {
                chartXScale = scales.xScale;
            }

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
                    distance: d.distance
                });
            });

            if (tooltipData.length > 0) {
                // Calcola la posizione X corretta per la linea e il tooltip
                const lineX = chartXScale(tooltipData[0].distance);

                g.select('.tooltip-line')
                    .attr('x1', lineX)
                    .attr('x2', lineX)
                    .attr('y1', 0)
                    .attr('y2', scales.yScale.range()[0]);

                // CORREZIONE: Usa la posizione del mouse del pointer invece di calcolare da lineX
                const svgRect = g.node().ownerSVGElement.getBoundingClientRect();
                const gRect = g.node().getBoundingClientRect();

                // Calcola la posizione assoluta corretta del tooltip
                const tooltipX = svgRect.left + pointer[0] + 70 + 15; // 70 è il margin.left del chart
                const tooltipY = gRect.top + scales.yScale(tooltipData[0].value);

                tooltip.html(tooltipData.map(d =>
                    `<div style="color: ${d.color}">${d.driverName}: ${yFormat(d.value)} ${yLabel}</div>`
                ).join(''))
                    .style('opacity', 1)
                    .style('left', tooltipX + 'px')
                    .style('top', tooltipY + 'px');
            }
        });

        if (pointForTrackMap) {
            TrackMap.updateCarPosition(pointForTrackMap);
        }
    },
};