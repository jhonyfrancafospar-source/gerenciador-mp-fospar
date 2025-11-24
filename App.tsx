
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client'; // Explicit import for error prevention
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

    // Data States - Initialize from LocalStorage first for immediate usability (Offline First approach)
    const [users, setUsers] = useState<User[]>(() => {
        const stored = localStorage.getItem('db_users');
        return stored ? JSON.parse(stored) : [];
    });
    const [activities, setActivities] = useState<Activity[]>(() => {
        const stored = localStorage.getItem('db_activities');
        return stored ? JSON.parse(stored) : [];
    });
    const [importBatches, setImportBatches] = useState<ImportBatch[]>(() => {
        const stored = localStorage.getItem('db_import_batches');
        return stored ? JSON.parse(stored) : [];
    });
    
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    
    // UI States
    const [user, setUser] = useState<User | null>(null);
    const [loginError, setLoginError] = useState<string | undefined>();
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    
    // Connection Status
    const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [pendingImportData, setPendingImportData] = useState<any[]>([]);
    const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
    const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
    const [initialMapping, setInitialMapping] = useState<ImportMapping | undefined>(undefined);

    // Filters
    const [filters, setFilters] = useState<FilterType>({ 
        turno: 'all', 
        responsavel: 'all', 
        supervisor: 'all',
        idMp: '',
        onlyMyActivities: false
    });

    // Status Customization
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

    // --- LOCAL STORAGE PERSISTENCE (Backup/Offline Mode) ---
    useEffect(() => {
        localStorage.setItem('db_users', JSON.stringify(users));
    }, [users]);

    useEffect(() => {
        localStorage.setItem('db_activities', JSON.stringify(activities));
    }, [activities]);

    useEffect(() => {
        localStorage.setItem('db_import_batches', JSON.stringify(importBatches));
    }, [importBatches]);


    // --- SUPABASE DATA LOADING ---
    useEffect(() => {
        const loadData = async () => {
            console.log("Tentando conectar ao Supabase...");
            
            // 1. Load Users
            const { data: usersData, error: usersError } = await supabase.from('app_users').select('*');
            
            if (usersError) {
                // Detect missing tables error
                if (usersError.message.includes('relation "public.app_users" does not exist') || 
                    usersError.message.includes('Could not find the table')) {
                    console.warn("Supabase não configurado (Tabelas inexistentes). Ativando Modo Offline.");
                    setIsSupabaseConnected(false);
                    // Stop trying to load other tables
                    if (users.length === 0) setUsers(mockUsers);
                    return; 
                } else {
                    console.error("Erro ao carregar usuários do Supabase:", usersError.message);
                }
                // Fallback
                if (users.length === 0) setUsers(mockUsers);
            } else if (usersData && usersData.length > 0) {
                setIsSupabaseConnected(true);
                console.log("Conectado ao Supabase com sucesso!");
                const mappedUsers: User[] = usersData.map(u => ({
                    username: u.username,
                    password: u.password,
                    name: u.name,
                    role: u.role as 'admin' | 'user',
                    profilePicture: u.profile_picture,
                    backgroundImage: u.background_image
                }));
                setUsers(mappedUsers);
                
                // Refresh current user session
                const storedUserStr = localStorage.getItem('currentUser');
                if (storedUserStr) {
                    const storedUser = JSON.parse(storedUserStr);
                    const freshUser = mappedUsers.find(u => u.username === storedUser.username);
                    if (freshUser) setUser(freshUser);
                    else setUser(storedUser);
                }
            } else if (users.length === 0) {
                 setUsers(mockUsers);
            }
            
            if (!isSupabaseConnected) return;

            // 2. Load Activities
            const { data: actsData, error: actsError } = await supabase.from('activities').select('json_data');
            if (actsError) {
                 if (!actsError.message.includes('Could not find the table')) {
                    // Ignore
                 }
            } else if (actsData && actsData.length > 0) {
                const loadedActs = actsData.map(row => row.json_data);
                setActivities(loadedActs);
            }

            // 3. Load Import Batches
            const { data: batchData, error: batchError } = await supabase.from('import_batches').select('json_data');
             if (batchError) {
                 if (!batchError.message.includes('Could not find the table')) {
                    // Ignore
                 }
            } else if (batchData && batchData.length > 0) {
                setImportBatches(batchData.map(row => row.json_data));
            }
        };

        loadData();
    }, []);

    // --- PERSISTENCE HELPERS ---
    
    const alertSupabaseError = (error: any) => {
        if (error && (error.code === '42501' || error.message.includes('row-level security'))) {
            alert("ERRO DE PERMISSÃO NO BANCO DE DADOS!\n\nO Supabase bloqueou o salvamento. Você precisa rodar o script SQL de permissões no painel do Supabase.");
        } else if (error && !error.message.includes('Could not find the table')) {
            // console.error(error.message);
        }
    }

    const saveActivityToSupabase = async (activity: Activity) => {
        if (!isSupabaseConnected) return;
        try {
            const cleanActivity = JSON.parse(JSON.stringify(activity));
            const { error } = await supabase.from('activities').upsert({
                id: activity.id,
                json_data: cleanActivity
            });
            alertSupabaseError(error);
        } catch (e) {
            console.error("Exception saving activity", e);
        }
    };

    const deleteActivityFromSupabase = async (id: string) => {
        if (!isSupabaseConnected) return;
        try {
            const { error } = await supabase.from('activities').delete().eq('id', id);
            alertSupabaseError(error);
        } catch (e) {}
    };

    const saveUserToSupabase = async (u: User) => {
        if (!isSupabaseConnected) return;
        try {
            const dbUser = {
                username: u.username,
                password: u.password,
                name: u.name,
                role: u.role,
                profile_picture: u.profilePicture,
                background_image: u.backgroundImage
            };
            const { error } = await supabase.from('app_users').upsert(dbUser);
            alertSupabaseError(error);
        } catch (e) {}
    };

    const saveBatchToSupabase = async (batch: ImportBatch) => {
        if (!isSupabaseConnected) return;
        try {
            const cleanBatch = JSON.parse(JSON.stringify(batch));
            const { error } = await supabase.from('import_batches').upsert({
                id: batch.id,
                json_data: cleanBatch
            });
             alertSupabaseError(error);
        } catch (e) {}
    };

    const deleteBatchFromSupabase = async (batchId: string) => {
         if (!isSupabaseConnected) return;
         try {
            const { error } = await supabase.from('import_batches').delete().eq('id', batchId);
            alertSupabaseError(error);
         } catch (e) {}
    };


    // --- FILE UPLOAD HELPER ---
    
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const uploadFileToSupabase = async (file: File, folder: string = 'uploads'): Promise<string | null> => {
        // If offline or table missing, use Base64 immediately
        if (!isSupabaseConnected) {
            return await fileToBase64(file);
        }

        try {
            // Sanitize filename
            const fileExt = file.name.split('.').pop();
            const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_');
            const fileName = `${Date.now()}_${cleanName}.${fileExt}`;
            const filePath = `${folder}/${fileName}`;

            console.log(`Uploading to Supabase: ${filePath}`);

            const { error: uploadError } = await supabase.storage
                .from('app-files')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) {
                if (uploadError.message.includes('Bucket not found') || 
                    (uploadError as any).error === 'Bucket not found' ||
                    uploadError.message.includes('Could not find the table') || 
                    uploadError.message.includes('row-level security')) {
                    console.warn("Storage indisponível ou sem permissão. Usando Base64 local.");
                    return await fileToBase64(file);
                }
                throw uploadError;
            }

            const { data } = supabase.storage.from('app-files').getPublicUrl(filePath);
            return data.publicUrl;
        } catch (error: any) {
            console.warn('Upload falhou (usando fallback):', error.message || error);
            try {
                 return await fileToBase64(file);
            } catch (e) {
                return null;
            }
        }
    };


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

    const handleLogin = (usernameInput: string, passwordInput: string) => {
        const foundUser = users.find(u => 
            u.username.toLowerCase() === usernameInput.toLowerCase() && 
            u.password === passwordInput
        );
        
        if (foundUser) {
            setUser(foundUser);
            setLoginError(undefined);
            localStorage.setItem('currentUser', JSON.stringify(foundUser));
            
            if (foundUser.role !== 'admin') {
                setFilters(prev => ({ ...prev, onlyMyActivities: true }));
            } else {
                setFilters(prev => ({ ...prev, onlyMyActivities: false }));
            }
        } else {
            setLoginError('Usuário ou senha incorretos.');
        }
    };

    const handleRegister = async (newUser: User) => {
        if (users.some(u => u.username.toLowerCase() === newUser.username.toLowerCase())) {
            setLoginError('Nome de usuário já existe.');
            return;
        }
        const updatedUsers = [...users, newUser];
        setUsers(updatedUsers);
        setUser(newUser);
        setLoginError(undefined);
        localStorage.setItem('currentUser', JSON.stringify(newUser));
        setFilters(prev => ({ ...prev, onlyMyActivities: true }));
        
        await saveUserToSupabase(newUser);
    };

    const handleRecoverPassword = (username: string, name: string, newPassword: string): boolean => {
        const userIndex = users.findIndex(u => 
            u.username.toLowerCase() === username.toLowerCase() &&
            u.name.toLowerCase() === name.toLowerCase()
        );
        if (userIndex !== -1) {
            const updatedUsers = [...users];
            const updatedUser = { ...updatedUsers[userIndex], password: newPassword };
            updatedUsers[userIndex] = updatedUser;
            setUsers(updatedUsers);
            setLoginError(undefined);
            
            saveUserToSupabase(updatedUser);
            return true;
        }
        return false;
    };

    const handleRecoverUsername = (name: string): string | null => {
        const foundUser = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        return foundUser ? foundUser.username : null;
    };

    const handleLogout = () => {
        setUser(null);
        localStorage.removeItem('currentUser');
        setFilters(prev => ({ ...prev, onlyMyActivities: false }));
    };

    // --- UPDATED UPLOAD HANDLERS ---

    const handleBackgroundUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            // Upload to a specific user folder
            const publicUrl = await uploadFileToSupabase(file, `users/${user.username}/background`);
            
            if (publicUrl) {
                const updatedUser = { ...user, backgroundImage: publicUrl };
                setUser(updatedUser);
                // Update local state array
                setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
                // Save to Supabase DB
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
            // Upload to a specific user folder
            const publicUrl = await uploadFileToSupabase(file, `users/${user.username}/avatar`);

            if (publicUrl) {
                const updatedUser = { ...user, profilePicture: publicUrl };
                setUser(updatedUser);
                setUsers(prev => prev.map(u => u.username === user.username ? updatedUser : u));
                await saveUserToSupabase(updatedUser);
            }
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

    // Helper to generate future activities based on recurrence
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
        const maxInstances = 365; 

        while (nextDate <= limitDate && count < maxInstances) {
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
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...rest } = activity;
            const futureActivities = generateRecurringActivities(rest, recurrenceLimit);
            
            futureActivities.forEach((act, index) => {
                 activitiesToAdd.push({
                     ...act,
                     id: `act_${Date.now()}_${index + 1}`
                 });
            });
        }

        setActivities(prev => [...prev, ...activitiesToAdd]);
        
        for (const act of activitiesToAdd) {
            await saveActivityToSupabase(act);
        }

        addAuditLog("CRIAR", `Criou ${activitiesToAdd.length} atividades (${activity.tag})`, activity.id);
    };

    const handleUpdateActivity = async (updatedActivity: Activity, recurrenceLimit?: Date) => {
        setActivities(prev => prev.map(act => act.id === updatedActivity.id ? updatedActivity : act));
        await saveActivityToSupabase(updatedActivity);
        
        if (recurrenceLimit && updatedActivity.periodicidade !== Recorrencia.NaoHa) {
             // eslint-disable-next-line @typescript-eslint/no-unused-vars
             const { id, ...activityTemplate } = updatedActivity;
             const futureActivities = generateRecurringActivities(activityTemplate, recurrenceLimit);
             
             if (futureActivities.length > 0) {
                const newInstances: Activity[] = futureActivities.map((act, index) => ({
                    ...act,
                    id: `act_gen_${Date.now()}_${index}`,
                }));
                setActivities(prev => [...prev, ...newInstances]);
                
                for (const act of newInstances) {
                    await saveActivityToSupabase(act);
                }

                alert(`Foram geradas mais ${newInstances.length} recorrências até a data selecionada.`);
                addAuditLog("RECORRENCIA", `Gerou ${newInstances.length} recorrências ao editar ${updatedActivity.tag}`);
             }
        }

        setEditingActivity(null);
        addAuditLog("EDITAR", `Editou detalhes da atividade ${updatedActivity.tag}`, updatedActivity.id);
    };
    
    const handleUpdateStatus = async (activityId: string, status: ActivityStatus) => {
        const activity = activities.find(a => a.id === activityId);
        if (activity) {
            const updatedActivity = { ...activity, status };
            setActivities(prev => prev.map(act => act.id === activityId ? updatedActivity : act));
            await saveActivityToSupabase(updatedActivity);
            addAuditLog("STATUS", `Alterou status de ${activity.tag} para ${status}`, activityId);
        }
    };

    const handleActivityDateChange = async (activityId: string, newDate: Date) => {
        const activity = activities.find(a => a.id === activityId);
        if (!activity) return;

        const oldStart = new Date(activity.horaInicio);
        const oldEnd = new Date(activity.horaFim);
        const duration = oldEnd.getTime() - oldStart.getTime();

        // Set new start date but keep original time
        const newStart = new Date(newDate);
        newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), oldStart.getSeconds());
        
        const newEnd = new Date(newStart.getTime() + duration);

        const updatedActivity = {
            ...activity,
            horaInicio: newStart.toISOString(),
            horaFim: newEnd.toISOString()
        };

        await handleUpdateActivity(updatedActivity);
    };

    const handleDeleteUser = async (usernameToDelete: string) => {
        if (!user || user.role !== 'admin') return;
        if (usernameToDelete === user.username) {
            alert("Você não pode excluir seu próprio usuário.");
            return;
        }

        if (window.confirm(`Tem certeza que deseja excluir o usuário "${usernameToDelete}"?`)) {
            // 1. Remove from Supabase
            if (isSupabaseConnected) {
                const { error } = await supabase.from('app_users').delete().eq('username', usernameToDelete);
                if (error) {
                    console.error("Erro ao excluir usuário:", error);
                    alert("Erro ao excluir usuário do banco de dados.");
                    return;
                }
            }
            
            // 2. Update local state
            setUsers(prev => prev.filter(u => u.username !== usernameToDelete));
            
            // 3. Log
            addAuditLog("EXCLUIR_USER", `Admin excluiu o usuário ${usernameToDelete}`);
        }
    };

    const openCreateModal = () => {
        setEditingActivity(null);
        setIsModalOpen(true);
    };
    
    const openEditModal = (activity: Activity) => {
        setEditingActivity(activity);
        setIsModalOpen(true);
    };

    const handleStatusLabelChange = (key: string, value: string) => {
        setStatusLabels(prev => ({ ...prev, [key]: value }));
    };

    const handleSaveSettings = () => {
        alert("Configurações salvas com sucesso!");
        setIsSettingsModalOpen(false);
    };

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
                if (!XLSX) throw new Error("XLSX não encontrado.");

                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    alert("Planilha vazia.");
                    return;
                }

                setPendingImportData(jsonData);
                setExcelHeaders(Object.keys(jsonData[0]));
                setEditingBatchId(null);
                setInitialMapping(undefined);
                setIsImportModalOpen(true);
            } catch (error) {
                console.error(error);
                alert("Erro ao ler arquivo.");
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = '';
    };

    const handleImportConfirm = async (mapping: ImportMapping) => {
        const parseExcelTime = (timeValue: any, referenceDate: Date = new Date()): Date => {
            const resultDate = new Date(referenceDate);
            
            if (timeValue instanceof Date) {
                if (timeValue.getFullYear() < 1905) {
                    resultDate.setHours(timeValue.getUTCHours(), timeValue.getUTCMinutes(), timeValue.getUTCSeconds(), 0);
                    return resultDate;
                } else {
                    return new Date(timeValue);
                }
            }
            
            if (typeof timeValue === 'string') {
                const timestamp = Date.parse(timeValue);
                if (!isNaN(timestamp)) {
                    return new Date(timestamp);
                }
                if (timeValue.includes(':')) {
                    const [hours, minutes] = timeValue.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        resultDate.setHours(hours, minutes, 0, 0);
                        return resultDate;
                    }
                }
            }
            
            if (typeof timeValue === 'number') {
                 const totalSeconds = Math.round(timeValue * 86400);
                 const hours = Math.floor(totalSeconds / 3600);
                 const minutes = Math.floor((totalSeconds % 3600) / 60);
                 resultDate.setHours(hours, minutes, 0, 0);
                 return resultDate;
            }
            
            return resultDate;
        };

        const batchId = editingBatchId || String(Date.now());

        // If editing, remove old first
        let currentActivities = [...activities];
        if (editingBatchId) {
            const toRemove = currentActivities.filter(act => act.id.startsWith(`imported_${editingBatchId}_`));
            toRemove.forEach(act => deleteActivityFromSupabase(act.id));
            currentActivities = currentActivities.filter(act => !act.id.startsWith(`imported_${editingBatchId}_`));
        }

        const newActivities: Activity[] = pendingImportData.map((row, index) => {
            const getValue = (key?: string) => key ? (row[key] || '') : '';
            
            const criticidadeValue = (String(getValue(mapping.criticidade) || 'normal').toLowerCase()) as Criticidade;
            const validCriticidade = Object.values(Criticidade).includes(criticidadeValue) ? criticidadeValue : Criticidade.Normal;

            let rawResponsavel = getValue(mapping.responsavel) || 'N/A';
            if (mapping.responsavelSeparator && typeof rawResponsavel === 'string') {
                rawResponsavel = rawResponsavel
                    .split(mapping.responsavelSeparator)
                    .map((name: string) => name.trim())
                    .filter((name: string) => name.length > 0)
                    .join(' / ');
            }

            let referenceDate = new Date(); 
            if (mapping.data) {
                const rawDate = getValue(mapping.data);
                if (rawDate) {
                     if (rawDate instanceof Date) {
                        referenceDate = rawDate;
                     } else {
                        const d = new Date(rawDate);
                        if (!isNaN(d.getTime())) referenceDate = d;
                     }
                }
            }

            let duracaoString = '';
            let durationMinutes = 0;

            if (mapping.duracao) {
                const rawDuration = getValue(mapping.duracao);
                if (rawDuration) {
                     if (typeof rawDuration === 'number') {
                         const totalMinutes = Math.round(rawDuration * 24 * 60);
                         durationMinutes = totalMinutes;
                         const h = Math.floor(totalMinutes / 60);
                         const m = totalMinutes % 60;
                         duracaoString = `${h}:${m.toString().padStart(2, '0')}`;
                     } 
                     else if (typeof rawDuration === 'string') {
                         if (rawDuration.includes(':')) {
                            const [h, m] = rawDuration.split(':').map(Number);
                            durationMinutes = (h * 60) + m;
                            duracaoString = rawDuration;
                         } else if (!isNaN(parseFloat(rawDuration))) {
                             const num = parseFloat(rawDuration);
                             const totalMinutes = Math.round(num * 24 * 60);
                             durationMinutes = totalMinutes;
                             const h = Math.floor(totalMinutes / 60);
                             const m = totalMinutes % 60;
                             duracaoString = `${h}:${m.toString().padStart(2, '0')}`;
                         }
                     }
                }
            }

            const rawStart = getValue(mapping.horaInicio);
            const startDate = parseExcelTime(rawStart, referenceDate);

            let endDate: Date;

            if (durationMinutes > 0) {
                endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
            } else {
                const rawEnd = getValue(mapping.horaFim);
                if (rawEnd) {
                     endDate = parseExcelTime(rawEnd, referenceDate);
                } else {
                     endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                }
                
                if (endDate.getTime() <= startDate.getTime()) {
                     if (endDate.getTime() === startDate.getTime()) {
                         endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                     } 
                     else if (startDate.toDateString() === endDate.toDateString()) { 
                        endDate.setDate(endDate.getDate() + 1);
                     }
                }

                const diffMs = endDate.getTime() - startDate.getTime();
                const diffHours = Math.floor(diffMs / 3600000);
                const diffMinutes = Math.floor((diffMs % 3600000) / 60000);
                duracaoString = `${diffHours}:${diffMinutes.toString().padStart(2, '0')}`;
            }

            return {
                id: `imported_${batchId}_${index}`,
                idMp: getValue(mapping.idMp),
                tag: getValue(mapping.tag),
                tipo: 'PLANO',
                periodicidade: 'Semanal',
                area: getValue(mapping.area),
                descricao: getValue(mapping.descricao) || 'N/A',
                jornada: '',
                turno: String(getValue(mapping.turno)),
                empresa: 'FOSPAR',
                efetivo: '', 
                responsavel: rawResponsavel,
                supervisor: getValue(mapping.supervisor) || '', 
                horaInicio: startDate.toISOString(),
                horaFim: endDate.toISOString(),
                duracao: duracaoString,
                "r eletrico": false,
                labapet: false,
                criticidade: validCriticidade,
                status: ActivityStatus.Open, 
                attachments: [],
                beforeImage: [], 
                afterImage: [],
            };
        }).filter(act => act.descricao && act.descricao !== 'N/A');

        setActivities([...currentActivities, ...newActivities]);
        
        for (const act of newActivities) {
            await saveActivityToSupabase(act);
        }

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

        setImportBatches(prev => {
            const filtered = prev.filter(b => b.id !== batchId);
            return [newBatch, ...filtered];
        });
        await saveBatchToSupabase(newBatch);

        addAuditLog(editingBatchId ? "EDITAR_IMPORT" : "IMPORTAR", 
            editingBatchId 
                ? `Atualizou mapeamento da importação (${newActivities.length} atividades)`
                : `Importou ${newActivities.length} atividades`
        );

        setIsImportModalOpen(false);
        setPendingImportData([]);
        setPendingImportFile(null);
        setEditingBatchId(null);
        setInitialMapping(undefined);
        alert(`${newActivities.length} atividades ${editingBatchId ? 'atualizadas' : 'importadas'} com sucesso!`);
    };

    const handleDeleteImportBatch = async (batchId: string) => {
        if (window.confirm("Tem certeza que deseja excluir todas as atividades desta importação?")) {
            const prefix = `imported_${batchId}_`;
            
            // 1. Find IDs to delete
            const idsToDelete = activities.filter(act => act.id.startsWith(prefix)).map(a => a.id);
            
            // 2. Update Local State
            setActivities(prev => prev.filter(act => !act.id.startsWith(prefix)));
            setImportBatches(prev => prev.filter(b => b.id !== batchId));
            
            // 3. Delete from Supabase
            for (const id of idsToDelete) {
                await deleteActivityFromSupabase(id);
            }
            await deleteBatchFromSupabase(batchId);

            addAuditLog("EXCLUIR", `Excluiu lote de importação ${new Date(parseInt(batchId)).toLocaleString()}`);
        }
    };

    const handleEditImportBatch = (batchId: string) => {
        const batch = importBatches.find(b => b.id === batchId);
        if (!batch) return;

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

        if (currentView !== 'list') {
            filtered.sort((a, b) => new Date(a.horaInicio).getTime() - new Date(b.horaInicio).getTime());
        }

        return filtered;
    }, [activities, filters, user, currentView]);

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView activities={filteredAndSortedActivities} customStatusLabels={statusLabels} />;
            case 'list': return <ActivityListView activities={filteredAndSortedActivities} onEdit={openEditModal} onUpdateStatus={handleUpdateStatus} customStatusLabels={statusLabels} />;
            case 'board': return <ActivityBoardView activities={filteredAndSortedActivities} onEdit={openEditModal} onUpdateStatus={handleUpdateStatus} onImageClick={setViewingImage} customStatusLabels={statusLabels} />;
            case 'calendar': return <ActivityCalendarView activities={filteredAndSortedActivities} onEdit={openEditModal} customStatusLabels={statusLabels} onDateChange={handleActivityDateChange} />;
            case 'gantt': return <ActivityGanttView activities={filteredAndSortedActivities} onEdit={openEditModal} />;
            case 'report': return <ReportView activities={filteredAndSortedActivities} onImageClick={setViewingImage} customStatusLabels={statusLabels} />;
            case 'audit': return <AuditLogView logs={auditLogs} />;
            case 'manpower': return <ManPowerView activities={filteredAndSortedActivities} />;
            default: return <DashboardView activities={filteredAndSortedActivities} customStatusLabels={statusLabels} />;
        }
    };

    const uniqueTurnos = useMemo(() => ['all', ...Array.from(new Set(activities.map(a => a.turno).filter(Boolean)))], [activities]);
    const uniqueResponsaveis = useMemo(() => ['all', ...Array.from(new Set(activities.map(a => a.responsavel)))], [activities]);
    const uniqueSupervisores = useMemo(() => ['all', ...Array.from(new Set(activities.map(a => a.supervisor || '').filter(Boolean)))], [activities]);
    const uniqueIdMps = useMemo(() => Array.from(new Set(activities.map(a => a.idMp).filter(Boolean) as string[])), [activities]);

    if (!user) {
        return <LoginView onLogin={handleLogin} onRegister={handleRegister} onRecoverPassword={handleRecoverPassword} onRecoverUsername={handleRecoverUsername} error={loginError} />;
    }

    const userBackground = user.backgroundImage;
    const backgroundStyle = userBackground 
        ? { backgroundImage: `url("${userBackground}")` }
        : { backgroundImage: 'url("/background.png")' };

    return (
        <div className="flex flex-col min-h-screen bg-fixed bg-cover bg-center text-gray-900 dark:text-gray-100" style={backgroundStyle}>
            {/* Overlay */}
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
            />

            <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto relative z-10">
                {renderView()}
            </main>
            
            <button
                onClick={openCreateModal}
                className="fixed bottom-8 right-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg transition-transform transform hover:scale-110 focus:outline-none z-50"
            >
                <PlusIcon className="w-8 h-8" />
            </button>

            <ImportMappingModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                excelHeaders={excelHeaders} 
                onConfirm={handleImportConfirm}
                initialMapping={initialMapping}
            />

            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configurações do Sistema">
                <div className="space-y-8">
                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-white">Foto de Perfil</h3>
                        <div className="flex items-center space-x-4">
                            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                                {user.profilePicture ? <img src={user.profilePicture} alt="Perfil" className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 m-auto text-gray-400" />}
                            </div>
                            <label className="cursor-pointer bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm flex items-center">
                                <PhotoIcon className="w-4 h-4 mr-2" /> Alterar
                                <input type="file" className="hidden" accept="image/*" onChange={handleProfilePictureUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-white">Imagem de Fundo</h3>
                        <div className="flex items-center space-x-4">
                            <label className="cursor-pointer bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm flex items-center">
                                <PhotoIcon className="w-4 h-4 mr-2" /> Upload Personalizado
                                <input type="file" className="hidden" accept="image/*" onChange={handleBackgroundUpload} />
                            </label>
                            {userBackground && <button onClick={handleRemoveBackground} className="text-red-600 text-sm underline">Restaurar Padrão</button>}
                        </div>
                    </div>

                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Gerenciar Importações</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                            Aqui você pode excluir importações antigas ou <strong className="text-blue-600 dark:text-blue-400">editar o mapeamento de colunas</strong> de uma importação existente.
                        </p>

                        {importBatches.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhuma importação registrada.</p>
                        ) : (
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {importBatches.map((batch) => (
                                    <li key={batch.id} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded shadow-sm border dark:border-gray-700">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold dark:text-white">
                                                {new Date(batch.date).toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                {batch.count} atividades
                                            </span>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            <button
                                                onClick={() => handleEditImportBatch(batch.id)}
                                                className="flex items-center space-x-1 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 rounded hover:bg-blue-200"
                                                title="Editar Mapeamento das Colunas"
                                            >
                                                <PencilIcon className="w-4 h-4" />
                                                <span className="text-xs font-semibold">Editar Mapeamento</span>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteImportBatch(batch.id)}
                                                className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                                                title="Excluir este lote"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {user.role === 'admin' && (
                        <div className="pb-6 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg mt-6">
                            <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Gerenciar Usuários</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                                Lista de usuários cadastrados no sistema.
                            </p>
                            <ul className="space-y-2 max-h-40 overflow-y-auto">
                                {users.map((u) => (
                                    <li key={u.username} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded shadow-sm border dark:border-gray-700">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                                 {u.profilePicture ? <img src={u.profilePicture} alt={u.name} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 m-auto text-gray-400" />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold dark:text-white">{u.name}</span>
                                                <span className="text-xs text-gray-500 dark:text-gray-400">@{u.username} ({u.role})</span>
                                            </div>
                                        </div>
                                        {u.username !== user.username && (
                                            <button 
                                                onClick={() => handleDeleteUser(u.username)}
                                                className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                title="Excluir usuário"
                                            >
                                                <TrashIcon className="w-5 h-5" />
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700 mt-6">
                        <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-white">Nomes dos Status</h3>
                        <div className="grid gap-4">
                            {Object.values(ActivityStatus).map((status) => (
                                <div key={status} className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 w-1/3">{status}</label>
                                    <input 
                                        type="text" 
                                        value={statusLabels[status] || status}
                                        onChange={(e) => handleStatusLabelChange(status, e.target.value)}
                                        className="w-2/3 p-2 rounded border dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
                                    />
                                </div>
                            ))}
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
                </div>
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingActivity ? "Editar Atividade" : "Criar Atividade"}>
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
