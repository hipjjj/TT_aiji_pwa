# Overseas footprint map

`public/travel-maps/world.json` is an offline snapshot prepared on 2026-11-19.
It contains 177 simplified geographic features and 250 country/region reference
points. The map is an overview for travel memories, not a navigation map.

- Country geometry: [Natural Earth, 1:110m Admin 0 countries](https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson), [public domain](https://www.naturalearthdata.com/about/terms-of-use/).
- Reference points: the `cca2` and `latlng` columns in [mledoze/countries CSV](https://github.com/mledoze/countries/blob/master/dist/countries.csv), [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/). This derived point database is available under ODbL 1.0.

Geometry retains the source polygon rings, rounded to three decimal places.
`ISO_A2_EH` joins geometry to the existing overseas country codes. Reference
points provide a selectable dot for destinations too small for the overview
geometry. Background regions outside the app's overseas destination catalog
remain noninteractive; domestic footprints continue to use the existing map.

The map uses the existing `overseasFootprints` calculation, so only completed
trips light up countries and cities. Viewing a country or opening a new trip
does not save a record. Existing records, photos, backup format and database
schema are unchanged. The service worker precaches the JSON with the other
travel maps.
