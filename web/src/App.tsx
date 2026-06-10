import React, { useEffect, useState, useMemo } from 'react';
import { Search, MapPin, Building, Calendar, ExternalLink, Briefcase, LayoutGrid, Building2, ChevronRight, DollarSign, Clock, ArrowLeft, Users, Zap, Globe, Filter, ChevronDown, ChevronUp } from 'lucide-react';

interface Job {
  id: string;
  job_title: string;
  department: string;
  location: string;
  salary_range: string;
  description: string;
  closing_date: string;
  url: string;
  source: string;
  scraped_at: string;
}

type View = 'jobs' | 'companies';

const fixCasing = (s: string) => {
  if (!s) return s;
  if (s === s.toUpperCase()) {
    return s.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return s;
};

const normalizeMode = (mode: string | null) => {
  if (!mode) return null;
  const m = mode.toLowerCase();
  if (m.includes('hybrid')) return 'Hybrid';
  if (m.includes('remote') || m.includes('telework')) return 'Remote';
  if (m.includes('on-site') || m.includes('in person') || m.includes('regular')) return 'In-person';
  return mode;
};

const JobRow = ({ job, onClick }: { job: Job, onClick: () => void }) => (
  <div 
    onClick={onClick}
    style={{ 
      padding: '0.625rem 0',
      backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9',
      cursor: 'pointer',
      transition: 'opacity 0.1s ease',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '2rem'
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.1rem' }}>{job.job_title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
        <span style={{ color: '#0f172a', fontWeight: 600 }}>{job.source}</span>
        {job.department && <span>• {job.department}</span>}
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
      {job.closing_date && (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', fontWeight: 500 }}>
          {job.closing_date}
        </div>
      )}
      <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
    </div>
  </div>
);

const FilterSection = ({ title, children, defaultOpen = true }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ paddingBottom: '1rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', backgroundColor: 'transparent', padding: '0.25rem 0', cursor: 'pointer', marginBottom: isOpen ? '0.5rem' : 0 }}
      >
        <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em' }}>{title}</span>
        {isOpen ? <ChevronUp size={14} color="#0f172a" /> : <ChevronDown size={14} color="#0f172a" />}
      </button>
      {isOpen && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>{children}</div>}
    </div>
  );
};

const FilterButton = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    style={{ 
      padding: '0.35rem 0.625rem', 
      borderRadius: '6px', 
      fontSize: '0.7rem', 
      fontWeight: 600, 
      border: '1px solid',
      borderColor: active ? '#0f172a' : '#e2e8f0',
      backgroundColor: active ? '#0f172a' : 'white',
      color: active ? 'white' : '#64748b',
      cursor: 'pointer',
      transition: 'all 0.1s ease'
    }}
  >
    {label}
  </button>
);

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentView, setCurrentView] = useState<View>('jobs');
  
  // Advanced Filters
  const [minSalary, setMinSalary] = useState<number | null>(null);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [closingSoon, setClosingSoon] = useState(false);

  useEffect(() => {
    fetch('http://localhost:3001/api/jobs')
      .then(res => res.json())
      .then(data => {
        const normalized = data.map((j: Job) => ({
          ...j,
          job_title: fixCasing(j.job_title
            .replace(/^Available Position:\s+/i, '')
            .replace(/\(\d+\)\s*$/, '')
            .replace(/\d+$/, '')
            .replace(/ -([A-Z])/, ' - $1')
            .trim()),
          department: j.department
            .replace(/\(\d+\)/g, '')
            .replace(/\s*[-–—]\s*Job Opportunity.*/i, '')
            .replace(/\s*[-–—].*/, '')
            .replace(/^General$/i, '')
            .trim(),
          closing_date: j.closing_date.replace(/Posted on\s+/i, '').trim(),
          source: j.source === 'WATERFRONT TORONTO' ? 'Waterfront Toronto' : j.source
        }));
        setJobs(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching jobs:', err);
        setLoading(false);
      });
  }, []);

  const parseJobDetails = (job: Job) => {
    const desc = job.description;
    const extract = (key: string) => {
      const match = desc.match(new RegExp(`${key}:?\\s*([^\\n\\r]*)`, 'i'));
      let val = match ? match[1]?.trim() : null;
      if (val) {
        if (key.toLowerCase().includes('salary')) {
           val = val.replace(/Information:?/gi, '').replace(/Job Opportunity/gi, '').trim();
        }
        if (key.toLowerCase().includes('vacancies')) {
           const numMatch = val.match(/\d+/);
           val = numMatch ? numMatch[0] : val;
        }
      }
      return val;
    };
    return {
      salary: extract('Salary Scale') || extract('Salary Range') || extract('Salary') || (job.salary_range !== 'null' ? job.salary_range : null),
      mode: normalizeMode(extract('Work Mode') || extract('Employment Type')),
      vacancies: extract('Number of Vacancies') || extract('No. of Vacancies') || extract('Vacancies'),
      future: desc.toLowerCase().includes('future requirements') ? 'Eligible for future requirements' : null,
    };
  };

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const matchesSearch = job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.source.toLowerCase().includes(searchTerm.toLowerCase());
    
    const details = parseJobDetails(job);
    
    let matchesMode = selectedModes.length === 0 || (details.mode !== null && selectedModes.includes(details.mode));
    
    let matchesSalary = true;
    if (minSalary) {
      const salaryNum = parseInt(details.salary?.replace(/[$,]/g, '') || '0');
      matchesSalary = salaryNum >= minSalary;
    }

    let matchesDeadline = true;
    if (closingSoon && job.closing_date) {
      // Very crude date check, ideally parse properly
      matchesDeadline = !job.closing_date.toLowerCase().includes('ongoing');
    }

    return matchesSearch && matchesMode && matchesSalary && matchesDeadline;
  }), [jobs, searchTerm, selectedModes, minSalary, closingSoon]);

  const jobsByCompany = jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = [];
    acc[job.source].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const companies = Object.keys(jobsByCompany).sort();
  const currentJobDetails = useMemo(() => selectedJob ? parseJobDetails(selectedJob) : null, [selectedJob]);

  const reset = () => { 
    setSelectedJob(null); 
    setCurrentView('jobs'); 
    setSearchTerm(''); 
    setSelectedModes([]);
    setMinSalary(null);
    setClosingSoon(false);
  };

  if (selectedJob) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
        <header style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div onClick={reset} style={{ fontSize: '1.25rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.03em' }}>GovJobs</div>
            <button onClick={() => setSelectedJob(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600, fontSize: '0.8125rem' }}>
              <ArrowLeft size={16} /> Back
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '900px', margin: '0 auto', padding: '3rem 1.5rem' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ color: '#2563eb', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.4rem' }}>{selectedJob.source}</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 1.5rem 0', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{selectedJob.job_title}</h1>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '1.25rem 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Department</span>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{selectedJob.department || 'General'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Location</span>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{selectedJob.location}</span>
              </div>
              {currentJobDetails?.salary && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Salary</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{currentJobDetails.salary}</span>
                </div>
              )}
              {currentJobDetails?.mode && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Work Mode</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{currentJobDetails.mode}</span>
                </div>
              )}
              {currentJobDetails?.vacancies && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Vacancies</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{currentJobDetails.vacancies}</span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ fontSize: '1rem', lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {selectedJob.description}
          </div>

          <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #f1f5f9' }}>
            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#0f172a', color: 'white', padding: '0.75rem 2rem', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '1rem' }}>
              Apply on official portal <ExternalLink size={18} />
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ padding: '2rem 2rem 1rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.5rem' }}>
          <h1 onClick={reset} style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.04em', cursor: 'pointer' }}>GovJobs</h1>
          <nav style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
            <span onClick={() => { setCurrentView('jobs'); setSelectedJob(null); }} style={{ cursor: 'pointer', color: currentView === 'jobs' ? '#0f172a' : 'inherit' }}>Jobs</span>
            <span onClick={() => { setCurrentView('companies'); setSelectedJob(null); }} style={{ cursor: 'pointer', color: currentView === 'companies' ? '#0f172a' : 'inherit' }}>Companies</span>
          </nav>
        </div>

        <div style={{ position: 'relative' }}>
          <Search size={20} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Search positions, organizations..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', border: 'none', borderBottom: '2px solid #f1f5f9', outline: 'none', fontSize: '1.25rem', fontWeight: 500, color: '#0f172a' }}
          />
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 2rem', display: 'grid', gridTemplateColumns: '240px 1fr', gap: '4rem' }}>
        {/* Compact Sidebar Filters */}
        <aside style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#0f172a' }}>
            <Filter size={16} />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
          </div>

          <FilterSection title="Salary Min">
            {[50000, 75000, 100000, 125000].map(val => (
              <FilterButton 
                key={val} 
                label={`$${val/1000}k+`} 
                active={minSalary === val} 
                onClick={() => setMinSalary(minSalary === val ? null : val)} 
              />
            ))}
          </FilterSection>

          <FilterSection title="Work Mode">
            {['In-person', 'Hybrid', 'Remote'].map(mode => (
              <FilterButton 
                key={mode} 
                label={mode} 
                active={selectedModes.includes(mode)} 
                onClick={() => setSelectedModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode])} 
              />
            ))}
          </FilterSection>

          <FilterSection title="Deadline">
             <FilterButton label="Closing soon" active={closingSoon} onClick={() => setClosingSoon(!closingSoon)} />
          </FilterSection>

          <div style={{ marginTop: '1.5rem' }}>
             <button onClick={reset} style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#64748b', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>Reset filters</button>
          </div>
        </aside>

        {/* Dense Content Area */}
        <div style={{ minWidth: 0 }}>
          <div style={{ marginBottom: '1.25rem', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {searchTerm || selectedModes.length > 0 || minSalary || closingSoon
              ? `${filteredJobs.length} matches found` 
              : `${jobs.length} jobs available`}
          </div>

          {loading ? (
            <div style={{ padding: '4rem 0', color: '#94a3b8', textAlign: 'center', fontSize: '1rem', fontWeight: 500 }}>Loading feeds...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {currentView === 'jobs' ? (
                filteredJobs.map(job => <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />)
              ) : (
                companies.map(name => (
                  <div key={name} onClick={() => {setSearchTerm(name); setCurrentView('jobs');}} style={{ padding: '0.75rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>{name}</span>
                    <span style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 700 }}>{jobsByCompany[name].length} positions</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
