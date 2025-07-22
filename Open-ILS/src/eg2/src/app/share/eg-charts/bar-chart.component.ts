import { Component, inject } from '@angular/core';
import { BaseChartComponent } from './base-chart.component';
import { BarChartRenderer } from './renderers/bar-chart-renderer';
import { ChartData } from './interfaces/chart-data.interface';

/**
 * BarChartComponent - Concrete Chart Implementation
 *
 * This component extends BaseChartComponent and implements the abstract methods
 * specific to bar chart rendering using the BarChartRenderer strategy.
 */
@Component({
    selector: 'eg-bar-chart',
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
             [attr.aria-describedby]="chartData?.accessibility?.longDescription ? 'chart-long-desc' : null"
             role="img">
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
              <th scope="col">{{ chartData?.xAxisLabel || 'Category' }}</th>
              <th scope="col" *ngFor="let series of chartData?.series">{{ series.name }}</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let category of getCategories()">
              <td>{{ category }}</td>
              <td *ngFor="let series of chartData?.series">
                {{ getSeriesValue(series, category) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
    styleUrls: ['./eg-chart.component.css']
})
export class BarChartComponent extends BaseChartComponent<ChartData> {

    // Inject bar chart renderer
    private barChartRenderer = inject(BarChartRenderer);

    /**
   * Get chart type identifier
   */
    protected getChartType(): string {
        return 'bar';
    }


    /**
   * Render chart data - implemented for bar charts
   */
    protected renderData(): void {
        if (!this.chartData || !this.svg) {return;}

        this.barChartRenderer.render(this.chartData, this.svg, this.config)
            .catch(error => {
                console.error('Bar chart rendering failed:', error);
                this.handleChartError(error);
            });
    }

    /**
   * Update chart with new data - implemented for bar charts
   */
    protected updateData(newData: ChartData): void {
        if (!this.svg) {return;}

        this.barChartRenderer.update(newData, this.svg)
            .catch(error => {
                console.error('Bar chart update failed:', error);
                this.handleChartError(error);
            });
    }

    /**
   * Handle window resize - implemented for bar charts
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
   * Cleanup resources - implemented for bar charts
   */
    protected cleanup(): void {
        if (this.svg) {
            this.barChartRenderer.destroy(this.svg);
        }

        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        this.isInitialized = false;
    }

    /**
   * Enhanced accessibility binding for bar charts
   */
    protected override bindEvents(): void {
        super.bindEvents();

        if (!this.svg) {return;}

        // Add bar chart specific event handlers
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

    /**
   * Show tooltip for bar
   */
    private showTooltip(event: any, _data: any): void {
        if (!this.tooltip) {return;}

        // Extract series information from the bar element
        const seriesClass = event.target.getAttribute('class');
        const seriesIndex = seriesClass ? parseInt(seriesClass.match(/series-(\d+)/)?.[1] || '0') : 0;
        const seriesName = this.chartData?.series[seriesIndex]?.name || 'Unknown';

        // Get category and value from aria-label
        const ariaLabel = event.target.getAttribute('aria-label') || '';
        const [, categoryValue] = ariaLabel.split(': ');
        const [category, value] = categoryValue ? categoryValue.split(', ') : ['', ''];

        this.tooltip
            .style('opacity', 1)
            .html(`<strong>${seriesName}</strong><br/>${category}: ${value}`)
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
            link.setAttribute('download', `${this.chartData?.title || 'bar-chart-data'}.csv`);
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

        const categories = this.getCategories();
        const headers = ['Category', ...this.chartData.series.map(s => s.name)];

        let csvContent = headers.join(',') + '\n';

        categories.forEach(category => {
            const row = [category];
      this.chartData!.series.forEach(series => {
          const point = series.data.find(d => String(d.x) === category);
          row.push(point ? point.y.toString() : '0');
      });
      csvContent += row.join(',') + '\n';
        });

        return csvContent;
    }

    /**
   * Get all categories for accessibility table
   */
    public getCategories(): string[] {
        if (!this.chartData) {return [];}

        const categories = new Set<string>();
        this.chartData.series.forEach(series => {
            series.data.forEach(point => {
                categories.add(String(point.x));
            });
        });

        return Array.from(categories).sort();
    }

    /**
   * Get series value for accessibility table
   */
    public getSeriesValue(series: any, category: string): string {
        const point = series.data.find((d: any) => String(d.x) === category);
        return point ? point.y.toString() : '0';
    }

    /**
   * Get performance metrics from renderer
   */
    public getPerformanceMetrics() {
        return this.barChartRenderer.getPerformanceMetrics();
    }

    /**
   * Check if chart data is valid
   */
    public validateChartData(): boolean {
        if (!this.chartData) {return false;}

        const validation = this.barChartRenderer.validateData(this.chartData);

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
