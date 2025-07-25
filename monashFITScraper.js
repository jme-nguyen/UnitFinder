import puppeteer from "puppeteer";

const scrapeData = async () => {

    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
    });

    const page = await browser.newPage();

    await page.goto("https://handbook.monash.edu/browse/By%20Faculty/FacultyofInformationTechnology");

    // const delay = ms => new Promise(res => setTimeout(res, ms));
    
    // await delay(2000);

    const unitNavSelector = 'nav[aria-labelledby="subject"]';

    await page.waitForSelector(unitNavSelector);

    const extractUnits = async () => {
        return await page.evaluate(() => {
            const units = [];
            
            // Select all unit links
            const unitLinks = document.querySelectorAll('a[href*="/units/"]');
            
            unitLinks.forEach(link => {
            // Extract unit code from the header section
            const unitCodeElement = link.querySelector('.StyledAILinkHeaderSection__content1, [class*="StyledAILinkHeaderSection__content1"]');
            const unitCode = unitCodeElement ? unitCodeElement.textContent.trim() : '';
            
            // Extract unit title from the body section
            const unitTitleElement = link.querySelector('.unit-title, [class*="unit-title"]');
            const unitTitle = unitTitleElement ? unitTitleElement.textContent.trim() : '';
            
            // Extract credit points
            const creditElement = link.querySelector('.uoc-text, [class*="uoc-text"]');
            const credits = creditElement ? creditElement.textContent.trim() : '';
            
            if (unitCode) {
                units.push({
                code: unitCode,
                title: unitTitle,
                credits: credits,
                fullName: `${unitCode} - ${unitTitle}`
                });
            }
            });
            
            return units;
        });
    }

    let allUnits = await extractUnits();

    const acceptCookies = '#preferences_prompt_submit'
    await page.click(acceptCookies);

    const nextPageSelector = `${unitNavSelector} #pagination-page-next`;

    const lastButton = async () => {
        return await page.evaluate(() => {
            const buttons = document.querySelectorAll('#pagination-page-next');
            return buttons[buttons.length - 1];
    })}

    const isDisabled = async () => {
        return await page.evaluate(() => {
            const buttonMash = lastButton();
            const button = document.querySelector(buttonMash);
            return button ? button.disabled : true;
        })
    }

    while (!isDisabled()){
        await page.click(nextPageSelector);
        const pageUnits = await extractUnits();
        allUnits = allUnits.concat(pageUnits);
    }

    // await browser.close();

    console.log(allUnits);
    return allUnits;
}

scrapeData();