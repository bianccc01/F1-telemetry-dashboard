// js/charts/trackMap.js

const TrackMap = {
    xScale: null,
    yScale: null,

    create(telemetryData) {
        const container = d3.select('#track-map');
        container.select('svg').remove();

        // Set explicit dimensions on the container if not already set
        const containerNode = container.node();
        const containerRect = containerNode.getBoundingClientRect();

        const svg = container.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 300 300')
            .attr('preserveAspectRatio', 'xMidYMid meet') // This ensures proper scaling
            .style('display', 'block') // Prevents inline SVG spacing issues
            .style('max-width', '100%') // Prevents overflow
            .style('max-height', '100%');

        // Get the first driver's data for the track outline
        const firstDriverKey = Object.keys(telemetryData)[0];
        if (!firstDriverKey || !telemetryData[firstDriverKey].data || telemetryData[firstDriverKey].data.length === 0) {
            container.html('<div class="no-data">No track data available</div>');
            return;
        }

        const trackData = telemetryData[firstDriverKey].data;

        // Determine the extent of the data
        const xExtent = d3.extent(trackData, d => d.x);
        const yExtent = d3.extent(trackData, d => d.y);

        this.xScale = d3.scaleLinear().domain(xExtent).range([20, 280]);
        const svgHeight = 300; // Matching viewBox height
        const yExtentRange = yExtent[1] - yExtent[0];
        const yPadding = (svgHeight - (yExtentRange / (d3.max([xExtent[1] - xExtent[0], yExtent[1] - yExtent[0]])) * (svgHeight - 40))) / 2;
        this.yScale = d3.scaleLinear().domain(yExtent).range([yPadding, svgHeight - yPadding]);

        // Draw the track
        svg.append('path')
            .datum(trackData)
            .attr('fill', 'none')
            .attr('stroke', '#444')
            .attr('stroke-width', 2)
            .attr('d', d3.line()
                .x(d => this.xScale(d.x))
                .y(d => this.yScale(d.y))
                .curve(d3.curveCardinalClosed) // Use a closed cardinal spline
            );

        // Draw a single dot for the current position
        svg.append('circle')
            .attr('r', 5)
            .attr('fill', 'white')
            .attr('id', 'car-dot')
            .style('opacity', 0);

        // Draw starting grid
        const startingPoint = trackData[0];
        const nextPoint = trackData[1];
        const angle = Math.atan2(this.yScale(nextPoint.y) - this.yScale(startingPoint.y), this.xScale(nextPoint.x) - this.xScale(startingPoint.x));
        const gridLength = 20; // Length of the grid lines

        svg.append('line')
            .attr('x1', this.xScale(startingPoint.x) - (gridLength / 2) * Math.sin(angle))
            .attr('y1', this.yScale(startingPoint.y) + (gridLength / 2) * Math.cos(angle))
            .attr('x2', this.xScale(startingPoint.x) + (gridLength / 2) * Math.sin(angle))
            .attr('y2', this.yScale(startingPoint.y) - (gridLength / 2) * Math.cos(angle))
            .attr('stroke', 'white')
            .attr('stroke-width', 2);

    },

    updateCarPosition(point) {
        const carDot = d3.select('#car-dot');
        if (point && point.x && point.y && this.xScale && this.yScale) {
            carDot.attr('cx', this.xScale(point.x))
                .attr('cy', this.yScale(point.y))
                .style('opacity', 1);

            // Update sector and distance info
            d3.select('#current-sector').text(`Sector: ${point.sector || '-'}`);
            d3.select('#current-distance').text(`Distance: ${point.distance ? point.distance.toFixed(0) : '-'} m`);
        } else {
            carDot.style('opacity', 0);
        }
    }
};