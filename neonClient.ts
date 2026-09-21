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
        if (!user || !user.username) return;
        try {
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('[NeonClient] Erro ao sincronizar usuário:', err.error || res.statusText);
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de conexão ao salvar usuário:', e.message);
        }
    },

    saveUsersBulk: async (users: User[]): Promise<{ success: boolean; count?: number }> => {
        if (!Array.isArray(users) || users.length === 0) return { success: true, count: 0 };
        try {
            const res = await fetch('/api/users/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(users)
            });
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                return { success: true, count: data.count || users.length };
            } else {
                const err = await res.json().catch(() => ({}));
                console.warn('[NeonClient] Erro ao sincronizar lote de usuários:', err.error || res.statusText);
                return { success: false };
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de rede ao salvar lote de usuários:', e.message);
            return { success: false };
        }
    },

    deleteUser: async (username: string): Promise<void> => {
        if (!username) return;
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(username)}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                console.warn('[NeonClient] Erro ao excluir usuário no backend');
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de rede ao excluir usuário:', e.message);
        }
    },

    // Activities
    getActivities: async (): Promise<Activity[]> => {
        const res = await fetch('/api/activities');
        if (!res.ok) throw new Error('Falha ao obter atividades');
        return await res.json();
    },

    saveActivity: async (activity: Activity): Promise<void> => {
        if (!activity) return;
        const safeActivity = {
            ...activity,
            id: (activity.id !== undefined && activity.id !== null && String(activity.id).trim() !== '')
                ? String(activity.id).trim()
                : `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        };
        try {
            const res = await fetch('/api/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(safeActivity)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('[NeonClient] Aviso ao persistir atividade no backend:', err.error || res.statusText);
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de conexão ao persistir atividade (mantida localmente):', e.message);
        }
    },

    saveActivitiesBulk: async (activities: Activity[]): Promise<void> => {
        if (!Array.isArray(activities) || activities.length === 0) return;
        const sanitized = activities.map((act, i) => ({
            ...act,
            id: (act.id !== undefined && act.id !== null && String(act.id).trim() !== '')
                ? String(act.id).trim()
                : `act_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`
        }));
        try {
            const res = await fetch('/api/activities/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sanitized)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn('[NeonClient] Aviso ao persistir lote no backend:', err.error || res.statusText);
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de conexão ao persistir lote:', e.message);
        }
    },

    deleteActivity: async (id: string): Promise<void> => {
        if (!id) return;
        try {
            const res = await fetch(`/api/activities/${encodeURIComponent(id)}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                console.warn('[NeonClient] Aviso ao excluir atividade no backend');
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de conexão ao excluir atividade:', e.message);
        }
    },

    // Batches
    getImportBatches: async (): Promise<ImportBatch[]> => {
        const res = await fetch('/api/import-batches');
        if (!res.ok) throw new Error('Falha ao obter lotes');
        return await res.json();
    },

    saveImportBatch: async (batch: ImportBatch): Promise<void> => {
        if (!batch) return;
        const safeBatch = {
            ...batch,
            id: (batch.id !== undefined && batch.id !== null && String(batch.id).trim() !== '')
                ? String(batch.id).trim()
                : `batch_${Date.now()}`
        };
        try {
            const res = await fetch('/api/import-batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(safeBatch)
            });
            if (!res.ok) {
                console.warn('[NeonClient] Aviso ao persistir lote no backend');
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de conexão ao salvar lote:', e.message);
        }
    },

    deleteImportBatch: async (batchId: string): Promise<void> => {
        if (!batchId) return;
        try {
            const res = await fetch(`/api/import-batches/${encodeURIComponent(batchId)}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                console.warn('[NeonClient] Aviso ao excluir lote no backend');
            }
        } catch (e: any) {
            console.warn('[NeonClient] Erro de conexão ao excluir lote:', e.message);
        }
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
