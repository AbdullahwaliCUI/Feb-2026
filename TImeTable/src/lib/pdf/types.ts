export type Day = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export interface TimeSlot {
  index: number;
  label: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

export interface GridBounds {
  days: Record<Day, { xMin?: number; xMax?: number; yMin?: number; yMax?: number }>;
  slots: TimeSlot[];
}

export interface ClassBlock {
  page: number;
  day: Day;
  slotIndex: number;
  course: string;
  instructor: string;
  instructorDept?: string;
  room?: string;
  section?: string;
  isLab?: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParsedPage {
  page: number;
  bounds: GridBounds;
  blocks: ClassBlock[];
  sectionCode?: string; // e.g., "BCS-FA24-4B"
  instructorName?: string; // For Teacher Timetables (e.g., "Junaid Iqbal")
  timeSlotLabels?: string[]; // Dynamic labels (e.g., ["8:30-10:00", ...])
}

export interface ParsedDocument {
  fileName: string;
  pages: ParsedPage[];
  meta?: Record<string, any>;
}
