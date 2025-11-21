import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Activity, ViewType, FilterType, ActivityStatus, Criticidade, AuditLogEntry, User, ImportMapping, ImportBatch, Recorrencia } from './types';
import { PlusIcon } from './components/icons/PlusIcon';
import { ImageViewerModal } from './components/ImageViewerModal';
import { PhotoIcon } from './components/icons/PhotoIcon';
import { UserIcon } from './components/icons/UserIcon';
import { TrashIcon } from './components/icons/TrashIcon';
import { PencilIcon } from './components/icons/PencilIcon';

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

    const [users, setUsers] = useState<User[]>(() => {
        const storedUsers = localStorage.getItem('db_users_secure');
        if (storedUsers) {
            return JSON.parse(storedUsers);
        }
        return mockUsers;
    });

    const [user, setUser] = useState<User | null>(() => {
        const storedUser = localStorage.getItem('currentUser');
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [loginError, setLoginError] = useState<string | undefined>();

    // --- PERSISTENCE LOGIC START ---
    const [activities, setActivities] = useState<Activity[]>(() => {
        const stored = localStorage.getItem('db_activities');
        return stored ? JSON.parse(stored) : mockActivities;
    });

    const [importBatches, setImportBatches] = useState<ImportBatch[]>(() => {
        const stored = localStorage.getItem('db_import_batches');
        return stored ? JSON.parse(stored) : [];
    });

    // Save activities whenever they change
    useEffect(() => {
        localStorage.setItem('db_activities', JSON.stringify(activities));
    }, [activities]);

    // Save import batches whenever they change
    useEffect(() => {
        localStorage.setItem('db_import_batches', JSON.stringify(importBatches));
    }, [importBatches]);
    // --- PERSISTENCE LOGIC END ---

    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [currentView, setCurrentView] = useState<ViewType>('dashboard');
    
    // Filters
    const [filters, setFilters] = useState<FilterType>({ 
        turno: 'all', 
        responsavel: 'all', 
        supervisor: 'all',
        idMp: '',
        onlyMyActivities: false
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const [viewingImage, setViewingImage] = useState<string | null>(null);

    // Import State
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
    const [pendingImportData, setPendingImportData] = useState<any[]>([]);
    const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
    const [initialMapping, setInitialMapping] = useState<ImportMapping | undefined>(undefined);

    // Status Customization State
    const [statusLabels, setStatusLabels] = useState<Record<string, string>>(() => {
        const stored = localStorage.getItem('statusLabels');
        if (stored) return JSON.parse(stored);
        
        // Default Portuguese Labels
        return {
            [ActivityStatus.Open]: 'Aberto',
            [ActivityStatus.NaoExecutado]: 'Não Executado',
            [ActivityStatus.EmProgresso]: 'Em Andamento',
            [ActivityStatus.ExecutadoParcialmente]: 'Parcial',
            [ActivityStatus.Closed]: 'Concluído',
        };
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('db_users_secure', JSON.stringify(users));
    }, [users]);

    useEffect(() => {
        if (user) {
            const updatedCurrentUser = users.find(u => u.username === user.username);
            if (updatedCurrentUser) {
                localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));
                if (JSON.stringify(updatedCurrentUser) !== JSON.stringify(user)) {
                    setUser(updatedCurrentUser);
                }
            }
        }
    }, [users]);

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

    const handleRegister = (newUser: User) => {
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
    };

    const handleRecoverPassword = (username: string, name: string, newPassword: string): boolean => {
        const userIndex = users.findIndex(u => 
            u.username.toLowerCase() === username.toLowerCase() &&
            u.name.toLowerCase() === name.toLowerCase()
        );
        if (userIndex !== -1) {
            const updatedUsers = [...users];
            updatedUsers[userIndex] = { ...updatedUsers[userIndex], password: newPassword };
            setUsers(updatedUsers);
            setLoginError(undefined);
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

    const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                const updatedUsers = users.map(u => 
                    u.username === user.username ? { ...u, backgroundImage: result } : u
                );
                setUsers(updatedUsers);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveBackground = () => {
        if (user) {
             const updatedUsers = users.map(u => 
                u.username === user.username ? { ...u, backgroundImage: undefined } : u
            );
            setUsers(updatedUsers);
        }
    };

    const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && user) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                const updatedUsers = users.map(u => 
                    u.username === user.username ? { ...u, profilePicture: result } : u
                );
                setUsers(updatedUsers);
            };
            reader.readAsDataURL(file);
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
        
        // Start from next instance
        const addNextInterval = (date: Date) => {
             switch (baseActivity.periodicidade) {
                case Recorrencia.Diario: date.setDate(date.getDate() + 1); break;
                case Recorrencia.Semanal: date.setDate(date.getDate() + 7); break;
                case Recorrencia.Quinzenal: date.setDate(date.getDate() + 15); break;
                case Recorrencia.Mensal: date.setMonth(date.getMonth() + 1); break;
                case Recorrencia.Trimestral: date.setMonth(date.getMonth() + 3); break;
                case Recorrencia.Semestral: date.setMonth(date.getMonth() + 6); break;
                default: date.setDate(date.getDate() + 1); // Should not happen if NaoHa check is done
            }
        };

        addNextInterval(nextDate);

        // Safety cap to prevent infinite loops (e.g., 200 instances or 2 years)
        let count = 0;
        const maxInstances = 365; 

        while (nextDate <= limitDate && count < maxInstances) {
            const newStart = new Date(nextDate);
            const newEnd = new Date(nextDate.getTime() + durationMs);
            
            generated.push({
                ...baseActivity,
                horaInicio: newStart.toISOString(),
                horaFim: newEnd.toISOString(),
                // Ensure status is reset for future instances
                status: ActivityStatus.Open, 
                horaInicioReal: undefined, 
                horaFimReal: undefined
            });

            addNextInterval(nextDate);
            count++;
        }
        
        return generated;
    };

    const handleAddActivity = (activity: Omit<Activity, 'id'>, recurrenceLimit?: Date) => {
        const activitiesToAdd: Omit<Activity, 'id'>[] = [activity];
        
        // Check for recurrence generation
        if (recurrenceLimit && activity.periodicidade !== Recorrencia.NaoHa) {
            const futureActivities = generateRecurringActivities(activity, recurrenceLimit);
            activitiesToAdd.push(...futureActivities);
        }

        const newActivities: Activity[] = activitiesToAdd.map((act, index) => ({
            ...act,
            id: `act_${Date.now()}_${index}`,
        }));

        setActivities(prev => [...prev, ...newActivities]);
        addAuditLog("CRIAR", `Criou ${newActivities.length} atividades (${activity.tag})`, newActivities[0].id);
    };

    const handleUpdateActivity = (updatedActivity: Activity, recurrenceLimit?: Date) => {
        // Update the original activity
        setActivities(prev => prev.map(act => act.id === updatedActivity.id ? updatedActivity : act));
        
        // Handle recurrence on edit: only generate NEW instances if requested, does not update existing ones linked
        if (recurrenceLimit && updatedActivity.periodicidade !== Recorrencia.NaoHa) {
             // We strip the ID to treat it as a template
             // eslint-disable-next-line @typescript-eslint/no-unused-vars
             const { id, ...activityTemplate } = updatedActivity;
             const futureActivities = generateRecurringActivities(activityTemplate, recurrenceLimit);
             
             if (futureActivities.length > 0) {
                const newInstances: Activity[] = futureActivities.map((act, index) => ({
                    ...act,
                    id: `act_gen_${Date.now()}_${index}`,
                }));
                setActivities(prev => [...prev, ...newInstances]);
                alert(`Foram geradas mais ${newInstances.length} recorrências até a data selecionada.`);
                addAuditLog("RECORRENCIA", `Gerou ${newInstances.length} recorrências ao editar ${updatedActivity.tag}`);
             }
        }

        setEditingActivity(null);
        addAuditLog("EDITAR", `Editou detalhes da atividade ${updatedActivity.tag}`, updatedActivity.id);
    };
    
    const handleUpdateStatus = (activityId: string, status: ActivityStatus) => {
        const activity = activities.find(a => a.id === activityId);
        if (activity) {
            setActivities(prev => prev.map(act => act.id === activityId ? {...act, status} : act));
            addAuditLog("STATUS", `Alterou status de ${activity.tag} para ${status}`, activityId);
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
        // Logic handled by useEffect, just provide feedback
        alert("Configurações salvas com sucesso!");
        setIsSettingsModalOpen(false);
    };

    const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        
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

    const handleImportConfirm = (mapping: ImportMapping) => {
        const parseExcelTime = (timeValue: any, referenceDate: Date = new Date()): Date => {
            const resultDate = new Date(referenceDate);
            
            if (timeValue instanceof Date) {
                // SheetJS dates can be 1899-based for pure times. 
                // Check if year is less than 1905 (Excel epoch is 1899)
                if (timeValue.getFullYear() < 1905) {
                    // It's a time-only value (e.g. "08:00"). Use UTC getters to avoid timezone shift
                    resultDate.setHours(timeValue.getUTCHours(), timeValue.getUTCMinutes(), timeValue.getUTCSeconds(), 0);
                    return resultDate;
                } else {
                    // It's a full date (e.g. "2025-08-01 08:00"). Use it directly!
                    return new Date(timeValue);
                }
            }
            
            if (typeof timeValue === 'string') {
                // Try parsing as ISO date first
                const timestamp = Date.parse(timeValue);
                if (!isNaN(timestamp)) {
                    return new Date(timestamp);
                }

                // Fallback: "HH:MM" string
                if (timeValue.includes(':')) {
                    const [hours, minutes] = timeValue.split(':').map(Number);
                    if (!isNaN(hours) && !isNaN(minutes)) {
                        resultDate.setHours(hours, minutes, 0, 0);
                        return resultDate;
                    }
                }
            }
            
            // Excel decimal time (e.g., 0.5 = 12:00)
            if (typeof timeValue === 'number') {
                 const totalSeconds = Math.round(timeValue * 86400);
                 const hours = Math.floor(totalSeconds / 3600);
                 const minutes = Math.floor((totalSeconds % 3600) / 60);
                 resultDate.setHours(hours, minutes, 0, 0);
                 return resultDate;
            }
            
            return resultDate;
        };

        // Determine Batch ID (either new or reusing if editing)
        const batchId = editingBatchId || String(Date.now());

        // If editing, first remove the old activities from this batch
        let currentActivities = [...activities];
        if (editingBatchId) {
            currentActivities = currentActivities.filter(act => !act.id.startsWith(`imported_${editingBatchId}_`));
        }

        const newActivities: Activity[] = pendingImportData.map((row, index) => {
            const getValue = (key: string) => row[key] || '';
            
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

            // --- CRITICAL: Duration & Date Logic ---
            
            // 1. Determine Duration First
            let duracaoString = '';
            let durationMinutes = 0;

            if (mapping.duracao) {
                const rawDuration = getValue(mapping.duracao);
                if (rawDuration) {
                     // Excel decimal (e.g. 0.04166 for 1h)
                     if (typeof rawDuration === 'number') {
                         const totalMinutes = Math.round(rawDuration * 24 * 60);
                         durationMinutes = totalMinutes;
                         const h = Math.floor(totalMinutes / 60);
                         const m = totalMinutes % 60;
                         duracaoString = `${h}:${m.toString().padStart(2, '0')}`;
                     } 
                     // String HH:MM or decimal string
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

            // 2. Parse Start Date
            const rawStart = getValue(mapping.horaInicio);
            const startDate = parseExcelTime(rawStart);

            // 3. Determine End Date & Duration
            // If we have a valid mapped duration, FORCE the End Date to match: Start + Duration.
            // This ensures mathematical consistency.
            
            let endDate: Date;

            if (durationMinutes > 0) {
                // Recalculate End Date from Duration
                endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
            } else {
                // No mapped duration, try to parse End Date from Excel
                const rawEnd = getValue(mapping.horaFim);
                
                if (rawEnd) {
                     endDate = parseExcelTime(rawEnd);
                } else {
                     // Fallback: Start + 1h
                     endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                }
                
                // Fix common issues where End <= Start (e.g. time wrapping 23:00 -> 01:00)
                if (endDate.getTime() <= startDate.getTime()) {
                     // If exactly equal, add 1 hour (common data entry error)
                     if (endDate.getTime() === startDate.getTime()) {
                         endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
                     } 
                     // If End < Start (e.g. 01:00 < 23:00), add 1 day
                     else if (startDate.toDateString() === endDate.toDateString()) { 
                        endDate.setDate(endDate.getDate() + 1);
                     }
                }

                // Calculate Duration from Dates since we didn't have one mapped
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
                beforeImage: undefined,
                afterImage: undefined,
            };
        }).filter(act => act.descricao && act.descricao !== 'N/A');

        // Update Activities
        setActivities([...currentActivities, ...newActivities]);

        // Update or Create Import Batch Record
        const newBatch: ImportBatch = {
            id: batchId,
            date: new Date().toISOString(),
            count: newActivities.length,
            rawData: pendingImportData,
            headers: excelHeaders,
            mapping: mapping
        };

        setImportBatches(prev => {
            // Remove existing if editing, then add new
            const filtered = prev.filter(b => b.id !== batchId);
            return [newBatch, ...filtered];
        });

        addAuditLog(editingBatchId ? "EDITAR_IMPORT" : "IMPORTAR", 
            editingBatchId 
                ? `Atualizou mapeamento da importação (${newActivities.length} atividades)`
                : `Importou ${newActivities.length} atividades`
        );

        // Reset State
        setIsImportModalOpen(false);
        setPendingImportData([]);
        setEditingBatchId(null);
        setInitialMapping(undefined);
        alert(`${newActivities.length} atividades ${editingBatchId ? 'atualizadas' : 'importadas'} com sucesso!`);
    };

    const handleDeleteImportBatch = (batchId: string) => {
        if (window.confirm("Tem certeza que deseja excluir todas as atividades desta importação?")) {
            // Use startsWith to specifically target activities from this batch
            const prefix = `imported_${batchId}_`;
            setActivities(prev => prev.filter(act => !act.id.startsWith(prefix)));
            setImportBatches(prev => prev.filter(b => b.id !== batchId));
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
        setIsSettingsModalOpen(false); // Close settings to show import modal
        setIsImportModalOpen(true);
    };

    const filteredAndSortedActivities = useMemo(() => {
        let filtered = activities.filter(activity => {
            const turnoMatch = filters.turno === 'all' || activity.turno === filters.turno;
            const responsavelMatch = filters.responsavel === 'all' || activity.responsavel === filters.responsavel;
            const supervisorMatch = filters.supervisor === 'all' || (activity.supervisor || '') === filters.supervisor;
            const idMpMatch = !filters.idMp || (activity.idMp === filters.idMp);
            
            // UPDATED: Check if user is Responsavel OR Supervisor
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
            case 'calendar': return <ActivityCalendarView activities={filteredAndSortedActivities} onEdit={openEditModal} customStatusLabels={statusLabels} />;
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

    // Background Priority: User > Local File (Default) > Fallback URL
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
            />

            {/* Main Content */}
            <main className="p-4 sm:p-6 lg:p-8 flex-1 overflow-y-auto relative z-10">
                {renderView()}
            </main>
            
            {/* Floating Action Button */}
            <button
                onClick={openCreateModal}
                className="fixed bottom-8 right-8 bg-primary-600 hover:bg-primary-700 text-white rounded-full p-4 shadow-lg transition-transform transform hover:scale-110 focus:outline-none z-50"
            >
                <PlusIcon className="w-8 h-8" />
            </button>

            {/* Import Mapping Modal */}
            <ImportMappingModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
                excelHeaders={excelHeaders} 
                onConfirm={handleImportConfirm}
                initialMapping={initialMapping}
            />

            {/* Settings Modal */}
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Configurações do Sistema">
                <div className="space-y-8">
                    {/* Profile Picture */}
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

                    {/* Background */}
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

                    {/* Import Management - Highlighted */}
                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <h3 className="text-lg font-bold mb-2 text-gray-900 dark:text-white">Gerenciar Importações</h3>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                            Aqui você pode excluir importações antigas ou <strong className="text-blue-600 dark:text-blue-400">editar o mapeamento de colunas</strong> de uma importação existente.
                        </p>

                        {importBatches.length === 0 ? (
                            <p className="text-sm text-gray-500">Nenhuma importação registrada nesta sessão.</p>
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

                    {/* Status Names */}
                    <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
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
                <ActivityForm activity={editingActivity} onSubmit={editingActivity ? handleUpdateActivity : handleAddActivity} onClose={() => setIsModalOpen(false)} customStatusLabels={statusLabels} />
            </Modal>

            {viewingImage && <ImageViewerModal src={viewingImage} onClose={() => setViewingImage(null)} />}
        </div>
    );
};

export default App;