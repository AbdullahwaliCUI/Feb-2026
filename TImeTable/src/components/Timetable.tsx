'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Download, Printer, User, MapPin } from 'lucide-react';
import { ClassBlock, Day } from '../lib/pdf/types';
import html2canvas from 'html2canvas';

interface TimetableProps {
    blocks: ClassBlock[];
    query: string;
    pdfName: string;
    timeSlotLabels?: string[];
}

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const DEFAULT_TIME_SLOTS = [
    '8:00 - 9:05 AM',
    '9:05 - 10:10 AM',
    '10:10 - 11:15 AM',
    '11:15 AM - 12:20 PM',
    '12:20 - 1:25 PM',
    '1:25 - 2:30 PM',
];

export function Timetable({ blocks, query, pdfName, timeSlotLabels }: TimetableProps) {
    const [activeDay, setActiveDay] = React.useState<Day>(DAYS[0]);
    const componentRef = useRef<HTMLDivElement>(null);

    const labels = timeSlotLabels && timeSlotLabels.length > 0 ? timeSlotLabels : DEFAULT_TIME_SLOTS;

    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: `Timetable_${query || 'All'}_${pdfName}`,
    });

    const handleDownloadImage = async () => {
        if (!componentRef.current) return;

        try {
            const canvas = await html2canvas(componentRef.current, {
                scale: 2, // High quality
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const link = document.createElement('a');
            link.download = `Timetable_${query || 'All'}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Failed to download image:', err);
        }
    };

    const getDayBlocks = (day: Day, slotIndex: number) => {
        return blocks.filter(b => b.day === day && b.slotIndex === slotIndex);
    };

    if (blocks.length === 0 && !query) return null;

    const uniquePages = new Set(blocks.map(b => b.page)).size;

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm gap-4">
                <div className="w-full md:w-auto">
                    <h2 className="text-xl font-bold text-slate-800">
                        {blocks.length} {blocks.length === 1 ? 'Class' : 'Classes'} Found
                    </h2>
                    <p className="text-sm text-slate-500">
                        {query ? `Filter: "${query}"` : 'Showing all classes'}
                    </p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={handlePrint}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-md active:scale-95"
                    >
                        <Download className="w-4 h-4" />
                        PDF
                    </button>
                    <button
                        onClick={handleDownloadImage}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-md active:scale-95"
                    >
                        <Printer className="w-4 h-4" />
                        PNG
                    </button>
                </div>
            </div>

            {/* Mobile Day Tabs */}
            <div className="flex sm:hidden overflow-x-auto gap-2 pb-2 no-scrollbar">
                {DAYS.map(day => (
                    <button
                        key={day}
                        onClick={() => setActiveDay(day)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${activeDay === day
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-white text-slate-500 border border-slate-200'
                            }`}
                    >
                        {day}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div ref={componentRef} className="min-w-[1000px] sm:min-w-full p-4 sm:p-8 bg-white">
                    {/* Print Header */}
                    <div className="hidden print:block mb-8 border-b pb-4">
                        <h1 className="text-2xl font-bold text-slate-900">Timetable Finder</h1>
                        <p className="text-slate-600">Instructor: {query || 'All'}</p>
                        <p className="text-sm text-slate-400">Generated from: {pdfName} · Pages: {uniquePages} <span className="text-[10px] opacity-20">v2.1-dynamic</span></p>
                    </div>

                    <div
                        className="grid gap-px bg-slate-200 border border-slate-200"
                        style={{ gridTemplateColumns: `80px repeat(${labels.length}, 1fr)` }}
                    >
                        {/* Header Row */}
                        <div className="bg-slate-50 p-4 text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider text-center flex items-center justify-center">Day / Slot</div>
                        {labels.map((slotLabel, idx) => {
                            const isBreak = /Break/i.test(slotLabel);
                            const isGeneric = /^Slot \d+$/i.test(slotLabel);

                            return (
                                <div
                                    key={idx}
                                    className={`${isBreak ? 'bg-slate-100' : 'bg-slate-50'} p-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-center text-slate-600 flex flex-col items-center justify-center gap-1`}
                                >
                                    <span className={`${isBreak ? 'text-slate-500' : 'text-blue-600'} font-black text-[11px] sm:text-xs`}>
                                        {isBreak ? '☕ Break' : (isGeneric ? slotLabel : slotLabel)}
                                    </span>
                                    {!isBreak && !isGeneric && (
                                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] whitespace-nowrap opacity-60">
                                            Slot {idx + 1}
                                        </span>
                                    )}
                                </div>
                            );
                        })}

                        {/* Grid Rows */}
                        {DAYS.map((day) => (
                            <React.Fragment key={day}>
                                <div className="bg-slate-50 p-2 sm:p-4 text-[11px] sm:text-xs font-bold text-slate-700 flex items-center justify-center border-t border-slate-100 uppercase tracking-tighter">
                                    {day}
                                </div>
                                {labels.map((slotLabel, slotIdx) => {
                                    const isBreak = /Break/i.test(slotLabel);
                                    const currentSlotIndex = slotIdx + 1;
                                    const cellBlocks = getDayBlocks(day, currentSlotIndex);

                                    return (
                                        <div
                                            key={`${day}-${slotIdx}`}
                                            className={`${isBreak ? 'bg-slate-50/50' : 'bg-white'} p-2 min-h-[120px] sm:min-h-[140px] border-l border-t border-slate-100 relative group`}
                                        >
                                            {isBreak && cellBlocks.length === 0 && (
                                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
                                                    <span className="text-4xl font-black rotate-[-45deg] select-none text-slate-900">BREAK</span>
                                                </div>
                                            )}
                                            <div className="space-y-3 text-center flex flex-col items-center justify-center">
                                                {cellBlocks.map((block, i) => (
                                                    <div
                                                        key={i}
                                                        className={`w-full p-3 rounded-xl border text-xs shadow-sm transition-all hover:scale-[1.02] flex flex-col items-center justify-center min-h-[120px] ${block.isLab
                                                            ? 'bg-purple-50 border-purple-100 text-purple-900 shadow-purple-100/50'
                                                            : 'bg-blue-50 border-blue-100 text-blue-900 shadow-blue-100/50'
                                                            }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1 w-full">
                                                            <div className="font-bold leading-tight text-[10px] uppercase text-slate-500">
                                                                {block.section || block.course}
                                                            </div>
                                                            <div className="flex flex-col items-center mt-1">
                                                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest opacity-70">Room</span>
                                                                <div className="font-black text-[15px] uppercase tracking-tight text-slate-900 -mt-1">
                                                                    {block.room || 'TBD'}
                                                                </div>
                                                            </div>
                                                            {block.section && (
                                                                <div className="text-[10px] font-medium opacity-80 leading-tight">
                                                                    {block.course}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mt-3 pt-2 border-t border-current/10 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-slate-600">
                                                            <User className="w-3 h-3" />
                                                            {block.instructor}
                                                            {block.instructorDept && (
                                                                <span className="opacity-60 text-[8px] ml-0.5">({block.instructorDept})</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="mt-8 pt-8 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
                        <div className="font-medium">Generated by Timetable Finder · No login required</div>
                        <div className="font-bold text-slate-900">comsats-timetable.vercel.app</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

