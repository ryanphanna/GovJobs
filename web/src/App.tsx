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
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ backgroundColor: '#2563eb', color: 'white', padding: '0.5rem', borderRadius: '8px' }}>
                <Briefcase size={24} />
              </div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: 0 }}>Toronto Public Sector Feeds</h1>
            </div>
            
            <nav style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setCurrentView('feed')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  backgroundColor: currentView === 'feed' ? '#eff6ff' : 'transparent',
                  color: currentView === 'feed' ? '#2563eb' : '#4b5563',
                  fontWeight: currentView === 'feed' ? 600 : 500
                }}
              >
                <LayoutGrid size={18} /> Feed
              </button>
              <button 
                onClick={() => setCurrentView('companies')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  backgroundColor: currentView === 'companies' ? '#eff6ff' : 'transparent',
                  color: currentView === 'companies' ? '#2563eb' : '#4b5563',
                  fontWeight: currentView === 'companies' ? 600 : 500
                }}
              >
                <Building2 size={18} /> Companies
              </button>
            </nav>
          </div>

          <div style={{ position: 'relative', width: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input 
              type="text" 
              placeholder="Search jobs, departments, companies..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '0.625rem 0.625rem 0.625rem 2.5rem', borderRadius: '8px', border: '1px solid #d1d5db', outline: 'none', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem', width: '100%', flex: 1 }}>
        {currentView === 'feed' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem', alignItems: 'start' }}>
            {/* Job List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 500 }}>
                {searchTerm ? `Found ${filteredJobs.length} matches` : `Showing ${jobs.length} latest jobs`}
              </div>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>Loading jobs...</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {filteredJobs.map(job => (
                    <div 
                      key={job.id} 
                      onClick={() => setSelectedJob(job)}
                      style={{ 
                        backgroundColor: 'white', 
                        padding: '0.625rem 0.875rem', 
                        borderRadius: '8px', 
                        border: selectedJob?.id === job.id ? '2px solid #2563eb' : '1px solid #e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.1s ease',
                        boxShadow: selectedJob?.id === job.id ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 'none'
                      }}
                    >
                      <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', margin: '0 0 0.35rem 0', lineHeight: 1.25 }}>{job.job_title}</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', fontSize: '0.7rem', color: '#6b7280' }}>
                        <div style={{ color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                          {job.source}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Building size={11} style={{ opacity: 0.6 }} /> {job.department}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={11} style={{ opacity: 0.6 }} /> {job.closing_date || 'No deadline'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Job Details */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e5e7eb', padding: '2.5rem', height: 'calc(100vh - 160px)', position: 'sticky', top: '100px', overflowY: 'auto', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
              {selectedJob ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div style={{ flex: 1, paddingRight: '2rem' }}>
                      <div style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#1d4ed8', fontSize: '0.875rem', fontWeight: 700, marginBottom: '1rem' }}>
                        {selectedJob.source}
                      </div>
                      <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#111827', margin: '0 0 0.75rem 0', lineHeight: 1.2 }}>{selectedJob.job_title}</h2>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', color: '#4b5563', fontSize: '1rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Building size={20} style={{ color: '#2563eb' }} /> {selectedJob.department}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={20} style={{ color: '#2563eb' }} /> {selectedJob.location}</span>
                        {selectedJob.closing_date && <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={20} style={{ color: '#2563eb' }} /> {selectedJob.closing_date}</span>}
                      </div>
                    </div>
                    <a 
                      href={selectedJob.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        backgroundColor: '#2563eb', 
                        color: 'white', 
                        padding: '0.875rem 1.75rem', 
                        borderRadius: '10px', 
                        textDecoration: 'none', 
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.625rem',
                        boxShadow: '0 4px 6px -1px rgb(37 99 235 / 0.2)',
                        transition: 'transform 0.1s'
                      }}
                    >
                      Apply Now <ExternalLink size={18} />
                    </a>
                  </div>
                  
                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '2rem' }}>
                    <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', marginBottom: '1.25rem' }}>Job Description</h4>
                    <div style={{ color: '#374151', lineHeight: 1.7, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
                      {selectedJob.description || 'No description available.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#9ca3af' }}>
                  <Briefcase size={64} style={{ marginBottom: '1.5rem', opacity: 0.1 }} />
                  <p style={{ fontSize: '1.125rem', fontWeight: 500 }}>Select a job from the feed to view full details</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {companies.map(company => (
              <div 
                key={company}
                style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '16px', 
                  border: '1px solid #e5e7eb', 
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div style={{ backgroundColor: '#f3f4f6', p: '0.75rem', borderRadius: '12px', color: '#374151' }}>
                    <Building2 size={32} />
                  </div>
                  <span style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.875rem', fontWeight: 600 }}>
                    {jobsByCompany[company]?.length} Jobs
                  </span>
                </div>
                
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem 0' }}>{company}</h3>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem 0', flex: 1 }}>
                  Opportunities available in {Array.from(new Set(jobsByCompany[company]?.map(j => j.department))).slice(0, 3).join(', ')}...
                </p>
                
                <button 
                  onClick={() => {
                    setSearchTerm(company);
                    setCurrentView('feed');
                  }}
                  style={{ 
                    width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#2563eb', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                  }}
                >
                  View Jobs <ChevronRight size={18} />
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
