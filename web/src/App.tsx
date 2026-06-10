import React, { useEffect, useState, useMemo } from 'react';
import { Search, MapPin, Building, Calendar, ExternalLink, Briefcase, LayoutGrid, Building2, ChevronRight, X, DollarSign, Clock, ArrowLeft } from 'lucide-react';

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
      display: 'grid',
      gridTemplateColumns: '140px 2fr 1fr 140px 40px',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '0.6rem 1.5rem',
      backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9',
      cursor: 'pointer',
      transition: 'background-color 0.1s ease',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
  >
    <div style={{ fontSize: '0.6rem', fontWeight: 800, color: '#3b82f6', letterSpacing: '0.05em' }}>
      {job.source}
    </div>
    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {job.job_title}
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8125rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {job.department && <><Building size={12} style={{ opacity: 0.4 }} /> {job.department}</>}
    </div>
    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
      {job.closing_date || 'Ongoing'}
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#cbd5e1' }}>
      <ChevronRight size={16} />
    </div>
  </div>
);

const CompanyRow = ({ name, count, onClick }: { name: string, count: number, onClick: () => void }) => (
  <div 
    onClick={onClick}
    style={{ 
      display: 'grid',
      gridTemplateColumns: '48px 1fr 120px 40px',
      alignItems: 'center',
      gap: '1.5rem',
      padding: '0.75rem 1.5rem',
      backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9',
      cursor: 'pointer',
      transition: 'background-color 0.1s ease',
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
  >
    <div style={{ backgroundColor: '#f1f5f9', padding: '0.4rem', borderRadius: '6px', color: '#475569', display: 'flex', justifyContent: 'center' }}>
      <Building2 size={18} />
    </div>
    <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#1e293b' }}>{name}</div>
    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#3b82f6', textAlign: 'right' }}>{count} Positions</div>
    <div style={{ display: 'flex', justifyContent: 'flex-end', color: '#cbd5e1' }}>
      <ChevronRight size={16} />
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

  const resetState = () => {
    setCurrentView('jobs');
    setSearchTerm('');
    setSelectedJob(null);
  };

  const parsedDetails = useMemo(() => {
    if (!selectedJob) return null;
    const desc = selectedJob.description;
    const extract = (key: string) => {
      const match = desc.match(new RegExp(`${key}:?\\s*(.*)`, 'i'));
      return match ? match[1]?.trim() : null;
    };

    return {
      salary: extract('Salary Scale') || extract('Salary') || selectedJob.salary_range,
      mode: extract('Work Mode') || extract('Employment Type'),
      duration: extract('Term') || extract('Duration'),
      cleanDesc: desc.split('\n').filter(line => !line.includes(':')).join('\n').trim()
    };
  }, [selectedJob]);

  if (selectedJob) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'white', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => setSelectedJob(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600, padding: '0.5rem' }}
            >
              <ArrowLeft size={20} /> Back to Jobs
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '4rem 2rem' }}>
          <div style={{ marginBottom: '3rem' }}>
            <div style={{ display: 'inline-block', padding: '0.3rem 0.8rem', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', fontSize: '0.75rem', fontWeight: 900, marginBottom: '1.25rem', letterSpacing: '0.05em' }}>{selectedJob.source}</div>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a', margin: '0 0 1.5rem 0', lineHeight: 1.05, letterSpacing: '-0.03em' }}>{selectedJob.job_title}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Department</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem' }}><Building size={18} color="#2563eb" /> {selectedJob.department}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Location</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem' }}><MapPin size={18} color="#2563eb" /> {selectedJob.location}</div>
              </div>
              {parsedDetails?.salary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Salary</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem' }}><DollarSign size={18} color="#2563eb" /> {parsedDetails.salary}</div>
                </div>
              )}
              {parsedDetails?.mode && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Work Mode</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '1rem' }}><Clock size={18} color="#2563eb" /> {parsedDetails.mode}</div>
                </div>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '4rem' }}>
            <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#2563eb', color: 'white', padding: '1rem 3rem', borderRadius: '12px', textDecoration: 'none', fontWeight: 800, fontSize: '1.125rem', display: 'inline-flex', alignItems: 'center', gap: '0.75rem', boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)' }}>Apply on Official Portal <ExternalLink size={20} /></a>
          </div>
          
          <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '3rem' }}>
            <h4 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', marginBottom: '2rem', letterSpacing: '-0.01em' }}>Job Description</h4>
            <div style={{ color: '#334155', lineHeight: 1.8, fontSize: '1.125rem', whiteSpace: 'pre-wrap' }}>
              {parsedDetails?.cleanDesc || 'Visit the portal for full details.'}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: '100%', maxWidth: '1800px', margin: '0 auto', padding: '0.75rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3rem' }}>
            <div 
              onClick={resetState}
              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}
            >
              <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.4rem', borderRadius: '6px' }}>
                <Briefcase size={20} />
              </div>
              <span style={{ fontSize: '1.125rem', fontWeight: 900, letterSpacing: '-0.025em' }}>GovJobs</span>
            </div>
            
            <nav style={{ display: 'flex', gap: '0.5rem' }}>
              {[
                { id: 'jobs', label: 'Jobs', icon: LayoutGrid },
                { id: 'companies', label: 'Companies', icon: Building2 }
              ].map(item => (
                <button 
                  key={item.id}
                  onClick={() => { setCurrentView(item.id as View); setSearchTerm(''); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, transition: 'all 0.15s',
                    backgroundColor: currentView === item.id ? '#eff6ff' : 'transparent',
                    color: currentView === item.id ? '#2563eb' : '#64748b'
                  }}
                >
                  <item.icon size={16} /> {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div style={{ position: 'relative', width: '380px', flexShrink: 0 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input 
              type="text" 
              placeholder="Search positions, orgs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#1e293b', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </header>

      <main style={{ width: '100%', maxWidth: '1800px', margin: '0 auto', padding: '1.5rem', boxSizing: 'border-box' }}>
        <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ padding: '0.75rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: currentView === 'jobs' ? '140px 2fr 1fr 140px 40px' : '48px 1fr 120px 40px', gap: '1.5rem', alignItems: 'center' }}>
            {currentView === 'jobs' ? (
              <>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Source</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Position Title</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Department</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Deadline</span>
              </>
            ) : (
              <>
                <span></span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Organization Name</span>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right' }}>Active Count</span>
              </>
            )}
            <span></span>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b', fontSize: '0.9rem', fontWeight: 500 }}>Refreshing feeds...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {currentView === 'jobs' ? (
                filteredJobs.map(job => <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />)
              ) : (
                companies.map(name => (
                  <CompanyRow 
                    key={name} 
                    name={name} 
                    count={jobsByCompany[name]?.length || 0} 
                    onClick={() => { setSearchTerm(name); setCurrentView('jobs'); }} 
                  />
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
