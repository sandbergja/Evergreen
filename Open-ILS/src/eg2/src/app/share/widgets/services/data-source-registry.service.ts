import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { DataSourceService, DataSourceConfig, DataFetchResult } from '@eg/staff/dashboard/interfaces/widget-json-config.interface';
import { CirculationDataService } from './circulation-data.service';

/**
 * DataSourceRegistryService - Registry for mapping data source names to services
 *
 * This service acts as a registry that maps string-based data source identifiers
 * to actual Angular services and their methods. This enables JSON configurations
 * to specify data sources without needing compile-time type references.
 *
 * Features:
 * - Dynamic service resolution from string names
 * - Type-safe method invocation
 * - Caching support
 * - Error handling
 * - Extensible registration system
 */

/**
 * Data source registration entry
 */
interface DataSourceRegistration {
    service: any; // The actual service instance
    methods: Map<string, Function>; // Available methods
}

@Injectable({
    providedIn: 'root'
})
export class DataSourceRegistryService {

    // Injected services
    private circulationDataService = inject(CirculationDataService);

    // Registry of data sources
    private registry = new Map<DataSourceService, DataSourceRegistration>();

    // Cache for data fetch results
    private cache = new Map<string, { data: any, timestamp: Date }>();

    constructor() {
        this.registerDefaultDataSources();
    }

    /**
     * Register all default data sources
     */
    private registerDefaultDataSources(): void {
        // Register circulation data source
        this.registerDataSource('circulation', this.circulationDataService, {
            'getCirculationByShelvingLocation': this.circulationDataService.getCirculationByShelvingLocation.bind(this.circulationDataService),
            'getCirculationTrend': this.circulationDataService.getCirculationTrend.bind(this.circulationDataService),
            'getCirculationSummary': this.circulationDataService.getCirculationSummary.bind(this.circulationDataService),
            'getCurrentHoldsCount': this.circulationDataService.getCurrentHoldsCount.bind(this.circulationDataService),
            'getShelvingLocations': this.circulationDataService.getShelvingLocations.bind(this.circulationDataService),
            'getCirculationByItemType': this.circulationDataService.getCirculationByItemType.bind(this.circulationDataService),
            'getHoldsByStatus': this.circulationDataService.getHoldsByStatus.bind(this.circulationDataService),
            'getItemsByCopyStatus': this.circulationDataService.getItemsByCopyStatus.bind(this.circulationDataService),
            'getCirculationByLibrary': this.circulationDataService.getCirculationByLibrary.bind(this.circulationDataService)
        });

        // Additional data sources can be registered here
        // this.registerDataSource('acquisitions', this.acquisitionsDataService, { ... });
        // this.registerDataSource('cataloging', this.catalogingDataService, { ... });
        // this.registerDataSource('patrons', this.patronsDataService, { ... });
        // this.registerDataSource('holdings', this.holdingsDataService, { ... });
    }

    /**
     * Register a new data source
     */
    public registerDataSource(
        name: DataSourceService,
        service: any,
        methods: Record<string, Function>
    ): void {
        const methodMap = new Map<string, Function>();

        // Convert methods object to Map
        Object.entries(methods).forEach(([methodName, methodFn]) => {
            methodMap.set(methodName, methodFn);
        });

        this.registry.set(name, {
            service,
            methods: methodMap
        });

        console.log(`Registered data source: ${name} with ${methodMap.size} methods`);
    }

    /**
     * Fetch data using a data source configuration
     */
    public fetchData(config: DataSourceConfig): Observable<DataFetchResult> {
        const startTime = Date.now();

        // Check cache if enabled
        if (config.cache?.enabled) {
            const cachedData = this.getCachedData(config);
            if (cachedData) {
                console.log(`Cache hit for ${config.service}.${config.method}`);
                return of({
                    data: cachedData,
                    metadata: {
                        source: config.service,
                        method: config.method,
                        fetchTime: new Date(),
                        recordCount: Array.isArray(cachedData) ? cachedData.length : 1,
                        cached: true
                    }
                });
            }
        }

        // Get the data source registration
        const registration = this.registry.get(config.service);
        if (!registration) {
            throw new Error(`Data source '${config.service}' is not registered`);
        }

        // Get the method
        const method = registration.methods.get(config.method);
        if (!method) {
            const availableMethods = Array.from(registration.methods.keys()).join(', ');
            throw new Error(
                `Method '${config.method}' not found on data source '${config.service}'. ` +
                `Available methods: ${availableMethods}`
            );
        }

        try {
            // Invoke the method with parameters
            const result$ = method(config.params) as Observable<any>;

            // Wrap the result with metadata
            return new Observable(subscriber => {
                result$.subscribe({
                    next: (data) => {
                        const executionTime = Date.now() - startTime;

                        // Cache the result if caching is enabled
                        if (config.cache?.enabled) {
                            this.cacheData(config, data);
                        }

                        subscriber.next({
                            data,
                            metadata: {
                                source: config.service,
                                method: config.method,
                                fetchTime: new Date(),
                                recordCount: Array.isArray(data) ? data.length : 1,
                                cached: false
                            }
                        });
                        subscriber.complete();
                    },
                    error: (error) => {
                        console.error(`Error fetching data from ${config.service}.${config.method}:`, error);
                        subscriber.error(error);
                    }
                });
            });
        } catch (error) {
            console.error(`Error invoking ${config.service}.${config.method}:`, error);
            throw error;
        }
    }

    /**
     * Get cached data if available and not expired
     */
    private getCachedData(config: DataSourceConfig): any | null {
        const cacheKey = this.getCacheKey(config);
        const cached = this.cache.get(cacheKey);

        if (!cached) {
            return null;
        }

        // Check if cache has expired
        const ttl = (config.cache?.ttl || 300) * 1000; // Convert to milliseconds
        const age = Date.now() - cached.timestamp.getTime();

        if (age > ttl) {
            // Cache expired, remove it
            this.cache.delete(cacheKey);
            return null;
        }

        return cached.data;
    }

    /**
     * Cache data for future requests
     */
    private cacheData(config: DataSourceConfig, data: any): void {
        const cacheKey = this.getCacheKey(config);
        this.cache.set(cacheKey, {
            data,
            timestamp: new Date()
        });
    }

    /**
     * Generate cache key from configuration
     */
    private getCacheKey(config: DataSourceConfig): string {
        return `${config.service}:${config.method}:${JSON.stringify(config.params)}`;
    }

    /**
     * Clear cache for specific data source or all
     */
    public clearCache(service?: DataSourceService, method?: string): void {
        if (!service) {
            // Clear all cache
            this.cache.clear();
            console.log('Cleared all data source cache');
            return;
        }

        // Clear cache for specific service/method
        const keysToDelete: string[] = [];
        this.cache.forEach((_, key) => {
            if (key.startsWith(`${service}:`)) {
                if (!method || key.startsWith(`${service}:${method}:`)) {
                    keysToDelete.push(key);
                }
            }
        });

        keysToDelete.forEach(key => this.cache.delete(key));
        console.log(`Cleared cache for ${service}${method ? '.' + method : ''} (${keysToDelete.length} entries)`);
    }

    /**
     * Get all registered data sources
     */
    public getRegisteredDataSources(): DataSourceService[] {
        return Array.from(this.registry.keys());
    }

    /**
     * Get available methods for a data source
     */
    public getAvailableMethods(service: DataSourceService): string[] {
        const registration = this.registry.get(service);
        if (!registration) {
            return [];
        }
        return Array.from(registration.methods.keys());
    }

    /**
     * Check if a data source is registered
     */
    public isRegistered(service: DataSourceService): boolean {
        return this.registry.has(service);
    }

    /**
     * Check if a method exists on a data source
     */
    public hasMethod(service: DataSourceService, method: string): boolean {
        const registration = this.registry.get(service);
        if (!registration) {
            return false;
        }
        return registration.methods.has(method);
    }

    /**
     * Get data source information for debugging
     */
    public getDataSourceInfo(service: DataSourceService): any {
        const registration = this.registry.get(service);
        if (!registration) {
            return null;
        }

        return {
            service,
            methodCount: registration.methods.size,
            methods: Array.from(registration.methods.keys())
        };
    }

    /**
     * Get all data source information
     */
    public getAllDataSourceInfo(): any[] {
        return Array.from(this.registry.keys()).map(service => this.getDataSourceInfo(service));
    }

    /**
     * Validate a data source configuration
     */
    public validateDataSourceConfig(config: DataSourceConfig): { valid: boolean, errors: string[] } {
        const errors: string[] = [];

        // Check if service is registered
        if (!this.isRegistered(config.service)) {
            errors.push(`Data source '${config.service}' is not registered`);
        }

        // Check if method exists
        if (!this.hasMethod(config.service, config.method)) {
            errors.push(`Method '${config.method}' does not exist on data source '${config.service}'`);

            // Suggest available methods
            const availableMethods = this.getAvailableMethods(config.service);
            if (availableMethods.length > 0) {
                errors.push(`Available methods: ${availableMethods.join(', ')}`);
            }
        }

        // Check if params is an object
        if (config.params && typeof config.params !== 'object') {
            errors.push('params must be an object');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}