import { browser, element, by, Key, WebDriver, ElementFinder, WebElement } from 'protractor'
import * as environment from '../data/environment.json'
import { } from 'jasmine'
import { protractor } from 'protractor/built/ptor';

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
    element.all(by.tagName('div')).then(function (arr){console.log(arr.length)});

    //let count = element.all(by.tagName('div')).then(function (arr){return (arr.length)});
    //console.log("div count is "+count);

   /*
    element.all(by.tagName('div')).filter(function(elem, index) {
        return elem.isDisplayed().then(function(text) {
          return text == true;
        });
      }).first().getLocation();*/

   browser.driver.actions().mouseMove(element.all(by.tagName('div')).filter(function(elem, index) {
    return elem.isDisplayed().then(function(text) {
      return text == true;
    });
  }).first()).perform();

  browser.driver.actions().mouseMove(element.all(by.tagName('div')).filter(function(elem, index) {
    return elem.isDisplayed().then(function(text) {
      return text == true;
    });
  }).first()).click(protractor.Button.RIGHT);



      //console.log("div all visible"+count);
   
  
}