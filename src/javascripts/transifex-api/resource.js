/**
 * The Transifex resource API gets resource file data
 * from an existing project.
 * @module transifex-api/resource
 */

var txProject = require('./project'),
    syncUtil = require('../syncUtil'),
    io = require('../io'),
    logger = require('../logger'),
    txutils = require('../txUtil');

var resource = module.exports = {
  // selfies
  key: 'tx_resource',
  url: '',
  inserturl: '',
  headers: {
    'X-Source-Zendesk': 'ZendeskApp/2.1.0'
  },
  username: '',
  password: '',
  initialize: function() {
    var settings = io.getSettings();
    resource.username = settings.tx_username;
    resource.password = settings.tx_password;
    resource.url = txProject.url + 'resource/';
    resource.inserturl = txProject.url + 'resources/';
    resource.headers['Authorization'] = 'Basic ' + btoa(resource.username + ':' + resource.password);
  },
  requests: {
    txResourceStats: function(resourceName) {
      logger.debug('txResourceStats ajax request:', resourceName);
      return {
        url: this.tx + '/api/2/project/' + this.selected_brand.tx_project + '/resource/' + resourceName + '/stats/',
        type: 'GET',
        headers: resource.headers,
        dataType: 'json',
        cors: true
      };
    },
    txResource: function(resourceName, languageCode, entryid) {
      logger.debug('txResource ajax request:', resourceName + '||' + languageCode);
      return {
        url: this.tx + '/api/2/project/' + this.selected_brand.tx_project + '/resource/' + resourceName + '/translation/' + languageCode + '/',
        type: 'GET',
        headers: resource.headers,
        dataType: 'json',
        cors: true
      };
    },
    txInsertResource: function(data, resourceName) {
      logger.debug('txInsertResource ajax request:', data + '||' + data.i18n_type);
      return {
        url: this.tx + '/api/2/project/' + this.selected_brand.tx_project + '/resources/',
        type: 'POST',
        headers: resource.headers,
        data: JSON.stringify(data),
        contentType: 'application/json',
        cors: true
      };
    },
    txUpdateResource: function(data, resourceName) {
      logger.debug('txUpdateResource ajax request:', data + '||' + resourceName + '||' + data.i18n_type);
      return {
        url: this.tx + '/api/2/project/' + this.selected_brand.tx_project + '/resource/' + resourceName + '/content/',
        type: 'PUT',
        headers: resource.headers,
        data: JSON.stringify(data),
        cache: false,
        contentType: 'application/json',
        cors: true
      };
    },
  },
  eventHandlers: {
    txResourceStatsDone: function(data, resourceName) {
      logger.info('Transifex Resource Stats retrieved with status:', 'OK');
      this.store(resource.key + resourceName, data);
      io.popSync(resource.key + resourceName);
      this.checkAsyncComplete();
    },
    txResourceStatsError: function(jqXHR, name) {
      logger.info('Transifex Resource Stats Retrieved with status:', jqXHR.statusText);
      var retries = io.getRetries('txResourceStats' + name);
      if (jqXHR.status == 401 && retries < 2) {
        this.ajax('txResourceStats', name)
          .done(data => {
            this.txResourceStatsDone(data, name);
          })
          .fail(xhr => {
            this.txResourceStatsError(xhr, name);
          });
        io.setRetries('txResourceStats' + name, retries + 1);
      } else {
        io.popSync(resource.key + name);
        // Save error status instead of resource
        this.store(resource.key + name, jqXHR.status);
        this.checkAsyncComplete();
      }
    },

    txResourceDone: function(data, resourceName, languageCode, entryid) {
      logger.info('Transifex Resource retrieved with status:', 'OK');
      var zd_locales = io.getLocales();
      var zdLocale = syncUtil.txLocaletoZd(languageCode, zd_locales);
      var type = this.resolveResourceType(resourceName);

      this['zdUpsert<T>Translation'.replace('<T>', type)](
        data.content, entryid, zdLocale
      );
      io.popSync(resource.key + resourceName + languageCode);
    },

    txResourceError: function(jqXHR, resourceName, languageCode, entryid) {
      logger.info('Transifex Resource Retrieved with status:', jqXHR.statusText);
      var retries = io.getRetries('txResource' + resourceName);
      if (jqXHR.status == 401 && retries < 2) {
        this.ajax('txResource', resourceName, languageCode, entryid)
          .done(data => {
            this.txResourceDone(data, resourceName, languageCode, entryid);
          })
          .fail(xhr => {
            this.txResourceError(xhr, resourceName, languageCode, entryid);
          });
        io.setRetries('txResource' + resourceName, retries + 1);
      } else {
        io.popSync(resource.key + resourceName + languageCode);
        this.store(resource.key + resourceName, jqXHR.status);
        io.opSet(resourceName, 'fail');
        this.checkAsyncComplete();
      }
    },

    txInsertResourceDone: function(data, resourceName) {
      logger.info('Transifex Resource inserted with status:', 'OK');
      io.popSync(resource.key + resourceName + 'upsert');

      io.opSet(resourceName, 'success');
      io.pushResource(resourceName);
      this.checkAsyncComplete();
    },

    txUpdateResourceDone: function(data, resourceName) {
      logger.info('Transifex Resource updated with status:', 'OK');
      io.popSync(resource.key + resourceName + 'upsert');
      io.opSet(resourceName, 'success');
      this.checkAsyncComplete();
    },

    txUpsertResourceError: function(jqXHR, resourceName) {
      logger.info('Transifex Resource Retrieved with status:', jqXHR.statusText);
      io.popSync(resource.key + resourceName + 'upsert');
      this.store(resource.key + resourceName, jqXHR.status);
      io.opSet(resourceName, 'fail');
      this.checkAsyncComplete();
    },
  },
  actionHandlers: {
    completedLanguages: function(stats) {
      var arr = [],
          locales = io.getLocales(),
          default_locale = this.store('default_locale');
      _.each(stats, function(value, key) {
        var match = (value['completed'] === "100%");
        var zd_key = syncUtil.txLocaletoZd(key, locales);
        if (match && zd_key && zd_key !== default_locale) {
          arr.push(key);
        }
      });

      return arr;
    },
    txUpsertResource: function(content, slug) {
      logger.info('txUpsertResource:', content + '||' + slug);
      var project = this.store(txProject.key);
      var resources = io.getResourceArray();
      //check list of resources in the project
      io.opSet(slug, 'processing');
      if (syncUtil.isStringinArray(slug, resources)) {
        this.ajax('txUpdateResource', content, slug)
          .done(data => this.txUpdateResourceDone(data, slug))
          .fail(xhr => this.txUpsertResourceError(xhr, slug));
      } else {
        this.ajax('txInsertResource', content, slug)
          .done(data => this.txInsertResourceDone(data, slug))
          .fail(xhr => this.txUpsertResourceError(xhr, slug));
      }
    },
    asyncGetTxResourceStats: function(name) {
      logger.info('asyncGetTxResourceStats:', name);
      io.pushSync(resource.key + name);
      io.setRetries('txResourceStats' + name, 0);
      this.ajax('txResourceStats', name)
        .done(data => {
          this.txResourceStatsDone(data, name);
        })
        .fail(xhr => {
          this.txResourceStatsError(xhr, name);
        });
    },
    asyncGetTxResource: function(name, code, entryid) {
      logger.info('asyncGetTxResource:', name + code);
      io.pushSync(resource.key + name + code);
      this.ajax('txResource', name, code, entryid)
        .done(data => {
          this.txResourceDone(data, name, code, entryid);
        })
        .fail(xhr => {
          this.txResourceError(xhr, name, code, entryid);
        });
    },
    asyncTxUpsertResource: function(data, name) {
      logger.info('asyncTxUpdateResource:', name);
      io.pushSync(resource.key + name + 'upsert');
      io.setRetries('txResource' + name, 0);
      this.txUpsertResource(data, name);
    },
  },
  helpers: {
    resourceCompletedPercentage: function(resource_stats) {
      var sum = 0, locale_count = 0, zd_locale,
          locales = io.getLocales(),
          default_locale = this.store('default_locale');
      _.each(resource_stats, function(stat, code) {
        zd_locale = syncUtil.txLocaletoZd(code, locales);
        if ( zd_locale !== null && zd_locale !== default_locale ) {
          sum += parseInt(stat.completed.split('%')[0]);
          locale_count += 1;
        }
      });
      return Math.ceil(sum / locale_count);
    },
    resolveResourceType: function(resourceName) {
      var t = resourceName.split('-')[1];
      return {
        'articles': 'Articles',
        'sections': 'Sections',
        'categories': 'Categories',
        'dynamic': 'DynamicContent'
      }[t];
    }
  },
};