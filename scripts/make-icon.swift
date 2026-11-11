// Draws Captionshaper's app icon (1024x1024 PNG): violet-to-black gradient, white speech bubble with caption lines.
import AppKit
let size: CGFloat = 1024
let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()
let ctx = NSGraphicsContext.current!.cgContext
let inset: CGFloat = 100
let rect = CGRect(x: inset, y: inset, width: size - inset * 2, height: size - inset * 2)
let path = CGPath(roundedRect: rect, cornerWidth: 190, cornerHeight: 190, transform: nil)
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 40, color: NSColor(white: 0, alpha: 0.35).cgColor)
ctx.addPath(path); ctx.setFillColor(NSColor.black.cgColor); ctx.fillPath()
ctx.restoreGState()
ctx.saveGState()
ctx.addPath(path); ctx.clip()
let cs = CGColorSpaceCreateDeviceRGB()
let g = CGGradient(colorsSpace: cs, colors: [
  NSColor(red: 0.66, green: 0.50, blue: 1.0, alpha: 1).cgColor,
  NSColor(red: 0.42, green: 0.20, blue: 0.86, alpha: 1).cgColor,
  NSColor(red: 0.09, green: 0.05, blue: 0.16, alpha: 1).cgColor] as CFArray, locations: [0, 0.5, 1])!
ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: size - inset), end: CGPoint(x: 0, y: inset), options: [])
let glow = CGGradient(colorsSpace: cs, colors: [NSColor(white: 1, alpha: 0.30).cgColor, NSColor(white: 1, alpha: 0).cgColor] as CFArray, locations: [0, 1])!
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: size/2, y: size*0.58), startRadius: 0, endCenter: CGPoint(x: size/2, y: size*0.58), endRadius: 340, options: [])
ctx.restoreGState()
// Speech bubble
ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -10), blur: 24, color: NSColor(red: 0.10, green: 0.0, blue: 0.25, alpha: 0.5).cgColor)
ctx.setFillColor(NSColor.white.cgColor)
let b = CGMutablePath()
b.addRoundedRect(in: CGRect(x: 232, y: 370, width: 560, height: 360), cornerWidth: 90, cornerHeight: 90)
b.move(to: CGPoint(x: 330, y: 400))
b.addLine(to: CGPoint(x: 300, y: 285))
b.addLine(to: CGPoint(x: 440, y: 380))
b.closeSubpath()
ctx.addPath(b); ctx.fillPath()
ctx.restoreGState()
// Caption lines
let ink = NSColor(red: 0.07, green: 0.05, blue: 0.11, alpha: 1).cgColor
ctx.setFillColor(ink)
ctx.addPath(CGPath(roundedRect: CGRect(x: 322, y: 572, width: 380, height: 54), cornerWidth: 27, cornerHeight: 27, transform: nil)); ctx.fillPath()
ctx.setFillColor(NSColor(red: 0.55, green: 0.36, blue: 0.96, alpha: 1).cgColor)
ctx.addPath(CGPath(roundedRect: CGRect(x: 322, y: 474, width: 150, height: 54), cornerWidth: 27, cornerHeight: 27, transform: nil)); ctx.fillPath()
ctx.setFillColor(ink)
ctx.addPath(CGPath(roundedRect: CGRect(x: 494, y: 474, width: 208, height: 54), cornerWidth: 27, cornerHeight: 27, transform: nil)); ctx.fillPath()
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
let png = rep.representation(using: .png, properties: [:])!
try! png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
