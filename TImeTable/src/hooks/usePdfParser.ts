'use client';

import { useState, useCallback, useEffect } from 'react';
import { createWorker, createScheduler } from 'tesseract.js';
import { ParsedDocument, ParsedPage, ClassBlock, Day } from '../lib/pdf/types';
import { clusterTextItems, TextItem } from '../lib/pdf/cluster';
import { detectGrid, findCell } from '../lib/pdf/grid';

// We'll load pdfjs dynamically to avoid SSR issues
let pdfjsPromise: Promise<any> | null = null;

const getPdfJs = async () => {
    if (typeof window === 'undefined') return null;

    if (!pdfjsPromise) {
        pdfjsPromise = import('pdfjs-dist').then(async (m) => {
            const pdfjs = m.default || m;
            // In v4, we can use the same pattern, but ensure path consistency
            // Using unpkg for v4.4.168 specifically
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;
            return pdfjs;
        });
    }
    return pdfjsPromise;
};

export function usePdfParser() {
    const [isParsing, setIsParsing] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [parsedDoc, setParsedDoc] = useState<ParsedDocument | null>(null);
    const [lastFile, setLastFile] = useState<File | null>(null);

    const parsePdf = useCallback(async (file: File) => {
        setIsParsing(true);
        setProgress(0);
        setError(null);
        setLastFile(file);

        try {
            const pdfjs = await getPdfJs();
            if (!pdfjs) throw new Error("PDF.js failed to load");

            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            const pages: ParsedPage[] = [];

            for (let i = 1; i <= pdf.numPages; i++) {
                setProgress(Math.round(((i - 1) / pdf.numPages) * 100));
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const viewport = page.getViewport({ scale: 1.0 });

                const items: TextItem[] = textContent.items.map((item: any) => ({
                    str: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    w: item.width,
                    h: item.height,
                }));

                const blocks = clusterTextItems(items);
                const bounds = detectGrid(blocks, viewport.width, viewport.height);

                // Try to find section code from page content (e.g., in title or footer)
                const sectionRegex = /[A-Z]{2,}-\s*[A-Z]{2}\d{2}\s*-\s*[0-9A-Z]+/i;
                const sectionItem = blocks.find(b => sectionRegex.test(b.text));
                const sectionCode = sectionItem ? sectionItem.text.match(sectionRegex)?.[0] : undefined;

                const classBlocks: ClassBlock[] = [];

                // Global Instructor Detection (Teacher Timetable)
                const instructorHeaderRegex = /Teacher\s+([^\n\r]+)/i;
                const instructorHeader = blocks.find(b => instructorHeaderRegex.test(b.text));
                const pageInstructorRaw = instructorHeader ? instructorHeader.text.match(instructorHeaderRegex)?.[1].trim() : undefined;

                const headerDeptMatch = pageInstructorRaw?.match(/^(.*?)\s*\(([^)]+)\)/);
                const pageInstructor = headerDeptMatch ? headerDeptMatch[1].trim() : pageInstructorRaw;
                const pageInstructorDept = headerDeptMatch ? headerDeptMatch[2].trim() : undefined;

                for (const block of blocks) {
                    const lines = block.text.split(/[\n\r]+/).map(l => l.trim()).filter(Boolean);
                    const roomRegex = /^\s*(CS|SE|MS|R|EE|SS|DLD|ES|BTY|FYP|Lab|General Purpose|Auditorium)(\s*LAB-?\d*|\s*-?\d+|\s*Lab)?\s*$/i;
                    const deptPattern = /\((CS|SE|MS|EE|SS|HU|MATH|PHY|CHM|MGT|BIO|AF|SE\d+|Old CS)\)/i;
                    const roomLine = lines.find(l => l.length < 15 && roomRegex.test(l) && !deptPattern.test(l));
                    const hasRoom = !!roomLine;

                    const deptMatchLine = lines.find(l => deptPattern.test(l));
                    const deptMatch = deptMatchLine?.match(/^(.*?)\s*\(([^)]+)\)/);

                    const blockSectionRegex = /(([A-Z]{2,}-\s*[A-Z]{2,}\d{2}\s*-\s*[0-9A-Z]+))/i;

                    if (deptMatchLine || hasRoom || (pageInstructor && block.text.length > 5 && !/Monday|Tuesday|Wednesday|Thursday|Friday|TIME|Slot|Break/i.test(block.text))) {
                        const cell = findCell(block.x, block.y + block.h / 2, block.w, bounds);
                        if (cell) {
                            const instructor = (deptMatch && deptMatch[1].trim()) ? deptMatch[1].trim() : (pageInstructor || 'Unknown');
                            const instructorDept = (deptMatch && deptMatch[2].trim()) ? deptMatch[2].trim() : pageInstructorDept;

                            // Course preference: longest line that isn't a room, section, or dept-matching line
                            const courseCandidate = lines.filter(l =>
                                !deptPattern.test(l) &&
                                !roomRegex.test(l) &&
                                !blockSectionRegex.test(l) &&
                                l.length > 3
                            ).sort((a, b) => b.length - a.length)[0] || lines[0] || 'Unknown Course';

                            const room = roomLine || 'TBD';
                            const blockSection = lines.find(l => blockSectionRegex.test(l)) || sectionCode;

                            for (const slotIdx of cell.slotIndices) {
                                classBlocks.push({
                                    page: i,
                                    day: cell.day,
                                    slotIndex: slotIdx,
                                    course: courseCandidate,
                                    instructor,
                                    instructorDept,
                                    room,
                                    section: blockSection,
                                    isLab: block.text.toLowerCase().includes('lab'),
                                    x: block.x,
                                    y: block.y,
                                    w: block.w,
                                    h: block.h,
                                });
                            }
                        }
                    }
                }

                pages.push({
                    page: i,
                    bounds,
                    blocks: classBlocks,
                    sectionCode,
                    instructorName: pageInstructor,
                    timeSlotLabels: bounds.slots.map(s => s.label)
                });
            }

            const doc: ParsedDocument = {
                fileName: file.name,
                pages,
            };

            setParsedDoc(doc);
            setProgress(100);
            if (pages.every(p => p.blocks.length === 0)) {
                setError("No class data found. This PDF might be image-based or has an unsupported layout.");
            }
        } catch (err: any) {
            setError(err.message || "Failed to parse PDF");
        } finally {
            setIsParsing(false);
        }
    }, []);

    const runOcr = useCallback(async () => {
        if (!lastFile) return;
        setIsOcrLoading(true);
        setProgress(0);
        setError(null);
        setParsedDoc(null); // Clear previous parsed doc

        try {
            console.log("Starting Optimized Parallel OCR process...");
            const pdfjs = await getPdfJs();
            if (!pdfjs) throw new Error("PDF.js failed to load");

            const arrayBuffer = await lastFile.arrayBuffer();
            const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
            const pdf = await loadingTask.promise;

            console.log(`PDF loaded. Parallel processing ${pdf.numPages} pages...`);

            // 1. Initialize Scheduler and Workers
            const scheduler = createScheduler();
            const concurrency = typeof window !== 'undefined' ? (window.navigator.hardwareConcurrency || 2) : 2;
            const workerCount = Math.min(concurrency, 3); // Max 3 workers

            for (let i = 0; i < workerCount; i++) {
                const worker = await createWorker('eng');
                scheduler.addWorker(worker);
            }

            // 2. Process Pages in Parallel
            const processPage = async (pageIndex: number) => {
                const page = await pdf.getPage(pageIndex);
                const scale = 1.5; // Optimized scale
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({ canvasContext: context!, viewport, canvas: canvas }).promise;

                // Recognize using scheduler
                const { data: { blocks: ocrBlocks } } = await scheduler.addJob('recognize', canvas);

                const textBlocks = ocrBlocks?.map((b: any) => ({
                    text: b.text,
                    x: b.bbox.x0 / scale,
                    y: (viewport.height - b.bbox.y1) / scale,
                    w: (b.bbox.x1 - b.bbox.x0) / scale,
                    h: (b.bbox.y1 - b.bbox.y0) / scale,
                    items: []
                })) || [];

                const bounds = detectGrid(textBlocks as any, viewport.width / scale, viewport.height / scale);
                const sectionRegex = /[A-Z]{2,}-\s*[A-Z]{2}\d{2}\s*-\s*[0-9A-Z]+/i;
                const sectionItem = textBlocks.find((b: any) => sectionRegex.test(b.text));
                const sectionCode = sectionItem ? sectionItem.text.match(sectionRegex)?.[0] : undefined;

                // Global Instructor Detection (Teacher Timetable)
                const instructorHeaderRegex = /Teacher\s+([^\n\r]+)/i;
                const instructorHeader = textBlocks.find((b: any) => instructorHeaderRegex.test(b.text));
                const pageInstructorRaw = instructorHeader ? instructorHeader.text.match(instructorHeaderRegex)?.[1].trim() : undefined;

                const headerDeptMatch = pageInstructorRaw?.match(/^(.*?)\s*\(([^)]+)\)/);
                const pageInstructor = headerDeptMatch ? headerDeptMatch[1].trim() : pageInstructorRaw;
                const pageInstructorDept = headerDeptMatch ? headerDeptMatch[2].trim() : undefined;

                const classBlocks: ClassBlock[] = [];
                for (const block of textBlocks) {
                    const roomRegex = /^\s*(CS|SE|MS|R|EE|SS|DLD|ES|BTY|FYP|Lab|General Purpose|Auditorium)(\s*LAB-?\d*|\s*-?\d+|\s*Lab)?\s*$/i;
                    const lines = block.text.split(/[\n\r]+/).map((l: string) => l.trim()).filter(Boolean);
                    const deptPattern = /\((CS|SE|MS|EE|SS|HU|MATH|PHY|CHM|MGT|BIO|AF|SE\d+|Old CS)\)/i;
                    const roomLine = lines.find((l: string) => l.length < 15 && roomRegex.test(l) && !deptPattern.test(l));
                    const hasRoom = !!roomLine;

                    const deptMatchLine = lines.find((l: string) => deptPattern.test(l));
                    const deptMatch = deptMatchLine?.match(/^(.*?)\s*\(([^)]+)\)/);

                    const blockSectionRegex = /(([A-Z]{2,}-\s*[A-Z]{2,}\d{2}\s*-\s*[0-9A-Z]+))/i;

                    if (deptMatchLine || hasRoom || (pageInstructor && block.text.length > 5 && !/Monday|Tuesday|Wednesday|Thursday|Friday|TIME|Slot|Break/i.test(block.text))) {
                        const cell = findCell(block.x, block.y + block.h / 2, block.w, bounds);
                        if (cell) {
                            const instructor = (deptMatch && deptMatch[1].trim()) ? deptMatch[1].trim() : (pageInstructor || 'Unknown');
                            const instructorDept = (deptMatch && deptMatch[2].trim()) ? deptMatch[2].trim() : pageInstructorDept;

                            // Course preference: longest line that isn't a room, section, or dept-matching line
                            const courseCandidate = lines.filter((l: string) =>
                                !deptPattern.test(l) &&
                                !roomRegex.test(l) &&
                                !blockSectionRegex.test(l) &&
                                l.length > 3
                            ).sort((a: string, b: string) => b.length - a.length)[0] || lines[0] || 'Unknown Course';

                            const room = roomLine || 'TBD';
                            const blockSection = lines.find((l: string) => blockSectionRegex.test(l)) || sectionCode;

                            for (const slotIdx of cell.slotIndices) {
                                classBlocks.push({
                                    page: pageIndex,
                                    day: cell.day,
                                    slotIndex: slotIdx,
                                    course: courseCandidate,
                                    instructor,
                                    instructorDept,
                                    room,
                                    section: blockSection,
                                    isLab: block.text.toLowerCase().includes('lab'),
                                    x: block.x,
                                    y: block.y,
                                    w: block.w,
                                    h: block.h,
                                });
                            }
                        }
                    }
                }

                return {
                    page: pageIndex,
                    bounds,
                    blocks: classBlocks,
                    sectionCode,
                    instructorName: pageInstructor,
                    timeSlotLabels: bounds.slots.map(s => s.label)
                };
            };

            const pagePromises = Array.from({ length: pdf.numPages }, (_, i) => processPage(i + 1));

            // Progress tracking for parallel tasks
            let completedPages = 0;
            pagePromises.forEach(p => p.then(() => {
                completedPages++;
                setProgress(Math.round((completedPages / pdf.numPages) * 100));
            }));

            const pageResults = await Promise.all(pagePromises);

            // Sort results back to original page order
            const sortedPages = [...pageResults].sort((a, b) => a.page - b.page);

            const doc: ParsedDocument = {
                fileName: lastFile.name,
                pages: sortedPages as any,
            };

            setParsedDoc(doc);
            setProgress(100);

            if (sortedPages.every(p => p.blocks.length === 0)) {
                setError("OCR completed, but no class data found. The layout might be unsupported.");
            } else {
                setError("OCR completed successfully (Parallel Mode).");
            }

            await scheduler.terminate();
        } catch (err: any) {
            setError("OCR failed: " + (err.message || "Unknown error"));
        } finally {
            setIsOcrLoading(false);
        }
    }, [lastFile]);

    const clear = () => {
        setParsedDoc(null);
        setProgress(0);
        setError(null);
        setLastFile(null);
    };

    return { parsePdf, runOcr, isParsing, isOcrLoading, progress, error, parsedDoc, clear };
}
