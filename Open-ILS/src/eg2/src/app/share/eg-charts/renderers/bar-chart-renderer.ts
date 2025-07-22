import { Injectable, inject } from '@angular/core';
import { ChartRenderer, ValidationResult, PerformanceMetrics } from '../interfaces/chart-renderer.interface';
import { ChartData, ChartConfiguration } from '../interfaces/chart-data.interface';
import { ColorService } from '../services/color.service';
import { PatternService } from '../services/pattern.service';
import * as d3 from 'd3';

/**
 * BarChartRenderer - Concrete Strategy Implementation
 *
 * This class implements the ChartRenderer interface specifically for bar charts,
 * providing D3.js-based rendering with full support for categorical data and
 * various bar chart configurations (vertical, horizontal, grouped, stacked).
 */
@Injectable({
    providedIn: 'root'
})
export class BarChartRenderer implements ChartRenderer<ChartData> {
    private performanceMetrics: PerformanceMetrics = {
        renderTime: 0,
        memoryUsage: 0,
        dataPointCount: 0
    };

    private colorService = inject(ColorService);
    private patternService = inject(PatternService);

    /**
     * Render bar chart with given data and configuration
     */
    async render(data: ChartData, svg: d3.Selection<SVGElement, unknown, null, undefined>, config: ChartConfiguration): Promise<void> {
        const startTime = performance.now();
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

        try {
            // Validate data before rendering
            const validation = this.validateData(data);
            if (!validation.isValid) {
                throw new Error(`Invalid data for bar chart: ${validation.errors.join(', ')}`);
            }

            // Set up dimensions
            const { width = 800, height = 400, margin = { top: 20, right: 20, bottom: 40, left: 40 } } = config;
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            // Create main group
            const g = svg.append('g')
                .attr('class', 'bar-chart-container')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Determine orientation
            const barStyle = config.barStyle || {};
            const orientation = barStyle.orientation || 'vertical';

            // Generate pattern definitions if accessibility patterns are enabled
            if (data.accessibility?.patterns) {
                const defs = svg.select('defs').empty()
                    ? svg.append('defs')
                    : svg.select('defs');

                // Generate unique chart ID for this instance
                const chartId = `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Use the same color resolution logic as the fill logic
                const colors = data.series.map((series, seriesIndex) =>
                    series.color || this.colorService.getAccessibleColor(seriesIndex)
                );
                console.log('Pattern generation colors:', colors);
                this.patternService.generatePatternDefinitions(defs as d3.Selection<SVGDefsElement, unknown, null, undefined>, colors, chartId);

                // Store chart ID for later use in pattern requests
                (svg.node() as any)._chartId = chartId;
            }

            // Create scales
            const { xScale, yScale } = this.createScales(data, innerWidth, innerHeight, orientation);

            // Draw grid if enabled
            if (config.showGrid) {
                this.drawGrid(g, xScale, yScale, innerWidth, innerHeight, orientation);
            }

            // Draw axes
            this.drawAxes(g, xScale, yScale, innerWidth, innerHeight, data, orientation);

            // Draw bars
            this.drawBars(g, xScale, yScale, data, config, orientation);

            // Update performance metrics
            this.updatePerformanceMetrics(startTime, startMemory, data);

        } catch (error) {
            console.error('Bar chart rendering failed:', error);
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
            svg.select('.bar-chart-container').remove();

            // Re-render with new data
            const config: ChartConfiguration = {
                width: +svg.attr('width'),
                height: +svg.attr('height'),
                margin: { top: 20, right: 20, bottom: 40, left: 40 },
                showGrid: true,
                showTooltip: true,
                animated: true
            };

            await this.render(data, svg, config);

            // Update performance metrics
            const endTime = performance.now();
            this.performanceMetrics.renderTime = endTime - startTime;

        } catch (error) {
            console.error('Bar chart update failed:', error);
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
            console.error('Bar chart destruction failed:', error);
        }
    }

    /**
     * Validate data for bar chart rendering
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

        // Validate each series
        data.series.forEach((series, index) => {
            if (!series.name) {
                result.warnings.push(`Series ${index} missing name`);
            }

            if (!series.data || series.data.length === 0) {
                result.isValid = false;
                result.errors.push(`Series "${series.name}" has no data points`);
                return;
            }

            // Validate data points
            series.data.forEach((point, pointIndex) => {
                if (point.x === null || point.x === undefined) {
                    result.isValid = false;
                    result.errors.push(`Series "${series.name}" point ${pointIndex} missing x value`);
                }

                if (typeof point.y !== 'number' || isNaN(point.y)) {
                    result.isValid = false;
                    result.errors.push(`Series "${series.name}" point ${pointIndex} invalid y value`);
                }
            });
        });

        // Check for performance concerns
        const totalPoints = data.series.reduce((sum, series) => sum + series.data.length, 0);
        if (totalPoints > 500) {
            result.warnings.push(`Large dataset detected (${totalPoints} points) - consider data aggregation for better performance`);
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

    private createScales(data: ChartData, width: number, height: number, orientation: string) {
        const allData = data.series.flatMap(series => series.data);

        if (orientation === 'vertical') {
            // Vertical bars: x-axis is categorical (ordinal), y-axis is numerical
            const xScale = d3.scaleBand()
                .domain(allData.map(d => String(d.x)))
                .range([0, width])
                .padding(0.1);

            const yExtent = d3.extent(allData, d => d.y) as [number, number];
            const yScale = d3.scaleLinear()
                .domain([0, yExtent[1]])
                .range([height, 0]);

            return { xScale, yScale };
        } else {
            // Horizontal bars: y-axis is categorical (ordinal), x-axis is numerical
            const yScale = d3.scaleBand()
                .domain(allData.map(d => String(d.x)))
                .range([0, height])
                .padding(0.1);

            const xExtent = d3.extent(allData, d => d.y) as [number, number];
            const xScale = d3.scaleLinear()
                .domain([0, xExtent[1]])
                .range([0, width]);

            return { xScale, yScale };
        }
    }

    private drawGrid(g: any, xScale: any, yScale: any, width: number, height: number, orientation: string): void {
        if (orientation === 'vertical') {
            // X grid lines (categorical, so no grid lines typically)
            // Y grid lines (numerical)
            g.append('g')
                .attr('class', 'grid y-grid')
                .call(d3.axisLeft(yScale)
                    .tickSize(-width)
                    .tickFormat(() => '')
                )
                .style('stroke-dasharray', '3,3')
                .style('opacity', 0.3);
        } else {
            // Horizontal orientation
            g.append('g')
                .attr('class', 'grid x-grid')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(xScale)
                    .tickSize(-height)
                    .tickFormat(() => '')
                )
                .style('stroke-dasharray', '3,3')
                .style('opacity', 0.3);
        }
    }

    private drawAxes(g: any, xScale: any, yScale: any, width: number, height: number, data: ChartData, orientation: string): void {
        if (orientation === 'vertical') {
            // X axis (categorical)
            const xAxis = g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(xScale));

            // Y axis (numerical)
            const yAxis = g.append('g')
                .attr('class', 'y-axis')
                .call(d3.axisLeft(yScale));

            // Axis labels
            if (data.xAxisLabel) {
                xAxis.append('text')
                    .attr('class', 'axis-label')
                    .attr('x', width / 2)
                    .attr('y', 35)
                    .style('text-anchor', 'middle')
                    .style('fill', 'var(--bs-body-color)')
                    .text(data.xAxisLabel);
            }

            if (data.yAxisLabel) {
                yAxis.append('text')
                    .attr('class', 'axis-label')
                    .attr('transform', 'rotate(-90)')
                    .attr('x', -height / 2)
                    .attr('y', -35)
                    .style('text-anchor', 'middle')
                    .style('fill', 'var(--bs-body-color)')
                    .text(data.yAxisLabel);
            }
        } else {
            // Horizontal orientation
            const xAxis = g.append('g')
                .attr('class', 'x-axis')
                .attr('transform', `translate(0,${height})`)
                .call(d3.axisBottom(xScale));

            const yAxis = g.append('g')
                .attr('class', 'y-axis')
                .call(d3.axisLeft(yScale));

            // Axis labels
            if (data.xAxisLabel) {
                xAxis.append('text')
                    .attr('class', 'axis-label')
                    .attr('x', width / 2)
                    .attr('y', 35)
                    .style('text-anchor', 'middle')
                    .style('fill', 'var(--bs-body-color)')
                    .text(data.xAxisLabel);
            }

            if (data.yAxisLabel) {
                yAxis.append('text')
                    .attr('class', 'axis-label')
                    .attr('transform', 'rotate(-90)')
                    .attr('x', -height / 2)
                    .attr('y', -35)
                    .style('text-anchor', 'middle')
                    .style('fill', 'var(--bs-body-color)')
                    .text(data.yAxisLabel);
            }
        }
    }

    private drawBars(g: any, xScale: any, yScale: any, data: ChartData, config: ChartConfiguration, orientation: string): void {
        const barStyle = config.barStyle || {};
        const grouping = barStyle.grouping || 'grouped';
        const cornerRadius = barStyle.cornerRadius || 0;
        const opacity = barStyle.opacity || 1;

        if (grouping === 'grouped') {
            this.drawGroupedBars(g, xScale, yScale, data, config, orientation, cornerRadius, opacity);
        } else if (grouping === 'stacked') {
            this.drawStackedBars(g, xScale, yScale, data, config, orientation, cornerRadius, opacity);
        } else {
            // Default to grouped
            this.drawGroupedBars(g, xScale, yScale, data, config, orientation, cornerRadius, opacity);
        }
    }

    private drawGroupedBars(g: any, xScale: any, yScale: any, data: ChartData, config: ChartConfiguration, orientation: string, cornerRadius: number, opacity: number): void {
        // Create sub-scale for grouping
        const groupScale = d3.scaleBand()
            .domain(data.series.map(s => s.name))
            .range([0, orientation === 'vertical' ? xScale.bandwidth() : yScale.bandwidth()])
            .padding(0.05);

        data.series.forEach((series, seriesIndex) => {
            const color = series.color || this.colorService.getAccessibleColor(seriesIndex);
            console.log(`Series ${seriesIndex}: series.color=${series.color}, resolved color=${color}`);

            // Use D3 data binding pattern for proper tooltip data access
            g.selectAll(`.bar-${seriesIndex}`)
                .data(series.data)
                .enter()
                .append('rect')
                .attr('class', `bar bar-${seriesIndex} series-${seriesIndex}`)
                .attr('x', (point: any) => {
                    const category = String(point.x);
                    if (orientation === 'vertical') {
                        return xScale(category) + groupScale(series.name);
                    } else {
                        return 0;
                    }
                })
                .attr('y', (point: any) => {
                    const category = String(point.x);
                    if (orientation === 'vertical') {
                        return yScale(point.y);
                    } else {
                        return yScale(category) + groupScale(series.name);
                    }
                })
                .attr('width', (point: any) => {
                    if (orientation === 'vertical') {
                        return groupScale.bandwidth();
                    } else {
                        return xScale(point.y);
                    }
                })
                .attr('height', (point: any) => {
                    if (orientation === 'vertical') {
                        return yScale(0) - yScale(point.y);
                    } else {
                        return groupScale.bandwidth();
                    }
                })
                .attr('fill', (point: any) => {
                    // Check if accessibility patterns are enabled
                    const usePatterns = data.accessibility?.patterns || series.pattern || point.pattern;

                    if (usePatterns) {
                        // Use pattern-specific fill or get pattern for series
                        const patternType = point.pattern ||
                            series.pattern ||
                            (data.accessibility?.patternOverride?.[seriesIndex]) ||
                            this.patternService.getPatternForIndex(seriesIndex);

                        // Get the stored chart ID
                        const chartId = (g.node()?.closest('svg') as any)?._chartId;
                        const patternFill = this.patternService.getPatternFillUrl(seriesIndex, patternType, chartId);
                        console.log(`Requesting pattern for series ${seriesIndex}, type ${patternType}, chart ${chartId}: ${patternFill}`);

                        if (patternFill) {
                            return patternFill;
                        }
                    }

                    // Fall back to solid color
                    return color;
                })
                .attr('opacity', opacity)
                .attr('stroke', 'rgba(255, 255, 255, 0.6)') // Subtle white inner border (less visible than pie)
                .attr('stroke-width', 0.5) // Very thin border for bars
                .style('filter', 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.08))') // Very subtle shadow for depth
                .attr('rx', cornerRadius)
                .attr('ry', cornerRadius)
                .attr('tabindex', 0)
                .attr('role', 'button')
                .attr('aria-label', (point: any) => {
                    const category = String(point.x);
                    const patternInfo = data.accessibility?.patterns ?
                        ` with ${this.patternService.getPatternForIndex(seriesIndex)} pattern` : '';
                    return `${series.name}: ${category}, ${point.y}${patternInfo}`;
                })
                .style('cursor', 'pointer');
        });
    }

    private drawStackedBars(g: any, xScale: any, yScale: any, data: ChartData, config: ChartConfiguration, orientation: string, cornerRadius: number, opacity: number): void {
        // For stacked bars, we need to calculate cumulative values
        const categories = Array.from(new Set(data.series.flatMap(s => s.data.map(d => String(d.x)))));

        categories.forEach(category => {
            let cumulativeValue = 0;

            data.series.forEach((series, seriesIndex) => {
                const point = series.data.find(d => String(d.x) === category);
                if (point) {
                    const color = series.color || this.colorService.getAccessibleColor(seriesIndex);
                    const value = point.y;

                    if (orientation === 'vertical') {
                        const barX = xScale(category);
                        const barY = yScale(cumulativeValue + value);
                        const barWidth = xScale.bandwidth();
                        const barHeight = yScale(cumulativeValue) - yScale(cumulativeValue + value);

                        g.append('rect')
                            .attr('class', `bar series-${seriesIndex}`)
                            .attr('x', barX)
                            .attr('y', barY)
                            .attr('width', barWidth)
                            .attr('height', barHeight)
                            .attr('fill', () => {
                                // Check if accessibility patterns are enabled
                                const usePatterns = data.accessibility?.patterns || series.pattern || point.pattern;

                                if (usePatterns) {
                                    // Use pattern-specific fill or get pattern for series
                                    const patternType = point.pattern ||
                                        series.pattern ||
                                        (data.accessibility?.patternOverride?.[seriesIndex]) ||
                                        this.patternService.getPatternForIndex(seriesIndex);

                                    // Get the stored chart ID
                                    const chartId = (g.node()?.closest('svg') as any)?._chartId;
                                    const patternFill = this.patternService.getPatternFillUrl(seriesIndex, patternType, chartId);

                                    if (patternFill) {
                                        return patternFill;
                                    }
                                }

                                // Fall back to solid color
                                return color;
                            })
                            .attr('opacity', opacity)
                            .attr('stroke', 'rgba(255, 255, 255, 0.6)') // Subtle white inner border
                            .attr('stroke-width', 0.5) // Very thin border
                            .style('filter', 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.08))') // Very subtle shadow
                            .attr('rx', cornerRadius)
                            .attr('ry', cornerRadius)
                            .attr('tabindex', 0)
                            .attr('role', 'button')
                            .attr('aria-label', () => {
                                const patternInfo = data.accessibility?.patterns ?
                                    ` with ${this.patternService.getPatternForIndex(seriesIndex)} pattern` : '';
                                return `${series.name}: ${category}, ${value}${patternInfo}`;
                            })
                            .style('cursor', 'pointer');
                    } else {
                        const barX = xScale(cumulativeValue);
                        const barY = yScale(category);
                        const barWidth = xScale(cumulativeValue + value) - xScale(cumulativeValue);
                        const barHeight = yScale.bandwidth();

                        g.append('rect')
                            .attr('class', `bar series-${seriesIndex}`)
                            .attr('x', barX)
                            .attr('y', barY)
                            .attr('width', barWidth)
                            .attr('height', barHeight)
                            .attr('fill', () => {
                                // Check if accessibility patterns are enabled
                                const usePatterns = data.accessibility?.patterns || series.pattern || point.pattern;

                                if (usePatterns) {
                                    // Use pattern-specific fill or get pattern for series
                                    const patternType = point.pattern ||
                                        series.pattern ||
                                        (data.accessibility?.patternOverride?.[seriesIndex]) ||
                                        this.patternService.getPatternForIndex(seriesIndex);

                                    // Get the stored chart ID
                                    const chartId = (g.node()?.closest('svg') as any)?._chartId;
                                    const patternFill = this.patternService.getPatternFillUrl(seriesIndex, patternType, chartId);

                                    if (patternFill) {
                                        return patternFill;
                                    }
                                }

                                // Fall back to solid color
                                return color;
                            })
                            .attr('opacity', opacity)
                            .attr('stroke', 'rgba(255, 255, 255, 0.6)') // Subtle white inner border
                            .attr('stroke-width', 0.5) // Very thin border
                            .style('filter', 'drop-shadow(0px 1px 1px rgba(0, 0, 0, 0.08))') // Very subtle shadow
                            .attr('rx', cornerRadius)
                            .attr('ry', cornerRadius)
                            .attr('tabindex', 0)
                            .attr('role', 'button')
                            .attr('aria-label', () => {
                                const patternInfo = data.accessibility?.patterns ?
                                    ` with ${this.patternService.getPatternForIndex(seriesIndex)} pattern` : '';
                                return `${series.name}: ${category}, ${value}${patternInfo}`;
                            })
                            .style('cursor', 'pointer');
                    }

                    cumulativeValue += value;
                }
            });
        });
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
        if (this.performanceMetrics.renderTime > 500) {
            console.warn(`Bar chart render time exceeded threshold: ${this.performanceMetrics.renderTime}ms`);
        }

        if (this.performanceMetrics.dataPointCount > 500) {
            console.warn(`Large dataset detected: ${this.performanceMetrics.dataPointCount} points`);
        }
    }
}
