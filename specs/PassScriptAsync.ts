import { browser, element, by, Key, WebDriver, ElementFinder, WebElement } from 'protractor'
import * as environment from '../data/environment.json'
import { } from 'jasmine'

describe('sanity', () => {
    it('expected to open google and pass', () => {
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
        EnterText();
});
});

async function EnterText()
{
    await element(by.name('q')).sendKeys('ConsolidatedChaos');
    await element(by.name('q')).sendKeys(Key.ENTER);
    let count = element.all(by.tagName('div')).count();
    console.log("div all "+count);
    let count2 = element.all(by.tagName('div')).filter(element=>element.isDisplayed()).count();
    console.log("div which is visible "+count2)

    //element.all(by.tagName('a')).getAttribute('href').then(allText=>
    //{
      //  console.log(allText);
    //}
   // )
  
}