import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});
export async function getStatus() {
    const response = await api.get('/status');
    return response.data;
}
export async function claimMachine(userId) {
    const payload = { userId };
    const response = await api.post('/claim', payload);
    return response.data;
}
export async function releaseMachine(instanceId) {
    const payload = { instanceId };
    const response = await api.post('/release', payload);
    return response.data;
}
export async function renewLease(instanceId) {
    const payload = { instanceId };
    const response = await api.post('/renew', payload);
    return response.data;
}
//# sourceMappingURL=api.js.map