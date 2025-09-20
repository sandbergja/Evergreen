import { Component, Input, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject, SimpleChanges, OnChanges } from '@angular/core';
import { ChartData, ChartConfiguration } from './interfaces/chart-data.interface';
import { ChartRenderer } from './interfaces/chart-renderer.interface';
import { AccessibilityService } from './services/accessibility.service';
import { ColorService } from './services/color.service';
import * as d3 from 'd3';

/**
 * BaseChartComponent - Template Method Pattern Implementation
 *
 * This abstract base class defines the common chart lifecycle and provides
 * shared functionality for all chart types. Concrete chart implementations
 * extend this class and implement the abstract methods.
 */
@Component({
    template: '' // Abstract component has no template
})
export abstract class BaseChartComponent<T extends ChartData = ChartData> implements OnInit, OnDestroy, OnChanges {
    @Input() chartData: T | null = null;
    @Input() config: ChartConfiguration = {
        width: 800,
        height: 400,
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
        showGrid: true,
        showTooltip: true,
        animated: true
    };

    @ViewChild('chartSvg', { static: true }) chartSvg?: ElementRef<SVGElement>;
    @ViewChild('chartWrapper', { static: true }) chartWrapper?: ElementRef<HTMLDivElement>;

    // Service injection
    protected accessibilityService = inject(AccessibilityService);
    protected colorService = inject(ColorService);

    // D3.js selections
    protected svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
    protected tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;

    // Chart state
    protected isInitialized = false;
    protected currentData: T | null = null;

    ngOnInit(): void {
        this.initializeChart();
    }

    ngOnChanges(changes: SimpleChanges) : void {
        if (changes.chartData) {
            this.updateChart();
        }
    }

    ngOnDestroy(): void {
        this.cleanup();
    }

    @HostListener('window:resize', ['$event'])
    onResize(): void {
        if (this.isInitialized) {
            this.handleResize();
        }
    }

    /**
     * Template Method - defines the chart rendering algorithm
     * This method should not be overridden by subclasses
     */
    protected renderChart(): void {
        try {
            this.validateInput();
            this.initializeChartElements();
            this.setupSvg();
            this.renderData(); // Abstract method - implemented by subclasses
            this.setupAccessibility();
            this.bindEvents();
            this.isInitialized = true;
            this.currentData = this.chartData;
        } catch (error) {
            this.handleChartError(error);
        }
    }

    /**
     * Template Method - updates chart with new data
     * This method should not be overridden by subclasses
     */
    protected updateChart(): void {
        if (!this.isInitialized || !this.chartData) {return;}

        try {
            this.validateInput();
            this.updateData(this.chartData); // Abstract method - implemented by subclasses
            this.updateAccessibility();
            this.currentData = this.chartData;
        } catch (error) {
            this.handleChartError(error);
        }
    }

    // Concrete methods - shared by all chart types

    /**
     * Initialize the chart - called once during component initialization
     */
    private initializeChart(): void {
        if (!this.chartData) {return;}
        this.renderChart();
    }

    /**
     * Validate input data and configuration
     */
    protected validateInput(): void {
        if (!this.chartData) {
            throw new Error('Chart data is required');
        }

        if (!this.chartData.series || this.chartData.series.length === 0) {
            throw new Error('Chart data must contain at least one series');
        }

        for (const series of this.chartData.series) {
            if (!series.data || series.data.length === 0) {
                throw new Error(`Series "${series.name}" must contain at least one data point`);
            }
        }
    }

    /**
     * Initialize chart elements (SVG, tooltip, etc.)
     */
    protected initializeChartElements(): void {
        if (!this.chartSvg) {
            throw new Error('Chart SVG element not found');
        }

        this.svg = d3.select(this.chartSvg.nativeElement);
        this.createTooltip();
    }

    /**
     * Set up SVG container and basic structure
     */
    protected setupSvg(): void {
        if (!this.svg) {return;}

        // Clear existing content
        this.svg.selectAll('*').remove();

        // Calculate dimensions - use container height if config height not specified
        const width = this.config.width || 800;
        const height = this.config.height || this.chartWrapper?.nativeElement?.clientHeight || 400;
        
        this.svg
            .attr('width', width)
            .attr('height', height)
            .attr('role', 'img')
            .attr('aria-labelledby', 'chart-title');

        // Update config with calculated dimensions for renderers
        this.config = {
            ...this.config,
            width: width,
            height: height
        };

        // Add title element for accessibility
        this.svg.append('title')
            .attr('id', 'chart-title')
            .text(this.chartData?.title || 'Chart');
    }

    /**
     * Create tooltip element
     */
    protected createTooltip(): void {
        if (!this.config.showTooltip || !this.chartWrapper) {return;}

        this.tooltip = d3.select(this.chartWrapper.nativeElement)
            .append('div')
            .attr('class', 'eg-chart-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'var(--modal-header-bg)')
            .style('color', 'var(--modal-header-color)')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('pointer-events', 'none')
            .style('font-size', '12px')
            .style('box-shadow', '0 2px 4px rgba(0,0,0,0.2)')
            .attr('role', 'tooltip')
            .attr('aria-hidden', 'true');
    }

    /**
     * Set up accessibility features
     */
    protected setupAccessibility(): void {
        if (!this.chartData || !this.svg) {return;}

        try {
            // Generate ARIA label
            const ariaLabel = this.accessibilityService.generateAriaLabel(this.chartData as ChartData);
            this.svg.attr('aria-label', ariaLabel);

            // Set up keyboard navigation
            if (this.chartSvg) {
                this.accessibilityService.setupKeyboardNavigation(this.chartSvg.nativeElement as any);
            }

            // Announce data updates for screen readers
            if (this.currentData && this.currentData !== this.chartData) {
                const summary = this.generateUpdateSummary();
                this.accessibilityService.announceDataUpdate(summary);
            }
        } catch {
            this.accessibilityService.handleAccessibilityError({
                type: 'aria',
                message: 'Failed to set up accessibility features',
                element: this.chartSvg?.nativeElement as any
            });
        }
    }

    /**
     * Update accessibility when data changes
     */
    protected updateAccessibility(): void {
        this.setupAccessibility();
    }

    /**
     * Bind event handlers
     */
    protected bindEvents(): void {
        // Default implementation - can be overridden by subclasses
        // Common event binding logic goes here
    }

    /**
     * Handle chart errors
     */
    protected handleChartError(error: any): void {
        console.error('Chart error:', error);

        // Display error message to user
        if (this.svg) {
            this.svg.selectAll('*').remove();
            this.svg.append('text')
                .attr('x', (this.config.width || 800) / 2)
                .attr('y', (this.config.height || 400) / 2)
                .attr('text-anchor', 'middle')
                .attr('fill', 'var(--danger)')
                .text('Error loading chart data');
        }

        // Provide fallback accessibility
        if (this.chartData) {
            try {
                const dataTable = this.accessibilityService.createDataTable(this.chartData as ChartData);
                console.log('Fallback data table:', dataTable);
            } catch (accessibilityError) {
                console.error('Failed to create accessibility fallback:', accessibilityError);
            }
        }
    }

    /**
     * Show tooltip for data point - shared implementation
     */
    protected showTooltip(event: any, data: any): void {
        if (!this.tooltip) {return;}

        // Find the series name from the event target
        const seriesIndex = this.extractSeriesIndex(event.target);
        const seriesName = this.chartData?.series[seriesIndex]?.name || 'Unknown';
        console.log(seriesName);

        const tooltipContent = this.generateTooltipContent(data, seriesName);

        this.tooltip
            .style('opacity', 1)
            .html(tooltipContent)
            .style('left', (event.offsetX + 10) + 'px')
            .style('top', (event.offsetY - 28) + 'px')
            .attr('aria-hidden', 'false');
    }

    /**
     * Hide tooltip - shared implementation
     */
    protected hideTooltip(): void {
        if (!this.tooltip) {return;}

        this.tooltip
            .style('opacity', 0)
            .attr('aria-hidden', 'true');
    }

    /**
     * Export chart data as CSV - shared implementation
     */
    public downloadChartData(): void {
        const csvContent = this.exportChartData();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.chartData?.title || `${this.getChartType()}-chart-data`}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
     * Export chart data as CSV string - shared implementation
     */
    protected exportChartData(): string {
        if (!this.chartData) {return '';}

        const headers = this.getCSVHeaders();
        const csvContent = headers.join(',') + '\n';

        return csvContent + this.generateCSVRows();
    }

    /**
     * Get table data for accessibility - shared implementation
     */
    public getTableData(): any[] {
        if (!this.chartData) {return [];}

        const maxLength = Math.max(...this.chartData.series.map(s => s.data.length));
        const tableData = [];

        for (let i = 0; i < maxLength; i++) {
            const firstSeriesPoint = this.chartData.series[0]?.data[i];
            if (firstSeriesPoint) {
                tableData.push({ x: firstSeriesPoint.x, index: i });
            }
        }

        return tableData;
    }

    /**
     * Get series value for accessibility table - shared implementation
     */
    public getSeriesValue(series: any, index: number): string {
        const point = series.data[index];
        return point ? point.y.toString() : '';
    }

    /**
     * Get performance metrics from renderer - shared implementation
     */
    public getPerformanceMetrics() {
        const renderer = this.getRenderer();
        return renderer ? renderer.getPerformanceMetrics() : null;
    }

    /**
     * Check if chart data is valid - shared implementation
     */
    public validateChartData(): boolean {
        if (!this.chartData) {return false;}

        const renderer = this.getRenderer();
        if (!renderer) {return false;}

        const validation = renderer.validateData(this.chartData);

        if (!validation.isValid) {
            console.error('Chart data validation failed:', validation.errors);
            return false;
        }

        if (validation.warnings.length > 0) {
            console.warn('Chart data validation warnings:', validation.warnings);
        }

        return true;
    }

    /**
     * Generate summary for screen reader announcements - shared implementation
     */
    private generateUpdateSummary(): string {
        if (!this.chartData) {return '';}

        const seriesCount = this.chartData.series.length;
        const totalPoints = this.chartData.series.reduce((sum, series) => sum + series.data.length, 0);

        return `Chart updated with ${seriesCount} series and ${totalPoints} data points`;
    }

    // Protected methods for subclasses to customize

    /**
     * Extract series index from event target - can be overridden by subclasses
     */
    protected extractSeriesIndex(target: any): number {
        // Default implementation - look for series-X class
        const classList = target.classList;
        for (let i = 0; i < classList.length; i++) {
            const className = classList[i];
            const match = className.match(/series-(\d+)/);
            if (match) {
                return parseInt(match[1]);
            }
        }
        return 0;
    }

    /**
     * Generate tooltip content - can be overridden by subclasses
     */
    protected generateTooltipContent(data: any, seriesName: string): string {
        return `<strong>${seriesName}</strong><br/>X: ${data.x}<br/>Y: ${data.y}`;
    }

    /**
     * Get CSV headers - can be overridden by subclasses
     */
    protected getCSVHeaders(): string[] {
        if (!this.chartData) return [];
        return ['X Value', ...this.chartData.series.map(s => s.name)];
    }

    /**
     * Generate CSV rows - can be overridden by subclasses
     */
    protected generateCSVRows(): string {
        if (!this.chartData) return '';

        const maxLength = Math.max(...this.chartData.series.map(s => s.data.length));
        let rows = '';

        for (let i = 0; i < maxLength; i++) {
            const row = [this.chartData.series[0]?.data[i]?.x || ''];
            for (const series of this.chartData.series) {
                row.push(series.data[i]?.y?.toString() || '');
            }
            rows += row.join(',') + '\n';
        }

        return rows;
    }

    /**
     * Get the chart renderer instance - must be implemented by subclasses
     */
    protected abstract getRenderer(): ChartRenderer<T> | null;

    /**
     * Get chart type identifier
     */
    protected abstract getChartType(): string;

    // Abstract methods - must be implemented by subclasses

    /**
     * Render the chart data - implemented by concrete chart types
     */
    protected abstract renderData(): void;

    /**
     * Update chart with new data - implemented by concrete chart types
     */
    protected abstract updateData(newData: T): void;

    /**
     * Handle window resize - implemented by concrete chart types
     */
    protected abstract handleResize(): void;

    /**
     * Cleanup resources - implemented by concrete chart types
     */
    protected abstract cleanup(): void;
}
