export const renderMarkdown = (md: string): string => {
  if (!md) return '';
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{1,2}\s+(.+)$/gm, '<h3 style="font-size:1rem;font-weight:800;margin:1.5em 0 0.4em;color:#0f172a">$1</h3>')
    .replace(/^#{3,}\s+(.+)$/gm, '<h4 style="font-size:0.875rem;font-weight:700;margin:1em 0 0.3em;color:#1e293b">$1</h4>')
    .replace(/^[-•]\s+(.+)$/gm, '<li style="margin:0.2em 0">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>)(\s*<li)/g, '$1$2')
    .replace(/((?:<li[^>]*>.*<\/li>\s*)+)/g, '<ul style="padding-left:1.25em;margin:0.5em 0">$1</ul>')
    .replace(/\n{2,}/g, '</p><p style="margin:0.75em 0">')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[hup])/, '<p style="margin:0">')
    .replace(/(?<![>])$/, '</p>');
};

export const formatSalary = (job: { salary_min: number | null; salary_max: number | null; salary_period: string | null }): string | null => {
  const { salary_min: min, salary_max: max, salary_period: period } = job;
  if (!min && !max) return null;
  const fmt = (n: number) => period === 'hourly' ? `$${n}/hr` : `$${Math.round(n / 1000)}K`;
  const periodLabel = period === 'hourly' ? '' : period === 'monthly' ? ' / mo' : ' / yr';
  if (min && max) return `${fmt(min)} – ${fmt(max)}${periodLabel}`;
  return `${fmt((min ?? max)!)}${periodLabel}`;
};

export const daysUntilClose = (dateStr: string): number | null => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const fixCasing = (s: string): string => {
  if (!s) return s;
  const cleaned = s.replace(/\s+/g, ' ').trim();
  if (cleaned === cleaned.toUpperCase()) {
    return cleaned.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  return cleaned;
};
