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
     * データを保存するDropboxにアクセスするためのクライアントオブジェクトを得る.
     *
     * @return {Client} Dropboxにアクセスするためのクライアントオブジェクト
     */
    getDropboxClient: function () {
      if (!this._client) {
        this._client = new Dropbox.Client({
          key: "Sm+EaVJqcFA=|RXQCFKgGQEOP/7D1uJjdvv7J61aw/MESGoFCfp9g3w==", 
          sandbox: true
        });
        logger.log("Dropbox Client Created.");

        if (this.isPhoneGap) {
          this._client.authDriver(new Dropbox.Drivers.Cordova({
            rememberUser: true
          }));
        } else {
          this._client.authDriver(new Dropbox.Drivers.Redirect({
            useQuery: true,
            rememberUser: true
          }));
        }
        logger.log("Set Authdriver");
      }
      return this._client;
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
     * 編集ページを表示する
     * 
     * @param {Recipe} recipe 編集対象のレシピ、新規の場合は指定不要
     */
    startEditing: function (recipe) {
      context.editingRecipe = recipe ? 
          recipe.copyForEditing() : 
          new KOJS.recipe.model.Recipe();
      $.mobile.changePage("#edit-page", { changeHash: false, transition: "slideup"});       
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
    var jobSync;
    
    // ローカルストレージからの全レシピの読み込み
    context.repository = 
      new KOJS.recipe.model.Repository(
            context.getServerPath(), context.getDropboxClient());
    context.repository.loadFromLocal();

    // サーバーとの同期処理の呼び出し
    $("#dm-message").show();
    $.mobile.showPageLoadingMsg();
    jobSync = context.repository.syncWithServer();
    jobSync.always(function () {
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

      // 最初のページの表示
      // （起動直後にはダミーページがロードされている）
      var count = context.repository.getCount();
      logger.log("* local recipe count = " + count);
      // 起動時には常にDropboxと同期するよう修正
//      if (count === 0) {
        jobSync.always(function () {
          logger.log("* jobSync done");
          $.mobile.changePage(context.currentPage, {changeHash: false});
        });
//      } else {
//        logger.log("* direct change");
//        $.mobile.changePage(context.currentPage, {changeHash: false});
//      }
    });
  };

  $(document).on("deviceready", function () {
    // PhoneGapの場合、この前にネットへのアクセスを実行するとネットワークが解放されるまで
    // ここに到達しない　→ モバイルでアドレスが見つからない場合、１分以上待たされる
    logger.log("device ready");
    logger.deviceReady();
    init();
  });

  if (!context.isPhoneGap) {
    var msg = "レシピ帳をご利用いただきありがとうございます。\n" +
              "2014年9月より、複数端末で共有するデータの保存先にDropboxではなく独自のサーバーを" +
              "使用する新しいバージョンを以下のアドレスで公開しております。\n" +
              "http://recipenote.herokuapp.com/recipenote2.html\n" +
              "iPad版も新バージョンがAppStoreで公開されています。今後は新バージョンを" +
              "お使いいただく様お願いいたします。\n" +
              "\n" +
              "今すぐ新バージョンを使用しますか？";
              
    if (confirm(msg)) {
       document.location = "recipenote2.html";
    }

    // 通常のWEBの場合、即座に初期化処理開始
    init();
  }
});
  
