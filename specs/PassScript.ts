import { browser, element, by, Key, WebDriver } from 'protractor'
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
        element(by.name('q')).sendKeys('ConsolidatedChaos').then();
        element(by.name('q')).sendKeys(Key.ENTER).then(
            () => {
                let elements = element.all(by.tagName('a'));
                elements.map((eleme) => {
                    return eleme.getAttribute('href');
                }).then((allTexts) => {
                    console.log(allTexts);
                }
                );

                //for angular we can use directly browser//
                //for non angular we need to use browser.driver//
                 browser.driver.findElements(by.tagName('a')).then( (elements)=>
                 {
                     console.log("Length of the elemtns "+elements.length);
                 }
                )
            }
        );

    })
});