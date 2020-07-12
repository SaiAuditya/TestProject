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
        "description": "expected to open Infosys Site and faile|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "d4986a05b0ce97136b73735b7cb16aef",
        "instanceId": 17040,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[name=\"q\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[name=\"q\"])\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\FailScript.ts:21:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"expected to open Infosys Site and faile\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\FailScript.ts:7:9)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\FailScript.ts:5:5)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.infosys.com/ - A cookie associated with a cross-site resource at http://infosys.blueconic.net/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593771878491,
                "type": ""
            }
        ],
        "screenShotFile": "00c40023-0085-0010-0003-0065005e00bb.png",
        "timestamp": 1593771872040,
        "duration": 12639
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d4986a05b0ce97136b73735b7cb16aef",
        "instanceId": 17040,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008d0037-00e2-004b-000d-00c00032003e.png",
        "timestamp": 1593771888539,
        "duration": 14882
    },
    {
        "description": "expected to open Infosys Site and faile|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "7d20297549c4b210c917c266eec4b53e",
        "instanceId": 1304,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[name=\"q\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[name=\"q\"])\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\FailScript.ts:21:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"expected to open Infosys Site and faile\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\FailScript.ts:7:9)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\FailScript.ts:5:5)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00c10035-0073-0043-0069-001b003200e8.png",
        "timestamp": 1593779005481,
        "duration": 1287
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "7d20297549c4b210c917c266eec4b53e",
        "instanceId": 1304,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a000e4-009d-0069-0018-009b00770099.png",
        "timestamp": 1593779009179,
        "duration": 6878
    },
    {
        "description": "expected to open Infosys Site and faile|testcase",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "378719aeeb7198bf469a00a5ed014eb3",
        "instanceId": 12164,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: No element found using locator: By(css selector, *[name=\"q\"])"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: By(css selector, *[name=\"q\"])\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\FailScript.ts:23:39\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)\nFrom: Task: Run it(\"expected to open Infosys Site and faile\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\FailScript.ts:7:9)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\FailScript.ts:5:5)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ee00e3-00e8-00d0-00fe-004d0043008e.png",
        "timestamp": 1593779040603,
        "duration": 913
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "378719aeeb7198bf469a00a5ed014eb3",
        "instanceId": 12164,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008f00fd-0007-00c8-0037-001e00f50032.png",
        "timestamp": 1593779042083,
        "duration": 5558
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b7f50b4e1ac17a2045586bb5242aa6e7",
        "instanceId": 20380,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009600dc-0023-00bd-0096-00ea00540033.png",
        "timestamp": 1593779109707,
        "duration": 6039
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "257cbe6f4f514f4e7553670a76cc201e",
        "instanceId": 12336,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002d00b5-0023-0011-00b8-007a00ca003c.png",
        "timestamp": 1593790317056,
        "duration": 9396
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "55c7e7062ef4fa47bab7e61f69b67d38",
        "instanceId": 16064,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0051002e-00f2-0034-006f-0042002100e2.png",
        "timestamp": 1593790702668,
        "duration": 8840
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "591583372f71f99fb93217e37b642749",
        "instanceId": 2408,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004800e0-00c3-0013-009e-009f00ac00ed.png",
        "timestamp": 1593790808626,
        "duration": 17074
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "4ff2abe64feb29270374279cd6c38496",
        "instanceId": 4300,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008900bd-0002-0070-0014-003c001c00ea.png",
        "timestamp": 1593791044148,
        "duration": 15466
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a97e8f36242037bef20d5a55ee4a44fb",
        "instanceId": 18796,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bc00f3-0063-00b9-005a-00dd00cd009f.png",
        "timestamp": 1593791580951,
        "duration": 16919
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "dd35a7d6f3ccc7cc5890d2d366f6f1ca",
        "instanceId": 4032,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fb00bd-00c3-0032-0011-000b00480047.png",
        "timestamp": 1593791668874,
        "duration": 12045
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2043bf450d084bf4ca16e2bed905cc50",
        "instanceId": 19684,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c40016-0055-0058-0081-00c400a10086.png",
        "timestamp": 1593791807847,
        "duration": 12572
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "293d15f2616585e2af0f29b46614a536",
        "instanceId": 21528,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "001d009d-00d1-00a1-003d-00b9006a00f4.png",
        "timestamp": 1593792092203,
        "duration": 9355
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8ac70cdcb636d9cf8224f79bfe571f7a",
        "instanceId": 9732,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "006400af-00b2-0028-0088-007c00b700ed.png",
        "timestamp": 1593792270364,
        "duration": 8562
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "383dc53aa16183664920f2fa96d5e035",
        "instanceId": 17636,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007b0071-00bb-001b-001e-007a00da00fe.png",
        "timestamp": 1593793047891,
        "duration": 9952
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "f70e73f357223bce92272571f280fe57",
        "instanceId": 14884,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00160069-0016-0002-005b-00fc0037007a.png",
        "timestamp": 1593793629711,
        "duration": 10135
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "201c537c9086333cad35170d9e86af3b",
        "instanceId": 18240,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0066006e-00ef-004b-0053-00fc003d0030.png",
        "timestamp": 1593844743747,
        "duration": 5796
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "116d49b6981ab16129768e6f8bde5b7b",
        "instanceId": 17568,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f7008f-0084-007e-0014-004e00d50043.png",
        "timestamp": 1593844841276,
        "duration": 5458
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2cd76806a6998441f58f4317dbcd093b",
        "instanceId": 23328,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f00015-0007-0073-006f-003400c000e5.png",
        "timestamp": 1593845244779,
        "duration": 9257
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "d10a99aadcf9687f36270f1a61e350b5",
        "instanceId": 22212,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:34:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"expected to open google and pass\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "009100bb-0040-0094-0081-007f0053004c.png",
        "timestamp": 1593846230509,
        "duration": 11479
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "269845445fbc7979bc7823f75310521d",
        "instanceId": 20260,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:34:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"expected to open google and pass\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00d600a9-0067-001c-0064-00fb00840082.png",
        "timestamp": 1593846319488,
        "duration": 11571
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "5532a5f6a64bded64489352f516547f6",
        "instanceId": 13464,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at UserContext.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:36:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:112:25\n    at new ManagedPromise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1077:7)\n    at ControlFlow.promise (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2505:12)\n    at schedulerExecute (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:95:18)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\nFrom: Task: Run it(\"expected to open google and pass\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "006f0029-00db-00fb-00e8-002200a400cc.png",
        "timestamp": 1593846357961,
        "duration": 11806
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "132730a12e4792c4efa00da2a6ae0b38",
        "instanceId": 23168,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\PassScript.ts:33:28\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"expected to open google and pass\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00320085-00f5-0024-0058-00f3005d007a.png",
        "timestamp": 1593846693774,
        "duration": 11459
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "14be5e8c3331023cb4032dec62bc6512",
        "instanceId": 22096,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\PassScript.ts:33:28\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"expected to open google and pass\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00170034-00c6-0060-00d6-0047003700d3.png",
        "timestamp": 1593846845245,
        "duration": 12867
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "c07ed2b503be9a4f8c59d25baaadb322",
        "instanceId": 22080,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Failed: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)"
        ],
        "trace": [
            "NoSuchElementError: Index out of bound. Trying to access element at index: 0, but there are only 0 elements that match locator By(css selector, a)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:274:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (internal/process/task_queues.js:97:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at D:\\TestProject\\specs\\PassScript.ts:33:28\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:804:32\n    at ManagedPromise.invokeCallback_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\nFrom: Task: Run it(\"expected to open google and pass\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (D:\\TestProject\\specs\\PassScript.ts:5:1)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)\n    at Object.Module._extensions..js (internal/modules/cjs/loader.js:1158:10)\n    at Module.load (internal/modules/cjs/loader.js:986:32)\n    at Function.Module._load (internal/modules/cjs/loader.js:879:14)"
        ],
        "browserLogs": [],
        "screenShotFile": "00ff004c-00ca-0036-0084-00550037007f.png",
        "timestamp": 1593847077075,
        "duration": 13318
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "685746bd889456280e5473ab3c4f15f7",
        "instanceId": 6476,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00740030-00a1-0067-0029-00250060006c.png",
        "timestamp": 1593847851070,
        "duration": 15909
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "ded80aeff2cbcae08008551144b4c13e",
        "instanceId": 21812,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
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
                "message": "https://powerautomationsite.files.wordpress.com/2019/08/result-e1566199350391.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1593847961633,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://video.wordpress.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847963591,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://go.sonobi.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847966500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847966500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at https://simpli.fi/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847969200,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at https://yahoo.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847969214,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a resource at http://id.sharedid.org/ was set with `SameSite=None` but without `Secure`. A future release of Chrome will only deliver cookies marked `SameSite=None` if they are also marked `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847970746,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://tribalfusion.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847972500,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://ads.playground.xyz/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847972670,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://subscription.omnithrottle.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593847976132,
                "type": ""
            }
        ],
        "screenShotFile": "00c00053-0090-00e9-0047-00c000950062.png",
        "timestamp": 1593847925663,
        "duration": 54206
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "7f21a714dd78569dda24738c567f7ac3",
        "instanceId": 17412,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
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
                "message": "https://powerautomationsite.files.wordpress.com/2019/08/result-e1566199350391.jpg - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1593936792507,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://consolidatedchaos.com/author/powerautomationsite/ - A cookie associated with a cross-site resource at http://video.wordpress.com/ was set without the `SameSite` attribute. A future release of Chrome will only deliver cookies with cross-site requests if they are set with `SameSite=None` and `Secure`. You can review cookies in developer tools under Application>Storage>Cookies and see more details at https://www.chromestatus.com/feature/5088147346030592 and https://www.chromestatus.com/feature/5633521622188032.",
                "timestamp": 1593936793041,
                "type": ""
            }
        ],
        "screenShotFile": "00e200b7-002e-00fc-00e0-00d000b1002c.png",
        "timestamp": 1593936737796,
        "duration": 60036
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "21c7d4a1ddfd8b8a60ab193f0810ca01",
        "instanceId": 16800,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\venkata_srinadhuni\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (internal/timers.js:549:17)\n    at processTimers (internal/timers.js:492:7)"
        ],
        "browserLogs": [],
        "screenShotFile": "001100f3-00db-00f6-0097-00840058005e.png",
        "timestamp": 1593936874243,
        "duration": 34382
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "73fcf070158a46a5bf401bb22bd9d724",
        "instanceId": 12680,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e80039-000b-009c-00ee-00c100430027.png",
        "timestamp": 1593937224155,
        "duration": 23798
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "37bd55c73a254444047539cdf1301ff3",
        "instanceId": 25264,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ca0031-001f-00ac-0095-0087008b0081.png",
        "timestamp": 1593943081556,
        "duration": 12034
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "844451de9982c2963a20be6a7b0f97e2",
        "instanceId": 19044,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0059007b-0059-009e-006b-004b00000069.png",
        "timestamp": 1593943431151,
        "duration": 8477
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "bec01b350e5903dfe78e061afceda4b2",
        "instanceId": 21680,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005e0018-00c5-0065-0000-007c006800f5.png",
        "timestamp": 1593944370705,
        "duration": 9851
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "776c300b064b7f61a6c0dac8410a514d",
        "instanceId": 7732,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b70022-00ae-0029-0018-006f00d50002.png",
        "timestamp": 1593944437050,
        "duration": 10389
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "ff6f16e9ebc1d74b0cc22b24be537717",
        "instanceId": 20380,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00c90008-0051-00ba-0049-0063005a0067.png",
        "timestamp": 1594537352355,
        "duration": 11508
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "5c3705052a8608cc5100f0cf87160069",
        "instanceId": 2904,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0025000a-0046-00ea-00b5-00fb00a10023.png",
        "timestamp": 1594537518838,
        "duration": 15686
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "917005fcbc8fcf44b6061d87f81b1f2e",
        "instanceId": 19512,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00ac00d4-0016-003a-004d-0032001e0091.png",
        "timestamp": 1594538592034,
        "duration": 9938
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "b7283fe530ffe73faa66211a557a4c24",
        "instanceId": 1260,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00bf0045-005b-0045-000b-00cc005b0006.png",
        "timestamp": 1594538719513,
        "duration": 10251
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a887be23da650f84feaff876e8b555e5",
        "instanceId": 14956,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00550022-00e5-00de-00e4-00f800700043.png",
        "timestamp": 1594538781451,
        "duration": 12372
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c5704d1d33fc7744494f811853df1eb3",
        "instanceId": 11468,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004b0065-006a-0014-004a-000200e00010.png",
        "timestamp": 1594538883525,
        "duration": 9289
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "2ecb58ac2c3a488bef7461e68d781512",
        "instanceId": 10056,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fe0047-00bc-005c-0082-007100f300e9.png",
        "timestamp": 1594539012780,
        "duration": 9878
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "966012a2bf3eddc165c16d303c233668",
        "instanceId": 21036,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00f200ca-006d-0048-00d5-006200860079.png",
        "timestamp": 1594539172308,
        "duration": 13734
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c3baf2497608ccf4ad3632bd157426c1",
        "instanceId": 10372,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fb00a1-00d6-004a-001e-00e00031000b.png",
        "timestamp": 1594539431381,
        "duration": 11210
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c5e6874ee8a25e03c72a7b94faf75836",
        "instanceId": 23112,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e000bb-0047-004d-00f1-00f8002700b3.png",
        "timestamp": 1594539582276,
        "duration": 8745
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "927e87d7a6a629f170b08fb941aa3ae8",
        "instanceId": 18396,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00810087-00a4-0097-0087-0054006d0032.png",
        "timestamp": 1594540753051,
        "duration": 16838
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "519f81effb91f601a26bd91dacd98187",
        "instanceId": 22512,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00970068-00cb-00e6-0003-0017004b005b.png",
        "timestamp": 1594541115761,
        "duration": 8840
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
