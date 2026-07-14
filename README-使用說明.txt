V9 多場景版本

新增第二個作品：
1. 複製 scenes/_template 資料夾，改名為 scene02。
2. 放入 model.ply 與 sound.mp3。
3. 編輯 scenes/scene02/config.json。
4. 在 scenes/index.json 的 scenes 陣列加入：
   { "id": "scene02", "config": "./scenes/scene02/config.json" }
5. Commit / Push，Cloudflare 會自動部署。

注意：請保持 index.html、viewer.js、style.css 在 Repository 最外層。
