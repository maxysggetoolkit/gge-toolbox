#!/usr/bin/env python3
# Spenders Corner data builder — decodes Goodgame's offer-targeting tables
# (paymentrewards / primeDays / shoppingCarts) from the public client data in
# tools/_srcdata/cache/ into data/offers.json.
# Reward slot tokens decoded via the client's CollectableItem*VO SERVER_KEY map
# + the currencies table JSONKey column. Run tools/_srcdata/pull.sh first.
import json, collections, os
HERE=os.path.dirname(os.path.abspath(__file__))
ROOT=os.path.join(HERE,'..','..')
items=json.load(open(os.path.join(ROOT,'tools/_srcdata/cache/items_latest.json')))
lang=json.load(open(os.path.join(ROOT,'tools/_srcdata/cache/en.json')))

units={}
for tbl in ['units','tools']:
    for u in items.get(tbl,[]):
        wid=str(u.get('wodID',''))
        nm=lang.get((u.get('type') or '')+'_name') or u.get('comment1') or u.get('type')
        if wid: units[wid]=nm
cis={str(c.get('constructionItemID', c.get('wodID',''))): (lang.get((c.get('type') or '')+'_name') or c.get('comment1') or c.get('type')) for c in items.get('constructionItems',[])}
blds={str(b.get('wodID','')): (lang.get((b.get('type') or '')+'_name') or b.get('comment1') or b.get('type')) for b in items.get('buildings',[])}
curname={c['JSONKey']:c['Name'] for c in items['currencies'] if c.get('JSONKey')}

LEGEND={'U':'unit','W':'Wood','S':'Stone','F':'Food','C':'Coal','O':'Oil','G':'Glass','I':'Iron','A':'Aquamarine',
'MEAD':'Mead','HONEY':'Honey','BEEF':'Beef','HF':'Hidden food','HM':'Hidden mead','HB':'Hidden beef','C1':'Coins','C2':'Rubies',
'VT':'VIP time (s)','VP':'VIP points','XP':'XP','AP':'Achievement points','RE':'Random hero','GE':'Random equipment (rareness)',
'UE':'Unique equipment','EUE':'Unique enchanted equipment','GID':'Gem','GLID':'Random gem','CI':'Construction item','CIBP':'CI blueprint',
'D':'Building/Deco','LB':'Loot box','RB':'Material bag','RI':'Relic','GT':'Gift package','EF':'Extinguish fire','AG':'Alliance gift',
'PD':'Payment doubler','PLD':'Plague doctor','PTS':'Permanent tool slot','PUS':'Permanent unit slot','AIP':'Alien protection','DPT':'Dungeon protection',
'B':'Booster','PG':'Glory booster','XPB':'XP booster','KTB':'Khan tablet booster','KMB':'Khan medal booster','RPB':'Rage booster',
'REPB':'Reputation booster','GPB':'Gallantry booster','STB':'Samurai booster','LTB':'LTPE booster','ACB':'Alliance coin booster',
'MS':'Minute skips','RP':'Resource point','OL':'(display flag)','OG':'(display flag)','OM':'(display flag)'}

def decode_rewards(s):
    try: data=json.loads(s.replace('*','"'))
    except Exception: return None
    out=[]
    for slot in data.get('slots',[]):
        if not isinstance(slot,list) or len(slot)<1: continue
        tok=slot[0]; val=slot[1] if len(slot)>1 else None
        if tok in ('OL','OG','OM'): continue
        e={'t':tok}
        if tok=='U' and isinstance(val,list):
            e['name']=units.get(str(val[0]),'unit '+str(val[0])); e['qty']=val[1] if len(val)>1 else 1
        elif tok=='CI' and isinstance(val,list):
            e['name']=cis.get(str(val[0]),'CI '+str(val[0])); e['qty']=val[1] if len(val)>1 else 1
        elif tok=='D':
            wid=str(val[0] if isinstance(val,list) else val); e['name']=blds.get(wid,'building '+wid); e['qty']=val[1] if isinstance(val,list) and len(val)>1 else 1
        elif tok in LEGEND and not isinstance(val,list):
            e['name']=LEGEND.get(tok,tok); e['qty']=val
        elif tok in curname and not isinstance(val,list):
            e['name']=curname[tok]; e['qty']=val
        else:
            e['name']=LEGEND.get(tok) or curname.get(tok) or tok; e['val']=val
        out.append(e)
    return out

def seg(r):
    s={}
    for k_src,k_dst in [('minLevel','lvlMin'),('maxLevel','lvlMax'),('playerIsPayuser','payuser'),
        ('c2LifetimeSpentMin','spentMin'),('c2LifetimeSpentMax','spentMax'),
        ('C290daysMin','spent90Min'),('C290daysMax','spent90Max'),
        ('daysSinceLastPaymentMin','lapsedMin'),('daysSinceLastPaymentMax','lapsedMax'),
        ('rewardCap','cap'),('duration','dur'),('displayType','dt')]:
        v=r.get(k_src)
        if v not in (None,''): s[k_dst]=v
    return s

offers=[{'id':r['paymentrewardID'],'c2':int(r['c2ForReward']),'shownValue':int(r['shownCurrencyValue']),
         'bonus':int(r['shownOfferBonus']),**seg(r),'rewards':decode_rewards(r['rewards'])} for r in items['paymentrewards']]
prime=[{'id':r['primeDayID'],**seg(r),'offerIds':[i for i in str(r.get('paymentRewardIDs','')).split(',') if i]} for r in items['primeDays']]
carts=[{'id':r['cartOptionID'],'type':r.get('typeID'),'group':r.get('groupID'),'bonus':int(r.get('shownOfferBonus',0) or 0),
        **seg(r),'rewardId':r.get('rewardID')} for r in items['shoppingCarts']]

src=open(os.path.join(ROOT,'tools/_srcdata/cache/SOURCES.txt')).readline().strip('# \n')
out={'generated':src,'tokenLegend':LEGEND,'offers':offers,'primeDays':prime,'shoppingCarts':carts}
os.makedirs(os.path.join(HERE,'data'),exist_ok=True)
json.dump(out,open(os.path.join(HERE,'data','offers.json'),'w'),separators=(',',':'))
print('offers.json:',len(offers),'offers,',len(prime),'primeDays,',len(carts),'carts')
