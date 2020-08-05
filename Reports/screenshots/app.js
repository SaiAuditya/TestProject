var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3dfa2d39acb2c959211f6654235795b1",
        "instanceId": 15392,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00180005-00e3-0095-00db-00a900210096.png",
        "timestamp": 1595303351240,
        "duration": 23795
    },
    {
        "description": "does the first step|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3dfa2d39acb2c959211f6654235795b1",
        "instanceId": 15392,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00020002-00a5-001d-00e8-003900a30019.png",
        "timestamp": 1595303375915,
        "duration": 4
    },
    {
        "description": "Test case 1 : to start a browser|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "66c663d93573f1d73ad934b609bd931a",
        "instanceId": 21308,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007d0019-0079-0073-00a2-0089002b0086.png",
        "timestamp": 1595303611254,
        "duration": 24183
    },
    {
        "description": "Test case 2 : does the second step|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "66c663d93573f1d73ad934b609bd931a",
        "instanceId": 21308,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005800de-00ae-005e-00e9-00ba00e10060.png",
        "timestamp": 1595303636299,
        "duration": 16
    },
    {
        "description": "Test case 1 : to start a browser|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2f32f79918c113462845eae90d5b9b5a",
        "instanceId": 22292,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00360022-0034-003a-0002-004b002c00f4.png",
        "timestamp": 1595305738481,
        "duration": 23077
    },
    {
        "description": "Test case 2 : does the second step|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2f32f79918c113462845eae90d5b9b5a",
        "instanceId": 22292,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a0000b-002d-00df-007a-00d800450047.png",
        "timestamp": 1595305763908,
        "duration": 5
    },
    {
        "description": "Test case 1 : to start a browser|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f76b9571ff9f371166450d4af7e39eb7",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007300ed-005c-00f2-00a9-00310051002e.png",
        "timestamp": 1595306205943,
        "duration": 25791
    },
    {
        "description": "Test case 2 : does the second step|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f76b9571ff9f371166450d4af7e39eb7",
        "instanceId": 13960,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007e00f3-000d-0032-006a-002d00c30036.png",
        "timestamp": 1595306232493,
        "duration": 2
    },
    {
        "description": "Test case 1 : to start a browser|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8fca9e952e6aa0e503a40f442769cf27",
        "instanceId": 23304,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00470099-0060-00ed-00f8-004800d00058.png",
        "timestamp": 1595307010160,
        "duration": 20915
    },
    {
        "description": "Test case 2 : does the second step|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8fca9e952e6aa0e503a40f442769cf27",
        "instanceId": 23304,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "003700c1-0087-0098-006a-007300c6001f.png",
        "timestamp": 1595307031796,
        "duration": 2
    },
    {
        "description": "Test case 1 : to start a browser|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2a45b0d5c1d9447d156fd204ebd35315",
        "instanceId": 22544,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.ZR5MgddWeJU.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-4Z3ZFsIV5SfJ3ya7-4n9QA-0-og/cb=gapi.loaded_0 473 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1595307138690,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.ZR5MgddWeJU.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-4Z3ZFsIV5SfJ3ya7-4n9QA-0-og/cb=gapi.loaded_0 473 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1595307138698,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.ZR5MgddWeJU.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-4Z3ZFsIV5SfJ3ya7-4n9QA-0-og/cb=gapi.loaded_0 473 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1595307138704,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.ZR5MgddWeJU.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-4Z3ZFsIV5SfJ3ya7-4n9QA-0-og/cb=gapi.loaded_0 473 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1595307138704,
                "type": ""
            }
        ],
        "screenShotFile": "001f0093-00c7-0086-0083-00bd00ce00cd.png",
        "timestamp": 1595307134786,
        "duration": 23296
    },
    {
        "description": "Test case 2 : does the second step|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2a45b0d5c1d9447d156fd204ebd35315",
        "instanceId": 22544,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008c00e4-00fa-0027-00af-004200640082.png",
        "timestamp": 1595307158784,
        "duration": 2
    },
    {
        "description": "Test case 1 : to start a browser|End to end testing",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "6a7f3062a1f0f2f810fb1558fab442f7",
        "instanceId": 21448,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.ZR5MgddWeJU.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-4Z3ZFsIV5SfJ3ya7-4n9QA-0-og/cb=gapi.loaded_0 - Failed to load resource: net::ERR_TIMED_OUT",
                "timestamp": 1595308118604,
                "type": ""
            }
        ],
        "screenShotFile": "00f900f1-0062-0093-00f2-009500f700e0.png",
        "timestamp": 1595308083275,
        "duration": 53073
    },
    {
        "description": "Test case 2 : does the second step|End to end testing",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "6a7f3062a1f0f2f810fb1558fab442f7",
        "instanceId": 21448,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b10058-00c9-00d9-0079-009200f800d7.png",
        "timestamp": 1595308136926,
        "duration": 2
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "789ebed3e58d0fc63f12146fea88b138",
        "instanceId": 19860,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[id=\"i0116\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[id=\"i0116\"])\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\ectrScript.ts:12:41\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"Username & Password Check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\ectrScript.ts:6:9)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\ectrScript.ts:4:5)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596523136487,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523137688,
                "type": ""
            }
        ],
        "screenShotFile": "00d4007a-008b-0082-00de-007000d000f1.png",
        "timestamp": 1596523132906,
        "duration": 8542
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "62c3b59581774c67bd55036a7b956608",
        "instanceId": 21652,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596523390184,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523391350,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523396362,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=9b3f291d-1d17-45b1-9506-db640e88e5a9&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv2sTUQDH790l15ghhiq1S_GGCCq8y7t3735C1RbrICkxLWpbBXnv3bvkmuQuvdwh5C_o2EUQxcVJs-kkgqNLpk4idRME6VScdBA8_4MsX77T5_v98q2WkY51fF3BOvIbFjcIsymHwmQGJMgR0COYQIsZLg0ZNx0nSBer9ZVrN19eWnm38Uz9FtQOf7ydgiu9LBuN_WZT8Cx9Khg8oDqd5Kko_DjKxFiPRdb8AMAxAD8BmMoN4YQhM20BMWMYktCgkNrYgY4hLMaDkNsiOJHPt9fyrIf_S5JGE3Eq18ZiUIQ8oZwneZz9kithSrtDEWcvlIaLsWe4DoWE2AXUcBBkBHNoYy90OcKUBPZUmWvne6XhGY4XoKKY8AgvkK4LmRUiSCyLME4cUjBnyuo8tOb9sUj1LUEDLRmJOAq0UZqE0UB8VcB35XI36eeDmGY9fZindBDdygTvxdEoHHKdJ8PjEjgtLVWkurwsa9LVRaT4lUq1Li1LmvS7BF6Xi08evfnzd-nG4_annc9fXp3VpFm5Sekk2tvvPgxat8P1rT4-MMU9s513Ok5vtxO0zP2J9WCw3t_cubOxin3jSFWP1AszdWFze62l390-U8HhgvTxXGOeb59XwUn1IkYYQeRCRDRk-8T0Mdr7Bw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596523407424,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/DDXsS/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596523435839,
                "type": ""
            }
        ],
        "screenShotFile": "00fb009c-0013-00a2-001f-001d004900fa.png",
        "timestamp": 1596523387422,
        "duration": 52789
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "8bdc0d36c47cc7b8f177e4e62c6156b4",
        "instanceId": 20788,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596523665456,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523666490,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596523670530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523670531,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523671060,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=0d86d908-2ab4-4c9a-baca-411856418a4c&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY1RPW_TQAD12UkaIj6iFqEMlfAQBKp09t35bJ8tVSKVQKhKaSEiSCzV-XxOnCZ2ajtUdGRAiKkj6siYEXWA_oRMnRB0ZEKdEBMj5h9keXrL-9JrVJFBDLKhEQP5bVtgGjhcQGkFGFLkSuhRQqEdYMajQFiuG2arjWb9x7sbZxun3fNFp9XvfOjOwb1hUUxz3zSlKLIjGcBDbvDjWSZLnseFzI1EFuYXAC4A-AXAXG27rsWxyxBkHgnKLJtATlgIBSde5BDOHMwu1Vu7nVkxJP8hzeJjeaXezOW4DNnnQqSzpPij1qOMDyYyKU61tmNJ5Fi0bMyxBymJgnIA5pBH2LKCiAlh07m21M7PWtvDrheiUi49KiCljMHAjhCktk0DQV1aGi60zWXczBe5zIznkod6OpVJHOrTLI3isfyugZ_a3UF6MBsnvBgak1nGx_HDQophEk-jiTBEOrmogKvKnbrSVFuqrjxYRZpfrzeaSkvRlb8V8KlafjJe3_p2_63-5Oxra3tt_bqyqJoHPfvRnvXUPHzD-u7OVO5uyVBwiUfDZ-nLowGx-qw_2qOPR6_zTebjk1rtpLa2qK3s9DpdY7v3uwberyjn19rLfPuxAS4btwkiCCIGEdWR41PXt-1X_wA1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596523682098,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/HUxCF/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596523690100,
                "type": ""
            }
        ],
        "screenShotFile": "005500c8-000a-0055-0085-007600a60010.png",
        "timestamp": 1596523662260,
        "duration": 36825
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "93f9061bec972004a79f2bed8ee98cdf",
        "instanceId": 15588,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596523847617,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523848835,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596523854155,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=5f95c51c-734f-4971-8132-13da7b4c189a&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY1Rv2_TQBj12UkaMkDUIpQBiQyphEBnny93ts9SJSrB0KpVCi0CsVR353NtNbET_xBSYWFjACkLEopYYEHKyITYWTJ1QigjEyoLYmLE_Af5hve96X3vfa9VRyY28S0Dm8jvUWkT4XAJVV_YkCBXQUYwgVTYHg-F7LtukK232te_vjke5JOdF3hj-WyvM5uDzagoxrlvWUoW2VMl4ISb_KzMVMXzuFC5majC-gzAOQA_AZjrPSokRTZDMHCUAwlmHArcF5AQGdJAVavvLPUrg-2yiPB_SLP4TF3ol3M1rI4ccynTMin-6M0w4ycjlRQzo1e5tAOKERTM41UAD0OPeX1Iq8EEO9J2vbmxUs5PRo_ZLguQzaFiRFbGPA8KGiJIKCVCEpeEnlwYW6uoWQ9zlZkPFA-66VglcdAdZ2kYD9V3A_wwbpykp-Uw4UVkjsqMD-M7hZJREo_DkTRlOjqvgYvatabW1jt6V7u5jgy_2Wy1tY7W1f7WwId61cmv9-_484_f9l_PpmrzVU1b1K0DmqYktwYqHNwdFY-wE2E2ecyPyO2jsDzw7qURQ65guzv30Rb27WmjMW1sLBpr-4fbe-bu4e8GeLmmfbnUW6Xbty2wbF3FqPo98iAiXeT4FPmUPfkH0&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596523865371,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/f4Ug6/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596523893834,
                "type": ""
            }
        ],
        "screenShotFile": "0001002b-0002-00b0-00c0-006600a5008a.png",
        "timestamp": 1596523844919,
        "duration": 53045
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "d16e7ec26a925e83082362bd3d743be4",
        "instanceId": 4968,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596524053654,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596524055281,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596524059623,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=15096aef-c9b7-40e9-9701-0d676e3d69e5&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RPYsTQQCGd3aTvVxADefXNWKKCIcwu7Ozs58QuShYaI7IxUO0kZnZ2eyeyW7cj4vkF1hep9gIliltFMEfYKor5cBGEfQaxUqs3PsHaV7e6v3gadaRhjV8XcEa8jsWNwizKYfCZAYkyBHQI5hAixkuDRk3HSfINpqtX_vrF999-rn9ApwZJd34-wJci4pimvu6LniRzQSDT6lG52UmKp_Hhci1RBT6ewCOAPgBwELumFYQmIZtQGRhBInFHUhd14W2azEnwMLyhHMsnxv0yiLCp5Jm8VycyGdzMa5KHlPO0zIp_siNMKOjiUiKV0rHCm3MsSegwMyuDlATepwTyARGglIPGaa7UFb6-VbpeIbjBcigUHiEQ0KqdcwKT8dahHHikNDlS6W7Spq-l4tM2xU0aKdTkcRBe5qlYTwWnxXwVbk6Sp-U44QWkTYpMzqOtwvBoySehhOu8XRyVAMntUsNqSVvym1pawMpfqPRbEmbUlv6WwNv6hWTK-NvW5fZv_7rL4O7H2-o0rKu9yN7b_hw1tt9MIvmN--5yWC_TG5NDd09KPqZuaOj29lBkMf3n6Gu5xuHqnqonl-qazvDXl-7M_ytgudr0of1zipsXzbBcfMCRhVL5EJE2sj2LeJj89F_0&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596524104069,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/E9zGM/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596524111729,
                "type": ""
            }
        ],
        "screenShotFile": "00f000f3-00d1-005b-00e6-000a00d400fc.png",
        "timestamp": 1596524050921,
        "duration": 60040
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "869c5e10657977d90858b735ab52d96c",
        "instanceId": 980,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "TypeError: Invalid locator"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "TypeError: Invalid locator\n    at Object.check [as checkedLocator] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:275:9)\n    at thenableWebDriverProxy.findElements (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1041:18)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596524138203,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596524139351,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596524144621,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=872030b4-0c7f-4169-92c0-b08867cd2b8b&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RvYsTQQDFd7JJLgbRcCdynVusIMrszs7OZD_gwKAc-HEGDcehjc7Ozuwul-zmNrMcXGNpwMLjKrG0jI0cFmJla0C4Uq7URq4SK8HG-B-kebzq_Xj82g1kYQtf17GFQpNyh0RdxqFwIwcS5AkYEEwgjRyfyYi7nheXq-3OB2S8eH4-6x19fj9Nvt54OQNXU6XGk9C2BVflvojgHrPYQVWKRZ9kSkysXCj7IwAnAPwEYFYzPRrEXe4uCK4MIHGIDwMhJXRQ7BGMPclIfFq72O9VKsX_oyizA3FWuzARwwXkKeO8qHL1u9aSJUtGIldvdFNGvsDMkdCVDEESxAQyjANIhYMJ6tJYSjrTl_p5rJuB4wUxchgUAeGQEN-HEZWLXUpJxIlHpM_n-sYya_b2RJTWI8FioxiLPIuNcVnIbCi-6eC7fiUpdqthzlRqjaqSDbObSvA0z8ZyxC1ejE7q4Kx-uaV1aus1Q7u2ivSw1Wp3tHXN0P7UwdvGwsmzd69M74faPJ7-jY--NLR5w05H9_pu4g0SJ42SW5hvD3ft_WJvp1QPNl1aPLxT3SY7j21E-1sbQegcNpuHzbV5c2Vr0Ltv3R38aoLpivbpnLmM29dtcNq-hBFGEPkQEQN1Q0pD4j_5Bw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596524154899,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/q1kfK/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596524182160,
                "type": ""
            }
        ],
        "screenShotFile": "007f004f-005e-00cf-00c8-00c9007c00ad.png",
        "timestamp": 1596524135506,
        "duration": 52901
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "f1d0b461eacfb4835ab2b24ca7ae6217",
        "instanceId": 15320,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.89"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "TypeError: Invalid locator"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "TypeError: Invalid locator\n    at Object.check [as checkedLocator] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\by.js:275:9)\n    at thenableWebDriverProxy.findElements (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1041:18)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:159:44\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596524605887,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596524607049,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596524612795,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=b0d0507e-560c-401b-ad78-83ccc9b9261a&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RT2sTQQDFd3aTbQyioYoURcwhSlVmMzM7m_0DhdRWUFErbSNWKGVmdjZZk-yum0mVHrx48dib4rHHgCCe1G9g8JBbpUdP0oviyaPpN8jl8U6_9x6vXEQWscgNg1goqDkCU95gAkqbY0iRK6FPCYUOxx6LuLBdN8zny5VXjyYfTz--1Pzw8vX3b1-uXRyBqx2lskFQr0uh8heSw-fMYnvDXE79IFZyYCVS1T8DMAHgFwAjvRZi5oa2H0HhcRtSSglkNnOhh7gvkd9ADewc6WfXloeqQ04kzeM9eayfGcjeNGSHCZEOE_VXL0U5a_dlot4bNcEIF6FnQ8FcDikRDHrCxpBFZErkhDGGR8ZMOz8ZNR-7fogwg9KnYlrR8yB3IgSp41AuqEsjT4yNpVlo9dZA5ta6ZGE1zWQSh9UsT6O4J38Y4KdxpZ12h72EqY7VH-asFzeVFJ0kzqK-sETanxTAceFCSavoC3pVW5xHRlAqlSvaglbV_hXAQXH6yeLhYen6gdl8u737ez25rI2LddRSt_q4568-s9u7N7eQ07XFapZ1N5-kSLUervFOtnLn9t2VdHNryQnwvmnum-fG5tyDjeX71r2NPyZ4M6d9PVWb5dt3ZXBUPk8QQRB5ENEqcgNkB9R--h81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596524629499,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/MWrwT/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596524638262,
                "type": ""
            }
        ],
        "screenShotFile": "00eb00bd-007b-0006-0090-003a00b700d6.png",
        "timestamp": 1596524603240,
        "duration": 38454
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "35309e77fe702373b71c3fd0a32f936d",
        "instanceId": 4888,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596527605940,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596527607058,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596527612783,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=f6e8445c-9061-4ad4-91c4-dd746fd87ae7&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv2sTUQDH793lVzNoqCLdjBBBLO_y7u7dvXsHhQZEIU0qWtNKEcp7794lRy936eVCQ_wHHOMgiJM4BnFwkoK4OGXq4FAKLi6WTuIgjsb_IMuX7_T58uVTziPd1M27mqkjr2YLA3OHCSgtbkCMiIQUmxja3HBZwIVFiJ-ulivP7l38YdNvzZdfv2fJ2eTnDNzuZdlg6NXrUmTpseTwiOlsMkrlog_DTA71WGb1TwCcAnABwEytCd-0KeIOFNwnEPtEQGr5JhQudxzLlQJb6Fy9-rAxynrm_0jScCIv1StDGS1GDpgQySjOfqulIGXdvoyzN1rNYdQwfOpDRLADsTA5pIFYkM1AGgRx4Vp0pi3186NWowahPjIYlBQLiLHrQm4HCGLbxlxgggNXzLWNZWj1zlCm-mPJ_GoykHHoVwdpEoSRPNPAD-1mNzkcRTHLenp_lLIo3Myk6MXhIOgLXST90xy4zN0oKRV1Ta0qd1aR5pVK5YqyplSVvznwLr9w8lb9svL81ofNz81X79snRWWer2_tb8tuctR19p62HuxGjDY6e8Qer98_3jocs_ajcUts71K-Hj3pbLieMS0UpoVr80KxvdNo6c2dXwXwoqicrNSWcfu6DM7L101kIohciHAVEc-2PIvs_wM1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596527624011,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/JSQq1/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596527637334,
                "type": ""
            }
        ],
        "screenShotFile": "0089007c-007b-0011-0030-00cc000e00ac.png",
        "timestamp": 1596527603107,
        "duration": 60027
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "1702018728f50aadbc3b060d1f7a3e1d",
        "instanceId": 18672,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596527758281,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596527759432,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596527766542,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=d996978b-dc1c-4815-9bd9-22311f668afa&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RT2vUQADFM8luut2DLvUPFYQusoIok8xkZzJJoGALot1uqbhYpJcymUya0E2ym01Q-wlELz2Iit4UBPfoSfwIe-rBgy166Ul6EvEgnly_wV4e7_R-7_HqVWRYhnVdswzktajAxLe5gLLtY0gQk9AlFoHUxw4PfdFmLMgX6o1nL18cXf524c6boyt4KXz6dwyuRkUxGHmmKUWRP5Q-HHKD75e5nPpRXMiRkcrC_ATAIQA_ABirrUDIAFvMhg5zKCRUCuiHbRvaeAqyLSydAB2rZzdXyiKy_kuWx_vyVD0zkv0pZIcLkZVp8UuthTnfTWRavNZaNhLM5QGDlBIbEpu1oY_dEPoBdW0bE8sJnLE2086PWsvFzA0Q5lC6REBCHAf6NETTspT4gjASOmKiLc-SZt4fydy4J3nQzAYyjYPmIM_CuC-_auBEW9rN9sp-yovISMqc9-ObhRRRGg_CRBgiSw4r4LRysaY01EW1qVxbQJpXq9UbyqLSVP5UwNvq9JPnXy69PzF-dz58X4Xv9HllUjUfb6yvbkfx7f762lZvK7pBB3Jt042zZC-7RYedB0n5yO8O7_Iuc5aphw90_UA_N9HnNnorXaPT-6mDJ3PK5_nWLN--qoPj-nkLWQgiByLSRMyjtmeh7X81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596527786895,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/c3fX5/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596527814605,
                "type": ""
            }
        ],
        "screenShotFile": "00a00014-0015-00ee-000a-002200db0018.png",
        "timestamp": 1596527755448,
        "duration": 60030
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "9d6cac7a24044af827bc161e6f71a0ac",
        "instanceId": 1700,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596528439490,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596528440712,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596528447023,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=dce1ff96-8f10-46d1-a85c-7acacd3d17bb&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RvYsTQQDFd3aTXEyh4RS9zqAriDKb2dnZj1kIGE9Fj7sIdyccx4HMzs4ki8lusrtRktbGzqtEFCysJKWVaGkXEM5ODpuzELlKrKzU9T9I83jV-73Hq5WRgQ18RcMG8nWbmyRwGIfCCkxIkCsgJZhAOzA9JgNuuW6YLtfqz_4efa0__Xzrzd50_ql17sMMXOrl-TDzm03B8_SRCOCIGWw6TkXhsygXmRGLvPkOgAMAfgAwU3VhY4dLx4aCSlawkIQ0DBkMPZdJizgEYfdQPXW3Pc57-L8kaTQVx-rJTPQLyH3GeTKO819qVaasOxBx_kLTMfcQJzaC3MUSkpA6kLLCOdS0OGamQz060xba-VbTqenSEJmsqEg4JMTzYGBLBIltk4ATl0iPz7XWImnNe5lIjU3BwkYyFHEUNoZpIqO--KKBb9r5bvJg3I9Z3jMG45T1o2u54L04GsoBN3gyOCiB49LZqlJXV9SGcnkZaX61WqsrK0pD-V0Cr8vFJ-Hg8cWX2Z_2q6O9yfePF5R5ubk-aQe5NRwF3Yc7Hdy-vb1Bb27LzmqW0avX0xur9p3NZG20Y006Xsvxzf1KZb9yel5Z2thqrxtrWz8r4MmS8v6Evsi3z2vgsHYGI4wg8iAiDeT5yPUtd_cf0&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596528463980,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/yjjJE/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596528491386,
                "type": ""
            }
        ],
        "screenShotFile": "003c0083-001e-0099-003c-000b000a0026.png",
        "timestamp": 1596528436797,
        "duration": 60020
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "cc48a8535867fb8ee810f9f3b52bb9ff",
        "instanceId": 2360,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596529371452,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596529372739,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596529377193,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=9adb0a25-79de-44d9-b6b7-ecd3e11f8b1b&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RTWsTQQCGd3aTNN2DxipS8NAcUlBhNrOzs-4HFEytYuMXGFTqRWZmZ5K1yW66mTWmB49F8FLwIj16khw9qPgTeip40QqKnqR4EE8e3f6DXF7e0_Pw8pplZGELXzSwhcKGy23CLlEOhcNsSJAnYEAwgS6zfSoZdzwvyhbM2rL5de_b5Mvau_e_P_1YenFuCpZ7Sg1HYbMpuMrGgsEtatHtPBNFH8VKjKxEqOYHAA4A-AXAVG_4XPoRDgKIPFy4JI4gDZgDXWxHvh25viTRoX7yTitXPXwcaRZviyP9xEj0C8kjynmaJ-qvXpUZ7Q5EovaMhu-6TBIHQRFwF5JI2pASh8HIIYSTgksdPDVm2vnWaAS2F0TIpgWNcEiI70PmSgSJ6xLGiUekz_eNlVlozXsjkVl3BY3q6VAkcVQfZqmM--KzAX4aS910M-8nVPWsQZ7RfnxZCd5L4qEccIung4MSOCqdrWo1fVGva-cXkBFWq2ZNW9Tq2r8SeF0uPnn28sGp1tXSlTc733cuTOa1_XKzs6bGbbm6tXp_IyD99WvJ9ce383HGnioxyZ54rG1vBsMNp929sb7ihvZupbJbOb1fmbvVad202p0_FfB8Tvs435jl21cmODTPYIQRRD5EpI78EDshIg__Aw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596529391554,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/vtmdI/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596529399913,
                "type": ""
            }
        ],
        "screenShotFile": "008500ba-004c-0052-00b8-00be00ca00d6.png",
        "timestamp": 1596529368730,
        "duration": 35287
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "4358e7ba62179176ce4f293330d90308",
        "instanceId": 8684,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596560526341,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596560527983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596560531633,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=c5fdb60f-242d-4b80-8c33-3fdd64525f8d&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY1RPW_TQAD12fkiA40KQt2awUgIdM7d5S5nW6qgSEioNKpoSyW6VOfzOTFJ7NQ5N1In1IkBpI7AyBg2BoTYWTJ1RJVYmKpOfCwsSJh_kOXpLe9Lr15GDnHIbYs4yLeZxDToCAlVO8CQIq6gRwmFLMCuiALZ5jzMluuNpY9_v0D7-aOX7bvfwu2DVzNws6_1eOK3WkrqbKoCeCgccZxnquCTWKuJkyjd-gTAGQAXAMxMGzFeJEkOXS4VpAxTKHAoYZsx2WHS9UIWnZtLW-u57pP_kGbxsbo0r07UsAg5KLRpnuhfZi3KRG-kEv3WsokgioQ0hJGLigGYYihUyGHgKdLhXqQ4ojNroZ0fLNvD3AsRFlB5VEJKXRcGLEJFWUYDSTmNXDm31hZxaz2ZqMzZViJspmOVxGFznKVRPFRfLfDdWu2lg3yYCN13RnkmhvE9rWQ_icfRSDoyHZ2VwGXpRs1omCtm07i1jCy_Vqs3jBWjafwpgXfl4pORe_Lz4rf14GTwpvreIca83Jp2B1m-FfZ2h53BvtyInvK9aPchOXp2Pwg6d3oMy6N4qrv9zb3Ha20fn1Yqp5Vr80q1u7O-6Wzs_KiAF1Xj8xV7kW9f18F5_TpBBEHkQkSbmPuI-Jjv_wM1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596560544643,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/NgIFi/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596560572832,
                "type": ""
            }
        ],
        "screenShotFile": "002000cf-0061-001a-000b-00d0000e009c.png",
        "timestamp": 1596560522528,
        "duration": 53964
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "c2da3eac9929418d456590bb8c6339f7",
        "instanceId": 23400,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596561176524,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596561178036,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596561182888,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=49038eb6-91df-49d2-9a4b-1031a4ca90ed&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Ry2sTURyF55GkMQsNVaQrzSKCWO7k3ju_eULBgjSNNQj2QXUj99650wwmM-k8KOYvEEGJO-lSBCFLF0XErSBZla6kG8WVFARxowsXxv8gm8NZncPHVytjgxr0hk4N7DctQYDbTCBpcoIAOxJ5QAFZnLgs5MJ0nCBdrNWPnuudLy9OOocbdfJ6Ov4xUa_18nyY-a2WFHl6IDnaZwYbFamc9SzKZWbEMm-9U9VjVf2uqhOtKaRLwOMesmkYIGA2Rpw4NjK5ZwUhAGcuP9Uu3F0t8h79H0kajeSZdj6T_dnJQyZEUsT5L60apmxvIOP8UG8Gs0UOTog8MwAENlDEmG0i22J2QLA9w6ITfS7Ot3rTI44XYMKQ9EAgANdF3AoxAssCLsCB0BVTfWWetdZ2JlPjnmRBIxnKOAoawzQJo778rKvf9Kt7yaOiH7O8ZwyKlPWjm7kUvTgahgNhiGRwXFLPSperSl1b0hrK9UWs-9Vqra4sKQ3lT0l9VZ45-f1062v76NnGh48nn_6-uaJMy61bj5dHI0hhfbi7Y-Ki2xH7tNs_oLvrO6PtLUmDdrYG7Wz5_ppYsX0yrlTGlYvTykJ3c_WOcXvzZ0V9sqC8P9ecx-3Lmnpau0QxxQi7CEODOD4xfWw9-Ac1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596561192385,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/xg0XG/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596561219529,
                "type": ""
            }
        ],
        "screenShotFile": "005500fa-000b-0082-00b8-0068000c0088.png",
        "timestamp": 1596561173803,
        "duration": 49870
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "c66467f6718f7b8a5d8484b71fe753ca",
        "instanceId": 15404,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596561387983,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596561389180,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596561393849,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=81f1ffb1-830f-40e5-a395-3853d2461a1d&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RT2sTQRyGd3aTNOZgQysSRDGHCEWYzezu7J8sFBooAW2qNLFQvcjM7G-axWR3u7uhtTfRg8eCCOKx3nLTk_gRciqepEdRkZzUi940foNcHt7T-_LyVIpEN3XzpmbqxG_YwqDcYQKDxQ1MiQu4RU2KbW54THJhuW6QrlSqb__-fLL89OvGm5de_2PnyrUJujHI8yTzm00QeXoIHB8wnR2PU5jnLMwh0yPIm-8ROkPoO0ITtSGpx7gduJhKPocVAGbMCrDNXADputx24Fxdvtse5wPzP-I0PIaZejGD4XzkIRMiHkf5L7UsU7Y_gih_rTVaAXeoJTwMhmNjCtTALHA5FsQ0mcFsxzH5RFvo57t5m-G2AmIwDC0qMKWeh7ktCaa2TbmgLpWemGrri7Q1dzNI9R6woB4nEIVBPUljGQ7hk4Y-a9f340fjYcTygT4ap2wYbuQgBlGYyJHQRTw6K6BZ4XJZqao1ta6srRDNL5crVaWm1JU_BXRanDs5_L02I7Vv2y_ap1-ehVeVabHZ7TAeS-f-VtA7etxjB5sy2QPvzuYRoWSrs5Ps3rP2nL4T73RvrXu-cVIqnZRWp6Wl7X67q9_u_yih50vKhwuNRdy-qqDzyiWTmAQTDxNaN1zfcHzLe_AP0&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596561405000,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/PAfYk/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596561412082,
                "type": ""
            }
        ],
        "screenShotFile": "00580054-001a-008c-0042-00fb005300af.png",
        "timestamp": 1596561384942,
        "duration": 30741
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "8007effb8d469cf9fec91b9804018fbd",
        "instanceId": 25920,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596601855582,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596601858762,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=3c2caf34-961d-4b02-8ecc-d4ce4eec391e&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RvYvUQBjGM8l-uYUup8g16hYrHOIkM8nkY4IHrof4sfchBguvkclkshvNJnvZRNflumuukqtErMRyG8FK_BMWkRMUliuvksNCrCyN_8E1L0_zPr_3fZ5mFam6ql9TdBW5HZNj4luMQ2H4GBJkC0iJTqDpY4eFPjdsO8iWmi3y4fqNS6_l3qsv379u_qKXZ-DqIM9HY1fTBM-zF8KHO0xl0yITpR5HuRirici1TwAcAvATgJncITzEDqUcEr3EEO5b0GdIh8InFBsoMAKiH8nntrpFPtD_jzSLpuJEPjsWcQl5wjhPiyT_IzfCjPWHIsnfKh0L2Vx3kANDk5WmjmVAShGBguIACYsgJ7Rnyqn-_Kh0KLZpgDAr10l5J3Ec6JshgsQ0ic-JTUKHz5XV07hpj8YiUx8KFrTTkUiioD3K0jCKxUIBx8qVfvqsiBOWD9RhkbE4upkLPkiiUTjkKk-HhxVwUrnYkFrystyWVpaQ4jYazZa0LLWlvxXwvlp2stjb313Z-3b73fFi1_tRl-ZVzbu73p9ED5xJ-jxee1k8ZprXm67dwZtPd7KR19sSkXXr3sakiEl31XTxQa12UDs_r9U3vO66et_7XQP7denzmc5pun3TBEfNCzrSESzjR2YbEdfALqbb_wA1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596601886437,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/VJK6s/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596601898528,
                "type": ""
            }
        ],
        "screenShotFile": "008e005b-0052-00cc-008a-0047002b007a.png",
        "timestamp": 1596601851025,
        "duration": 52262
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "52f6d6e13fc5eb4aa0fd9bc4d34cc817",
        "instanceId": 22132,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596602237054,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596602238314,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596602245508,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=9f2e3893-077c-4d6e-8737-cab02456bf9d&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv2vUUADH85L75Q16tCIdBA-JUiwveXl5uZcEDqyDoPVabdGhi7xf6aV3l1yTHIeHux0LLiKI0PEmcRIX95s6SkcHkU6iCI7G_-CWL9_p-4NPs4osbOE7BrZQaHrCIbzDBFQudyBBVMGAYAI97vgs4sKlVGYrzdZr33r_sp70XtHFB_PZl3dzcKtfFOM8tG0limyqODxiFptNMlX6PC5UbiWqsD8BcAbADwDmuiki0vGpyyDyadlFmAt95CLIqGSK-thxJT3Xr-xsToo-_i9pFs_UhX45V8Oy5DkTIp0kxS-9EWXsYKSS4q1hUhQFniMZ9CST5QHuwcAPJMQ-FqTDI0klnRtL_fxomIFDA4kcBlVARDnR9yH3IgSJ5xEuCCWRLxZGd5k0-2muMmtXMdlOxyqJZXucpVE8VF8N8M24cZAOJsOEFX1rNMnYML5bKNFP4nE0EpZIR2cVcFG51tBa-pre1tZXkBE2Gs2Wtqa1tb8VcFotmfyeH2vr328-OL3-J-nermuLqn10mOcbWzk6FPfT7cETPt0Y7d8b82nyuDdztrde0AHZkfaAObu9Lg6dk1rtpLa6qNV7e5uPrId7P2vguK59vmQuw_ZNE5w3r2KEUQkUIq-NSOjS0EX7_wA1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596602257371,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/0V0Wo/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596602263637,
                "type": ""
            }
        ],
        "screenShotFile": "0032004b-006b-0022-00b1-00d900e50029.png",
        "timestamp": 1596602234351,
        "duration": 33052
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "9fd5bcac99224e69f73147cbb08492e8",
        "instanceId": 26296,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596602475592,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596602476949,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596602498507,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=a5213302-4986-4679-8ce0-8eadf6597963&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv4sTQRzFd3bzyxQa7kTSGSGCKLM7OzuzuxM4MBZ3nL9JEM5rZHb2u5flkt3cZuNdArZiIccVFqKdYBO4xkrEv-CqKyU2YiVXHRZiafwP0jxe9Xnv8apFYlKT3jSoSVpNrmwWuFJhcAIbM-IBFowyzAPbl1GgHM8Ls5VqTXeufXy5OVl__ePw-M_TiZqh6708H45algUqz_YhwHvSlNNxBgs_inMYmQnk1meEThH6hdBMb4YkDBymXCwlcMyYFFhQEJiAcJnvS664M9cvPWqP8x79L2kWT-FMvziC_iLkmVQqHSf5b70SZXJnAEn-zmgGthSgSIhd7lDM3AU0CIBi7grlCBkCDWFmLLXzk9EUtidCYksMgqlFRd_HAY8IZpyzQDGPRb46MdaWoVlPRpCZHZBhIx1CEoeNYZZGcR--GeincXUn3R33E5n3zME4k_34dg6ql8TDaKBMlQ5OC-iscKWi1fS63tBurBCjValUa1pda2h_C-hDcfHJ5Gt98ALmd94cn39_f1jWTopWsEvFVifsPo6mNNm3Ypk-7-wddNqWd-9gY7sX3mo_pPl0a4Ovb645LfuoVDoqrZ6Uyg-67fvm3e55Cb0qa18uNJf59m0VzauXKaEEEx8T3iCsxewWo9v_AA2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596602508622,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/p1Drf/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596602516046,
                "type": ""
            }
        ],
        "screenShotFile": "00060023-0019-002b-0035-003200a40036.png",
        "timestamp": 1596602472478,
        "duration": 47455
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "f683c1cf8933872c1bf5aaa32cb2466e",
        "instanceId": 7668,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596605224627,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596605225279,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596605251516,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=60b8042b-73ee-48d7-b82e-5ee61384283a&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RMW_TQACFfXaShgwQtQh1ohmCVFGdc3c--2xLlagiIKAGUNNKiIFyPp8Tq4lt7LMqdUMwMHZEjEwoI1PEH0DK1A3UkQFQJRBiYiT8gyxPb_ree3qNKjKJSW4axER-2xaYBg4XUFoBhhQxCT1KKLQD7PIoEBZjYb7aaG5VZs9-FZ97M_Ppt7VXm_4U3BgplRV-pyOFyo9lAJ9zk5-UuVz4IlayMBOpOjMAzgD4AcBUbzsMW5RiDrGQFqTcYZA7rgMjFFrM4RayuHOuX3m4U6oR-S9pHp_IC_1yIceLkEMuRFom6o9ej3I-nMhEvTXaUlApeLCgeNiDNAw5dD1LQumxwCKOTTBnU2OpnR-MtoeZF6JFRelRASl1XRjYEYLUtmkgKKORK-bG9jK0zkEhc3NP8rCVZjKJw1aWp1E8ll8M8NXYGKZH5TjhamROypyP41tKilESZ9FEmCKdnFXAReVaXWvq63pL21xFhl-vN5rautbS_lbAu-rik8c_X3Q_FRu99-z2y-vfq9q82rlbdoeqV2Jrqz_cJ-ED6XTvPRrcyfrH3aNi3zrI9niZBcFubPe3kY9Pa7XT2tq8ttIf7Oya9we_a-D1ivbxUnuZb980wHnjKkEEQeRCZLeQ7RPmU_LkHw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596605268299,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/xNaRU/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596605277997,
                "type": ""
            }
        ],
        "screenShotFile": "0013008d-0052-0023-0036-00ea005400dd.png",
        "timestamp": 1596605221304,
        "duration": 60019
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "a2877f6fd8163aa628bc42b172154fe2",
        "instanceId": 20772,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596605929709,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596605933733,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596605939337,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=55c22867-895f-49d8-9923-3c8903569a6f&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv2_TQACFfXaShgwQFYS6EYkgVUjnnM93ts-iElFVfpWqEmkQYinn813iktjBPreoG2KhYukIHSuxZEJMiJExUxekqiMT6oSYGAn_QZenN31PT1-jimxs49sWtlHYpsIhkccFlG7kQIJ8CRnBBNLICbiKhOv7cb7YaA6Wv_e3D04ffrx558B6epRNwa2h1pMi7HSk0PmejOArbvP9MpfzXiRaFnYqdecrACcA_AJgara5ogETSkLFvAgSLDEMBEMwUkRSjlzJHHxmXtnslnqI_0eWJ_vy3LxcyNF8ZJsLkZWp_mPWVc4HY5nqI6tNfTfgLuHQRZ47hzIPckx9SF0eBLHiRPpoal3o5xerzRyfxcjhUDIiICFBACOqECSUkkgQn6hAzKyVi9A6_ULm9hPJ41Y2kWkStyZ5ppKRPLXAT-vGIHtZjlKuh_a4zPkouaulGKbJRI2FLbLxSQWcV67Xjaa5ZLaM5UVkhfV6o2ksGS3jbwUcV-dOyKf3b198Xls9nv7YG7ypG7Nqp3e_r19v9cqt_pofd-8VLF7f2Xn2IFWbIhuM1znOd-kG313tSrTihc5hrXZYuzqrLWz0uo_tR73fNfBuwfh2qX0Rtx8a4KxxDSOMIAogoi1EQ5eFjvf8Hw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596605962971,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/PaToX/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596605970954,
                "type": ""
            }
        ],
        "screenShotFile": "00b6006f-003e-0059-001c-00c400bf00d5.png",
        "timestamp": 1596605925945,
        "duration": 50430
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "5353f26f7224daadf4767d62fd10d939",
        "instanceId": 25992,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596606484608,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596606485633,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596606517145,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=5d6a5317-3ab9-403e-afff-1f32a7c11fb8&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RMW_TQBiGfXaShgwQFQTdkiEgRHXO-Xyuz5aK2iIEjYIiJWoHJITO53Ni6tjGOVMlEjsTqhADYmSplAUJIVHYWDN1RB2ZUCfExAbuP8jy6Z2e9_301MpIxzq-o2EduS2LG8TbYBwK0zMgQbaADsEEWp5BWeBx07b9bLVWvzF49uSre3fr478GPv7eOJmDmyMp04nbbgsus0PhwedMZ7M8E0WehFJM9FjI9gkApwD8AmCutpAwKDIxgsQuCoktKPSYwSF2TOwzyqnJ_DP1Sm87lyN8cZIsnIlz9fJEREXJU8Z5ksfyj1oNMjYci1i-11rCxgw5lEHh8ILsUA96hsUgt3nAbEJNQdhcW-rPT1rLMWzHR8YFjRQTCS0mWkHBtSzicWKTgPKFtrkMrb03EZneF8xvJqmIQ7-ZZkkQRuKHBn5qjWFykEcxkyN9nGcsCrek4KM4TIMx13kyPi2B89L1qlJX19SmcnsVaW61Wqsra0pT-VsCH8qFk-6t6Mvn3tud45ezN_dfV5VFub3fIfk9grr7D9ZfeIOH_Xxnuntgrh8O0ng36_c6_nQjYqmcJsO9Tcc1jiqVo8rVRWXl0WC7q3cGvyvg1Yry7VJrGbfvauCsdg2jQiiiEFlNZLmEuoQ8_g81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596606530394,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/QSFih/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596606538791,
                "type": ""
            }
        ],
        "screenShotFile": "009b00de-00dd-00d1-00a6-007a00cc00db.png",
        "timestamp": 1596606481090,
        "duration": 60023
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "f96c0f7d44dd788a4cfff0367a34fd5e",
        "instanceId": 20344,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596606958224,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596606958781,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596606987901,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=e664a200-7d08-458b-a748-16ca651571ea&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RvYsTQQDFd3aT3F4KPe7OcJ0pIogwm9n52GwWDowgSi5-njZBkJnZmcveJbu53QknB_aCzZVieY0QEUEsxMo6NlfKlRYiqcRCLI3_QZrHq97jvV-1jDzs4WsO9lDUYNKnIuASKiJ8SFFLwTbFFDLhh1wLSVqtOF-vrlmn8Q_3-cubb27XZurS4XwKrgyMGRdRs6mkyY-UgIfc48eTXC18kRhVeKkyzU8AnAHwE4Cp3VBMhwHTBOoQa0i1CGHYxiGMtSA6IFhQzs7ti_c6EzPA_yXLk2M1ty8UargoecqlzCap-W27Oud7I5Wa107DF1gEhDDoa4IhVSyAAqMQEkpZHJMgoDyYOkvt_OA02n6rHSOfQ9WmElIahlAwjSBljApJW1SHcuZsL5PWfFyo3HuoeFzPxipN4vo4z3QyVN8c8N25vJcdTIYpNwNvNMn5MLlulBykyViPpCez0VkJzEs111qzt-y6dXUdOZHrLjBsWXXrbwmclhdMbrwNvnx9R7rvP9ae_NlYtWblpnlgbj3qMnrQS4w-Ej3RURj3xf7OM9aXmQr3797v5GLH93GxjSL_pFI5qWzMKit3djs9r7v7qwJerFifVxvLsH1VBefVTYwwgou_EasjFrEgIkH_Hw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596607002530,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/8AYAg/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596607031121,
                "type": ""
            }
        ],
        "screenShotFile": "00390062-0064-0084-0017-005500db00d0.png",
        "timestamp": 1596606949249,
        "duration": 60028
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "3abd10a5fc7e2ba1dcb5ffc32d739f9d",
        "instanceId": 23564,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596607653963,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596607655358,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596607659124,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=7ebfe7ee-5a59-4fee-9f74-0394b7b5d565&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RvWsTYQDG773Llxk0VJFuZoggwnt57-69j_egYOlQqSalqZa2IPJ-JqfJXby8odDB2bGDgzgoODhkFMSPpYtTcOgilI4uaocinXQz_gdZHp7p-fHwqxaR7druTcu1UdzwuYNZQDmUHnMgRqGEBLsY-syJqGLcC0ORL1RrZz8On-7snq2_1tbzD--_yQm43tN6OIqbTcl1vicZfEJtuj_O5ayPEi1Hdip18yMARwD8BGBiNkTImEulB4lP1IwlGKQK-dBFhHFEhHCQODEvrS-Pdc_9H1me7MtT8-JI9meQh5TzbJzqc7OictodyFS_tBoi4KHk3IOUegHEURhAEhAfOj4ROKBKUUwm1lw_31kN4oREIIdCSTCHGEcRZL5CEPs-ZhyHWEV8ai3Ns9a8P5K53ZFU1LOhTBNRH-aZSvry2ALfrWvd7PG4n1LdswfjnPaTW1ryXpoM1YDbPBscFcBp4WrFqJmLZt24sYCsuFKp1oxFo278KYA3xZmTr79W_35a-bL66sHb4_PDsjEtNje6NEDd9r1Oe5turTiP2nda7Ha7n23trG2Egw5vpbnTVa297TRacmLnoFQ6KF2elsqtzeW79trm7xJ4VjY-X2jM4_ZFFZxUr7jIRRBFEPl1FMQojLG_-w81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596607671881,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/DKldu/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596607702478,
                "type": ""
            }
        ],
        "screenShotFile": "00830055-00ba-00d8-00e4-004b000f00ef.png",
        "timestamp": 1596607649667,
        "duration": 57047
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "64769c0a41e97a1ac5f1a834c52f558e",
        "instanceId": 24960,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596607835989,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596607839156,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596607857683,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=f92fedb5-03d1-4b95-aaca-9d14d68377ae&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RvWsUQQDFd3bvyyv0SIKk84oTRJndmbnZ3dmFQE5E0HgEDIdgIzO7M9kld7vnfpB4rY1lQMQg2FieYCEI4p9wVWxEgpWVBhQRi9i5_gfXPF71fu_x2nVkEpNcNYiJ_J4dYCocHkDZFxhS5EroUUKhLTDjSgR91w2zlXbn3Q_r70fj2dZ88XLt0-P9N3NwOSqKae5blgyKbF8K-JCbfFZmsvJ5XMjcTGRhvQfgGIBvAMz1nrSlJI4kUDoYQep5AjLFbahC1ndCR4WuUCf6he1BWUTkv6RZPJOn-vlcjivIAx4EaZkUv_WWyvjuRCbFC6NHPCEIZRIKp8qjFQIyBzNIGHM8FEqMHTQ3ltr51uh52PVChDmUHg0gpYxBYauqrG1TEVCXKhYsjI1l0qxRLjPzruRhN53KJA670yxV8Vh-NsBX49JuuleOE15E5qTM-DjeLGQQJfFUTQIzSCfHNXBau9jSOvq63tWurCDDb7XaHW1d62pnNfCqXn3S33x6MDh6fv312feff740tUXdEqqfMBSprdFBMbwxtGYxigcsLwfJTS-O7t265o297UeCj5y9Debjw0bjsLG6aDSHO4M75u2dXw3wpKl9ONdb5tujNjhprxFEEEQMIruLHB9jH-H7_wA1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596607867151,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/aDLCx/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596607895275,
                "type": ""
            }
        ],
        "screenShotFile": "00e8006b-00f2-00e0-00ee-00ed001100dc.png",
        "timestamp": 1596607833286,
        "duration": 65943
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "a0b4195a7c5ff78c9cdced261b700ca5",
        "instanceId": 25552,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.",
            "Failed: timeout: Timed out receiving message from renderer: 130.485\n  (Session info: chrome=84.0.4147.105)\n  (Driver info: chromedriver=83.0.4103.39 (ccbf011cb2d2b19b506d844400483861342c20cd-refs/branch-heads/4103@{#416}),platform=Windows NT 10.0.17134 x86_64)"
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)",
            "TimeoutError: timeout: Timed out receiving message from renderer: 130.485\n  (Session info: chrome=84.0.4147.105)\n  (Driver info: chromedriver=83.0.4103.39 (ccbf011cb2d2b19b506d844400483861342c20cd-refs/branch-heads/4103@{#416}),platform=Windows NT 10.0.17134 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: WebDriver.navigate().to(https://ectrweb-qa.azurewebsites.net/)\n    at thenableWebDriverProxy.schedule (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at Navigation.to (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:1133:25)\n    at thenableWebDriverProxy.get (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:988:28)\n    at UserContext.<anonymous> (D:\\TestProject\\specs\\ectrScript.ts:10:24)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"Username & Password Check\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\ectrScript.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\ectrScript.ts:4:1)\n    at Module._compile (internal/modules/cjs/loader.js:1137:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1157:10)\n    at Module.load (internal/modules/cjs/loader.js:985:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:878:14)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://fonts.googleapis.com/icon?family=Material+Icons - Failed to load resource: net::ERR_CONNECTION_CLOSED",
                "timestamp": 1596608519969,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/vendor-es2015.js - Failed to load resource: net::ERR_TIMED_OUT",
                "timestamp": 1596608534050,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/main-es2015.js - Failed to load resource: net::ERR_TIMED_OUT",
                "timestamp": 1596608535153,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596608630874,
                "type": ""
            }
        ],
        "screenShotFile": "00ff00fa-0071-00a7-004b-002800a80016.png",
        "timestamp": 1596608453396,
        "duration": 180284
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "4e0bd9d3a62e28b6ca4ed445400bcd57",
        "instanceId": 21764,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596612718594,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596612719815,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596612725552,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=e8c36c42-0065-4378-86dc-20d1b89ed963&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY1RPYsTQQDdySa5GEHDKXKdW-RQhNmd2Z39hAPXWJ0ekTsieI3MzM4ky2124-4GQ36AXHmdYmFhmdLqsLDQLjZnp4cg2HhcJWJhI7j-g7zi8ar3eO-1G0g3dfOWauoo6NocE-ZQDoXFMCTIFdAnJoE2wx6VjFuuG-Xr7c6d5MOZUGa9Z1-1T8evvvAF2ByV5aQIDEPwMn8qGHxCdTqf5qLSRVyKQk9FaRwDcALAGQCLWtfDlArLcqHLHbvKohj6DnYhdyNpMikdYvqntcv9cFqOzP-U5fFcnNcuFSKpQh5TzrNpWv6qtWROh2ORli_VrhfZFrY9ClmFyhR50BOuhMxhOJI2p8ghC3Wlnm_Uro9dP0KYQuETDgnxPMhsiSCxbcI4cYn0-FLdWsXNGBQi13cFjbRsItI40iZ5JuNEfFbBd_X6MDuYJiktR_p4mtMkvl0KPkrjiRxznWfjkzo4r19rKZ3aRk1Tbq4jNWi12h1lQ9GUP3XwulF98vf9t-D5jcPeu4-_f9Q3LyrLhsHsPEpkgWa9u9tG-Kg_GMzMXWbMJyF_eK9PZTzMynQ_fLBzEG6RAB81m0fNK8vm2s5eeF_f3vvZBIdrytsL3VW-fdEGp-2rJjIRrEZHtobcwDIDjPf_AQ2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596612737956,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/clsnX/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596612753873,
                "type": ""
            }
        ],
        "screenShotFile": "002c003f-0078-0007-008c-00fa00e5003d.png",
        "timestamp": 1596612710452,
        "duration": 108093
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "3aa1824374b7924dba05ed017448199f",
        "instanceId": 24768,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596613084223,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596613085236,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596613090410,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=637a491f-9ca5-47dd-8f7e-f5a9798ea47e&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rz2sTQQCFd3aTNEbQUEV6Sw4rSGE2M7szO5uFgpVitUZCm1RNLzI7O9MsTXbTzUYxh6I3T9qjiCd_HMyhB_Eg_gk59SRS8KAn6UkEwaPxP8jl8U7f4_GV8siyLXvZsC3km1RgErhcQOkEGBLEJKwTm0AaYI-rQDiMheliqVy5ORbvXn1bf37w5_2jZ28PJuByN8sGQ79WkyJLH8oA7nOLj0epnPVhlMmhFcus9gmAYwB-AjDRTRHSeqgUhlIiGxKbMsgdJKAreUBdrph08Il-vrk6yrr2_0jSaCxP9XND2ZuN3OdCJKM4-60XVcp3-zLOXhomVh6xQ4dDjyICiUsV9BShkCkZMDzDuoJNjLl-fjDMOmb1EGEOZZ0ISIjnwYAqBAmlJBCEEeWJqbEyD622PZSptSV5WE0GMo7C6iBNVNSTXw3ww6jsJnujXsyzrtUfpbwXXc2k6MbRQPWFJZL-cQ6c5i4VtbK-pFe1K4vI8IvFUllb0qra3xx4nZ85OXrz-Gj5S_HWx-9x50nlrDbN1xo3-o21O1tt2bQf7G0O7u5vrwXs2uZGjFvy3nrHCVyRtJvXO7idrDAfHxYKh4UL08LC7dZqw9po_SqApwva5zPmPG5flMBJ6aKNbASRBxGtIuY7no_dnX81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596613102763,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/neaY9/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596613110088,
                "type": ""
            }
        ],
        "screenShotFile": "00d30077-002c-0053-0069-00dd00fc005b.png",
        "timestamp": 1596613072294,
        "duration": 82154
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "8ff9e18e07c320fee34fb5f9ead41021",
        "instanceId": 8380,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596613489661,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596613490862,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596613495052,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=28ced7a3-72ee-4baf-b3a0-839fe96813c6&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv2_TQACFfXaSJhlo1CLUjQypVFU6--58FzuWKhHEL5GmEKoKxILO57vYNLFTxxZSVhbGjqgLCLYsSJQBscOQAXUDdUEwQQeEmBhJ_4MsT296n56-ahGZxCSbBjGR12ACU7_JBZS2jyFFjoQtSihkPna58oXtOEG6Uq29_vJ543f6pnP88umLX-HqpylYD7NsNPYsS4osfSJ9eMBNPslTOe_jKJNjM5aZ9R6AEwB-AjDVG8Qm-JwHma0opE0RQC4lgdx2qbS5K6iwT_XlO-08C8l5JGk0kWf6hbEczCGPuBBJHmd_9bJKeX8o4-zIaGDEHIKxDR0lbEix40PfIQqKVlMpxxZBkzenxkI_3xqNFnZaAcIcyhYVkFLXhT5TCFLGqC-oQ5UrZsbWImvW3lim5j3Jg3oyknEU1EdpoqKB_GqAH8blfrKfD2KeheYwT_kgupJJEcbRSA2FKZLhSQGcFS6VtZq-pte1jRVkeOVytaataXXtXwG8Ks6dfP9WOd58t75ztFw6-Cgq2qxodcPe4-6taz2L3e-4_Xg_DK7efJBOrN62ha7n7Rv94d2dTqwYRntbzMOHpdJhaXVWWurutrfN27t_SuDZkvah0ljE7fMqOK1eJIggiFyIWB05HqUecx_-Bw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596613504724,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/NpVtY/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596613511614,
                "type": ""
            }
        ],
        "screenShotFile": "004c00c2-0064-00aa-006a-000d00d1008d.png",
        "timestamp": 1596613482223,
        "duration": 73666
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "88e8b2c7308dddf9ce34c1a4c3319e98",
        "instanceId": 15020,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596614279403,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596614280541,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596614285852,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=16de82f4-1efd-4258-8bdf-a27f78e3e23f&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2Rv2sTUQDH790laQyioUrppCdEEOHdvXv3Lu_uoGij1B9tKRpMShZ579275mhyl94PlCyCk-DSUTp2EMnoJA7inKmjdFCoDlIXEQcXwfgfZPnynb4fvnxqZWRgA1_XsIH8hiMswptMQGlzCxJEJfQIJtDhlstCLmxKg3SxVv_9_PPS30vbrZdfDp89_XpyYwKu9vN8lPmmKUWePpEc7jGDjYtUznoW5TIzYpmb7wA4AuA7ABO1IajLPTkjCElsSGxJoBfQAHLsscDCAglmH6vnt1aLvI__R5JGY3mqnsvkYAZ5zIRIijj_pVbDlO0MZZwfaI0mFUQ6XgiJYyFIGJeQU1tAj9uW4BJzytFEm-vnW63hWdQLkMWg9IiAhLgu5E4423UcwgWhJHTFVFuZZ818lMnUeChZoCcjGUeBPkqTMBrITxo40S7vJLvFIGZ53xgWKRtEN3Mp-nE0CofCEMnwqAROS0tVpa4uq7pybRFpfrVaqyvLiq78KYHD8szJ6M2Pb-MrH9Zfbx3orY9nlWnZjNY7ze5GRxQku7tGuula83Y3Hrt5B7d745580NvbvdW6Y3r3rM0V6lv7lcp-5cK0srDZXt0w7rd_VsCLBeX9mcY8bl_VwHHtIkYYQeRC5OiI-o7rI6_3Dw2&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596614296103,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/U4Oxp/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596614303529,
                "type": ""
            }
        ],
        "screenShotFile": "00d90091-0094-0058-0038-002d00ac00ff.png",
        "timestamp": 1596614273090,
        "duration": 74835
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "f3a0a57d6ec7eed770496023ebd5ef2c",
        "instanceId": 19636,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596614793824,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596614794920,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596614799245,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=f3e867de-3c47-4147-8c3e-b9af66c37cb0&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RP2_TQADFfXaShkhAWv6oGxmChJDOPp_v4rNFERFClYCCSoRoO4DuzufETWKn9gWkiA_AwNANxILUMQuICVgY2DJ1RB0YmKpOCBYkFsI3yPL0pt97T69WRja28VUL2yhsUukS0eISKk-4kCBfwYBgAqlwGY-F9Hw_yldq9e_d49_r19bbL69_ehd_ff5-Ci73tB4VoeMoqfNnSsA9bvPJOFdzXyRaFXaqtPMRgEMAjgGYmk2CfUlQLCBruR4kjHMoUBBD7HmMtDjzA0mPzLP322Pdw_8ly5OJOjHPFGowD3nCpczGqf5lVuOcd4cq1W-sJkEocKk3r42ZhEQKBAMZ-FBhXwU08ghx5dRaaOcHqxm4fhAhl0MVkDmNMAYFjREklBIhiU9iJmfW2iI052GhcvuB4lEjG6k0iRqjPIuTgfpmgR_WpW7WHw9Srnv2cJzzQXJDK9lLk1E8lLbMhoclcFK6WDXq5qrZMK6sICusVmt1Y9VoGH9K4KA8_-TL3-Wn6uDtvVcXHi_fLJ82ZmVnh2x2W_2tbcHdO7ce0V2STEbdDimi3e0IbeBCF6y9qfb6W45c80N3v1LZr5ybVZY2Ou279u3Ozwp4sWR8PtVc5NvXNXBUO48RRhAxiGgDsRC1QkJ3_gE1&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596614811192,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/MJ22i/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596614819061,
                "type": ""
            }
        ],
        "screenShotFile": "00ea00a0-00a0-0034-0079-00bc003e00a7.png",
        "timestamp": 1596614786001,
        "duration": 88781
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "da29c33dedd1f3874ad7435ac5effecc",
        "instanceId": 11792,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596615130069,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596615131235,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596615136044,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=76c4e697-6d8f-4e8c-91d7-a9140423728a&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RP2_TQADFfXaShgwkKlHVrZEIEqI65-58tu8sVaJCCIjSFloFRBdkn8-xIbET2wlSPgFCSJSJPxILTGRkqpiZMnUDdWRAqGJAsDASvkGWpze933t6lSLSiU6uaERHTtMUmHqWK6A0PAwpsiXklFBoepi5gScM2_bT1Urt5ffPk-eDZ7svvnyoFy6mT2fgUpjnw8xptaTI08fSgyNXd6fjVC58FuUy02OZt44BOAHgBwAztcm8gPsms6DvmQGkFsOQI8mgbyBpWQEnwsCnanVve5yH5L8kaTSVZ-r5TPYXkAeuEMk4zn-r5SB1ewMZ52-0pkUZNQMmoBlwCSlBHHokIJBhwojhEWbabKYttfOj1uTY5j7CLpScCkgpY3DRFUFqmtQT1KYL0lzbWiat1c1kqu9L128kQxlHfmOYJkHUl1818E3b6CWPxv3YzUN9ME7dfnQ1lyKMo2EwELpIBicFcFZYKys1dV1tKJdXkeaUy5Wasq40lL8F8K64-OT12-rP7ub7W8d_Os5OvarMi60R693ge9c3rbud9u7Da3Qy2fdDGoVZfjht35Thvey27N6_g8iou2U4-KhUOipdmJdWdg62O3r74FcJPFlRPp1rLvPtqwo4rdQJIggiBpHZQMzBxMH88B81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596615145850,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/1ZlnA/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596615174227,
                "type": ""
            }
        ],
        "screenShotFile": "00580061-0084-00a0-0062-008500f5005e.png",
        "timestamp": 1596615122214,
        "duration": 118457
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "0c92e5748be8ec09cc62851b6f4399b9",
        "instanceId": 17440,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596615456273,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596615457485,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596615461846,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=d2a10307-2931-4675-acd7-e69e4644e3ac&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY2RPWsUQQCGd3bvy0P0iCLpvOIUFWZ3Zm92Z3YhYDAcJFEDuaiYJszMzt4uudu97IdKagvLiI1YCFoesdBK_AkHQrBQSSUKIqnEytLzH1zz8lbvw8vTrCLTNu1rhm0iv-NITITLJVRdgSFBVEGP2AQ6AjMeCtmlNMgWmq268eoTvlr2Dr_8fNlb-XE4AZeiohjnvmUpWWQPlYB73OT7ZaZmPY8LlZuJKqz3ABwB8AuAid5xhQgV6yJIXUUhYVxBTqgDZxSbCdX1hOsc62c3lssisv9HmsX76kQ_k6vhDLLDpUzLpPijN8KMD0YqKV4YHeoElGGXQOZSDgmehUcEgRQpxCkOCfPoxJjr5zuj42HqBQhzqDwiISGMQeGECBLHIUISSkImp8bSPGvWnVxl5qbiQTsdqyQO2uMsDeOh-mqA78bFQbpbDhNeROaozPgwvl4oGSXxOBxJU6ajowo4qVxoaC19UW9rVxaQ4TcazZa2qLW1vxXwujpz8u3y_Wcfp9trbx9_Tp6-Oa1Nq9Zmb51tka29DWLfKMtxEd2jD8K7uytuEuf91TAPVwe4Z92OHq0PlmwfH9RqB7Vz01r9Vn_5prnW_10DT-rah1Odedw-b4Lj5nkb2QgiBpHTRszH1Cfu9j81&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596615472502,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/KTeFq/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596615501552,
                "type": ""
            }
        ],
        "screenShotFile": "001000de-00b5-00ed-0072-00fd009d00cb.png",
        "timestamp": 1596615450541,
        "duration": 105880
    },
    {
        "description": "Username & Password Check|Login",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "sessionId": "58a4c578ba930b8eb49ed2334231d041",
        "instanceId": 10404,
        "browser": {
            "name": "chrome",
            "version": "84.0.4147.105"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://cdn.jsdelivr.net/gh/emn178/chartjs-plugin-labels/src/chartjs-plugin-labels.js 12:12 \"Can not find Chart object.\"",
                "timestamp": 1596615923778,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ectrweb-qa.azurewebsites.net/Lato-Regular.woff2 - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596615925679,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://login.microsoftonline.com/favicon.ico - Failed to load resource: the server responded with a status of 404 (Not Found)",
                "timestamp": 1596615930101,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/eyJ2c2lkIjoidGVjaG5pcGZtYy5jb20ifQ==/prp.wsf?client-request-id=07f77ebb-9e63-4361-9b0f-d6944929e2b9&wa=wsignin1.0&wtrealm=urn%3afederation%3aMicrosoftOnline&wctx=LoginOptions%3D3%26estsredirect%3d2%26estsrequest%3drQIIAY1RO2_TQAD22XmRgUQFoW5kCOIhnX13OT-lSEQoEi1EVK1SQRd0d75LDIkdbIdHB2bYOiCBQGJgzAhLgZklUyeEOnZCnRALjJh_kOXT9y3fQ1-9jExikmsGMVHQtgWm3GECyg7HkCJXQp8SCm2OPaa46LhumK7Vm1-f_6mK9-zGu8b3VxtXTz4vwKVxns-ywLKkyNMnksNHzGT781QWPItymZmxzK1DAI4A-AnAQm9TGnJbKQaRQg6kGHPok0JSLkIlBQ6xCI_1xp3ePB-T_5Ck0b481c9mclKE3GdCJPM4_63XVMpGUxnnb4227XCXCuxCBwkKabEHcp8qSFAR4NmKcr-zMFba-dFo-9j1Q4QZlD4VkFLPg0VlVPjaRUvqUuWJpdFdxc0aZjI1tyULW8lMxlHYmqWJiibyhwFOjIuj5OF8ErN8bE7nKZtE13MpxnE0U1NhimR6VAKnpQs1ramv6y3tyhoyglqt3tTWtZb2twQ-lItPxOHle_Hr_ubL7qeb30oNbVm2siF7tivlxsDpPSX2lneL3B37KRo92La2nL63u5cO890B6j8eoK4f4INK5aByblmpDnZ6t83NnV8V8KKqfTnTXuXbN3VwXD9PEEEQeRDZLeQFxA469t4_0&cbcxt=&username=gokulnath.murali%40technipfmc.com&mkt=&lc= - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596615941087,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://fed.apps.technip.com/idp/z1jYp/resume/idp/prp.ping - Unrecognized Content-Security-Policy directive 'referrer'.\n",
                "timestamp": 1596615969503,
                "type": ""
            }
        ],
        "screenShotFile": "004c0044-00bb-00f1-00f8-007c00530030.png",
        "timestamp": 1596615913533,
        "duration": 101311
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
