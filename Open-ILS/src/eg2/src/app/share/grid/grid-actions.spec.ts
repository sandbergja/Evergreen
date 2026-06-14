import { GridToolbarAction } from './grid';
import { GridActions } from './grid-actions';
import { of } from 'rxjs';

function ungroupedAction(label: string): GridToolbarAction {
    const action = new GridToolbarAction();
    action.label = label;
    return action;
}

function groupedAction(label: string, group: string): GridToolbarAction {
    const action = ungroupedAction(label);
    action.group = group;
    return action;
}

describe('GridActions', () => {
    it('can be constructed with actions', (done) => {
        const actions = new GridActions([ungroupedAction('Hello!'), ungroupedAction('How are you?')]);

        actions.list().subscribe(list => {
            expect(list.map(a => a.label)).toEqual(['Hello!', 'How are you?']);
            done();
        });
    });

    it('can register actions', (done) => {
        const actions = new GridActions();
        const action = ungroupedAction('Hello!');

        actions.register(action);

        actions.list().subscribe(list => {
            expect(list.map(a => a.label)).toEqual(['Hello!']);
            done();
        });
    });

    it('can update an action', (done) => {
        const hidden = ungroupedAction('Hello!');
        hidden.hidden = true;
        const shown = ungroupedAction('Hello!');
        shown.hidden = false;
        const actions = new GridActions([hidden]);

        actions.update(shown);

        actions.list().subscribe(list => {
            expect(list).toEqual([shown]);
            done();
        });
    });

    it('can register an observable', (done) => {
        const actions = new GridActions();

        actions.registerObservable(of(ungroupedAction('Hello!')));

        actions.list().subscribe(list => {
            expect(list.map(a => a.label)).toEqual(['Hello!']);
            done();
        });
    });

    it('sorts ungrouped to the top, then by group', (done) => {
        const actions = new GridActions([
            ungroupedAction('Dog'),
            groupedAction('Tuatara', 'Reptile'),
            ungroupedAction('Budgerigar'),
            groupedAction('Haddock', 'Fish'),
            groupedAction('Tegu', 'Reptile'),
            groupedAction('Corydoras', 'Fish')
        ]);

        actions.list().subscribe(list => {
            expect(list.map(a => a.label)).toEqual([
                'Budgerigar',
                'Dog',
                'Fish',
                'Corydoras',
                'Haddock',
                'Reptile',
                'Tegu',
                'Tuatara'
            ]);
            done();
        });
    });
});
