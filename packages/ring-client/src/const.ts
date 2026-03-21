export const RING_OAUTH_URL = 'https://oauth.ring.com/oauth/token';
export const RING_API_BASE = 'https://api.ring.com/clients_api';
export const RING_CLIENT_ID = 'ring_official_android';
export const RING_USER_AGENT = 'android:com.ringapp';
export const RING_API_VERSION = '11';

// Firebase credentials from Ring's official Android app (public, hardcoded in the app binary)
export const FCM_SENDER_ID = '876313859327';
export const FCM_APP_ID = '1:876313859327:android:e10ec6ddb3c81f39';
export const FCM_PROJECT_ID = 'ring-17770';
export const FCM_API_KEY = 'AIzaSyCv-hdFBmmdBBJadNy-TFwB-xN_H5m3Bk8';

// Polling interval in milliseconds
export const POLL_INTERVAL_MS = 30_000;

// Max event IDs to track for deduplication before evicting oldest
export const DEDUP_MAX_SIZE = 1000;

// Namespace UUID for hardware_id generation (from python-ring-doorbell)
export const HARDWARE_ID_NAMESPACE = '379378b0-f747-4b67-a10f-3b13327e8879';
