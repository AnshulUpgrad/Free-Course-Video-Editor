/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideWebpackConfig(enableTailwind);

// Speed Up Optimizations
Config.setCodec("h264");
Config.setX264Preset("veryfast");
Config.setChromiumOpenGlRenderer("angle");
Config.setHardwareAcceleration("if-possible");

