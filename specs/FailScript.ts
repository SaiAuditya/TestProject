import {browser, element, by, Key} from 'protractor'
import * as environment from '../data/environment.json'
import {} from 'jasmine'

    describe('testcase', ()=>
    {
        it('expected to open Infosys Site and faile', ()=>
        {
            browser.ignoreSynchronization=true;
            //browser.manage().timeouts().pageLoadTimeout(180000);
            let url = environment[1].url
            let title = environment[1].title

            
            console.log('at the end the title coming from json '+title)
            browser.get(url,100000).then(()=>console.log('browserOPened')).then(
                ()=>
                {
                    browser.getTitle().then((title:string)=>console.log(title));
                }
            ).then ( ()=>
            {
                element(by.name('q')).sendKeys('ConsolidatedChaos').then( ()=>
                {
                    
        });
        }
        )
    });

})
