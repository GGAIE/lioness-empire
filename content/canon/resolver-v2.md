# 《母獅帝國》結局 Resolver 與驗證案例 v2.0

本文件為**規則草案**；保留原 v1.0 的8逆位與22正位完整槽位，修正 0 愚者與路線政治含義。未完成正式程式測試前，不宣稱所有門檻互斥且可達。

## 既有門檻
A max7 / F max10 / T max6 / S max6；`F>=6 AND exactly_one_of(A,T,S)==0` 可逆位；`count_zero(A,F,T,S)>=2` 為 I；Tower `T==0` → XIII（不可覆蓋）；Star XI PUBLISH + `ARCHIVE_TRUTH_COMPLETE` + A>=4 + ALINDA_TRUCE + FORMAL + FINAL_AGREEMENT；World IV F>=3 T>=3 另需政爭 WON；Tower VIII A>=4 且 ALINDA_SAFE_HAVEN。

## 不新增正位槽位的新愚者
`route == TOWER && T>0 && DRAGON_EMPRESS_TRUCE && KNIGHT_COUNCIL_READY && OLIVIA_SURRENDER_OFFER && FINAL_PEACE_TREATY_SIGNED` → 0 愚者，需在 EP11 已完成條約與移交的重大選擇。莎莉雅 Tower 犧牲照舊發生。未成立條約則進其他 Tower Gate，切不可把單核心缺席當成愚者。

## 判定順序建議（需在實作測試）
1. 路線轉 Tower 前若 PS 歸零：VI；非 Tower 後續按舊規，Tower 後續改採生存旗標，不以簡單歸零當死亡。
2. Tower `T=0` ：XIII。
3. `number_of_zero_core >= 2`：I。
4. Tower 愚者全條件成立：0。
5. 單支柱缺席：先 F>=6 的路線對應逆位；Star 依 F/A/T/S 進 IX/XX/XIX/X；Chariot 非逆位缺席→XVII；Tower 單缺席且無逆位→XVI。
6. Star PS<45→XII；Chariot PS<45→VII。Tower 生存失敗→XVI。
7. 全四支柱皆 1–2 且 PS>=45→XXI。
8. Star：PUBLISH＋完整 True Gate→XI；SEAL＋完整檔案→II；T>4且其他1–4→V；S>4且其他1–4→III；其餘→XVIII。
9. Chariot：`SUCCESSION_CONTEST==LOST` → VII（被操控）或 XVII（失勢仍有自由），分界需新增 `POLITICAL_CAPTIVITY`；`WON`且F>=3且T>=3→IV；WON/COMPROMISE其他狀況→XV。特殊失勢逆位必須置於此之前。
10. Tower：A>=4且Safe Haven→VIII；A>0有後續庇護但未達好結局→XIV；其餘→XVI。

## 矛盾與風險清單
- Star F=0 與「單支柱失去時只看其他角色 F>=6 逆位」分開處理。
- Star V(T>4，其他1–4) 與 III(S>4，其他1–4) 不會同時成立，因對方需<=4。
- Chariot `LOST` 若已高 F/T，不可先因符合 IV 的數值門檻而誤判 Good。
- Tower T=0 與愚者 T>0 明確互斥。
- 原愚者缺席入口已廢止；Tower 不可到達 0 的缺席狀態全部轉 XVI 或逆位。
- Tower 愚者是否容許 A 或 S 為0？此版本允許單一缺席但要求共治制度已成立；若故事認為與騎士團共治矛盾，後續可增加更精確的 `KNIGHT_COUNCIL_READY` 必要事件而非任意 A/S 數值。
- EP11 必須具體揭示和平條件，EP12 不得新增選擇。
- 應另測：PS=0，雙零，三零，芬利恰=6，Tower T=0，愚者成立但PS低，Chariot LOST但F/T高，Star XI vs II 優先權。
