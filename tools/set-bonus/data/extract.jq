# Equipment set-bonus extractor.
# main = items_*.json ; --slurpfile lang = lowercased lang map.
# Set-bonus effect IDs (equipment_sets.effects) are equipmentEffectIDs and must
# be chained through equipment_effects to the real effectID (same as item gear).
($lang[0]) as $L
| (INDEX(.effects[]; .effectID))                    as $EF
| (INDEX(.equipment_effects[]; .equipmentEffectID)) as $EQF
| (INDEX(.units[]; (.wodID|tostring)))              as $U
| (INDEX(.equipment_slots[]; .slotID))              as $SL
| (INDEX(.equipment_wearers[]; .wearerID))          as $WR
| def L($k): $L[($k|ascii_downcase)];
def cap($s): (($s // "") | if .=="" then "" else (.[0:1]|ascii_upcase) + .[1:] end);
def unitName($wod): (L("\($U[$wod].type)_name") // ("unit " + $wod));
def effText($e):
    ($e|split("&")) as $p
    | (($EQF[$p[0]].effectID) // $p[0]) as $rid
    | ($EF[$rid].name) as $nm
    | if $nm == null then empty
      else
        (L("equip_effect_description_\($nm)") // $nm) as $tpl
        | ($p[1] // "") as $val
        | (if ($tpl|contains("{1}")) and ($val|test("^[0-9]+\\+[0-9]+$"))
           then ($val|split("+")) as $uv
                | ($tpl | gsub("\\{0\\}"; $uv[1]) | gsub("\\{1\\}"; unitName($uv[0])))
           else ($tpl | gsub("\\{0\\}"; $val))
           end)
        | gsub("\\s*\\{\\d\\}"; "") | gsub("\\+\\-"; "-") | gsub("\\-\\-"; "-")
      end;
# pieces grouped by setID
( [ .equipments[]
    | (L("equipment_unique_\(.equipmentID)") // L("hero_unique_\(.equipmentID)")) as $n
    | select($n != null and ((.setID|tonumber? // 0) > 0))
    | { setID: .setID, name: $n, slot: cap($SL[.slotID].name),
        wearer: cap($WR[.wearerID].name), might: (.mightValue|tonumber? // 0) } ]
  | group_by(.setID) | map({ key: .[0].setID, value: . }) | from_entries ) as $PIECES
| { generated: (now|todate),
    sets: (
      [ .equipment_sets[]
        | { setID, need: (.neededItems|tonumber? // 0),
            effects: ((.effects // "") | if .=="" then [] else (split(",")|map(effText(.))) end) } ]
      | group_by(.setID)
      | map( .[0].setID as $sid
             | { setID: $sid,
                 name: (L("equipment_set_\($sid)") // ("Set " + $sid)),
                 tiers: ( map({ need, effects }) | sort_by(.need) ),
                 pieces: ( ($PIECES[$sid] // []) | sort_by(.slot) | map({ name, slot, might, wearer }) ) } )
      | map(select(.name|startswith("Set ")|not))      # drop sets with no localised name
      | map(.wearer = (.pieces[0].wearer // ""))
      | map(.maxPieces = ([ (.tiers|map(.need)|max // 0), (.pieces|length) ] | max))
      | sort_by(.name) ) }
