# Equipment overview extractor.
# main = items_*.json ; --slurpfile lang = lowercased lang map.
($lang[0]) as $L
| (INDEX(.effects[]; .effectID))          as $EF
| (INDEX(.equipment_slots[]; .slotID))    as $SL
| (INDEX(.equipment_wearers[]; .wearerID)) as $WR
| def L($k): $L[($k|ascii_downcase)];
def cap($s): (($s // "") | if .=="" then "" else (.[0:1]|ascii_upcase) + .[1:] end);
def effText($e):                                  # "57&33" -> "+33% ..."
    ($e|split("&")) as $p
    | ($EF[$p[0]].name) as $nm
    | if $nm == null then empty
      else ((L("equip_effect_description_\($nm)") // $nm) | gsub("\\{0\\}"; ($p[1]//"")))
      end;
{ generated: (now|todate),
  items: (
    [ .equipments[]
      | (L("equipment_unique_\(.equipmentID)")) as $n
      | select($n != null and ((.mightValue|tonumber? // 0) > 0))
      | { id: .equipmentID,
          reuseId: .reuseAssetOfEquipmentID,
          name: $n,
          slot: cap($SL[.slotID].name),
          set: (L("equipment_set_\(.setID)") // ""),
          wearer: cap($WR[.wearerID].name),
          might: (.mightValue|tonumber? // 0),
          effects: ((.effects // "") | if . == "" then [] else (split(",") | map(effText(.))) end) } ]
    | sort_by(-.might) ) }
