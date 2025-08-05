import { Component, inject } from '@angular/core';
import { BaseChartComponent } from './base-chart.component';
import { LineChartRenderer } from './renderers/line-chart-renderer';
import { ChartData } from './interfaces/chart-data.interface';

/**
 * LineChartComponent - Concrete Chart Implementation
 *
 * This component extends BaseChartComponent and implements the abstract methods
 * specific to line chart rendering using the LineChartRenderer strategy.
 */
@Component({
    selector: 'eg-line-chart',
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
      <div class="eg-chart-wrapper" #chartWrapper>
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
export class LineChartComponent extends BaseChartComponent<ChartData> {

    // Inject line chart renderer
    private lineChartRenderer = inject(LineChartRenderer);

    /**
   * Get chart type identifier
   */
    protected getChartType(): string {
        return 'line';
    }

    /**
   * Render chart data - implemented for line charts
   */
    protected renderData(): void {
        if (!this.chartData || !this.svg) {return;}

        this.lineChartRenderer.render(this.chartData, this.svg, this.config)
            .catch(error => {
                console.error('Line chart rendering failed:', error);
                this.handleChartError(error);
            });
    }

    /**
   * Update chart with new data - implemented for line charts
   */
    protected updateData(newData: ChartData): void {
        if (!this.svg) {return;}

        this.lineChartRenderer.update(newData, this.svg)
            .catch(error => {
                console.error('Line chart update failed:', error);
                this.handleChartError(error);
            });
    }

    /**
   * Handle window resize - implemented for line charts
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
   * Cleanup resources - implemented for line charts
   */
    protected cleanup(): void {
        if (this.svg) {
            this.lineChartRenderer.destroy(this.svg);
        }

        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        this.isInitialized = false;
    }

    /**
   * Enhanced accessibility binding for line charts
   */
    protected override bindEvents(): void {
        super.bindEvents();

        if (!this.svg) {return;}

        // Add line chart specific event handlers
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

    /**
   * Show tooltip for data point
   */
    private showTooltip(event: any, data: any): void {
        if (!this.tooltip) {return;}

        // Find the series name from the event target
        const seriesIndex = event.target.classList.contains('point-0') ? 0 :
            event.target.classList.contains('point-1') ? 1 :
                event.target.classList.contains('point-2') ? 2 : 0;

        const seriesName = this.chartData?.series[seriesIndex]?.name || 'Unknown';

        this.tooltip
            .style('opacity', 1)
            .html(`<strong>${seriesName}</strong><br/>X: ${data.x}<br/>Y: ${data.y}`)
            .style('left', (event.offsetX + 10) + 'px')
            .style('top', (event.offsetY - 28) + 'px')
            .attr('aria-hidden', 'false');
    }

    /**
   * Hide tooltip
   */
    private hideTooltip(): void {
        if (!this.tooltip) {return;}

        this.tooltip
            .style('opacity', 0)
            .attr('aria-hidden', 'true');
    }

    /**
   * Export chart data as CSV
   */
    public downloadChartData(): void {
        const csvContent = this.exportChartData();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${this.chartData?.title || 'line-chart-data'}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    /**
   * Export chart data as CSV string
   */
    private exportChartData(): string {
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

    /**
   * Get table data for accessibility
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
   * Get series value for accessibility table
   */
    public getSeriesValue(series: any, index: number): string {
        const point = series.data[index];
        return point ? point.y.toString() : '';
    }

    /**
   * Get performance metrics from renderer
   */
    public getPerformanceMetrics() {
        return this.lineChartRenderer.getPerformanceMetrics();
    }

    /**
   * Check if chart data is valid
   */
    public validateChartData(): boolean {
        if (!this.chartData) {return false;}

        const validation = this.lineChartRenderer.validateData(this.chartData);

        if (!validation.isValid) {
            console.error('Chart data validation failed:', validation.errors);
            return false;
        }

        if (validation.warnings.length > 0) {
            console.warn('Chart data validation warnings:', validation.warnings);
        }

        return true;
    }
}
