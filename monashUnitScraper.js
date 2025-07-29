import puppeteer from "puppeteer";

const scrapeUnit = async () => {

    const browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.goto("https://handbook.monash.edu/2025/units/LAW1111?year=2025");

    const offeringsSelector = 'div[data-menu-title="Offerings"]';
    const assessmentSelector = 'div[data-menu-title="Assessment"]';
    const requisiteSelector = 'div[data-menu-title="Requisites"]';
    const sidebarSelector = 'div[data-testid="attributes-table"]'

    await page.waitForSelector(assessmentSelector);

    const offeringContainer = await page.$(offeringsSelector);
    const assessmentContainer = await page.$(assessmentSelector);
    const requisiteContainer = await page.$(requisiteSelector);
    const sidebarContainer = await page.$(sidebarSelector);

    // Scrape offerings for the unit
    const offeringsData = offeringContainer ? await offeringContainer.evaluate((container) => {

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
    }) : [];

    // Scrape assessment breakdown for the unit
    const assessmentData = assessmentContainer ? await assessmentContainer.evaluate((container) => {
        
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
    }) : [];

    const requisiteData = requisiteContainer ? await requisiteContainer.evaluate((container) => {

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
    }) : [];

    const sidebarData = sidebarContainer ? await sidebarContainer.evaluate((container) => {
        const result = {};

        // Find all attribute containers within this specific container
        const attributeContainers = container.querySelectorAll('[class*="AttrContainer"]');

        attributeContainers.forEach(attrContainer => {
            //Get the attribute header (label)
            const header = attrContainer.querySelector('[class*="AttrHeader"]');
            const headerText = header ? header.textContent.trim() : '';

            // Get the attribute body (value)
            const body = attrContainer.querySelector('[data-testid="AttrBody"]');
            let bodyText = '';

            if (body) {
                // First try to get text from the flex container
                const flexDiv = body.querySelector('[class*="Flex--Flex"]');
                if (flexDiv) {
                    bodyText = flexDiv.textContent.trim();
                }

                // If no text in flex div, check for links
                if (!bodyText) {
                    const link = body.querySelector('a');
                    if (link) {
                        bodyText = link.textContent.trim();
                    }
                }

                if (!bodyText) {
                    bodyText = body.textContent.trim();
                }
            }

            if (headerText.includes('Faculty:')) {
                result.faculty = bodyText;
            } else if (headerText.includes('Study level:')) {
                result.studyLevel = bodyText;
            } else if (headerText.includes('Credit points:')) {
                result.creditPoints = bodyText;
            } else if (headerText.includes('Open to exchange or study abroad students?')) {
                result.openToExchange = bodyText;
            }
        });

        return result;
    }) : {};

    await browser.close();

    const unitInfo = {
        attributes: sidebarData,
        requisite: requisiteData,
        offerings: offeringsData,
        assessments: assessmentData
    }
    return unitInfo;
}

scrapeUnit()
    .then(data => {
        console.log('Scraped Data:', JSON.stringify(data,null,2));
    })
    .catch(error => {
        console.error('Error: ', error);
    });