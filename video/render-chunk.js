const { renderMediaOnCloudrun } = require("@remotion/cloudrun/client");
const fs = require("fs");

// CLI argument parser
const args = {};
process.argv.slice(2).forEach(val => {
  const parts = val.split('=');
  if (parts.length === 2 && parts[0].startsWith('--')) {
    args[parts[0].substring(2)] = parts[1];
  }
});

const composition = args.composition || "Showcase";
const propsPath = args.props;
const startFrame = parseInt(args.start, 10);
const endFrame = parseInt(args.end, 10);
const serveUrl = args.serveUrl;
const serviceName = args.service;
const region = args.region;
const outName = args.out;

if (!propsPath || isNaN(startFrame) || isNaN(endFrame) || !serveUrl || !serviceName || !region || !outName) {
  console.error("Missing required arguments. Usage: node render-chunk.js --props=<path> --start=<frame> --end=<frame> --serveUrl=<url> --service=<name> --region=<region> --out=<name>");
  process.exit(1);
}

async function run() {
  try {
    const inputProps = JSON.parse(fs.readFileSync(propsPath, "utf8"));
    
    console.log(`Triggering Cloud Run render for composition: ${composition}, frames: [${startFrame}, ${endFrame}]...`);
    
    const result = await renderMediaOnCloudrun({
      region,
      serviceName,
      composition,
      serveUrl,
      inputProps,
      codec: "h264",
      x264Preset: "superfast",
      audioCodec: "aac",
      frameRange: [startFrame, endFrame],
      outName,
      privacy: "public",
      // Force video-only chunk rendering for speed (we merge audio later)
      muted: true,
      chromiumOptions: {
        gl: "swangle"
      }
    });
    
    if (result.type === 'success') {
      console.log("RENDER_SUCCESS_URL=" + result.publicUrl);
    } else {
      console.error("Cloud Run render crashed:", result);
      process.exit(1);
    }
  } catch (err) {
    console.error("Render failed:", err);
    process.exit(1);
  }
}

run();
