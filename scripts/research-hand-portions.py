"""Fetch public nutrition guidance for review; never reads app records or secrets."""
import concurrent.futures, html, re, urllib.request
URLS = [
 'https://medlineplus.gov/ency/patientinstructions/000337.htm',
 'https://www.cdc.gov/diabetes/healthy-eating/meal-planning-methods.html',
 'https://www.diabetes.org.uk/living-with-diabetes/eating/portion-sizes',
 'https://www.bhf.org.uk/informationsupport/heart-matters-magazine/nutrition/weight/portion-sizes',
 'https://www.precisionnutrition.com/hand-portion-faq',
 'https://www.nutrition.org.uk/healthy-sustainable-diets/portion-sizes/',
]
def fetch(url):
 try:
  request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
  response=urllib.request.urlopen(request,timeout=20)
  raw=response.read(3000000).decode('utf-8',errors='replace')
  raw=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',raw,flags=re.S|re.I)
  text=re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',raw)))
  pieces=[text[max(0,m.start()-150):m.end()+500] for m in list(re.finditer(r'\bfist\b|\bfists\b|\bcup\b',text,re.I))[:8]]
  message=url+' | '+(' || '.join(pieces) or 'No fist/cup text found')
 except Exception as error:message=url+' | '+str(error)
 # Annotation API lets the environment review evidence without fetching workflow log archives.
 print('::notice title=Hand portion source::'+message.replace('%','%25').replace('\r','%0D').replace('\n','%0A'))
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(fetch,URLS))
