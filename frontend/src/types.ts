export interface Machine {
  instanceId: string;
  status: 'available' | 'leased';
  publicIp: string | null;
  privateIp: string | null;
  lastHeartbeat: number;
  userId: string | null;
  leaseExpiry: number | null;
}

export interface StatusResponse {
  total: number;
  available: number;
  leased: number;
  machines: Machine[];
}

export interface ClaimRequest {
  userId: string;
}

export interface ClaimResponse {
  ok: boolean;
  instanceId?: string;
  publicIp?: string | null;
  privateIp?: string | null;
  leaseExpiry?: number;
  connectionHint?: string;
  message?: string;
  scaleInfo?: unknown;
}

export interface RenewRequest {
  instanceId: string;
}

export interface RenewResponse {
  ok: boolean;
  leaseExpiry: number;
  message?: string;
}

export interface ReleaseRequest {
  instanceId: string;
}

export interface ApiError {
  ok: false;
  error?: string;
  message?: string;
}
