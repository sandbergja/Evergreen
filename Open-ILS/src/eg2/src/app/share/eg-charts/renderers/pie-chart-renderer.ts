/* eslint-disable no-magic-numbers */
import { Injectable, inject } from '@angular/core';
import { ChartRenderer, ValidationResult, PerformanceMetrics } from '../interfaces/chart-renderer.interface';
import { ChartData, ChartConfiguration } from '../interfaces/chart-data.interface';
import { ColorService } from '../services/color.service';
import { PatternService } from '../services/pattern.service';
import * as d3 from 'd3';

/**
 * PieChartRenderer - Concrete Strategy Implementation
 *
 * This class implements the ChartRenderer interface specifically for pie charts,
 * providing D3.js-based rendering with full support for pie slices, donut charts,
 * and accessibility features.
 */
@Injectable({
    providedIn: 'root'
})
export class PieChartRenderer implements ChartRenderer<ChartData> {
    private performanceMetrics: PerformanceMetrics = {
        renderTime: 0,
        memoryUsage: 0,
        dataPointCount: 0
    };

    private colorService = inject(ColorService);
    private patternService = inject(PatternService);

    /**
     * Render pie chart with given data and configuration
     */
    async render(data: ChartData, svg: d3.Selection<SVGElement, unknown, null, undefined>, config: ChartConfiguration): Promise<void> {
        const startTime = performance.now();
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

        try {
            // Validate data before rendering
            const validation = this.validateData(data);
            if (!validation.isValid) {
                throw new Error(`Invalid data for pie chart: ${validation.errors.join(', ')}`);
            }

            // Set up dimensions
            const { width = 800, height = 400, margin = { top: 20, right: 20, bottom: 40, left: 40 } } = config;
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;
            const radius = Math.min(innerWidth, innerHeight) / 2;

            // Create main group
            const g = svg.append('g')
                .attr('class', 'pie-chart-container')
                .attr('transform', `translate(${margin.left + innerWidth / 2},${margin.top + innerHeight / 2})`);

            // Get pie style configuration
            const pieStyle = config.pieStyle || {};
            const innerRadius = pieStyle.innerRadius || 0;
            const outerRadius = pieStyle.outerRadius || radius;
            const padAngle = pieStyle.padAngle || 0;
            const cornerRadius = pieStyle.cornerRadius || 0;

            // Process data - use first series for single series implementation
            const series = data.series.find(s => s.name === data.shownSeries?.[0]) ?? data.series[0];
            if (!series) {
                throw new Error('No data series found for pie chart');
            }

            // Generate pattern definitions if accessibility patterns are enabled
            if (data.accessibility?.patterns) {
                const defs = svg.select('defs').empty()
                    ? svg.append('defs')
                    : svg.select('defs');

                // Generate unique chart ID for this instance
                const chartId = `pie-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Use the same color resolution logic as the fill logic
                const colors = series.data.map((point, pointIndex) =>
                    point.color || series.color || this.colorService.getAccessibleColor(pointIndex)
                );
                this.patternService.generatePatternDefinitions(
                    defs as d3.Selection<SVGDefsElement, unknown, null, undefined>, colors, chartId
                );

                // Store chart ID for later use in pattern requests
                (svg.node() as any)._chartId = chartId;
            }

            // Create pie layout
            const pie = d3.pie<any>()
                .value(d => d.y) // Use y from unified ChartPoint interface
                .padAngle(padAngle)
                .sort(null); // Preserve data order

            // Create arc generator
            const arc = d3.arc<any>()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .cornerRadius(cornerRadius);

            // Generate pie data
            const pieData = pie(series.data);

            // Draw pie slices
            this.drawSlices(g, pieData, arc, series, config, data);

            // Draw labels if enabled
            // if (pieStyle.showLabels !== false) {
            //     this.drawLabels(g, pieData, arc, series, config);
            // }

            // Update performance metrics
            this.updatePerformanceMetrics(startTime, startMemory, data);

        } catch (error) {
            console.error('Pie chart rendering failed:', error);
            throw error;
        }
    }

    /**
     * Update chart with new data
     */
    async update(data: ChartData, svg: d3.Selection<SVGElement, unknown, null, undefined>): Promise<void> {
        const startTime = performance.now();

        try {
            // Remove existing chart content
            svg.select('.pie-chart-container').remove();

            // Re-render with new data
            const config: ChartConfiguration = {
                width: +svg.attr('width'),
                height: +svg.attr('height'),
                margin: { top: 20, right: 20, bottom: 40, left: 40 },
                showTooltip: true,
                animated: true
            };

            await this.render(data, svg, config);

            // Update performance metrics
            const endTime = performance.now();
            this.performanceMetrics.renderTime = endTime - startTime;

        } catch (error) {
            console.error('Pie chart update failed:', error);
            throw error;
        }
    }

    /**
     * Destroy chart and clean up resources
     */
    destroy(svg: d3.Selection<SVGElement, unknown, null, undefined>): void {
        try {
            svg.selectAll('*').remove();

            // Reset performance metrics
            this.performanceMetrics = {
                renderTime: 0,
                memoryUsage: 0,
                dataPointCount: 0
            };

        } catch (error) {
            console.error('Pie chart destruction failed:', error);
        }
    }

    /**
     * Validate data for pie chart rendering
     */
    validateData(data: ChartData): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // Check for required data
        if (!data.series || data.series.length === 0) {
            result.isValid = false;
            result.errors.push('No data series provided');
            return result;
        }

        // For pie charts, we currently support single series only
        if (data.series.length > 1) {
            result.warnings.push('Multiple series detected - using first series only for pie chart');
        }

        // Validate the first series
        const series = data.series[0];
        if (!series.name) {
            result.warnings.push('Series missing name');
        }

        if (!series.data || series.data.length === 0) {
            result.isValid = false;
            result.errors.push(`Series "${series.name}" has no data points`);
            return result;
        }

        // Validate data points
        series.data.forEach((point, pointIndex) => {
            if (!point.x || (typeof point.x === 'string' && point.x.trim() === '')) {
                result.isValid = false;
                result.errors.push(`Series "${series.name}" point ${pointIndex} missing x value`);
            }

            if (typeof point.y !== 'number' || isNaN(point.y) || point.y < 0) {
                result.isValid = false;
                result.errors.push(`Series "${series.name}" point ${pointIndex} invalid value (must be positive number)`);
            }
        });

        // Check for performance concerns
        const totalPoints = series.data.length;
        if (totalPoints > 20) {
            result.warnings.push(`Large number of pie slices detected (${totalPoints}) - consider data aggregation for better readability`);
        }

        return result;
    }

    /**
     * Get current performance metrics
     */
    getPerformanceMetrics(): PerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    // Private rendering methods

    private drawSlices(g: any, pieData: any[], arc: any, series: any, config: ChartConfiguration, data: ChartData): void {
        const slices = g.selectAll('.slice')
            .data(pieData)
            .enter()
            .append('g')
            .attr('class', 'slice');

        const pieStyle = config.pieStyle || {};
        const opacity = pieStyle.opacity || 1;

        slices.append('path')
            .attr('class', (d: any, i: number) => `arc slice-path slice-${i}`)
            .attr('d', arc)
            .attr('fill', (d: any, i: number) => {
                // Check if accessibility patterns are enabled
                const usePatterns = data.accessibility?.patterns || series.data.some(point => point.pattern);

                if (usePatterns) {
                    // Use pattern-specific fill or get pattern for index
                    const patternType = d.data.pattern ||
                        (data.accessibility?.patternOverride?.[i]) ||
                        this.patternService.getPatternForIndex(i);

                    // Get the stored chart ID
                    const chartId = (g.node()?.closest('svg') as any)?._chartId;
                    const patternFill = this.patternService.getPatternFillUrl(i, patternType, chartId);

                    if (patternFill) {
                        return patternFill;
                    }
                }

                // Fall back to solid color - each slice gets a different color from palette
                return d.data.color || this.colorService.getAccessibleColor(i);
            })
            .attr('opacity', opacity)
            .attr('stroke', 'rgba(255, 255, 255, 0.8)') // Subtle white inner border
            .attr('stroke-width', 0.75)
            .style('filter', 'drop-shadow(0px 0px 0.5px rgba(0, 0, 0, 0.1))') // Very subtle shadow for definition
            .attr('tabindex', 0)
            .attr('role', 'button')
            .attr('aria-label', (d: any, i: number) => {
                const patternInfo = data.accessibility?.patterns ?
                    ` with ${this.patternService.getPatternForIndex(i)} pattern` : '';
                return `${d.data.x}: ${d.data.y}${patternInfo}`;
            })
            .style('cursor', 'pointer');
    }

    private drawLabels(g: any, pieData: any[], arc: any, series: any, config: ChartConfiguration): void {
        const pieStyle = config.pieStyle || {};
        const labelPosition = pieStyle.labelPosition || 'outside';

        // Calculate label arc (for outside labels, use a larger radius)
        const labelArc = labelPosition === 'outside'
            ? d3.arc<any>()
                .innerRadius((pieStyle.outerRadius || 100) + 20)
                .outerRadius((pieStyle.outerRadius || 100) + 20)
            : arc;

        g.selectAll('.slice-label')
            .data(pieData)
            .enter()
            .append('text')
            .attr('class', 'slice-label')
            .attr('transform', (d: any) => `translate(${labelArc.centroid(d)})`)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '12px')
            .style('fill', 'var(--bs-body-color)')
            .style('pointer-events', 'none')
            .text((d: any) => {
                // Show label if slice is large enough
                const percentage = ((d.endAngle - d.startAngle) / (2 * Math.PI)) * 100;
                return percentage > 5 ? d.data.x : '';
            });

        // Add percentage labels for outside positioning
        if (labelPosition === 'outside') {
            g.selectAll('.slice-percentage')
                .data(pieData)
                .enter()
                .append('text')
                .attr('class', 'slice-percentage')
                .attr('transform', (d: any) => `translate(${labelArc.centroid(d)})`)
                .attr('text-anchor', 'middle')
                .attr('dominant-baseline', 'middle')
                .attr('dy', '1.2em')
                .style('font-size', '10px')
                .style('fill', 'var(--bs-secondary)')
                .style('pointer-events', 'none')
                .text((d: any) => {
                    const total = pieData.reduce((sum, item) => sum + item.data.y, 0);
                    const percentage = (d.data.y / total) * 100;
                    return percentage > 5 ? `${percentage.toFixed(1)}%` : '';
                });
        }
    }

    private updatePerformanceMetrics(startTime: number, startMemory: number, data: ChartData): void {
        const endTime = performance.now();
        const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

        this.performanceMetrics = {
            renderTime: endTime - startTime,
            memoryUsage: endMemory - startMemory,
            dataPointCount: data.series.reduce((sum, series) => sum + series.data.length, 0)
        };

        // Log performance warnings if thresholds exceeded
        if (this.performanceMetrics.renderTime > 300) {
            console.warn(`Pie chart render time exceeded threshold: ${this.performanceMetrics.renderTime}ms`);
        }

        if (this.performanceMetrics.dataPointCount > 20) {
            console.warn(`Large number of pie slices: ${this.performanceMetrics.dataPointCount} slices`);
        }
    }
}
