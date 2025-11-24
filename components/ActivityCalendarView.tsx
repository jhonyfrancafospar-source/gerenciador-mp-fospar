
import React, { useState } from 'react';
import type { Activity } from '../types';
import { getStatusClasses, getStatusLabel } from '../utils/styleUtils';

interface ActivityCalendarViewProps {
    activities: Activity[];
    onEdit: (activity: Activity) => void;
    customStatusLabels?: Record<string, string>;
    onDateChange: (activityId: string, newDate: Date) => void;
}

export const ActivityCalendarView: React.FC<ActivityCalendarViewProps> = ({ activities, onEdit, customStatusLabels = {}, onDateChange }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
    const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => setCurrentDate(new Date());

    const monthNames = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

    // Group activities by day
    const activitiesByDay: Record<number, Activity[]> = {};
    activities.forEach(activity => {
        const actDate = new Date(activity.horaInicio);
        if (actDate.getFullYear() === year && actDate.getMonth() === month) {
            const day = actDate.getDate();
            if (!activitiesByDay[day]) activitiesByDay[day] = [];
            activitiesByDay[day].push(activity);
        }
    });

    const handleDragStart = (e: React.DragEvent, id: string) => {
        e.dataTransfer.setData("text/plain", id);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping
    };

    const handleDrop = (e: React.DragEvent, day: number) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        if (id) {
            const targetDate = new Date(year, month, day);
            onDateChange(id, targetDate);
        }
    };

    // Grid generation
    const days = [];
    // Empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="bg-gray-50 dark:bg-gray-900/50 min-h-[100px] border-r border-b border-gray-200 dark:border-gray-700"></div>);
    }
    
    // Actual days
    for (let day = 1; day <= daysInMonth; day++) {
        const isToday = 
            new Date().getDate() === day && 
            new Date().getMonth() === month && 
            new Date().getFullYear() === year;

        const dayActivities = activitiesByDay[day] || [];

        days.push(
            <div 
                key={day} 
                className={`min-h-[120px] border-r border-b border-gray-200 dark:border-gray-700 p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white/80 dark:bg-gray-800/80'}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
            >
                <div className="flex justify-between items-center mb-2">
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {day}
                    </span>
                    {dayActivities.length > 0 && (
                        <span className="text-xs text-gray-400 font-mono">{dayActivities.length} atv</span>
                    )}
                </div>
                
                <div className="space-y-1 overflow-y-auto max-h-[100px] scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
                    {dayActivities.map(act => (
                        <div 
                            key={act.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, act.id)}
                            onClick={(e) => { e.stopPropagation(); onEdit(act); }}
                            className={`text-[10px] px-1.5 py-1 rounded cursor-grab active:cursor-grabbing truncate border-l-2 shadow-sm hover:opacity-80 ${getStatusClasses(act.status, false).replace('text-xs', '').replace('font-bold', 'font-medium').replace('uppercase', '')}`}
                            title={`${act.tag} - ${act.descricao}`}
                        >
                            <span className="font-bold mr-1">{new Date(act.horaInicio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                            {act.tag}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Calendar Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white capitalize">
                        {monthNames[month]} {year}
                    </h2>
                    <div className="flex items-center space-x-1">
                        <button onClick={prevMonth} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={goToToday} className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800">
                            Hoje
                        </button>
                        <button onClick={nextMonth} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                    {activities.length} Atividades Totais
                </div>
            </div>

            {/* Weekdays Header */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900">
                {dayNames.map(day => (
                    <div key={day} className="py-2 text-center text-sm font-semibold text-gray-600 dark:text-gray-400">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 bg-gray-200 dark:bg-gray-700 gap-px border-l border-gray-200 dark:border-gray-700">
                {days}
            </div>
        </div>
    );
};
