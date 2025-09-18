import { Component, Input, OnInit, OnDestroy, EventEmitter, Output, inject } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { takeUntil, catchError } from 'rxjs/operators';
import { ChartWidgetConfig } from '@eg/staff/dashboard/interfaces/dashboard.interfaces';
import { AuthService } from '@eg/core/auth.service';
import { OrgService } from '@eg/core/org.service';

/**
 * BaseWidgetComponent - Abstract Foundation for All Dashboard Widgets
 *
 * This abstract base class implements the Template Method Pattern and provides
 * a standardized lifecycle for dashboard widgets. It handles common concerns like
 * loading states, error handling, configuration management, and cleanup.
 *
 * Key Design Principles:
 * - Single Responsibility: Handles widget lifecycle and common functionality
 * - Open/Closed: Open for extension via abstract methods, closed for modification
 * - Dependency Inversion: Depends on abstractions (services injected by subclasses)
 */
@Component({
    template: '' // Abstract component has no template
})
export abstract class BaseWidgetComponent implements OnInit, OnDestroy {

    // Widget Configuration
    @Input() config: ChartWidgetConfig | null = null;
    @Input() autoRefresh = false; // Auto-refresh disabled by default
    @Input() refreshInterval = 300000; // 5 minutes default

    // Widget Events
    @Output() configChanged = new EventEmitter<ChartWidgetConfig>();
    @Output() dataLoaded = new EventEmitter<any>();
    @Output() dataError = new EventEmitter<Error>();
    @Output() refreshRequested = new EventEmitter<void>();

    // Widget State Management
    protected readonly destroy$ = new Subject<void>();
    protected readonly loading$ = new BehaviorSubject<boolean>(false);
    protected readonly error$ = new BehaviorSubject<Error | null>(null);
    protected readonly data$ = new BehaviorSubject<any>(null);

    // Common Dependencies
    protected auth = inject(AuthService);
    protected org = inject(OrgService);

    // Widget State Properties
    get isLoading(): boolean {
        return this.loading$.value;
    }

    get hasError(): boolean {
        return this.error$.value !== null;
    }

    get currentError(): Error | null {
        return this.error$.value;
    }

    get currentData(): any {
        return this.data$.value;
    }

    // Lifecycle Management
    private refreshTimer?: number;
    private isInitialized = false;

    ngOnInit(): void {
        this.validateConfig();
        this.initializeWidget();
    }

    ngOnDestroy(): void {
        this.cleanup();
        this.destroy$.next();
        this.destroy$.complete();
    }

    /**
     * Template Method - Defines the widget initialization algorithm
     * This method should not be overridden by subclasses
     */
    private initializeWidget(): void {
        try {
            this.loading$.next(true);
            this.error$.next(null);

            // Template method steps
            this.setupWidget();           // Hook for subclass setup
            this.loadInitialData();       // Load widget data
            this.setupAutoRefresh();      // Configure auto-refresh if enabled
            this.bindEvents();           // Bind any additional events

            this.isInitialized = true;
        } catch (error) {
            this.handleError(error as Error);
        }
    }

    /**
     * Validate widget configuration
     */
    private validateConfig(): void {
        if (!this.config) {
            throw new Error('Widget configuration is required');
        }

        if (!this.config.id || !this.config.name) {
            throw new Error('Widget must have an ID and name');
        }

        if (!this.config.widgetType || !this.config.chartType) {
            throw new Error('Widget must specify both widgetType and chartType');
        }

        // Call subclass validation
        this.validateWidgetConfig(this.config);
    }

    /**
     * Load widget data
     */
    private loadInitialData(): void {
        if (!this.config) return;

        this.fetchData(this.config)
            .pipe(
                takeUntil(this.destroy$),
                catchError(error => {
                    this.handleError(error);
                    throw error;
                })
            )
            .subscribe({
                next: (data) => {
                    this.data$.next(data);
                    this.dataLoaded.emit(data);
                    this.loading$.next(false);
                    this.onDataLoaded(data);
                },
                error: (error) => {
                    this.loading$.next(false);
                    this.handleError(error);
                }
            });
    }

    /**
     * Setup auto-refresh timer
     */
    private setupAutoRefresh(): void {
        if (!this.autoRefresh || this.refreshInterval <= 0) {
            return;
        }

        this.refreshTimer = window.setInterval(() => {
            this.refresh();
        }, this.refreshInterval);
    }

    /**
     * Public Methods
     */

    /**
     * Refresh widget data
     */
    public refresh(): void {
        if (!this.isInitialized || this.isLoading) {
            return;
        }

        this.refreshRequested.emit();
        this.loadInitialData();
    }

    /**
     * Update widget configuration
     */
    public updateConfig(newConfig: ChartWidgetConfig): void {
        const oldConfig = this.config;
        this.config = newConfig;

        try {
            this.validateConfig();
            this.configChanged.emit(newConfig);

            // If data-affecting config changed, reload data
            if (this.hasDataConfigChanged(oldConfig, newConfig)) {
                this.refresh();
            }

            this.onConfigChanged(oldConfig, newConfig);
        } catch (error) {
            // Revert config on validation failure
            this.config = oldConfig;
            this.handleError(error as Error);
        }
    }

    /**
     * Check if widget is ready (initialized and has data)
     */
    public isReady(): boolean {
        return this.isInitialized && !this.isLoading && !this.hasError && this.currentData !== null;
    }

    /**
     * Get widget metadata
     */
    public getMetadata(): any {
        return {
            id: this.config?.id,
            name: this.config?.name,
            type: this.config?.widgetType,
            chartType: this.config?.chartType,
            isReady: this.isReady(),
            isLoading: this.isLoading,
            hasError: this.hasError,
            lastUpdated: this.data$.value ? new Date() : null
        };
    }

    /**
     * Protected Helper Methods
     */

    /**
     * Handle errors consistently
     */
    protected handleError(error: Error): void {
        console.error(`Widget ${this.config?.id} error:`, error);
        this.error$.next(error);
        this.dataError.emit(error);
        this.loading$.next(false);
    }

    /**
     * Clear current error state
     */
    protected clearError(): void {
        this.error$.next(null);
    }

    /**
     * Check if configuration changes affect data
     */
    protected hasDataConfigChanged(oldConfig: ChartWidgetConfig | null, newConfig: ChartWidgetConfig): boolean {
        if (!oldConfig) return true;

        // Check time range changes
        if (oldConfig.timeRange !== newConfig.timeRange) return true;

        // Check custom date range changes
        if (JSON.stringify(oldConfig.customDateRange) !== JSON.stringify(newConfig.customDateRange)) return true;

        // Check filter changes
        if (JSON.stringify(oldConfig.filters) !== JSON.stringify(newConfig.filters)) return true;

        return false;
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = undefined;
        }

        this.cleanupWidget();
    }

    // Abstract Methods - Must be implemented by subclasses

    /**
     * Fetch data for the widget
     */
    protected abstract fetchData(config: ChartWidgetConfig): Observable<any>;

    /**
     * Validate widget-specific configuration
     */
    protected abstract validateWidgetConfig(config: ChartWidgetConfig): void;

    /**
     * Get the widget type identifier
     */
    public abstract getWidgetType(): string;

    // Hook Methods - Can be overridden by subclasses

    /**
     * Setup widget-specific initialization
     */
    protected setupWidget(): void {
        // Default implementation - can be overridden
    }

    /**
     * Handle data loaded event
     */
    protected onDataLoaded(data: any): void {
        // Default implementation - can be overridden
    }

    /**
     * Handle configuration changes
     */
    protected onConfigChanged(oldConfig: ChartWidgetConfig | null, newConfig: ChartWidgetConfig): void {
        // Default implementation - can be overridden
    }

    /**
     * Bind additional events
     */
    protected bindEvents(): void {
        // Default implementation - can be overridden
    }

    /**
     * Cleanup widget-specific resources
     */
    protected cleanupWidget(): void {
        // Default implementation - can be overridden
    }
}
