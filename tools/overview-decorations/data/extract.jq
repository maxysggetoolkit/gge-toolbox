# Decorations overview extractor.
# main = items_*.json ; --slurpfile lang = lowercased lang map.
($lang[0]) as $L
| (.effects | map({key:.effectID, value:.name}) | from_entries) as $E
| { generated: (now|todate),
    items: (
      [ .buildings[]
        | select(.buildingGroundType=="DECO")
        | ($L["deco_\(.type|ascii_downcase)_name"]) as $n
        | select($n != null)
        | { name:$n,
            type:.type,
            might:(.mightValue|tonumber? // 0),
            po:(.decoPoints|tonumber? // 0),
            w:(.width|tonumber? // 1),
            h:(.height|tonumber? // 1),
            effects: (
              (.areaSpecificEffects // "")
              | if . == "" then [] else
                  split(",")
                  | map(
                      (split("&")) as $p
                      | ($E[$p[0]] // "") as $en
                      | ($en|ascii_downcase) as $b
                      | ($en|test("unboosted";"i")) as $flat
                      # game description template carries "{0}" + the % sign — but "unboosted" effects
                      # are flat values whose templates wrongly show % (GGS bug), so skip those.
                      # "decrease" effects are reductions → show a minus.
                      | (if $flat then null
                         else ((($L["equip_effect_description_\($b)"] // $L["ci_effect_\($b)"]) // null)
                              | if . != null and ($en|test("decrease";"i")) then sub("\\+\\{0\\}";"-{0}") else . end)
                         end) as $tmpl
                      | { v: ($p[1]|tonumber? // 0),
                          tmpl: $tmpl,
                          # fallback %-rule: boost-named or lang text shows %, never for unboosted
                          pct: ((($en|test("boost";"i")) or ([$tmpl // "", $L["effect_name_\($b)"] // ""] | any(contains("%"))))
                                and ($flat|not)),
                          label: ($L["effect_name_\($b)"] // (if $en == "" then "Effect \($p[0])" else $en end)) }
                    )
                end
            )
          } ]
      | group_by(.name) | map(max_by(.might))      # one row per deco, strongest variant
      | map(.tiles = (.w * .h)
            | .mpt = (if .tiles>0 then ((.might/.tiles)|floor) else 0 end)
            | .size = "\(.w)x\(.h)")
      | sort_by(-.might)
    ) }
