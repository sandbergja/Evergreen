import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WidgetFactoryService, WidgetMetadata } from '../factories/widget.factory';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';

/**
 * WidgetRegistryService - Central Registry for Widget Management
 *
 * Provides a centralized service for managing widget types, templates,
 * and widget lifecycle. Acts as a facade over the WidgetFactoryService
 * and provides additional functionality for widget discovery and management.
 *
 * Design Patterns:
 * - Registry Pattern: Central widget type registry
 * - Facade Pattern: Simplified interface over complex widget system
 * - Observer Pattern: Reactive updates to widget registry changes
 */

export interface WidgetTemplate {
    id: string;
    name: string;
    description: string;
    type: string;
    category: string;
    config: Partial<ChartWidgetConfig>;
    previewImage?: string;
    tags: string[];
    isDefault: boolean;
    createdDate: string;
}

export interface WidgetCategory {
    id: string;
    name: string;
    description: string;
    icon: string;
    widgetTypes: string[];
}

@Injectable({
    providedIn: 'root'
})
export class WidgetRegistryService {

    private templates$ = new BehaviorSubject<WidgetTemplate[]>([]);
    private categories$ = new BehaviorSubject<WidgetCategory[]>([]);

    constructor(private widgetFactory: WidgetFactoryService) {
        this.initializeDefaultTemplates();
        this.initializeCategories();
    }

    /**
     * Initialize default widget templates
     */
    private initializeDefaultTemplates(): void {
        const templates: WidgetTemplate[] = [
            {
                id: 'monthly-circulation-shelving-default',
                name: 'Monthly Circulation by Shelving Location',
                description: 'View monthly circulation statistics broken down by shelving location',
                type: 'monthly-circulation-by-shelving-location',
                category: 'circulations',
                config: {
                    name: 'Monthly Circulation by Shelving Location',
                    title: 'Monthly Circulation by Shelving Location',
                    widgetType: 'circulations',
                    chartType: 'bar',
                    timeRange: 'month',
                    colorTheme: 'evergreen',
                    displayOptions: {
                        showLegend: true,
                        showGrid: true,
                        showExportButton: true,
                        showPatterns: false
                    },
                    filters: [
                        {
                            filterId: 'shelving_location',
                            label: 'Shelving Location',
                            values: [],
                            selectedValues: []
                        }
                    ]
                },
                tags: ['circulation', 'monthly', 'shelving', 'location', 'bar-chart'],
                isDefault: true,
                createdDate: new Date().toISOString()
            },
            {
                id: 'quarterly-circulation-shelving',
                name: 'Quarterly Circulation by Shelving Location',
                description: 'View quarterly circulation trends by shelving location',
                type: 'monthly-circulation-by-shelving-location',
                category: 'circulations',
                config: {
                    name: 'Quarterly Circulation by Shelving Location',
                    title: 'Quarterly Circulation Trends',
                    widgetType: 'circulations',
                    chartType: 'bar',
                    timeRange: 'quarter',
                    colorTheme: 'evergreen',
                    displayOptions: {
                        showLegend: true,
                        showGrid: true,
                        showExportButton: true,
                        showPatterns: false
                    },
                    filters: [
                        {
                            filterId: 'shelving_location',
                            label: 'Shelving Location',
                            values: ['adult_fiction', 'adult_nonfiction', 'children'],
                            selectedValues: ['adult_fiction', 'adult_nonfiction', 'children']
                        }
                    ]
                },
                tags: ['circulation', 'quarterly', 'shelving', 'trends', 'bar-chart'],
                isDefault: true,
                createdDate: new Date().toISOString()
            }
            // Additional templates can be added here
        ];

        this.templates$.next(templates);
    }

    /**
     * Initialize widget categories
     */
    private initializeCategories(): void {
        const categories: WidgetCategory[] = [
            {
                id: 'circulations',
                name: 'Circulation Analytics',
                description: 'Track circulation patterns, popular items, and usage trends',
                icon: 'fas fa-exchange-alt',
                widgetTypes: ['monthly-circulation-by-shelving-location']
            },
            {
                id: 'acquisitions',
                name: 'Acquisitions',
                description: 'Monitor purchasing, budgets, and collection development',
                icon: 'fas fa-shopping-cart',
                widgetTypes: []
            },
            {
                id: 'cataloging',
                name: 'Cataloging',
                description: 'Track cataloging progress, authority control, and metadata quality',
                icon: 'fas fa-tags',
                widgetTypes: []
            },
            {
                id: 'patrons',
                name: 'Patron Services',
                description: 'Analyze patron activity, demographics, and service usage',
                icon: 'fas fa-users',
                widgetTypes: []
            },
            {
                id: 'holdings',
                name: 'Collection Management',
                description: 'Monitor collection size, usage, and maintenance needs',
                icon: 'fas fa-books',
                widgetTypes: []
            }
        ];

        this.categories$.next(categories);
    }

    /**
     * Get all available widget templates
     */
    getTemplates(): Observable<WidgetTemplate[]> {
        return this.templates$.asObservable();
    }

    /**
     * Get widget templates by category
     */
    getTemplatesByCategory(category: string): Observable<WidgetTemplate[]> {
        return new Observable(subscriber => {
            this.templates$.subscribe(templates => {
                const filtered = templates.filter(template => template.category === category);
                subscriber.next(filtered);
            });
        });
    }

    /**
     * Get all widget categories
     */
    getCategories(): Observable<WidgetCategory[]> {
        return this.categories$.asObservable();
    }

    /**
     * Get a specific template by ID
     */
    getTemplate(templateId: string): WidgetTemplate | null {
        const templates = this.templates$.value;
        return templates.find(template => template.id === templateId) || null;
    }

    /**
     * Create a widget from a template
     */
    createWidgetFromTemplate(templateId: string, customizations?: Partial<ChartWidgetConfig>): ChartWidgetConfig {
        const template = this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        // Get the default config for the widget type
        const defaultConfig = this.widgetFactory.getDefaultConfig(template.type);

        // Merge template config with customizations
        const finalConfig: ChartWidgetConfig = {
            ...defaultConfig,
            ...template.config,
            ...customizations,
            id: this.generateWidgetId(),
            createdDate: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            createdBy: 'user' // This should come from auth service
        } as ChartWidgetConfig;

        // Validate the configuration
        const validation = this.widgetFactory.validateWidgetConfig(finalConfig);
        if (!validation.isValid) {
            throw new Error(`Invalid widget configuration: ${validation.errors.join(', ')}`);
        }

        return finalConfig;
    }

    /**
     * Add a custom template
     */
    addCustomTemplate(template: Omit<WidgetTemplate, 'id' | 'createdDate' | 'isDefault'>): void {
        const newTemplate: WidgetTemplate = {
            ...template,
            id: this.generateTemplateId(),
            createdDate: new Date().toISOString(),
            isDefault: false
        };

        const currentTemplates = this.templates$.value;
        this.templates$.next([...currentTemplates, newTemplate]);
    }

    /**
     * Update an existing template
     */
    updateTemplate(templateId: string, updates: Partial<WidgetTemplate>): void {
        const currentTemplates = this.templates$.value;
        const templateIndex = currentTemplates.findIndex(template => template.id === templateId);

        if (templateIndex === -1) {
            throw new Error(`Template not found: ${templateId}`);
        }

        const updatedTemplate = {
            ...currentTemplates[templateIndex],
            ...updates
        };

        const updatedTemplates = [...currentTemplates];
        updatedTemplates[templateIndex] = updatedTemplate;

        this.templates$.next(updatedTemplates);
    }

    /**
     * Remove a custom template
     */
    removeTemplate(templateId: string): void {
        const currentTemplates = this.templates$.value;
        const template = currentTemplates.find(t => t.id === templateId);

        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        if (template.isDefault) {
            throw new Error('Cannot remove default templates');
        }

        const filteredTemplates = currentTemplates.filter(t => t.id !== templateId);
        this.templates$.next(filteredTemplates);
    }

    /**
     * Search templates by tags or name
     */
    searchTemplates(query: string): Observable<WidgetTemplate[]> {
        return new Observable(subscriber => {
            this.templates$.subscribe(templates => {
                const searchTerm = query.toLowerCase();
                const filtered = templates.filter(template =>
                    template.name.toLowerCase().includes(searchTerm) ||
                    template.description.toLowerCase().includes(searchTerm) ||
                    template.tags.some(tag => tag.toLowerCase().includes(searchTerm))
                );
                subscriber.next(filtered);
            });
        });
    }

    /**
     * Get widget metadata from factory
     */
    getWidgetMetadata(): WidgetMetadata[] {
        return this.widgetFactory.getAllWidgetMetadata();
    }

    /**
     * Get supported chart types for a widget category
     */
    getSupportedChartTypes(category: string): string[] {
        const metadata = this.widgetFactory.getWidgetsByCategory(category);
        const chartTypes = new Set<string>();

        metadata.forEach(widget => {
            widget.supportedChartTypes.forEach(type => chartTypes.add(type));
        });

        return Array.from(chartTypes);
    }

    /**
     * Validate a widget configuration
     */
    validateWidgetConfig(config: ChartWidgetConfig): { isValid: boolean; errors: string[] } {
        return this.widgetFactory.validateWidgetConfig(config);
    }

    /**
     * Clone a widget configuration
     */
    cloneWidgetConfig(config: ChartWidgetConfig): ChartWidgetConfig {
        return this.widgetFactory.cloneWidgetConfig(config);
    }

    /**
     * Generate a unique widget ID
     */
    private generateWidgetId(): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `widget-${timestamp}-${random}`;
    }

    /**
     * Generate a unique template ID
     */
    private generateTemplateId(): string {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `template-${timestamp}-${random}`;
    }

    /**
     * Get widget creation statistics
     */
    getWidgetStats(): Observable<any> {
        return new Observable(subscriber => {
            this.templates$.subscribe(templates => {
                const stats = {
                    totalTemplates: templates.length,
                    defaultTemplates: templates.filter(t => t.isDefault).length,
                    customTemplates: templates.filter(t => !t.isDefault).length,
                    categoryCounts: this.getCategoryCounts(templates),
                    popularTags: this.getPopularTags(templates)
                };
                subscriber.next(stats);
            });
        });
    }

    /**
     * Get count of templates per category
     */
    private getCategoryCounts(templates: WidgetTemplate[]): { [category: string]: number } {
        const counts: { [category: string]: number } = {};
        templates.forEach(template => {
            counts[template.category] = (counts[template.category] || 0) + 1;
        });
        return counts;
    }

    /**
     * Get most popular tags
     */
    private getPopularTags(templates: WidgetTemplate[]): { tag: string; count: number }[] {
        const tagCounts: { [tag: string]: number } = {};

        templates.forEach(template => {
            template.tags.forEach(tag => {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
        });

        return Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }
}