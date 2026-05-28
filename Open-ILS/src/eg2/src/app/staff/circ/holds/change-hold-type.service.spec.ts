import { TestBed } from '@angular/core/testing';
import { NetService } from '@eg/core/net.service';
import { MockGenerators } from 'test_data/mock_generators';
import { of, from } from 'rxjs';
import { ChangeHoldTypeService } from './change-hold-type.service';
import { HoldType } from './hold-type';
import { EventService } from '@eg/core/event.service';
import { AuthService } from '@eg/core/auth.service';
import { None } from '@eg/share/maybe';

describe('ChangeHoldTypeService', () => {
    describe('possible_targets()', () => {
        it('gets its data from the NetService', (done: DoneFn) => {
            const mockNet = MockGenerators.netService({
                'open-ils.circ.holds.change_type.possible_targets': from([
                    MockGenerators.idlObject({id: 567}),
                    MockGenerators.idlObject({id: 789}),
                ])
            });
            TestBed.configureTestingModule({
                providers: [
                    {provide: NetService, useValue: mockNet},
                    {provide: AuthService, useValue: MockGenerators.authService()},
                    EventService,
                    ChangeHoldTypeService
                ]
            });
            const service = TestBed.inject(ChangeHoldTypeService);

            const originalHold = MockGenerators.idlObject({});
            service.possibleTargets(originalHold, HoldType.TITLE).subscribe({complete: () => {
                expect(mockNet.request).toHaveBeenCalledOnceWith(
                    'open-ils.circ',
                    'open-ils.circ.holds.change_type.possible_targets',
                    'MY_AUTH_TOKEN',
                    originalHold,
                    HoldType.TITLE
                );
                done();
            }});
        });
    });
    describe('change()', () => {
        it('returns an id', (done: DoneFn) => {

            const mockNet = MockGenerators.netService({
                'open-ils.circ.holds.change_type.change': of('123')
            });
            TestBed.configureTestingModule({
                providers: [
                    {provide: NetService, useValue: mockNet},
                    {provide: AuthService, useValue: MockGenerators.authService()},
                    EventService,
                    ChangeHoldTypeService
                ]
            });
            const service = TestBed.inject(ChangeHoldTypeService);

            const originalHold = MockGenerators.idlObject({});
            service.change(
                originalHold,
                HoldType.VOLUME,
                456,
                new None()
            ).subscribe((id) => {
                expect(id).toEqual(123);
                done();
            });
        });
    });
});
