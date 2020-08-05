"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var protractor_1 = require("protractor");
describe('Login', function () {
    it('Username & Password Check', function () {
        protractor_1.browser.ignoreSynchronization = true;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 300000;
        protractor_1.browser.driver.manage().timeouts().implicitlyWait(120000);
        protractor_1.browser.driver.manage().timeouts().pageLoadTimeout(180000);
        login_enteropt().then(function () { console.log('Test Complete'); });
    });
});
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2, new Promise(function (resolve) { return setTimeout(resolve, ms); })];
        });
    });
}
function login_enteropt() {
    return __awaiter(this, void 0, void 0, function () {
        var ex_1, enabled;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('here before ');
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 9, , 10]);
                    return [4, protractor_1.browser.driver.get('https://google.com')];
                case 2:
                    _a.sent();
                    return [4, protractor_1.browser.driver.navigate().to('https://ectrweb-qa.azurewebsites.net/')];
                case 3:
                    _a.sent();
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.id('i0116')).sendKeys('gokulnath.murali@technipfmc.com')];
                case 4:
                    _a.sent();
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.id('idSIButton9')).click()];
                case 5:
                    _a.sent();
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.id('password')).sendKeys('Houstonuk2020')];
                case 6:
                    _a.sent();
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.linkText('Sign On')).click()];
                case 7:
                    _a.sent();
                    return [4, protractor_1.browser.sleep(30000)];
                case 8:
                    _a.sent();
                    return [3, 10];
                case 9:
                    ex_1 = _a.sent();
                    console.log('Clicked but some error');
                    return [3, 10];
                case 10:
                    console.log('here after');
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.css(".primary"))];
                case 11: return [4, (_a.sent()).isEnabled()];
                case 12:
                    enabled = _a.sent();
                    console.log('waiting');
                    _a.label = 13;
                case 13:
                    if (!!enabled) return [3, 17];
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.css(".primary"))];
                case 14: return [4, (_a.sent()).isEnabled()];
                case 15:
                    enabled = _a.sent();
                    return [4, protractor_1.browser.sleep(1000)];
                case 16:
                    _a.sent();
                    console.log('waiting..');
                    return [3, 13];
                case 17: return [4, logincheckAuthendicatiom()];
                case 18:
                    _a.sent();
                    return [2];
            }
        });
    });
}
function logincheckAuthendicatiom() {
    return __awaiter(this, void 0, void 0, function () {
        var enabled, ex_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    console.log('after sleep');
                    return [4, protractor_1.browser.driver.findElement(protractor_1.by.css(".primary"))];
                case 1: return [4, (_a.sent()).isDisplayed()];
                case 2:
                    enabled = _a.sent();
                    console.log(enabled);
                    return [3, 4];
                case 3:
                    ex_2 = _a.sent();
                    console.log('some error');
                    return [3, 4];
                case 4: return [2];
            }
        });
    });
}
//# sourceMappingURL=ectrScript.js.map