import { Day, GridBounds, TimeSlot } from './types';
import { TextBlock } from './cluster';

const DAYS: Day[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export function detectGrid(blocks: TextBlock[], pageWidth: number, pageHeight: number): GridBounds {
    const dayBounds: Record<Day, { yMin: number; yMax: number }> = {} as any;
    const timeSlots: TimeSlot[] = [];

    // 1. Identify Day Rows (Left side)
    const dayPatterns: { day: Day, regex: RegExp }[] = [
        { day: 'Monday', regex: /M[on]*day|Mon/i },
        { day: 'Tuesday', regex: /T[ue]*day|Tue/i },
        { day: 'Wednesday', regex: /W[ed]*nesday|Wed/i },
        { day: 'Thursday', regex: /T[hu]*rsday|Thu/i },
        { day: 'Friday', regex: /F[ri]*day|Fri/i }
    ];

    blocks.forEach(b => {
        const text = b.text.trim();
        for (const pattern of dayPatterns) {
            if (pattern.regex.test(text) && b.x < pageWidth / 4) {
                if (!dayBounds[pattern.day]) {
                    dayBounds[pattern.day] = {
                        yMin: b.y - 15,
                        yMax: b.y + b.h + 15
                    };
                }
                break;
            }
        }
    });

    // 2. Identify Time Slots (Horizontal top)
    const slotCandidates = blocks.filter(b =>
        (b.text.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/) || /Break/i.test(b.text) || /^[1-6]$/.test(b.text.trim())) &&
        b.y < pageHeight / 3
    ).sort((a, b) => a.x - b.x);

    // Filter overlapping or redundant slot detections
    const uniqueSlots: TextBlock[] = [];
    slotCandidates.forEach(cand => {
        if (!uniqueSlots.some(s => Math.abs(s.x - cand.x) < 30)) {
            uniqueSlots.push(cand);
        }
    });

    uniqueSlots.forEach((slot, idx) => {
        timeSlots.push({
            index: idx + 1,
            label: slot.text.trim().replace(/\n/g, ' '),
            xMin: slot.x - 15,
            xMax: slot.x + slot.w + 15
        });
    });

    // Fallback if no slots detected (safety)
    // COMSATS usually has 6 core slots + 1 break = 7 columns
    if (timeSlots.length < 4) {
        timeSlots.length = 0; // Clear partial detections
        const colWidth = (pageWidth * 0.85) / 7;
        const xStart = pageWidth * 0.12;
        const labels = ["Slot 1", "Slot 2", "Slot 3", "Break", "Slot 4", "Slot 5", "Slot 6"];
        labels.forEach((lbl, i) => {
            timeSlots.push({
                index: i + 1,
                label: lbl,
                xMin: xStart + i * colWidth,
                xMax: xStart + (i + 1) * colWidth
            });
        });
    }

    // Final Fallback if still no grid detected
    if (Object.keys(dayBounds).length < 2 || timeSlots.length < 2) {
        return createFallbackGrid(pageWidth, pageHeight);
    }

    return { days: dayBounds, slots: timeSlots };
}

function createFallbackGrid(pageWidth: number, pageHeight: number): GridBounds {
    const dayBounds: Record<Day, { yMin: number; yMax: number }> = {} as any;
    const rowHeight = pageHeight / 8;
    const colWidth = pageWidth / 7;
    const margin = 50;

    DAYS.forEach((day, i) => {
        dayBounds[day] = {
            yMin: margin + (i + 1) * rowHeight,
            yMax: margin + (i + 2) * rowHeight,
        };
    });

    const slots: TimeSlot[] = [];
    for (let i = 0; i < 6; i++) {
        slots.push({
            index: i + 1,
            label: `Slot ${i + 1}`,
            xMin: colWidth + i * colWidth,
            xMax: colWidth + (i + 1) * colWidth,
        });
    }

    return { days: dayBounds as any, slots: slots };
}

export function findCell(x: number, y: number, w: number, bounds: GridBounds): { day: Day; slotIndices: number[] } | null {
    let matchedDay: Day | null = null;
    for (const day of DAYS) {
        const b = bounds.days[day];
        if (b && b.yMin !== undefined && b.yMax !== undefined) {
            // Check if center Y is within day bounds
            if (y >= Math.min(b.yMin, b.yMax) && y <= Math.max(b.yMin, b.yMax)) {
                matchedDay = day;
                break;
            }
        }
    }

    const matchedSlots: number[] = [];
    const xStart = x;
    const xEnd = x + w;

    for (const slot of bounds.slots) {
        if (slot.xMin !== undefined && slot.xMax !== undefined) {
            const slotMin = Math.min(slot.xMin, slot.xMax);
            const slotMax = Math.max(slot.xMin, slot.xMax);

            // Check for overlap: block starts before slot ends AND block ends after slot starts
            // We use a small buffer (5px) to avoid accidental overlaps with neighbors
            if (xStart < slotMax - 5 && xEnd > slotMin + 5) {
                matchedSlots.push(slot.index);
            }
        }
    }

    if (matchedDay && matchedSlots.length > 0) {
        return { day: matchedDay, slotIndices: matchedSlots };
    }

    return null;
}
