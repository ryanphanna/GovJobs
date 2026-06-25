import type { ParsedJob } from './ai_parser';

function coerceString(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v == null) return '';
  return String(v).trim();
}

function coerceNumber(v: unknown): number | null {
  if (v == null || v === '' || v === 'null' || v === 'N/A') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[$,\s]/g, ''));
    return isNaN(n) ? null : n;
  }
  return null;
}

function coerceBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  return false;
}

function normalizeSalaryPeriod(v: unknown): 'yearly' | 'hourly' | 'monthly' {
  const s = coerceString(v).toLowerCase();
  if (s.includes('hour') || s === 'hr') return 'hourly';
  if (s.includes('month')) return 'monthly';
  return 'yearly';
}

function normalizeWorkModel(v: unknown): 'Hybrid' | 'Remote' | 'On-site' {
  const s = coerceString(v).toLowerCase().replace(/[\s_-]/g, '');
  if (s.includes('hybrid')) return 'Hybrid';
  if (s.includes('remote')) return 'Remote';
  return 'On-site';
}

function normalizeEmploymentType(v: unknown): 'Full-time' | 'Part-time' | 'Contract' | 'Permanent' {
  const s = coerceString(v).toLowerCase().replace(/[\s_-]/g, '');
  if (s.includes('part')) return 'Part-time';
  if (s.includes('contract') || s.includes('temp') || s.includes('casual')) return 'Contract';
  if (s.includes('permanent')) return 'Permanent';
  return 'Full-time';
}

function normalizeClosingDate(v: unknown): string | null {
  if (v == null || v === 'null' || v === 'N/A' || v === '') return null;
  const s = coerceString(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function normalizeBenefits(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(coerceString).filter(Boolean);
  if (typeof v === 'string' && v) return v.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return [];
}

export function validateParsedJob(obj: unknown): ParsedJob | null {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;

  const job_title = coerceString(o['job_title']);
  if (!job_title) return null;

  return {
    job_title,
    department: coerceString(o['department']),
    location: coerceString(o['location']),
    salary_min: coerceNumber(o['salary_min']),
    salary_max: coerceNumber(o['salary_max']),
    salary_period: normalizeSalaryPeriod(o['salary_period']),
    closing_date: normalizeClosingDate(o['closing_date']),
    work_model: normalizeWorkModel(o['work_model']),
    employment_type: normalizeEmploymentType(o['employment_type']),
    duration: coerceString(o['duration']),
    is_unionized: coerceBool(o['is_unionized']),
    union_name: coerceString(o['union_name']),
    is_student: coerceBool(o['is_student']),
    is_inventory: coerceBool(o['is_inventory']),
    benefits: normalizeBenefits(o['benefits']),
    clean_description: coerceString(o['clean_description']),
  };
}
