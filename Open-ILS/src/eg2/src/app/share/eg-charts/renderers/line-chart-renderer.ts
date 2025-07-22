import { Injectable, inject } from '@angular/core';
import { ChartRenderer, ValidationResult, PerformanceMetrics } from '../interfaces/chart-renderer.interface';
import { ChartData, ChartConfiguration, CurveType, LineStyleConfiguration } from '../interfaces/chart-data.interface';
import { ColorService } from '../services/color.service';
import * as d3 from 'd3';

/**
 * LineChartRenderer - Concrete Strategy Implementation
 *
 * This class implements the ChartRenderer interface specifically for line charts,
 * providing D3.js-based rendering with full curve type and styling support.
 */
@Injectable({
    providedIn: 'root'
})
export class LineChartRenderer implements ChartRenderer<ChartData> {
    private performanceMetrics: PerformanceMetrics = {
        renderTime: 0,
        memoryUsage: 0,
        dataPointCount: 0
    };

    private colorService = inject(ColorService);

    /**
   * Render line chart with given data and configuration
   */
    async render(data: ChartData, svg: d3.Selection<SVGElement, unknown, null, undefined>, config: ChartConfiguration): Promise<void> {
        const startTime = performance.now();
        const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

        try {
            // Validate data before rendering
            const validation = this.validateData(data);
            if (!validation.isValid) {
                throw new Error(`Invalid data for line chart: ${validation.errors.join(', ')}`);
            }

            // Set up dimensions
            const { width = 800, height = 400, margin = { top: 20, right: 20, bottom: 40, left: 40 } } = config;
            const innerWidth = width - margin.left - margin.right;
            const innerHeight = height - margin.top - margin.bottom;

            // Create main group
            const g = svg.append('g')
                .attr('class', 'line-chart-container')
                .attr('transform', `translate(${margin.left},${margin.top})`);

            // Create scales
            const xScale = this.createXScale(data, innerWidth);
            const yScale = this.createYScale(data, innerHeight);

            // Draw grid if enabled
            if (config.showGrid) {
                this.drawGrid(g, xScale, yScale, innerWidth, innerHeight);
            }

            // Draw axes
            this.drawAxes(g, xScale, yScale, innerHeight, data);

            // Draw lines
            this.drawLines(g, xScale, yScale, data, config);

            // Draw points for interactivity
            this.drawPoints(g, xScale, yScale, data, config);

            // Update performance metrics
            this.updatePerformanceMetrics(startTime, startMemory, data);

        } catch (error) {
            console.error('Line chart rendering failed:', error);
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
            svg.select('.line-chart-container').remove();

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
            console.error('Line chart update failed:', error);
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
            console.error('Line chart destruction failed:', error);
        }
    }

    /**
   * Validate data for line chart rendering
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

            // Validate curve type if specified
            if (series.curveType && !Object.values(CurveType).includes(series.curveType)) {
                result.warnings.push(`Series "${series.name}" has invalid curve type: ${series.curveType}`);
            }
        });

        // Check for performance concerns
        const totalPoints = data.series.reduce((sum, series) => sum + series.data.length, 0);
        if (totalPoints > 1000) {
            result.warnings.push(`Large dataset detected (${totalPoints} points) - consider data sampling for better performance`);
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

    private createXScale(data: ChartData, width: number): d3.ScaleLinear<number, number> | d3.ScaleTime<number, number> {
        const allData = data.series.flatMap(series => series.data);
        const xValues = allData.map(d => d.x);

        // Check if we have Date values
        if (xValues.length > 0 && xValues[0] instanceof Date) {
            const xExtent = d3.extent(xValues as Date[]) as [Date, Date];
            return d3.scaleTime()
                .domain(xExtent)
                .range([0, width]);
        } else {
            const xExtent = d3.extent(xValues as number[]) as [number, number];
            return d3.scaleLinear()
                .domain(xExtent)
                .range([0, width]);
        }
    }

    private createYScale(data: ChartData, height: number): d3.ScaleLinear<number, number> {
        const allData = data.series.flatMap(series => series.data);
        const yExtent = d3.extent(allData, d => d.y) as [number, number];

        // Add padding to prevent data from being compressed at the edges
        const padding = (yExtent[1] - yExtent[0]) * 0.1; // 10% padding
        const paddedDomain: [number, number] = [
            Math.max(0, yExtent[0] - padding), // Don't go below 0 for circulation data
            yExtent[1] + padding
        ];


        return d3.scaleLinear()
            .domain(paddedDomain)
            .range([height, 0]);
    }

    private drawGrid(g: any, xScale: any, yScale: any, width: number, height: number): void {
    // X grid lines
        g.append('g')
            .attr('class', 'grid x-grid')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale)
                .tickSize(-height)
                .tickFormat(() => '')
            )
            .style('stroke-dasharray', '3,3')
            .style('opacity', 0.3);

        // Y grid lines
        g.append('g')
            .attr('class', 'grid y-grid')
            .call(d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(() => '')
            )
            .style('stroke-dasharray', '3,3')
            .style('opacity', 0.3);
    }

    private drawAxes(g: any, xScale: any, yScale: any, height: number, data: ChartData): void {
    // X axis
        const xAxis = g.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        // Y axis
        const yAxis = g.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale));

        // Axis labels
        if (data.xAxisLabel) {
            xAxis.append('text')
                .attr('class', 'axis-label')
                .attr('x', xScale.range()[1] / 2)
                .attr('y', 35)
                .style('text-anchor', 'middle')
                .style('fill', 'var(--bs-body-color)')
                .text(data.xAxisLabel);
        }

        if (data.yAxisLabel) {
            yAxis.append('text')
                .attr('class', 'axis-label')
                .attr('transform', 'rotate(-90)')
                .attr('x', -yScale.range()[0] / 2)
                .attr('y', -35)
                .style('text-anchor', 'middle')
                .style('fill', 'var(--bs-body-color)')
                .text(data.yAxisLabel);
        }
    }

    private drawLines(g: any, xScale: any, yScale: any, data: ChartData, config: ChartConfiguration): void {
        data.series.forEach((series, index) => {
            const color = series.color || this.colorService.getAccessibleColor(index);

            // Determine curve type: series-specific, global config, or default
            const curveType = series.curveType || config.curveType || CurveType.MONOTONE_X;

            // Determine line style: series-specific, global config, or defaults
            const lineStyle = series.lineStyle || config.lineStyle || {};

            // Create line generator with appropriate curve
            const line = d3.line<any>()
                .x(d => xScale(d.x))
                .y(d => yScale(d.y))
                .curve(this.getCurveFunction(curveType, lineStyle));

            // Apply line styling
            const strokeWidth = lineStyle.strokeWidth || 2;
            const strokeDashArray = lineStyle.strokeDashArray || 'none';
            const strokeLinecap = lineStyle.strokeLinecap || 'round';
            const strokeLinejoin = lineStyle.strokeLinejoin || 'round';
            const opacity = lineStyle.opacity || 1;

            g.append('path')
                .datum(series.data)
                .attr('class', `line series-${index}`)
                .attr('fill', 'none')
                .attr('stroke', color)
                .attr('stroke-width', strokeWidth)
                .attr('stroke-dasharray', strokeDashArray)
                .attr('stroke-linecap', strokeLinecap)
                .attr('stroke-linejoin', strokeLinejoin)
                .attr('opacity', opacity)
                .attr('d', line)
                .attr('aria-label', `Line chart for ${series.name}`);
        });
    }

    private drawPoints(g: any, xScale: any, yScale: any, data: ChartData, config: ChartConfiguration): void {
        if (!config.showTooltip) {return;}

        data.series.forEach((series, seriesIndex) => {
            const color = series.color || this.colorService.getAccessibleColor(seriesIndex);

            g.selectAll(`.point-${seriesIndex}`)
                .data(series.data)
                .enter()
                .append('circle')
                .attr('class', `point point-${seriesIndex}`)
                .attr('cx', (d: any) => xScale(d.x))
                .attr('cy', (d: any) => yScale(d.y))
                .attr('r', 4)
                .attr('fill', color)
                .attr('stroke', 'var(--bs-body-bg)')
                .attr('stroke-width', 2)
                .attr('tabindex', 0)
                .attr('role', 'button')
                .attr('aria-label', (d: any) => `Data point: ${d.x}, ${d.y}`)
                .style('cursor', 'pointer');
        });
    }

    private getCurveFunction(curveType: CurveType = CurveType.MONOTONE_X, lineStyle?: LineStyleConfiguration): any {
        switch (curveType) {
            case CurveType.LINEAR:
                return d3.curveLinear;
            case CurveType.MONOTONE_X:
                return d3.curveMonotoneX;
            case CurveType.MONOTONE_Y:
                return d3.curveMonotoneY;
            case CurveType.BASIS:
                return d3.curveBasis;
            case CurveType.BASIS_OPEN:
                return d3.curveBasisOpen;
            case CurveType.BASIS_CLOSED:
                return d3.curveBasisClosed;
            case CurveType.BUNDLE:
                return d3.curveBundle;
            case CurveType.CARDINAL:
                return lineStyle?.tension !== undefined ? d3.curveCardinal.tension(lineStyle.tension) : d3.curveCardinal;
            case CurveType.CARDINAL_OPEN:
                return lineStyle?.tension !== undefined ? d3.curveCardinalOpen.tension(lineStyle.tension) : d3.curveCardinalOpen;
            case CurveType.CARDINAL_CLOSED:
                return lineStyle?.tension !== undefined ? d3.curveCardinalClosed.tension(lineStyle.tension) : d3.curveCardinalClosed;
            case CurveType.CATMULL_ROM:
                return lineStyle?.alpha !== undefined ? d3.curveCatmullRom.alpha(lineStyle.alpha) : d3.curveCatmullRom;
            case CurveType.CATMULL_ROM_OPEN:
                return lineStyle?.alpha !== undefined ? d3.curveCatmullRomOpen.alpha(lineStyle.alpha) : d3.curveCatmullRomOpen;
            case CurveType.CATMULL_ROM_CLOSED:
                return lineStyle?.alpha !== undefined ? d3.curveCatmullRomClosed.alpha(lineStyle.alpha) : d3.curveCatmullRomClosed;
            case CurveType.NATURAL:
                return d3.curveNatural;
            case CurveType.STEP:
                return d3.curveStep;
            case CurveType.STEP_BEFORE:
                return d3.curveStepBefore;
            case CurveType.STEP_AFTER:
                return d3.curveStepAfter;
            default:
                return d3.curveMonotoneX;
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
        if (this.performanceMetrics.renderTime > 500) {
            console.warn(`Line chart render time exceeded threshold: ${this.performanceMetrics.renderTime}ms`);
        }

        if (this.performanceMetrics.dataPointCount > 1000) {
            console.warn(`Large dataset detected: ${this.performanceMetrics.dataPointCount} points`);
        }
    }
}
