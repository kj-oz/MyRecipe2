KOJS.namespace("recipe.page");

/**
 * 詳細ページに関する処理をまとめたオブジェクト
 */
KOJS.recipe.page.DetailPage = (function () {
  
  var DetailPage = {
    // 初期化済みフラグ
    _initialized: false,
    
    /**
     * 詳細ページの初期化
     * 
     * @param {Context} context アプリケーション共有情報
     */
    setup: function (context) {
      if (this._initialized) {
        return;
      }
      
      var self = this;
      
      // 詳細ページ初回表示時イベントの定義
      $("#detail-page").on("pagebeforecreate", function (event) {

        // ナビゲーションのレシピ選択イベントの定義
        $("#dt-navbar-recipes").on("click", "div", function(e) {
          var $div = $(e.target), index;

          if (!$div.hasClass("selected")) {
            $("#dt-navbar-recipes .selected").removeClass("selected");
            $div.addClass("selected");
            index = $("#dt-navbar-recipes div").index($div);

            self._showDetail(context.selection[index]);
          }
        });

        // ページ遷移イベントの定義
        $("#dt-navbar").on("click", "a", function(e) {
          e.preventDefault();
          if (context.selection.length > 0) {
            $.mobile.changePage("#list-page", {changeHash: false, reverse: true});
          }
        });
        
        // レシピ編集イベントの定義
        $("#dt-btn-edit").on("click", function (e) {
          context.startEditing(context.currentRecipe);
        });
      });

      // 詳細ページ表示時のイベントの定義
      $("#detail-page").on("pagebeforeshow", function (event) {
        var html, 
            currentRecipeIndex;
            
        plugins.idleTimer.disable(120);

        context.setCurrentPage("#detail-page");

        // ナビゲーションの設定
        html = SNBinder.bind_rowset(
            context.templates["dt-navbar-recipes"], context.selection);
        $("#dt-navbar-recipes").html(html);

        // レシピの表示
        currentRecipeIndex = context.selection.indexOf(context.currentRecipe);
        if (currentRecipeIndex < 0) currentRecipeIndex = 0;
        $("#dt-navbar-recipes :nth-child(" + (currentRecipeIndex + 1) + ")").addClass("selected");
        self._showDetail(context.selection[currentRecipeIndex]);
      });

      // 詳細ページ表示時のイベントの定義
      $("#detail-page").on("pagebeforehide", function (event) {
        plugins.idleTimer.enable();
      });

      /**
       * ページの指定のレシピの内容を表示する
       * 
       * @param {Recipe} recipe 対象のレシピ
       */
      this._showDetail = function (recipe) {
        var html, 
            difficulty = {},  // SNBinderがオブジェクトを要求するためオブジェクト化
            difficultySeed = "■■■■■□□□□□",
            rank = {},
            rankSeed = "★★★★★☆☆☆☆☆"
            templates = context.templates;

        // 名称
        html = SNBinder.bind(templates["dt-title"], recipe);
        $("#dt-title").html(html);

        // 出典
        if (recipe.link && recipe.link.length) {
          html = SNBinder.bind(templates["dt-source-with-link"], recipe);
        } else {
          html = SNBinder.bind(templates["dt-source"], recipe);
        }
        $("#dt-source").html(html);

        // ランク、５つの星で表現
        rank["expression"] = rankSeed.substr(5 - recipe.rank, 5);
        html = SNBinder.bind(templates["dt-rank"], rank);
        $("#dt-rank").html(html);

        // 手間、５つの四角で表現
        difficulty["expression"] = difficultySeed.substr(5 - recipe.difficulty, 5);
        html = SNBinder.bind(templates["dt-difficulty"], difficulty);
        $("#dt-difficulty").html(html);

        // カテゴリ
        html = SNBinder.bind(templates["dt-category"], recipe);
        $("#dt-category").html(html);

        // 説明
        html = SNBinder.bind(templates["dt-description"], recipe);
        $("#dt-description").html(html);

        // 材料
        if (recipe.numPeople) {
          html = SNBinder.bind(templates["dt-ingredients-header"], recipe);
        } else {
          html = SNBinder.bind(templates["dt-ingredients-header-only"], recipe);
        }
        $("#dt-ingredients-header").html(html);
        html = SNBinder.bind_rowset(templates["dt-ingredients"], recipe.ingredients)
          + "<div class='dt-ingredient'/>";
        $("#dt-ingredients").html(html);

        // メモ
        if (recipe.memo) {
          html = SNBinder.bind(templates["dt-memo"], recipe);
        } else {
          html = "";
        }
        $("#dt-memo").html(html);

        // 手順
        html = SNBinder.bind_rowset(templates["dt-steps"], 
          SNBinder.transform_array(recipe.steps, 1));
        $("#dt-steps").html(html);

        // コツ
        if (recipe.advise) {
          html = SNBinder.bind(templates["dt-advise"], recipe);
        } else {
          html = "";
        }
        $("#dt-advise").html(html);

        // カレントのレシピの保存
        context.setCurrentRecipe(recipe);
      };
      
      this._initialized = true;
    }
  }

  return DetailPage;
}());

