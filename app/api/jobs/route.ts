import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword') || process.env.SEARCH_STACK || 'Software Engineer';
  const location = searchParams.get('location') || process.env.SEARCH_LOCATION || 'Remote';

  try {
    const isLocal = process.env.NODE_ENV === 'development' || !!process.env.NEXT_PUBLIC_IS_LOCAL;
    
    const { addExtra } = await import('puppeteer-extra');
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    
    let browser;
    if (isLocal) {
      console.log("🚀 [API] Launching local browser...");
      const puppeteer = (await import('puppeteer')).default;
      const puppeteerExtra = addExtra(puppeteer);
      puppeteerExtra.use(StealthPlugin());
      
      browser = await puppeteerExtra.launch({
        headless: false, // Changed to false so you can see it!
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      });
    } else {
      console.log("🚀 [API] Launching Vercel serverless browser...");
      const puppeteerCore = (await import('puppeteer-core')).default;
      const puppeteerExtra = addExtra(puppeteerCore);
      puppeteerExtra.use(StealthPlugin());
      
      browser = await puppeteerExtra.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    }
    
    console.log("📄 [API] Opening new page...");
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Clean up keywords for the vanity URL path
    const safeKeyword = keyword.trim().replace(/[^a-zA-Z0-9-]/g, ' ').replace(/\s+/g, '-').toLowerCase();
    
    let vanityPath = `${safeKeyword}-jobs`;
    if (location && location.trim() !== '') {
      const safeLocation = location.trim().replace(/[^a-zA-Z0-9-]/g, ' ').replace(/\s+/g, '-').toLowerCase();
      vanityPath += `-in-${safeLocation}`;
    }
    
    // Construct robust query parameters just like Naukri does natively
    const params = new URLSearchParams();
    params.append('k', keyword.trim());
    if (location && location.trim() !== '') {
      params.append('l', location.trim());
    }
    
    // Add User's Ultimate Filters
    params.append('experience', '3');
    params.append('glbl_qcrc', '1028');
    params.append('industryTypeIdGid', '109');
    
    const searchUrl = `https://www.naukri.com/${vanityPath}?${params.toString()}`;
    console.log(`🌐 [API] Navigating to: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    console.log(`✅ [API] Page loaded! Current URL is: ${page.url()}`);
    
    // Wait for React to finish rendering the jobs
    console.log("⏳ [API] Waiting for job listings to render (.srp-jobtuple-wrapper)...");
    try {
      await page.waitForSelector('.srp-jobtuple-wrapper', { timeout: 15000 });
      console.log("✅ [API] Job listings found on the page!");
    } catch (e) {
      console.log('⚠️ [API] Timeout waiting for job wrappers! Naukri might have blocked the bot, or the selector changed.');
    }
    
    console.log("🔍 [API] Extracting job data...");
    const jobs = await page.evaluate(() => {
      const jobCards = Array.from(document.querySelectorAll('.srp-jobtuple-wrapper'));
      return jobCards.map(card => {
        const titleEl = card.querySelector('.title') as HTMLElement;
        const companyEl = card.querySelector('.comp-name') as HTMLElement;
        const locationEl = card.querySelector('.loc-wrap') as HTMLElement;
        const expEl = card.querySelector('.exp-wrap') as HTMLElement;
        const dateEl = card.querySelector('.job-post-day') as HTMLElement;
        
        return {
          id: card.getAttribute('data-job-id') || Math.random().toString(),
          title: titleEl?.innerText?.trim() || 'Unknown Title',
          company: companyEl?.innerText?.trim() || 'Unknown Company',
          location: locationEl?.innerText?.trim() || 'Unknown Location',
          experience: expEl?.innerText?.trim() || 'N/A',
          posted: dateEl?.innerText?.trim() || 'N/A',
          url: titleEl?.getAttribute('href') || '#',
        };
      }).filter(job => job.url !== '#');
    });

    await browser.close();

    return NextResponse.json({ jobs });
  } catch (error: any) {
    console.error("Puppeteer search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
