"use strict";

const improvementDocxMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const wordRelationship = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const drawingNamespace = "http://schemas.openxmlformats.org/drawingml/2006/main";
const pictureNamespace = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const xmlEntities = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" };
const xmlText = (value) => String(value ?? "")
  .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, "")
  .replace(/[&<>"']/g, (character) => xmlEntities[character]);

async function readImprovementTemplate() {
  const compressed = Uint8Array.from(atob(improvementTemplateGzip), (character) => character.charCodeAt(0));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}

const zipCrcTable = Uint32Array.from({ length:256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  return crc;
});

function packageWordDocument(parts) {
  const encoder = new TextEncoder();
  const items = Object.entries(parts);
  const local = [];
  const directory = [];
  let offset = 0;
  let directorySize = 0;

  for (const [path, value] of items) {
    const name = encoder.encode(path);
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    let crc = 0xffffffff;
    for (const byte of bytes) crc = (crc >>> 8) ^ zipCrcTable[(crc ^ byte) & 0xff];
    crc = (crc ^ 0xffffffff) >>> 0;

    // ZIP uses a local header for each file and a central directory at the end.
    const header = new DataView(new ArrayBuffer(30));
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true);
    header.setUint16(12, 0x21, true);
    header.setUint32(14, crc, true);
    header.setUint32(18, bytes.length, true);
    header.setUint32(22, bytes.length, true);
    header.setUint16(26, name.length, true);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    new Uint8Array(entry.buffer).set(new Uint8Array(header.buffer, 4, 26), 6);
    entry.setUint32(42, offset, true);
    local.push(header.buffer, name, bytes);
    directory.push(entry.buffer, name);
    offset += header.byteLength + name.length + bytes.length;
    directorySize += entry.byteLength + name.length;
  }

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, items.length, true);
  end.setUint16(10, items.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);
  return new Blob([...local, ...directory, end.buffer], { type:improvementDocxMime });
}

async function improvementPhoto(photo, date) {
  if (!/^data:image\/(?:jpeg|png|gif|webp);base64,/i.test(photo.url)) {
    throw new Error("有一張照片無法讀取，請重新選擇照片。");
  }
  const source = await fetch(photo.url);
  const bitmap = await createImageBitmap(await source.blob());
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha:false });
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (date) {
      const shortEdge = Math.min(canvas.width, canvas.height);
      const inset = Math.max(1, Math.round(shortEdge * 0.025));
      const fontSize = Math.min(shortEdge / 4, Math.max(18, Math.round(shortEdge * 0.069)));
      const stamp = date.replaceAll("-", "/");
      const x = canvas.width - inset;
      const y = canvas.height - inset;
      const maxWidth = Math.max(1, canvas.width - 2 * inset);
      context.font = `bold ${fontSize}px Arial`;
      context.textAlign = "right";
      context.textBaseline = "bottom";
      context.lineJoin = "round";
      context.lineWidth = Math.max(1, fontSize * 0.12);
      context.strokeStyle = "#332700";
      context.fillStyle = "#ffe100";
      context.strokeText(stamp, x, y, maxWidth);
      context.fillText(stamp, x, y, maxWidth);
    }
    const image = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!image) throw new Error("有一張照片無法轉成 Word 可使用的格式。");
    return { bytes:new Uint8Array(await image.arrayBuffer()), width:canvas.width, height:canvas.height };
  } finally {
    bitmap.close();
  }
}

function improvementParagraph(text, { centered = false, heading = false, keepNext = false, pageBreak = false } = {}) {
  const properties = `${keepNext ? "<w:keepNext/>" : ""}${pageBreak ? "<w:pageBreakBefore/>" : ""}` +
    `<w:snapToGrid w:val="0"/><w:spacing w:after="${centered ? 40 : 100}" w:line="285" w:lineRule="auto"/>${centered ? '<w:jc w:val="center"/>' : ""}`;
  const lines = xmlText(text).replace(/\r\n?/g, "\n").replaceAll("\n", '</w:t><w:br/><w:t xml:space="preserve">');
  return `<w:p><w:pPr>${properties}</w:pPr><w:r><w:rPr><w:rFonts w:ascii="標楷體" w:eastAsia="標楷體" w:hAnsi="標楷體"/>${heading ? "<w:b/>" : ""}<w:sz w:val="${heading ? 32 : 24}"/></w:rPr><w:t xml:space="preserve">${lines}</w:t></w:r></w:p>`;
}

function improvementDrawing(photo, { id, rel, photoFrame }) {
  // The template's photo column is 6202 twips wide, with 28 twips of padding on each side.
  const maxWidth = photoFrame ? (6202 - 56) * photoFrame.widthFraction * 635 : 6.1 * 914400;
  const maxHeight = photoFrame ? photoFrame.rowHeight * photoFrame.heightFraction * 635 : 3.25 * 914400;
  const scale = Math.min(maxWidth / photo.width, maxHeight / photo.height);
  const width = Math.round(photo.width * scale);
  const height = Math.round(photo.height * scale);
  const name = `Photo ${id}`;
  const description = xmlText(photo.name);
  return `<w:p><w:pPr><w:snapToGrid w:val="0"/><w:spacing w:after="60"/><w:jc w:val="center"/></w:pPr><w:r><w:drawing>
    <wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${id}" name="${name}" descr="${description}"/>
      <a:graphic xmlns:a="${drawingNamespace}"><a:graphicData uri="${pictureNamespace}"><pic:pic xmlns:pic="${pictureNamespace}">
        <pic:nvPicPr><pic:cNvPr id="0" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr>
        <pic:blipFill><a:blip xmlns:r="${wordRelationship}" r:embed="${rel}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
        <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
      </pic:pic></a:graphicData></a:graphic>
    </wp:inline></w:drawing></w:r></w:p>`;
}

async function createImprovementDocument(record, projectName) {
  const parts = await readImprovementTemplate();
  const passedReview = [...record.reviews].reverse().find((review) => review.passed);
  const stages = [
    { key:"BEFORE", label:"改善前（缺失事項）", text:[record.title, record.location, record.notes].filter(Boolean).join("\n"),
      photos:record.before, date:record.date, photoFrame:{ rowHeight:3807, widthFraction:0.8, heightFraction:0.8 } },
    { key:"DURING", label:"改善中", text:record.duringNotes,
      photos:record.during ?? [], date:record.duringDate, photoFrame:{ rowHeight:4623, widthFraction:0.94, heightFraction:0.89 } },
    { key:"AFTER", label:"改善後", text:record.afterNotes || (passedReview?.notes ? `複查說明：${passedReview.notes}` : ""),
      photos:record.after, date:record.afterDate, photoFrame:{ rowHeight:4492, widthFraction:0.94, heightFraction:0.89 } },
  ];
  const replacements = { PROJECT:xmlText(`工程名稱：${projectName}`) };
  const relationships = [];
  const appendix = [];
  for (const stage of stages) {
    const text = stage.text?.trim() ?? "";
    const summary = Array.from(text.replace(/\s+/g, " "));
    const long = summary.length > 112;
    replacements[`${stage.key}_TEXT`] = xmlText(`${stage.label}：${long ? `${summary.slice(0, 104).join("")}…（詳附頁）` : summary.join("") || "尚未填寫"}`);

    if (long || stage.photos.length > 1) {
      appendix.push(improvementParagraph(stage.label, { heading:true, keepNext:true }));
      if (long) appendix.push(improvementParagraph(text));
    }
    let tablePhoto = stage.photos.length ? "" : improvementParagraph("尚無照片", { centered:true });
    for (const [index, photo] of stage.photos.entries()) {
      const date = stage.key === "BEFORE" ? stage.date : photo.date ?? stage.date;
      const image = await improvementPhoto(photo, date);
      const imageNumber = relationships.length + 1;
      const rel = `rIdImprovement${imageNumber}`;
      const path = `media/improvement-${imageNumber}.jpg`;
      parts[`word/${path}`] = image.bytes;
      relationships.push(`<Relationship Id="${rel}" Type="${wordRelationship}/image" Target="${path}"/>`);
      const drawing = improvementDrawing({ ...image, name:photo.name }, {
        id:200000 + imageNumber, rel, photoFrame:index === 0 ? stage.photoFrame : undefined,
      });
      if (index === 0) tablePhoto += drawing;
      else appendix.push(improvementParagraph(`${stage.label}照片 ${index + 1}`, { keepNext:true }), drawing);
    }
    replacements[`${stage.key}_PHOTOS`] = tablePhoto;
  }
  replacements.APPENDIX = appendix.length ? improvementParagraph("改善說明及照片附頁", { heading:true, keepNext:true, pageBreak:true }) + appendix.join("") : "";
  parts["word/document.xml"] = parts["word/document.xml"].replace(/\{\{(\w+)\}\}|<!--(\w+)-->/g,
    (match, textSlot, blockSlot) => replacements[textSlot ?? blockSlot] ?? match);
  parts["word/_rels/document.xml.rels"] = parts["word/_rels/document.xml.rels"].replace("<!--IMAGE_RELATIONSHIPS-->", () => relationships.join(""));
  return packageWordDocument(parts);
}
