import React, { useEffect, useState, useMemo } from 'react';
import { Search, MapPin, Building, Calendar, ExternalLink, Briefcase, LayoutGrid, Building2, ChevronRight, DollarSign, Clock, ArrowLeft, Users, Zap, Globe, Filter } from 'lucide-react';

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
      padding: '0.75rem 0',
      backgroundColor: 'white',
      borderBottom: '1px solid #f8fafc',
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
      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.15rem' }}>{job.job_title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8125rem', color: '#64748b' }}>
        <span style={{ color: '#0f172a', fontWeight: 600 }}>{job.source}</span>
        {job.department && <span>{job.department}</span>}
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
      {job.closing_date && (
        <div style={{ fontSize: '0.8125rem', color: '#94a3b8', textAlign: 'right' }}>
          {job.closing_date}
        </div>
      )}
      <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
    </div>
  </div>
);

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentView, setCurrentView] = useState<View>('jobs');
  const [filterSource, setFilterSource] = useState('All');

  useEffect(() => {
    fetch('http://localhost:3001/api/jobs')
      .then(res => res.json())
      .then(data => {
        const normalized = data.map((j: Job) => ({
          ...j,
          job_title: j.job_title
            .replace(/^Available Position:\s+/i, '')
            .replace(/\(\d+\)\s*$/, '')
            .replace(/\d+$/, '')
            .trim(),
          department: j.department
            .replace(/\(\d+\)/g, '')
            .replace(/ - .*/, '')
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
    const matchesSource = filterSource === 'All' || job.source === filterSource;
    return matchesSearch && matchesSource;
  }), [jobs, searchTerm, filterSource]);

  const jobsByCompany = jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = [];
    acc[job.source].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const companies = Object.keys(jobsByCompany).sort();
  const currentJobDetails = useMemo(() => selectedJob ? parseJobDetails(selectedJob) : null, [selectedJob]);

  const reset = () => { setSelectedJob(null); setCurrentView('jobs'); setSearchTerm(''); setFilterSource('All'); };

  if (selectedJob) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <header style={{ padding: '2rem 1.5rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div onClick={reset} style={{ fontSize: '1.5rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '-0.03em' }}>GovJobs</div>
            <button onClick={() => setSelectedJob(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600, fontSize: '0.875rem' }}>
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '800px', margin: '0 auto', padding: '4rem 1.5rem 10rem 1.5rem' }}>
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>{selectedJob.source}</div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 2rem 0', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{selectedJob.job_title}</h1>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3rem', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '1.5rem 0' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>Department</span>
                <span style={{ fontWeight: 600 }}>{selectedJob.department}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>Location</span>
                <span style={{ fontWeight: 600 }}>{selectedJob.location}</span>
              </div>
              {currentJobDetails?.salary && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>Salary</span>
                  <span style={{ fontWeight: 600 }}>{currentJobDetails.salary}</span>
                </div>
              )}
              {currentJobDetails?.mode && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>Work Mode</span>
                  <span style={{ fontWeight: 600 }}>{currentJobDetails.mode}</span>
                </div>
              )}
              {currentJobDetails?.vacancies && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.25rem' }}>Vacancies</span>
                  <span style={{ fontWeight: 600 }}>{currentJobDetails.vacancies}</span>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ fontSize: '1rem', lineHeight: 1.8, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {selectedJob.description}
          </div>

          <div style={{ marginTop: '4rem', paddingTop: '2rem', borderTop: '1px solid #f1f5f9' }}>
            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', fontWeight: 700, textDecoration: 'none', fontSize: '1.125rem' }}>
              Apply on official portal <ExternalLink size={20} />
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ padding: '3rem 1.5rem', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2rem' }}>
          <h1 onClick={reset} style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.04em', cursor: 'pointer' }}>GovJobs</h1>
          <nav style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}>
            <span onClick={() => setCurrentView('jobs')} style={{ cursor: 'pointer', color: currentView === 'jobs' ? '#0f172a' : 'inherit' }}>Jobs</span>
            <span onClick={() => setCurrentView('companies')} style={{ cursor: 'pointer', color: currentView === 'companies' ? '#0f172a' : 'inherit' }}>Companies</span>
          </nav>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search positions..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.75rem 0.75rem 0.75rem 2rem', border: 'none', borderBottom: '1px solid #e2e8f0', outline: 'none', fontSize: '1rem', color: '#0f172a' }}
            />
          </div>
          <select 
            value={filterSource} 
            onChange={(e) => setFilterSource(e.target.value)}
            style={{ padding: '0.5rem', border: 'none', borderBottom: '1px solid #e2e8f0', fontSize: '0.875rem', fontWeight: 600, color: '#64748b', outline: 'none', backgroundColor: 'transparent' }}
          >
            <option value="All">All Sources</option>
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem 10rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem', fontSize: '0.8125rem', fontWeight: 600, color: '#94a3b8' }}>
          {searchTerm ? `${filteredJobs.length} matches` : `${jobs.length} jobs currently available`}
        </div>

        {loading ? (
          <div style={{ padding: '4rem 0', color: '#94a3b8' }}>Loading...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {currentView === 'jobs' ? (
              filteredJobs.map(job => <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />)
            ) : (
              companies.map(name => (
                <div key={name} onClick={() => {setFilterSource(name); setCurrentView('jobs');}} style={{ padding: '1rem 0', borderBottom: '1px solid #f8fafc', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>{jobsByCompany[name].length} positions</span>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
