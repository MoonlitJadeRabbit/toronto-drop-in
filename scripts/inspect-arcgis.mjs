const featureUrl =
  "https://services3.arcgis.com/b9WvedVPoizGfvfD/arcgis/rest/services/COT_Sports_Drop_In_View/FeatureServer/0/query" +
  "?f=json" +
  "&where=show_on_sports_map%20%3D%20%27Yes%27" +
  "&returnGeometry=false" +
  "&outFields=*" +
  "&resultOffset=0" +
  "&resultRecordCount=1";

const j = await fetch(featureUrl).then((r) => r.json());
const a = j?.features?.[0]?.attributes ?? {};
console.log(JSON.stringify({ keys: Object.keys(a).slice(0, 40), sample: a }, null, 2));

