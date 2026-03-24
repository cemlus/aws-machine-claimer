import type { Machine } from '../types';
interface Props {
    machines: Machine[];
    onSelect?: (machine: Machine) => void;
    selectedInstanceId?: string;
}
export declare function MachineList({ machines, onSelect, selectedInstanceId }: Props): import("react/jsx-runtime").JSX.Element;
export {};
//# sourceMappingURL=MachineList.d.ts.map