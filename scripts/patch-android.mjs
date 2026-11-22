import fs from "node:fs";

const manifestPath = "android/app/src/main/AndroidManifest.xml";

if (!fs.existsSync(manifestPath)) {
  console.error(`Erreur: manifeste Android absent: ${manifestPath}`);
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, "utf8");
const permissions = [
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
];
const feature = '<uses-feature android:name="android.hardware.location.gps" android:required="false" />';

for (const entry of [...permissions, feature]) {
  if (!xml.includes(entry)) {
    xml = xml.replace("<application>", `${entry}\n    <application>`);
  }
}

fs.writeFileSync(manifestPath, xml, "utf8");
console.log("Manifest Android patché avec les permissions de géolocalisation.");
