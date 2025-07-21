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

            // CORREZIONE: Calcolo sicuro delle dimensioni
            const svgWidth = +svg.attr('width') || 0;
            const svgHeight = +svg.attr('height') || 0;

            // Se le dimensioni sono troppo piccole, salta questo chart
            if (svgWidth < 200 || svgHeight < 120) {
                console.warn(`Skipping chart ${chartContainer.attr('id')} - dimensions too small:`, {svgWidth, svgHeight});
                return;
            }

            const width = Math.max(0, svgWidth - 170);
            const height = Math.max(0, svgHeight - 90);

            // Doppio controllo per evitare dimensioni negative
            if (width <= 0 || height <= 0) {
                console.warn(`Skipping chart ${chartContainer.attr('id')} - calculated dimensions invalid:`, {width, height});
                return;
            }

            this.addTooltipElements(chartContainer, g);
            this.addOverlay(chartContainer, g, width, height);
        });
    },

    addTooltipElements(chartContainer, g) {
        const chartId = chartContainer.attr('id');

        // Rimuovi tooltip esistenti per questo grafico SOLO se sono tooltip di telemetria
        d3.select(`body > .tooltip.tooltip-${chartId}`).remove();
        g.selectAll('.tooltip-line').remove();

        // Aggiungi tooltip al body per evitare clipping (SOLO per telemetria)
        d3.select('body').append('div')
            .attr('class', `tooltip tooltip-${chartId} telemetry-tooltip`)
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '10px')
            .style('border-radius', '5px')
            .style('pointer-events', 'none')
            .style('z-index', '500'); // Z-index più basso per telemetria

        g.append('line')
            .attr('class', 'tooltip-line')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .style('opacity', 0);
    },

    addOverlay(chartContainer, g, width, height) {
        // Verifica finale delle dimensioni prima di creare l'overlay
        if (width <= 0 || height <= 0) {
            console.warn(`Cannot create overlay for ${chartContainer.attr('id')} - invalid dimensions:`, {width, height});
            return;
        }

        // Rimuovi overlay esistenti per evitare duplicati
        g.selectAll('.overlay').remove();

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
        d3.selectAll('.tooltip.telemetry-tooltip').style('opacity', 1);
        d3.selectAll('.tooltip-line').style('opacity', 1);
    },

    hideTooltips() {
        // Nascondi SOLO i tooltip di telemetria, NON toccare quelli di race/violin
        d3.selectAll('.tooltip.telemetry-tooltip').style('opacity', 0);
        d3.selectAll('.tooltip-line').style('opacity', 0);
    },

    moveTooltips(event, transform) {
        const pointer = d3.pointer(event);
        const mainChart = this.charts[0];
        if (!mainChart || !mainChart.scales) return;

        // Ottieni sempre il transform corrente dal ZoomManager
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

                // Usa la posizione del mouse del pointer invece di calcolare da lineX
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

        if (pointForTrackMap && typeof TrackMap !== 'undefined' && TrackMap.updateCarPosition) {
            TrackMap.updateCarPosition(pointForTrackMap);
        }
    },

    cleanup() {
        console.log("🧹 Tooltip: Cleaning up telemetry tooltips...");
        d3.selectAll('.tooltip.telemetry-tooltip').remove();
        d3.selectAll('.tooltip-line').remove();
        if (window.chartInstances) {
            window.chartInstances = [];
        }
    }
};