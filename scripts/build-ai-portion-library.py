import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]/'src/nutrition'
foods=json.loads((root/'foods.json').read_text())
# AI pre-estimates of roughly a cup-sized loose pile, NOT measured household weights.
estimates={
'oats-dry':(80,55,110,'干片，松散盛放'), 'sweet-potato':(200,140,270,'熟块，不捣泥'), 'pumpkin':(180,120,240,'熟块，不压实'),
'white-bread':(40,25,65,'切块，松散堆放'), 'whole-bread':(45,30,70,'切块，松散堆放'), 'millet-dry':(190,140,240,'干粒，平装'), 'rice-dry':(190,140,240,'干粒，平装'),
'egg':(135,95,180,'去壳熟蛋切块'), 'fried-egg':(120,80,170,'煎蛋切块，油量按原食物参考'),
'raw-chicken':(170,120,230,'生肉切块，松散盛放'), 'pork':(150,100,210,'熟瘦肉切片'), 'raw-pork':(170,120,230,'生瘦肉切片'), 'beef':(150,100,210,'熟瘦肉切片'), 'lamb':(150,100,210,'熟瘦肉切块'),
'salmon':(160,110,220,'生鱼肉切块'), 'tilapia':(145,95,200,'熟鱼肉小块，不压碎'), 'cod':(145,95,200,'熟鱼肉小块，不压碎'), 'shrimp':(145,100,200,'熟去壳虾仁，松散盛放'), 'squid':(150,100,210,'生鱿鱼切圈'), 'crab':(125,80,180,'熟蟹肉，松散盛放'),
'fried-tofu':(100,60,160,'炸豆腐切块，空隙较多'), 'tomato':(170,120,230,'生番茄切块'), 'green-pepper':(130,80,190,'生青椒切块'), 'ginger':(90,55,140,'生姜切片'),
'apple':(130,85,185,'去核带皮切块'), 'banana':(150,100,210,'去皮切片，不捣泥'), 'pear':(150,100,210,'去核切块'), 'kiwi':(175,120,235,'去皮切片'), 'grapes':(150,100,210,'可食果粒，松散盛放'), 'mango':(165,110,225,'去皮去核切块'), 'strawberry':(145,95,205,'去蒂整果，松散盛放'), 'blueberry':(145,100,200,'果粒，松散盛放'), 'watermelon':(150,100,215,'去皮切块'), 'pineapple':(165,110,230,'可食部分切块'), 'lychee':(185,125,250,'去皮去核果肉'), 'dates':(150,95,215,'去核干果，松散盛放'),
'almond':(140,95,195,'整粒果仁'), 'walnut':(105,65,160,'去壳核桃仁碎块'), 'cashew':(135,90,190,'整粒果仁'), 'mixed-nuts':(130,85,185,'去壳混合果仁'), 'peanuts':(145,95,200,'去壳熟花生仁'),
'egg-fried-rice':(190,130,260,'炒熟米饭，松散盛放'), 'tomato-egg':(190,130,270,'成品含菜汁，不压实'), 'pepper-pork':(160,105,230,'成品肉丝和青椒混合'), 'kung-pao':(175,115,245,'成品鸡丁和配菜混合'), 'mapo-tofu':(220,150,300,'成品豆腐及附着酱汁'), 'chicken-rice':(190,130,265,'饭和鸡肉混合，不按纯鸡肉计算'),
'beef-noodles':(230,160,300,'面、肉和汤按原配方比例混合；不能仅套用捞出面条'), 'tomato-egg-noodles':(230,160,300,'面、配料和汤按原配方比例混合；不能仅套用捞出面条'), 'stir-broccoli':(150,95,220,'炒熟花球，不压实'), 'stir-greens':(150,90,230,'炒熟叶菜，略沥汁'), 'stir-spinach':(170,105,250,'炒熟菠菜，略沥汁'), 'potato-strips':(160,105,235,'成品土豆丝，松散盛放'), 'fried-eggplant':(165,105,245,'成品茄子块，油量仍按配方参考'),
'dumplings':(150,95,220,'熟饺子松散堆放，包含空隙'), 'steamed-bun':(85,50,135,'熟馒头按整体体积'), 'pork-bun':(120,75,180,'熟包子按整体体积'), 'chicken-salad':(110,60,185,'鸡肉和生蔬菜混合，不压实'), 'egg-sandwich':(100,60,155,'成品按整体体积'), 'shrimp-rice':(190,130,265,'炒饭成品，松散盛放'),
'ai-stir-beef':(150,95,220,'成品熟牛肉片，少量油，无大量蔬菜或汤汁'), 'ai-radish-greens':(160,90,240,'熟萝卜叶，沥水但不压紧，未计油')}
known={f['id']:f for f in foods}
beef=known['beef'];oil=known['oil'];ingredients=[{'foodId':'beef','grams':200},{'foodId':'oil','grams':10}]
per100={k:round(sum(round(known[i['foodId']]['per100'][k]*100)*i['grams'] for i in ingredients)/210)/100 for k in ['kcal','protein','carbs','fat']}
extra=[{'id':'ai-stir-beef','name':'炒牛肉（AI参考配方）','group':'中餐菜品','aliases':['炒牛肉','清炒牛肉','小炒牛肉'],'per100':per100,'portions':{'份':150},'defaultGrams':150,'defaultUnit':'份','reference':'AI参考配方 · USDA食材组合估算','sourceId':'ai-stir-beef-v1','sourceName':'熟瘦牛肉200克＋食用油10克，成品按210克估算','note':'AI参考配方，非实测：熟瘦牛肉200克＋油10克，成品210克；不含额外配菜、糖、淀粉或酱料，请按实际修改。','kind':'recipe','ingredients':ingredients,'yieldGrams':210,'estimated':True},
{'id':'ai-radish-greens','name':'萝卜叶（熟、未加油，AI估算）','group':'蔬菜','aliases':['萝卜叶','熟萝卜叶','水煮萝卜叶'],'per100':{'kcal':30,'protein':2.5,'carbs':4,'fat':0.5},'portions':{'份':100},'defaultGrams':100,'defaultUnit':'份','reference':'AI营养参考估算（非实测）','sourceId':'ai-radish-greens-v1','sourceName':'熟萝卜叶、沥水、未加油的粗略营养估算','note':'营养与拳头重量均为AI预估，不是USDA萝卜叶实测值。默认水煮沥水、未加油；若实际是炒菜，请另计油或问AI核对。','kind':'ingredient','estimated':True}]
(root/'ai-food-estimates.json').write_text(json.dumps(extra,ensure_ascii=False,indent=2)+'\n')
rows={k:{'gramsPerFist':v[0],'minGrams':v[1],'maxGrams':v[2],'assumption':v[3],'basis':'ai_estimate','confidence':'low'} for k,v in estimates.items()}
data={'version':1,'generatedAt':'2026-10-15','generatedBy':'AI assistant pre-estimate; no live API required at lookup','method':'1 fist roughly 1 cup volume; subjective plausible ranges, not measured values or statistical confidence intervals','entries':rows}
(root/'ai-hand-portions.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print('AI portion entries',len(rows),'plus 35 sourced cup entries; extra foods',len(extra))
