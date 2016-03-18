KOJS.namespace("recipe.model");

/**
 * レシピの内容を保持するオブジェクト
 */
KOJS.recipe.model.Recipe = (function () {
  // ネームスペース省略用のローカル変数
  var Recipe;
  
  /**
   * コンストラクタ
   * 
   * @param {Object} json 各種の値を保持するJSONオブジェクト、
   *    何も指定しなければ空のレシピが生成される
   */
  Recipe = function (json) {
    json = json || {
      "_id": "",
      "title": "",
      "category": "主菜",
      "source": "",
      "link": "",
      "photo": "",
      "description": "",
      "numPeople": "", 
      "ingredients": [],
      "steps": [],
      "advise": "",
      "memo": "",
      "difficulty": "3",
      "rank": "0",
      "lastupdate": new Date().getTime()
    };
    return $.extend(json, this, {"random": Math.random()});
  };
  
  Recipe.prototype = {
    constructor: Recipe,
    
    /**
     * 自分が指定された条件に合致しているかどうかを返す
     * 
     * @param {Object} condition レシピ絞込みの条件
     * @param {String[]} searchWords 検索キーワードの配列、検索キーワード自体複数の表現の配列
     *      例 [[ダイコン,だいこん,大根], [ニンジン,にんじん,人参]]
     * @return {Boolean} 条件および全ての検索キーワードが合致していればtrue
     */
    match: function (condition, searchWords) {
      var i, n;
      if (this.deleted || 
          this.rank < condition.rank ||
          this.difficulty > condition.difficulty ||
          (condition.category != "*" && condition.category != this.category)) {
        return false;
      }
      
      // 全ての検索キーワードに合致するかを判定
      if (searchWords) {
        for (i = 0, n = searchWords.length; i < n; i++) {
          if (!this._matchKeyord(searchWords[i])) {
            return false;
          }
        }
      }
      return true;
    },
    
    /**
     * 自分が与えられたキーワードに合致しているかどうかを返す
     * 
     * @param {String} keyword 検索する単語の複数の表現の配列、例 [ダイコン,だいこん,大根]
     * @return {Boolean} タイトルか材料名が１つでも合致していればtrue
     */
    _matchKeyord: function (searchWord) {
      var i, n, j, m;
      
      for (i = 0, n = searchWord.length; i < n; i++) {
        if (this.title.indexOf(searchWord[i]) >= 0) {
          return true;
        }
        for (j = 0, m = this.ingredients.length; j < m; j++) {
          if (this.ingredients[j].name.indexOf(searchWord[i]) >= 0) {
            return true;
          }
        }
      }
      return false;      
    },
    
    /**
     * 自分自身の編集用のコピーを返す
     * 
     * @return {Recipe} 自分のコピー
     */
    copyForEditing: function () {
      var json, 
          copy;

      // JSONを利用してディープコピーを作る
      json = JSON.parse(JSON.stringify(this));
      copy = new Recipe(json);
      return copy;
    }
  };

  return Recipe;
}());

