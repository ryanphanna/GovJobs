import React, { useEffect, useState, useMemo } from 'react';
import { Search, MapPin, Building, Calendar, ExternalLink, Briefcase, LayoutGrid, Building2, ChevronRight, DollarSign, Clock, ArrowLeft, Users, Zap, Globe, Filter, ListChecks, Target, Info } from 'lucide-react';

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
      padding: '0.5rem 1.5rem',
      backgroundColor: 'white',
      borderBottom: '1px solid #f1f5f9',
      cursor: 'pointer',
      transition: 'all 0.1s ease',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '2rem'
    }}
    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.2rem' }}>{job.job_title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>
        <span style={{ color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em' }}>{job.source}</span>
        {job.department && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Building size={10} /> {job.department}</span>}
        {job.location && <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><MapPin size={10} /> {job.location}</span>}
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0 }}>
      {job.closing_date && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Deadline</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444' }}>{job.closing_date}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <a 
          href={job.url} 
          target="_blank" 
          rel="noopener noreferrer" 
          onClick={(e) => e.stopPropagation()}
          style={{ color: '#3b82f6', opacity: 0.6 }}
        >
          <ExternalLink size={14} />
        </a>
        <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
      </div>
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
  const [minSalary, setMinSalary] = useState('');

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

    const extractSection = (keywords: string[]) => {
      for (const keyword of keywords) {
        const regex = new RegExp(`${keyword}:?\\s*([\\s\\S]*?)(?=\\n\\n|\\n[A-Z][a-z]|$)`, 'i');
        const match = desc.match(regex);
        if (match && match[1].trim().length > 20) return match[1].trim();
      }
      return null;
    };

    return {
      salary: extract('Salary Scale') || extract('Salary Range') || extract('Salary') || (job.salary_range !== 'null' ? job.salary_range : null),
      mode: normalizeMode(extract('Work Mode') || extract('Employment Type')),
      vacancies: extract('Number of Vacancies') || extract('No. of Vacancies') || extract('Vacancies'),
      future: desc.toLowerCase().includes('future requirements') ? 'Eligible for future requirements' : null,
      responsibilities: extractSection(['Major Responsibilities', 'Key Responsibilities', 'Responsibilities', 'What you will do']),
      qualifications: extractSection(['Key Qualifications', 'Skills and Qualifications', 'Qualifications', 'What you bring']),
    };
  };

  const filteredJobs = useMemo(() => jobs.filter(job => {
    const matchesSearch = job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.source.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = filterSource === 'All' || job.source === filterSource;
    
    let matchesSalary = true;
    if (minSalary) {
       const details = parseJobDetails(job);
       const salaryNum = parseInt(details.salary?.replace(/[$,]/g, '') || '0');
       matchesSalary = salaryNum >= parseInt(minSalary);
    }

    return matchesSearch && matchesSource && matchesSalary;
  }), [jobs, searchTerm, filterSource, minSalary]);

  const jobsByCompany = jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = [];
    acc[job.source].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const companies = Object.keys(jobsByCompany).sort();

  const currentJobDetails = useMemo(() => selectedJob ? parseJobDetails(selectedJob) : null, [selectedJob]);

  const reset = () => { setSelectedJob(null); setCurrentView('jobs'); setSearchTerm(''); setFilterSource('All'); setMinSalary(''); };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: selectedJob ? 'white' : '#f8fafc', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Universal Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div 
              onClick={reset}
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
                  onClick={() => { setCurrentView(item.id as View); setSearchTerm(''); setSelectedJob(null); }}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, transition: 'all 0.15s',
                    backgroundColor: (currentView === item.id && !selectedJob) ? '#eff6ff' : 'transparent',
                    color: (currentView === item.id && !selectedJob) ? '#2563eb' : '#64748b'
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
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (selectedJob) setSelectedJob(null);
              }}
              style={{ 
                width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#1e293b', outline: 'none', fontSize: '0.875rem', boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </header>

      {selectedJob ? (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>
          <button 
            onClick={() => setSelectedJob(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600, padding: '0 0 1.5rem 0', fontSize: '0.875rem' }}
          >
            <ArrowLeft size={18} /> Back to Jobs
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>{selectedJob.source}</div>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 1.5rem 0', letterSpacing: '-0.02em', lineHeight: 1.1, color: '#0f172a' }}>{selectedJob.job_title}</h1>
                
                {currentJobDetails?.responsibilities && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.025em' }}>
                      <ListChecks size={18} color="#2563eb" /> Responsibilities
                    </div>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap' }}>{currentJobDetails.responsibilities}</div>
                  </div>
                )}

                {currentJobDetails?.qualifications && (
                  <div style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.025em' }}>
                      <Target size={18} color="#2563eb" /> Qualifications
                    </div>
                    <div style={{ fontSize: '0.875rem', lineHeight: 1.7, color: '#475569', whiteSpace: 'pre-wrap' }}>{currentJobDetails.qualifications}</div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.025em' }}>
                    <Info size={18} color="#2563eb" /> Full Description
                  </div>
                  <div style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: '#64748b', whiteSpace: 'pre-wrap' }}>{selectedJob.description}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '80px' }}>
              {selectedJob.closing_date && (
                <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Apply By</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#b91c1c' }}>{selectedJob.closing_date}</div>
                </div>
              )}

              <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { label: 'Department', val: selectedJob.department, icon: Building },
                  { label: 'Location', val: selectedJob.location, icon: MapPin },
                  { label: 'Salary', val: currentJobDetails?.salary, icon: DollarSign },
                  { label: 'Work Mode', val: currentJobDetails?.mode, icon: Globe },
                  { label: 'Vacancies', val: currentJobDetails?.vacancies, icon: Users },
                  { label: 'Eligibility', val: currentJobDetails?.future, icon: Zap, highlight: true }
                ].filter(i => i.val).map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.5rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', color: item.highlight ? '#9a3412' : '#1e293b' }}>
                      <item.icon size={12} color={item.highlight ? '#c2410c' : "#2563eb"} /> {item.val}
                    </div>
                  </div>
                ))}
              </div>
              
              <a href={selectedJob.url} target="_blank" rel="noopener noreferrer" style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.75rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 800, fontSize: '0.875rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)' }}>
                Apply Now <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </main>
      ) : (
        <main style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', boxSizing: 'border-box', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0 0.5rem', backgroundColor: 'white' }}>
              <Filter size={14} color="#94a3b8" />
              <select 
                value={filterSource} 
                onChange={(e) => setFilterSource(e.target.value)}
                style={{ border: 'none', outline: 'none', fontSize: '0.75rem', fontWeight: 600, color: '#475569', padding: '0.35rem 0' }}
              >
                <option value="All">All Sources</option>
                {companies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b', fontSize: '0.8125rem' }}>Loading positions...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {currentView === 'jobs' ? (
                  filteredJobs.map(job => <JobRow key={job.id} job={job} onClick={() => setSelectedJob(job)} />)
                ) : (
                  companies.map(name => (
                    <div key={name} onClick={() => {setFilterSource(name); setCurrentView('jobs');}} style={{ padding: '0.6rem 1.5rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Building2 size={16} color="#64748b" />
                        <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{name}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>{jobsByCompany[name].length} Jobs</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
