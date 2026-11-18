import { useState, useEffect } from 'react';
import { lookupAPI } from '@/lib/itadmin-api';
import { getSubjectOptions, getSubjectOptionsForFilter } from '@/lib/subjects';

export interface LookupOption {
  label: string;
  value: string;
}

// Fallback data in case API is unavailable
const FALLBACK_DEPARTMENTS: LookupOption[] = [
  { label: 'CSE', value: 'CSE' },
  { label: 'CSE (AI & ML)', value: 'CSE(AI&ML)' },
  { label: 'CSE (Data Science)', value: 'CSE(DataScience)' },
  { label: 'IT', value: 'IT' },
  { label: 'ECE', value: 'ECE' },
  { label: 'EEE', value: 'EEE' },
  { label: 'ETM', value: 'ETM' },
];
const FALLBACK_SECTIONS: LookupOption[] = [
  { label: 'Section A', value: 'A' },
  { label: 'Section B', value: 'B' },
  { label: 'Section C', value: 'C' },
  { label: 'Section D', value: 'D' },
];
const FALLBACK_YEARS: LookupOption[] = [
  { label: '1st Year', value: '1st Year' },
  { label: '2nd Year', value: '2nd Year' },
  { label: '3rd Year', value: '3rd Year' },
  { label: '4th Year', value: '4th Year' },
];
const FALLBACK_SEMESTERS: LookupOption[] = [
  { label: 'I Sem', value: 'I Sem' },
  { label: 'II Sem', value: 'II Sem' },
];

function decodeDept(token: string | null): string | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload?.department || null;
  } catch {
    return null;
  }
}

const SUPER_DEPTS = ['CSMCSD', 'CS', 'ALL', 'ADMIN', 'SUPERADMIN', 'IT', 'MASTER'];
const isSuperDept = (d: string | null) =>
  !!d && SUPER_DEPTS.includes(d.replace(/[\s()._-]/g, '').toUpperCase());

export function useLookupData(ignoreAdminFilter: boolean = false) {
  const adminToken = ignoreAdminFilter ? null : localStorage.getItem('adminToken');
  const loggedInDept = decodeDept(adminToken);
  
  let initialDepts = FALLBACK_DEPARTMENTS;
  if (loggedInDept && !isSuperDept(loggedInDept)) {
    initialDepts = FALLBACK_DEPARTMENTS.filter(d => d.value === loggedInDept);
  }

  const [departments, setDepartments] = useState<LookupOption[]>(initialDepts);
  const [sections, setSections] = useState<LookupOption[]>(FALLBACK_SECTIONS);
  const [years, setYears] = useState<LookupOption[]>(FALLBACK_YEARS);
  const [semesters, setSemesters] = useState<LookupOption[]>(FALLBACK_SEMESTERS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [depts, secs, yrs, sems] = await Promise.all([
          lookupAPI.getDepartments(),
          lookupAPI.getSections(),
          lookupAPI.getYears(),
          lookupAPI.getSemesters(),
        ]);
        
        let filteredDepts = depts;
        if (loggedInDept && !isSuperDept(loggedInDept) && Array.isArray(depts)) {
          filteredDepts = depts.filter((d: any) => d.value === loggedInDept);
        }
        
        if (Array.isArray(filteredDepts) && filteredDepts.length > 0) setDepartments(filteredDepts);
        if (Array.isArray(secs) && secs.length > 0) setSections(secs);
        if (Array.isArray(yrs) && yrs.length > 0) setYears(yrs);
        if (Array.isArray(sems) && sems.length > 0) setSemesters(sems);
      } catch {
        // Keep fallback data
      }
      setLoaded(true);
    };
    fetchAll();
  }, [loggedInDept]);

  return { departments, sections, years, semesters, loaded };
}

export function useLookupSubjects(department?: string, year?: string, semester?: string) {
  const [subjects, setSubjects] = useState<LookupOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!department || !year || !semester) {
      setSubjects([]);
      return;
    }
    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const result = await lookupAPI.getSubjects(department, year, semester);
        if (Array.isArray(result) && result.length > 0) {
          setSubjects(result);
        } else {
          // Fallback to local subjects.ts data
          const local = getSubjectOptions(department, year, semester);
          setSubjects(local);
        }
      } catch {
        // Fallback to local subjects.ts data
        const local = getSubjectOptions(department, year, semester);
        setSubjects(local);
      }
      setLoading(false);
    };
    fetchSubjects();
  }, [department, year, semester]);

  return { subjects, loading };
}

export function useLookupSubjectsForFilter(department?: string, year?: string, semester?: string) {
  const [subjects, setSubjects] = useState<LookupOption[]>([]);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const result = await lookupAPI.getSubjects(department, year, semester);
        if (Array.isArray(result) && result.length > 0) {
          setSubjects(result);
        } else {
          // Fallback to local subjects.ts
          const local = getSubjectOptionsForFilter(department, year, semester);
          setSubjects(local);
        }
      } catch {
        const local = getSubjectOptionsForFilter(department, year, semester);
        setSubjects(local);
      }
    };
    fetchSubjects();
  }, [department, year, semester]);

  return subjects;
}
