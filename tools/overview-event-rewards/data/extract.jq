# Event reward tracks — points milestones per event & level bracket.
# Source: leaguetypeevents (eventID + leaguetypeID + neededPointsForRewards + rewardIDs),
# leaguetypes for the level brackets, same reward-name mapping as the gacha sim.
# Inputs: main = items_latest.json ; --slurpfile lang = LOWERCASED lang map (en).

($lang[0]) as $L
| (INDEX(.buildings[]; (.wodID|tostring)))           as $B
| (INDEX(.units[]; (.wodID|tostring)))               as $U
| (INDEX(.equipments[]; .equipmentID))               as $E
| (INDEX(.constructionItems[]; .constructionItemID)) as $C
| (INDEX(.gems[]; (.gemID|tostring)))                as $G
| (INDEX(.rewards[]; .rewardID))                     as $R
# League brackets are keyed by (leaguetypeID, eventID); eventID -1 rows are the
# generic fallback used when an event has no specific bracket row.
| (INDEX(.leaguetypes[]; "\(.leaguetypeID)|\(.eventID)")) as $LT
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
      | {name: (L("\($u.type)_name") // $u.name // "Troops"), type:"Units", amount: ($p[1]|tonumber? // null)}
    elif ($r.constructionItemIDs != null) then
      ($r.constructionItemIDs|tostring|split(",")[0]) as $id
      | {name: (L("ci_appearance_\($C[$id].name)") // ($C[$id].comment1) // "Construction Item"), type:"Construction", amount:1}
    elif ($r.gemIDs != null) then
      ($r.gemIDs|tostring|split(",")[0]) as $id
      | {name: (L("gem_unique_\($id)") // L("gem_\($id)_name") // ($G[$id].comment1) // "Gem"), type:"Gem", amount:1}
    else
      ($r|to_entries|map(select(.key|startswith("add")))|.[0]) as $a
      | if $a != null then
          ($a.key|ltrimstr("add")) as $cn
          | {name: (L("currency_name_\($cn)") // human($a.key)), type:"Resource", amount:($a.value|tonumber? // $a.value)}
        else
          ($r|to_entries|map(select(.key as $k
              | ["food","wood","stone","coins","oil","glass","iron","honey","mead","rubies"]
              | index($k)))|.[0]) as $res
          | if $res != null then
              {name: (($res.key|ascii_upcase[0:1]) + $res.key[1:]), type:"Resource", amount:($res.value|tonumber? // $res.value)}
            else {name:"Reward", type:"Misc", amount:null} end
        end
    end;
{
  generated: (now|todate),
  events: (
    .leaguetypeevents
    | map(select(.neededPointsForRewards != null and .rewardIDs != null))
    | group_by(.eventID)
    | map(
        .[0].eventID as $ev
        | (L("event_title_\($ev)")) as $title
        | select($title != null)
        | {
            eventID: ($ev|tonumber),
            name: $title,
            brackets: (
              # several rows per league are reward-set VERSIONS — keep the
              # current (highest rewardSetID) one, as in the gacha extractor.
              group_by(.leaguetypeID)
              | map(max_by(.rewardSetID|tonumber? // 0))
              | map(
                . as $row
                | ($LT["\($row.leaguetypeID)|\($row.eventID)"]
                   // $LT["\($row.leaguetypeID)|-1"]) as $lt
                | select($lt != null)
                | ($row.neededPointsForRewards|split(",")) as $pts
                | ($row.rewardIDs|split(",")) as $rids
                | {
                    minLevel: ($lt.minLevel|tonumber? // 0),
                    maxLevel: ($lt.maxLevel|tonumber? // 999),
                    milestones: (
                      [range(0; ($pts|length))] | map(
                        . as $i
                        | nm($R[$rids[$i] // ""]) as $n
                        | { points: ($pts[$i]|tonumber? // 0),
                            name: $n.name, type: $n.type, amount: $n.amount }
                      )
                    )
                  }
              )
              | sort_by(.minLevel)
            )
          }
      )
    | map(select((.brackets|length) > 0))
    | sort_by(.name)
  )
}
