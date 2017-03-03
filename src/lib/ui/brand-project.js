/**
 * UI notifications
 * @module ui/sync-articles
 */

module.exports = {
  events: {
    'change .js-brand-dropdown': 'uiBrandProjectSelect',
  },
  eventHandlers: {
    uiAddBrandPage: function(event) {
      this.switchTo('create_project', {
        brands: this.buildBrandsData(),
        locales: this.store('brandLocales'),
        source: this.store('brandSource'),
        has_target: this.store('brandLocales').length != 0,
        brandName: _.find(this.store('brands'), {
          subdomain: this.store('brandAdd')
        }).name
      });
    },
    uiBrandProjectSelect: function(event) {
      event.preventDefault();
      var brand = this.$(event.target).val();
      this.store('brandAdd', brand);
      this.zdGetBrandLocales(brand);
      var t = 'brandsCreate';
      this.switchTo('loading_page', {
        page: t,
        page_articles: t == 'articles',
        page_categories: t == 'categories',
        page_sections: t == 'sections',
        page_dynamic_content: t == 'dynamic',
      });
      this.loadSyncPage = this.uiAddBrandPage;
    }
  },
  actionHandlers: {
    buildBrandsData: function() {
      var brands = this.store('brands');
      if (!this.selected_brand) {
        this.selected_brand = _.findWhere(brands, {default: true});
      }
      return _.chain(brands)
        //.filter(datum => !datum.default) //Filter out default brand
        .map(datum => _.extend(datum, {
          selected: datum.id == this.selected_brand.id,
          tobeAdded: datum.subdomain == this.store('brandAdd')
        }))
        .value();
    },
  },
};
