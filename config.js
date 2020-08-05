
var HtmlReporter = require('protractor-beautiful-reporter');
exports.config = {
    // launch locally when fields directConnect and seleniumAddress are not provided
    framework : 'jasmine',
   // baseUrl: 'http://localhost:8100',
    chromeDriver: './specs/driver/chromedriver.exe',
    specs: ['./specs/ectrScript.js'],

    capabilities: {
      browserName: 'chrome',
      chromeOptions: {
        //args: ["--headless", "--disable-gpu", "--window-size=800x600"]
         w3c: false
         //unexpectedAlertBehaviour: 'accept'
    }
    },

    jasmineNodeOpts:{defaultTimeoutInterval: 60000} ,

    onPrepare: function() {
      // Add a screenshot reporter and store screenshots to '/Reports/screenshots':
      jasmine.getEnv().addReporter(new HtmlReporter({
         baseDirectory: 'Reports/screenshots'
      }).getJasmine2Reporter());
   }
   
  }
