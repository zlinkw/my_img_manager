import fs from "node:fs";
import path from "node:path";

const [profileArg, xpiArg, addonID, version] = process.argv.slice(2);
if (!profileArg || !xpiArg || !addonID || !version) {
  console.error("usage: node scripts/register-profile-xpi.mjs <profile> <xpi> <addon-id> <version>");
  process.exit(2);
}

const profile = path.resolve(profileArg);
const xpi = path.resolve(xpiArg);
const extensionsPath = path.join(profile, "extensions.json");
const startupPath = path.join(profile, "addonStartup.json.lz4");
for (const file of [xpi, extensionsPath, startupPath]) {
  if (!fs.existsSync(file)) throw new Error(`Required file missing: ${file}`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
for (const file of [extensionsPath, startupPath]) {
  fs.copyFileSync(file, `${file}.codex-backup-${stamp}`);
}

const extensionsData = JSON.parse(fs.readFileSync(extensionsPath, "utf8"));
extensionsData.addons = (extensionsData.addons || []).filter((addon) => addon.id !== addonID);
const fileURI = `file:///${xpi.replace(/\\/g, "/").split("/").map(encodeURIComponent).join("/")}!/`;
const now = Date.now();
extensionsData.addons.push({
  id: addonID,
  syncGUID: `{${crypto.randomUUID()}}`,
  version,
  type: "extension",
  loader: null,
  manifestVersion: 2,
  optionsURL: null,
  optionsType: null,
  aboutURL: null,
  defaultLocale: null,
  visible: true,
  active: true,
  userDisabled: false,
  appDisabled: false,
  embedderDisabled: false,
  installDate: now,
  updateDate: now,
  applyBackgroundUpdates: 1,
  path: xpi,
  skinnable: false,
  sourceURI: null,
  releaseNotesURI: null,
  softDisabled: false,
  foreignInstall: false,
  strictCompatibility: true,
  locales: [],
  targetApplications: [{
    id: "zotero@zotero.org",
    minVersion: "7.0",
    maxVersion: "9.0.*",
  }],
  targetPlatforms: [],
  signedState: 0,
  signedTypes: [],
  signedDate: null,
  seen: true,
  dependencies: [],
  incognito: "spanning",
  userPermissions: { permissions: [], origins: [], data_collection: [] },
  optionalPermissions: { permissions: [], origins: [], data_collection: [] },
  requestedPermissions: { permissions: [], origins: [], data_collection: [] },
  icons: {},
  iconURL: null,
  blocklistAttentionDismissed: false,
  blocklistState: 0,
  blocklistURL: null,
  startupData: null,
  hidden: false,
  installTelemetryInfo: { source: "about:addons", method: "install-from-file" },
  recommendationState: null,
  rootURI: fileURI,
  location: "app-profile",
});
fs.writeFileSync(extensionsPath, JSON.stringify(extensionsData, null, 2), "utf8");

const startupBytes = fs.readFileSync(startupPath);
const magic = startupBytes.subarray(0, 8);
if (!magic.equals(Buffer.from("mozLz40\0", "binary"))) throw new Error("addonStartup.json.lz4 has an unknown header");
const uncompressedSize = startupBytes.readUInt32LE(8);
const startupData = JSON.parse(decompressLz4(startupBytes.subarray(12), uncompressedSize).toString("utf8"));
const profileAddons = startupData?.appProfile?.addons || startupData?.["app-profile"]?.addons;
if (!profileAddons) throw new Error("addonStartup.json.lz4 has no app-profile addons");
delete profileAddons[addonID];
profileAddons[addonID] = {
  blocklistState: 0,
  dependencies: [],
  enabled: true,
  lastModifiedTime: now,
  loader: null,
  path: path.basename(xpi),
  recommendationState: null,
  rootURI: fileURI,
  runInSafeMode: false,
  signedState: 0,
  signedDate: null,
  telemetryKey: `${encodeURIComponent(addonID)}:${version}`,
  version,
};
const serializedStartup = Buffer.from(JSON.stringify(startupData), "utf8");
fs.writeFileSync(startupPath, Buffer.concat([
  magic,
  compressLz4(serializedStartup),
]));

function decompressLz4(input, expectedSize) {
  let inputOffset = 0;
  let output = Buffer.alloc(expectedSize);
  let outputOffset = 0;
  const readExtendedLength = (value) => {
    let length = value;
    while (input[inputOffset] === 255) {
      length += 255;
      inputOffset += 1;
    }
    length += input[inputOffset];
    inputOffset += 1;
    return length;
  };
  while (inputOffset < input.length) {
    const token = input[inputOffset++];
    let literalLength = token >> 4;
    if (literalLength === 15) literalLength = readExtendedLength(literalLength);
    input.copy(output, outputOffset, inputOffset, inputOffset + literalLength);
    inputOffset += literalLength;
    outputOffset += literalLength;
    if (inputOffset >= input.length) break;
    const offset = input.readUInt16LE(inputOffset);
    inputOffset += 2;
    let matchLength = (token & 15) + 4;
    if ((token & 15) === 15) matchLength = readExtendedLength(matchLength);
    if (!offset || offset > outputOffset) throw new Error("Invalid LZ4 match offset");
    for (let index = 0; index < matchLength; index += 1) {
      output[outputOffset] = output[outputOffset - offset];
      outputOffset += 1;
    }
  }
  if (outputOffset !== expectedSize) throw new Error("LZ4 output size mismatch");
  return output.subarray(0, outputOffset);
}

function compressLz4(input) {
  const paddedInput = Buffer.concat([Buffer.alloc(32, 32), input]);
  const matchLength = 31;
  const token = (1 << 4) | 15;
  const chunks = [Buffer.from([token]), paddedInput.subarray(0, 1), Buffer.from([1, 0])];
  let remaining = matchLength - 19;
  while (remaining >= 255) {
    chunks.push(Buffer.from([255]));
    remaining -= 255;
  }
  chunks.push(Buffer.from([remaining]));
  if (remaining === 255) {
    chunks.push(Buffer.from([0]));
  }
  const trailing = paddedInput.subarray(32);
  chunks.push(Buffer.from([240]));
  let literalRemaining = trailing.length - 15;
  while (literalRemaining >= 255) {
    chunks.push(Buffer.from([255]));
    literalRemaining -= 255;
  }
  chunks.push(Buffer.from([literalRemaining]), trailing);
  if (literalRemaining === 255) {
    chunks.push(Buffer.from([0]));
  }
  const block = Buffer.concat(chunks);
  const size = Buffer.alloc(4);
  size.writeUInt32LE(paddedInput.length);
  return Buffer.concat([size, block]);
}
