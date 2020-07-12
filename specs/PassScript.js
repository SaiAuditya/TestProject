"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
exports.__esModule = true;
var protractor_1 = require("protractor");
var environment = __importStar(require("../data/environment.json"));
describe('sanity', function () {
    it('expected to open google and pass', function () {
        protractor_1.browser.ignoreSynchronization = true;
        var url = environment[0].url;
        var title = environment[0].title;
        console.log('at the end the title coming from json ' + title);
        protractor_1.browser.get(url, 100000).then(function () { return console.log('browserOPened'); }).then(function () {
            protractor_1.browser.getTitle().then(function (title) { return console.log(title); });
        });
        protractor_1.element(protractor_1.by.name('q')).sendKeys('ConsolidatedChaos').then();
        protractor_1.element(protractor_1.by.name('q')).sendKeys(protractor_1.Key.ENTER).then(function () {
            var elements = protractor_1.element.all(protractor_1.by.tagName('a'));
            elements.map(function (eleme) {
                return eleme.getAttribute('href');
            }).then(function (allTexts) {
                console.log(allTexts);
            });
            protractor_1.browser.driver.findElements(protractor_1.by.tagName('a')).then(function (elements) {
                console.log("Length of the elemtns " + elements.length);
            });
        });
    });
});
//# sourceMappingURL=PassScript.js.map