'use strict';

(function (angular, buildfire, window) {
  angular.module('couponPluginWidget')
    .controller('WidgetSavedCtrl', ['$scope', 'DataStore', 'TAG_NAMES', 'LAYOUTS', '$sce', '$rootScope', 'Buildfire', 'ViewStack', 'UserData', 'PAGINATION', '$modal', '$timeout',
      function ($scope, DataStore, TAG_NAMES, LAYOUTS, $sce, $rootScope, Buildfire, ViewStack, UserData, PAGINATION, $modal, $timeout) {
        var WidgetSaved = this;
        WidgetSaved.busy = false;
        WidgetSaved.items = [];
        WidgetSaved.savedItems = {};
        WidgetSaved.hasAtleastOneSavedItem = false;
        var searchOptions = {
          skip: 0,
          limit: PAGINATION.itemCount
        };

        WidgetSaved.init = function () {
          Buildfire.spinner.show();
          var success = function (result) {
              Buildfire.spinner.hide();
              if (result && result.data) {
                WidgetSaved.data = result.data;
              }
            }
            , error = function (err) {
              Buildfire.spinner.hide();
              console.error('Error while getting data', err);
            };
          DataStore.get(TAG_NAMES.COUPON_INFO).then(success, error);
        };

        WidgetSaved.getSavedItems = function () {
          for (var item = 0; item < WidgetSaved.items.length; item++) {
            WidgetSaved.items[item].isSaved = false;
            for (var saved in WidgetSaved.savedItems) {
              if (WidgetSaved.items[item].id == WidgetSaved.savedItems[saved].data.itemId) {
                WidgetSaved.hasAtleastOneSaved = true;
                WidgetSaved.items[item].isSaved = true;
                WidgetSaved.items[item].savedId = WidgetSaved.savedItems[saved].id;
              }
            }
          }
          $scope.isFetchedAllData = true;
        };

        WidgetSaved.getItems = function () {
          Buildfire.spinner.show();
          var successAll = function (resultAll) {
              Buildfire.spinner.hide();
              WidgetSaved.items = WidgetSaved.items.length ? WidgetSaved.items.concat(resultAll) : resultAll;
              console.log("***************** ==============", WidgetSaved.items);
              searchOptions.skip = searchOptions.skip + PAGINATION.itemCount;
              if (resultAll.length == PAGINATION.itemCount) {
                WidgetSaved.busy = false;
              }
              var err = function (error) {
                Buildfire.spinner.hide();
                console.log("============ There is an error in getting data", error);
              }, result = function (result) {
                Buildfire.spinner.hide();
                console.log("===========search", result);
                WidgetSaved.savedItems = result;
                WidgetSaved.getSavedItems();
              };
              UserData.search({}, TAG_NAMES.COUPON_SAVED).then(result, err);


            },
            errorAll = function (error) {
              Buildfire.spinner.hide();
              console.log("error", error)
            };
          DataStore.search(searchOptions, TAG_NAMES.COUPON_ITEMS).then(successAll, errorAll);
        };

        WidgetSaved.removeSavedItem = function (item, index) {
          Buildfire.spinner.show();
          var successRemove = function (result) {
            Buildfire.spinner.hide();
            WidgetSaved.items.splice(index, 1);
            WidgetSaved.getSavedItems();
            if (!$scope.$$phase)
              $scope.$digest();
            var removeSavedItemModal = $modal.open({
              templateUrl: 'templates/Saved_Removed.html',
              size: 'sm',
              backdropClass: "ng-hide"
            });
            $timeout(function () {
              removeSavedItemModal.close();
            }, 3000);

          }, errorRemove = function () {
            Buildfire.spinner.hide();
            return console.error('There was a problem removing your data');
          };
          console.log("****************,", item.savedId, WidgetSaved.currentLoggedInUser._id);
          UserData.delete(item.savedId, TAG_NAMES.COUPON_SAVED, WidgetSaved.currentLoggedInUser._id).then(successRemove, errorRemove)
        };

        WidgetSaved.loadMore = function () {
          console.log("===============In loadmore");
          if (WidgetSaved.busy) return;
          WidgetSaved.busy = true;
          WidgetSaved.getItems();
        };

        WidgetSaved.showListItems = function () {
          ViewStack.popAllViews()
        };

        WidgetSaved.showMapView = function () {
          ViewStack.push({
            template: 'Map',
            params: {
              controller: "WidgetMapCtrl as WidgetMap"
            }
          });
        };

        WidgetSaved.showFilter = function () {
          ViewStack.push({
            template: 'Filter',
            params: {
              controller: "WidgetFilterCtrl as WidgetFilter"
            }
          });
        };

        WidgetSaved.openDetails = function (itemId) {
          ViewStack.push({
            template: 'Item',
            params: {
              controller: "WidgetItemCtrl as WidgetItem",
              itemId: itemId
            }
          });
        };

        /**
         * Check for current logged in user, if not show ogin screen
         */
        buildfire.auth.getCurrentUser(function (err, user) {
          console.log("===========LoggedInUser", user);
          if (user) {
            WidgetSaved.currentLoggedInUser = user;
            $scope.$apply();
          }
        });

        var searchData = function (newValue, tag) {
          Buildfire.spinner.show();
          var searchTerm = '';
          if (typeof newValue === 'undefined') {
            return;
          }
          if (newValue) {
            newValue = newValue.trim();
            if (newValue.indexOf(' ') !== -1) {
              searchTerm = newValue.split(' ');
              searchOptions.filter = {
                "$or": [{
                  "$json.title": {
                    "$regex": searchTerm[0],
                    "$options": "i"
                  }
                }, {
                  "$json.summary": {
                    "$regex": searchTerm[0],
                    "$options": "i"
                  }
                }, {
                  "$json.title": {
                    "$regex": searchTerm[1],
                    "$options": "i"
                  }
                }, {
                  "$json.summary": {
                    "$regex": searchTerm[1],
                    "$options": "i"
                  }
                }
                ]
              };
            } else {
              searchTerm = newValue;
              searchOptions.filter = {
                "$or": [{
                  "$json.title": {
                    "$regex": searchTerm,
                    "$options": "i"
                  }
                }, {"$json.summary": {"$regex": searchTerm, "$options": "i"}}]
              };
            }
          }

          WidgetSaved.busy = false;
          searchOptions.skip = 0;
          WidgetSaved.items = [];
          WidgetSaved.savedItems = {};
          WidgetSaved.loadMore();
        };

        var tmrDelay = null;

        var saveDataWithDelay = function (newObj) {
          if (newObj) {
            if (tmrDelay) {
              clearTimeout(tmrDelay);
            }
            tmrDelay = setTimeout(function () {
              if (newObj)
                searchData(newObj, TAG_NAMES.COUPON_SAVED);
            }, 500);
          }
          else {
            WidgetSaved.busy = false;
            searchOptions.skip = 0;
            searchOptions.filter = {};
            WidgetSaved.items = [];
            WidgetSaved.savedItems = {};
            WidgetSaved.loadMore();
          }
        };

        $scope.$watch(function () {
          return WidgetSaved.keyword;
        }, saveDataWithDelay, true);

        WidgetSaved.clearSearchResult = function () {
          WidgetSaved.keyword = null;
          WidgetSaved.busy = false;
          searchOptions.skip = 0;
          searchOptions.filter = {};
          WidgetSaved.items = [];
          WidgetSaved.savedItems = {};
          WidgetSaved.loadMore();
        };

        WidgetSaved.init();

      }]);
})(window.angular, window.buildfire, window);
