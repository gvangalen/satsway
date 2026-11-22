const { withXcodeProject } = require("@expo/config-plugins");

// Expo's generated bundle phase executes a Node-resolved path through unquoted
// backticks. That breaks when the checkout path contains spaces.
module.exports = function withQuotedIosBundleScript(config) {
  return withXcodeProject(config, (projectConfig) => {
    const phases = projectConfig.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    const phase = Object.values(phases).find(
      (entry) => entry && entry.name === '"Bundle React Native code and images"'
    );
    if (!phase) throw new Error("iOS bundle build phase was not found");

    const script = phase.shellScript;
    const start = script.indexOf('`\\"$NODE_BINARY');
    const end = script.indexOf("`", start + 1);
    if (start < 0 || end < 0) {
      throw new Error("Unexpected iOS bundle build phase format");
    }

    const quotedCommand = [
      'RN_SCRIPT_PATH="$("$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'")"',
      '"$RN_SCRIPT_PATH"',
    ].join("\n");
    const encodedCommand = JSON.stringify(quotedCommand).slice(1, -1);
    phase.shellScript = script.slice(0, start) + encodedCommand + script.slice(end + 1);
    return projectConfig;
  });
};
