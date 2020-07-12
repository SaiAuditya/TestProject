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
describe('testcase', function () {
    it('expected to open Infosys Site and faile', function () {
        protractor_1.browser.ignoreSynchronization = true;
        var url = environment[1].url;
        var title = environment[1].title;
        console.log('at the end the title coming from json ' + title);
        protractor_1.browser.get(url, 100000).then(function () { return console.log('browserOPened'); }).then(function () {
            protractor_1.browser.getTitle().then(function (title) { return console.log(title); });
        }).then(function () {
            protractor_1.element(protractor_1.by.name('q')).sendKeys('ConsolidatedChaos').then(function () {
            });
        });
    });
});
//# sourceMappingURL=FailScript.js.map