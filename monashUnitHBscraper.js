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
    const requisiteSelector = 'div[data-menu-title="Requisites"]';

    await page.waitForSelector(assessmentSelector);

    const offeringContainer = await page.$(offeringsSelector);
    const assessmentContainer = await page.$(assessmentSelector);
    const requisiteContainer = await page.$(requisiteSelector);

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

    // Scrape assessment breakdown for the unit
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

    const requisiteData = await requisiteContainer.evaluate((container) => {

        const results = [];

        // Find all accordion items within this specific container
        const accordionItems = container.querySelectorAll('.AccordionItem');

        accordionItems.forEach(item => {
            // Get the requisite type from the h4 heading
            const heading = item.querySelector('h4');
            const requisiteType = heading ? heading.textContent.trim() : '';
      
            // Get the accordion body content
            const accordionBody = item.querySelector('[class*="SAccordionContentContainer"]');

            if (accordionBody && requisiteType) {
                // Get clean raw text by removing arrow icons and cleaning up spacing
                let rawText = accordionBody.textContent;
                rawText = rawText.replace(/arrow_forward/g, '').replace(/OR/g, ' OR ').replace(/AND/g, ' AND ').replace(/\d\sCP/g, ' ').trim();

                // Extract all unit links
                const unitLinks = accordionBody.querySelectorAll('a[class*="StyledAILink"]');
                const units = [];

                unitLinks.forEach(link => {
                    const code = link.querySelector('.section1')?.textContent.trim() || '';
                    const title = link.querySelector('.unit-title')?.textContent.trim() || '';

                    if (code) {
                        units.push({
                            code: code,
                            title: title
                        });
                    }
                });

                // Extract operators (AND/OR) in order
                const operators = [];

                const allElements = accordionBody.querySelectorAll('*');

                allElements.forEach(element => {
                    // Check for OR badges
                    if (element.classList.contains('css-1kgzoyn-Pill--Pill-Pill-Badge--Badge') && element.textContent.trim() === 'OR') {
                        operators.push('OR');
                    }
                    else if (element.classList.contains('css-1k1m1hg-Connector--SConnector') && element.textContent.trim() === 'AND') {
                        operators.push('AND');
                    }
                    else if (element.classList.contains('css-kfdxhd-RequisiteRelationshipList--OperatorWrapper')){
                        const andBadge = element.querySelector('.css-1kgzoyn-Pill--Pill-Pill-Badge--Badge');
                        if (andBadge && andBadge.textContent.trim() === 'AND'){
                            operators.push('AND');
                        }
                    }
                })

                results.push({
                    type: requisiteType,
                    units: units,
                    operators: operators,
                    rawText: rawText
                });
            }
        });

        return results;
    });

    await browser.close();

    const unitInfo = {
        requisite: requisiteData,
        offerings: offeringsData,
        assessments: assessmentData
    }
    
    return unitInfo;
}

scrapeUnit()
    .then(data => {
        console.log('Requisite data:', JSON.stringify(data,null,2));
    })
    .catch(error => {
        console.error('Error: ', error);
    });