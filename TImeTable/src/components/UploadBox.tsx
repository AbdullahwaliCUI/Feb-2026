'use client';

import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface UploadBoxProps {
    onFileSelect: (file: File) => void;
    isProcessing: boolean;
    progress?: number;
    onClear: () => void;
    selectedFile: File | null;
}

export function UploadBox({ onFileSelect, isProcessing, progress = 0, onClear, selectedFile }: UploadBoxProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Only PDF files are accepted.');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setError('File size must be less than 15 MB.');
            return;
        }

        setError(null);
        onFileSelect(file);
    };

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, []);

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    return (
        <div className="w-full max-w-2xl mx-auto mb-8">
            <div
                className={cn(
                    "relative group border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ease-in-out flex flex-col items-center justify-center min-h-[200px] cursor-pointer",
                    isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
                    selectedFile && "border-green-500 bg-green-50/30"
                )}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
            >
                <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={onChange}
                    accept=".pdf"
                    disabled={isProcessing}
                />

                {!selectedFile ? (
                    <>
                        <div className="p-4 rounded-full bg-blue-100/50 mb-4 group-hover:scale-110 transition-transform duration-300">
                            <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="text-lg font-medium text-slate-700">
                            {isProcessing ? "Processing PDF..." : "Drag & drop PDF or click here"}
                        </p>
                        {isProcessing && (
                            <div className="w-full max-w-xs mt-4">
                                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-600 transition-all duration-300 ease-out"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                                <p className="text-xs text-blue-600 font-bold mt-2">{progress}% completed</p>
                            </div>
                        )}
                        <p className="text-sm text-slate-500 mt-2">Maximum file size: 15MB</p>
                    </>
                ) : (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                        <div className="p-4 rounded-full bg-green-100/50 mb-4">
                            <FileText className="w-8 h-8 text-green-600" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-medium text-slate-700 truncate max-w-xs">{selectedFile.name}</p>
                            <p className="text-sm text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onClear();
                            }}
                            className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                            Remove
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-red-800 animate-in slide-in-from-top-2 duration-300">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
            )}
        </div>
    );
}
