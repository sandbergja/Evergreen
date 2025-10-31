import { Component, OnInit, OnDestroy } from '@angular/core';
import { DashboardService } from '../dashboard.service';
import { WidgetJsonConfig } from '../interfaces/widget-json-config.interface';

/**
 * DashboardDisplayComponent - Displays dashboard widgets from database
 *
 * This component renders a collection of widgets that are configured in the database.
 * All widget configurations are loaded dynamically via getDashboardData().
 * NO hard-coded widget configurations should exist in this component.
 */
@Component({
    selector: 'eg-dashboard-display',
    templateUrl: './display.component.html',
    styleUrls: ['./display.component.css']
})
export class DashboardDisplayComponent implements OnInit, OnDestroy {

    // Loading states
    loading = true;
    error: string | null = null;

    // Dynamic widgets loaded from database
    widgets: WidgetJsonConfig[] = [];

    constructor(private dashboardService: DashboardService) {}

    ngOnInit(): void {
        this.loadDashboardData();
    }

    ngOnDestroy(): void {
        // Cleanup handled by Angular's automatic unsubscription
    }

    /**
     * Load dashboard widgets from database
     * Fetches user's configured widgets which includes org defaults + user preferences
     */
    async loadDashboardData(): Promise<void> {
        try {
            this.loading = true;
            this.error = null;

            console.log('DashboardDisplayComponent: Loading widgets from database');

            // Fetch widgets from database (org defaults + user preferences)
            this.widgets = await this.dashboardService.getDashboardData();

            console.log(`DashboardDisplayComponent: Loaded ${this.widgets.length} widgets`, this.widgets);

            if (this.widgets.length === 0) {
                console.warn('DashboardDisplayComponent: No widgets configured');
                this.error = 'No widgets configured. Contact your administrator to enable dashboard widgets.';
            }

        } catch (error) {
            console.error('DashboardDisplayComponent: Error loading dashboard:', error);
            this.error = 'Failed to load dashboard. Please try again.';
        } finally {
            this.loading = false;
        }
    }

    refreshData(): void {
        this.loadDashboardData();
    }
}
