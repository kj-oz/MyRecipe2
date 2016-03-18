/**
 * 『レシピ帳』アプリケーション
 */
$(document).ready(function() {

  // アプリケーション全体で共有する情報を保持するオブジェクト
  var context = {
    // デフォルトの検索条件
    defCondition: {
      keyword: "",
      rank: "1",
      difficulty: "5",
      category: "*"
      // 並び順はdefには入れない
    },

    // PhoneGapかWEBか
    isPhoneGap: (document.URL.substring(0, 4) != "http"),

    // SNBinder用テンプレート
    templates: undefined,

    // 全てのレシピのセット
    repository: undefined,

    // 詳細ページ用に選択したレシピのセット
    selection: [],

    // 詳細ページで詳細を表示しているレシピ
    currentRecipe: undefined,

    // 次回起動時に表示する（最後に表示している）ページ（編集ページは対象外）
    currentPage: "",

    // 一覧ページの絞り込み条件
    condition: undefined,

    // 編集ページで編集中のレシピ
    editingRecipe: undefined,

    // コミット中かどうか
    commiting: false,

    // サインアップした後か
    signupped: false,

    // 初期化後か
    initialized: false,

    /**
     * cp 及び ma を呼び出すサーバーのアドレスを得る.
     * 余計な変数でスコープを汚さない様、関数の中で求める
     *
     * @return {String} サーバーのアドレス
     */
    getServerPath: function () {
      var url, i;

      if (!this._serverPath) {
        if (this.isPhoneGap) {
          this._serverPath = "http://recipenote.herokuapp.com";
        } else {
          url = document.URL;
          i = url.lastIndexOf("/");
          this._serverPath = url.substring(0, i);
        }
      }
      return this._serverPath;
    },

    /**
     * データを保存するKiiCloudにアクセスするための認証を得る.
     *
     * @return {Promise} 処理に対するPromiseオブジェクト
     */
    kiiLogin: function () {
      var self = this,
          deferred = $.Deferred(),
          token = localStorage["kiiToken"],
          offline = localStorage["offline"];
      logger.log("- kiiLogin start");
      if (!navigator.onLine || offline) {
        logger.log("- kiiLogin reject: offline");
        deferred.reject();
      } else if (token) {
        KiiUser.authenticateWithToken(token, {
          success: function(user) {
            self.saveUser(user);
            logger.log("- kiiLogin: authenticated with token > getUploadedCount");
            self.getUploadedCount().always(function() {
              logger.log("- kiiLogin resolve: getUploadedCount over");
              deferred.resolve();
            });
          },
          failure: function(user, errorString) {
            logger.log("- kiiLogin: error authenticating with token > showLogin");
            self.showLogin(deferred);
          }
        })
      } else {
        logger.log("- kiiLogin: no token > showLogin");
        self.showLogin(deferred);
      }
      logger.log("- kiiLogin: return");
      return deferred.promise();
    },

    /**
     * ログインページを表示する.
     *
     * @param {Promise} 処理に対するPromiseオブジェクト
     */
    showLogin: function (deferred) {
      var self = this;
      logger.log("- showLogin: start")
      KOJS.recipe.page.LoginPage.show("#dummy-page").then(function() {
        logger.log("- showLogin done > getUploadedCount");
        self.getUploadedCount().always(function() {
          logger.log("- showLogin resolve: getUploadCount over");
          localStorage.removeItem("offline");
          self.initialized = true;
          deferred.resolve();
        });
      }, function() {
        logger.log("- showLogin reject: LoginPage fail");
        if (!self.initialized) {
          localStorage["offline"] = true;
          self.initialized = true;
        }
        deferred.reject();
      });
    },

    /**
     * アップロード済みのレシピ数を得る.
     * 結果は、KiiUserオブジェクトの属性"uploadedCount"に保持する.
     *
     * @return {Promise} 処理に対するPromiseオブジェクト
     */
    getUploadedCount: function () {
      var user = this._user,
          deferred = $.Deferred(),
          bucket = user.bucketWithName("recipes");
      logger.log("- getUploadedCount start")
      bucket.count({
        success: function(bucket, query, count) {
          logger.log("- getUploadedCount resolve: count done " + count);
          user.set("uploadedCount", count);
          deferred.resolve();
        },
        failure: function(bucket, query, errorString) {
          logger.log("- getUploadedCount resolve: count fail");
          user.set("uploadedCount", 0);
          deferred.resolve();
        }
      });
      logger.log("- getUploadedCount return");
      return deferred.promise();
    },

    /**
     * ローカルストレージから以下の設定情報を読み込む
     *
     *  selection: 選択されているレシピのidの配列
     *  currentRecipe: 詳細ページで最後に表示したレシピのid
     *  condition: 最後に設定されていたレシピ抽出の条件のJSONオブジェクト
     *  currentPage: 最後に表示されたページのid、先頭の#付き
     */
    loadSettings: function () {
      var savedString,
          selectionIds,
          i, n, id,
          recipe;

      // 選択レシピの復元
      savedString = localStorage["selection"];
      selectionIds = savedString ? JSON.parse(savedString) : [];
      for (i = 0, n = selectionIds.length; i < n; i++) {
        recipe = this.repository.get(selectionIds[i]);
        if (recipe) {
          this.selection.push(recipe);
        }
      }

      // カレントレシピの復元
      id = localStorage["currentRecipe"] || "";
      recipe = this.repository.get(id);
      if (recipe) {
        this.currentRecipe = recipe;
      }

      // 抽出条件の復元
      savedString = localStorage["condition"];
      this.condition = savedString ?
          JSON.parse(savedString) : $.extend({}, this.defCondition);
      this.condition.sort = this.condition.sort || "random";

      // 最終ページの復元
      this.currentPage = "#list-page";
      if (this.selection.length &&
          localStorage["currentPage"] === "#detail-page") {
        this.currentPage = "#detail-page";
      }
    },

    /**
     * カレントのページの設定と保存
     *
     * @param {String} page カレントのページ
     */
    setCurrentPage: function (page) {
      this.currentPage = page;
      localStorage["currentPage"] = page;
    },

    /**
     * カレントのレシピの設定と保存
     *
     * @param {String} recipe カレントのレシピのID
     */
    setCurrentRecipe: function (recipe) {
      this.currentRecipe = recipe;
      localStorage["currentRecipe"] = recipe._id;
    },

    /**
     * 抽出条件の保存
     */
    saveCondition: function () {
      localStorage["condition"] = JSON.stringify(this.condition);
    },

    /**
     * 選択レシピの保存
     */
    saveSelection: function () {
      localStorage["selection"] = JSON.stringify(
        this.selection.map(function (value, index) {return value._id;})
      );
    },

    /**
     * ログイン情報の保存
     */
    saveUser: function (user) {
      this._user = user;
      localStorage["kiiToken"] = user.getAccessToken();
      localStorage["mailAddress"] = user.getEmailAddress();
    },

    /**
     * 編集ページを表示する
     *
     * @param {Recipe} recipe 編集対象のレシピ、新規の場合は指定不要
     */
    startEditing: function (recipe) {
      context.editingRecipe = recipe ?
          recipe.copyForEditing() :
          new KOJS.recipe.model.Recipe();
      $.mobile.changePage("#edit-page",
                { changeHash: false, transition: "slideup"});
    },

    /**
     * 編集ページで編集した結果を取り込む
     */
    commitEditing: function () {
      var recipe = this.editingRecipe,
          self = this,
          editing = !(!recipe._id);

      if (!this.commiting) {
        logger.log("before update.");
        this.commiting = true;
        $.mobile.showPageLoadingMsg();
        this.repository.update(recipe).always(function () {
          var index;
          logger.log("update always.");
          if (editing) {
            index = self.selection.indexOf(self.currentRecipe);
            self.selection[index] = recipe;
            self.currentRecipe = recipe;
          } else if (context.selection.length < 6) {
            self.selection.push(recipe);
            self.currentRecipe = recipe;
          }
          self.commiting = false;
          $.mobile.hidePageLoadingMsg();
          self.endEditing();
        });
      }
    },

    /**
     * 編集ページを閉じて元のページに戻る
     */
    endEditing: function () {
      logger.log("end editing: " + this.currentPage);
      this.editingRecipe = undefined;
      $.mobile.changePage(this.currentPage, {changeHash: false, riverse: true});
    },

    /**
     * 与えられたレシピを削除する
     *
     * @param {Recipe} recipe 削除するレシピ
     */
    removeRecipe: function (recipe) {
      var self = this;

      this.repository.remove(recipe).always(function () {
        logger.log("> repository.remove always: " + recipe._id);
        var index;
        if (recipe === self.currentRecipe) {
          self.currentRecipe = undefined;
          delete localStorage["currentRecipe"];
        }
        index = self.selection.indexOf(recipe);
        if (index >= 0) {
          self.selection.splice(index, 1);
          self.saveSelection();
        }
      });
    },

    /**
     * KiiCloudへ初めて接続しているかの判定
     *
     * @return {Boolean} recipe KiiCloudへ初めて接続しているユーザーか
     */
    isFirstSync: function () {
      return this._user && !this._user.get("uploadedCount");
    }
  };

  // 起動時間計測用ログを記録するための機構
  var Logger = KOJS.util.Logger,
      logger;

  if (context.isPhoneGap) {
    logger = Logger.phoneGapLogger();
  } else {
    logger = Logger.consoleLogger();
  }
  Logger.set(logger);
  logger.log("document ready");

  /**
   * 実質的な初期化処理を行う.
   */
  var init = function () {
    var jobSync,
        version = localStorage["version"],
        msg,
        Secret = KOJS.util.Secret;

    localStorage["version"] = "2.1";
    Kii.initializeWithSite(Secret.getKiiAppId(),
           Secret.getKiiAppAccessKey(), KiiSite.JP);

    // 各ページのセットアップ
    KOJS.recipe.page.LoginPage.setup(context);
    KOJS.recipe.page.SignupPage.setup(context);

    // ローカルストレージからの全レシピの読み込み
    context.repository =
      new KOJS.recipe.model.Repository(context.getServerPath());
    context.repository.loadFromLocal();

    // サーバーとの同期処理の呼び出し
    context.kiiLogin().always(function () {
      logger.log("- kiiLogin over");
      $("#dm-message").show();
      $.mobile.showPageLoadingMsg();
      if (context.isFirstSync()) {
        logger.log("- jobSync(uploadAll) start");
        jobSync = context.repository.uploadAll();
        logger.log("- jobSync(uploadAll) return");
      } else {
        logger.log("- jobSync(syncWithServer) start");
        jobSync = context.repository.syncWithServer();
        logger.log("- jobSync(syncWithServer) return");
      }

      jobSync.always(function () {
        logger.log("- jobSync over 1 > hide message");
        $("#dm-message").hide();
        $.mobile.hidePageLoadingMsg();
      })

      // ローカルストレージからの設定値の読み込み
      context.loadSettings();

      // テンプレートシステムの初期化
      SNBinder.init({});

      /**
       * SNBinderでプリミティブ型の配列を扱うためのヘルパ関数
       * この関数の結果をSNBinderのrowsetとして渡すと、
       * 配列の番号が.indexで、値が.valueで参照できる
       *
       * @param {Array} arr 対象のプリミティブ型の配列
       * @param {Number} startIndex .indexで参照できる番号の開始値
       * @return {Object[]} .indexと.valueメンバーで構成されるオブジェクトの配列
       */
      SNBinder.transform_array = function (arr, startIndex) {
        startIndex = startIndex ? startIndex : 0;
        return arr.map(function (val, i, array) {
          return {index: i + startIndex, value: val};
        })
      };

      // SNBinderのテンプレートの読み込み
      SNBinder.get_named_sections("recipenote.tmpl", null, function (templates) {
        context.templates = templates;

        // 各ページのセットアップ
        KOJS.recipe.page.DetailPage.setup(context);
        KOJS.recipe.page.ListPage.setup(context);
        KOJS.recipe.page.EditPage.setup(context);
        KOJS.recipe.page.ChangePasswordPage.setup(context);

        // 最初のページの表示
        // （起動直後にはダミーページがロードされている）
        var count = context.repository.getCount();
        logger.log("* local recipe count = " + count);
        jobSync.always(function () {
          logger.log("- jobSync over 2 > changePage " + context.currentPage);
          $.mobile.changePage(context.currentPage, {changeHash: false});
        });
      });
    })
  };

  $(document).on("deviceready", function () {
    // PhoneGapの場合、この前にネットへのアクセスを実行するとネットワークが解放されるまで
    // ここに到達しない　→ モバイルでアドレスが見つからない場合、１分以上待たされる
    logger.log("device ready");
    logger.deviceReady();
    init();
  });

  if (!context.isPhoneGap) {
    // 通常のWEBの場合、即座に初期化処理開始
    init();
  }
});
