const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('naukri.html', 'utf8');
const $ = cheerio.load(html);

// Find the job tuple wrapper. Commonly it's an article tag or a div with specific classes.
const srpWrappers = $('.srp-jobtuple-wrapper');
if (srpWrappers.length > 0) {
    console.log('Found .srp-jobtuple-wrapper:', srpWrappers.length);
    console.log('Title text:', $(srpWrappers[0]).find('.title').text());
} else {
    // If it's not .srp-jobtuple-wrapper, let's look for article tags or common wrapper classes
    const articles = $('article');
    console.log('Found <article> tags:', articles.length);
    
    // Look for divs containing the word "job" in their class
    const divs = $('div[class*="jobTuple"]');
    console.log('Found divs with jobTuple:', divs.length);
    
    // Look for anchor tags that link to job pages
    const anchors = $('a[href*="/job-listings-"]');
    console.log('Found job links:', anchors.length);
    if(anchors.length > 0) {
        // Log the parent structure of the first job link
        const parent = $(anchors[0]).parents().eq(2);
        console.log('Parent classes of a job link:', parent.attr('class'));
    }
}
