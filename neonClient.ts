import { Activity, User, ImportBatch } from './types';

export interface NeonHealthStatus {
    status: string;
    database: string;
    neonConnected: boolean;
    error: string | null;
    projectId?: string;
    branch?: string;
    timestamp?: string;
    objectStorage?: {
        configured: boolean;
        provider: string;
        region: string;
        bucket: string;
        endpoint: string;
        accessKey: string | null;
    };
}

export const neonApi = {
    // Check Backend & Neon Database Health
    checkHealth: async (): Promise<NeonHealthStatus> => {
        try {
            const res = await fetch('/api/health');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e: any) {
            return {
                status: 'error',
                database: 'offline',
                neonConnected: false,
                error: e.message || 'Falha de conexão com o servidor'
            };
        }
    },

    // Users
    getUsers: async (): Promise<User[]> => {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Falha ao obter usuários');
        return await res.json();
    },

    saveUser: async (user: User): Promise<void> => {
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        });
        if (!res.ok) throw new Error('Falha ao salvar usuário');
    },

    deleteUser: async (username: string): Promise<void> => {
        const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Falha ao excluir usuário');
    },

    // Activities
    getActivities: async (): Promise<Activity[]> => {
        const res = await fetch('/api/activities');
        if (!res.ok) throw new Error('Falha ao obter atividades');
        return await res.json();
    },

    saveActivity: async (activity: Activity): Promise<void> => {
        const res = await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activity)
        });
        if (!res.ok) throw new Error('Falha ao salvar atividade');
    },

    saveActivitiesBulk: async (activities: Activity[]): Promise<void> => {
        const res = await fetch('/api/activities/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activities)
        });
        if (!res.ok) throw new Error('Falha ao salvar lote de atividades');
    },

    deleteActivity: async (id: string): Promise<void> => {
        const res = await fetch(`/api/activities/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Falha ao excluir atividade');
    },

    // Batches
    getImportBatches: async (): Promise<ImportBatch[]> => {
        const res = await fetch('/api/import-batches');
        if (!res.ok) throw new Error('Falha ao obter lotes');
        return await res.json();
    },

    saveImportBatch: async (batch: ImportBatch): Promise<void> => {
        const res = await fetch('/api/import-batches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batch)
        });
        if (!res.ok) throw new Error('Falha ao salvar lote');
    },

    deleteImportBatch: async (batchId: string): Promise<void> => {
        const res = await fetch(`/api/import-batches/${encodeURIComponent(batchId)}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Falha ao excluir lote');
    },

    // File Upload Replacement
    uploadFile: async (file: File): Promise<string> => {
        const toBase64 = (f: File): Promise<string> =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(f);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = err => reject(err);
            });

        const base64Data = await toBase64(file);

        try {
            const res = await fetch('/api/files/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    mimeType: file.type,
                    data: base64Data
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.url) return data.url;
            }
        } catch (e) {
            console.warn('[Neon File Upload] Falha no upload remoto, usando Base64 inline:', e);
        }

        return base64Data;
    },

    // Migration helper
    migrateData: async (payload: { users?: User[]; activities?: Activity[]; batches?: ImportBatch[] }) => {
        const res = await fetch('/api/migrate-from-supabase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    },

    // Secure Neon Credentials Configuration (PostgreSQL and Neon Object Storage S3)
    configureNeon: async (
        input: string | { 
            connectionString?: string; 
            apiKey?: string; 
            awsAccessKeyId?: string; 
            awsSecretAccessKey?: string; 
            awsRegion?: string; 
            awsEndpointUrlS3?: string; 
        }, 
        apiKey?: string
    ): Promise<{ success: boolean; message: string; neonConnected?: boolean }> => {
        const payload = typeof input === 'string' ? { connectionString: input, apiKey } : input;
        const res = await fetch('/api/configure-neon', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await res.json();
    }
};
