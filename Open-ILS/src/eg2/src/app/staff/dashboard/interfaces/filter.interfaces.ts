// Filter configuration interfaces for dashboard widgets

export interface FilterValue {
    value: string | number;
    label: string;
}

export interface FilterOption {
    id: string;
    label: string;
    type: 'select' | 'multiselect' | 'daterange' | 'text' | 'numberrange';
    options?: FilterValue[];
    required?: boolean;
    placeholder?: string;
}

export interface AppliedFilter {
    filterId: string;
    values: (string | number)[];
    selectedValues?: (string | number)[];
    label: string;
}

export interface WidgetTypeFilters {
    [widgetType: string]: FilterOption[];
}