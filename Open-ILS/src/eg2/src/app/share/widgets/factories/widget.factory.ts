import { Injectable, Type, ComponentRef, ViewContainerRef } from '@angular/core';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { BaseWidgetComponent } from '../base/base-widget.component';
import { MonthlyCirculationByShelvingLocationWidget } from '../circulation/monthly-circulation-by-shelving-location.widget';
import { CurrentHoldsMetricWidget } from '../circulation/current-holds-metric.widget';

/**
 * Widget Factory System - Factory Pattern Implementation
 *
 * Provides centralized widget creation and management using the Factory pattern.
 * Supports dynamic widget instantiation, configuration, and lifecycle management.
 *
 * Design Patterns:
 * - Factory Pattern: Creates widgets based on type
 * - Registry Pattern: Maintains available widget types
 * - Strategy Pattern: Different creation strategies for different widget types
 */

export interface WidgetFactory {
    getWidgetType(): string;
    createWidget(config: ChartWidgetConfig): BaseWidgetComponent;
    getDefaultConfig(): Partial<ChartWidgetConfig>;
    getComponentType(): Type<BaseWidgetComponent>;
}

export interface WidgetMetadata {
    type: string;
    name: string;
    description: string;
    category: 'circulations' | 'acquisitions' | 'cataloging' | 'patrons' | 'holdings';
    supportedChartTypes: string[];
    defaultTimeRange: string;
    factory: WidgetFactory;
    componentType: Type<BaseWidgetComponent>;
}

@Injectable({
    providedIn: 'root'
})
export class WidgetFactoryService {

    private registeredWidgets = new Map<string, WidgetMetadata>();

    constructor() {
        this.registerDefaultWidgets();
    }

    /**
     * Register default widgets that come with the system
     */
    private registerDefaultWidgets(): void {
        // Register monthly circulation by shelving location widget
        this.registerWidget({
            type: 'monthly-circulation-by-shelving-location',
            name: 'Monthly Circulation by Shelving Location',
            description: 'Shows circulation statistics by shelving location for a monthly period',
            category: 'circulations',
            supportedChartTypes: ['bar'],
            defaultTimeRange: 'month',
            factory: new MonthlyCirculationByShelvingLocationWidgetFactory(),
            componentType: MonthlyCirculationByShelvingLocationWidget
        });

        // Register current holds metric widget
        this.registerWidget({
            type: 'current-holds-metric',
            name: 'Current Holds',
            description: 'Displays the current number of holds in the system with status breakdown',
            category: 'circulations',
            supportedChartTypes: ['metric'],
            defaultTimeRange: 'today',
            factory: new CurrentHoldsMetricWidgetFactory(),
            componentType: CurrentHoldsMetricWidget
        });

        // Additional widgets can be registered here
        // this.registerWidget({ ... });
    }

    /**
     * Register a new widget type
     */
    registerWidget(metadata: WidgetMetadata): void {
        if (this.registeredWidgets.has(metadata.type)) {
            console.warn(`Widget type ${metadata.type} is already registered. Overwriting.`);
        }

        this.registeredWidgets.set(metadata.type, metadata);
        console.log(`Registered widget: ${metadata.type}`);
    }

    /**
     * Create a widget instance from configuration
     */
    createWidget(config: ChartWidgetConfig): BaseWidgetComponent {
        const widgetType = this.getWidgetTypeFromConfig(config);
        const metadata = this.registeredWidgets.get(widgetType);

        if (!metadata) {
            throw new Error(`Unknown widget type: ${widgetType}`);
        }

        try {
            return metadata.factory.createWidget(config);
        } catch (error) {
            console.error(`Failed to create widget of type ${widgetType}:`, error);
            throw new Error(`Failed to create widget: ${error}`);
        }
    }

    /**
     * Create a widget component dynamically in a ViewContainer
     */
    createWidgetComponent(
        config: ChartWidgetConfig,
        viewContainer: ViewContainerRef
    ): ComponentRef<BaseWidgetComponent> {
        const widgetType = this.getWidgetTypeFromConfig(config);
        const metadata = this.registeredWidgets.get(widgetType);

        if (!metadata) {
            throw new Error(`Unknown widget type: ${widgetType}`);
        }

        // Clear existing components
        viewContainer.clear();

        // Create the component
        const componentRef = viewContainer.createComponent(metadata.componentType);

        // Configure the component
        componentRef.instance.config = config;

        return componentRef;
    }

    /**
     * Get widget type from configuration
     */
    private getWidgetTypeFromConfig(config: ChartWidgetConfig): string {
        // For now, use a simple mapping. This could be more sophisticated
        // based on widgetType + chartType + additional criteria
        if (config.widgetType === 'circulations' && config.chartType === 'bar') {
            return 'monthly-circulation-by-shelving-location';
        }

        if (config.widgetType === 'circulations' && config.chartType === 'metric') {
            return 'current-holds-metric';
        }

        // If no specific mapping, try to use the widget ID or name
        if (config.id && this.registeredWidgets.has(config.id)) {
            return config.id;
        }

        throw new Error(`Cannot determine widget type from config: ${JSON.stringify(config)}`);
    }

    /**
     * Get all registered widget types
     */
    getRegisteredWidgetTypes(): string[] {
        return Array.from(this.registeredWidgets.keys());
    }

    /**
     * Get widget metadata by type
     */
    getWidgetMetadata(type: string): WidgetMetadata | undefined {
        return this.registeredWidgets.get(type);
    }

    /**
     * Get all widget metadata
     */
    getAllWidgetMetadata(): WidgetMetadata[] {
        return Array.from(this.registeredWidgets.values());
    }

    /**
     * Get widgets by category
     */
    getWidgetsByCategory(category: string): WidgetMetadata[] {
        return Array.from(this.registeredWidgets.values())
            .filter(metadata => metadata.category === category);
    }

    /**
     * Get default configuration for a widget type
     */
    getDefaultConfig(type: string): Partial<ChartWidgetConfig> {
        const metadata = this.registeredWidgets.get(type);
        if (!metadata) {
            throw new Error(`Unknown widget type: ${type}`);
        }

        return {
            ...metadata.factory.getDefaultConfig(),
            id: this.generateWidgetId(type),
            widgetType: metadata.category,
            chartType: metadata.supportedChartTypes[0] as 'line' | 'bar' | 'pie' | 'metric',
            timeRange: metadata.defaultTimeRange as any,
            createdDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            createdBy: 'system' // This should come from auth service
        };
    }

    /**
     * Validate widget configuration
     */
    validateWidgetConfig(config: ChartWidgetConfig): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Basic validation
        if (!config.id) {
            errors.push('Widget ID is required');
        }

        if (!config.name) {
            errors.push('Widget name is required');
        }

        if (!config.widgetType) {
            errors.push('Widget type is required');
        }

        if (!config.chartType) {
            errors.push('Chart type is required');
        }

        // Check if widget type is registered
        const widgetType = this.getWidgetTypeFromConfig(config);
        const metadata = this.registeredWidgets.get(widgetType);
        if (!metadata) {
            errors.push(`Unknown widget type: ${widgetType}`);
            return { isValid: false, errors };
        }

        // Validate chart type is supported
        if (!metadata.supportedChartTypes.includes(config.chartType)) {
            errors.push(`Chart type ${config.chartType} is not supported by widget type ${widgetType}`);
        }

        // Widget-specific validation
        try {
            const widget = metadata.factory.createWidget(config);
            // Validation is performed during widget creation
        } catch (error) {
            errors.push(`Widget validation failed: ${error}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate a unique widget ID
     */
    private generateWidgetId(type: string): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `${type}-${timestamp}-${random}`;
    }

    /**
     * Clone a widget configuration
     */
    cloneWidgetConfig(config: ChartWidgetConfig): ChartWidgetConfig {
        const cloned = JSON.parse(JSON.stringify(config));
        cloned.id = this.generateWidgetId(cloned.widgetType);
        cloned.name = `Copy of ${cloned.name}`;
        cloned.createdDate = new Date().toISOString();
        cloned.lastModified = new Date().toISOString();
        return cloned;
    }
}

/**
 * Monthly Circulation by Shelving Location Widget Factory
 */
class MonthlyCirculationByShelvingLocationWidgetFactory implements WidgetFactory {
    getWidgetType(): string {
        return 'monthly-circulation-by-shelving-location';
    }

    createWidget(config: ChartWidgetConfig): BaseWidgetComponent {
        const widget = new MonthlyCirculationByShelvingLocationWidget();
        widget.config = config;
        return widget;
    }

    getDefaultConfig(): Partial<ChartWidgetConfig> {
        return MonthlyCirculationByShelvingLocationWidget.getDefaultConfig();
    }

    getComponentType(): Type<BaseWidgetComponent> {
        return MonthlyCirculationByShelvingLocationWidget;
    }
}

/**
 * Current Holds Metric Widget Factory
 */
class CurrentHoldsMetricWidgetFactory implements WidgetFactory {
    getWidgetType(): string {
        return 'current-holds-metric';
    }

    createWidget(config: ChartWidgetConfig): BaseWidgetComponent {
        const widget = new CurrentHoldsMetricWidget();
        widget.config = config;
        return widget;
    }

    getDefaultConfig(): Partial<ChartWidgetConfig> {
        return {
            name: 'Current Holds',
            title: 'Current Holds',
            colorTheme: 'info',
            displayOptions: {
                showLegend: false,
                showGrid: false,
                showExportButton: true,
                showPatterns: false
            },
            metricOptions: {
                icon: 'bookmark',
                showStatus: true,
                showTrend: true,
                showTopIcon: true,
                color: 'info',
                format: 'number'
            },
            filters: []
        };
    }

    getComponentType(): Type<BaseWidgetComponent> {
        return CurrentHoldsMetricWidget;
    }
}

/**
 * Widget Configuration Builder - Fluent Interface
 */
export class WidgetConfigBuilder {
    private config: Partial<ChartWidgetConfig> = {};

    static create(type: string): WidgetConfigBuilder {
        return new WidgetConfigBuilder().withType(type);
    }

    withType(type: string): WidgetConfigBuilder {
        this.config.widgetType = type as any;
        return this;
    }

    withName(name: string): WidgetConfigBuilder {
        this.config.name = name;
        this.config.title = name;
        return this;
    }

    withChartType(chartType: string): WidgetConfigBuilder {
        this.config.chartType = chartType as any;
        return this;
    }

    withTimeRange(timeRange: string): WidgetConfigBuilder {
        this.config.timeRange = timeRange as any;
        return this;
    }

    withCustomDateRange(start: string, end: string): WidgetConfigBuilder {
        this.config.timeRange = 'custom';
        this.config.customDateRange = { start, end };
        return this;
    }

    withFilters(filters: any[]): WidgetConfigBuilder {
        this.config.filters = filters;
        return this;
    }

    withDisplayOptions(options: any): WidgetConfigBuilder {
        this.config.displayOptions = options;
        return this;
    }

    build(factoryService: WidgetFactoryService): ChartWidgetConfig {
        // Get default config and merge with builder config
        const defaultConfig = factoryService.getDefaultConfig('monthly-circulation-by-shelving-location');
        const finalConfig = { ...defaultConfig, ...this.config } as ChartWidgetConfig;

        // Validate the configuration
        const validation = factoryService.validateWidgetConfig(finalConfig);
        if (!validation.isValid) {
            throw new Error(`Invalid widget configuration: ${validation.errors.join(', ')}`);
        }

        return finalConfig;
    }
}