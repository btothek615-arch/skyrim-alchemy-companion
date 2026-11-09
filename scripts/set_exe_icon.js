// Embed assets/icon.ico into the packaged Windows .exe without wine (pure-JS PE resource editing via resedit).
const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

const exe = process.argv[2] || path.join(__dirname, '..', 'dist', 'Skyrim Alchemy Companion-win32-x64', 'Skyrim Alchemy Companion.exe');
const ico = process.argv[3] || path.join(__dirname, '..', 'assets', 'icon.ico');

const data = fs.readFileSync(exe);
const pe = ResEdit.NtExecutable.from(data, { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(pe);
const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(ico));

// Replace the existing main icon group (Electron ships group id 1) or create it.
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const groupId = groups.length ? groups[0].id : 1;
const lang = groups.length ? groups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groupId, lang, iconFile.icons.map((i) => i.data));

// Product metadata
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
if (vi) {
  const l = { lang: 1033, codepage: 1200 };
  vi.setStringValues(l, { FileDescription: 'Skyrim Alchemy Companion', ProductName: 'Skyrim Alchemy Companion', CompanyName: 'Skyrim Alchemy Companion' });
  vi.outputToResourceEntries(res.entries);
}
res.outputResource(pe);
fs.writeFileSync(exe, Buffer.from(pe.generate()));

// Verify by re-reading
const pe2 = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
const res2 = ResEdit.NtExecutableResource.from(pe2);
const g2 = ResEdit.Resource.IconGroupEntry.fromEntries(res2.entries);
const sizes = g2[0].icons.map((i) => (i.width || 256) + 'x' + (i.height || 256));
const iconBytes = res2.entries.filter((e) => e.type === 3).reduce((s, e) => s + e.bin.byteLength, 0);
console.log(`icon group ${g2[0].id}: ${sizes.join(', ')}; RT_ICON entries bytes=${iconBytes}`);
const want = ['16x16', '24x24', '32x32', '48x48', '64x64', '128x128', '256x256'];
if (!want.every((s) => sizes.includes(s))) { console.error('Icon verification FAILED'); process.exit(1); }
console.log('Icon verification OK');
