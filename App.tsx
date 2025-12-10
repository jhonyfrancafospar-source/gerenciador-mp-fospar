
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ActivityListView } from './components/ActivityListView';
import { ActivityBoardView } from './components/ActivityBoardView';
import { ActivityGanttView } from './components/ActivityGanttView';
import { ReportView } from './components/ReportView';
import { AuditLogView } from './components/AuditLogView';
import { ManPowerView } from './components/ManPowerView';
import { ActivityCalendarView } from './components/ActivityCalendarView';
import { Modal } from './components/Modal';
import { ActivityForm } from './components/ActivityForm';
import { LoginView } from './components/LoginView';
import { ImportMappingModal } from './components/ImportMappingModal';
import { mockActivities, mockUsers } from './data/mockData';
import { Activity, ViewType, FilterType, ActivityStatus, Criticidade, AuditLogEntry, User, ImportMapping, ImportBatch, Recorrencia, Attachment } from './types';
import { PlusIcon } from './components/icons/PlusIcon';
import { ImageViewerModal } from './components/ImageViewerModal';
import { PhotoIcon } from './components/icons/PhotoIcon';
import { UserIcon } from './components/icons/UserIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { PencilIcon } from './components/icons/PencilIcon';
import { supabase } from './supabaseClient'; 

const App: React.FC = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
            const storedTheme = window.localStorage.getItem('theme');
            if (storedTheme === 'dark' || storedTheme === 'light') {
                return storedTheme;
            }
        }
        return 'light';
    });

    const [users, setUsers] = useState<User[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    
    const [user, setUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | undefined>();
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    
    // Status connection
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [pendingImportData, setPendingImportData] = useState<any[]>([]);
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
    const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
    const [initialMapping, setInitialMapping] = useState<ImportMapping | undefined>(undefined);

    const [filters, setFilters] = useState<FilterType>({ 
        turno: 'all', 
        responsavel: 'all', 
        supervisor: 'all',
        idMp: '',
        onlyMyActivities: false
    });

    const [statusLabels, setStatusLabels] = useState<Record<string, string>>(() => {
        const stored = localStorage.getItem('statusLabels');
        if (stored) return JSON.parse(stored);
        return {
            [ActivityStatus.Open]: 'Aberto',
            [ActivityStatus.NaoExecutado]: 'Não Executado',
            [ActivityStatus.EmProgresso]: 'Em Andamento',
            [ActivityStatus.ExecutadoParcialmente]: 'Parcial',
            [ActivityStatus.Closed]: 'Concluído',
        };
    });

    // --- DATA LOADING & SUPABASE ---
    
    const logMissingTablesError = () => {
        if (!isSupabaseConnected) return; // Prevent spam
        console.warn("SUPABASE: Tabelas não encontradas. O App funcionará em modo OFFLINE.");
        console.warn("Para corrigir, execute o SQL no editor do Supabase (Ver documentação).");
    };

    useEffect(() => {
        const loadData = async () => {
            // Check connection first
            const { error: healthCheck } = await supabase.from('activities').select('id').limit(1);
            
            if (healthCheck && healthCheck.code === 'PGRST204') {
               // Ignore specific error logic for now, try catch block below is better
            }

            try {
                // 1. Users
                const { data: usersData, error: usersError } = await supabase.from('app_users').select('*');
                if (usersError) throw usersError;
                if (usersData) setUsers(usersData);

                // 2. Activities
                const { data: activitiesData, error: actError } = await supabase.from('activities').select('*');
                if (actError) throw actError;
                if (activitiesData) {
                    // Flatten JSON data if stored in json_data column, or use direct cols if mapped
                    const parsedActivities = activitiesData.map((row: any) => row.json_data || row);
                    setActivities(parsedActivities);
                }

                // 3. Import Batches
                const { data: batchesData, error: batchError } = await supabase.from('import_batches').select('*');
                if (batchError) throw batchError;
                if (batchesData) {
                    const parsedBatches = batchesData.map((row: any) => row.json_data || row);
                    setImportBatches(parsedBatches);
                }

                setIsSupabaseConnected(true);
                console.log("Conectado ao Supabase.");

            } catch (error: any) {
                // Silent fail to local storage if tables missing
                if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
                    setIsSupabaseConnected(false);
                    logMissingTablesError();
                } else {
                    console.error("Erro ao carregar dados do Supabase:", error);
                }
                
                // Fallback to LocalStorage
                const storedUsers = localStorage.getItem('db_users_secure');
                if (storedUsers) setUsers(JSON.parse(storedUsers));
                else setUsers(mockUsers); // Default mocks

                const storedActivities = localStorage.getItem('db_activities');
                if (storedActivities) setActivities(JSON.parse(storedActivities));
                else setActivities(mockActivities);

                const storedBatches = localStorage.getItem('db_import_batches');
                if (storedBatches) setImportBatches(JSON.parse(storedBatches));
            }
        };

        loadData();
    }, []);

    // --- PERSISTENCE (SUPABASE + LOCAL STORAGE FALLBACK) ---

    // Save to LocalStorage whenever state changes (Offline Backup)
    useEffect(() => {
        if (!isSupabaseConnected) {
            localStorage.setItem('db_users_secure', JSON.stringify(users));
        }
    }, [users, isSupabaseConnected]);

    useEffect(() => {
        if (!isSupabaseConnected) {
            localStorage.setItem('db_activities', JSON.stringify(activities));
        }
    }, [activities, isSupabaseConnected]);

    useEffect(() => {
        if (!isSupabaseConnected) {
            localStorage.setItem('db_import_batches', JSON.stringify(importBatches));
        }
    }, [importBatches, isSupabaseConnected]);


    const saveActivityToSupabase = async (activity: Activity) => {
        if (!isSupabaseConnected) return;
        const cleanActivity = JSON.parse(JSON.stringify(activity));
        const { error } = await supabase.from('activities').upsert({
            id: activity.id,
            json_data: cleanActivity
        });
        if (error) {
            if (error.code === '42501') alert("Erro de Permissão (RLS). Execute o script SQL no Supabase.");
            else if (!error.message.includes("does not exist")) console.error('Error saving activity:', error.message);
        }
    };

    const deleteActivityFromSupabase = async (id: string) => {
        if (!isSupabaseConnected) return;
        await supabase.from('activities').delete().eq('id', id);
    };

    const saveUserToSupabase = async (u: User) => {
        if (!isSupabaseConnected) return;
        const { error } = await supabase.from('app_users').upsert(u);
        if (error) {
             if (error.code === '42501') alert("Erro de Permissão (RLS) ao salvar usuário.");
             else if (!error.message.includes("does not exist")) console.error('Error saving user:', error.message);
        }
    };

    const saveBatchToSupabase = async (batch: ImportBatch) => {
        if (!isSupabaseConnected) return;
        const cleanBatch = JSON.parse(JSON.stringify(batch));
        const { error } = await supabase.from('import_batches').upsert({
            id: batch.id,
            json_data: cleanBatch
        });
        if (error && !error.message.includes("does not exist")) console.error('Error saving batch:', error.message);
    };

    const deleteBatchFromSupabase = async (batchId: string) => {
         if (!isSupabaseConnected) return;
         await supabase.from('import_batches').delete().eq('id', batchId);
    };

    // --- FILE UPLOAD (SUPABASE) ---
    
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const uploadFileToSupabase = async (file: File, folder: string = 'misc'): Promise<string | null> => {
        if (!isSupabaseConnected) {
            return await fileToBase64(file); // Fallback offline
        }

        try {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const filePath = `${folder}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('app-files')
                .upload(filePath, file);

            if (error) {
                console.warn("Upload failed (Storage not configured?), falling back to Base64.", error.message);
                return await fileToBase64(file);
            }

            const { data: publicData } = supabase.storage
                .from('app-files')
                .getPublicUrl(filePath);

            return publicData.publicUrl;
        } catch (e) {
            console.error("Upload exec error:", e);
            return await fileToBase64(file);
        }
    };

    // --- THEME ---
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('statusLabels', JSON.stringify(statusLabels));
    }, [statusLabels]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // --- LOGIN LOGIC ---

    const handleLogin = (usernameInput: string, passwordInput: string) => {
        const foundUser = users.find(u => 
            u.username.toLowerCase() === usernameInput.toLowerCase() && 
            u.password === passwordInput
        );
        if (foundUser) {
            setUser(foundUser);
            setLoginError(undefined);
        } else {
            setLoginError('Usuário ou senha incorretos.');
        }
    };

    const handleRegister = async (newUser: User) => {
        const exists = users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase());
        if (exists) {
            alert("Usuário já existe.");
            return;
        }
        
        setUsers(prev => [...prev, newUser]);
        setUser(newUser);
        await saveUserToSupabase(newUser);
    };

    const handleRecoverPassword = (username: string, name: string, newPassword: string): boolean => {
        const userIdx = users.findIndex(u => 
            u.username.toLowerCase() === username.toLowerCase() && 
            u.name.toLowerCase() === name.toLowerCase()
        );
        
        if (userIdx !== -1) {
            const updatedUser = { ...users[userIdx], password: newPassword };
            const newUsers = [...users];
            newUsers[userIdx] = updatedUser;
            setUsers(newUsers);
            saveUserToSupabase(updatedUser);
            return true;
        }
        return false; 
    };

    const handleRecoverUsername = (name: string): string | null => {
        const found = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        return found ? found.username : null;
    };

    const handleLogout = async () => {
        setUser(null);
    };

    // --- ACTION HANDLERS ---

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            const publicUrl = await uploadFileToSupabase(file, `users/${user.username}`);
            if (publicUrl) {
                const updatedUser = { ...user, backgroundImage: publicUrl };
                setUser(updatedUser);
                setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
                await saveUserToSupabase(updatedUser);
            }
        }
    };

    const handleRemoveBackground = async () => {
        if (user) {
             const updatedUser = { ...user, backgroundImage: undefined };
             setUser(updatedUser);
             setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
             await saveUserToSupabase(updatedUser);
        }
    };

    const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            const publicUrl = await uploadFileToSupabase(file, `users/${user.username}`);
            if (publicUrl) {
                const updatedUser = { ...user, profilePicture: publicUrl };
                setUser(updatedUser);
                setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
                await saveUserToSupabase(updatedUser);
            }
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'light' | 'dark') => {
        if (e.target.files && e.target.files[0] && user && user.role === 'admin') {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert("A imagem é muito grande. Use uma imagem menor que 2MB.");
                e.target.value = '';
                return;
            }

            try {
                // Use explicit alert for feedback since it might take a moment if doing base64 fallback
                const publicUrl = await uploadFileToSupabase(file, `system/logos`);
                
                if (publicUrl) {
                    const updatedUser = {
                        ...user,
                        [type === 'light' ? 'logoLight' : 'logoDark']: publicUrl
                    };
                    setUser(updatedUser);
                    setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
                    await saveUserToSupabase(updatedUser);
                    alert("Logo atualizada com sucesso!");
                } else {
                    alert("Falha ao salvar a imagem.");
                }
            } catch (err) {
                alert("Erro ao processar imagem.");
                console.error(err);
            }
            e.target.value = '';
        }
    };

    const handleLogoUrlSave = async (url: string, type: 'light' | 'dark') => {
        if (user && user.role === 'admin') {
            const updatedUser = {
                ...user,
                [type === 'light' ? 'logoLight' : 'logoDark']: url
            };
            setUser(updatedUser);
            setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
            await saveUserToSupabase(updatedUser);
        }
    };

    const handleRemoveLogo = async (type: 'light' | 'dark') => {
        if (user && user.role === 'admin') {
            const updatedUser = { ...user, [type === 'light' ? 'logoLight' : 'logoDark']: '' };
            setUser(updatedUser);
            setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
            await saveUserToSupabase(updatedUser);
        }
    };

    const addAuditLog = (action: string, details: string, entityId?: string) => {
        const newLog: AuditLogEntry = {
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: user?.name || 'Desconhecido',
            action,
            details,
            entityId
        };
        setAuditLogs(prev => [newLog, ...prev]);
    };

    // Helper: generate recurring activities
    const generateRecurringActivities = (baseActivity: Omit<Activity, 'id'>, limitDate: Date): Omit<Activity, 'id'>[] => {
        const generated: Omit<Activity, 'id'>[] = [];
        const startDate = new Date(baseActivity.horaInicio);
        const endDate = new Date(baseActivity.horaFim);
        const durationMs = endDate.getTime() - startDate.getTime();
        let nextDate = new Date(startDate);
        const addNextInterval = (date: Date) => {
             switch (baseActivity.periodicidade) {
                case Recorrencia.Diario: date.setDate(date.getDate() + 1); break;
                case Recorrencia.Semanal: date.setDate(date.getDate() + 7); break;
                case Recorrencia.Quinzenal: date.setDate(date.getDate() + 15); break;
                case Recorrencia.Mensal: date.setMonth(date.getMonth() + 1); break;
                case Recorrencia.Trimestral: date.setMonth(date.getMonth() + 3); break;
                case Recorrencia.Semestral: date.setMonth(date.getMonth() + 6); break;
                default: date.setDate(date.getDate() + 1); 
            }
        };
        addNextInterval(nextDate);
        let count = 0;
        while (nextDate <= limitDate && count < 365) {
            const newStart = new Date(nextDate);
            const newEnd = new Date(nextDate.getTime() + durationMs);
            generated.push({
                ...baseActivity,
                horaInicio: newStart.toISOString(),
                horaFim: newEnd.toISOString(),
                status: ActivityStatus.Open, 
                horaInicioReal: undefined, 
                horaFimReal: undefined
            });
            addNextInterval(nextDate);
            count++;
        }
        return generated;
    };

    const handleAddActivity = async (activityData: Omit<Activity, 'id'>, recurrenceLimit?: Date) => {
        const activity: Activity = {
            ...activityData,
            id: `act_${Date.now()}_0`,
        };
        const activitiesToAdd: Activity[] = [activity];
        
        if (recurrenceLimit && activity.periodicidade !== Recorrencia.NaoHa) {
            const { id, ...rest } = activity;
            const futureActivities = generateRecurringActivities(rest, recurrenceLimit);
            futureActivities.forEach((act, index) => {
                 activitiesToAdd.push({ ...act, id: `act_${Date.now()}_${index + 1}` });
            });
        }

        setActivities(prev => [...prev, ...activitiesToAdd]);
        for (const act of activitiesToAdd) await saveActivityToSupabase(act);
        addAuditLog("CRIAR", `Criou ${activitiesToAdd.length} atividades`, activity.id);
    };

    const handleUpdateActivity = async (updatedActivity: Activity, recurrenceLimit?: Date) => {
        setActivities(prev => prev.map(act => act.id === updatedActivity.id ? updatedActivity : act));
        await saveActivityToSupabase(updatedActivity);
        
        if (recurrenceLimit && updatedActivity.periodicidade !== Recorrencia.NaoHa) {
             const { id, ...activityTemplate } = updatedActivity;
             const futureActivities = generateRecurringActivities(activityTemplate, recurrenceLimit);
             if (futureActivities.length > 0) {
                const newInstances = futureActivities.map((act, index) => ({ ...act, id: `act_gen_${Date.now()}_${index}` }));
                setActivities(prev => [...prev, ...newInstances]);
                for (const act of newInstances) await saveActivityToSupabase(act);
             }
        }
        setEditingActivity(null);
    };
    
    // STRICT: This function MUST NOT change dates. Only Status.
    const handleUpdateStatus = async (activityId: string, status: ActivityStatus) => {
        const activity = activities.find(a => a.id === activityId);
        if (activity) {
            // We strictly only update the status field.
            // Dates are preserved exactly as they were (imported or manually set).
            const updatedActivity = { ...activity, status };
            
            setActivities(prev => prev.map(act => act.id === activityId ? updatedActivity : act));
            await saveActivityToSupabase(updatedActivity);
        }
    };

    const handleDeleteActivity = async (activityId: string) => {
        if (window.confirm("Tem certeza que deseja excluir esta atividade?")) {
            // Local state update
            setActivities(prev => prev.filter(act => act.id !== activityId));
            
            // Database update
            await deleteActivityFromSupabase(activityId);
            
            addAuditLog("EXCLUIR", `Excluiu atividade ${activityId}`);
        }
    };

    const handleActivityDateChange = async (activityId: string, newDate: Date) => {
        // This is the ONLY place where dates change programmatically via drag-and-drop
        const activity = activities.find(a => a.id === activityId);
        if (!activity) return;
        const oldStart = new Date(activity.horaInicio);
        const oldEnd = new Date(activity.horaFim);
        const duration = oldEnd.getTime() - oldStart.getTime();
        const newStart = new Date(newDate);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
        const newEnd = new Date(newStart.getTime() + duration);
        const updatedActivity = { ...activity, horaInicio: newStart.toISOString(), horaFim: newEnd.toISOString() };
        await handleUpdateActivity(updatedActivity);
    };

    const handleDeleteUser = async (usernameToDelete: string) => {
        if (!user || user.role !== 'admin') return;
        if (window.confirm(`Excluir usuário "${usernameToDelete}"?`)) {
            if (isSupabaseConnected) {
                const { error } = await supabase.from('app_users').delete().eq('username', usernameToDelete);
                if (error) { alert("Erro ao excluir do Supabase"); return; }
            }
            setUsers(prev => prev.filter(u => u.username !== usernameToDelete));
        }
    };

    const openCreateModal = () => { setEditingActivity(null); setIsModalOpen(true); };
    const openEditModal = (activity: Activity) => { setEditingActivity(activity); setIsModalOpen(true); };
    const handleStatusLabelChange = (key: string, value: string) => { setStatusLabels(prev => ({ ...prev, [key]: value })); };
    const handleSaveSettings = () => { alert("Configurações salvas!"); setIsSettingsModalOpen(false); };

    // --- IMPORT LOGIC ---
    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setPendingImportFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const XLSX = (window as any).XLSX;
                const workbook = XLSX.read(data, { type: 'array', cellDates: true }); // Important: cellDates
                const jsonData: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
                if (jsonData.length === 0) return alert("Planilha vazia ou formato inválido.");
                setPendingImportData(jsonData);
                setExcelHeaders(Object.keys(jsonData[0]));
                setEditingBatchId(null);
                setInitialMapping(undefined);
                setIsImportModalOpen(true);
            } catch (error) { alert("Erro ao ler arquivo Excel."); }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const handleImportConfirm = async (mapping: ImportMapping) => {
        const batchId = editingBatchId || String(Date.now());
        const today = new Date();
        const baseDateString = today.toISOString().split('T')[0];

        // --- Helper: Parse Date with Format ---
        const parseDateWithFormat = (val: any, format?: string): Date | null => {
            if (val instanceof Date && !isNaN(val.getTime())) return val;
            if (typeof val !== 'string' || !val.trim()) return null;
            
            const dateStr = val.trim();
            
            // Special handling for DD/MMM/AA (ex: 11/Dez/25)
            if (format === 'DD/MMM/AA') {
                const parts = dateStr.split(/[\/\-\. ]/);
                if (parts.length === 3) {
                    const d = parseInt(parts[0]);
                    const mStr = parts[1].toLowerCase().slice(0,3);
                    let y = parseInt(parts[2]);

                    const months: {[k:string]: number} = {
                        'jan': 0, 'fev': 1, 'mar': 2, 'abr': 3, 'mai': 4, 'jun': 5,
                        'jul': 6, 'ago': 7, 'set': 8, 'out': 9, 'nov': 10, 'dez': 11
                    };

                    if (months[mStr] !== undefined && !isNaN(d) && !isNaN(y)) {
                        if (y < 100) y += 2000;
                        return new Date(y, months[mStr], d);
                    }
                }
                return null;
            }

            // Default expected format parts (separator agnostic)
            const parts = dateStr.split(/[\/\-\.]/);
            
            if (parts.length !== 3) return null; // Can't parse

            let d = 0, m = 0, y = 0;

            if (format === 'MM/DD/AAAA') {
                m = parseInt(parts[0]); d = parseInt(parts[1]); y = parseInt(parts[2]);
            } else if (format === 'AAAA-MM-DD') {
                y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]);
            } else if (format === 'DD-MM-AAAA' || format === 'DD/MM/AAAA' || !format) { // Default
                d = parseInt(parts[0]); m = parseInt(parts[1]); y = parseInt(parts[2]);
            }

            // Adjust 2-digit year
            if (y < 100) y += 2000;

            const dateObj = new Date(y, m - 1, d);
            return isNaN(dateObj.getTime()) ? null : dateObj;
        };

        // --- Helper: Parse Time ---
        // Reads "08:00", Excel Serial (0.33), or Date Object
        // Applies to a Reference Date
        const createISOString = (timeValue: any, referenceDate: Date): string => {
            const date = new Date(referenceDate);
            
            if (timeValue === undefined || timeValue === null || timeValue === '') {
                // If empty, keep reference date at 00:00 (or current time if fallback)
                return date.toISOString(); 
            }

            let hours = 0;
            let minutes = 0;

            if (typeof timeValue === 'number') {
                // Excel time serial (fraction of day)
                const totalSeconds = Math.round(timeValue * 86400);
                hours = Math.floor(totalSeconds / 3600);
                minutes = Math.floor((totalSeconds % 3600) / 60);
            } else if (typeof timeValue === 'string') {
                const parts = timeValue.trim().split(':');
                if (parts.length >= 2) {
                    hours = parseInt(parts[0]);
                    minutes = parseInt(parts[1]);
                }
            } else if (timeValue instanceof Date) {
                // Check if it's a "Time Only" date (Excel epoch 1899)
                if (timeValue.getFullYear() < 1970) {
                    hours = timeValue.getUTCHours();
                    minutes = timeValue.getUTCMinutes();
                } else {
                    hours = timeValue.getHours();
                    minutes = timeValue.getMinutes();
                }
            }

            if (isNaN(hours)) hours = 0;
            if (isNaN(minutes)) minutes = 0;

            date.setHours(hours, minutes, 0, 0);
            return date.toISOString();
        };

        const newActivities: Activity[] = pendingImportData.map((row, index) => {
            // 1. Determine Reference Date
            let refDate = new Date(); // Default today
            if (mapping.data && row[mapping.data]) {
                const parsedDate = parseDateWithFormat(row[mapping.data], mapping.dateFormat);
                if (parsedDate) refDate = parsedDate;
            } else if (mapping.horaInicio && row[mapping.horaInicio] instanceof Date && row[mapping.horaInicio].getFullYear() > 1970) {
                // If Start Time column has full date
                refDate = row[mapping.horaInicio];
            }

            // 2. Parse Times
            const startISO = createISOString(row[mapping.horaInicio], refDate);
            let endISO = createISOString(row[mapping.horaFim], refDate);
            
            // 3. Handle Duration Logic
            let duracao = "01:00"; // Default
            if (mapping.duracao && row[mapping.duracao]) {
                // If duration column provided
                const val = row[mapping.duracao];
                // Try parse
                if (typeof val === 'number') {
                    // Excel fraction of day -> HH:MM
                    const totalMins = Math.round(val * 24 * 60);
                    const h = Math.floor(totalMins / 60);
                    const m = totalMins % 60;
                    duracao = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
                } else if (typeof val === 'string') {
                    duracao = val;
                }
                
                // Recalculate End Time based on Start + Duration
                const startDate = new Date(startISO);
                const [dh, dm] = duracao.split(':').map(Number);
                if (!isNaN(dh)) {
                    startDate.setHours(startDate.getHours() + dh);
                    startDate.setMinutes(startDate.getMinutes() + (dm || 0));
                    endISO = startDate.toISOString();
                }
            } else {
                // Calculate Duration from Start/End
                const s = new Date(startISO).getTime();
                const e = new Date(endISO).getTime();
                let diffMins = (e - s) / 60000;
                if (diffMins <= 0) {
                    // If End <= Start, assume 1 hour or next day? Default to 1h
                    diffMins = 60;
                    const fixEnd = new Date(s + 3600000);
                    endISO = fixEnd.toISOString();
                }
                const h = Math.floor(diffMins / 60);
                const m = Math.round(diffMins % 60);
                duracao = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
            }

            // 4. Handle Responsavel (Name Separator)
            let rawResp = row[mapping.responsavel] || '';
            if (mapping.responsavelSeparator && mapping.responsavelSeparator !== '/') {
                // Normalize to ' / '
                rawResp = String(rawResp).split(mapping.responsavelSeparator).map(s => s.trim()).join(' / ');
            }

            return {
                id: `imported_${batchId}_${index}`,
                idMp: mapping.idMp ? (row[mapping.idMp] || '') : '',
                tag: mapping.tag ? (row[mapping.tag] || 'SEM TAG') : 'SEM TAG',
                tipo: 'PLANO',
                descricao: mapping.descricao ? (row[mapping.descricao] || '') : '',
                responsavel: rawResp,
                supervisor: mapping.supervisor ? (row[mapping.supervisor] || '') : '',
                area: mapping.area ? (row[mapping.area] || '') : '',
                turno: mapping.turno ? (row[mapping.turno] || '') : '',
                empresa: 'FOSPAR', 
                efetivo: '', 
                jornada: '',
                horaInicio: startISO,
                horaFim: endISO,
                duracao: duracao,
                "r eletrico": false,
                labapet: false,
                criticidade: mapping.criticidade ? (row[mapping.criticidade] as Criticidade || Criticidade.Normal) : Criticidade.Normal,
                status: ActivityStatus.Open,
                periodicidade: Recorrencia.NaoHa,
                beforeImage: [],
                afterImage: [],
                attachments: [],
                comments: []
            };
        });

        if (editingBatchId) {
            // If editing, remove old ones first (simple replace logic)
            setActivities(prev => {
                const filtered = prev.filter(a => !a.id.startsWith(`imported_${batchId}_`));
                return [...filtered, ...newActivities];
            });
            // Update batch record
            setImportBatches(prev => prev.map(b => b.id === batchId ? { ...b, mapping, count: newActivities.length } : b));
            // Trigger save for each new activity (could be heavy, ideally batch save)
            for (const act of newActivities) await saveActivityToSupabase(act);
        } else {
            setActivities(prev => [...prev, ...newActivities]);
            for (const act of newActivities) await saveActivityToSupabase(act);
        }

        // Upload original file if new
        let fileUrl = undefined;
        if (pendingImportFile && !editingBatchId) {
             fileUrl = await uploadFileToSupabase(pendingImportFile, `imports/${batchId}`);
        }

        const newBatch: ImportBatch = {
            id: batchId,
            date: new Date().toISOString(),
            count: newActivities.length,
            rawData: pendingImportData,
            headers: excelHeaders,
            mapping: mapping,
            fileUrl: fileUrl || undefined
        };

        if (editingBatchId) {
             // Already updated state above? No, state logic for batches needs update
             // Logic merged above
        } else {
            setImportBatches(prev => [newBatch, ...prev]);
            await saveBatchToSupabase(newBatch);
        }
        
        setIsImportModalOpen(false);
    };

    const handleDeleteImportBatch = async (batchId: string) => {
        if (window.confirm("Tem certeza que deseja excluir todas as atividades desta importação?")) {
            const prefix = `imported_${batchId}_`;
            
            // Identify IDs to delete from DB
            const idsToDelete = activities.filter(act => act.id.startsWith(prefix)).map(a => a.id);

            // Update Local State
            setActivities(prev => prev.filter(act => !act.id.startsWith(prefix)));
            setImportBatches(prev => prev.filter(b => b.id !== batchId));
            
            // Delete from DB
            for (const id of idsToDelete) {
                await deleteActivityFromSupabase(id);
            }
            await deleteBatchFromSupabase(batchId);
            
            addAuditLog("EXCLUIR", `Excluiu lote de importação de ${new Date(parseInt(batchId)).toLocaleString()}`);
        }
    };

    const handleEditImportBatch = (batchId: string) => {
        const batch = importBatches.find(b => b.id === batchId);
        if (!batch) return;
        
        // Restore raw data
        setPendingImportData(batch.rawData);
        setExcelHeaders(batch.headers);
        setEditingBatchId(batchId);
        setInitialMapping(batch.mapping);
        
        setIsSettingsModalOpen(false);
        setIsImportModalOpen(true);
    };

    const filteredAndSortedActivities = useMemo(() => {
        let filtered = activities.filter(activity => {
            const turnoMatch = filters.turno === 'all' || activity.turno === filters.turno;
            const responsavelMatch = filters.responsavel === 'all' || activity.responsavel === filters.responsavel;
            const supervisorMatch = filters.supervisor === 'all' || (activity.supervisor || '') === filters.supervisor;
            const idMpMatch = !filters.idMp || (activity.idMp === filters.idMp);
            const myActivitiesMatch = !filters.onlyMyActivities || (
                user && (
                    activity.responsavel.toLowerCase().includes(user.name.toLowerCase()) || 
                    (activity.supervisor && activity.supervisor.toLowerCase().includes(user.name.toLowerCase()))
                )
            );
            return turnoMatch && responsavelMatch && supervisorMatch && idMpMatch && myActivitiesMatch;
        });
        return filtered;
    }, [activities, filters, user]);

    const systemLogos = useMemo(() => {
        const adminUser = users.find(u => u.role === 'admin');
        return { light: adminUser?.logoLight, dark: adminUser?.logoDark };
    }, [users]);

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView activities={filteredAndSortedActivities} customStatusLabels={statusLabels} />;
            case 'list': return <ActivityListView activities={filteredAndSortedActivities} onEdit={openEditModal} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteActivity} customStatusLabels={statusLabels} />;
            case 'board': return <ActivityBoardView activities={filteredAndSortedActivities} onEdit={openEditModal} onUpdateStatus={handleUpdateStatus} onDelete={handleDeleteActivity} onImageClick={setViewingImage} customStatusLabels={statusLabels} />;
            case 'calendar': return <ActivityCalendarView activities={filteredAndSortedActivities} onEdit={openEditModal} customStatusLabels={statusLabels} onDateChange={handleActivityDateChange} />;
            case 'gantt': return <ActivityGanttView activities={filteredAndSortedActivities} onEdit={openEditModal} />;
            case 'report': return <ReportView activities={filteredAndSortedActivities} onImageClick={setViewingImage} customStatusLabels={statusLabels} />;
            case 'audit': return <AuditLogView logs={auditLogs} />;
            case 'manpower': return <ManPowerView activities={filteredAndSortedActivities} />;
            default: return <DashboardView activities={filteredAndSortedActivities} customStatusLabels={statusLabels} />;
        }
    };

    // Filter helpers
    const uniqueTurnos = useMemo(() => ['all', ...Array.from(new Set(activities.map(a => a.turno).filter(Boolean)))], [activities]);
    const uniqueResponsaveis = useMemo(() => ['all', ...Array.from(new Set(activities.map(a => a.responsavel)))], [activities]);
    const uniqueSupervisores = useMemo(() => ['all', ...Array.from(new Set(activities.map(a => a.supervisor || '').filter(Boolean)))], [activities]);
    const uniqueIdMps = useMemo(() => Array.from(new Set(activities.map(a => a.idMp).filter(Boolean) as string[])), [activities]);

    if (!user) {
        return <LoginView onLogin={handleLogin} onRegister={handleRegister} onRecoverPassword={handleRecoverPassword} onRecoverUsername={handleRecoverUsername} error={loginError} />;
    }

    const userBackground = user.backgroundImage;
    const backgroundStyle = userBackground ? { backgroundImage: `url("${userBackground}")` } : { backgroundImage: 'url("/background.png")' };

    return (
        <div className="flex flex-col min-h-screen bg-fixed bg-cover bg-center text-gray-900 dark:text-gray-100" style={backgroundStyle}>
            <div className="fixed inset-0 bg-gray-100/20 dark:bg-gray-900/50 z-0 pointer-events-none"></div>
            
            <Header 
                theme={theme}
                toggleTheme={toggleTheme}
                currentView={currentView}
                setCurrentView={setCurrentView}
                filters={filters}
                setFilters={setFilters}
                turnos={uniqueTurnos}
                responsaveis={uniqueResponsaveis}
                supervisores={uniqueSupervisores}
                idMps={uniqueIdMps}
                onImport={handleFileImport}
                user={user}
                onLogout={handleLogout}
                onOpenSettings={() => setIsSettingsModalOpen(true)}
                isOnline={isSupabaseConnected}
                systemLogos={systemLogos}
            />

            <main className="p-2 flex-1 overflow-y-auto relative z-10">
                {renderView()}
            </main>
            
            <button onClick={openCreateModal} className="fixed bottom-8 right-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg z-50">
                <PlusIcon className="w-8 h-8" />
            </button>

            <ImportMappingModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} excelHeaders={excelHeaders} onConfirm={handleImportConfirm} initialMapping={initialMapping} />

            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configurações">
                {/* Settings Content (Existing) */}
                <div className="space-y-6 text-gray-800 dark:text-gray-200">
                    {/* User Profile */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="font-semibold mb-2">Perfil</h3>
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border border-gray-300 dark:border-gray-600">
                                {user.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-gray-400">
                                        <UserIcon className="w-8 h-8" />
                                    </div>
                                )}
                            </div>
                            <label className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded text-sm transition-colors shadow-sm">
                                Alterar Foto
                                <input type="file" className="hidden" accept="image/*" onChange={handleProfilePictureUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Background Settings */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="font-semibold mb-2">Imagem de Fundo</h3>
                        <div className="flex flex-col space-y-2">
                            <p className="text-xs text-gray-500">Personalize o fundo da aplicação.</p>
                            <div className="flex space-x-2">
                                <label className="flex items-center space-x-2 cursor-pointer bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 px-3 py-2 rounded text-sm transition-colors">
                                    <PhotoIcon className="w-4 h-4" />
                                    <span>Upload Imagem</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                                </label>
                                {user.backgroundImage && (
                                    <button 
                                        onClick={handleRemoveBackground}
                                        className="px-3 py-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded text-sm hover:bg-red-200"
                                    >
                                        Remover Fundo
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* System Logos (Admin Only) */}
                    {user.role === 'admin' && (
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h3 className="font-semibold mb-2">Logos do Sistema</h3>
                            <p className="text-xs text-gray-500 mb-2">Configure as logos que aparecem no cabeçalho.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Light Mode Logo */}
                                <div className="p-3 bg-gray-100 rounded-lg border border-gray-200">
                                    <p className="text-sm font-bold text-gray-700 mb-2">Tema Claro</p>
                                    {systemLogos.light ? (
                                        <img src={systemLogos.light} alt="Light Logo" className="h-8 mb-2 object-contain mx-auto" />
                                    ) : (
                                        <div className="h-8 mb-2 flex items-center justify-center text-gray-400 text-xs italic">Padrão</div>
                                    )}
                                    <div className="flex flex-col space-y-2 w-full">
                                        <label className="cursor-pointer bg-white text-gray-700 border border-gray-300 px-2 py-1 rounded text-xs text-center hover:bg-gray-50">
                                            Upload Arquivo
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'light')} />
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="text" 
                                                placeholder="Ou cole a URL"
                                                className="w-full text-xs p-1 border rounded dark:bg-white dark:text-black"
                                                onBlur={(e) => handleLogoUrlSave(e.target.value, 'light')}
                                                defaultValue={systemLogos.light || ''}
                                            />
                                            {systemLogos.light && (
                                                <button onClick={() => handleRemoveLogo('light')} className="text-red-500 p-1 hover:bg-red-100 rounded">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Dark Mode Logo */}
                                <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
                                    <p className="text-sm font-bold text-gray-200 mb-2">Tema Escuro</p>
                                    {systemLogos.dark ? (
                                        <img src={systemLogos.dark} alt="Dark Logo" className="h-8 mb-2 object-contain mx-auto" />
                                    ) : (
                                        <div className="h-8 mb-2 flex items-center justify-center text-gray-500 text-xs italic">Padrão</div>
                                    )}
                                    <div className="flex flex-col space-y-2 w-full">
                                        <label className="cursor-pointer bg-gray-700 text-white border border-gray-600 px-2 py-1 rounded text-xs text-center hover:bg-gray-600">
                                            Upload Arquivo
                                            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleLogoUpload(e, 'dark')} />
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <input 
                                                type="text" 
                                                placeholder="Ou cole a URL"
                                                className="w-full text-xs p-1 border rounded bg-gray-700 text-white border-gray-600"
                                                onBlur={(e) => handleLogoUrlSave(e.target.value, 'dark')}
                                                defaultValue={systemLogos.dark || ''}
                                            />
                                            {systemLogos.dark && (
                                                <button onClick={() => handleRemoveLogo('dark')} className="text-red-400 p-1 hover:bg-red-900/30 rounded">
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Manage Import Batches */}
                    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                        <h3 className="font-semibold mb-2">Gerenciar Importações</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {importBatches.length === 0 ? (
                                <p className="text-sm text-gray-500 italic">Nenhum lote importado.</p>
                            ) : (
                                importBatches.map(batch => (
                                    <div key={batch.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                                        <div>
                                            <span className="font-medium block">{new Date(parseInt(batch.id)).toLocaleString()}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">{batch.count} atividades</span>
                                            {batch.fileUrl && <a href={batch.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline ml-2">Baixar Arquivo</a>}
                                        </div>
                                        <div className="flex space-x-2">
                                            <button 
                                                onClick={() => handleEditImportBatch(batch.id)} 
                                                className="text-blue-600 hover:text-blue-800 p-1"
                                                title="Editar Mapeamento"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteImportBatch(batch.id)} 
                                                className="text-red-600 hover:text-red-800 p-1"
                                                title="Excluir Lote"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Manage Users (Admin Only) */}
                    {user.role === 'admin' && (
                        <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                            <h3 className="font-semibold mb-2">Gerenciar Usuários</h3>
                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                {users.map(u => (
                                    <div key={u.username} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700 p-2 rounded text-sm">
                                        <div>
                                            <span className="font-medium block">{u.name}</span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">@{u.username} ({u.role})</span>
                                        </div>
                                        {u.username !== user.username && (
                                            <button 
                                                onClick={() => handleDeleteUser(u.username)} 
                                                className="text-red-600 hover:text-red-800 p-1"
                                                title="Excluir Usuário"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Status Labels Configuration */}
                    <div>
                        <h3 className="font-semibold mb-2">Personalizar Status</h3>
                        <div className="space-y-2">
                            {Object.values(ActivityStatus).map(status => (
                                <div key={status} className="flex items-center justify-between">
                                    <span className="text-sm text-gray-600 dark:text-gray-400 w-1/3">{status}</span>
                                    <input 
                                        type="text" 
                                        value={statusLabels[status] || ''} 
                                        onChange={(e) => handleStatusLabelChange(status, e.target.value)}
                                        className="w-2/3 p-1 text-sm border rounded bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 dark:text-white"
                                        placeholder={`Ex: ${status}`}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-end pt-4 space-x-3 border-t border-gray-200 dark:border-gray-700 mt-4">
                    <button 
                        onClick={() => setIsSettingsModalOpen(false)} 
                        className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-white rounded transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveSettings} 
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow font-medium transition-colors flex items-center"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingActivity ? "Editar" : "Criar"}>
                <ActivityForm 
                    activity={editingActivity} 
                    onSubmit={editingActivity ? handleUpdateActivity : handleAddActivity} 
                    onClose={() => setIsModalOpen(false)} 
                    customStatusLabels={statusLabels}
                    onUpload={(file) => uploadFileToSupabase(file, `activities/${editingActivity?.tag || 'new'}`)}
                />
            </Modal>

            {viewingImage && <ImageViewerModal src={viewingImage} onClose={() => setViewingImage(null)} />}
        </div>
    );
};

export default App;
