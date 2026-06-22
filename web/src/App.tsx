import React, { useEffect, useState, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { inject } from '@vercel/analytics';

const API = import.meta.env.VITE_API_URL ?? '';
import { Search, MapPin, Building, ExternalLink, ChevronRight, X, DollarSign, ArrowLeft, Users, Zap, Globe, Info, ChevronDown, ChevronUp, Bookmark } from 'lucide-react';

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
  is_saved: number;
  is_active: number;
  is_inventory: number;
  is_student: number;
}

type View = 'home' | 'jobs' | 'saved' | 'companies';

const daysUntilClose = (dateStr: string): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const fixCasing = (s: string) => {
  if (!s) return s;
  const cleaned = s.replace(/\s+/g, ' ').trim();
  if (cleaned === cleaned.toUpperCase()) {
    return cleaned.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return cleaned;
};

const normalizeMode = (mode: string | null) => {
  if (!mode) return null;
  const m = mode.toLowerCase();
  if (m.includes('hybrid')) return 'Hybrid';
  if (m.includes('remote') || m.includes('telework')) return 'Remote';
  if (m.includes('on-site') || m.includes('in person') || m.includes('regular')) return 'In-person';
  return mode;
};

const ActionGroup = ({ job, onToggleSave, showBack = false, onBack, showApply = true }: { job: Job, onToggleSave: (e: React.MouseEvent) => void, showBack?: boolean, onBack?: () => void, showApply?: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
    {showApply && (
      <a 
        href={job.url} 
        target="_blank" 
        rel="noopener noreferrer" 
        onClick={(e) => e.stopPropagation()}
        style={{ color: '#0f172a', opacity: 0.6, display: 'flex', alignItems: 'center' }}
        title="Apply on official portal"
      >
        <ExternalLink size={18} />
      </a>
    )}
    <button 
      onClick={onToggleSave}
      style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: job.is_saved ? '#0f172a' : '#cbd5e1', padding: 0, display: 'flex' }}
      title={job.is_saved ? "Unsave job" : "Save job"}
    >
      <Bookmark size={18} fill={job.is_saved ? '#0f172a' : 'transparent'} />
    </button>
    {showBack && onBack && (
      <button 
        onClick={onBack}
        style={{ marginLeft: '1rem', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
      >
        <ArrowLeft size={20} /> Back
      </button>
    )}
  </div>
);

const JobRow = ({ job, onClick }: { job: Job, onClick: () => void }) => (
  <div 
    onClick={onClick}
    style={{ 
      padding: '0.4rem 0',
      backgroundColor: 'white',
      borderBottom: '1px solid #f8fafc',
      cursor: job.is_active ? 'pointer' : 'default',
      transition: 'opacity 0.1s ease',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '2rem',
      opacity: job.is_active ? 1 : 0.6
    }}
    onMouseEnter={(e) => (e.currentTarget.style.opacity = job.is_active ? '0.7' : '0.6')}
    onMouseLeave={(e) => (e.currentTarget.style.opacity = job.is_active ? '1' : '0.6')}
  >
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.1rem' }}>
        {job.job_title}
        {!job.is_active && (
          <span style={{ marginLeft: '0.6rem', fontSize: '0.6rem', padding: '0.1rem 0.4rem', backgroundColor: '#f1f5f9', color: '#94a3b8', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.025em', fontWeight: 800 }}>Expired</span>
        )}
        {job.is_inventory === 1 && (
          <span style={{ marginLeft: '0.6rem', fontSize: '0.6rem', padding: '0.1rem 0.4rem', backgroundColor: '#f0fdf4', color: '#0ea5e9', border: '1px solid #bae6fd', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.025em', fontWeight: 800 }}>Inventory</span>
        )}
        {job.is_student === 1 && (
          <span style={{ marginLeft: '0.6rem', fontSize: '0.6rem', padding: '0.1rem 0.4rem', backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.025em', fontWeight: 800 }}>Student/Co-op</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
        <span style={{ color: '#0f172a', fontWeight: 600 }}>{job.source}</span>
        {job.department && <span>• {job.department}</span>}
      </div>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexShrink: 0 }}>
      {job.closing_date && (() => {
        const days = daysUntilClose(job.closing_date);
        const urgent = days !== null && days >= 0 && days <= 7;
        return (
          <div style={{ fontSize: '0.75rem', textAlign: 'right', fontWeight: 500, color: urgent ? '#dc2626' : '#94a3b8' }}>
            {urgent ? `${days}d left` : job.closing_date}
          </div>
        );
      })()}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <ChevronRight size={16} style={{ color: '#cbd5e1' }} />
      </div>
    </div>
  </div>
);

const FilterSection = ({ title, children, defaultOpen = true }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', backgroundColor: 'transparent', padding: '0.25rem 0', cursor: 'pointer', marginBottom: isOpen ? '0.35rem' : 0 }}
      >
        <span style={{ fontSize: '0.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.05em' }}>{title}</span>
        {isOpen ? <ChevronUp size={12} color="#0f172a" /> : <ChevronDown size={12} color="#0f172a" />}
      </button>
      {isOpen && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>{children}</div>}
    </div>
  );
};

const FilterButton = ({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    style={{ 
      padding: '0.25rem 0.5rem', 
      borderRadius: '4px', 
      fontSize: '0.65rem', 
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

inject();

function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [currentView, setCurrentView] = useState<View>('home');
  
  // Advanced Filters
  const [minSalary, setMinSalary] = useState<number | null>(null);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [closingSoon, setClosingSoon] = useState(false);
  const [showInventories, setShowInventories] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync state with browser history
  useEffect(() => {
    const handlePopState = (_event: PopStateEvent) => {
      const path = window.location.hash;
      if (path.startsWith('#job/')) {
        const id = path.replace('#job/', '');
        const job = jobs.find(j => j.id === id);
        if (job) setSelectedJob(job);
      } else if (path === '#saved') {
        setCurrentView('saved');
        setSelectedJob(null);
      } else if (path === '#companies') {
        setCurrentView('companies');
        setSelectedJob(null);
      } else if (path === '#jobs') {
        setCurrentView('jobs');
        setSelectedJob(null);
      } else {
        setCurrentView('home');
        setSelectedJob(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    handlePopState({} as PopStateEvent);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [jobs]);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const fetchJobs = () => {
    fetch(`${API}/api/jobs`)
      .then(res => res.json())
      .then(data => {
        const normalized = data.map((j: Job) => ({
          ...j,
          job_title: fixCasing((j.job_title || '')
            .replace(/^Available Position:\s+/i, '')
            .replace(/\(\d+\)\s*$/, '')
            .replace(/\d+$/, '')
            .replace(/ -([A-Z])/, ' - $1')
            .trim()),
          department: (j.department || '')
            .replace(/\(\d+\)/g, '')
            .replace(/\s*[-–—]\s*Job Opportunity.*/i, '')
            .replace(/\s*[-–—].*/, '')
            .replace(/^General$/i, '')
            .trim(),
          closing_date: (j.closing_date || '').replace(/Posted on\s+/i, '').trim(),
          source: j.source === 'WATERFRONT TORONTO' ? 'Waterfront Toronto' : j.source
        }));
        setJobs(normalized);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching jobs:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleNavigate = (view: View) => {
    setCurrentView(view);
    setSelectedJob(null);
    window.history.pushState(null, '', `#${view === 'home' ? '' : view}`);
  };

  const handleSelectJob = (job: Job) => {
    if (!job.is_active) return;
    setSelectedJob(job);
    window.history.pushState({ jobId: job.id }, '', `#job/${job.id}`);
  };

  const handleBackToList = () => {
    setSelectedJob(null);
    window.history.pushState(null, '', `#${currentView === 'home' ? '' : currentView}`);
  };

  const toggleSaveJob = async (job: Job, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`${API}/api/jobs/${job.id}/toggle-save`, { method: 'POST' });
      if (res.ok) {
        const { is_saved } = await res.json();
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, is_saved } : j));
        if (selectedJob?.id === job.id) {
          setSelectedJob(prev => prev ? { ...prev, is_saved } : null);
        }
      }
    } catch (err) {
      console.error('Error toggling save:', err);
    }
  };

  const parseJobDetails = (job: Job) => {
    const desc = job.description || '';
    const cleanDesc = desc.replace(/<[^>]*>?/gm, ' ');

    const extract = (key: string) => {
      const match = cleanDesc.match(new RegExp(`${key}:?\\s*([^\\n\\r]*)`, 'i'));
      let val = match ? match[1]?.trim() : null;
      if (val) {
        val = val.replace(/^[,.\s]+/, '');
        if (key.toLowerCase().includes('salary')) {
           val = val.replace(/Information:?/gi, '').replace(/Job Opportunity/gi, '').trim();
           // Try to extract just the monetary range (e.g. $50,000 to $60,000)
           const moneyMatch = val.match(/\$?\d{2,3},?\d{3}(\.\d{2})?(\s*(to|-|–|and)\s*\$?\d{2,3},?\d{3}(\.\d{2})?)?/i);
           if (moneyMatch) {
               val = moneyMatch[0];
           } else if (val.length > 50) {
               // Fallback if no money format but string is too long
               val = val.substring(0, 50) + '...';
           }
        }
        if (key.toLowerCase().includes('vacancies')) {
           const numMatch = val.match(/\d+/);
           val = numMatch ? numMatch[0] : null; // Only return if numeric
        }
      }
      return val;
    };

    return {
      salary: extract('Salary Scale') || extract('Salary Range') || extract('Salary') || job.salary_range || null,
      mode: normalizeMode(extract('Work Mode') || extract('Employment Type')),
      vacancies: extract('Number of Vacancies') || extract('No. of Vacancies') || extract('Vacancies'),
      reqId: extract('Requisition ID') || extract('Job ID') || extract('Req ID'),
      future: desc.toLowerCase().includes('future requirements') ? 'Eligible for future requirements' : null,
    };
  };

  const filteredJobs = useMemo(() => {
    let pool = jobs;
    if (currentView === 'saved') { pool = jobs.filter(j => j.is_saved); }
    const filtered = pool.filter(job => {
      if (!showInventories && job.is_inventory) return false;
      const matchesSearch = job.job_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           job.source.toLowerCase().includes(searchTerm.toLowerCase());
      const details = parseJobDetails(job);
      const matchesMode = selectedModes.length === 0 || (details.mode !== null && selectedModes.includes(details.mode));
      let matchesSalary = true;
      if (minSalary) {
        const salaryNum = parseInt(details.salary?.replace(/[$,]/g, '') || '0');
        matchesSalary = salaryNum >= minSalary;
      }
      let matchesDeadline = true;
      if (closingSoon) {
        const days = daysUntilClose(job.closing_date);
        matchesDeadline = days !== null && days >= 0 && days <= 7;
      }
      return matchesSearch && matchesMode && matchesSalary && matchesDeadline;
    });
    return filtered.sort((a, b) => {
      const dA = daysUntilClose(a.closing_date);
      const dB = daysUntilClose(b.closing_date);
      const urgentA = dA !== null && dA >= 0 && dA <= 7;
      const urgentB = dB !== null && dB >= 0 && dB <= 7;
      if (urgentA && !urgentB) return -1;
      if (!urgentA && urgentB) return 1;
      if (urgentA && urgentB) return dA - dB;
      return b.scraped_at.localeCompare(a.scraped_at);
    });
  }, [jobs, searchTerm, selectedModes, minSalary, closingSoon, currentView, showInventories]);

  const recentJobs = useMemo(() => [...jobs].sort((a, b) => b.scraped_at.localeCompare(a.scraped_at)).slice(0, 5), [jobs]);
  const closingSoonJobs = useMemo(() => {
    return jobs
      .filter(j => j.is_active)
      .map(j => ({ job: j, days: daysUntilClose(j.closing_date) }))
      .filter(({ days }) => days !== null && days >= 0 && days <= 7)
      .sort((a, b) => (a.days ?? 999) - (b.days ?? 999))
      .slice(0, 5)
      .map(({ job }) => job);
  }, [jobs]);

  const jobsByCompany = useMemo(() => jobs.reduce((acc, job) => {
    if (!acc[job.source]) acc[job.source] = [];
    acc[job.source].push(job);
    return acc;
  }, {} as Record<string, Job[]>), [jobs]);

  const companies = useMemo(() => Object.keys(jobsByCompany).sort(), [jobsByCompany]);
  const currentJobDetails = useMemo(() => selectedJob ? parseJobDetails(selectedJob) : null, [selectedJob]);

  const reset = () => {
    setSelectedJob(null); setCurrentView('home'); setSearchTerm(''); setSelectedModes([]); setMinSalary(null); setClosingSoon(false); setShowInventories(false); setIsSearchExpanded(false);
    window.history.pushState(null, '', '#');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'white', color: '#0f172a', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Universal Sticky Header */}
      <header style={{ borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 50 }}>
        <div style={{ padding: '2rem 2rem 1.5rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'baseline', position: 'relative' }}>
            <div style={{ display: 'grid', gridAutoFlow: 'column', alignItems: 'baseline', justifyContent: 'start', gap: '3rem' }}>
              <h1 onClick={reset} style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.04em', cursor: 'pointer', lineHeight: 1 }}>GovJobs</h1>
              
              <nav style={{ 
                fontSize: '1rem', 
                fontWeight: 600, 
                color: '#64748b',
                transition: 'opacity 0.2s ease',
                opacity: isSearchExpanded ? 0 : 1,
                visibility: isSearchExpanded ? 'hidden' : 'visible'
              }}>
                <span 
                  onClick={() => handleNavigate('jobs')} 
                  style={{ cursor: 'pointer', color: (currentView === 'jobs' && !selectedJob) ? '#0f172a' : 'inherit', display: 'inline-block', marginRight: '2.5rem' }}
                >
                  Jobs
                </span>
                <span 
                  onClick={() => handleNavigate('companies')} 
                  style={{ cursor: 'pointer', color: (currentView === 'companies' && !selectedJob) ? '#0f172a' : 'inherit', display: 'inline-block' }}
                >
                  Companies
                </span>
              </nav>
            </div>

            <div style={{ display: 'grid', gridAutoFlow: 'column', alignItems: 'baseline', gap: '2.5rem' }}>
              <div style={{ 
                display: 'grid',
                gridAutoFlow: 'column',
                alignItems: 'baseline',
                gap: '2.5rem',
                fontSize: '1rem', 
                fontWeight: 600, 
                color: '#64748b',
                transition: 'opacity 0.2s ease',
                opacity: isSearchExpanded ? 0 : 1,
                visibility: isSearchExpanded ? 'hidden' : 'visible',
                pointerEvents: isSearchExpanded ? 'none' : 'auto'
              }}>
                <span 
                  onClick={() => handleNavigate('saved')} 
                  style={{ cursor: 'pointer', color: (currentView === 'saved' && !selectedJob) ? '#0f172a' : 'inherit' }}
                >
                  Saved
                </span>
                <span 
                  onClick={() => setIsSearchExpanded(true)} 
                  style={{ cursor: 'pointer', display: 'grid', gridAutoFlow: 'column', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Search size={18} style={{ opacity: 0.8 }} />
                  <span>Search</span>
                </span>
              </div>

              {selectedJob && !isSearchExpanded && (
                <ActionGroup job={selectedJob} onToggleSave={(e) => toggleSaveJob(selectedJob, e)} showBack onBack={handleBackToList} />
              )}
            </div>

            {/* Expandable Search Overlay */}
            <div style={{ 
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex', 
              alignItems: 'baseline', 
              gap: '1rem', 
              opacity: isSearchExpanded ? 1 : 0,
              visibility: isSearchExpanded ? 'visible' : 'hidden',
              transform: isSearchExpanded ? 'scaleY(1)' : 'scaleX(0.95)',
              transformOrigin: 'bottom right',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              backgroundColor: 'white',
              zIndex: 60
            }}>
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'baseline' }}>
                <Search size={24} style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Search positions, companies..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setIsSearchExpanded(false)}
                  style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', border: 'none', borderBottom: '2px solid #0f172a', outline: 'none', fontSize: '1.5rem', fontWeight: 500, color: '#0f172a', backgroundColor: 'white' }}
                />
              </div>
              <button onClick={() => { setSearchTerm(''); setIsSearchExpanded(false); }} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: '#64748b' }}>
                <X size={24} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {selectedJob ? (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '4rem', alignItems: 'start' }}>
            {/* Sidebar Metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '80px' }}>
              {selectedJob.closing_date && (
                <div style={{ backgroundColor: '#fef2f2', padding: '1rem', borderRadius: '12px', border: '1px solid #fee2e2' }}>
                  <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.2rem' }}>Apply By</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 900, color: '#b91c1c' }}>{selectedJob.closing_date}</div>
                </div>
              )}

              <div style={{ backgroundColor: 'white', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { label: 'Department', val: selectedJob.department, icon: Building },
                  { label: 'Location', val: selectedJob.location, icon: MapPin },
                  { label: 'Salary', val: currentJobDetails?.salary, icon: DollarSign },
                  { label: 'Work Mode', val: currentJobDetails?.mode, icon: Globe },
                  { label: 'Vacancies', val: currentJobDetails?.vacancies, icon: Users },
                  { label: 'Req ID', val: currentJobDetails?.reqId, icon: Info },
                  { label: 'Eligibility', val: currentJobDetails?.future, icon: Zap, highlight: true }
                ].filter(i => i.val).map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: '0.55rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.15rem' }}>{item.label}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', color: item.highlight ? '#9a3412' : '#1e293b' }}>
                      {item.val}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ backgroundColor: 'white', padding: '0', borderRadius: '0' }}>
                <div style={{ color: '#2563eb', fontSize: '0.8125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{selectedJob.source}</div>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: '0 0 2rem 0', letterSpacing: '-0.04em', lineHeight: 1.1 }}>{selectedJob.job_title}</h1>

                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '2rem' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.025em' }}>Full Description</div>
                  <div 
                    style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#64748b' }}
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedJob.description) }}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      ) : (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', width: '100%', boxSizing: 'border-box', flex: 1 }}>
          {currentView === 'home' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem' }}>
              <section>
                <div style={{ marginBottom: '2rem' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Most Recent Postings</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {recentJobs.map(job => <JobRow key={job.id} job={job} onClick={() => handleSelectJob(job)} />)}
                </div>
                <button onClick={() => handleNavigate('jobs')} style={{ marginTop: '2rem', border: 'none', backgroundColor: 'transparent', color: '#2563eb', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem', padding: 0 }}>View all jobs →</button>
              </section>

              <section>
                <div style={{ marginBottom: '2rem' }}>
                   <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.03em' }}>Closing Soon</h2>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {closingSoonJobs.map(job => <JobRow key={job.id} job={job} onClick={() => handleSelectJob(job)} />)}
                </div>
              </section>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '4rem' }}>
              <aside style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: '#0f172a' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filters</span>
                </div>
                <FilterSection title="Salary Min">{[50000, 75000, 100000, 125000].map(val => (<FilterButton key={val} label={`$${val/1000}k+`} active={minSalary === val} onClick={() => setMinSalary(minSalary === val ? null : val)} />))}</FilterSection>
                <FilterSection title="Work Mode">{['In-person', 'Hybrid', 'Remote'].map(mode => (<FilterButton key={mode} label={mode} active={selectedModes.includes(mode)} onClick={() => setSelectedModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode])} />))}</FilterSection>
                <FilterSection title="Deadline"><FilterButton label="Closing soon" active={closingSoon} onClick={() => setClosingSoon(!closingSoon)} /></FilterSection>
                <FilterSection title="Job Type"><FilterButton label="Ongoing/Inventory" active={showInventories} onClick={() => setShowInventories(!showInventories)} /></FilterSection>
                <div style={{ marginTop: '1.5rem' }}><button onClick={() => {reset(); setShowInventories(false);}} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: 'transparent', color: '#64748b', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>Reset filters</button></div>
              </aside>

              <div style={{ minWidth: 0 }}>
                <div style={{ marginBottom: '1rem', fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {currentView === 'companies' ? `${companies.length} hiring companies` : (searchTerm || selectedModes.length > 0 || minSalary || closingSoon ? `${filteredJobs.length} matches found` : `${filteredJobs.length} jobs available`)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {(currentView === 'jobs' || currentView === 'saved') ? (
                    filteredJobs.map(job => <JobRow key={job.id} job={job} onClick={() => handleSelectJob(job)} />)
                  ) : (
                    companies.map(name => (
                      <div key={name} onClick={() => {setMinSalary(null); setSelectedModes([]); setClosingSoon(false); setSearchTerm(name); handleNavigate('jobs'); }} style={{ padding: '0.6rem 0', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700 }}>{name}</span>
                        <span style={{ fontSize: '0.8125rem', color: '#2563eb', fontWeight: 700 }}>{jobsByCompany[name].length} positions</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
