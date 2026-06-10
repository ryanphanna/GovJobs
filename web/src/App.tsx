import React, { useEffect, useState, useMemo } from 'react';
import { Search, MapPin, Building, Calendar, ExternalLink, Briefcase, LayoutGrid, Building2, ChevronRight, X, DollarSign, Clock, ArrowLeft, Users, Zap, Globe } from 'lucide-react';

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

const JobRow = ({ job, onClick }: { job: Job, onClick: () => void }) => (
  <div 
    onClick={onClick}
    style={{ 
      padding: '0.5rem 1.5rem',
      backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9',
      cursor: 'pointer',
      transition: 'all 0.1s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2rem'
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e293b' }}>{job.job_title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <a 
          href={job.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#3b82f6', opacity: 0.6, display: 'flex', alignItems: 'center' }}
        >
          <ExternalLink size={12} />
        </a>
        <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
      </div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
      <span style={{ color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em' }}>{job.source}</span>
      {job.department && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Building size={10} /> {job.department}</span>}
      {job.location && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={10} /> {job.location}</span>}
      {job.closing_date && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Calendar size={10} /> {job.closing_date}</span>}
    </div>
  </div>
);

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentView, setCurrentView] = useState<View>('jobs');

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

  const filteredJobs = useMemo(() => jobs.filter(job => 
    job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.source.toLowerCase().includes(searchTerm.toLowerCase())
  ), [jobs, searchTerm]);

  const jobsByCompany = jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = [];
    acc[job.source].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const companies = Object.keys(jobsByCompany).sort();

  const parsedDetails = useMemo(() => {
    if (!selectedJob) return null;
    const desc = selectedJob.description;
    const extract = (key: string) => {
      const match = desc.match(new RegExp(`${key}:?\\s*([^\\n\\r]*)`, 'i'));
      let val = match ? match[1]?.trim() : null;
      if (val && (key.toLowerCase().includes('salary'))) {
        val = val.replace(/\s*Information\s*$/i, '').replace(/Job Opportunity\s*$/i, '');
      }
      return val;
    };

    return {
      salary: extract('Salary Scale') || extract('Salary Range') || extract('Salary') || (selectedJob.salary_range !== 'null' ? selectedJob.salary_range : null),
      mode: extract('Work Mode') || extract('Employment Type'),
      vacancies: extract('Number of Vacancies') || extract('No. of Vacancies') || extract('Vacancies'),
      future: extract('Future Requirements') || extract('Future Needs'),
      duration: extract('Term') || extract('Duration') || extract('Assignment Duration'),
    };
  }, [selectedJob]);

  const reset = () => { setSelectedJob(null); setCurrentView('jobs'); setSearchTerm(''); };

  if (selectedJob) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <header style={{ borderBottom: '1px solid #e2e8f0', padding: '0.4rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
               <Briefcase size={14} color="#2563eb" fill="#2563eb" />
               <span style={{ fontWeight: 900, fontSize: '0.85rem' }}>GovJobs</span>
            </div>
            <button onClick={() => setSelectedJob(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 700, fontSize: '0.7rem' }}>
              <ArrowLeft size={14} /> BACK TO LIST
            </button>
          </div>
          <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.3rem 0.8rem', borderRadius: '4px', textDecoration: 'none', fontWeight: 800, fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            APPLY ON PORTAL <ExternalLink size={12} />
          </a>
        </header>
        <main style={{ flex: 1, padding: '1.5rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '0.2rem', letterSpacing: '0.05em' }}>{selectedJob.source}</div>
              <h1 style={{ fontSize: '1.375rem', fontWeight: 900, margin: '0 0 0.75rem 0', letterSpacing: '-0.02em', lineHeight: 1.1, color: '#0f172a' }}>{selectedJob.job_title}</h1>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.5rem' }}>
                {[
                  { label: 'Department', val: selectedJob.department, icon: Building },
                  { label: 'Location', val: selectedJob.location, icon: MapPin },
                  { label: 'Salary', val: parsedDetails?.salary, icon: DollarSign },
                  { label: 'Work Mode', val: parsedDetails?.mode, icon: Globe },
                  { label: 'Vacancies', val: parsedDetails?.vacancies, icon: Users },
                  { label: 'Future Needs', val: parsedDetails?.future, icon: Zap, highlight: true }
                ].filter(i => i.val).map(item => (
                  <div key={item.label} style={{ backgroundColor: item.highlight ? '#fff7ed' : '#f8fafc', padding: '0.6rem 0.8rem', borderRadius: '8px', border: item.highlight ? '1px solid #ffedd5' : '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 800, color: item.highlight ? '#c2410c' : '#94a3b8', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', color: item.highlight ? '#9a3412' : '#1e293b' }}>
                      <item.icon size={12} color={item.highlight ? '#c2410c' : "#2563eb"} /> {item.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 900, color: '#0f172a', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Overview</h4>
              <div style={{ fontSize: '0.8125rem', lineHeight: 1.5, color: '#475569', whiteSpace: 'pre-wrap' }}>
                {selectedJob.description || 'Full details on official portal.'}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '0.4rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2.5rem' }}>
          <div onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
            <Briefcase size={16} color="#2563eb" fill="#2563eb" />
            <span style={{ fontWeight: 900, fontSize: '0.9rem', letterSpacing: '-0.025em' }}>GovJobs</span>
          </div>
          <nav style={{ display: 'flex', gap: '0.25rem' }}>
            <button onClick={() => setCurrentView('jobs')} style={{ padding: '0.3rem 0.7rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, backgroundColor: currentView === 'jobs' ? '#eff6ff' : 'transparent', color: currentView === 'jobs' ? '#2563eb' : '#64748b', textTransform: 'uppercase' }}>Jobs</button>
            <button onClick={() => setCurrentView('companies')} style={{ padding: '0.3rem 0.7rem', borderRadius: '4px', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, backgroundColor: currentView === 'companies' ? '#eff6ff' : 'transparent', color: currentView === 'companies' ? '#2563eb' : '#64748b', textTransform: 'uppercase' }}>Companies</button>
          </nav>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.35rem 0.35rem 0.35rem 2.25rem', borderRadius: '6px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.75rem', boxSizing: 'border-box', backgroundColor: 'white', color: '#1e293b' }}
          />
        </div>
      </header>

      <main style={{ flex: 1, width: '100%' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>REFRESHING FEEDS...</div>
        ) : (
          <div style={{ backgroundColor: 'white' }}>
            {currentView === 'jobs' ? (
              filteredJobs.map(job => <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />)
            ) : (
              companies.map(name => (
                <div key={name} onClick={() => {setSearchTerm(name); setCurrentView('jobs');}} style={{ padding: '0.5rem 1.5rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Building2 size={14} color="#64748b" />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{name}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase' }}>{jobsByCompany[name].length} positions</span>
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
