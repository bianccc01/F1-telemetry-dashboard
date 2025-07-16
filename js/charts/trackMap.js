// js/charts/trackMap.js

const TrackMap = {
    create(telemetryData) {
        const container = d3.select('#track-map');
        container.selectAll('*').remove(); // Clear previous map

        const svg = container.append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', '0 0 300 300'); // Fixed viewBox for consistent scaling

        // Get the first driver's data for the track outline
        const firstDriverKey = Object.keys(telemetryData)[0];
        if (!firstDriverKey || !telemetryData[firstDriverKey].data) {
            container.html('<div class="no-data">No track data available</div>');
            return;
        }

        const trackData = telemetryData[firstDriverKey].data;

        // Determine the extent of the data
        const xExtent = d3.extent(trackData, d => d.x);
        const yExtent = d3.extent(trackData, d => d.y);

        const xScale = d3.scaleLinear().domain(xExtent).range([20, 280]);
        const svgHeight = 300; // Matching viewBox height
        const yExtentRange = yExtent[1] - yExtent[0];
        const yPadding = (svgHeight - (yExtentRange / (d3.max([xExtent[1] - xExtent[0], yExtent[1] - yExtent[0]])) * (svgHeight - 40))) / 2;
        const yScale = d3.scaleLinear().domain(yExtent).range([yPadding, svgHeight - yPadding]);

        // Draw the track
        svg.append('path')
            .datum(trackData)
            .attr('fill', 'none')
            .attr('stroke', '#444')
            .attr('stroke-width', 2)
            .attr('d', d3.line()
                .x(d => xScale(d.x))
                .y(d => yScale(d.y))
            );

        // Draw a single dot for the current position
        svg.append('circle')
            .attr('r', 5)
            .attr('fill', 'white')
            .attr('id', 'car-dot')
            .style('opacity', 0);
    },

    updateCarPosition(point, xScale, yScale) {
        const carDot = d3.select('#car-dot');
        if (point && point.x && point.y) {
            console.log('Updating car position with point:', point); // Debugging log
            carDot.attr('cx', xScale(point.x))
                .attr('cy', yScale(point.y))
                .style('opacity', 1);

            // Update sector and distance info
            d3.select('#current-sector').text(`Sector: ${point.sector || '-'}`);
            d3.select('#current-distance').text(`Distance: ${point.distance ? point.distance.toFixed(0) : '-'} m`);
        } else {
            carDot.style('opacity', 0);
        }
    }
};
