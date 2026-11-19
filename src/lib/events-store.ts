// ==================== EVENTS STORE (localStorage-based) ====================
// Swap fetchXxx functions to real API calls when backend routes are ready.

export type EventAudience = 'Students' | 'Staff' | 'Both Students And Staff';
export type PaymentStatus = 'Pending' | 'Approved' | 'Rejected';

// ─── Workshop ────────────────────────────────────────────────────────────────
export interface Workshop {
  id: string;
  name: string;
  resourcePerson: string;
  department: string;
  venue: string;
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  timings: string;
  numberOfDays: number;
  amount: number;
  qrCodeUrl: string;
  brochureUrl: string;   // NEW: brochure / poster image
  upiId?: string;        // NEW: per-event UPI ID
  description: string;
  lastDateRegistration: string;
  maxParticipants: number;
  audience: EventAudience;
  isActive: boolean;
  createdAt: string;
}

export interface WorkshopRegistration {
  id: string;
  workshopId: string;
  workshopName: string;
  registrantType: 'student' | 'staff';
  // Student fields
  name: string;
  rollNumber?: string;
  hallTicket?: string;      // legacy compat
  year?: string;
  semester?: string;
  // Staff fields
  employeeId?: string;
  designation?: string;
  // Common
  department: string;
  mobile: string;
  email: string;
  paymentStatus: PaymentStatus;
  paymentScreenshot: string;  // base64 or URL
  paymentMethod?: string;     // PhonePe | GPay | Paytm | Razorpay
  registrationDate: string;
}

// ─── FDP ─────────────────────────────────────────────────────────────────────
export interface FDP {
  id: string;
  name: string;
  resourcePerson: string;
  department: string;
  venue: string;
  startDate: string;     // YYYY-MM-DD
  endDate: string;       // YYYY-MM-DD
  timings: string;
  numberOfDays: number;
  amount: number;
  qrCodeUrl: string;
  brochureUrl: string;   // NEW: brochure / poster image
  upiId?: string;        // NEW: per-event UPI ID
  description: string;
  lastDateRegistration: string;
  maxParticipants: number;
  audience: EventAudience;
  isActive: boolean;
  createdAt: string;
}

export interface FDPRegistration {
  id: string;
  fdpId: string;
  fdpName: string;
  registrantType: 'student' | 'staff';
  name: string;
  employeeId?: string;
  rollNumber?: string;
  year?: string;
  semester?: string;
  department: string;
  mobile: string;
  email: string;
  paymentStatus: PaymentStatus;
  paymentScreenshot: string;
  paymentMethod?: string;
  registrationDate: string;
  designation?: string;
}

// ─── Keys ────────────────────────────────────────────────────────────────────
const KEYS = {
  workshops: 'hari_workshops',
  workshopRegs: 'hari_workshop_registrations',
  fdps: 'hari_fdps',
  fdpRegs: 'hari_fdp_registrations',
};

function read<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function write<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}
function uid() { return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ─── Workshop Store ───────────────────────────────────────────────────────────
export const workshopStore = {
  getAll: (): Workshop[] => read<Workshop>(KEYS.workshops),

  getById: (id: string): Workshop | undefined =>
    read<Workshop>(KEYS.workshops).find(w => w.id === id),

  add: (data: Omit<Workshop, 'id' | 'createdAt'>): Workshop => {
    const w: Workshop = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const all = read<Workshop>(KEYS.workshops);
    write(KEYS.workshops, [...all, w]);
    return w;
  },

  update: (id: string, data: Partial<Workshop>): Workshop | null => {
    const all = read<Workshop>(KEYS.workshops);
    const idx = all.findIndex(w => w.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data };
    write(KEYS.workshops, all);
    return all[idx];
  },

  delete: (id: string) => {
    write(KEYS.workshops, read<Workshop>(KEYS.workshops).filter(w => w.id !== id));
    // also delete registrations
    write(KEYS.workshopRegs,
      read<WorkshopRegistration>(KEYS.workshopRegs).filter(r => r.workshopId !== id));
  },

  toggle: (id: string, isActive: boolean) =>
    workshopStore.update(id, { isActive }),

  getActive: (): Workshop[] =>
    read<Workshop>(KEYS.workshops).filter(w => w.isActive),
};

// ─── Workshop Registration Store ─────────────────────────────────────────────
export const workshopRegStore = {
  getAll: (): WorkshopRegistration[] => read<WorkshopRegistration>(KEYS.workshopRegs),

  getByWorkshop: (workshopId: string): WorkshopRegistration[] =>
    read<WorkshopRegistration>(KEYS.workshopRegs).filter(r => r.workshopId === workshopId),

  add: (data: Omit<WorkshopRegistration, 'id' | 'registrationDate'>): WorkshopRegistration => {
    const r: WorkshopRegistration = {
      ...data,
      id: uid(),
      registrationDate: new Date().toISOString(),
      paymentStatus: data.paymentStatus ?? 'Pending',
    };
    const all = read<WorkshopRegistration>(KEYS.workshopRegs);
    write(KEYS.workshopRegs, [...all, r]);
    return r;
  },

  updateStatus: (id: string, paymentStatus: PaymentStatus) => {
    const all = read<WorkshopRegistration>(KEYS.workshopRegs);
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) { all[idx].paymentStatus = paymentStatus; write(KEYS.workshopRegs, all); }
  },

  delete: (id: string) => {
    write(KEYS.workshopRegs, read<WorkshopRegistration>(KEYS.workshopRegs).filter(r => r.id !== id));
  },
};

// ─── FDP Store ────────────────────────────────────────────────────────────────
export const fdpStore = {
  getAll: (): FDP[] => read<FDP>(KEYS.fdps),

  getById: (id: string): FDP | undefined =>
    read<FDP>(KEYS.fdps).find(f => f.id === id),

  add: (data: Omit<FDP, 'id' | 'createdAt'>): FDP => {
    const f: FDP = { ...data, id: uid(), createdAt: new Date().toISOString() };
    const all = read<FDP>(KEYS.fdps);
    write(KEYS.fdps, [...all, f]);
    return f;
  },

  update: (id: string, data: Partial<FDP>): FDP | null => {
    const all = read<FDP>(KEYS.fdps);
    const idx = all.findIndex(f => f.id === id);
    if (idx === -1) return null;
    all[idx] = { ...all[idx], ...data };
    write(KEYS.fdps, all);
    return all[idx];
  },

  delete: (id: string) => {
    write(KEYS.fdps, read<FDP>(KEYS.fdps).filter(f => f.id !== id));
    write(KEYS.fdpRegs,
      read<FDPRegistration>(KEYS.fdpRegs).filter(r => r.fdpId !== id));
  },

  toggle: (id: string, isActive: boolean) => fdpStore.update(id, { isActive }),

  getActive: (): FDP[] => read<FDP>(KEYS.fdps).filter(f => f.isActive),
};

// ─── FDP Registration Store ───────────────────────────────────────────────────
export const fdpRegStore = {
  getAll: (): FDPRegistration[] => read<FDPRegistration>(KEYS.fdpRegs),

  getByFDP: (fdpId: string): FDPRegistration[] =>
    read<FDPRegistration>(KEYS.fdpRegs).filter(r => r.fdpId === fdpId),

  add: (data: Omit<FDPRegistration, 'id' | 'registrationDate'>): FDPRegistration => {
    const r: FDPRegistration = {
      ...data,
      id: uid(),
      registrationDate: new Date().toISOString(),
      paymentStatus: data.paymentStatus ?? 'Pending',
    };
    const all = read<FDPRegistration>(KEYS.fdpRegs);
    write(KEYS.fdpRegs, [...all, r]);
    return r;
  },

  updateStatus: (id: string, paymentStatus: PaymentStatus) => {
    const all = read<FDPRegistration>(KEYS.fdpRegs);
    const idx = all.findIndex(r => r.id === id);
    if (idx !== -1) { all[idx].paymentStatus = paymentStatus; write(KEYS.fdpRegs, all); }
  },

  delete: (id: string) => {
    write(KEYS.fdpRegs, read<FDPRegistration>(KEYS.fdpRegs).filter(r => r.id !== id));
  },
};

// ─── Export Helpers ───────────────────────────────────────────────────────────
export function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows].map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
) {
  // Dynamic import to keep bundle light
  Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]).then(([{ default: jsPDF }]) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(title, 14, 16);
    (doc as any).autoTable({
      head: [headers],
      body: rows,
      startY: 24,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
    });
    doc.save(filename);
  });
}
