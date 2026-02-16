import { Component, Input, OnInit } from '@angular/core';
import { WidgetJsonConfig } from '@eg/staff/dashboard/interfaces/widget-json-config.interface';

/**
 * JsonWidgetComponent - Generic JSON Widget Router
 *
 * This is the single entry point for all JSON-driven widgets.
 * It routes to the appropriate widget type (chart or metric) based on
 * the JSON configuration.
 *
 * Usage:
 * ```html
 * <eg-json-widget [config]="myWidgetConfig"></eg-json-widget>
 * ```
 *
 * The config determines whether it renders as:
 * - Chart widget (bar, line, pie)
 * - Metric widget (single KPI value)
 *
 * This is the component you'll use in templates - it handles all the routing logic.
 */
@Component({
    selector: 'eg-json-widget',
    template: `
        <div class="eg-json-widget-container">
            <!-- Error: No Configuration -->
            <div *ngIf="!config" class="alert alert-danger">
                <span class="material-icons me-2">error</span>
                <strong>Error:</strong> No widget configuration provided
            </div>

            <!-- Error: Invalid Configuration -->
            <div *ngIf="config && !isValidConfig()" class="alert alert-warning">
                <span class="material-icons me-2">warning</span>
                <strong>Warning:</strong> Invalid widget configuration
                <ul class="mb-0 mt-2">
                    <li *ngFor="let error of getConfigErrors()">{{ error }}</li>
                </ul>
            </div>

            <!-- Route to Chart Widget -->
            <eg-json-chart-widget
                *ngIf="config && isChartWidget()"
                [config]="config"
                [showHeader]="showHeader"
                [showDebugInfo]="showDebugInfo">
            </eg-json-chart-widget>

            <!-- Route to Metric Widget -->
            <eg-json-metric-widget
                *ngIf="config && isMetricWidget()"
                [config]="config"
                [showHeader]="showHeader"
                [showTopIcon]="showTopIcon"
                [showDebugInfo]="showDebugInfo">
            </eg-json-metric-widget>

            <!-- Development Helper: Show Config -->
            <div *ngIf="showConfigHelper" class="config-helper mt-2">
                <details>
                    <summary class="text-muted small">Widget Configuration</summary>
                    <pre class="small">{{ getConfigJson() }}</pre>
                </details>
            </div>
        </div>
    `,
    styles: [`
        .eg-json-widget-container {
            width: 100%;
            height: 100%;
        }

        .alert {
            display: flex;
            align-items: start;
            margin: 1rem;
        }

        .alert ul {
            list-style-position: inside;
            padding-left: 0;
        }

        .config-helper {
            padding: 0.5rem 1rem;
            border-top: 1px solid var(--bs-border-color-translucent);
            background: var(--bs-light, #f8f9fa);
        }

        .config-helper summary {
            cursor: pointer;
            user-select: none;
            font-weight: 500;
        }

        .config-helper pre {
            margin: 0.5rem 0 0 0;
            padding: 0.75rem;
            background: white;
            border: 1px solid var(--bs-border-color);
            border-radius: 0.25rem;
            max-height: 400px;
            overflow: auto;
            font-size: 0.75rem;
            line-height: 1.4;
        }
    `]
})
export class JsonWidgetComponent implements OnInit {

    @Input() config!: WidgetJsonConfig;
    @Input() showHeader = true;
    @Input() showTopIcon = true;
    @Input() showDebugInfo = false;
    @Input() showConfigHelper = false; // Show configuration in development

    ngOnInit(): void {
        if (!this.config) {
            console.error('JsonWidgetComponent: No configuration provided');
            return;
        }

        if (!this.isValidConfig()) {
            console.error('JsonWidgetComponent: Invalid configuration:', this.getConfigErrors());
        }
    }

    /**
     * Check if this is a chart widget
     */
    public isChartWidget(): boolean {
        return this.config?.type === 'chart';
    }

    /**
     * Check if this is a metric widget
     */
    public isMetricWidget(): boolean {
        return this.config?.type === 'metric';
    }

    /**
     * Validate configuration
     */
    public isValidConfig(): boolean {
        return this.getConfigErrors().length === 0;
    }

    /**
     * Get configuration errors
     */
    public getConfigErrors(): string[] {
        const errors: string[] = [];

        if (!this.config) {
            errors.push('Configuration is required');
            return errors;
        }

        // Basic validation
        if (!this.config.id) {
            errors.push('Widget ID is required');
        }

        if (!this.config.name) {
            errors.push('Widget name is required');
        }

        if (!this.config.type) {
            errors.push('Widget type is required');
        } else if (!['chart', 'metric'].includes(this.config.type)) {
            errors.push(`Invalid widget type: ${this.config.type}. Must be 'chart' or 'metric'`);
        }

        // Data source validation
        if (!this.config.dataSource) {
            errors.push('Data source configuration is required');
        } else {
            if (!this.config.dataSource.service) {
                errors.push('Data source service is required');
            }
            if (!this.config.dataSource.method) {
                errors.push('Data source method is required');
            }
        }

        // Transform validation
        if (!this.config.transform) {
            errors.push('Transform configuration is required');
        } else {
            if (!this.config.transform.type) {
                errors.push('Transform type is required');
            }
            if (!this.config.transform.yField) {
                errors.push('Transform yField is required');
            }
        }

        // Visualization validation
        if (!this.config.visualization) {
            errors.push('Visualization configuration is required');
        } else {
            if (!this.config.visualization.chartType) {
                errors.push('Visualization chartType is required');
            }
            if (!this.config.visualization.title) {
                errors.push('Visualization title is required');
            }

            // Type-specific validation
            if (this.config.type === 'chart') {
                if (!['bar', 'line', 'pie'].includes(this.config.visualization.chartType)) {
                    errors.push(`Invalid chart type for chart widget: ${this.config.visualization.chartType}`);
                }
            } else if (this.config.type === 'metric') {
                if (this.config.visualization.chartType !== 'metric') {
                    errors.push('Metric widget must have chartType="metric"');
                }
            }
        }

        return errors;
    }

    /**
     * Get configuration as formatted JSON string
     */
    public getConfigJson(): string {
        if (!this.config) {
            return 'No configuration';
        }

        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Get widget type display name
     */
    public getWidgetTypeDisplay(): string {
        if (!this.config?.type) {return 'Unknown';}

        return this.config.type.charAt(0).toUpperCase() + this.config.type.slice(1);
    }

    /**
     * Get widget summary for logging
     */
    public getWidgetSummary(): string {
        if (!this.config) {return 'No configuration';}

        return `${this.getWidgetTypeDisplay()} Widget: ${this.config.name} (${this.config.id})`;
    }
}
