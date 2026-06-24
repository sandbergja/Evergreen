import { noSuch } from '../util/no-such';
import { GridToolbarAction } from './grid';
import { map, Observable, of } from 'rxjs';

export class GridActions {
    constructor(actions?: GridToolbarAction[]) {
        if (actions) {
            actions.forEach(action => this.register(action));
        }
    }

    private registry = [];

    list(): Observable<GridToolbarAction[]> {
        const unGrouped = this.registry.filter(a => !a.group)
            .sort((a, b) => {
                return a.label < b.label ? -1 : 1;
            });

        const grouped = this.registry.filter(a => Boolean(a.group))
            .sort((a, b) => {
                if (a.group === b.group) {
                    return a.label < b.label ? -1 : 1;
                } else {
                    return a.group < b.group ? -1 : 1;
                }
            });

        const groups = this.registry.filter(a => a.isGroup);

        // Insert group markers for rendering
        const seen: any = {};
        const grouped2: any[] = [];
        grouped.forEach(action => {
            if (noSuch((group:GridToolbarAction) => group.label === action.group)(groups) && !seen[action.group]) {
                seen[action.group] = true;
                const act = new GridToolbarAction();
                act.label = action.group;
                act.isGroup = true;
                act.hidden = this.actionsInGroup(action.group).every(a => a.hidden);
                grouped2.push(act);
            }
            grouped2.push(action);
        });

        return of(unGrouped.concat(grouped2));
    }

    /**
     * Like list(), but you can pass a list of actions (identified by their label)
     * that should be hidden
     *
     * @param hidden A list of action labels that should be hidden
     * @returns Observable of an array of actions
     */
    hiding(hidden: string[]): Observable<GridToolbarAction[]> {
        return this.list().pipe(map(list => {
            if (!hidden || hidden.length === 0) { return list; }

            const groups = [];
            list.forEach(action => {
                if (action.isGroup) {
                    groups.push(action);
                } else if (!action.isSeparator) {
                    action.hidden = hidden.includes(action.label);
                }
            });

            // If all actions in a group are hidden, hide the group as well.
            // Note the group may be marked as hidden in the configuration,
            // but the addition of new entries within a group should cause
            // it to be visible again.
            groups.forEach(group => {
                const visible = list
                    .filter(action => action.group === group.label && !action.hidden);
                group.hidden = visible.length === 0;
            });
            return list;
        }));
    }

    register(action: GridToolbarAction) {
        this.registry.push(action);
    }

    registerObservable(actions: Observable<GridToolbarAction>) {
        actions.subscribe(action => this.register(action));
    }

    none(): boolean {
        return this.registry.length === 0;
    }

    update(newValue: GridToolbarAction) {
        const found = this.registry.findIndex(action => action.label === newValue.label);
        if (found > -1) {
            this.registry[found] = newValue;
        }
    }

    private actionsInGroup(groupName: string): GridToolbarAction[] {
        return this.registry.filter(action => action.group === groupName);
    }
}
