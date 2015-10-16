var os = require('os');
var path = require('path');
var fs = require('fs');
var fse = require('fs-extra');
var builder = require('xmlbuilder');

var HTMLReporter = function(baseReporterDecorator, config, emitter, logger,
		helper, formatError) {
	var outputFile = config.htmlReporter.outputFile;
	var pageTitle = config.htmlReporter.pageTitle || 'Unit Test Results';
	var subPageTitle = config.htmlReporter.subPageTitle || false;
	var log = logger.create('reporter.html');

	var html;
	var body;
	var suites;
	var resultsContainer;
	var pendingFileWritings = 0;
	var fileWritingFinished = function() {};
	var allMessages = [];

	baseReporterDecorator(this);

	// TODO: remove if public version of this method is available
	var basePathResolve = function(relativePath) {

		if (helper.isUrlAbsolute(relativePath)) {
			return relativePath;
		}

		if (!helper.isDefined(config.basePath)
				|| !helper.isDefined(relativePath)) {
			return '';
		}

		return path.resolve(config.basePath, relativePath);
	};

	var htmlHelpers = {
		createHead : function() {
			var head = html.ele('head');
			head.ele('meta', {
				charset : 'utf-8'
			});
			head.ele('title', {}, pageTitle
					+ (subPageTitle ? ' - ' + subPageTitle : ''));
			head.ele('link', {
				type : 'text/css',
				rel : 'stylesheet',
				href : 'assets/css/bootstrap.css'
			});
			head.ele('link', {
				type : 'text/css',
				rel : 'stylesheet',
				href : 'assets/css/overwrite.css'
			});

		},
		createBody : function() {
			body = html.ele('body');
			var nav = body.ele('nav', {
				class : "navbar navbar-inverse"
			}).ele('div', {
				class : "container-fluid"
			});
			
			var navHeaderSection = nav.ele('div', {class: "navbar-header"});
			navHeaderSection.ele('span', {
				class : "glyphicon glyphicon-list-alt navbar-brand"
			});

			nav.ele('h3', {
				class : "navbar-text"
			}, pageTitle);
			
			nav.ele('h4', {class : "nav navbar-nav navbar-text ow-sub-title"}, subPageTitle);
			
			resultsContainer = body.ele('div', {class: "container-fluid"}).ele('div', {class: 'row'}).ele('div', {class: 'col-xs-12'})
		}
	};

	var createHtmlResults = function(browser) {
		var suite;
		var header;
		var timestamp = (new Date()).toLocaleString();

		suite = suites[browser.id] = resultsContainer.ele('table', {
			class : 'table table-bordered table-hover'
		});
		
		suite.ele('caption', {class: ''}, "Test Results running in "+ browser.name + ' Timestamp: ' + timestamp);
		
		suites[browser.id]['results'] = suite.ele('tr').ele('td', {
			colspan : '3'
		}); 

		header = suite.ele('tr', {
			class : 'header'
		});
		header.ele('td', {}, 'Status');
		header.ele('td', {}, 'Spec');
		header.ele('td', {}, 'Suite / Results');

		body.ele('hr');
	};

	this.adapters = [ function(msg) {
		allMessages.push(msg);
	} ];

	this.onRunStart = function(browsers) {
		suites = {};

		html = builder.create('html', null, 'html', {
			headless : true
		});
		html.doctype();

		htmlHelpers.createHead();
		htmlHelpers.createBody();

		if (!this.onBrowserStart) {
			browsers.forEach(function(browser) {
				createHtmlResults(browser);
			});
		}
	};

	if (this.onBrowserStart) {
		this.onBrowserStart = function(browser) {
			createHtmlResults(browser);
		};
	}

	this.onBrowserComplete = function(browser) {
		var suite = suites[browser.id];
		var result = browser.lastResult;

		if (suite && suite['results']) {
			suite['results'].txt(result.total + ' tests / ');
			suite['results'].txt((result.disconnected || result.error ? 1 : 0)
					+ ' errors / ');
			suite['results'].txt(result.failed + ' failures / ');
			suite['results'].txt(result.skipped + ' skipped / ');
			suite['results'].txt('runtime: ' + ((result.netTime || 0) / 1000)
					+ 's');

			if (allMessages.length > 0) {
				suite.ele('tr', {
					class : 'system-out'
				}).ele('td', {
					colspan : '3'
				}).raw(
						'<strong>System output:</strong><br />'
								+ allMessages.join('<br />'));
			}
		}
	};

	this.onRunComplete = function() {
		var htmlToOutput = html;

		pendingFileWritings++;

		config.basePath = path.resolve(config.basePath || '.');
		outputFile = basePathResolve(outputFile);
		helper.normalizeWinPath(outputFile);

		helper
				.mkdirIfNotExists(
						path.dirname(outputFile),
						function() {
							fs.writeFile(outputFile, htmlToOutput.end({
								pretty : true
							}), function(err) {
								if (err) {
									log.warn('Cannot write HTML report\n\t'
											+ err.message);
								} else {
									log.debug('HTML results written to "%s".',
											outputFile);
								}

								if (!--pendingFileWritings) {
									fileWritingFinished();
								}
							});

							// copy the style sheet
							var dir = path.parse(outputFile).dir
									+ "/assets/";
							fse
									.copy(
											'node_modules/karma-htmlfile2-reporter/assets/',
											dir,
											function(err) {
												if (err) {
													console
															.log("Cannot write css...");
													log.debug(err);
												}
											});
						});

		suites = html = null;
		allMessages.length = 0;
	};

	this.specSuccess = this.specSkipped = this.specFailure = function(browser,
			result) {
		var specClass = result.skipped ? 'warning' : (result.success ? 'success'
				: 'danger');
		var spec = suites[browser.id].ele('tr', {
			class : specClass
		});
		var suiteColumn;

		spec.ele('td', {},
				result.skipped ? 'Skipped' : (result.success ? ('Passed in '
						+ ((result.time || 0) / 1000) + 's') : 'Failed'));
		spec.ele('td', {}, result.description);
		suiteColumn = spec.ele('td', {class: 'spec-width'});
		suiteColumn.ele('div', {class: ''}).raw(result.suite.join(' &raquo; '));

		if (!result.success) {
			result.log.forEach(function(err) {
				suiteColumn.ele('pre', {class: 'pre-scrollable'}).ele('code',{class: 'text-justify'} , formatError(err));
			});
		}
	};

	// TODO(vojta): move to onExit
	// wait for writing all the html files, before exiting
	emitter.on('exit', function(done) {
		if (pendingFileWritings) {
			fileWritingFinished = done;
		} else {
			done();
		}
	});
};

HTMLReporter.$inject = [ 'baseReporterDecorator', 'config', 'emitter',
		'logger', 'helper', 'formatError' ];

// PUBLISH DI MODULE
module.exports = {
	'reporter:html' : [ 'type', HTMLReporter ]
};