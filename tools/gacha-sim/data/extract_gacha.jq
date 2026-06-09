# Event-centric gacha extractor.
# Inputs: main = an items_*.json ; --slurpfile lang = LOWERCASED lang map (en).
# Output: { generated, events:[ {eventID,name,levels:[ {level,cost,total,entries} ]} ] }
# Only the 8 themed gacha events are kept (those present in .gachaEvents).

($lang[0]) as $L
| (INDEX(.buildings[]; (.wodID|tostring)))           as $B
| (INDEX(.units[]; (.wodID|tostring)))               as $U
| (INDEX(.equipments[]; .equipmentID))               as $E
| (INDEX(.constructionItems[]; .constructionItemID)) as $C
| (INDEX(.gems[]; (.gemID|tostring)))                as $G
| (INDEX(.rewards[]; .rewardID))                     as $R
| (.lootBoxTombolas | group_by(.tombolaID)
   | map({ key: .[0].tombolaID,
           value: { total: (map(.shares|tonumber)|add), rows: . } }) | from_entries) as $POOL
| def L($k): $L[($k|ascii_downcase)];
def human($k): ($k|ltrimstr("add")|gsub("(?<c>[A-Z])";" \(.c)")|sub("^ ";""));
def nm($r):
    if $r == null then {name:"Unknown", type:"Unknown", amount:null}
    elif ($r.decoWodID != null) then
      ($B[$r.decoWodID|tostring]) as $b
      | {name: (L("deco_\($b.type)_name") // $b.comment1 // "Decoration"), type:"Decoration", amount:1}
    elif ($r.equipmentIDs != null) then
      ($r.equipmentIDs|split(",")[0]) as $id
      | {name: (L("equipment_unique_\($id)") // ($E[$id].comment1) // "Equipment"), type:"Equipment", amount:1}
    elif ($r.relicEquipments != null) then
      ($r.relicEquipments|tostring|split(",")[0]|split("+")[0]) as $id
      | {name: (L("equipment_unique_\($id)") // ($E[$id].comment1) // "Equipment"), type:"Equipment", amount:1}
    elif ($r.units != null) then
      ($r.units|tostring|split("+")) as $p
      | ($U[$p[0]]) as $u
      | {name: (L("\($u.type)_name") // $u.name // "Troops"), type:"Units", amount: (($p[1]//$p[0])|tonumber? // null)}
    elif ($r.constructionItemIDs != null) then
      ($r.constructionItemIDs|tostring|split(",")[0]) as $id
      | {name: (L("ci_appearance_\($C[$id].name)") // ($C[$id].comment1) // "Construction Item"), type:"Construction", amount:1}
    elif ($r.gemIDs != null) then
      ($r.gemIDs|tostring|split(",")[0]) as $id
      | {name: (L("gem_\($id)_name") // ($G[$id].comment1) // "Gem"), type:"Gem", amount:1}
    else
      ($r|to_entries|map(select(.key|startswith("add")))|.[0]) as $a
      | if $a != null then
          ($a.key|ltrimstr("add")) as $cn
          | {name: (L("currency_name_\($cn)") // human($a.key)), type:"Resource", amount:($a.value|tonumber? // $a.value)}
        else {name:"Reward", type:"Misc", amount:null} end
    end;
def poolEntries($tid):
    ($POOL[$tid]) as $p
    | if $p == null then null
      else { total: $p.total,
              entries: ($p.rows | sort_by(-(.shares|tonumber)) | map(
                  (.rewardIDs|split(",")[0]) as $rid | nm($R[$rid]) as $n
                  | { rarity:(.rewardCategory|tonumber), shares:(.shares|tonumber),
                      name:$n.name, type:$n.type, amount:$n.amount } )) }
      end;
{
  generated: (now|todate),
  events: (
    .gachaEvents
    | group_by(.eventID)
    | map(
        .[0].eventID as $ev
        | {
            eventID: $ev,
            name: (L("event_title_\($ev)") // L("dialog_event_announcement_header_\($ev)") // ("Event " + $ev)),
            levels: (
              group_by(.gachaLevel|tonumber)
              | map(
                  .[0] as $g
                  | ($g.gachaLevel|tonumber) as $lvl
                  | ($g | to_entries | map(select((.key|startswith("cost")) and ((.value|tonumber? // 0) > 0))) | .[0]) as $cost
                  | (poolEntries($g.lootBoxTombolaID)) as $pool
                  | select($pool != null)
                  | { level: $lvl,
                      cost: (if $cost then {what:($cost.key|ltrimstr("cost")), amount:($cost.value|tonumber? // $cost.value)} else null end),
                      total: $pool.total,
                      entries: $pool.entries }
                )
              | sort_by(.level)
            )
          }
      )
    | sort_by(.eventID|tonumber) | reverse
  )
}
