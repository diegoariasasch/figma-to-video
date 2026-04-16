// Frame to Video — Figma Main Thread
// Uses absoluteRenderBounds for correct positioning (handles clipping + effects)

figma.showUI(__html__, { width: 1000, height: 700, themeColors: true });

function sendLog(text) {
  console.log("[code.js] " + text);
  figma.ui.postMessage({ type: "log", message: "[main] " + text });
}

figma.ui.onmessage = async function (msg) {
  if (msg.type === "load-frame") {
    try {
      var selection = figma.currentPage.selection;
      sendLog("Selection count: " + selection.length);

      if (selection.length === 0) {
        figma.ui.postMessage({ type: "error", message: "Nothing selected. Please select a frame." });
        return;
      }
      if (selection.length > 1) {
        figma.ui.postMessage({ type: "error", message: "Multiple items selected. Select one frame." });
        return;
      }

      var node = selection[0];
      sendLog("Node type: " + node.type + ", name: " + node.name);

      var validTypes = ["FRAME", "COMPONENT", "INSTANCE", "GROUP", "SECTION"];
      if (validTypes.indexOf(node.type) === -1) {
        figma.ui.postMessage({
          type: "error",
          message: "'" + node.name + "' is type '" + node.type + "'. Select a Frame."
        });
        return;
      }

      var frame = node;
      var children = frame.children;
      if (!children || children.length === 0) {
        figma.ui.postMessage({ type: "error", message: "Frame has no children." });
        return;
      }

      // Get frame's absolute position for calculating child offsets
      var frameBB = frame.absoluteBoundingBox;
      sendLog("Frame BB: x=" + frameBB.x + " y=" + frameBB.y + " w=" + frameBB.width + " h=" + frameBB.height);

      var frameW = Math.round(frame.width);
      var frameH = Math.round(frame.height);
      sendLog("Frame: " + frame.name + " " + frameW + "x" + frameH + ", " + children.length + " children");

      // Background color
      var bgColor = "#000000";
      try {
        var fills = frame.fills;
        if (fills && fills.length > 0) {
          var fill = fills[0];
          if (fill.type === "SOLID" && fill.visible !== false) {
            var r = Math.round(fill.color.r * 255);
            var g = Math.round(fill.color.g * 255);
            var b = Math.round(fill.color.b * 255);
            bgColor = "rgb(" + r + "," + g + "," + b + ")";
          }
        }
      } catch (e) { sendLog("Fill read error: " + e.message); }

      figma.ui.postMessage({
        type: "frame-info",
        data: {
          name: frame.name,
          width: frameW,
          height: frameH,
          bgColor: bgColor,
          childCount: children.length
        }
      });

      // Export each child
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        sendLog("Export " + (i + 1) + "/" + children.length + ": " + child.name + " [" + child.type + "]");

        try {
          var bytes = await child.exportAsync({
            format: "PNG",
            constraint: { type: "SCALE", value: 2 }
          });
          sendLog("  Got " + bytes.length + " bytes");

          // Use absoluteRenderBounds for accurate position (includes effects, respects clipping)
          var arb = child.absoluteRenderBounds;
          var relX, relY, boundsW, boundsH;

          if (arb) {
            // Position relative to frame's top-left corner
            relX = arb.x - frameBB.x;
            relY = arb.y - frameBB.y;
            boundsW = arb.width;
            boundsH = arb.height;
            sendLog("  absoluteRenderBounds: x=" + relX.toFixed(1) + " y=" + relY.toFixed(1) +
                     " w=" + boundsW.toFixed(1) + " h=" + boundsH.toFixed(1));
          } else {
            // Fallback: node.x/y is relative to parent
            relX = child.x;
            relY = child.y;
            boundsW = child.width;
            boundsH = child.height;
            sendLog("  No absoluteRenderBounds, using node x/y: " + relX + "," + relY);
          }

          // Also log node's own x/y for comparison
          sendLog("  node x=" + child.x + " y=" + child.y + " w=" + child.width + " h=" + child.height);

          var isText = child.type === "TEXT";
          var textContent = "";
          if (isText) { try { textContent = child.characters; } catch (e) {} }

          figma.ui.postMessage({
            type: "element-data",
            data: {
              index: i,
              total: children.length,
              id: child.id,
              name: child.name,
              nodeType: child.type,
              // Corrected position using absoluteRenderBounds
              x: relX,
              y: relY,
              width: boundsW,
              height: boundsH,
              // Also send original node bounds for reference
              nodeX: child.x,
              nodeY: child.y,
              nodeW: child.width,
              nodeH: child.height,
              isText: isText,
              textContent: textContent,
              opacity: child.opacity !== undefined ? child.opacity : 1,
              rotation: child.rotation || 0,
              visible: child.visible !== false,
              imageBytes: Array.from(bytes)
            }
          });
          sendLog("  Sent OK");
        } catch (err) {
          sendLog("  ERROR: " + (err.message || err));
          figma.ui.postMessage({
            type: "element-error",
            data: { index: i, name: child.name, error: err.message || "Export failed" }
          });
        }
      }

      sendLog("Done. Sending load-complete.");
      figma.ui.postMessage({ type: "load-complete" });

    } catch (fatal) {
      sendLog("FATAL: " + (fatal.message || fatal));
      figma.ui.postMessage({ type: "error", message: "Fatal: " + (fatal.message || "Unknown") });
    }
  }

  if (msg.type === "close") { figma.closePlugin(); }
};

sendLog("code.js loaded.");
