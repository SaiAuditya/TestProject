import { browser, element, by, Key, WebDriver, ElementFinder, WebElement, until } from 'protractor'
import * as environment from '../data/environment.json'
import { } from 'jasmine'
import { protractor } from 'protractor/built/ptor';

//To format the code it is Shift + Alt + F

describe('End to end testing', () => {
    it('Test case 1 : to start a browser', () => {
        browser.ignoreSynchronization = true;
        //browser.manage().timeouts().pageLoadTimeout(180000);
        let url = environment[0].url
        let title = environment[0].title
        console.log('at the end the title coming from json ' + title)

        browser.get(url, 100000).then(() => console.log('browserOPened')).then(
            () => {
                browser.getTitle().then((title: string) => console.log(title));
            }
        );
       catpureResult();
});

it('Test case 2 : does the second step', () =>
{
    console.log('second test');
}
)

});

async function EnterText() :Promise<string> {

    try{
    await element(by.name('q')).sendKeys('ConsolidatedChaos');
    await element(by.name('q')).sendKeys(Key.ENTER);
    await element.all(by.tagName('div')).then(function (arr) { console.log(arr.length) });
    var length = (await element.all(by.tagName('div'))).length
    console.log('lenght is '+length);

    await browser.driver.actions().mouseMove(element.all(by.tagName('span')).filter(function (elem, index) {
        return elem.isDisplayed().then(function (text) {
            return text == true;
        });
    }).first()).perform();

    //await browser.driver.wait(until.elementLocated(element(by.tagName('span'))));

    await browser.driver.actions().mouseMove(element.all(by.tagName('span')).filter(function (elem, index) {
        return elem.isDisplayed().then(function (text) {
            return text == true;
        });
    }).first()).click(protractor.Button.RIGHT).perform();

    console.log('waits for above all to complete'); 
    await sleep(2000);
    
}catch(ex)
{
    return ('Failed' +ex);
}finally{
    return ('Function is completed');
}   
}

async function sleep(ms:number) {
 // return new Promise(resolve => setTimeout(resolve, ms));
 return new Promise(resolve=> setTimeout(resolve,ms));
}

async function catpureResult()
{
    var result = EnterText().then((result)=>{return result});
    console.log(result);
}
