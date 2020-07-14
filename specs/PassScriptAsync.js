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
var ptor_1 = require("protractor/built/ptor");
describe('sanity', function () {
    it('expected to open google and pass', function () {
        protractor_1.browser.ignoreSynchronization = true;
        var url = environment[0].url;
        var title = environment[0].title;
        console.log('at the end the title coming from json ' + title);
        protractor_1.browser.get(url, 100000).then(function () { return console.log('browserOPened'); }).then(function () {
            protractor_1.browser.getTitle().then(function (title) { return console.log(title); });
        });
        EnterText();
    });
});
function EnterText() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4, protractor_1.element(protractor_1.by.name('q')).sendKeys('ConsolidatedChaos')];
                case 1:
                    _a.sent();
                    return [4, protractor_1.element(protractor_1.by.name('q')).sendKeys(protractor_1.Key.ENTER)];
                case 2:
                    _a.sent();
                    return [4, protractor_1.element.all(protractor_1.by.tagName('div')).then(function (arr) { console.log(arr.length); })];
                case 3:
                    _a.sent();
                    return [4, protractor_1.browser.driver.actions().mouseMove(protractor_1.element.all(protractor_1.by.tagName('span')).filter(function (elem, index) {
                            return elem.isDisplayed().then(function (text) {
                                return text == true;
                            });
                        }).first()).perform()];
                case 4:
                    _a.sent();
                    return [4, protractor_1.browser.driver.actions().mouseMove(protractor_1.element.all(protractor_1.by.tagName('span')).filter(function (elem, index) {
                            return elem.isDisplayed().then(function (text) {
                                return text == true;
                            });
                        }).first()).click(ptor_1.protractor.Button.RIGHT).perform()];
                case 5:
                    _a.sent();
                    console.log('waits for above all to complete');
                    return [2];
            }
        });
    });
}
//# sourceMappingURL=PassScriptAsync.js.map