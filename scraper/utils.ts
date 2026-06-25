import { createHash } from 'crypto';
import { Page, BrowserContext } from 'playwright';
import { Client } from '@libsql/client';
import { saveRawJob } from './db';

export function urlId(url: string): string {
  return createHash('sha256').update(url).digest('hex').substring(0, 12);
}

export interface JobSummary {
  id: string;
  title: string;
  url: string;
  department?: string;
  location?: string;
  closingDate?: string;
  salary?: string;
}

export const BASE_CONFIG = {
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 800 }
};

// Handles interstitial "Leaving GC Jobs" warning pages or similar redirects recursively.
export async function handleRedirections(page: Page, depth = 0): Promise<boolean> {
  if (depth > 3) return false;

  const bodyText = await page.textContent('body');

  if (bodyText?.includes('Sign in with your GCKey') || bodyText?.includes('GCKey login')) {
    console.warn(`   ⚠️ [Login] Required for: ${page.url()}`);
    return false;
  }

  const isWarningPage = bodyText?.includes('leave the GC Jobs') ||
                        bodyText?.includes('quitter le site') ||
                        bodyText?.includes('Leaving an External Site') ||
                        page.url().includes('page2440');

  if (isWarningPage) {
    const externalLink = await page.$$eval('main a, #content a, .center-block a, .external-link a', as => {
      return as.filter(a => {
        const href = (a as HTMLAnchorElement).href;
        return href.startsWith('http') &&
               !href.includes('cfp-psc.gc.ca') &&
               !href.includes('#') &&
               !href.includes('mailto');
      }).map(a => (a as HTMLAnchorElement).href);
    });

    if (externalLink.length > 0 && externalLink[0]) {
      console.log(`   [Redirect Lvl ${depth + 1}] ${externalLink[0].substring(0, 50)}...`);
      await page.goto(externalLink[0], { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(5000);
      return await handleRedirections(page, depth + 1);
    }
  }
  return depth > 0;
}

export async function scrapeRawAndStage(db: Client, context: BrowserContext, job: JobSummary, sourceName: string) {
  const page = await context.newPage();
  try {
    await page.goto(job.url, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(3000);

    await handleRedirections(page);
    await page.waitForSelector('body', { timeout: 10000 });

    const rawText = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      const noise = 'script, style, link, meta, noscript, .wb-share, #wb-dtmd, .socialMediaButtons, .page-options, nav, footer, header, #header, #footer';
      clone.querySelectorAll(noise).forEach(e => e.remove());
      return clone.innerText?.trim() || '';
    });

    if (!rawText || rawText.length < 100) return;

    await saveRawJob(db, { id: job.id!, url: job.url, source: sourceName, raw_text: rawText });
    process.stdout.write(' ✅');
  } catch (err: any) {
    console.warn(`\n   ⚠️  [${sourceName}] Failed ${job.url}: ${err.message}`);
  } finally {
    await page.close();
  }
}
