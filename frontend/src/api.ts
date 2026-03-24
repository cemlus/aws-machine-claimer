import axios from 'axios';
import type { StatusResponse, ClaimRequest, ClaimResponse, RenewRequest, RenewResponse, ReleaseRequest } from './types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function getStatus(): Promise<StatusResponse> {
  const response = await api.get<StatusResponse>('/status');
  return response.data;
}

export async function claimMachine(userId: string): Promise<ClaimResponse> {
  const payload: ClaimRequest = { userId };
  const response = await api.post<ClaimResponse>('/claim', payload);
  return response.data;
}

export async function releaseMachine(instanceId: string): Promise<{ ok: boolean }> {
  const payload: ReleaseRequest = { instanceId };
  const response = await api.post<{ ok: boolean }>('/release', payload);
  return response.data;
}

export async function renewLease(instanceId: string): Promise<RenewResponse> {
  const payload: RenewRequest = { instanceId };
  const response = await api.post<RenewResponse>('/renew', payload);
  return response.data;
}
