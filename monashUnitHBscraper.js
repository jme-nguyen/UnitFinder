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

    const offeringContainer = await page.$(offeringsSelector);
    const assessmentContainer = await page.$(assessmentSelector);

    // Scrape offerings for the unit
    const offeringsData = await offeringContainer.evaluate((container) => {

        const results = [];
        
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
    });

    const assessmentData = await assessmentContainer.evaluate((container) => {
        
        const results = [];

        // Find all accordion items within this specific container
        const accordionItems = container.querySelectorAll('.AccordionItem');

        accordionItems.forEach(item => {
            // Get the assessment name from the h4 heading
            const heading = item.querySelector('h4');
            const assessmentName = heading ? heading.textContent.trim() : '';
      
            // Get the value percentage from the accordion body
            const accordionBody = item.querySelector('[class*="SAccordionContentContainer"]');
            let valuePercent = '';

            if (accordionBody) {
                const cardBodies = accordionBody.querySelectorAll('[class*="CardBody"]');

                cardBodies.forEach(cardBody => {
                    const text = cardBody.textContent.trim();

                    if (text.startsWith('Value %:')){
                        valuePercent = text.replace('Value %:', '').trim();
                    }
                });
            }
            if (assessmentName) {
                results.push({
                    name: assessmentName,
                    valuePercent: valuePercent || 'N/A'
                });
            }
        });
        return results;
    })

    await browser.close();
    // console.log(offeringsData);
    console.log(assessmentData)
    return offeringsData;
}

scrapeUnit();