import { NextResponse } from 'next/server';
import chromium from '@sparticuz/chromium';

export async function POST(request: Request) {
  const { jobUrls } = await request.json();

  if (!jobUrls || jobUrls.length === 0) {
    return NextResponse.json({ error: 'No job URLs provided' }, { status: 400 });
  }

  const email = process.env.NAUKRI_EMAIL;
  const password = process.env.NAUKRI_PASSWORD;

  if (!email || !password) {
    return NextResponse.json({ error: 'Credentials not configured in env' }, { status: 500 });
  }

  try {
    const isLocal = process.env.NODE_ENV === 'development' || !!process.env.NEXT_PUBLIC_IS_LOCAL;
    
    const { addExtra } = await import('puppeteer-extra');
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    
    let browser;
    if (isLocal) {
      const puppeteer = (await import('puppeteer')).default;
      const puppeteerExtra = addExtra(puppeteer);
      puppeteerExtra.use(StealthPlugin());
      
      browser = await puppeteerExtra.launch({
        headless: false, // Keep false locally to observe bot behavior
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
      });
    } else {
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
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

    // 1. Login to Naukri
    await page.goto('https://www.naukri.com/nlogin/login', { waitUntil: 'networkidle2' });
    
    // Type credentials
    await page.type('#usernameField', email, { delay: 50 });
    await page.type('#passwordField', password, { delay: 50 });
    
    // Click login
    await page.click('button[type="submit"]');
    
    // Wait for login to complete
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {
      console.log("Navigation timeout after login, proceeding anyway...");
    });
    
    const results = [];

    // 2. Loop through job URLs and apply
    for (const url of jobUrls) {
      try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        
        // Find and click the apply button
        const applied = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const applyBtn = buttons.find(b => {
             const text = b.innerText.toLowerCase();
             return text.includes('apply') && !text.includes('applied');
          });
          
          if (applyBtn) {
            applyBtn.click();
            return true;
          }
          return false;
        });

        if (applied) {
          console.log(`[API] Clicked apply on ${url}. Running auto-responder for 15 seconds...`);
          
          // Poll from Node.js side to avoid 'Execution context destroyed' errors during navigation
          for (let i = 0; i < 15; i++) {
             await new Promise(r => setTimeout(r, 1000)); 
             
             try {
                 await page.evaluate(() => {
                     const profile = {
                         relocate: true,
                         expectation: '14',
                         ctc: '9.5',
                         company: 'Neosoft',
                         notice: '1 month' 
                     };
        
                     // 1. Fill Text Inputs
                     const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="number"], textarea')) as HTMLInputElement[];
                     for (const input of inputs) {
                         const wrapperText = (input.parentElement?.parentElement?.innerText || '').toLowerCase();
                         const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
                         const context = wrapperText + " " + placeholder;
        
                         if (input.value === '') { 
                             let answered = false;
                             if (context.includes('expectation') || context.includes('expected ctc') || context.includes('expected salary')) {
                                 input.value = profile.expectation; answered = true;
                             } else if (context.includes('current ctc') || context.includes('current salary')) {
                                 input.value = profile.ctc; answered = true;
                             } else if (context.includes('company') || context.includes('employer')) {
                                 input.value = profile.company; answered = true;
                             } else if (context.includes('notice')) {
                                 input.value = profile.notice; answered = true;
                             }
                             if (answered) input.dispatchEvent(new Event('input', { bubbles: true }));
                         }
                     }
        
                     // 2. Click Chat Options / Radio Buttons
                     const optionButtons = Array.from(document.querySelectorAll('button, .option, .radio, .chip, [role="button"]')) as HTMLElement[];
                     const pageText = (document.body.innerText || '').toLowerCase();
                     
                     for (const btn of optionButtons) {
                         const text = (btn.innerText || '').toLowerCase().trim();
                         if (!text) continue;
                         
                         if (text === 'yes' && (pageText.includes('relocate') || pageText.includes('ready to'))) {
                             btn.click();
                         } else if (text.includes('1 month') || text.includes('30 days') || text.includes('serving notice')) {
                             btn.click();
                         } else if (text === 'neosoft') { 
                             btn.click();
                         }
                     }
                     
                     // 3. Submit Answers
                     const submitBtns = Array.from(document.querySelectorAll('button')).filter(b => {
                         const t = b.innerText.toLowerCase().trim();
                         return t === 'submit' || t === 'save' || t === 'send' || t === 'continue' || t === 'save & continue';
                     });
                     for (const b of submitBtns) {
                         if (!b.disabled) b.click();
                     }
                 });
             } catch (err: any) {
                 if (err.message.includes('Execution context was destroyed')) {
                     // The page is navigating to a new URL or reloading, which is normal.
                     // We just ignore the error and the loop will retry on the new page!
                     console.log('Navigation detected, waiting for page to settle...');
                 }
             }
          }
        }

        results.push({ url, status: applied ? 'Applied' : 'Apply button not found / Already applied' });
      } catch (err: any) {
         results.push({ url, status: `Error: ${err.message}` });
      }
    }

    await browser.close();

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Puppeteer apply error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
