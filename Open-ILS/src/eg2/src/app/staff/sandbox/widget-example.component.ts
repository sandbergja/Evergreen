import { Component, OnInit } from '@angular/core';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { DashboardService } from '@eg/staff/dashboard/dashboard.service';
import { WidgetRegistryService } from '@eg/share/widgets/services/widget-registry.service';

/**
 * WidgetExampleComponent - Example Usage of the Widget System
 *
 * This component demonstrates how to use the new widget system
 * to create and display circulation widgets in your Angular components.
 *
 * Features demonstrated:
 * - Creating widgets from templates
 * - Customizing widget configurations
 * - Handling widget events
 * - Widget lifecycle management
 */
@Component({
    selector: 'eg-widget-example',
    template: `
        <div class="container-fluid">
            <div class="row">
                <div class="col-12">
                    <h2>
                        <i class="fas fa-chart-bar text-primary me-2"></i>
                        Widget System Example
                    </h2>
                    <p class="text-muted">
                        This example demonstrates the new widget system with circulation data visualization.
                    </p>
                </div>
            </div>

            <!-- Widget Configuration Controls -->
            <div class="row mb-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">
                                <i class="fas fa-cog me-2"></i>
                                Widget Configuration
                            </h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3">
                                    <label class="form-label">Time Range</label>
                                        <option value="week">Last Week</option>
                                        <option value="month">Last Month</option>
                                        <option value="quarter">Last Quarter</option>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Widget Template</label>
                                        <option value="">Select a template...</option>
                                        <option *ngFor="let template of availableTemplates"
                                                [value]="template.id">
                                            {{ template.name }}
                                        </option>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Auto Refresh</label>
                                    <div class="form-check form-switch">
                                        <label class="form-check-label" for="autoRefreshSwitch">
                                            Enable Auto Refresh
                                        </label>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label">Actions</label>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-sm btn-primary"
                                                (click)="refreshWidget()"
                                                [disabled]="!currentWidget">
                                            <i class="fas fa-sync"></i> Refresh
                                        </button>
                                        <button class="btn btn-sm btn-secondary"
                                                (click)="resetWidget()">
                                            <i class="fas fa-undo"></i> Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Widget Display -->
            <div class="row mb-4" *ngIf="currentWidget">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="card-title mb-0">
                                <i class="fas fa-chart-bar me-2"></i>
                                Widget Example - {{ currentWidget.title }}
                            </h5>
                        </div>
                        <div class="card-body">
                            <!-- Monthly Circulation by Shelving Location Widget -->
                            <eg-monthly-circulation-by-shelving-location-widget
                                [config]="currentWidget"
                                [autoRefresh]="autoRefresh"
                                [refreshInterval]="refreshInterval"
                                (dataLoaded)="onWidgetDataLoaded($event)"
                                (dataError)="onWidgetError($event)"
                                (configChanged)="onWidgetConfigChanged($event)">
                            </eg-monthly-circulation-by-shelving-location-widget>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Widget Information -->
            <div class="row mb-4" *ngIf="currentWidget">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="card-title mb-0">
                                <i class="fas fa-info-circle me-2"></i>
                                Widget Information
                            </h6>
                        </div>
                        <div class="card-body">
                            <dl class="row">
                                <dt class="col-sm-4">Widget ID:</dt>
                                <dd class="col-sm-8"><code>{{ currentWidget.id }}</code></dd>

                                <dt class="col-sm-4">Type:</dt>
                                <dd class="col-sm-8">{{ currentWidget.widgetType }}</dd>

                                <dt class="col-sm-4">Chart Type:</dt>
                                <dd class="col-sm-8">{{ currentWidget.chartType }}</dd>

                                <dt class="col-sm-4">Time Range:</dt>
                                <dd class="col-sm-8">{{ currentWidget.timeRange }}</dd>

                                <dt class="col-sm-4">Created:</dt>
                                <dd class="col-sm-8">{{ currentWidget.createdDate | date:'short' }}</dd>

                                <dt class="col-sm-4">Last Modified:</dt>
                                <dd class="col-sm-8">{{ currentWidget.lastModified | date:'short' }}</dd>
                            </dl>
                        </div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h6 class="card-title mb-0">
                                <i class="fas fa-code me-2"></i>
                                Usage Example
                            </h6>
                        </div>
                        <div class="card-body">
                            <pre class="bg-light p-3 rounded"><code>&lt;eg-monthly-circulation-by-shelving-location-widget
  [config]="widgetConfig"
  [autoRefresh]="true"
  [refreshInterval]="300000"
  (dataLoaded)="onDataLoaded($event)"
  (dataError)="onError($event)"&gt;
&lt;/eg-monthly-circulation-by-shelving-location-widget&gt;</code></pre>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Event Log -->
            <div class="row" *ngIf="eventLog.length > 0">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h6 class="card-title mb-0">
                                <i class="fas fa-list me-2"></i>
                                Event Log
                            </h6>
                            <button class="btn btn-sm btn-outline-secondary"
                                    (click)="clearEventLog()">
                                <i class="fas fa-times"></i> Clear
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="event-log" style="max-height: 300px; overflow-y: auto;">
                                <div *ngFor="let event of eventLog; let i = index"
                                     class="event-entry p-2 mb-2 rounded"
                                     [class.bg-light]="i % 2 === 0">
                                    <div class="d-flex justify-content-between">
                                        <span class="fw-bold text-primary">{{ event.type }}</span>
                                        <small class="text-muted">{{ event.timestamp | date:'HH:mm:ss' }}</small>
                                    </div>
                                    <div class="text-muted">{{ event.message }}</div>
                                    <pre *ngIf="event.data"
                                         class="mt-1 mb-0 text-dark"
                                         style="font-size: 0.8rem;">{{ event.data | json }}</pre>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .event-entry {
            font-size: 0.9rem;
        }

        .event-log {
            font-family: 'Courier New', monospace;
        }

        code {
            font-size: 0.85rem;
        }

        pre {
            font-size: 0.8rem;
            white-space: pre-wrap;
        }
    `]
})
export class WidgetExampleComponent implements OnInit {

    // Widget configuration
    currentWidget: ChartWidgetConfig | null = null;
    selectedTimeRange = 'month';
    selectedTemplate = '';
    autoRefresh = true;
    refreshInterval = 300000; // 5 minutes

    // Available templates
    availableTemplates: any[] = [];

    // Event tracking
    eventLog: Array<{type: string, message: string, timestamp: Date, data?: any}> = [];

    constructor(
        private dashboardService: DashboardService,
        private widgetRegistry: WidgetRegistryService
    ) {}

    ngOnInit(): void {
        this.loadAvailableTemplates();
        this.createDefaultWidget();
    }

    /**
     * Load available widget templates
     */
    loadAvailableTemplates(): void {
        this.widgetRegistry.getTemplates().subscribe(templates => {
            this.availableTemplates = templates;
            this.addEvent('TEMPLATES_LOADED', `Loaded ${templates.length} widget templates`, templates);
        });
    }

    /**
     * Create default widget
     */
    createDefaultWidget(): void {
        try {
            this.currentWidget = this.dashboardService.createCirculationWidget({
                name: 'Example Monthly Circulation Widget',
                title: 'Monthly Circulation by Shelving Location - Example',
                timeRange: this.selectedTimeRange as any
            });

            this.addEvent('WIDGET_CREATED', 'Default widget created successfully', this.currentWidget);
        } catch (error) {
            this.addEvent('ERROR', 'Failed to create default widget', error);
        }
    }

    /**
     * Create widget from selected template
     */
    createWidgetFromTemplate(): void {
        if (!this.selectedTemplate) return;

        try {
            this.currentWidget = this.widgetRegistry.createWidgetFromTemplate(
                this.selectedTemplate,
                {
                    timeRange: this.selectedTimeRange as any,
                    title: 'Widget from Template - Example'
                }
            );

            this.addEvent('WIDGET_FROM_TEMPLATE',
                         `Widget created from template: ${this.selectedTemplate}`,
                         this.currentWidget);
        } catch (error) {
            this.addEvent('ERROR', 'Failed to create widget from template', error);
        }
    }

    /**
     * Update widget configuration
     */
    updateWidget(): void {
        if (!this.currentWidget) return;

        try {
            this.currentWidget = {
                ...this.currentWidget,
                timeRange: this.selectedTimeRange as any,
                lastModified: new Date().toISOString()
            };

            this.addEvent('WIDGET_UPDATED',
                         `Widget time range updated to: ${this.selectedTimeRange}`,
                         { timeRange: this.selectedTimeRange });
        } catch (error) {
            this.addEvent('ERROR', 'Failed to update widget', error);
        }
    }

    /**
     * Refresh widget data
     */
    refreshWidget(): void {
        if (!this.currentWidget) return;

        this.currentWidget = {
            ...this.currentWidget,
            lastModified: new Date().toISOString()
        };

        this.addEvent('WIDGET_REFRESHED', 'Widget data refresh triggered');
    }

    /**
     * Reset widget to default state
     */
    resetWidget(): void {
        this.selectedTimeRange = 'month';
        this.selectedTemplate = '';
        this.createDefaultWidget();
        this.addEvent('WIDGET_RESET', 'Widget reset to default configuration');
    }

    /**
     * Handle widget data loaded event
     */
    onWidgetDataLoaded(data: any): void {
        this.addEvent('DATA_LOADED', 'Widget data loaded successfully', {
            dataPoints: data?.length || 0,
            sampleData: Array.isArray(data) ? data.slice(0, 3) : data
        });
    }

    /**
     * Handle widget errors
     */
    onWidgetError(error: any): void {
        this.addEvent('ERROR', 'Widget error occurred', error);
    }

    /**
     * Handle widget configuration changes
     */
    onWidgetConfigChanged(config: ChartWidgetConfig): void {
        this.currentWidget = { ...config };
        this.addEvent('CONFIG_CHANGED', 'Widget configuration changed', {
            widgetId: config.id,
            changes: {
                timeRange: config.timeRange,
                lastModified: config.lastModified
            }
        });
    }

    /**
     * Add event to log
     */
    private addEvent(type: string, message: string, data?: any): void {
        this.eventLog.unshift({
            type,
            message,
            timestamp: new Date(),
            data
        });

        // Keep only last 50 events
        if (this.eventLog.length > 50) {
            this.eventLog = this.eventLog.slice(0, 50);
        }
    }

    /**
     * Clear event log
     */
    clearEventLog(): void {
        this.eventLog = [];
        this.addEvent('LOG_CLEARED', 'Event log cleared');
    }
}