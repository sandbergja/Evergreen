export enum HoldType {
    COPY = 'C',
    FORCE = 'F',
    RECALL = 'R',
    ISSUANCE = 'I',
    VOLUME = 'V',
    TITLE = 'T',
    METARECORD = 'M',
    MONOPART = 'P'
}

export function holdTypeLabel(type: HoldType): string {
    switch (type) {
        case HoldType.COPY: return $localize`:@@holdtype.copy:Item`;
        case HoldType.FORCE: return $localize`:@@holdtype.force:Force`;
        case HoldType.RECALL: return $localize`:@@holdtype.recall:Recall`;
        case HoldType.ISSUANCE: return $localize`:@@holdtype.issuance:Issuance`;
        case HoldType.VOLUME: return $localize`:@@holdtype.volume:Call number`;
        case HoldType.TITLE: return $localize`:@@holdtype.title:Title`;
        case HoldType.METARECORD: return $localize`:@@holdtype.metarecord:Metarecord`;
        case HoldType.MONOPART: return $localize`:@@holdtype.monopart:Part`;
    }
}

// You can't change any type of hold to any other type.  These hold types can be
// either the current type or the desired new type in a change type scenario.
const CHANGEABLE_TYPES = [
    HoldType.COPY, HoldType.VOLUME, HoldType.TITLE, HoldType.METARECORD, HoldType.MONOPART
];

export function holdTypeChangeOptions(currentType: HoldType): HoldType[] {
    if (CHANGEABLE_TYPES.includes(currentType)) {
        return CHANGEABLE_TYPES.filter(type => currentType !== type);
    } else {
        return [];
    }
}
