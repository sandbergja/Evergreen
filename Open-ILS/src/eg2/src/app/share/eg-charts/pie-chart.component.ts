import { Component, inject } from '@angular/core';
import { BaseChartComponent } from './base-chart.component';
import { PieChartRenderer } from './renderers/pie-chart-renderer';
import { ChartData } from './interfaces/chart-data.interface';
import { ChartRenderer } from './interfaces/chart-renderer.interface';

/**
 * PieChartComponent - Concrete Chart Implementation
 *
 * This component extends BaseChartComponent and implements the abstract methods
 * specific to pie chart rendering using the PieChartRenderer strategy.
 */
@Component({
    selector: 'eg-pie-chart',
    template: `
        <div class="eg-chart-container"
             [attr.aria-label]="chartData?.accessibility?.description">

            <!-- Chart Title -->
            <div class="eg-chart-title" *ngIf="chartData?.title">
                <h2>{{ chartData?.title }}</h2>
                <div class="chart-actions">
                    <button
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

            <!-- Chart Container -->
            <div class="eg-chart-wrapper pie-chart" #chartWrapper>
                <svg #chartSvg
                     [attr.width]="config.width"
                     [attr.height]="config.height"
                     [attr.aria-describedby]="chartData?.accessibility?.longDescription ? 'chart-long-desc' : null">
                    <title>{{ chartData?.accessibility?.description }}</title>
                    <desc *ngIf="chartData?.accessibility?.longDescription" id="chart-long-desc">
                        {{ chartData?.accessibility?.longDescription }}
                    </desc>
                </svg>
            </div>

            <!-- Accessible data table -->
            <div *ngIf="chartData?.accessibility?.dataTable" class="eg-chart-data-table sr-only">
                <table>
                    <caption>{{ chartData?.accessibility?.description }}</caption>
                    <thead>
                    <tr>
                        <th scope="col">Label</th>
                        <th scope="col">Value</th>
                        <th scope="col">Percentage</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr *ngFor="let point of getDataPoints()">
                        <td>{{ point.label }}</td>
                        <td>{{ point.value }}</td>
                        <td>{{ point.percentage }}%</td>
                    </tr>
                    </tbody>
                </table>
            </div>
        </div>
    `,
    styleUrls: ['./eg-chart.component.css']
})
export class PieChartComponent extends BaseChartComponent<ChartData> {

    // Inject pie chart renderer
    private pieChartRenderer = inject(PieChartRenderer);

    /**
     * Get the chart renderer instance
     */
    protected getRenderer(): ChartRenderer<ChartData> {
        return this.pieChartRenderer;
    }

    /**
     * Get chart type identifier
     */
    protected getChartType(): string {
        return 'pie';
    }

    /**
     * Render chart data - implemented for pie charts
     */
    protected renderData(): void {
        if (!this.chartData || !this.svg) {return;}

        this.pieChartRenderer.render(this.chartData, this.svg, this.config)
            .catch(error => {
                console.error('Pie chart rendering failed:', error);
                this.handleChartError(error);
            });
    }

    /**
     * Update chart with new data - implemented for pie charts
     */
    protected updateData(newData: ChartData): void {
        if (!this.svg) {return;}

        this.pieChartRenderer.update(newData, this.svg)
            .catch(error => {
                console.error('Pie chart update failed:', error);
                this.handleChartError(error);
            });
    }

    /**
     * Handle window resize - implemented for pie charts
     */
    protected handleResize(): void {
        if (!this.chartData) {return;}

        // Update chart dimensions
        this.config = {
            ...this.config,
            width: this.chartWrapper?.nativeElement.clientWidth || this.config.width,
            height: this.chartWrapper?.nativeElement.clientHeight || this.config.height
        };

        // Re-render with new dimensions
        this.renderData();
    }

    /**
     * Cleanup resources - implemented for pie charts
     */
    protected cleanup(): void {
        if (this.svg) {
            this.pieChartRenderer.destroy(this.svg);
        }

        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        this.isInitialized = false;
    }

    /**
     * Enhanced accessibility binding for pie charts
     */
    protected override bindEvents(): void {
        super.bindEvents();

        if (!this.svg) {return;}

        // Add pie chart specific event handlers
        this.svg.selectAll('.slice-path')
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

    /**
     * Generate tooltip content for pie charts
     */
    protected override generateTooltipContent(data: any, _seriesName: string): string {
        const series = this.chartData?.series[0];
        const seriesName = series?.name || 'Data';
        const label = data.data.x;
        const value = data.data.y;

        // Calculate percentage
        const total = series?.data.reduce((sum, point) => sum + point.y, 0) || 1;
        const percentage = ((value / total) * 100).toFixed(1);

        return `<strong>${seriesName}</strong><br/>${label}: ${value}<br/>${percentage}%`;
    }

    /**
     * Get CSV headers for pie charts
     */
    protected override getCSVHeaders(): string[] {
        return ['Label', 'Value', 'Percentage'];
    }

    /**
     * Generate CSV rows for pie charts
     */
    protected override generateCSVRows(): string {
        if (!this.chartData) {return '';}

        const dataPoints = this.getDataPoints();
        let rows = '';

        dataPoints.forEach(point => {
            const row = [point.label, point.value.toString(), point.percentage.toString()];
            rows += row.join(',') + '\n';
        });

        return rows;
    }

    /**
     * Get data points with calculated percentages for accessibility table
     */
    public getDataPoints(): {label: string, value: number, percentage: string}[] {
        if (!this.chartData || !this.chartData.series[0]) {return [];}

        const series = this.chartData.series[0];
        const total = series.data.reduce((sum, point) => sum + point.y, 0);

        return series.data.map(point => ({
            label: point.x?.toString() || '',
            value: point.y,
            percentage: ((point.y / total) * 100).toFixed(1)
        }));
    }
}
