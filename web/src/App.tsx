import React, { useEffect, useState } from 'react';
import { Search, MapPin, Building, Calendar, ExternalLink, Briefcase, LayoutGrid, Building2, ChevronRight } from 'lucide-react';

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

type View = 'feed' | 'companies';

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentView, setCurrentView] = useState<View>('feed');

  useEffect(() => {
    fetch('http://localhost:3001/api/jobs')
      .then(res => res.json())
      .then(data => {
        setJobs(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching jobs:', err);
        setLoading(false);
      });
  }, []);

  const filteredJobs = jobs.filter(job => 
    job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const jobsByCompany = jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = [];
    acc[job.source].push(job);
    return acc;
  }, {} as Record<string, Job[]>);

  const companies = Object.keys(jobsByCompany).sort();

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Compact Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0.75rem 1.5rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.4rem', borderRadius: '6px' }}>
                <Briefcase size={20} />
              </div>
              <h1 style={{ fontSize: '1rem', fontWeight: 800, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Toronto Public Sector Feeds</h1>
            </div>
            
            <nav style={{ display: 'flex', gap: '0.25rem' }}>
              <button 
                onClick={() => setCurrentView('feed')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  backgroundColor: currentView === 'feed' ? '#eff6ff' : 'transparent',
                  color: currentView === 'feed' ? '#2563eb' : '#4b5563',
                  fontWeight: 600, fontSize: '0.875rem'
                }}
              >
                <LayoutGrid size={16} /> Feed
              </button>
              <button 
                onClick={() => setCurrentView('companies')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  backgroundColor: currentView === 'companies' ? '#eff6ff' : 'transparent',
                  color: currentView === 'companies' ? '#2563eb' : '#4b5563',
                  fontWeight: 600, fontSize: '0.875rem'
                }}
              >
                <Building2 size={16} /> Companies
              </button>
            </nav>
          </div>

          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 2.25rem', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.8125rem' }}
            />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '1.25rem', width: '100%', flex: 1 }}>
        {currentView === 'feed' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.25rem', alignItems: 'start' }}>
            {/* Ultra-Dense Job List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                {searchTerm ? `${filteredJobs.length} matches` : `${jobs.length} latest jobs`}
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem', fontSize: '0.875rem' }}>Loading jobs...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {filteredJobs.map(job => (
                    <div 
                      key={job.id} 
                      onClick={() => setSelectedJob(job)}
                      style={{ 
                        backgroundColor: 'white', 
                        padding: '0.625rem 0.875rem', 
                        borderRadius: '6px', 
                        border: selectedJob?.id === job.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                      }}
                    >
                      <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem 0', lineHeight: 1.2 }}>{job.job_title}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.625rem', fontSize: '0.6875rem', color: '#6b7280' }}>
                        <div style={{ color: '#2563eb', fontWeight: 800 }}>{job.source}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Building size={10} style={{ opacity: 0.6 }} /> {job.department.substring(0, 30)}{job.department.length > 30 ? '...' : ''}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Calendar size={10} style={{ opacity: 0.6 }} /> {job.closing_date || 'No deadline'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Dense Job Details */}
            <div style={{ backgroundColor: 'white', borderRadius: '10px', border: '1px solid #e5e7eb', padding: '1.75rem', height: 'calc(100vh - 120px)', position: 'sticky', top: '80px', overflowY: 'auto' }}>
              {selectedJob ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                    <div style={{ flex: 1, paddingRight: '1.5rem' }}>
                      <div style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem' }}>
                        {selectedJob.source}
                      </div>
                      <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#111827', margin: '0 0 0.5rem 0', lineHeight: 1.15 }}>{selectedJob.job_title}</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', color: '#4b5563', fontSize: '0.875rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Building size={16} style={{ color: '#2563eb' }} /> {selectedJob.department}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MapPin size={16} style={{ color: '#2563eb' }} /> {selectedJob.location}</span>
                        {selectedJob.closing_date && <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={16} style={{ color: '#2563eb' }} /> {selectedJob.closing_date}</span>}
                      </div>
                    </div>
                    <a 
                      href={selectedJob.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        backgroundColor: '#2563eb', 
                        color: 'white', 
                        padding: '0.625rem 1.25rem', 
                        borderRadius: '8px', 
                        textDecoration: 'none', 
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Apply <ExternalLink size={16} />
                    </a>
                  </div>
                  
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '1.5rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', marginBottom: '1rem' }}>Description</h4>
                    <div style={{ color: '#374151', lineHeight: 1.6, fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>
                      {selectedJob.description || 'No description available.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#9ca3af' }}>
                  <Briefcase size={48} style={{ marginBottom: '1rem', opacity: 0.1 }} />
                  <p style={{ fontSize: '1rem', fontWeight: 500 }}>Select a job to view details</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {companies.map(company => (
              <div 
                key={company}
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '10px', 
                  border: '1px solid #e5e7eb', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div style={{ backgroundColor: '#f3f4f6', padding: '0.5rem', borderRadius: '8px', color: '#374151' }}>
                    <Building2 size={24} />
                  </div>
                  <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                    {jobsByCompany[company]?.length} Jobs
                  </span>
                </div>
                
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '0 0 0.25rem 0' }}>{company}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.75rem', margin: '0 0 1rem 0', flex: 1, lineHeight: 1.4 }}>
                  {Array.from(new Set(jobsByCompany[company]?.map(j => j.department))).slice(0, 2).join(', ')}...
                </p>
                
                <button 
                  onClick={() => {
                    setSearchTerm(company);
                    setCurrentView('feed');
                  }}
                  style={{ 
                    width: '100%', padding: '0.625rem', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#2563eb', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.8125rem'
                  }}
                >
                  View Jobs <ChevronRight size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
