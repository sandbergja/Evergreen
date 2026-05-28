import { HoldType, holdTypeLabel } from './hold-type';

describe('holdTypeLabel', () => {
    it('has the correct label', () => {
        expect(holdTypeLabel(HoldType.VOLUME)).toEqual('Call number');
    });
});
