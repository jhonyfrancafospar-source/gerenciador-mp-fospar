import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { neon } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockActivities, mockUsers } from './data/mockData';

dotenv.config();

// Neon PostgreSQL default credentials
const DEFAULT_POSTGRES_URL = 'postgresql://neondb_owner:npg_W1jiBRQkp9Hf@ep-restless-bread-b5h2yx96-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith('http://') || process.env.DATABASE_URL.startsWith('https://')) {
    process.env.DATABASE_URL = DEFAULT_POSTGRES_URL;
}

// Ensure Neon Object Storage credentials are initialized
if (!process.env.AWS_ACCESS_KEY_ID) {
    process.env.AWS_ACCESS_KEY_ID = 'nak_live_f7618e593c7b490caeb03fddbb413f74';
}
if (!process.env.AWS_SECRET_ACCESS_KEY) {
    process.env.AWS_SECRET_ACCESS_KEY = 'nsk_live_1a0187b098a0b90c03e2f9dddecb5f60c3590ca56a21a9d8a47c2db50f5a5791';
}
if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = 'us-east-2';
}
if (!process.env.AWS_ENDPOINT_URL_S3) {
    process.env.AWS_ENDPOINT_URL_S3 = 'https://ep-restless-bread-b5h2yx96.storage.us-east-2.aws.neon.tech';
}

// Neon Object Storage S3 Client Helper
let s3ClientInstance: S3Client | null = null;
const getS3Client = () => {
    const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
    const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
    const region = (process.env.AWS_REGION || 'us-east-2').trim();
    const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || 'https://ep-restless-bread-b5h2yx96.storage.us-east-2.aws.neon.tech').trim();
    const bucket = (process.env.AWS_S3_BUCKET || 'app-files').trim();

    if (accessKeyId && secretAccessKey) {
        if (!s3ClientInstance) {
            s3ClientInstance = new S3Client({
                region,
                endpoint,
                forcePathStyle: true,
                credentials: {
                    accessKeyId,
                    secretAccessKey,
                }
            });
        }
        return { client: s3ClientInstance, bucket, endpoint, region, configured: true, accessKeyId };
    }
    return { client: null, bucket, endpoint, region, configured: false, accessKeyId: null };
};

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory cache / fallback store when Neon DATABASE_URL is not yet connected
let memoryUsers = [...mockUsers];
let memoryActivities = [...mockActivities];
let memoryBatches: any[] = [];
let memoryFiles = new Map<string, { name: string; mimeType: string; data: string }>();

let isNeonConnected = false;
let neonError: string | null = null;
let cachedSql: any = null;
let cachedDbUrl: string | null = null;

const isValidPostgresUrl = (url: string): boolean => {
    const trimmed = url.trim();
    return trimmed.startsWith('postgres://') || trimmed.startsWith('postgresql://');
};

const getDb = () => {
    let rawUrl = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
    if (!rawUrl || rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
        rawUrl = DEFAULT_POSTGRES_URL;
        process.env.DATABASE_URL = DEFAULT_POSTGRES_URL;
    }

    if (rawUrl === cachedDbUrl && cachedSql) {
        return cachedSql;
    }

    if (!isValidPostgresUrl(rawUrl)) {
        neonError = 'Formato de conexão incompatível. O formato esperado para o driver Neon é: postgresql://user:password@host/dbname?sslmode=require. Operando em modo seguro local/memória.';
        isNeonConnected = false;
        cachedSql = null;
        cachedDbUrl = rawUrl;
        return null;
    }

    try {
        cachedSql = neon(rawUrl);
        cachedDbUrl = rawUrl;
        return cachedSql;
    } catch (e: any) {
        neonError = `Falha ao inicializar driver Neon: ${e.message || e}`;
        isNeonConnected = false;
        cachedSql = null;
        cachedDbUrl = rawUrl;
        return null;
    }
};

// Initialize Neon Database schema and tables
async function initNeonDatabase() {
    const sql = getDb();
    if (!sql) {
        isNeonConnected = false;
        if (!neonError) {
            neonError = 'DATABASE_URL não configurada no ambiente. Operando com armazenamento em memória / local.';
        }
        console.log(`[Neon] ${neonError}`);
        return;
    }

    try {
        console.log('[Neon] Conectando ao Lakebase Postgres Neon e verificando tabelas...');
        
        // 1. Create tables if not exist
        await sql`
            CREATE TABLE IF NOT EXISTS app_users (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL,
                name TEXT,
                role TEXT,
                profile_picture TEXT,
                background_image TEXT,
                logo_light TEXT,
                logo_dark TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS activities (
                id TEXT PRIMARY KEY,
                json_data JSONB NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS import_batches (
                id TEXT PRIMARY KEY,
                json_data JSONB NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `;

        await sql`
            CREATE TABLE IF NOT EXISTS app_files (
                id TEXT PRIMARY KEY,
                name TEXT,
                mime_type TEXT,
                data TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `;

        // 2. Check and seed initial users if table is empty
        const userCountResult = await sql`SELECT count(*)::int as count FROM app_users`;
        const userCount = userCountResult[0]?.count || 0;
        if (userCount === 0 && mockUsers.length > 0) {
            console.log('[Neon] Tabela app_users vazia. Migrando e semeando usuários iniciais...');
            for (const u of mockUsers) {
                await sql`
                    INSERT INTO app_users (username, password, name, role)
                    VALUES (${u.username}, ${u.password}, ${u.name}, ${u.role})
                    ON CONFLICT (username) DO NOTHING
                `;
            }
            console.log(`[Neon] ${mockUsers.length} usuários migrados para o Neon.`);
        }

        // 3. Check and seed initial activities if table is empty
        const actCountResult = await sql`SELECT count(*)::int as count FROM activities`;
        const actCount = actCountResult[0]?.count || 0;
        if (actCount === 0 && mockActivities.length > 0) {
            console.log('[Neon] Tabela activities vazia. Migrando e semeando atividades iniciais...');
            for (const act of mockActivities) {
                await sql`
                    INSERT INTO activities (id, json_data)
                    VALUES (${act.id}, ${JSON.stringify(act)})
                    ON CONFLICT (id) DO UPDATE SET json_data = EXCLUDED.json_data
                `;
            }
            console.log(`[Neon] ${mockActivities.length} atividades migradas para o Neon.`);
        }

        isNeonConnected = true;
        neonError = null;
        console.log('[Neon] Conexão com Neon estabelecida e esquema validado com sucesso!');
    } catch (e: any) {
        isNeonConnected = false;
        neonError = e.message || 'Erro ao conectar ao Neon';
        console.error('[Neon] Erro de inicialização:', e.message);
    }
}

// ==========================================
// API ROUTES
// ==========================================

// Health & Status
app.get('/api/health', async (_req, res) => {
    const rawUrl = (process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
    const endpointMatch = rawUrl.match(/(ep-[a-z0-9-]+)/i);
    const detectedEndpoint = endpointMatch ? endpointMatch[1] : 'wandering-meadow-60601948';

    const sql = getDb();
    if (sql && !isNeonConnected) {
        await initNeonDatabase();
    }
    const s3Info = getS3Client();
    res.json({
        status: 'ok',
        database: isNeonConnected ? 'neon' : 'memory_fallback',
        neonConnected: isNeonConnected,
        error: neonError,
        projectId: detectedEndpoint,
        branch: 'production',
        objectStorage: {
            configured: s3Info.configured,
            provider: 'Neon Object Storage (S3)',
            region: s3Info.region,
            bucket: s3Info.bucket,
            endpoint: s3Info.endpoint,
            accessKey: s3Info.accessKeyId ? `${s3Info.accessKeyId.substring(0, 12)}...` : null
        },
        timestamp: new Date().toISOString()
    });
});

// USERS
app.get('/api/users', async (_req, res) => {
    const sql = getDb();
    if (isNeonConnected && sql) {
        try {
            const rows = await sql`SELECT * FROM app_users ORDER BY name ASC`;
            const users = rows.map((u: any) => ({
                username: u.username,
                password: u.password,
                name: u.name,
                role: (u.role || 'user').toLowerCase(),
                profilePicture: u.profile_picture || null,
                backgroundImage: u.background_image || null,
                logoLight: u.logo_light || null,
                logoDark: u.logo_dark || null
            }));
            return res.json(users);
        } catch (e: any) {
            console.error('[Neon Users GET Error]:', e);
        }
    }
    res.json(memoryUsers);
});

app.post('/api/users', async (req, res) => {
    try {
        const u = req.body;
        if (!u || !u.username) {
            return res.status(400).json({ error: 'Username é obrigatório' });
        }

        const username = String(u.username).trim();
        const password = u.password || '123';
        const name = u.name || username;
        const role = (u.role || 'user').toLowerCase();
        const profilePicture = u.profilePicture !== undefined ? u.profilePicture : (u.profile_picture || null);
        const backgroundImage = u.backgroundImage !== undefined ? u.backgroundImage : (u.background_image || null);
        const logoLight = u.logoLight !== undefined ? u.logoLight : (u.logo_light || null);
        const logoDark = u.logoDark !== undefined ? u.logoDark : (u.logo_dark || null);

        const sql = getDb();
        if (isNeonConnected && sql) {
            try {
                await sql`
                    INSERT INTO app_users (username, password, name, role, profile_picture, background_image, logo_light, logo_dark)
                    VALUES (
                        ${username},
                        ${password},
                        ${name},
                        ${role},
                        ${profilePicture},
                        ${backgroundImage},
                        ${logoLight},
                        ${logoDark}
                    )
                    ON CONFLICT (username) DO UPDATE SET
                        password = EXCLUDED.password,
                        name = EXCLUDED.name,
                        role = EXCLUDED.role,
                        profile_picture = COALESCE(EXCLUDED.profile_picture, app_users.profile_picture),
                        background_image = COALESCE(EXCLUDED.background_image, app_users.background_image),
                        logo_light = COALESCE(EXCLUDED.logo_light, app_users.logo_light),
                        logo_dark = COALESCE(EXCLUDED.logo_dark, app_users.logo_dark)
                `;
                return res.json({ success: true, user: { ...u, username, name, role } });
            } catch (e: any) {
                console.warn('[Neon Users POST Notice]:', e.message || e);
            }
        }

        // Memory fallback
        const idx = memoryUsers.findIndex(item => item.username.toLowerCase() === username.toLowerCase());
        if (idx >= 0) memoryUsers[idx] = { ...memoryUsers[idx], ...u, username };
        else memoryUsers.push({ ...u, username });
        return res.json({ success: true, user: u, fallback: true });
    } catch (err: any) {
        console.error('[Users POST Error]:', err);
        return res.status(500).json({ error: err.message || 'Erro ao processar usuário' });
    }
});

app.post('/api/users/bulk', async (req, res) => {
    try {
        const users = req.body;
        if (!Array.isArray(users)) {
            return res.status(400).json({ error: 'Array de usuários esperado' });
        }

        const validUsers = users.filter(u => u && typeof u === 'object' && u.username);
        const sql = getDb();
        if (isNeonConnected && sql) {
            try {
                for (const u of validUsers) {
                    const username = String(u.username).trim();
                    const password = u.password || '123';
                    const name = u.name || username;
                    const role = (u.role || 'user').toLowerCase();
                    const profilePicture = u.profilePicture !== undefined ? u.profilePicture : (u.profile_picture || null);
                    const backgroundImage = u.backgroundImage !== undefined ? u.backgroundImage : (u.background_image || null);
                    const logoLight = u.logoLight !== undefined ? u.logoLight : (u.logo_light || null);
                    const logoDark = u.logoDark !== undefined ? u.logoDark : (u.logo_dark || null);

                    await sql`
                        INSERT INTO app_users (username, password, name, role, profile_picture, background_image, logo_light, logo_dark)
                        VALUES (
                            ${username},
                            ${password},
                            ${name},
                            ${role},
                            ${profilePicture},
                            ${backgroundImage},
                            ${logoLight},
                            ${logoDark}
                        )
                        ON CONFLICT (username) DO UPDATE SET
                            password = EXCLUDED.password,
                            name = EXCLUDED.name,
                            role = EXCLUDED.role,
                            profile_picture = COALESCE(EXCLUDED.profile_picture, app_users.profile_picture),
                            background_image = COALESCE(EXCLUDED.background_image, app_users.background_image),
                            logo_light = COALESCE(EXCLUDED.logo_light, app_users.logo_light),
                            logo_dark = COALESCE(EXCLUDED.logo_dark, app_users.logo_dark)
                    `;
                }
                return res.json({ success: true, count: validUsers.length });
            } catch (e: any) {
                console.warn('[Neon Bulk Users Notice]:', e.message || e);
            }
        }

        // Memory fallback
        for (const u of validUsers) {
            const username = String(u.username).trim();
            const idx = memoryUsers.findIndex(item => item.username.toLowerCase() === username.toLowerCase());
            if (idx >= 0) memoryUsers[idx] = { ...memoryUsers[idx], ...u, username };
            else memoryUsers.push({ ...u, username });
        }

        return res.json({ success: true, count: validUsers.length, fallback: true });
    } catch (err: any) {
        console.error('[Users Bulk Error]:', err);
        return res.status(500).json({ error: err.message || 'Erro ao sincronizar lote de usuários' });
    }
});

app.delete('/api/users/:username', async (req, res) => {
    const { username } = req.params;
    const sql = getDb();
    if (isNeonConnected && sql) {
        try {
            await sql`DELETE FROM app_users WHERE username = ${username}`;
            return res.json({ success: true });
        } catch (e: any) {
            console.error('[Neon Users DELETE Error]:', e);
        }
    }
    memoryUsers = memoryUsers.filter(u => u.username !== username);
    res.json({ success: true, fallback: true });
});

// ACTIVITIES
app.get('/api/activities', async (_req, res) => {
    const sql = getDb();
    if (isNeonConnected && sql) {
        try {
            const rows = await sql`SELECT id, json_data FROM activities`;
            const activities = rows.map((r: any) => r.json_data || r);
            return res.json(activities);
        } catch (e: any) {
            console.error('[Neon Activities GET Error]:', e);
        }
    }
    res.json(memoryActivities);
});

app.post('/api/activities', async (req, res) => {
    try {
        let activity = req.body;
        if (!activity || typeof activity !== 'object') {
            return res.status(400).json({ error: 'Objeto de atividade inválido' });
        }

        // Garante ID textual não vazio
        const id = (activity.id !== undefined && activity.id !== null && String(activity.id).trim() !== '')
            ? String(activity.id).trim()
            : `act_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        
        activity = { ...activity, id };

        const sql = getDb();
        if (isNeonConnected && sql) {
            try {
                const jsonStr = JSON.stringify(activity);
                await sql`
                    INSERT INTO activities (id, json_data, updated_at)
                    VALUES (${id}, ${jsonStr}::jsonb, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        json_data = EXCLUDED.json_data,
                        updated_at = NOW()
                `;
                return res.json({ success: true, activity });
            } catch (e: any) {
                console.warn('[Neon Activities POST Notice]:', e.message || e);
            }
        }

        const idx = memoryActivities.findIndex(a => String(a.id) === id);
        if (idx >= 0) memoryActivities[idx] = activity;
        else memoryActivities.push(activity);
        return res.json({ success: true, activity, fallback: true });
    } catch (err: any) {
        console.error('[Activities POST Error]:', err);
        return res.status(500).json({ error: err.message || 'Erro ao processar atividade' });
    }
});

app.post('/api/activities/bulk', async (req, res) => {
    try {
        const activities = req.body;
        if (!Array.isArray(activities)) {
            return res.status(400).json({ error: 'Array de atividades esperado' });
        }

        const sanitized = activities.map((act, index) => {
            if (!act || typeof act !== 'object') return null;
            const id = (act.id !== undefined && act.id !== null && String(act.id).trim() !== '')
                ? String(act.id).trim()
                : `act_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`;
            return { ...act, id };
        }).filter(Boolean);

        const sql = getDb();
        if (isNeonConnected && sql) {
            try {
                for (const act of sanitized) {
                    if (act && act.id) {
                        const jsonStr = JSON.stringify(act);
                        await sql`
                            INSERT INTO activities (id, json_data, updated_at)
                            VALUES (${act.id}, ${jsonStr}::jsonb, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                json_data = EXCLUDED.json_data,
                                updated_at = NOW()
                        `;
                    }
                }
                return res.json({ success: true, count: sanitized.length });
            } catch (e: any) {
                console.warn('[Neon Bulk Activities POST Notice]:', e.message || e);
            }
        }

        for (const act of sanitized) {
            if (!act?.id) continue;
            const idx = memoryActivities.findIndex(a => String(a.id) === String(act.id));
            if (idx >= 0) memoryActivities[idx] = act;
            else memoryActivities.push(act);
        }
        return res.json({ success: true, count: sanitized.length, fallback: true });
    } catch (err: any) {
        console.error('[Activities Bulk Error]:', err);
        return res.status(500).json({ error: err.message || 'Erro ao processar lote' });
    }
});

app.delete('/api/activities/:id', async (req, res) => {
    const { id } = req.params;
    const sql = getDb();
    if (isNeonConnected && sql) {
        try {
            await sql`DELETE FROM activities WHERE id = ${id}`;
            return res.json({ success: true });
        } catch (e: any) {
            console.error('[Neon Activities DELETE Error]:', e);
        }
    }
    memoryActivities = memoryActivities.filter(a => a.id !== id);
    res.json({ success: true, fallback: true });
});

// IMPORT BATCHES
app.get('/api/import-batches', async (_req, res) => {
    const sql = getDb();
    if (isNeonConnected && sql) {
        try {
            const rows = await sql`SELECT id, json_data FROM import_batches ORDER BY created_at DESC`;
            const batches = rows.map((r: any) => r.json_data || r);
            return res.json(batches);
        } catch (e: any) {
            console.error('[Neon Batches GET Error]:', e);
        }
    }
    res.json(memoryBatches);
});

app.post('/api/import-batches', async (req, res) => {
    try {
        let batch = req.body;
        if (!batch || typeof batch !== 'object') {
            return res.status(400).json({ error: 'Lote de importação inválido' });
        }

        const id = (batch.id !== undefined && batch.id !== null && String(batch.id).trim() !== '')
            ? String(batch.id).trim()
            : `batch_${Date.now()}`;
        batch = { ...batch, id };

        const sql = getDb();
        if (isNeonConnected && sql) {
            try {
                const jsonStr = JSON.stringify(batch);
                await sql`
                    INSERT INTO import_batches (id, json_data, created_at)
                    VALUES (${id}, ${jsonStr}::jsonb, NOW())
                    ON CONFLICT (id) DO UPDATE SET json_data = EXCLUDED.json_data
                `;
                return res.json({ success: true, batch });
            } catch (e: any) {
                console.warn('[Neon Batches POST Notice]:', e.message || e);
            }
        }

        const idx = memoryBatches.findIndex(b => String(b.id) === id);
        if (idx >= 0) memoryBatches[idx] = batch;
        else memoryBatches.push(batch);
        return res.json({ success: true, batch, fallback: true });
    } catch (err: any) {
        console.error('[Batches POST Error]:', err);
        return res.status(500).json({ error: err.message || 'Erro ao processar lote' });
    }
});

app.delete('/api/import-batches/:id', async (req, res) => {
    const { id } = req.params;
    const sql = getDb();
    if (isNeonConnected && sql) {
        try {
            await sql`DELETE FROM import_batches WHERE id = ${id}`;
            return res.json({ success: true });
        } catch (e: any) {
            console.error('[Neon Batches DELETE Error]:', e);
        }
    }
    memoryBatches = memoryBatches.filter(b => b.id !== id);
    res.json({ success: true, fallback: true });
});

// FILE STORAGE (Neon Object Storage S3 + Neon PostgreSQL / In-Memory Fallback)
app.post('/api/files/upload', async (req, res) => {
    try {
        const { name, mimeType, data } = req.body;
        if (!data) {
            return res.status(400).json({ error: 'Arquivo vazio ou formato inválido' });
        }

        const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const safeName = (name || 'arquivo').replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileMime = mimeType || 'application/octet-stream';

        // Attempt Neon Object Storage (S3) upload if configured
        const s3Info = getS3Client();
        if (s3Info.configured && s3Info.client) {
            try {
                let fileBuffer: Buffer;
                if (data.startsWith('data:')) {
                    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    fileBuffer = matches && matches[2] ? Buffer.from(matches[2], 'base64') : Buffer.from(data, 'base64');
                } else {
                    fileBuffer = Buffer.from(data, 'base64');
                }

                await s3Info.client.send(new PutObjectCommand({
                    Bucket: s3Info.bucket,
                    Key: `uploads/${fileId}_${safeName}`,
                    Body: fileBuffer,
                    ContentType: fileMime
                }));
                console.log(`[Neon Object Storage] Arquivo ${safeName} enviado para o bucket ${s3Info.bucket}`);
            } catch (s3Err: any) {
                console.warn('[Neon Object Storage S3 upload aviso]:', s3Err.message || s3Err);
            }
        }

        const sql = getDb();
        if (isNeonConnected && sql) {
            try {
                await sql`
                    INSERT INTO app_files (id, name, mime_type, data, created_at)
                    VALUES (${fileId}, ${safeName}, ${fileMime}, ${data}, NOW())
                `;
                return res.json({
                    success: true,
                    url: `/api/files/${fileId}`,
                    fileId,
                    name: safeName
                });
            } catch (e: any) {
                console.error('[Neon File Upload Error]:', e);
            }
        }

        // Memory fallback
        memoryFiles.set(fileId, { name: safeName, mimeType: fileMime, data });
        res.json({
            success: true,
            url: `/api/files/${fileId}`,
            fileId,
            name: safeName,
            fallback: true
        });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/files/:id', async (req, res) => {
    const { id } = req.params;
    const sql = getDb();

    if (isNeonConnected && sql) {
        try {
            const rows = await sql`SELECT name, mime_type, data FROM app_files WHERE id = ${id} LIMIT 1`;
            if (rows.length > 0) {
                const file = rows[0];
                if (file.data.startsWith('data:')) {
                    const matches = file.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const buffer = Buffer.from(matches[2], 'base64');
                        res.setHeader('Content-Type', matches[1]);
                        return res.send(buffer);
                    }
                }
                res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
                return res.send(Buffer.from(file.data, 'base64'));
            }
        } catch (e: any) {
            console.error('[Neon File GET Error]:', e);
        }
    }

    const mem = memoryFiles.get(id);
    if (mem) {
        if (mem.data.startsWith('data:')) {
            const matches = mem.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const buffer = Buffer.from(matches[2], 'base64');
                res.setHeader('Content-Type', matches[1]);
                return res.send(buffer);
            }
        }
        res.setHeader('Content-Type', mem.mimeType);
        return res.send(Buffer.from(mem.data, 'base64'));
    }

    res.status(404).json({ error: 'Arquivo não encontrado' });
});

// MIGRATE FROM SUPABASE / LOCALSTORAGE SYNC ENDPOINT
app.post('/api/migrate-from-supabase', async (req, res) => {
    const { users, activities, batches } = req.body;
    const sql = getDb();

    let migratedUsersCount = 0;
    let migratedActivitiesCount = 0;
    let migratedBatchesCount = 0;

    if (isNeonConnected && sql) {
        try {
            if (Array.isArray(users)) {
                for (const u of users) {
                    if (u && u.username) {
                        await sql`
                            INSERT INTO app_users (username, password, name, role, profile_picture, background_image, logo_light, logo_dark)
                            VALUES (
                                ${u.username},
                                ${u.password || '123'},
                                ${u.name || u.username},
                                ${(u.role || 'user').toLowerCase()},
                                ${u.profilePicture || u.profile_picture || null},
                                ${u.backgroundImage || u.background_image || null},
                                ${u.logoLight || u.logo_light || null},
                                ${u.logoDark || u.logo_dark || null}
                            )
                            ON CONFLICT (username) DO UPDATE SET
                                password = EXCLUDED.password,
                                name = EXCLUDED.name,
                                role = EXCLUDED.role,
                                profile_picture = EXCLUDED.profile_picture,
                                background_image = EXCLUDED.background_image
                        `;
                        migratedUsersCount++;
                    }
                }
            }

            if (Array.isArray(activities)) {
                for (const act of activities) {
                    if (act && act.id) {
                        await sql`
                            INSERT INTO activities (id, json_data, updated_at)
                            VALUES (${act.id}, ${JSON.stringify(act)}, NOW())
                            ON CONFLICT (id) DO UPDATE SET
                                json_data = EXCLUDED.json_data,
                                updated_at = NOW()
                        `;
                        migratedActivitiesCount++;
                    }
                }
            }

            if (Array.isArray(batches)) {
                for (const b of batches) {
                    if (b && b.id) {
                        await sql`
                            INSERT INTO import_batches (id, json_data, created_at)
                            VALUES (${b.id}, ${JSON.stringify(b)}, NOW())
                            ON CONFLICT (id) DO UPDATE SET json_data = EXCLUDED.json_data
                        `;
                        migratedBatchesCount++;
                    }
                }
            }

            return res.json({
                success: true,
                message: 'Migração concluída com sucesso para o Neon PostgreSQL!',
                migrated: {
                    users: migratedUsersCount,
                    activities: migratedActivitiesCount,
                    batches: migratedBatchesCount
                }
            });
        } catch (e: any) {
            console.error('[Migration to Neon Error]:', e);
            return res.status(500).json({ error: e.message });
        }
    }

    // Memory fallback sync
    if (Array.isArray(users)) memoryUsers = users;
    if (Array.isArray(activities)) memoryActivities = activities;
    if (Array.isArray(batches)) memoryBatches = batches;

    res.json({
        success: true,
        message: 'Dados sincronizados no armazenamento em memória / local.',
        migrated: {
            users: users?.length || 0,
            activities: activities?.length || 0,
            batches: batches?.length || 0
        },
        fallback: true
    });
});

// SECURE NEON DATABASE & API CREDENTIALS CONFIGURATION ENDPOINT
app.post('/api/configure-neon', async (req, res) => {
    const { 
        connectionString, 
        apiKey, 
        awsAccessKeyId, 
        awsSecretAccessKey, 
        awsRegion, 
        awsEndpointUrlS3, 
        awsBucket 
    } = req.body;

    if (awsAccessKeyId && typeof awsAccessKeyId === 'string') {
        process.env.AWS_ACCESS_KEY_ID = awsAccessKeyId.trim();
    }
    if (awsSecretAccessKey && typeof awsSecretAccessKey === 'string') {
        process.env.AWS_SECRET_ACCESS_KEY = awsSecretAccessKey.trim();
    }
    if (awsRegion && typeof awsRegion === 'string') {
        process.env.AWS_REGION = awsRegion.trim();
    }
    if (awsEndpointUrlS3 && typeof awsEndpointUrlS3 === 'string') {
        process.env.AWS_ENDPOINT_URL_S3 = awsEndpointUrlS3.trim();
    }
    if (awsBucket && typeof awsBucket === 'string') {
        process.env.AWS_S3_BUCKET = awsBucket.trim();
    }
    s3ClientInstance = null; // reset client to reload new credentials

    if (apiKey && typeof apiKey === 'string') {
        process.env.NEON_API_KEY = apiKey.trim();
    }

    if (!connectionString || typeof connectionString !== 'string' || !connectionString.trim()) {
        if (awsAccessKeyId || awsSecretAccessKey) {
            return res.json({
                success: true,
                message: 'Credenciais do Neon Object Storage (S3) configuradas e ativadas com sucesso!',
                neonConnected: isNeonConnected
            });
        }
        return res.status(400).json({ 
            success: false, 
            message: 'Nenhuma string de conexão foi informada.' 
        });
    }

    const trimmed = connectionString.trim();

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return res.status(400).json({
            success: false,
            message: 'A URL informada é do Data API (REST). Para conexão com o PostgreSQL, use a string de conexão no formato: postgresql://neondb_owner:[senha]@[endpoint].us-east-2.aws.neon.tech/neondb?sslmode=require (disponível no Neon em Dashboard -> Connection Details).'
        });
    }

    if (!isValidPostgresUrl(trimmed)) {
        return res.status(400).json({
            success: false,
            message: 'Formato inválido. A string de conexão deve começar com "postgresql://" ou "postgres://". Exemplo: postgresql://[usuario]:[senha]@[host]/[banco]?sslmode=require'
        });
    }

    try {
        const testSql = neon(trimmed);
        const result = await testSql`SELECT 1 as connected`;
        if (result && result[0]?.connected === 1) {
            process.env.DATABASE_URL = trimmed;
            cachedDbUrl = trimmed;
            cachedSql = testSql;
            neonError = null;
            isNeonConnected = true;

            await initNeonDatabase();

            return res.json({
                success: true,
                message: 'Conexão com o Neon PostgreSQL validada e ativada com sucesso!',
                neonConnected: true
            });
        } else {
            return res.status(400).json({
                success: false,
                message: 'Falha ao executar query de validação no Neon.'
            });
        }
    } catch (err: any) {
        return res.status(400).json({
            success: false,
            message: `Erro ao testar a conexão com o Neon: ${err.message || err}`
        });
    }
});

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================

async function startServer() {
    await initNeonDatabase();

    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*all', (_req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`[Neon Server] Rodando na porta ${PORT}`);
    });
}

startServer();
