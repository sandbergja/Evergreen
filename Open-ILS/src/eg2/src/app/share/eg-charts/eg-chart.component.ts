import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild, HostListener, inject } from '@angular/core';
import { ChartData, ChartConfiguration, ChartPoint } from './interfaces/chart-data.interface';
import { LineChartRenderer } from './renderers/line-chart-renderer';
import { BarChartRenderer } from './renderers/bar-chart-renderer';
import { PieChartRenderer } from './renderers/pie-chart-renderer';
import { ColorService } from './services/color.service';
import { PatternService } from './services/pattern.service';
import * as d3 from 'd3';

@Component({
    selector: 'eg-chart',
    template: `
        <div class="eg-chart-container" [attr.aria-label]="chartData?.accessibility?.description">
            <div class="eg-chart-title" *ngIf="chartData?.title">
                <h2>{{ chartData?.title }}</h2>
                <div class="chart-actions">
                    <!--          <div class="chart-type-selector" *ngIf="allowChartTypeToggle">-->
                    <!--            <div class="btn-group" role="group" [attr.aria-label]="'Chart type selector for ' + chartData?.title">-->
                    <!--              <button *ngFor="let chartType of supportedChartTypes" -->
                    <!--                      type="button"-->
                    <!--                      class="btn btn-sm"-->
                    <!--                      [class.btn-primary]="currentChartType === chartType"-->
                    <!--                      [class.btn-outline-primary]="currentChartType !== chartType"-->
                    <!--                      (click)="onChartTypeChange(chartType)"-->
                    <!--                      [attr.aria-pressed]="currentChartType === chartType"-->
                    <!--                      [title]="getChartTypeLabel(chartType)">-->
                    <!--                <span class="material-icons" [attr.aria-hidden]="true">{{ getChartTypeIcon(chartType) }}</span>-->
                    <!--              </button>-->
                    <!--            </div>-->
                    <!--          </div>-->
                    <button
                        *ngIf="showExportButton"
                        type="button"
                        class="export-btn"
                        (click)="downloadChartData()"
                        [attr.aria-label]="'Export chart data for ' + chartData?.title"
                        title="Export chart data as CSV">
                        <span class="material-icons me-1" aria-hidden="true">download</span>
                        Export CSV
                    </button>
                </div>
            </div>

            <div class="eg-chart-main-content" [class.pie-chart-layout]="currentChartType === 'pie'">
                <div class="eg-chart-wrapper" #chartWrapper>
                    <svg #chartSvg
                         [attr.viewBox]="'0 0 ' + config.width + ' ' + config.height"
                         [attr.aria-describedby]="chartData?.accessibility?.longDescription ? 'chart-long-desc' : null">
                        <defs></defs>
                        <title>{{ chartData?.accessibility?.description }}</title>
                        <desc *ngIf="chartData?.accessibility?.longDescription" id="chart-long-desc">
                            {{ chartData?.accessibility?.longDescription }}
                        </desc>
                    </svg>
                </div>

                <!-- External Legend for Pie Chart -->
                <div *ngIf="currentChartType === 'pie' && chartData" class="eg-chart-legend-wrapper">
                    <ul class="eg-chart-legend">
                        <li *ngFor="let point of chartData.series[0].data; let i = index"
                            class="eg-chart-legend-item"
                            (mouseover)="highlightSlice($event, i, false)"
                            (mouseout)="unhighlightSlice($event, i)"
                            (focus)="highlightSlice($event, i, false)"
                            (blur)="unhighlightSlice($event, i)"
                            tabindex="0">
                            <span class="legend-color-swatch" [style.background-color]="point.color || getSliceColor(i)"></span>
                            <span class="legend-label">{{ point.x }}</span>
                            <span class="legend-value">{{ getSlicePercentage(point) }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <!-- Accessible data table -->
            <div *ngIf="chartData?.accessibility?.dataTable" class="eg-chart-data-table sr-only">
                <table>
                    <caption>{{ chartData?.accessibility?.description }}</caption>
                    <thead>
                    <tr>
                        <th scope="col">{{ chartData?.xAxisLabel || 'X Value' }}</th>
                        <th scope="col" *ngFor="let series of chartData?.series">{{ series.name }}</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr *ngFor="let point of getTableData(); let i = index">
                        <td>{{ point.x }}</td>
                        <td *ngFor="let series of chartData?.series">
                            {{ getSeriesValue(series, i) }}
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    styleUrls: ['./eg-chart.component.css']
})
export class EgChartComponent implements OnInit, OnDestroy {
    @Input() type: 'line' | 'bar' | 'pie' = 'line';
    @Input() chartData: ChartData | null = null;
    @Input() config: ChartConfiguration = {
        width: 800,
        height: 400,
        margin: { top: 20, right: 20, bottom: 40, left: 40 },
        showGrid: true,
        showTooltip: true,
        animated: true
    };
    @Input() allowChartTypeToggle: boolean = false;
    @Input() supportedChartTypes: ('line' | 'bar' | 'pie')[] = ['line', 'bar', 'pie'];
    @Input() showExportButton: boolean = true;

    @Output() chartTypeChanged = new EventEmitter<'line' | 'bar' | 'pie'>();

    currentChartType: 'line' | 'bar' | 'pie' = 'line';

    @ViewChild('chartSvg', { static: true }) chartSvg!: ElementRef<SVGElement>;
    @ViewChild('chartWrapper', { static: true }) chartWrapper!: ElementRef<HTMLDivElement>;

    private svg: d3.Selection<SVGElement, unknown, null, undefined> | null = null;
    private tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
    private resizeObserver!: ResizeObserver;

    // Inject all renderers and services
    private lineRenderer = inject(LineChartRenderer);
    private barRenderer = inject(BarChartRenderer);
    private pieRenderer = inject(PieChartRenderer);
    private colorService = inject(ColorService);
    private patternService = inject(PatternService);

    ngOnInit(): void {
        this.currentChartType = this.type;
        this.initializeChart();
        this.setupResizeObserver();
    }

    ngOnDestroy(): void {
        if (this.tooltip) {
            this.tooltip.remove();
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
    }

    private setupResizeObserver(): void {
        this.resizeObserver = new ResizeObserver(() => {
            this.updateChart();
        });
        this.resizeObserver.observe(this.chartWrapper.nativeElement);
    }

    private initializeChart(): void {
        if (!this.chartData) {return;}

        this.svg = d3.select(this.chartSvg.nativeElement);
        this.createTooltip();
        this.drawChart();
    }

    private createTooltip(): void {
        if (!this.config.showTooltip) {return;}

        this.tooltip = d3.select(this.chartWrapper.nativeElement)
            .append('div')
            .attr('class', 'eg-chart-tooltip')
            .style('opacity', 0)
            .style('position', 'absolute')
            .style('background', 'var(--bs-dark, #212529)')
            .style('color', 'var(--bs-white, #ffffff)')
            .style('padding', '8px 12px')
            .style('border-radius', '4px')
            .style('pointer-events', 'none')
            .style('font-size', '12px')
            .style('box-shadow', '0 4px 12px rgba(0, 0, 0, 0.25)')
            .style('max-width', '250px')
            .style('line-height', '1.4')
            .attr('role', 'tooltip')
            .attr('aria-hidden', 'true');

    }

    private async drawChart(): Promise<void> {
        if (!this.chartData || !this.svg || !this.chartWrapper) { return; }

        const wrapperElement = this.chartWrapper.nativeElement;
        const width = wrapperElement.clientWidth;
        const height = wrapperElement.clientHeight;

        // Do not render if the container has no size
        if (width === 0 || height === 0) {
            return;
        }

        try {
            // For pie charts, we want a square aspect ratio, so we use the smaller of the two dimensions.
            if (this.currentChartType === 'pie') {
                const size = Math.min(width, height);
                this.config.width = size;
                this.config.height = size;
            } else {
                this.config.width = width;
                this.config.height = height;
            }

            // Update the viewBox to match the new dimensions
            this.svg.attr('viewBox', `0 0 ${this.config.width} ${this.config.height}`);

            // Clear existing content
            this.svg.selectAll('*').remove();

            // Delegate to appropriate renderer based on current type, passing the now-updated config
            switch (this.currentChartType) {
                case 'line':
                    await this.lineRenderer.render(this.chartData, this.svg, this.config);
                    break;
                case 'bar':
                    await this.barRenderer.render(this.chartData, this.svg, this.config);
                    break;
                case 'pie':
                    await this.pieRenderer.render(this.chartData, this.svg, this.config);
                    break;
                default:
                    console.error(`Unsupported chart type: ${this.currentChartType}`);
            }

            // Bind tooltip events after rendering
            this.bindTooltipEvents();
        } catch (error) {
            console.error(`Error rendering ${this.type} chart:`, error);
        }
    }


    async updateChart(): Promise<void> {
        await this.drawChart();
    }

    private bindTooltipEvents(): void {
        if (!this.svg || !this.tooltip || !this.config.showTooltip) {return;}

        // Bind tooltip events based on chart type
        if (this.currentChartType === 'line') {
            this.bindLineTooltipEvents();
        } else if (this.currentChartType === 'bar') {
            this.bindBarTooltipEvents();
        } else if (this.currentChartType === 'pie') {
            this.bindPieTooltipEvents();
        }
    }

    private bindLineTooltipEvents(): void {
        if (!this.svg || !this.tooltip) {return;}

        this.svg.selectAll('.point')
            .on('mouseover', (event: any, d: any) => {
                this.showTooltip(event, d);
            })
            .on('mouseout', () => {
                this.hideTooltip();
            })
            .on('focus', (event: any, d: any) => {
                this.showTooltip(event, d);
            })
            .on('blur', () => {
                this.hideTooltip();
            });
    }

    private bindBarTooltipEvents(): void {
        if (!this.svg || !this.tooltip) {return;}

        this.svg.selectAll('.bar')
            .on('mouseover', (event: any, d: any) => {
                this.showTooltip(event, d);
            })
            .on('mouseout', () => {
                this.hideTooltip();
            })
            .on('focus', (event: any, d: any) => {
                this.showTooltip(event, d);
            })
            .on('blur', () => {
                this.hideTooltip();
            });
    }

    private bindPieTooltipEvents(): void {
        if (!this.svg || !this.tooltip) {return;}

        this.svg.selectAll('.arc')
            .on('mouseover', (event: any, d: any) => {
                const index = d3.select(event.currentTarget).attr('class')?.match(/slice-(\d+)/)?.[1];
                this.highlightSlice(event, Number(index), true); // Show tooltip for pie slice hover
                this.showTooltip(event, d);
            })
            .on('mouseout', (event: any) => {
                const index = d3.select(event.currentTarget).attr('class')?.match(/slice-(\d+)/)?.[1];
                this.unhighlightSlice(event, Number(index));
                this.hideTooltip();
            })
            .on('focus', (event: any, d: any) => {
                const index = d3.select(event.currentTarget).attr('class')?.match(/slice-(\d+)/)?.[1];
                this.highlightSlice(event, Number(index), true); // Show tooltip for pie slice focus
                this.showTooltip(event, d);
            })
            .on('blur', (event: any) => {
                const index = d3.select(event.currentTarget).attr('class')?.match(/slice-(\d+)/)?.[1];
                this.unhighlightSlice(event, Number(index));
                this.hideTooltip();
            });
    }

    private showTooltip(event: any, data: any): void {
        if (!this.tooltip) {return;}

        // Format tooltip content based on chart type and data
        let content = '';
        if (this.currentChartType === 'line') {
            const date = data.x instanceof Date ? data.x.toLocaleDateString() : data.x;
            const series = this.chartData?.series?.find(s => s?.data.includes(data));
            const seriesName = series?.name || 'Value';
            content = `<strong>${seriesName}</strong><br/>\n                     <strong>Date:</strong> ${date}<br/>\n                     <strong>Count:</strong> ${data.y?.toLocaleString() || data.y}`;
        } else if (this.currentChartType === 'bar') {
           const series = this.chartData?.series?.find(s => s?.data.includes(data));
            const seriesName = series?.name || 'Value';
            content = `<strong>${seriesName}</strong><br/>\n                     <strong>${data.x}:</strong> ${data.y?.toLocaleString() || data.y}`;
        } else if (this.currentChartType === 'pie') {
            const percentage = this.getSlicePercentage(data.data);
            content = `<strong>${data.data.x}</strong><br/>\n                     <strong>Count:</strong> ${data.data.y?.toLocaleString() || data.data.y}<br/>\n                     <strong>Percentage:</strong> ${percentage}`;
        }

        // Set content first to calculate dimensions
        this.tooltip
            .html(content)
            .style('opacity', 1)
            .attr('aria-hidden', 'false');

        // Calculate smart positioning
        const containerRect = this.chartWrapper.nativeElement.getBoundingClientRect();
        const tooltipRect = (this.tooltip.node() as HTMLElement).getBoundingClientRect();

        // Get cursor position relative to container
        const cursorX = event.clientX - containerRect.left;
        const cursorY = event.clientY - containerRect.top;

        // Buffer from edges
        const buffer = 15;

        // Calculate default position (right + above cursor)
        let x = cursorX + 10;
        let y = cursorY - 10;

        // Check right edge - if tooltip would go off-screen, position to left
        if (x + tooltipRect.width + buffer > containerRect.width) {
            x = cursorX - tooltipRect.width - 10;
        }

        // Check left edge - ensure tooltip doesn't go off left side
        if (x < buffer) {
            x = buffer;
        }

        // Check top edge - if tooltip would go above container, position below
        if (y < buffer) {
            y = cursorY + 10;
        }

        // Check bottom edge - if tooltip would go below container, position above
        if (y + tooltipRect.height + buffer > containerRect.height) {
            y = cursorY - tooltipRect.height - 10;
        }

        // Apply final position
        this.tooltip
            .style('left', x + 'px')
            .style('top', y + 'px');
    }

    private hideTooltip(): void {
        if (!this.tooltip) {return;}

        this.tooltip
            .style('opacity', 0)
            .attr('aria-hidden', 'true');
    }

    // Export functionality for accessibility and reporting
    exportChartData(): string {
        if (!this.chartData) {return '';}

        const headers = ['X Value', ...this.chartData.series.map(s => s.name)];
        const maxLength = Math.max(...this.chartData.series.map(s => s.data.length));

        let csvContent = headers.join(',') + '\n';

        for (let i = 0; i < maxLength; i++) {
            const row = [this.chartData.series[0]?.data[i]?.x || ''];
            for (const series of this.chartData.series) {
                row.push(series.data[i]?.y?.toString() || '');
            }
            csvContent += row.join(',') + '\n';
        }

        return csvContent;
    }

    downloadChartData(): void {
        const csvContent = this.exportChartData();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.chartData?.title || 'chart-data'}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Helper methods for accessible data table
    getTableData(): any[] {
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

    getSeriesValue(series: any, index: number): string {
        const point = series.data[index];
        return point ? point.y.toString() : '';
    }

    // --- Pie Chart Specific Helpers ---

    getSliceColor(index: number): string {
        return this.colorService.getAccessibleColor(index);
    }

    getSlicePercentage(point: ChartPoint): string {
        if (!this.chartData) { return '0%'; }
        const total = this.chartData.series[0].data.reduce((sum, p) => sum + p.y, 0);
        if (total === 0) { return '0%'; }
        const percentage = (point.y / total) * 100;
        return `${percentage.toFixed(1)}%`;
    }

    highlightSlice(event: MouseEvent | FocusEvent, index: number, showTooltip: boolean): void {
        if (!this.svg) { return; }
        this.svg.selectAll('.arc').classed('dimmed', true);
        const slice = this.svg.select(`.slice-${index}`).classed('dimmed', false).classed('highlighted', true);

        // Only show tooltip if explicitly requested (from slice hover, not legend hover)
        if (showTooltip) {
            const sliceData = slice.datum();
            this.showTooltip(event, sliceData);
        }
    }

    unhighlightSlice(event: MouseEvent | FocusEvent, index: number): void {
        if (!this.svg) { return; }
        this.svg.selectAll('.arc').classed('dimmed', false).classed('highlighted', false);
        // Always hide tooltip when unhighlighting
        this.hideTooltip();
    }

    // --- Chart Type Selector Methods ---

    onChartTypeChange(newType: 'line' | 'bar' | 'pie'): void {
        if (this.currentChartType !== newType) {
            this.currentChartType = newType;
            this.chartTypeChanged.emit(newType);
            this.drawChart(); // Re-render with new chart type
        }
    }

    getChartTypeIcon(type: 'line' | 'bar' | 'pie'): string {
        switch (type) {
            case 'line':
                return 'show_chart';
            case 'bar':
                return 'bar_chart';
            case 'pie':
                return 'pie_chart';
            default:
                return 'show_chart';
        }
    }

    getChartTypeLabel(type: 'line' | 'bar' | 'pie'): string {
        switch (type) {
            case 'line':
                return 'Line Chart';
            case 'bar':
                return 'Bar Chart';
            case 'pie':
                return 'Pie Chart';
            default:
                return 'Chart';
        }
    }

    isChartTypeSupported(type: 'line' | 'bar' | 'pie'): boolean {
        return this.supportedChartTypes.includes(type);
    }

    // --- Accessibility Pattern Methods ---


    getAvailablePatterns() {
        return this.patternService.getAvailablePatterns();
    }

    /**
     * Get performance metrics for the current chart
     */
    getPerformanceMetrics(): any {
        switch (this.currentChartType) {
            case 'line':
                return this.lineRenderer.getPerformanceMetrics();
            case 'bar':
                return this.barRenderer.getPerformanceMetrics();
            case 'pie':
                return this.pieRenderer.getPerformanceMetrics();
            default:
                return {
                    renderTime: 0,
                    memoryUsage: 0,
                    dataPointCount: this.chartData?.series?.[0]?.data?.length || 0
                };
        }
    }
}
