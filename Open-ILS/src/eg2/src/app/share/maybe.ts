// The Maybe monad, also known as Option<T>
export type Maybe<T> = Some<T>|None<T>

export class Some<T> {
    constructor(private readonly value: T) {}

    and(rightHandSide: Maybe<any>): Maybe<any> {
        return rightHandSide;
    }

    isSome(): boolean {
        return true;
    }

    whenSome(callback: (val: T) => void): Some<T> {
        callback(this.value);
        return this;
    }
}

export class None<T> {
    and(rightHandSide: Maybe<any>): Maybe<any> {
        return this;
    }

    isSome(): boolean {
        return false;
    }

    whenSome(_callback: (val: T) => void): None<T> {
        // Since this is not Some, we do not run the callback
        return this;
    }
}
