KOJS.namespace("recipe.model");

/**
 * 保存されている全レシピの情報を保持するオブジェクト
 */
KOJS.recipe.model.Repository = (function () {
  // ネームスペース省略用のローカル変数
  var Repository, 
      Recipe = KOJS.recipe.model.Recipe,
      logger = undefined;

  /**
   * コンストラクタ
   * 
   * @param {String} serverPath レシピを管理しているサーバーのURL
   * @param {Client} Dropboxアクセス用クライアント
   */
  Repository = function (serverPath, dropboxClient) {
    logger = KOJS.util.Logger.get();

    // 全レシピのマップ（キーはレシピ名）
    this._newRecipeCount = 0;
    this._recipes = {};
    this._serverPath = serverPath;
    this._dao = new KOJS.recipe.model.Dao(dropboxClient);
  };

  Repository.prototype = {
    constructor: Repository,
    
    /**
     * 保存されているレシピ、辞書をローカルストレージから読み込む
     */
    loadFromLocal: function () {
      logger.log("Repository.loadFromLocal start");
      var recipeString = localStorage["recipes"],
          dictString = localStorage["dictionary"],
          newWords = localStorage["newWords"],
          recipes, id, recipe,
          ruby, i, n, words;
          
      // ローカルのレシピのロード    
      this._recipes = {};
      if (recipeString) {
        recipes = JSON.parse(recipeString);
        for (id in recipes) {
          if (recipes.hasOwnProperty(id)) {
            this._recipes[id] = new Recipe(recipes[id]);
          }
        }
      }
      
      // ローカルから読み込んだデータの辞書化
      if (dictString) {
        this._dictionary = JSON.parse(dictString);
      } else {
        this._dictionary = {};
      }
      
      this._words = {};
      for (ruby in this._dictionary) {
        if (this._dictionary.hasOwnProperty(ruby)) {
          words = this._dictionary[ruby];
          for (i = 0, n = words.length; i < n; i++) {
            this._words[words[i]] = ruby;
          }
        }
      }
      
      // サーバーへアップしていない新出単語
      if (newWords) {
        this._newWords = JSON.parse(newWords);
      } else {
        this._newWords = {};
      }
      
      logger.log("Repository.loadFromLocal done");
    },
    
    /**
     * サーバーとの同期処理を行う.
     * 
     * @return {Promise} サーバーとの同期処理に対するPromiseオブジェクト
     */
    syncWithServer: function () {
      
      // 戦略: 
      // 1. ローカルストレージに保存されている前回ダウンロード日時を読み取る
      // 2. サーバーから前回ダウンロード時以降に更新があったレシピをダウンロードし(①)、
      // 　　ローカルのデータのdirty=true（ローカルで更新）になっているもの以外を、
      // 　　置き換え候補として保存する
      // 3. 前回ダウンロード時以降に更新があった辞書をダウンロードし(②)、ローカルの辞書を
      // 　　置き換える（辞書は追加のみ可能なので即座に置き換え）
      // 4. ローカルで追加・更新されているレシピをサーバーにアップロードする(③)
      // 　　その際、仮ID対正式IDのマップを保存する
      // 5. 単語の抽出がまだのレシピの単語の抽出を行う(④)、また追加された単語に関する
      //　　 辞書の更新が済んでいないものの更新を行う(⑤)
      // 6. これらが成功した場合、ローカルのデータにサーバー側の更新内容を反映する
      var self = this,
          jobSync = $.Deferred();
       
      if (self._serverUpdates) return jobSync.resolve().promise();
      logger.log("Repository.syncWithServer start");
      
                 
      return self._dao.authenticate().then(function () {
        logger.log("DropBox authenticate success");

        var lastDownload = localStorage["lastDownload"] || 0,
            id, recipe,
            postRecipes = [],     // サーバーにPOSTを試みるレシピ
            checkWordRecipes = [],
            serverUpdates = {
              downloadAt: new Date().getTime(),
              recipes: [],
              posts: {}
            },
            jobRecipe, jobDict,
            jobWords = [];

        // POST対象、単語チェック対象のレシピの洗い出し    
        for (id in self._recipes) {
          if (self._recipes.hasOwnProperty(id)) {
            recipe = self._recipes[id];
            if (recipe.dirty) {
              postRecipes.push(recipe);
            } else if (recipe.beforMa) {
              checkWordRecipes.push(recipe);
            }
          }
        }

        // ① 最初にレシピ更新分のダウンロード
        jobRecipe = $.Deferred();
        jobDict = $.Deferred();
        logger.log("① load recipe start.");
        self._dao.loadRecipes(lastDownload).then(function (recipes) {
          serverUpdates.recipes = recipes.filter(function (value, index, array) {
            var id = value._id;
            return !(self._recipes[id] && self._recipes[id].dirty);
          });
          logger.log("① load recipe success: " + serverUpdates.recipes.length);
        }, function (error) {
          logger.log("① load recipe fail. " + error);
          jobRecipe.reject(error);
        }).then(function () {
          // ② 次に（レシピダウンロードが成功したら）辞書の更新分ダウンロード
          logger.log("② load dict start.");
          return self._dao.loadDicts(lastDownload).then(function (dicts) {
            var i, n,
                j, m,
                data;
                
            for (i = 0, n = dicts.length; i < n; i++) {
              data = dicts[i];
              self._dictionary[data._id] = data.words;
              for (j = 0, m = data.words.length; j < m; j++) {
                self._words[data.words[j]] = data._id;
              }
            }
            self.saveDictionary();
            logger.log("② load dict success: " + dicts.length);
            jobDict.resolve();
          }, function (error) {
            logger.log("② load dict fail. " + error);
            jobDict.reject(error);
          });
        }).then(function () {
          // ③ ローカルで編集したレシピのアップロード
          var recipe,
              i, n, funcs = [];

          logger.log("③ post recipe start.");
          for (i = 0, n = postRecipes.length; i < n; i++) {
            // クロージャに正しくrecipeを渡すために無名関数化
            (function (recipe) {
              funcs.push(self._dao.postRecipe(recipe).then(function (newId) {
                serverUpdates.posts[recipe._id] = newId;
                return self._checkNewWords(recipe).then(function (data) {
                  var i, n;

                  for (i = 0, n = data.length; i < n; i++) {
                    jobWords.push(self._updateDictionary(data[i].ruby, data[i].word));
                  }
                }, function () {
                  recipe.beforeMa = true;
                });
              }));
            })(postRecipes[i]);
          }
          return $.when.apply(null, funcs).always(function () {
            logger.log("③ post recipe done.");
            jobRecipe.resolve();
          });
        }).then(function () {
          // ④ アプロード済みだが単語抽出がまだのレシピの単語抽出
          var recipe,
              i, n, funcs = [];

          logger.log("④ check word start.");
          for (i = 0, n = checkWordRecipes.length; i < n; i++) {
            // クロージャに正しくrecipeを渡すために無名関数化
            (function (recipe) {
              funcs.push(self._checkNewWords(recipe).then(function (data) {
                var i, n;

                for (i = 0, n = data.length; i < n; i++) {
                  jobWords.push(self._updateDictionary(data[i].ruby, data[i].word));
                }
              }));
            })(checkWordRecipes[i]);
          }
          return $.when.apply(null, funcs);         
        }).then(function () {
          // ⑤ ローカル側で更新されてサーバー側にアップロードできていない単語のアップロード処理
          var word,　ruby;

          logger.log("⑤ update dict start.");
          for (word in self._newWords) {
            if (self._newWords.hasOwnProperty(word)) {
              jobWords.push(self._updateDictionary(self._newWords[word], word).done(function () {
                delete self._newWords[word];
              }));
            }
          }
        }).then(function () {
          if (jobWords.length) {
            $.when.apply(null, jobWords).always(function () {
              logger.log("all jobWords done.");
              self.saveDictionary();
            });
          }
        });
                  
        return $.when(jobRecipe, jobDict).then(function () {
          self._serverUpdates = serverUpdates;
          logger.log("Repository.syncWithServer done");
          self.mergeUpdates();
        });
      }, function (error) {
        logger.log("DropBox authenticate fail: " + error);
      });
    },

    /**
     * サーバーからダウンロードした結果を、現在のデータにマージする.
     * 
     * @return {Boolean} 仮IDの正式IDへの変更が発生したかどうか
     */
    mergeUpdates: function () {
      if (!this._serverUpdates) return false;
      
      var i, n, 
          id, recipe,
          data,
          nChangeId = 0,
          newId;
          
      logger.log("Repository.mergeUpdate start")

      // サーバー側更新レシピの取込み    
      logger.log(" - recipes.length = " + this._serverUpdates.recipes.length);
      for (i = 0, n = this._serverUpdates.recipes.length; i < n; i++) {
        data = this._serverUpdates.recipes[i];
        id = data._id;
        if (data.deleted) {
          delete this._recipes[id];
        } else {
          this._recipes[id] = new Recipe(data);
        }
      }
      
      // ローカルで編集をPOSTした結果の反映
      for (id in this._serverUpdates.posts) {
        if (this._serverUpdates.posts.hasOwnProperty(id)) {
          recipe = this._recipes[id];
          newId = this._serverUpdates.posts[id];
          
          delete recipe.dirty;
          if (recipe._id.match(/^LOC/)) {
            this._recipes[newId] = recipe;
            delete this._recipes[recipe._id];
            recipe._id = newId;
            nChangeId++;
          } else if (recipe.deleted) {
            delete this._recipes[recipe._id];
          }
        }
        logger.log(" - posts:" + id + " done.");
      }
      logger.log("before saveLocal");
      this.saveRecipes();
      localStorage["lastDownload"] = this._serverUpdates.downloadAt;
      logger.log("after saveLocal");
            
      delete this._serverUpdates;
      
      logger.log("Repository.mergeUpdate done");
      return nChangeId > 0;
    },

    /**
     * 編集ページでのレシピの編集結果を取り込む
     * 
     * @param {Recipe} recipe 編集されたレシピ
     * @return {Promise} レシピ等の更新処理に対するPromiseオブジェクト
     */
    update: function (recipe) {

      // 戦略
      // 1. 編集結果をサーバーへアップロードする
      // 2. 1が成功した場合、ローカル上のレシピのIDを正式なものに修正し、
      //　　 レシピの中に新規の単語が含まれていないかをチェックする
      //　　 1が失敗した場合には、次回同期時にアップロードするようにdirtyフラグをたてる
      // 3. 2が成功した場合、新規の単語の全てに対して、辞書の更新処理を呼び出す
      //　　 (1が成功して)2が失敗した場合、次回同期時に新規単語のチェックを行うよう、
      //　　 beforeMaフラグをたてる（MA:形態素分析）
      // 4. 全単語の3の処理が終了したらば、辞書のローカルへの保存を行う
      // 5. 4までが全て終了したらば、レシピのローカルへの保存を行う
      var self = this;
      
      logger.log("post recipe start: " + recipe.title);
      
      // 編集したものの更新日をセット
      recipe.lastupdate = new Date().getTime();
      recipe.dirty = true;
      if (!recipe._id) {
        // 新規追加レシピのランダム値を負の値に（先頭にくるように）
        self._newRecipeCount++;
        recipe.random = -self._newRecipeCount;
      }        
      return self._dao.authenticate().then(function () {
        return self._dao.postRecipe(recipe).then(function (newId) {
          logger.log("post recipe done, check id.")
          delete recipe.dirty;
          if (!recipe._id || recipe._id.match(/^LOC/)) {
            if (recipe._id) {
              delete self._recipes[recipe._id];
            }
            recipe._id = newId;
          }
          logger.log("post recipe. before checkwords.");
          return self._checkNewWords(recipe);
        }, function () {
          // サーバーに保存できなければ、dirty=trueとし、追加時は仮のIDをつける
          logger.log("post recipe fail, set dirty.");
        }).then(function (data) {
          logger.log("checkwords done.");
          var i, n,
              jobs = [];
          for (i = 0, n = data.length; i < n; i++) {
            jobs.push(self._updateDictionary(data[i].ruby, data[i].word, true));
          }
          return $.when.apply(null, jobs).always(function () {
            self.saveDictionary();
            logger.log("post recipe done: " + recipe.title);
          });
        }, function (error) {
          logger.log("checkwords fail: " + error);
          recipe.beforeMa = true;
        });
      }, function (error) {
        logger.log("post recipe fail: " + error);
        return $.Deferred().resolve().promise();
      }).then(function () {
        if (!recipe._id) {
          recipe._id = "LOC" + new Date().getTime();
        }        
        self._recipes[recipe._id] = recipe;
        self.saveRecipes();
      });
    },
          
    /**
     * 与えられたレシピのタイトル、材料名に新しい単語が使用されていいないかを調べる
     *
     * @param {Recipe} recipe 対象のレシピ
     * @return {Promise} 処理に対するPromiseオブジェクト
     * 　成功時のコールバックは新しい単語（ruby:読み、word:書き文字）の配列を引数に呼び出される
     */
    _checkNewWords: function (recipe) {
      var self = this,
          deferred = $.Deferred(),
          phrase = recipe.title,
          i, n,
          url;
          
      for (i = 0, n = recipe.ingredients.length; i < n; i++) {
        phrase += "," + recipe.ingredients[i].name;
      }
      
      logger.log("- checkNewWords start.");
      url = encodeURI(this._serverPath + "/ma?sentence=" + phrase);
      $.getJSON(url).done(function (data) {
        delete recipe.beforeMa;
        var newWords = data.filter(function (value, index, array) {
          return !self._words[value.word];
        });
        logger.log("- checkNewWords done: " + JSON.stringify(newWords));
        deferred.resolve(newWords);
      }).fail(function (xhr, status, ex) {
        logger.log("- checkNewWords fail.");
        deferred.reject(ex);
      });
      
      return deferred.promise();
    },
      
    /**
     * 与えられた単語を辞書に追加する
     *
     * @param {String} ruby 読みがな
     * @param {String} word 書き文字
     * @param {Boolean} readFirst 最初にサーバーから与えられた読みに対する最新の情報を読み込むかどうか
     * @return {Promise} 処理に対するPromiseオブジェクト
     */
    _updateDictionary: function (ruby, word, readFirst) {
      var self = this,
          deferred = $.Deferred();
      
      logger.log("- upfateDictionary start: " + ruby + " " + word);
      if (readFirst) {
        self._dao.getDict(ruby).then(function (dict) {
          var i, n;
          if (dict) {
            self._dictionary[dict._id] = dict.words;
            for (i = 0, n = dict.words.length; i < n; i++) {
              self._words[dict.words[i]] = dict._id;
            }
          }
          if (!self._words[word]) {
            return self._addWord(ruby, word, true);
          }
        }, function () {
          self._addWord(ruby, word);
        });
      } else {
        return self._addWord(ruby, word, true);
      }
    },
    
    /**
     * 新しい単語を、ローカル及びサーバーに追加する.
     * 
     * @param {String} ruby 読みがな
     * @param {String} word 書き文字
     * @param {Boolean} post サーバーアップロードするかどうか
     * @return {Promise} 処理に対するPromiseオブジェクト
     */
    _addWord: function (ruby, word, post) {
      var self = this;
      
      logger.log("- addWord start: " + ruby + " " + word);
      self._words[word] = ruby;
      if (self._dictionary[ruby]) {
        self._dictionary[ruby].push(word);
      } else {
        self._dictionary[ruby] = [word];
      }
      
      if (post) {
        return self._dao.postDict(ruby, self._dictionary[ruby]).fail(function () {
          self._newWords[word] = ruby;
        });
      } else {
        self._newWords[word] = ruby;
        return $.Deferred().resolve().promise();
      }
    },
      
    /**
     * レシピを削除する
     * 
     * @param {Promise} recipe 削除するたレシピ
     * @return {Promise} 削除処理に対するPromiseオブジェクト
     */
    remove: function (recipe) {
      var self = this, 
          id = recipe._id, index;

      logger.log("> repository.remove start: " + id);
      if (id.match(/^LOC/)) {
        var deferred = $.Deferred();
        delete self._recipes[id];
        self.saveRecipes();
        deferred.resolve();
        return deferred.promise();
      } else {
        recipe.deleted = true;
        recipe.dirty = true;
        return self._dao.authenticate().then(function () {
          logger.log("> repository.remove / authenticate done: " + id);
          return self._dao.postRecipe(recipe).then(function () {
            logger.log("> repository.remove / postRecipe done: " + id);
            delete self._recipes[id];
          }).always(function () {
            self.saveRecipes();
          });
        }, function () {
          self.saveRecipes();
        });
      }
    },

    /**
     * 条件に合致するレシピの配列を取得する
     * 
     * @param {Object} condition 絞込みの条件
     */
    filter: function (condition) {
      var id,
          i, j, work,
          recipe, 
          recipes = this._recipes, 
          filteredRecipes = [],
          searchWords = [];

      searchWords = this._getSearchKeywords(condition.keyword.trim());
      for (id in recipes) {
        if (recipes.hasOwnProperty(id)) {
          recipe = recipes[id];
          if (recipe.match(condition, searchWords)) {
            filteredRecipes.push(recipe);
          }
        }
      }
      
      if (condition.sort === "random") {
        filteredRecipes.sort(function (a, b) {
          return a.random - b.random;
        });
      } else if (condition.sort === "date") {
        filteredRecipes.sort(function (a, b) {
          return b.lastupdate - a.lastupdate;
        });
      } else if (condition.sort === "rank") {
        filteredRecipes.sort(function (a, b) {
          if (a.rank != b.rank) return b.rank - a.rank;
          if (a.difficulty != b.difficulty) return a.difficulty - b.difficulty;
          return b.lastupdate - a.lastupdate;
        });
      }
      return filteredRecipes;
    },

    /**
     * 全レシピのrandomをつけ直す
     */
    reorderRandom: function () {
      var id,
          recipes = this._recipes;

      for (id in recipes) {
        if (recipes.hasOwnProperty(id)) {
          recipes[id].random = Math.random();
        }
      }
    },

    /**
     * 指定のidのレシピを得る
     * 
     * @param {String} id レシピid
     * @return {Recipe} 対応するレシピオブジェクト
     */
    get: function (id) {
      return this._recipes[id];
    },
    
    /**
     * 全レシピ数を得る.
     *
     * @return {Number} 登録されている全レシピ数
     */
    getCount: function () {
      var id, 
          count = 0;

      for (id in this._recipes) {
        if (this._recipes.hasOwnProperty(id)) {
          count++;
        }
      }
      return count;
    },

    /**
     * 全レシピをローカルに保存する.
     */
    saveRecipes: function () {
      localStorage["recipes"] = JSON.stringify(this._recipes);      
    },
    
    /**
     * 全辞書をローカルに保存する.
     */
    saveDictionary: function () {
      localStorage["dictionary"] = JSON.stringify(this._dictionary);
      localStorage["newWords"] = JSON.stringify(this._newWords);
    },
    
    /**
     * 与えられた文字列に対応する検索用のキーワードを得る.
     * 
     * @param {String} keyword 画面に入力された検索文字列
     * @return {String[][]} 検索用キーワードの配列、、検索キーワード自体複数の表現の配列
     *    例 [[ダイコン,だいこん,大根], [ニンジン,にんじん,人参]]、keywordが空ならnull
     */
    _getSearchKeywords: function (keyword) {
      if (!keyword) {
        return null;
      }
      
      var words = keyword.split(/\s/),
          searchWords = [], i, n, word, ruby;
      for (i = 0, n = words.length; i < n; i++) {
        word = words[i];
        searchWords[i] = [];
        switch (this._getWordType(word)) {
          case 1:
            ruby = word;
            searchWords[i].push(word);
            searchWords[i].push(this._toKatakana(ruby));
            if (this._dictionary[ruby]) {
              searchWords[i] = searchWords[i].concat(this._dictionary[ruby]);
            }
            break;
          case 2:
            ruby = this._toHiragana(word);
            searchWords[i].push(word);
            searchWords[i].push(ruby);
            if (this._dictionary[ruby]) {
              searchWords[i] = searchWords[i].concat(this._dictionary[ruby]);
            }
            break;
          default:
            ruby = this._words[word];
            if (!ruby) {
              searchWords[i].push(word);
            } else {
              if (this._dictionary[ruby].indexOf(word) < 0) {
                searchWords[i].push(word);
              }
              searchWords[i].push(ruby);
              searchWords[i].push(this._toKatakana(ruby));
              searchWords[i] = searchWords[i].concat(this._dictionary[ruby]);
            }
            break;
        }
      }
      return searchWords;
    },
    
    /**
     * 指定の単語の種別を判定する
     * 
     * @param {String} word 対象の単語
     * @return {Number} 単語の種別　1:ひらがなだけ、2:カタカナだけ、3:かな・カナ漢字混じり
     */
    _getWordType: function (word) {
      var i, n, c, t,
          type = this._getCharType(word.charCodeAt(0));

      if (type < 3) {
        for (i = 1, n = word.length; i < n; i++) {
          t = this._getCharType(word.charCodeAt(i));
          if (t && t != type) {　　// 混じり
            return 3;
          }
        }
      }
      return type;
    },

    /**
     * 指定の文字の種類を判断する
     * 
     * @param {Number} c 文字
     * @return {Number} 文字の種別　0:長音・中黒、1:ひらがな、2:カタカナ、3:漢字
     */
    _getCharType: function (c) {
      if (0x3041 <= c && c <= 0x3096) {   // ひらがな
        return 1;
      }
      if (0x30A1 <= c && c <= 0x30F6) {   // カタカナ
        return 2;
      }
      if (c == 0x30FB || c == 0x30FC) {   // 長音、中黒
        return 0;
      }
      return 3;
    },
    
    /**
     * 与えられた文字列のカタカナ部分をひらがなに変更する.
     * 
     * @param {String} word 文字列
     * @return {String} 変更後の文字列
     */
    _toHiragana: function (word) {
      var i, n, c, conv = [];
      for (i = 0, n = word.length; i < n; i++) {
        c = word.charCodeAt(i);
        if (0x30A1 <= c && c <= 0x30F6) {
          conv[i] = c - 0x0060;
        } else {
          conv[i] = c;
        }
      }
      return String.fromCharCode.apply(null, conv);
    },
    
    /**
     * 与えられた文字列のひらがな部分をカタカナに変更する.
     * 
     * @param {String} word 文字列
     * @return {String} 変更後の文字列
     */
    _toKatakana: function (word) {
      var i, n, c, conv = [];
      for (i = 0, n = word.length; i < n; i++) {
        c = word.charCodeAt(i);
        if (0x3041 <= c && c <= 0x3096) {
          conv[i] = c + 0x0060;
        } else {
          conv[i] = c;
        }
      }
      return String.fromCharCode.apply(null, conv);
    }    
  }

  return Repository;
} ());
