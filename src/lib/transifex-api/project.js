/**
 * The Transifex project API gets project data
 * @module transifex-api/project
 */

var logger = require('../logger'),
    io = require('../io'),
    txutils = require('../txUtil');

var project = module.exports = {
  // selfies
  name: 'zendesk-test',
  key: 'tx_project',
  url: '',
  headers: {
    'X-Source-Zendesk': 'ZendeskApp/2.0.0'
  },
  username: '',
  password: '',
  events: {
    'txProject.done': 'txProjectDone',
    'txProject.fail': 'txProjectSyncError'
  },
  initialize: function() {
    var settings = io.getSettings();

    logger.info('Convert Project Url to API:', settings.tx_project);
    project.dashboard_url = settings.tx_project.replace(/\/$/, '') + '/';
    project.url = txutils.convertUrlToApi(settings.tx_project);

    logger.info('Validate TxProject API URL:', project.url);
    if (!txutils.isValidAPIUrl(project.url)) {
      logger.error('API URL is invalid');
    }

    project.username = settings.tx_username;
    project.password = settings.tx_password;
  },
  requests: {
    txProject: function() {
      logger.debug('txProject ajax request');
      return {
        url: project.url,
        data: {'details': true},
        headers: project.headers,
        type: 'GET',
        cache: false,
        dataType: 'json',
        username: project.username,
        password: project.password,
        secure: true
      };
    },
  },
  eventHandlers: {
    txProjectDone: function(data, textStatus, jqXHR) {
      logger.info('Transifex Project Retrieved with status:', textStatus);
      var default_locale = this.store('default_locale').split('-')[0];
      if (data.source_language_code.split('-')[0] !== default_locale){
        io.setPageError('txProject:locale');
      }
      this.store(project.key, data);
      io.popSync(project.key);
      this.checkAsyncComplete();
    },
    txProjectSyncError: function(jqXHR, textStatus) {
      logger.info('Transifex Project Retrieved with status:', textStatus);
      io.popSync(project.key);
      if (jqXHR.status === 404) {
        logger.error('txProjectSyncError:', 'Not found');
        io.setPageError('txProject:not_found');
      }
      else if (jqXHR.status === 401 && io.getRetries('txProject') < 1) {
        this.ajax('txProject');
        io.setRetries('txProject', io.getRetries('txProject') + 1);
      }
      else if (jqXHR.status === 401) {
        logger.error('txProjectSyncError:', 'Login error');
        io.setPageError('txProject:login');
      }
      else {
        io.setPageError('txProject');
      }
      this.checkAsyncComplete();
    },
  },
  actionHandlers: {
    asyncGetTxProject: function() {
      logger.debug('function: [asyncGetTxProject]');
      io.setRetries('txProject', 0);
      io.pushSync(project.key);
      this.ajax('txProject');
    },
  },
  jsonHandlers: {
    getResourceArray: function(p) {
      var result = [];
      var r = p.resources;
      if (_.isArray(r)) {
        _.each(r, function(i) {
          result.push(i.slug);
        });
      }
      return result;
    },
    getSourceLocale: function(p) {
      return p.source_language_code;
    },
    getLocales: function(p) {
      return p.teams;
    }
  }
};
