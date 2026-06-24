import { TestBed } from '@angular/core/testing';
import { NetService } from '@eg/core/net.service';
import { MockGenerators } from 'test_data/mock_generators';
import { of } from 'rxjs';
import { AuthService } from '@eg/core/auth.service';
import { MarkItemService } from './mark-item-service';
import { PcrudService } from '@eg/core/pcrud.service';

describe('MarkItemService', () => {
    describe('markableStatuses()', () => {
        it('orders entries by name alphabetically', (done) => {
            TestBed.configureTestingModule({
                providers: [
                    {provide: NetService, useValue: MockGenerators.netService({
                        'open-ils.search.config.copy_status.retrieve.all': of([
                            MockGenerators.idlObject({id: 1, name: 'Dog', markable: 't'}),
                            MockGenerators.idlObject({id: 2, name: 'Penguin', markable: 't'}),
                            MockGenerators.idlObject({id: 3, name: 'Cat', markable: 't'}),
                        ])
                    })},
                    {provide: AuthService, useValue: null},
                    {provide: PcrudService, useValue: null},
                ]
            });
            const service = TestBed.inject(MarkItemService);

            service.markableStatuses().subscribe(statuses => {
                expect(statuses.map(s => s.name())).toEqual(['Cat', 'Dog', 'Penguin']);
                done();
            });
        });
    });
});
