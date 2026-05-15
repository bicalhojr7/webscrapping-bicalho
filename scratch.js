const str = "\\n\\u003c!DOCTYPE";
console.log("Original:", str);
const replaced = str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\n/g, '\n');
console.log("Replaced:", replaced);
