KOJS.namespace("recipe.page");

/**
 * 一覧ページに関する処理をまとめたオブジェクト
 */
KOJS.recipe.page.ListPage = (function () {
  var ListPage = {
    // 初期化済みフラグ
    _initialized: false,
    
    // ページに表示するレシピの数
    _nRecipePerPage: 9,
    
    // 条件に該当するレシピ
    _recipes: undefined,
    
    // 表示中の先頭のレシピの条件に該当するレシピ中のインデックス
    _recipeIndex: 0,
      
    /**
     * 一覧ページの初期化
     * 
     * @param {Context} context アプリケーション共有情報
     */
    setup: function (context) {
      if (this._initialized) {
        return;
      }
      
      var self = this,
          logger = KOJS.util.Logger.get();
      
      // 一覧ページの初回表示時のイベントの定義
      $("#list-page").on("pagebeforecreate", function (event) {
        var condition = context.condition;

        // 条件イベントの定義
        $("#ls-keyword").on("change", function(e) {
          condition.keyword = $("#ls-keyword").val();
          context.saveCondition();
          self._filterList(true);
        });

        $("#ls-rank-select").on("change", function(e) {
          condition.rank = $(e.target).val();
          context.saveCondition();
          self._filterList(true);
        });

        $("#ls-difficulty-select").on("change", function(e) {
          condition.difficulty = $(e.target).val();
          context.saveCondition();
          self._filterList(true);
        });
        
        $("#ls-category-select").on("change", function(e) {
          condition.category = $(e.target).val();
          context.saveCondition();
          self._filterList(true);
        });
        
        $("#ls-sort-select").on("change", function(e) {
          condition.sort = $(e.target).val();
          context.saveCondition();
          if (condition.sort === "random") {
            context.repository.reorderRandom();
          }
          self._filterList(true);
        });
        
        // 一覧のページ遷移
        $("#ls-listprev").on("click", function(e) {
          self._recipeIndex = Math.max(self._recipeIndex - self._nRecipePerPage, 0);
          self._updateList(true);
        });
        $("#ls-listpos").on("click", function(e) {
          var borderX = e.target.clientWidth / 3,
              x, nPage;
          x = e.clientX - e.target.offsetLeft;
          console.log(x + ":" + Math.floor(borderX));    
          if (x < borderX) {
            self._recipeIndex = 0;
          } else {
            nPage = Math.floor(self._recipes.length / self._nRecipePerPage);
            if (self._recipes.length % self._nRecipePerPage === 0 && nPage > 0) {
              nPage--;
            }
            self._recipeIndex = nPage * self._nRecipePerPage;
          }
          self._updateList(true);
        });
        $("#ls-listnext").on("click", function(e) {
          if (self._recipeIndex + self._nRecipePerPage < self._recipes.length) {
            self._recipeIndex = self._recipeIndex + self._nRecipePerPage;
            self._updateList(true);
          }
        });
        
        // 管理イベントの定義
        $("#ls-admin-init").on("click", function(e) {
          logger.log("> admin-init tapped");
          if (confirm("ローカルのキャッシュデータを全てクリアします。\nよろしいですか？")) {
            localStorage.clear();
            document.location = "recipenote.html"
          }
        });
        
        $("#ls-admin-update").on("click", function(e) {
          logger.log("> admin-update tapped");
          document.location = "recipenote.html"
        });
        
        $("#ls-admin-remove").on("click", function(e) {
          var recipe;
          logger.log("> admin-remove tapped");
          
          if (confirm("選択されているレシピを全て削除します。\nよろしいですか？")) {
            while (context.selection.length) {
              recipe = context.selection.pop();
              logger.log("> remove start: " + recipe.title);
              context.removeRecipe(recipe);
              logger.log("> remove recipe.deleted: " + recipe.deleted);
            }
            logger.log("> remove done");
            context.saveSelection();
            logger.log("> refresh list");
            self._filterList(true, true);
            self._updateSelection(true);            
          }
        });

        // 条件部ヘッダーのイベントの定義
        $("#ls-condition").on("click", "a", function(e) {
          var $a;

          e.preventDefault();
          $a = $(e.currentTarget);
          
          if ($a.text() === "条件") {
            $.extend(context.condition, context.defCondition);
            context.saveCondition();
            self._initCondition();
            self._filterList(true);
          } else {
            $("#ls-keyword").get(0).value = "";
            context.condition.keyword = "";
            context.saveCondition();
            self._filterList(true);
          }
        });
        
        // リスト選択イベントの定義
        $("#ls-recipes").on("click", "a", function(e) {
          var $a, 
              selectedRecipe, 
              selectedId;

          e.preventDefault();
          $a = $(e.currentTarget);
          
          if ($a.text() === "レシピ一覧") {
            context.startEditing();
          } else if (context.selection.length >= 6) {
            alert("一度に選択できるレシピは６個までです。");
          } else {
            selectedId = $a.attr("href").substring(1);
            selectedRecipe = context.repository.get(selectedId);
            if (selectedRecipe && context.selection.indexOf(selectedRecipe) < 0) {
              context.selection.push(selectedRecipe);
              self._updateSelection(true);
              context.setCurrentRecipe(selectedRecipe);
            }
          }
        });
        
        // 選択解除イベントの定義
        $("#ls-selection").on("click", "a", function(e) {
          var $a,
              unselectedRecipe, 
              unselectedId, 
              index;

          e.preventDefault();
          $a = $(e.currentTarget);

          if ($a.text() === "選択レシピ") {
            context.selection.length = 0;
            self._updateSelection(true);
          } else {
            unselectedId = $a.attr("href").substring(1);
            unselectedRecipe = context.repository.get(unselectedId);
            if (unselectedRecipe) {
              index = context.selection.indexOf(unselectedRecipe);
              context.selection.splice(index, 1);
              self._updateSelection(true);
            }
          }
        });        
        
        // ページ遷移イベントの定義
        $("#ls-navbar").on("click", "a", function(e) {
          e.preventDefault();
          if (context.selection.length > 0) {
            $.mobile.changePage("#detail-page", {changeHash: false});
          }
        });
      });
      
      // 一覧ページ表示時のイベントの定義
      $("#list-page").on("pagebeforeshow", function (event) {
        context.setCurrentPage("#list-page");

        // 抽出条件の初期化（"refresh"が構築前はエラーになるため、こちらで設定）
        self._initCondition();

        self._filterList(true, true);
        self._updateSelection(true);
      });
      
      /**
       * 抽出条件のコントロールを初期化する
       */
      this._initCondition = function () {
        var i, n, 
            category, 
            checked, 
            id,
            condition = context.condition;

        // キーワード
        // val()では設定できない
        $("#ls-keyword").get(0).value = condition.keyword;
        
        // ランク
        $("#ls-rank-select").val(condition.rank).selectmenu("refresh");

        // 手間
        $("#ls-difficulty-select").val(condition.difficulty).selectmenu("refresh");

        // カテゴリー
        $("#ls-category-select").val(condition.category).selectmenu("refresh");
        
        // 並び順
        $("#ls-sort-select").val(condition.sort).selectmenu("refresh");
      };
      
      /**
       * 全レシピから条件に合致するレシピを抽出しレシピ一覧の内容を更新する
       * 
       * @param {Boolean} refresh DOM更新後にウィジェットの更新を行うかどうか
       * @param {Boolean} keepPage 表示中のページを維持するか
       */
      this._filterList = function (refresh, keepPage) {
        var changed = context.repository.mergeUpdates();
        this._recipes = context.repository.filter(context.condition);
        if (!keepPage) {
          this._recipeIndex = 0;          
        }
        this._updateList(refresh);
        if (changed) {
          this._updateSelection(refresh);
        }
      };
      
      /**
       * レシピ一覧を再構成する
       * 
       * @param {Boolean} refresh DOM更新後にウィジェットの更新を行うかどうか
       */
      this._updateList = function (refresh) {
        var n, recipes, html;
        
        $("#ls-recipes li:gt(0)").remove();

        n = Math.min(this._recipes.length - this._recipeIndex, this._nRecipePerPage);
        recipes = this._recipes.slice(this._recipeIndex, this._recipeIndex + n);

        html = SNBinder.bind_rowset(context.templates["ls-recipes"], recipes);
        $("#ls-recipes li:eq(0)").after(html);
        if (refresh) {
          $("#ls-recipes").listview("refresh");
        }
        // 何故かこのタイミングでaddClaasしておかないと上部が直角になる
        $("#ls-recipes li:eq(0)").addClass("ui-corner-top");
        $("#ls-recipes li:eq(n - 1)").addClass("ui-corner-bottom");
        
        // ページ移動ボタンの更新
        if (this._recipeIndex === 0) {
          $("#ls-listprev").addClass("ui-disabled");
        } else {
          $("#ls-listprev").removeClass("ui-disabled");
        }
        if (this._recipeIndex + n === this._recipes.length) {
          $("#ls-listnext").addClass("ui-disabled");
        } else {
          $("#ls-listnext").removeClass("ui-disabled");
        }
        if (this._recipes.length === 0) {
          $("#ls-listpos").text("0 ／ 0");
        } else {
          $("#ls-listpos").text((this._recipeIndex + 1) + "〜" + (this._recipeIndex + n) + 
              " ／ " + this._recipes.length);
        }
      };
      
      /**
       * 選択結果リストを更新する
       * 
       * @param {Boolean} refresh DOM更新後にウィジェットの更新を行うかどうか
       */
      this._updateSelection = function (refresh) {
        var html, 
            selection = context.selection.concat();
        
//        while (selection.length < 6) {
//          selection.push({_id:"", title:"　"})
//        }
        
        $("#ls-selection li:gt(0)").remove();

        html = SNBinder.bind_rowset(context.templates["ls-selection"], selection);
        $("#ls-selection").append(html);
        if (refresh) {
          $("#ls-selection").listview("refresh");
        }
        
        context.saveSelection();

        // 何故かこのタイミングでaddClaasしておかないと上部が直角になる
        $("#ls-selection li:eq(0)").addClass("ui-corner-top");
      };
      
    }
  }

  return ListPage;
}());

