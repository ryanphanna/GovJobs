import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateParsedJob } from '../validate';

const BASE = {
  job_title: 'Planner I',
  department: 'Planning',
  location: 'Toronto',
  salary_min: 80000,
  salary_max: 100000,
  salary_period: 'yearly',
  closing_date: '2026-08-01',
  work_model: 'Hybrid',
  employment_type: 'Full-time',
  duration: '',
  is_unionized: true,
  union_name: 'CUPE',
  is_student: false,
  is_inventory: false,
  benefits: ['pension', 'health', 'dental'],
  clean_description: 'Great role.',
};

describe('validateParsedJob', () => {
  it('passes a valid object through unchanged', () => {
    const result = validateParsedJob(BASE);
    assert.ok(result);
    assert.equal(result.job_title, 'Planner I');
    assert.equal(result.salary_min, 80000);
    assert.equal(result.salary_period, 'yearly');
    assert.equal(result.work_model, 'Hybrid');
    assert.equal(result.employment_type, 'Full-time');
    assert.equal(result.closing_date, '2026-08-01');
    assert.deepEqual(result.benefits, ['pension', 'health', 'dental']);
  });

  it('returns null for non-object input', () => {
    assert.equal(validateParsedJob(null), null);
    assert.equal(validateParsedJob(undefined), null);
    assert.equal(validateParsedJob('string'), null);
    assert.equal(validateParsedJob(42), null);
    assert.equal(validateParsedJob([]), null);
  });

  it('returns null when job_title is missing or empty', () => {
    assert.equal(validateParsedJob({ ...BASE, job_title: '' }), null);
    assert.equal(validateParsedJob({ ...BASE, job_title: null }), null);
    assert.equal(validateParsedJob({ ...BASE, job_title: undefined }), null);
  });

  describe('salary normalization', () => {
    it('coerces salary from currency strings', () => {
      const result = validateParsedJob({ ...BASE, salary_min: '$80,000', salary_max: '$100,000.00' });
      assert.equal(result?.salary_min, 80000);
      assert.equal(result?.salary_max, 100000);
    });

    it('coerces salary from number strings', () => {
      const result = validateParsedJob({ ...BASE, salary_min: '96566', salary_max: '132880' });
      assert.equal(result?.salary_min, 96566);
      assert.equal(result?.salary_max, 132880);
    });

    it('returns null salary for null-like values', () => {
      const result = validateParsedJob({ ...BASE, salary_min: null, salary_max: 'N/A' });
      assert.equal(result?.salary_min, null);
      assert.equal(result?.salary_max, null);
    });

    it('normalizes salary_period: "annual" → "yearly"', () => {
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'annual' })?.salary_period, 'yearly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'Yearly' })?.salary_period, 'yearly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'per year' })?.salary_period, 'yearly');
    });

    it('normalizes salary_period: hourly variants', () => {
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'hourly' })?.salary_period, 'hourly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'Hourly' })?.salary_period, 'hourly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'hr' })?.salary_period, 'hourly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'per hour' })?.salary_period, 'hourly');
    });

    it('normalizes salary_period: monthly variants', () => {
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'monthly' })?.salary_period, 'monthly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'Monthly' })?.salary_period, 'monthly');
      assert.equal(validateParsedJob({ ...BASE, salary_period: 'per month' })?.salary_period, 'monthly');
    });
  });

  describe('work_model normalization', () => {
    it('accepts exact values', () => {
      assert.equal(validateParsedJob({ ...BASE, work_model: 'Hybrid' })?.work_model, 'Hybrid');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'Remote' })?.work_model, 'Remote');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'On-site' })?.work_model, 'On-site');
    });

    it('normalizes casing and punctuation variants', () => {
      assert.equal(validateParsedJob({ ...BASE, work_model: 'hybrid' })?.work_model, 'Hybrid');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'REMOTE' })?.work_model, 'Remote');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'Onsite' })?.work_model, 'On-site');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'On Site' })?.work_model, 'On-site');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'In-person' })?.work_model, 'On-site');
      assert.equal(validateParsedJob({ ...BASE, work_model: 'In Office' })?.work_model, 'On-site');
    });

    it('defaults unknown values to On-site', () => {
      assert.equal(validateParsedJob({ ...BASE, work_model: 'unknown' })?.work_model, 'On-site');
      assert.equal(validateParsedJob({ ...BASE, work_model: null })?.work_model, 'On-site');
    });
  });

  describe('employment_type normalization', () => {
    it('accepts exact values', () => {
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Full-time' })?.employment_type, 'Full-time');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Part-time' })?.employment_type, 'Part-time');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Contract' })?.employment_type, 'Contract');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Permanent' })?.employment_type, 'Permanent');
    });

    it('normalizes common AI variants', () => {
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Full Time' })?.employment_type, 'Full-time');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'fulltime' })?.employment_type, 'Full-time');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Part Time' })?.employment_type, 'Part-time');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Temporary' })?.employment_type, 'Contract');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'temp' })?.employment_type, 'Contract');
      assert.equal(validateParsedJob({ ...BASE, employment_type: 'Casual' })?.employment_type, 'Contract');
    });
  });

  describe('closing_date normalization', () => {
    it('passes through valid ISO dates', () => {
      assert.equal(validateParsedJob({ ...BASE, closing_date: '2026-08-15' })?.closing_date, '2026-08-15');
    });

    it('returns null for null-like values', () => {
      assert.equal(validateParsedJob({ ...BASE, closing_date: null })?.closing_date, null);
      assert.equal(validateParsedJob({ ...BASE, closing_date: 'null' })?.closing_date, null);
      assert.equal(validateParsedJob({ ...BASE, closing_date: 'N/A' })?.closing_date, null);
      assert.equal(validateParsedJob({ ...BASE, closing_date: '' })?.closing_date, null);
    });

    it('parses human-readable dates', () => {
      const result = validateParsedJob({ ...BASE, closing_date: 'August 15, 2026' });
      assert.equal(result?.closing_date, '2026-08-15');
    });
  });

  describe('boolean coercion', () => {
    it('coerces string booleans', () => {
      assert.equal(validateParsedJob({ ...BASE, is_unionized: 'true' })?.is_unionized, true);
      assert.equal(validateParsedJob({ ...BASE, is_unionized: 'false' })?.is_unionized, false);
      assert.equal(validateParsedJob({ ...BASE, is_student: 'true' })?.is_student, true);
    });

    it('coerces numeric booleans', () => {
      assert.equal(validateParsedJob({ ...BASE, is_inventory: 1 })?.is_inventory, true);
      assert.equal(validateParsedJob({ ...BASE, is_inventory: 0 })?.is_inventory, false);
    });
  });

  describe('benefits normalization', () => {
    it('passes through arrays', () => {
      const result = validateParsedJob({ ...BASE, benefits: ['pension', 'dental'] });
      assert.deepEqual(result?.benefits, ['pension', 'dental']);
    });

    it('splits comma-separated strings', () => {
      const result = validateParsedJob({ ...BASE, benefits: 'pension, health, dental' });
      assert.deepEqual(result?.benefits, ['pension', 'health', 'dental']);
    });

    it('returns empty array for null/missing', () => {
      assert.deepEqual(validateParsedJob({ ...BASE, benefits: null })?.benefits, []);
      assert.deepEqual(validateParsedJob({ ...BASE, benefits: undefined })?.benefits, []);
    });
  });
});
