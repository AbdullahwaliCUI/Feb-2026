'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import debounce from 'lodash.debounce';

interface SearchBarProps {
    onSearch: (query: string) => void;
    onClear: () => void;
    onSelectInstructor?: (name: string) => void;
    suggestions?: string[];
    disabled?: boolean;
}

export function SearchBar({ onSearch, onClear, onSelectInstructor, suggestions = [], disabled }: SearchBarProps) {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);

    // Filter suggestions based on input
    useEffect(() => {
        if (inputValue.trim().length > 0 && suggestions.length > 0) {
            const lower = inputValue.toLowerCase();
            const filtered = suggestions
                .filter(s => s.toLowerCase().includes(lower) && s !== 'Unknown')
                .slice(0, 10); // Limit to top 10
            setFilteredSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
        } else {
            setFilteredSuggestions([]);
            setShowSuggestions(false);
        }
    }, [inputValue, suggestions]);

    // Debounce the search callback
    const debouncedSearch = useCallback(
        debounce((query: string) => {
            onSearch(query);
        }, 300),
        [onSearch]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);
        debouncedSearch(value);
    };

    const handleClear = () => {
        setInputValue('');
        onClear();
        setShowSuggestions(false);
    };

    const handleSelect = (name: string) => {
        setInputValue(name);
        onSearch(name);
        if (onSelectInstructor) onSelectInstructor(name);
        setShowSuggestions(false);
    };

    return (
        <div className="w-full max-w-xl mx-auto mb-10 relative">
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-11 pr-12 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all disabled:opacity-50 disabled:bg-slate-50"
                    placeholder="Search for a teacher (e.g., Muhammad Abdullah)"
                    value={inputValue}
                    onChange={handleChange}
                    onFocus={() => inputValue && filteredSuggestions.length > 0 && setShowSuggestions(true)}
                    disabled={disabled}
                />
                {inputValue && (
                    <button
                        onClick={handleClear}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
                <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-2 border-b border-slate-50 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-4">
                        Matching Instructors
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filteredSuggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => handleSelect(suggestion)}
                                className="w-full text-left px-5 py-3 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                            >
                                <div className="w-8 h-8 rounded-lg bg-blue-100/50 text-blue-600 flex items-center justify-center font-bold text-xs">
                                    {suggestion.charAt(0)}
                                </div>
                                <span className="font-medium">{suggestion}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <p className="mt-2 text-center text-xs text-slate-400">
                Enter a name to filter the timetable automatically.
            </p>
        </div>
    );
}
