// Frame to Video — Figma Main Thread
// Supports a single frame OR a Section containing many sibling frames as "variants".

figma.showUI(__html__, { width: 1200, height: 720, themeColors: true });

var FRAME_TYPES = ["FRAME", "COMPONENT", "INSTANCE", "GROUP"];

function sendLog(text) {
  console.log("[code.js] " + text);
  figma.ui.postMessage({ type: "log", message: "[main] " + text });
}

function sendError(message) {
  figma.ui.postMessage({ type: "error", message: message });
}

function readBgColor(node) {
  try {
    var fills = node.fills;
    if (fills && fills.length > 0) {
      var fill = fills[0];
      if (fill.type === "SOLID" && fill.visible !== false) {
        var r = Math.round(fill.color.r * 255);
        var g = Math.round(fill.color.g * 255);
        var b = Math.round(fill.color.b * 255);
        return "rgb(" + r + "," + g + "," + b + ")";
      }
    }
  } catch (e) { sendLog("Fill read error: " + e.message); }
  return "#000000";
}

async function exportFrameChildren(frame, frameIndex, frameTotal) {
  var frameBB = frame.absoluteBoundingBox;
  var frameW = Math.round(frame.width);
  var frameH = Math.round(frame.height);
  var children = frame.children || [];

  sendLog("Frame " + (frameIndex + 1) + "/" + frameTotal + ": " + frame.name + " " + frameW + "x" + frameH + ", " + children.length + " children");

  figma.ui.postMessage({
    type: "frame-start",
    data: {
      frameId: frame.id,
      frameIndex: frameIndex,
      frameTotal: frameTotal,
      name: frame.name,
      width: frameW,
      height: frameH,
      bgColor: readBgColor(frame),
      childCount: children.length
    }
  });

  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    sendLog("  Export " + (i + 1) + "/" + children.length + ": " + child.name + " [" + child.type + "]");

    try {
      var bytes = await child.exportAsync({
        format: "PNG",
        constraint: { type: "SCALE", value: 2 }
      });

      var arb = child.absoluteRenderBounds;
      var relX, relY, boundsW, boundsH;
      if (arb) {
        relX = arb.x - frameBB.x;
        relY = arb.y - frameBB.y;
        boundsW = arb.width;
        boundsH = arb.height;
      } else {
        relX = child.x; relY = child.y; boundsW = child.width; boundsH = child.height;
      }

      var isText = child.type === "TEXT";
      var textContent = "";
      var lines = null;
      if (isText) {
        try { textContent = child.characters; } catch (e) {}
        if (textContent) {
          // Handle CRLF, CR, LF, Unicode line separator, Unicode paragraph separator.
          var sep = /\r\n|\r|\n|\u2028|\u2029/;
          if (sep.test(textContent)) {
            lines = textContent.split(sep);
            sendLog("  text '" + child.name + "' has " + lines.length + " lines (per-line animation available)");
          } else {
            sendLog("  text '" + child.name + "' is single-line in Figma's data. If it wraps visually, press Enter between lines to enable per-line animation.");
          }
        }
      }

      figma.ui.postMessage({
        type: "element-data",
        data: {
          frameId: frame.id,
          frameIndex: frameIndex,
          index: i,
          total: children.length,
          id: child.id,
          name: child.name,
          nodeType: child.type,
          x: relX, y: relY, width: boundsW, height: boundsH,
          nodeX: child.x, nodeY: child.y, nodeW: child.width, nodeH: child.height,
          isText: isText,
          textContent: textContent,
          lines: lines,
          opacity: child.opacity !== undefined ? child.opacity : 1,
          rotation: child.rotation || 0,
          visible: child.visible !== false,
          imageBytes: Array.from(bytes)
        }
      });
    } catch (err) {
      sendLog("  ERROR: " + (err.message || err));
      figma.ui.postMessage({
        type: "element-error",
        data: { frameId: frame.id, frameIndex: frameIndex, index: i, name: child.name, error: err.message || "Export failed" }
      });
    }
  }

  figma.ui.postMessage({
    type: "frame-end",
    data: { frameId: frame.id, frameIndex: frameIndex }
  });
}

figma.ui.onmessage = async function (msg) {
  if (msg.type === "load-frame") {
    try {
      var selection = figma.currentPage.selection;
      sendLog("Selection count: " + selection.length);

      if (selection.length === 0) { sendError("Nothing selected. Select a Section or Frame."); return; }
      if (selection.length > 1) { sendError("Multiple items selected. Select one Section or Frame."); return; }

      var node = selection[0];
      sendLog("Node type: " + node.type + ", name: " + node.name);

      var frames = [];
      var sectionName = "";

      if (node.type === "SECTION") {
        sectionName = node.name;
        var secChildren = node.children || [];
        for (var si = 0; si < secChildren.length; si++) {
          if (FRAME_TYPES.indexOf(secChildren[si].type) !== -1) frames.push(secChildren[si]);
        }
        if (frames.length === 0) { sendError("Section '" + node.name + "' has no frame children."); return; }
      } else if (FRAME_TYPES.indexOf(node.type) !== -1) {
        frames.push(node);
      } else {
        sendError("'" + node.name + "' is type '" + node.type + "'. Select a Section or Frame.");
        return;
      }

      var sectionSummary = [];
      for (var fi = 0; fi < frames.length; fi++) {
        var f = frames[fi];
        sectionSummary.push({
          id: f.id,
          name: f.name,
          width: Math.round(f.width),
          height: Math.round(f.height),
          bgColor: readBgColor(f)
        });
      }

      figma.ui.postMessage({
        type: "section-info",
        data: { sectionName: sectionName, frames: sectionSummary }
      });

      for (var j = 0; j < frames.length; j++) {
        if (!frames[j].children || frames[j].children.length === 0) {
          sendLog("Frame '" + frames[j].name + "' has no children, skipping.");
          figma.ui.postMessage({
            type: "frame-start",
            data: {
              frameId: frames[j].id, frameIndex: j, frameTotal: frames.length,
              name: frames[j].name, width: Math.round(frames[j].width), height: Math.round(frames[j].height),
              bgColor: readBgColor(frames[j]), childCount: 0
            }
          });
          figma.ui.postMessage({ type: "frame-end", data: { frameId: frames[j].id, frameIndex: j } });
          continue;
        }
        await exportFrameChildren(frames[j], j, frames.length);
      }

      sendLog("Done. Sending load-complete.");
      figma.ui.postMessage({ type: "load-complete" });

    } catch (fatal) {
      sendLog("FATAL: " + (fatal.message || fatal));
      sendError("Fatal: " + (fatal.message || "Unknown"));
    }
  }

  if (msg.type === "close") { figma.closePlugin(); }
};

sendLog("code.js loaded.");
