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
        "sessionId": "239eecaebcc8df930ebb345bf9c55b22",
        "instanceId": 18196,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "0059001f-00f7-0038-0037-000e007b0064.png",
        "timestamp": 1594635945061,
        "duration": 29978
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "06cda37b87b5164cee17cb78c87eb18d",
        "instanceId": 17852,
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
        "screenShotFile": "00f400a5-0064-0070-005c-004f00ae00b4.png",
        "timestamp": 1594649639812,
        "duration": 47657
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "77d024f38b620e7a72358f96abc709c5",
        "instanceId": 6072,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00a200f7-0092-0059-006b-003b00ed00d2.png",
        "timestamp": 1594649802636,
        "duration": 9269
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "f9a4b40c461b13b41c1f817f963dc4c0",
        "instanceId": 13764,
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
        "browserLogs": [],
        "timestamp": 1594649965995,
        "duration": 60028
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "8fcc18962603b695b00207343cecbe52",
        "instanceId": 15876,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008f00e8-0025-0086-00e0-000b003b00e8.png",
        "timestamp": 1594650099448,
        "duration": 22037
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "a095708c32cbf75813f857c629197a8f",
        "instanceId": 15544,
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
        "screenShotFile": "00d70099-00a6-0001-007f-00c100390099.png",
        "timestamp": 1594650185512,
        "duration": 42997
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "36ed05686e5b226d208435a052ca35c9",
        "instanceId": 7304,
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
                "message": "https://www.google.com/xjs/_/js/k=xjs.s.en_GB.PPa5XJnXUPw.O/ck=xjs.s.vfaZJkMAkzc.L.W.O/am=AAAAgAAAAIAlYO8OIOe_CQBwgYkDAAAAEMAlwcYCKQQJBQEIAAAwqxMAAQI/d=1/exm=IvlUe,MC8mtf,MkHyGd,NBZ7u,OG6ZHd,RMhBfe,RqxLvf,T7XTS,TJw5qb,TxZWcc,URQPYc,Y33vzc,ZyRBae,aCZVp,aa,aam1T,abd,async,bgd,cdos,csi,d,dvl,eN4qad,fEVMic,foot,hsm,iD8Yk,iDPoPb,jsa,kyn,lu,m,mUpTid,mpck,mu,mvYTse,o02Jie,pB6Zqd,qik19b,rHjpXd,sb_wiz,sf,sonic,spch,tg8oTe,tl,uiNkee,vs,xiqEse,xz7cCd,zbML3c/ed=1/dg=2/br=1/ct=zgms/rs=ACT90oGiapNUeCE2dybxpcTyA3huKtUmCw/m=Uuupec,r36a9c?xjs=s2 - Failed to load resource: net::ERR_HTTP2_PING_FAILED",
                "timestamp": 1594651007418,
                "type": ""
            }
        ],
        "screenShotFile": "00a6003d-009d-0064-005b-003d005800f7.png",
        "timestamp": 1594650942238,
        "duration": 60017
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "85e4ce7231f583a1f9126e4ab1e3de60",
        "instanceId": 17208,
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
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.yyhByYeMTAc.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-O470EQdZ-4tpWpppyTQmeOEUv-g/cb=gapi.loaded_0 469 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1594652256389,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.yyhByYeMTAc.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-O470EQdZ-4tpWpppyTQmeOEUv-g/cb=gapi.loaded_0 469 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1594652256392,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.yyhByYeMTAc.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-O470EQdZ-4tpWpppyTQmeOEUv-g/cb=gapi.loaded_0 469 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1594652256503,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "https://apis.google.com/_/scs/abc-static/_/js/k=gapi.gapi.en.yyhByYeMTAc.O/m=gapi_iframes,googleapis_client,plusone/rt=j/sv=1/d=1/ed=1/am=AAY/rs=AHpOoo-O470EQdZ-4tpWpppyTQmeOEUv-g/cb=gapi.loaded_0 469 chrome.loadTimes() is deprecated, instead use standardized API: nextHopProtocol in Navigation Timing 2. https://www.chromestatus.com/features/5637885046816768.",
                "timestamp": 1594652256504,
                "type": ""
            }
        ],
        "screenShotFile": "008500ee-00d3-00bf-0025-00bb00c400cd.png",
        "timestamp": 1594652248568,
        "duration": 35317
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "bd8221e09a1789f39145805e5a10f106",
        "instanceId": 20180,
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
        "screenShotFile": "00390005-005e-0020-004b-0047000f00a8.png",
        "timestamp": 1594656630359,
        "duration": 43853
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "147d20fef6193b938f99ed400aa07803",
        "instanceId": 10424,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00640079-00f0-0045-00ff-00c10065002d.png",
        "timestamp": 1594656876533,
        "duration": 27942
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "8a3d60fa655085873e16827240102463",
        "instanceId": 20496,
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
        "screenShotFile": "00e8001a-002c-00ab-0001-0020009d00a4.png",
        "timestamp": 1594696417145,
        "duration": 59709
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "6775b09ad5620bbd150a12735f70c7d9",
        "instanceId": 1128,
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
        "screenShotFile": "00ce0045-00f5-0071-002d-00f200f600c2.png",
        "timestamp": 1594696601179,
        "duration": 37686
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c44ae54a53f778ef67c99701a6eb77d2",
        "instanceId": 7368,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "009500b1-0024-00dc-00f4-008700a600a5.png",
        "timestamp": 1594696709091,
        "duration": 18650
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": false,
        "pending": false,
        "os": "windows",
        "sessionId": "7fc2aaecdc633400af5210be05e72119",
        "instanceId": 13988,
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
        "screenShotFile": "006800b6-00d4-0097-0081-002f008b0049.png",
        "timestamp": 1594697150600,
        "duration": 31376
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3254f01a3852146b367f4872626e4e4b",
        "instanceId": 18356,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "002300e0-0070-00db-000d-00b200b70010.png",
        "timestamp": 1594697264627,
        "duration": 18266
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c670761803acfcbf21a2d05d281e634c",
        "instanceId": 22156,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00fa00b7-0018-001e-00ab-0021004d0059.png",
        "timestamp": 1594699801299,
        "duration": 19791
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a4de91d2ff00a17b8b4a6abf7736401a",
        "instanceId": 21736,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00310031-00d0-00de-00ba-00e700180007.png",
        "timestamp": 1594700079356,
        "duration": 19737
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d7746579ba800a6ef48542a3a352c50e",
        "instanceId": 23088,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004c0044-0085-00bd-0047-008000210057.png",
        "timestamp": 1594700128626,
        "duration": 18673
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "891ae518f0da056c709e7cc2389ce66f",
        "instanceId": 20148,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005b0008-0012-009f-0050-00fd00060040.png",
        "timestamp": 1594743060625,
        "duration": 23671
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "fb3baac3d266ffac4dcb14548761a998",
        "instanceId": 9864,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "004e00b2-00d2-00cc-0034-004500de009d.png",
        "timestamp": 1594743222612,
        "duration": 24155
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d57ae7fb1d955c00f90b516a2a05b573",
        "instanceId": 12936,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cc0024-0018-00e9-003a-0031009d00a0.png",
        "timestamp": 1594743591848,
        "duration": 21899
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c54b75aabc6c4993ff503180ccdb9edd",
        "instanceId": 16984,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007400ee-0039-00b2-0052-000700b90075.png",
        "timestamp": 1594743902306,
        "duration": 21803
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "3067f940ba1ab2de46c1bea935e8b44e",
        "instanceId": 17076,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "005700c1-00e3-00e8-00f7-007400560071.png",
        "timestamp": 1594744084058,
        "duration": 23371
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "63c23d0a466c7003aff632274314cf0b",
        "instanceId": 17176,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00b600ee-0073-0097-00d0-005c004a00e3.png",
        "timestamp": 1594744190947,
        "duration": 26500
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "d6b5203a620fcd342d4a9c35ea9cd7ad",
        "instanceId": 20936,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00890098-0012-0047-00fd-0085005b0058.png",
        "timestamp": 1594744597065,
        "duration": 27012
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c71ae6c40b9399777f983062fbb37053",
        "instanceId": 14884,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cf0038-00c7-00b4-00b9-001000780011.png",
        "timestamp": 1594744687533,
        "duration": 17257
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "c56214938113fd5b874879a2c6b7e5d8",
        "instanceId": 16528,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "008300a5-00ca-00d1-0022-00780033001e.png",
        "timestamp": 1594745046648,
        "duration": 25705
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e557e665e28c6cab17acd58dfb499cbc",
        "instanceId": 21208,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00e30040-0073-0099-00ba-00df00d80095.png",
        "timestamp": 1594745316661,
        "duration": 19133
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "9a3da7bd22f6005ac40e282f836c4c84",
        "instanceId": 17932,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007000eb-003e-006d-00ba-00ad001800ff.png",
        "timestamp": 1594793014387,
        "duration": 18720
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "af2ec4703fc0fc4221b1f98341628e5e",
        "instanceId": 13744,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00880075-00d4-0089-00f7-00d8006800d3.png",
        "timestamp": 1594818886089,
        "duration": 14813
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "a5865e3d2299ab3526e9da6eaf6ead63",
        "instanceId": 12436,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "00cf006d-0031-00f6-0074-007c00080066.png",
        "timestamp": 1594823379495,
        "duration": 13915
    },
    {
        "description": "expected to open google and pass|sanity",
        "passed": true,
        "pending": false,
        "os": "windows",
        "sessionId": "e8f67be7bda03bc2655fd1053fd83b05",
        "instanceId": 7948,
        "browser": {
            "name": "chrome",
            "version": "83.0.4103.116"
        },
        "message": "Passed",
        "browserLogs": [],
        "screenShotFile": "007e0058-00aa-00d8-0009-006e00640014.png",
        "timestamp": 1594823443805,
        "duration": 19496
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
