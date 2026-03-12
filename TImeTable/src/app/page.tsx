'use client';

import React, { useState, useMemo } from 'react';
import { clsx } from 'clsx';
import { UploadBox } from '@/components/UploadBox';
import { SearchBar } from '@/components/SearchBar';
import { Timetable } from '@/components/Timetable';
import { usePdfParser } from '@/hooks/usePdfParser';
import { Calendar, Search, Download, Info, AlertCircle } from 'lucide-react';

export default function Home() {
  const { parsePdf, runOcr, isParsing, isOcrLoading, progress, error, parsedDoc, clear } = usePdfParser();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [file, setFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  // Auto-transition to Step 2 when parsing is complete
  React.useEffect(() => {
    if (parsedDoc && currentStep === 1) {
      setCurrentStep(2);
    }
  }, [parsedDoc, currentStep]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentStep(1);
    parsePdf(selectedFile);
  };

  const handleClear = () => {
    setFile(null);
    setSearchQuery('');
    setSelectedDept('all');
    setCurrentStep(1);
    clear();
  };

  const nameMap = useMemo(() => {
    if (!parsedDoc) return new Map<string, string>();
    const allNames = new Set<string>();
    parsedDoc.pages.forEach(p => p.blocks.forEach(b => {
      if (b.instructor && b.instructor !== 'Unknown') allNames.add(b.instructor);
    }));

    const sortedNames = Array.from(allNames).sort((a, b) => b.length - a.length);
    const mapping = new Map<string, string>();

    // Map shorter names to longer names if they are part of it
    sortedNames.forEach(longName => {
      const longNormalized = longName.toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '').trim();

      sortedNames.forEach(shortName => {
        if (longName === shortName) return;

        const shortNormalized = shortName.toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '').trim();

        // Strategy: If short name parts are all present in long name in order or significant parts match
        const shortParts = shortNormalized.split(/\s+/).filter(p => p.length > 2);
        const longParts = longNormalized.split(/\s+/);

        if (shortParts.length > 0 && shortParts.every(p => longParts.includes(p))) {
          mapping.set(shortName, longName);
        } else if (longNormalized.includes(shortNormalized) && shortNormalized.length > 4) {
          mapping.set(shortName, longName);
        }
      });
    });
    return mapping;
  }, [parsedDoc]);

  const allInstructors = useMemo(() => {
    if (!parsedDoc) return [];
    const names = new Set<string>();
    parsedDoc.pages.forEach(page => {
      page.blocks.forEach(block => {
        if (block.instructor && block.instructor !== 'Unknown') {
          const normalized = nameMap.get(block.instructor) || block.instructor;
          names.add(normalized);
        }
      });
    });
    return Array.from(names).sort();
  }, [parsedDoc, nameMap]);

  const allDepts = useMemo(() => {
    if (!parsedDoc) return [];
    const depts = new Set<string>();
    parsedDoc.pages.forEach(page => {
      page.blocks.forEach(block => {
        if (block.instructorDept) {
          depts.add(block.instructorDept);
        }
      });
    });
    return Array.from(depts).sort();
  }, [parsedDoc]);

  const isSmartMatch = (query: string, instructorName: string) => {
    const q = query.toLowerCase().trim().replace(/\./g, '');
    const target = instructorName.toLowerCase().trim().replace(/\./g, '');

    if (target.includes(q) || q.includes(target)) {
      const qParts = q.split(/\s+/).filter(p => p.length > 2);
      const targetParts = target.split(/\s+/).filter(p => p.length > 2);

      if (qParts.length > 1) {
        const extraInTarget = targetParts.filter(p => !qParts.includes(p));
        const extraInQuery = qParts.filter(p => !targetParts.includes(p));
        if (extraInTarget.length > 0 && extraInQuery.length > 0) return false;
      }
      return true;
    }
    return false;
  };

  const filteredBlocks = useMemo(() => {
    if (!parsedDoc) return [];

    let blocks = parsedDoc.pages.flatMap(p => p.blocks).map(b => ({
      ...b,
      instructor: nameMap.get(b.instructor) || b.instructor
    }));

    // 1. Filter by Department first (Strict)
    if (selectedDept !== 'all') {
      blocks = blocks.filter(b => b.instructorDept === selectedDept);
    }

    // 2. Filter by Search Query
    if (!searchQuery.trim()) return blocks;

    const lowerQuery = searchQuery.toLowerCase();
    return blocks.filter(block =>
      isSmartMatch(searchQuery, block.instructor) ||
      block.course.toLowerCase().includes(lowerQuery)
    );
  }, [parsedDoc, searchQuery, selectedDept, nameMap]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                <Calendar className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  Timetable Finder
                </h1>
                <p className="text-slate-500 font-medium">
                  Upload → Search by Teacher → Download
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div
                className={clsx(
                  "flex items-center gap-2 transition-colors duration-300",
                  currentStep === 1 ? "text-blue-600 font-bold" : "text-slate-400"
                )}
                onClick={() => setCurrentStep(1)}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold border",
                  currentStep === 1 ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" : "bg-white text-slate-400 border-slate-200"
                )}>1</div>
                Upload PDF
              </div>
              <div className="w-4 h-px bg-slate-200 hidden sm:block"></div>
              <div
                className={clsx(
                  "flex items-center gap-2 transition-colors duration-300",
                  currentStep === 2 ? "text-blue-600 font-bold" : "text-slate-400",
                  !parsedDoc && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => parsedDoc && setCurrentStep(2)}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold border",
                  currentStep === 2 ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" : "bg-white text-slate-400 border-slate-200"
                )}>2</div>
                Search
              </div>
              <div className="w-4 h-px bg-slate-200 hidden sm:block"></div>
              <div
                className={clsx(
                  "flex items-center gap-2 transition-colors duration-300",
                  currentStep === 3 ? "text-blue-600 font-bold" : "text-slate-400",
                  !searchQuery && "opacity-50 cursor-not-allowed"
                )}
                onClick={() => searchQuery && setCurrentStep(3)}
              >
                <div className={clsx(
                  "w-8 h-8 rounded-lg flex items-center justify-center font-bold border",
                  currentStep === 3 ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200" : "bg-white text-slate-400 border-slate-200"
                )}>3</div>
                Download
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {currentStep === 1 && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-6 text-slate-500 uppercase tracking-widest text-xs font-bold">
              <Info className="w-4 h-4" />
              Step 1: Provide your timetable
            </div>
            <UploadBox
              onFileSelect={handleFileSelect}
              isProcessing={isParsing}
              progress={progress}
              onClear={handleClear}
              selectedFile={file}
            />

            {error && !parsedDoc && (
              <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-2 font-bold text-amber-900">
                  <AlertCircle className="w-5 h-5 font-bold" />
                  Parsing Issue
                </div>
                <p className="text-sm">{error}</p>
                <div className="mt-4">
                  <button
                    onClick={runOcr}
                    disabled={isOcrLoading}
                    className="text-xs px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isOcrLoading ? "Running OCR..." : "Try OCR Instead"}
                  </button>
                </div>
              </div>
            )}

            {!parsedDoc && !isParsing && !error && (
              <div className="mt-10 text-center space-y-4 max-w-md mx-auto">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-800 mb-2">No PDF Uploaded</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Upload a student or teacher timetable PDF to get started. The app will automatically detect courses, rooms, and schedules.
                  </p>
                </div>
                <p className="text-xs text-slate-400">
                  Your data never leaves your browser. All parsing is done locally.
                </p>
              </div>
            )}
          </section>
        )}

        {currentStep === 2 && (file || parsedDoc || isParsing || isOcrLoading || error) && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-6 text-slate-500 uppercase tracking-widest text-xs font-bold">
              <Search className="w-4 h-4" />
              Step 2: Filter by Instructor
            </div>
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-grow">
                <SearchBar
                  onSearch={(q) => {
                    setSearchQuery(q);
                  }}
                  onClear={() => setSearchQuery('')}
                  suggestions={allInstructors}
                  onSelectInstructor={(name) => {
                    setSearchQuery(name);
                    // Auto-select department if found
                    const instructorBlock = parsedDoc?.pages.flatMap(p => p.blocks).find(b => b.instructor === name && b.instructorDept);
                    if (instructorBlock?.instructorDept) {
                      setSelectedDept(instructorBlock.instructorDept);
                    }
                    setCurrentStep(3);
                  }}
                  disabled={isParsing}
                />
              </div>
              <div className="w-full md:w-60">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Info className="h-5 w-5 text-slate-400" />
                  </div>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="block w-full pl-11 pr-10 py-4 bg-white border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm appearance-none transition-all cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    {allDepts.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <AlertCircle className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-2 text-center text-xs text-slate-400 mb-8">
              Tip: Select a department to avoid name confusion (e.g., CS vs Mth).
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setCurrentStep(3)}
                disabled={!searchQuery}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Continue to Download
                <Download className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-10 text-center mt-8">
                {/* ... existing error/OCR UI ... */}
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-amber-100 rounded-full text-amber-600">
                    <Info className="w-8 h-8" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-amber-900 mb-2 text-center">{error}</h3>
                <p className="text-amber-700/80 mb-8 max-w-md mx-auto text-center">
                  This PDF might be image-based or have a complex layout. You can try running OCR to extract the text.
                </p>
                {isOcrLoading && (
                  <div className="w-full max-w-xs mx-auto mb-6">
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-amber-600 font-bold mt-2">{progress}% OCR completed</p>
                  </div>
                )}
                <button
                  onClick={runOcr}
                  disabled={isOcrLoading}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-amber-600 text-white rounded-2xl hover:bg-amber-700 transition-all shadow-md focus:ring-4 focus:ring-amber-200 disabled:opacity-50"
                >
                  {isOcrLoading ? "Running OCR..." : "Run OCR Extraction"}
                </button>
              </div>
            )}
          </section>
        )}

        {currentStep === 3 && (parsedDoc || isParsing || isOcrLoading) && (
          <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 mb-6 text-slate-500 uppercase tracking-widest text-xs font-bold">
              <Download className="w-4 h-4" />
              Step 3: View & Download
            </div>

            {isParsing || isOcrLoading ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-20 text-center shadow-sm">
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Processing Results</h3>
                <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                  We are organizing the class schedules for you. This will only take a moment.
                </p>
              </div>
            ) : parsedDoc && filteredBlocks.length === 0 && searchQuery ? (
              <div className="bg-slate-100 border border-slate-200 rounded-2xl p-12 text-center">
                <p className="text-slate-600 text-lg font-medium">
                  No classes found for "<span className="text-slate-900 font-bold">{searchQuery}</span>"
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Go back to search
                  </button>
                </div>
              </div>
            ) : parsedDoc ? (
              <Timetable
                blocks={filteredBlocks}
                query={searchQuery}
                pdfName={parsedDoc.fileName}
                timeSlotLabels={parsedDoc.pages[0]?.timeSlotLabels}
              />
            ) : null}
          </section>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-10 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 text-sm">
            Made with <span className="font-bold text-slate-900">Next.js 14</span> · Fully Client-Side · No Sign-in Required
          </p>
        </div>
      </footer>
    </main>
  );
}
