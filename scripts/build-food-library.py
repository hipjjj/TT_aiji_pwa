"""Build the bundled dictionary from a pinned USDA SR28 mirror, with checksum verification.
Usage: python3 scripts/build-food-library.py [path/to/usda.sql3]
Only nutritional facts are used; household portions and recipes are explicitly estimates.
"""
import hashlib, json, sqlite3, sys, tempfile, urllib.request
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
COMMIT = '1e457b599af101ce463a195867574eba16c81acb'
SHA256 = 'ae4800c3f718bb51358b860b5ec61d0ded5572522a274cb40e7cabe9aee5544d'
URL = f'https://raw.githubusercontent.com/alyssaq/usda-sqlite/{COMMIT}/usda.sql3'
path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(tempfile.gettempdir()) / 'tt-usda-sr28.sql3'
if not path.exists():
    with urllib.request.urlopen(URL, timeout=60) as response, path.open('wb') as target:
        while block := response.read(1024 * 1024): target.write(block)
with path.open('rb') as source:
    if hashlib.file_digest(source, 'sha256').hexdigest() != SHA256: raise RuntimeError('USDA source checksum does not match; refusing to use data')
conn = sqlite3.connect(path)
if conn.execute('PRAGMA integrity_check').fetchone()[0] != 'ok': raise RuntimeError('Source database integrity failure')
foods = []
for line in (ROOT / 'scripts/food-mappings.tsv').read_text().splitlines():
    if not line or line.startswith('#'): continue
    key, name, source_id, group, aliases, unit, grams = line.split('|')
    row = conn.execute('SELECT long_desc FROM food WHERE id=?', (source_id,)).fetchone()
    if not row: raise RuntimeError(f'Missing source food: {source_id}')
    values = dict(conn.execute('SELECT nutrient_id,amount FROM nutrition WHERE food_id=? AND nutrient_id IN (203,204,205,208)',(source_id,)))
    if len(values) != 4: raise RuntimeError(f'Missing nutrient values: {source_id}')
    portions = {unit:float(grams), '份':float(grams)}
    if group == '饮品' or key in ('milk','low-fat-milk','soymilk'): portions.update({'杯':250,'盒':250})
    food = {'id':key,'name':name,'group':group,'aliases':aliases.split(','),'per100':{'kcal':values[208],'protein':values[203],'carbs':values[205],'fat':values[204]},'portions':portions,'defaultGrams':float(grams),'defaultUnit':unit,'reference':'USDA SR28','sourceId':str(source_id).zfill(5),'sourceName':row[0],'note':'每100克可食部分。生熟状态见名称；杯、碗、个等份量为参考估计，请按实际修改。','kind':'ingredient'}
    foods.append(food)
# Composition estimates, not restaurant measurements. Every ingredient links back to a sourced record.
recipes = [
 ('egg-fried-rice','蛋炒饭',['蛋炒饭','炒饭'], [('rice',200),('raw-egg',50),('peas',30),('oil',10)],290,'碗',250),
 ('tomato-egg','番茄炒蛋',['番茄炒蛋','西红柿炒鸡蛋','西红柿炒蛋'], [('tomato',200),('raw-egg',100),('oil',10)],280,'份',150),
 ('pepper-pork','青椒肉丝',['青椒肉丝'], [('raw-pork',150),('green-pepper',150),('oil',10),('soy-sauce',10)],280,'份',150),
 ('kung-pao','宫保鸡丁',['宫保鸡丁'], [('raw-chicken',180),('peanuts',30),('cucumber',100),('oil',15),('sugar',8),('soy-sauce',15)],300,'份',150),
 ('mapo-tofu','麻婆豆腐',['麻婆豆腐'], [('tofu',250),('raw-pork',50),('oil',15),('soy-sauce',15),('water',50)],360,'份',150),
 ('chicken-rice','鸡肉饭',['鸡肉饭','鸡胸肉饭'], [('rice',200),('chicken',100),('broccoli',80),('oil',5)],385,'份',300),
 ('beef-noodles','牛肉面',['牛肉面'], [('egg-noodles',200),('beef',80),('bok-choy',50),('oil',5),('water',200)],535,'碗',500),
 ('tomato-egg-noodles','西红柿鸡蛋面',['西红柿鸡蛋面','番茄鸡蛋面'], [('egg-noodles',200),('tomato',100),('raw-egg',50),('oil',5),('water',150)],480,'碗',450),
 ('stir-broccoli','清炒西兰花',['清炒西兰花','炒西兰花'], [('broccoli',200),('oil',10)],210,'份',150),
 ('stir-greens','清炒小白菜',['清炒小白菜','炒青菜','清炒青菜'], [('bok-choy',200),('oil',10)],210,'份',150),
 ('stir-spinach','清炒菠菜',['清炒菠菜','炒菠菜'], [('spinach',200),('oil',10)],210,'份',150),
 ('potato-strips','酸辣土豆丝',['酸辣土豆丝','炒土豆丝'], [('potato',200),('green-pepper',40),('oil',10)],250,'份',150),
 ('fried-eggplant','炒茄子',['炒茄子'], [('eggplant',200),('oil',20),('soy-sauce',10)],230,'份',150),
 ('dumplings','猪肉白菜饺子',['饺子','水饺','猪肉白菜饺子'], [('flour',100),('raw-pork',100),('napa',100),('oil',5),('water',100)],380,'个',25),
 ('wonton','猪肉馄饨（含汤）',['馄饨','云吞'], [('flour',70),('raw-pork',80),('water',300),('soy-sauce',10)],450,'碗',300),
 ('steamed-bun','馒头',['馒头','白馒头'], [('flour',100),('water',60),('sugar',2)],160,'个',80),
 ('pork-bun','猪肉包子',['肉包子','猪肉包子','包子'], [('flour',100),('raw-pork',80),('napa',50),('oil',5),('water',70)],280,'个',100),
 ('rice-congee','白米粥',['白米粥','白粥','大米粥'], [('rice-dry',40),('water',360)],400,'碗',250),
 ('millet-congee','小米粥',['小米粥'], [('millet-dry',40),('water',360)],400,'碗',250),
 ('oats-milk','牛奶燕麦粥',['牛奶燕麦粥','牛奶燕麦'], [('oats-dry',40),('milk',250)],290,'碗',250),
 ('chicken-salad','鸡胸肉沙拉',['鸡胸肉沙拉'], [('chicken',100),('lettuce',100),('tomato',100),('oil',10)],310,'份',300),
 ('egg-sandwich','鸡蛋三明治',['鸡蛋三明治'], [('white-bread',60),('egg',50),('lettuce',20)],130,'个',130),
 ('banana-milk','香蕉牛奶',['香蕉牛奶'], [('banana',100),('milk',250)],350,'杯',250),
 ('tofu-soup','豆腐青菜汤',['豆腐青菜汤','青菜豆腐汤'], [('soft-tofu',100),('bok-choy',100),('water',250),('oil',3)],450,'碗',250),
 ('shrimp-rice','虾仁炒饭',['虾仁炒饭'], [('rice',200),('shrimp',80),('raw-egg',50),('peas',30),('oil',10)],360,'碗',250),
]
lookup = {f['id']:f for f in foods}
for key,name,aliases,ingredients,yield_grams,unit,portion in recipes:
    per100 = {k:float((sum(Decimal(str(lookup[f]['per100'][k]))*Decimal(g) for f,g in ingredients)/Decimal(yield_grams)).quantize(Decimal('0.01'),rounding=ROUND_HALF_UP)) for k in ('kcal','protein','carbs','fat')}
    foods.append({'id':key,'name':name+'（参考配方）','group':'中餐菜品','aliases':aliases,'per100':per100,'portions':{unit:portion,'份':portion},'defaultGrams':portion,'defaultUnit':unit,'reference':'USDA SR28 食材组合估算','sourceId':key,'sourceName':name,'note':'参考配方，并非餐馆实测。油量、食材比例和出品重量会改变营养，请确认或编辑；不含未列出的调料。','kind':'recipe','ingredients':[{'foodId':f,'grams':g} for f,g in ingredients],'yieldGrams':yield_grams})
assert len(foods) >= 100
assert len({f['id'] for f in foods}) == len(foods)
aliases={}
for food in foods:
    for alias in [food['name'],*food['aliases']]:
        if alias in aliases and aliases[alias]!=food['id']: raise RuntimeError('Ambiguous alias: '+alias)
        aliases[alias]=food['id']
(ROOT / 'src/nutrition/foods.json').write_text(json.dumps(foods,ensure_ascii=False,indent=2)+'\n')
print(f'Generated {len(foods)} foods, including {len(recipes)} explicitly labeled reference recipes')

# Fist estimates use the visual convention 1 fist ~= 1 cup, then the SAME food's
# USDA household weight. Deliberately exclude foods without a comparable cup row.
hand_ids = ['rice','brown-rice','sticky-rice','corn','oatmeal','potato','baked-sweet-potato','egg-noodles','rice-noodles','quinoa','chicken','roast-chicken','duck','tofu','soft-tofu','edamame','mung-beans','lentils','chickpeas','broccoli','raw-broccoli','bok-choy','napa','spinach','raw-spinach','cucumber','eggplant','raw-eggplant','cooked-tomato','mushroom','shiitake','peas','cooked-pepper','lettuce','zucchini']
hand_portions = {}
for key in hand_ids:
    food = next(f for f in foods if f['id'] == key)
    rows = conn.execute("SELECT amount,description,gm_weight FROM weight WHERE food_id=? AND lower(description) LIKE 'cup%' ORDER BY CASE WHEN description='cup' THEN 0 ELSE 1 END, sequence_num", (int(food['sourceId']),)).fetchall()
    if not rows: raise RuntimeError(f'Missing cup reference for {key}')
    amount, description, grams = rows[0]
    hand_portions[key] = {'gramsPerFist': round(grams / amount, 2), 'sourceId': food['sourceId'], 'cupDescription': description, 'sourceAmount': amount, 'sourceGrams': grams}
(ROOT / 'src/nutrition/hand-portions.json').write_text(json.dumps(hand_portions,ensure_ascii=False,indent=2)+'\n')
