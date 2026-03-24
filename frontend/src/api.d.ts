import type { StatusResponse, ClaimResponse, RenewResponse } from './types';
export declare function getStatus(): Promise<StatusResponse>;
export declare function claimMachine(userId: string): Promise<ClaimResponse>;
export declare function releaseMachine(instanceId: string): Promise<{
    ok: boolean;
}>;
export declare function renewLease(instanceId: string): Promise<RenewResponse>;
//# sourceMappingURL=api.d.ts.map