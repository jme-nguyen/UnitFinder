import puppeteer from "puppeteer";

const scrapeUnit = async () => {

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.goto("https://handbook.monash.edu/2025/units/FIT3080?year=2025");

    const offeringsSelector = 'div[data-menu-title="Offerings"]';
    const assessmentSelector = 'div[data-menu-title="Assessment"]';

    await page.waitForSelector(offeringsSelector);
    const el = await page.$(offeringsSelector);

    // const text = await el.evaluate(e => e.innerHTML);

    console.log(text);

    const offeringsData = await page.evaluate((selector) => {

        const results = [];

        const container = document.querySelector(selector)
        
        // Find all accordion items within container
        const accordionItems = container.querySelectorAll('.AccordionItem');

        accordionItems.forEach(item => {
            // Get the heading (course code)
            const heading = item.querySelector('h4');
            const courseCode = heading ? heading.textContent.trim() : '';
      
            // Get the accordion body content
            const accordionBody = item.querySelector('[class*="SAccordionContentContainer"]');
      
            if (accordionBody) {
                const cardBodies = accordionBody.querySelectorAll('[class*="CardBody"]');
        
                let location = '';
                let teachingPeriod = '';
                let attendanceMode = '';
        
                cardBodies.forEach(cardBody => {
                    const text = cardBody.textContent.trim();

                    if (text.startsWith('Location:')) {
                        location = text.replace('Location:', '').trim();
                    } else if (text.startsWith('Teaching period:')) {
                        teachingPeriod = text.replace('Teaching period:', '').trim();
                    } else if (text.startsWith('Attendance mode:')) {
                        attendanceMode = text.replace('Attendance mode:', '').trim();
                    }
                });
                results.push({
                    courseCode,
                    location,
                    teachingPeriod,
                    attendanceMode
                    });
            }
        })
        return results;
    }, offeringsSelector);

    await browser.close();
    console.log(offeringsData);
    return offeringsData;
}

scrapeUnit();