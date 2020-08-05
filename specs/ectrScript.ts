import { browser, element, by, protractor, $, ExpectedConditions, until, Builder } from 'protractor'
import { } from 'jasmine'

describe('Login', () => {
    it('Username & Password Check', () => {
        browser.ignoreSynchronization = true;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000;
        browser.driver.manage().timeouts().implicitlyWait(120000);
        browser.driver.manage().timeouts().pageLoadTimeout(180000);
        login_enteropt().then(()=>{console.log('Test Complete')});
    })
});

async function sleep(ms:any) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

async function login_enteropt() {

   
    //this is it
    console.log('here before ')
    try{
    await browser.driver.get('https://google.com');
    await browser.driver.navigate().to('###################');
    await browser.driver.findElement(by.id('i0116')).sendKeys('gokulnath.murali@technipfmc.com');
    await browser.driver.findElement(by.id('idSIButton9')).click();
    await browser.driver.findElement(by.id('password')).sendKeys('Houstonuk2020');
    await browser.driver.findElement(by.linkText('Sign On')).click();
    await browser.sleep(30000);
    //await browser.driver.navigate().to("#################");
    //await browser.sleep(10000);
    }catch(ex)
    {
        console.log('Clicked but some error');
    }
    console.log('here after')
    //var EC = protractor.ExpectedConditions  
    //await browser.driver.wait(EC.elementToBeClickable(browser.driver.findElement(by.css('.primary'))),100000);
    let enabled = await (await browser.driver.findElement(by.css(".primary"))).isEnabled()
    console.log('waiting');
    while(!enabled)
    {
        enabled = await (await browser.driver.findElement(by.css(".primary"))).isEnabled()
        await browser.sleep(1000);
        console.log('waiting..');
    }
    await logincheckAuthendicatiom();

}

async function logincheckAuthendicatiom() {
    //await sleep(60000);
    try{
    console.log('after sleep');
    let enabled = await (await browser.driver.findElement(by.css(".primary"))).isDisplayed();
    console.log(enabled);
    }catch(ex)
    {
        console.log('some error');
    }

}