KOJS.namespace("recipe.model");

/**
 * Dropboxに保存されている情報を保持するやり取りするオブジェクト
 */
KOJS.recipe.model.Dao = (function () {
  // ネームスペース省略用のローカル変数
  var Dao,
      logger = undefined;

  /**
   * コンストラクタ
   * 
   * @param {Client} dropboxClient レシピを管理しているサーバーのURL
   */
  Dao = function (dropboxClient) {
    logger = KOJS.util.Logger.get();

    this._client = dropboxClient;
  };
  
  /**
   * エラーハンドラ（実際にはログに記録するだけ）
   *
   * @param {ApiError} error 発生したエラーオブジェクト
   */
  Dao.showError = function(error) {
    switch (error.status) {
    case Dropbox.ApiError.INVALID_TOKEN:
      // If you're using dropbox.js, the only cause behind this error is that
      // the user token expired.
      // Get the user through the authentication flow again.
      break;

    case Dropbox.ApiError.NOT_FOUND:
      // The file or folder you tried to access is not in the user's Dropbox.
      // Handling this error is specific to your application.
      break;

    case Dropbox.ApiError.OVER_QUOTA:
      // The user is over their Dropbox quota.
      // Tell them their Dropbox is full. Refreshing the page won't help.
      break;

    case Dropbox.ApiError.RATE_LIMITED:
      // Too many API requests. Tell the user to try again later.
      // Long-term, optimize your code to use fewer API calls.
      break;

    case Dropbox.ApiError.NETWORK_ERROR:
      // An error occurr ed at the XMLHttpRequest layer.
      // Most likely, the user's network connection is down.
      // API calls will not succeed until the user gets back online.
      break;

    case Dropbox.ApiError.INVALID_PARAM:
    case Dropbox.ApiError.OAUTH_ERROR:
    case Dropbox.ApiError.INVALID_METHOD:
    default:
      // Caused by a bug in dropbox.js, in your application, or in Dropbox.
      // Tell the user an error occurred, ask them to refresh the page.
    }
    logger.log("Dropbox Error: " + error);
  };

  Dao.prototype = {
    constructor: Dao,
    
    /**
     * Dropboxの認証を得る
     * 
     * @return {Promise} 処理に対するPromiseオブジェクト
     */
    authenticate: function () {
      var deferred = $.Deferred(),
          self = this;
          
      if (self._client.isAuthenticated()) {
        deferred.resolve();
        return deferred.promise();
      }
      logger.log("- authenticate start.");
      self._client.authenticate(function (error, client) {
        if (error) {
          logger.log("- authenticate fail.");
          Dao.showError(error);
          // オフライン時、ここでresetしておかないと2回目の呼び出しでいっさい反応しなくなる
          self._client.reset();
          deferred.reject(error);
        } else {
          logger.log("- authenticate done.");
          self._client.stat("/recipes", function (error, stat) {
            
            // アプリのフォルダーの下に必要なフォルダーを作成しておく.
            if (error) {
              if (error.status === Dropbox.ApiError.NOT_FOUND) {
                self._client.mkdir("/recipes", function (error, stat) {
                  if (error) {
                    deferred.reject(error);
                  } else {
                    self._client.mkdir("/dictionary", function (error, stat) {
                      if (error) {
                        deferred.reject(error);
                      } else {
                        deferred.resolve();
                      }
                    });
                  }
                });
              } else {
                deferred.reject(error);
              }
            } else {
              deferred.resolve();
            }
          });
        }
      });
      return deferred.promise();
    },
    
    /**
     * 指定の時刻より後に更新されたレシピを全てダウンロードする.
     * 
     * @parama {Number} lastDownload 前回ダウンロードを実行した時刻
     * @return {Promise} 処理に対するPromiseオブジェクト
     *  成功時のコールバックの引数はレシピの配列
     */
    loadRecipes: function (lastDownload) { 
      var jobRecipe = $.Deferred(),
          recipes = [],
          self = this;
          
      self._client.readdir("/recipes", function (error, names, dirStat, stats) {
        var i, n,
            job,
            jobs = [],
            json;

        logger.log("- loadRecipes start.");
        if (error) {
          Dao.showError(error);
          jobRecipe.reject(error);
        } else {
          for (i = 0, n = stats.length; i < n; i++) {
            if (stats[i].modifiedAt.getTime() > lastDownload) {
              job = $.Deferred();
              jobs.push(job);
              (function (job) {
                self._client.readFile(stats[i].path, function (error, data, stat) {
                  if (error) {
                    Dao.showError(error);
                    job.reject(error);
                  } else {
                    json = JSON.parse(data);
                    json._id = stat.name.split(".")[0];
                    json.lastupdate = stat.modifiedAt.getTime();
                    //logger.log("- loadRecipes readFile: " + json.lastupdate);
                    //logger.log("- loadRecipes readFile: " + json.title);
                    recipes.push(json);
                    job.resolve();
                  }
                });
              })(job);
            }
          }
          $.when.apply(null, jobs).done(function () {
            logger.log("- loadRecipes resolve.");
            jobRecipe.resolve(recipes);
          });
        }
      });
      return jobRecipe.promise();
    },
    
    /**
     * 指定の時刻より後に更新された辞書データを全てダウンロードする.
     * 
     * @parama {Number} lastDownload 前回ダウンロードを実行した時刻
     * @return {Promise} 処理に対するPromiseオブジェクト
     *  成功時のコールバックの引数は辞書の配列
     */
    loadDicts: function (lastDownload) { 
      var jobDict = $.Deferred(),
          dicts = [],
          self = this;
          
      if (!self._client.isAuthenticated()) {
        logger.log("** isnot authenticated!!")
      }
      self._client.readdir("/dictionary", function (error, names, dirStat, stats) {
        var i, n,
            job,
            jobs = [],
            json;

        logger.log("- loadDicts start.");
        if (error) {
          Dao.showError(error);
          jobDict.reject(error);
        } else {
          for (i = 0, n = names.length; i < n; i++) {
            if (stats[i].modifiedAt.getTime() > lastDownload) {
              job = $.Deferred();
              jobs.push(job);
              (function (job) {
                self._client.readFile(stats[i].path, function (error, data, stat) {
                  if (error) {
                    Dao.showError(error);
                    job.reject(error);
                  } else {
                    json = JSON.parse(data);
                    json._id = stat.name.split(".")[0];
                    dicts.push(json);
                    //logger.log("- loadDicts readFile: " + json._id);
                    job.resolve();
                  }
                });
              })(job);
            }
          }
          $.when.apply(null, jobs).done(function () {
            logger.log("- loadDicts resolve.");
            jobDict.resolve(dicts);
          });
        }
      });
      return jobDict.promise();
    },
    
    /**
     * レシピをサーバーにアップロードする
     * 
     * @param {Recipe} recipe 対象のレシピ
     * @return {Promise} 処理に対するPromiseオブジェクト
     *  成功時のコールバックの引数はレシピの(新たな)ID
     */
    postRecipe: function (recipe) {
      var self = this,
          deferred = $.Deferred(),
          id = recipe._id,
          fileName,
          postData;
      
      if (recipe.deleted) {

        // LOCXXXのレシピはdeleted=trueでPOSTされることはないはず（ローカルだけで削除すればよい）
        // よってIDの補正は必要ない
        // スペース節約のためtitle以外の属性は削除する
        postData = {title:　recipe.title, deleted: true};
      } else {
        postData = recipe.copyForEditing();
        
        if (!recipe._id || recipe._id.match(/^LOC/)) {
          id = self.createId();
        }
        delete postData._id;
        delete postData.dirty;
        delete postData.beforeMa;
      }
      
      fileName = "/recipes/" + id + ".json";
      logger.log("- postRecipe start.");
      self._client.writeFile(fileName, JSON.stringify　　　　　　　　　　　　　　　　　　　　　　　　　　　　(postData), function (error, stat) {
        if (error) {
          Dao.showError(error);
          deferred.reject(error);
        } else {
          logger.log("- postRecipe done.");
          deferred.resolve(id);
        }
      });
          
      return deferred.promise();
    },
      
    /**
     * 辞書をサーバーにアップロードする
     * 
     * @param {String} ruby 読みがな
     * @param {String[]} words 読みがなに対応する漢字の配列
     * @return {Promise} 処理に対するPromiseオブジェクト
     *  成功時のコールバックの引数は空
     */
    postDict: function (ruby, words) {
      var self = this,
          deferred = $.Deferred(),
          fileName,
          postData;
      
      postData = {words:words};
      
      fileName = "/dictionary/" + ruby + ".json";
      self._client.writeFile(fileName, JSON.stringify(postData), function (error, stat) {
        if (error) {
          Dao.showError(error);
          deferred.reject();
        } else {
          deferred.resolve();
        }
      });
          
      return deferred.promise();
    },
    
    /**
     * 与えられた読みがなに対する辞書をサーバーから取得する
     * 
     * @param {String} ruby 読みがな
     * @return {Promise} 処理に対するPromiseオブジェクト
     *  成功時のコールバックの引数は対応する漢字の配列（存在しなければnull）
     */
    getDict: function (ruby) {
      var self = this,
          deferred = $.Deferred(),
          fileName,
          json;
      
      fileName = "/dictionary/" + ruby + ".json";
      self._client.readFile(fileName, function (error, data, stat) {
        if (error) {
          if (error.status === Dropbox.ApiError.NOT_FOUND) {
            deferred.resolve(null);
          } else {
            Dao.showError(error);
            deferred.reject(error);
          }
        } else {
          json = JSON.parse(data);
          json._id = stat.name.split(".")[0];
          deferred.resolve(json);
        }
      });
          
      return deferred.promise();
    },
    
    /**
     * 16文字のID文字列を返す
     * 
     * @return {String} ID文字列
     */
    createId: function () {
      var id = new Date().getTime().toString(16);
      id += (Math.floor(Math.random() * 0xf00000000) + 0x10000000).toString(16);
      return id.substring(0, 16);
    }

  };
  
  return Dao;
} ());


