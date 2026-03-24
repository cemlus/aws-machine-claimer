import type { Machine } from '../types';
interface Props {
    machine: Machine;
    onRelease: () => void;
    onRenew: () => void;
    releasing: boolean;
    renewing: boolean;
}
export declare function ClaimedMachine({ machine, onRelease, onRenew, releasing, renewing }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=ClaimedMachine.d.ts.map