# Intro Animation Audio Sources

更新日期：2026-07-23

## 授權說明

本資料夾使用的七個音效都下載自 Mixkit 官方音效庫。Mixkit 將 Sound Effects 標示為 **Free License**；授權詳情明列可用於教育用途，也允許將音效整合進較大範圍的作品後，在網頁或社群平台公開播放。本專案仍保留完整來源紀錄，方便日後查核與替換。

- 音效授權總覽：https://mixkit.co/free-sound-effects/
- Sound Effects Free License：https://mixkit.co/license/#sfxFree
- 使用情境：國小自然科教育網站、GitHub Pages 公開展示

授權限制：不得把素材當成獨立音效、素材庫、工具／範本或來源檔重新散布，也不得宣稱為自行創作或登記至權利管理服務。本專案只將音效作為 Intro Animation 整體作品的一部分使用。

Mixkit 的素材列表未逐項顯示創作者姓名，因此下表以「Mixkit contributor（頁面未列個人姓名）」如實記錄。`water-stream.mp3` 的官方 WAV 內含創作者中繼資料，故另外列出。

## 使用素材

| 專案檔名 | Mixkit 素材名稱 | 作者／提供者 | 授權 | 原始頁面 | 官方原檔 |
| --- | --- | --- | --- | --- | --- |
| `forest-ambience.mp3` | European forest ambience（ID 1213） | Mixkit contributor（頁面未列個人姓名） | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/forest/ | https://assets.mixkit.co/active_storage/sfx/1213/1213.wav |
| `distant-birds.mp3` | Forest birds chirp ambiance（ID 69） | Mixkit contributor（頁面未列個人姓名） | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/forest/ | https://assets.mixkit.co/active_storage/sfx/69/69.wav |
| `soft-insects.mp3` | Crickets and insects in the wild ambience（ID 39） | Mixkit contributor（頁面未列個人姓名） | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/insect/ | https://assets.mixkit.co/active_storage/sfx/39/39.wav |
| `grass-rustle.mp3` | Handling grass（ID 1925） | Mixkit contributor（頁面未列個人姓名） | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/garden/ | https://assets.mixkit.co/active_storage/sfx/1925/1925.wav |
| `water-stream.mp3` | Water flowing ambience loop（ID 3126） | Collin Scudder；原始中繼資料標示 Epic Stock Media (Quest Game) | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/water/ | https://assets.mixkit.co/active_storage/sfx/3126/3126.wav |
| `water-ripple.mp3` | Fish moving in water（ID 2921） | Mixkit contributor（頁面未列個人姓名） | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/water/ | https://assets.mixkit.co/active_storage/sfx/2921/2921.wav |
| `wing-flutter.mp3` | Medium size bird flutter（ID 63） | Mixkit contributor（頁面未列個人姓名） | Mixkit Sound Effects Free License | https://mixkit.co/free-sound-effects/flying/ | https://assets.mixkit.co/active_storage/sfx/63/63.wav |

## 網頁版處理

- 官方 WAV 轉為 MP3。
- 取樣率統一為 44.1 kHz、立體聲、128 kbps。
- 長環境音以約 -20 LUFS 為目標正規化；短提示音以約 -18 LUFS 為目標。
- `water-ripple.mp3` 與 `wing-flutter.mp3` 在檔案首尾加入極短淡化，避免突兀爆音。
- 移除封面圖與不必要的中繼資料，縮小 GitHub Pages 載入量。
- 網頁內仍以低音量混音；正規化只讓不同來源有一致的基準，不代表以高音量播放。

## 未採用素材

未加入 `distant-bee.mp3`。目前可合法取得的候選「Bee buzz」為近距離、辨識度高的短促嗡鳴，容易搶走 Scene 7 的視覺觀察焦點；依設計要求，寧可保留自然底層聲。
