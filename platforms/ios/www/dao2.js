KOJS.namespace("recipe.model");

/**
 * サーバーに保存されている情報をやり取りするオブジェクト
 */
KOJS.recipe.model.Dao = (function () {
  // ネームスペース省略用のローカル変数
  var Dao,
      logger = undefined;

  /**
   * コンストラクタ
   */
  Dao = function () {
    logger = KOJS.util.Logger.get();
    
    this._user = undefined;
  };
  
  /**
   * エラーハンドラ（実際にはログに記録するだけ）
   *
   * @param {ApiError} error 発生したエラーオブジェクト
   */
  Dao.showError = function(error) {
    logger.log("KiiCloud Error: " + error);
  };

  Dao.prototype = {
    constructor: Dao,
    
    /**
     * 認証処理（接続時に認証済みなので、認証済かどうかをチェックする）
     * 
     * @return {Promise} 処理に対するPromiseオブジェクト
     */
    authenticate: function () {
      var deferred = $.Deferred(),
          bucket;
          
      this._user = KiiUser.getCurrentUser();
      if (this._user) {
        deferred.resolve();
      } else {
        deferred.reject();
      }
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
          self = this,
          bucket = self._user.bucketWithName("recipes"),
          query = KiiQuery.queryWithClause(
                    KiiClause.greaterThan("_modified", lastDownload));
      
      var queryCallbacks = {
        success: function(queryPerformed, resultSet, nextQuery) {
          var i, n, obj, 
            json;

            for (i = 0, n = resultSet.length; i < n; i++) {
              obj = resultSet[i];
              json = obj.get("recipe");
              json._id = obj.getUUID();
              // DropboxからKiiCloudへの移行時に順番がおかしくなってしまうのを防ぐため
              // lastupdateの変更は取りやめ
              //json.lastupdate = obj.get("_modified");
              recipes.push(json);
            }

            if (nextQuery != null) {
                bucket.executeQuery(nextQuery, queryCallbacks);
            } else {
              logger.log("- loadRecipes resolve.");
              jobRecipe.resolve(recipes);              
            }
        },

        failure: function(queryPerformed, errorString) {
          Dao.showError(errorString);
          jobRecipe.reject(errorString);
        }
      };
      bucket.executeQuery(query, queryCallbacks);
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
          self = this,
          bucket = self._user.bucketWithName("dictionary"),
          query = KiiQuery.queryWithClause(
                    KiiClause.greaterThan("_modified", lastDownload));
      
      var queryCallbacks = {
        success: function(queryPerformed, resultSet, nextQuery) {
          var i, n, obj, 
            json;

            for (i = 0, n = resultSet.length; i < n; i++) {
              obj = resultSet[i];
              json = {words:obj.get("words"), 
                ruby:self.unescapeRuby(obj.getUUID())};
              dicts.push(json);
            }

            if (nextQuery != null) {
                bucket.executeQuery(nextQuery, queryCallbacks);
            } else {
              logger.log("- loadDicts resolve.");
              jobDict.resolve(dicts);              
            }
        },

        failure: function(queryPerformed, errorString) {
          Dao.showError(errorString);
          jobDict.reject(errorString);
        }
      };
      bucket.executeQuery(query, queryCallbacks);
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
          postData,
          bucket,
          obj;
      
      if (recipe.deleted) {

        // LOCXXXのレシピはdeleted=trueでPOSTされることはないはず
        // （ローカルだけで削除すればよい）
        // よってIDの補正は必要ない
        // スペース節約のためtitle以外の属性は削除する
        postData = {title: recipe.title, deleted: true};
      } else {
        postData = recipe.copyForEditing();
        
        if (!recipe._id || recipe._id.match(/^LOC/)) {
          id = self.createId();
        }
        delete postData._id;
        delete postData.dirty;
        delete postData.beforeMa;
      }
      
      bucket = self._user.bucketWithName("recipes");
      obj = bucket.createObjectWithID(id);
      obj.set("recipe", postData);
      logger.log("- postRecipe start.");
      obj.saveAllFields({
        success: function(theSavedObject) {
          logger.log("- postRecipe done.");
          deferred.resolve(id);
        },

        failure: function(theObject, errorString) {
          Dao.showError(errorString);
          deferred.reject(errorString);
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
      var deferred = $.Deferred(),
          bucket,
          obj,
          id;
      
      bucket = this._user.bucketWithName("dictionary");
      id = this.escapeRuby(ruby);
      if (id.length < 2) {
        deferred.reject("ruby too short.");
        return deferred.promise();
      }
      obj = bucket.createObjectWithID(id);
      obj.set("words", words);
      obj.saveAllFields({
        success: function(theSavedObject) {
          deferred.resolve();
        },

        failure: function(theObject, errorString) {
          Dao.showError(errorString);
          deferred.reject(errorString);
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
          id = self.escapeRuby(ruby),
          bucket,
          query = KiiQuery.queryWithClause(
                    KiiClause.equals("_id", id));
      
      bucket = self._user.bucketWithName("dictionary");
      var queryCallbacks = {
        success: function(queryPerformed, resultSet, nextQuery) {
          var json, obj;
          logger.log("..getDict(" + ruby + ") done." + resultSet.length);
          if (resultSet.length) {
            obj = resultSet[0];
            json = {words:obj.get("words"), ruby:ruby};
            deferred.resolve(json);
          } else {
            deferred.resolve();            
          }
        },

        failure: function(queryPerformed, errorString) {
          logger.log("..getDict(" + ruby + ") fail.");
          Dao.showError(errorString);
          deferred.reject(errorString);            
        }
      };
      try {
        bucket.executeQuery(query, queryCallbacks);
        logger.log("..getDict(" + ruby + ") start.");
      } catch (e) {
        
      }
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
    },
    
    /**
     * 読みがなをKiiCloudのIDとして使用できる文字列に変更する
     * 
     * @return {String} ID文字列
     */
    escapeRuby: function (ruby) {
      return escape(ruby).replace(/%/g, ".");
    },
    
    /**
     * KiiCloudのID文字列から読みがなを復元する
     * 
     * @return {String} 読みがな
     */
    unescapeRuby: function (id) {
      return unescape(id.replace(/\./g, "%"));
    }
  };
  
  return Dao;
} ());


