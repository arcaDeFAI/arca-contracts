"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/has-property-descriptors";
exports.ids = ["vendor-chunks/has-property-descriptors"];
exports.modules = {

/***/ "(ssr)/./node_modules/has-property-descriptors/index.js":
/*!********************************************************!*\
  !*** ./node_modules/has-property-descriptors/index.js ***!
  \********************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar $defineProperty = __webpack_require__(/*! es-define-property */ \"(ssr)/./node_modules/es-define-property/index.js\");\n\nvar hasPropertyDescriptors = function hasPropertyDescriptors() {\n\treturn !!$defineProperty;\n};\n\nhasPropertyDescriptors.hasArrayLengthDefineBug = function hasArrayLengthDefineBug() {\n\t// node v0.6 has a bug where array lengths can be Set but not Defined\n\tif (!$defineProperty) {\n\t\treturn null;\n\t}\n\ttry {\n\t\treturn $defineProperty([], 'length', { value: 1 }).length !== 1;\n\t} catch (e) {\n\t\t// In Firefox 4-22, defining length on an array throws an exception.\n\t\treturn true;\n\t}\n};\n\nmodule.exports = hasPropertyDescriptors;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvaGFzLXByb3BlcnR5LWRlc2NyaXB0b3JzL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFhOztBQUViLHNCQUFzQixtQkFBTyxDQUFDLDRFQUFvQjs7QUFFbEQ7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHlDQUF5QyxVQUFVO0FBQ25ELEdBQUc7QUFDSDtBQUNBO0FBQ0E7QUFDQTs7QUFFQSIsInNvdXJjZXMiOlsid2VicGFjazovL2FyY2EtZGVmaS1hcHAvLi9ub2RlX21vZHVsZXMvaGFzLXByb3BlcnR5LWRlc2NyaXB0b3JzL2luZGV4LmpzPzgxZGYiXSwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgJGRlZmluZVByb3BlcnR5ID0gcmVxdWlyZSgnZXMtZGVmaW5lLXByb3BlcnR5Jyk7XG5cbnZhciBoYXNQcm9wZXJ0eURlc2NyaXB0b3JzID0gZnVuY3Rpb24gaGFzUHJvcGVydHlEZXNjcmlwdG9ycygpIHtcblx0cmV0dXJuICEhJGRlZmluZVByb3BlcnR5O1xufTtcblxuaGFzUHJvcGVydHlEZXNjcmlwdG9ycy5oYXNBcnJheUxlbmd0aERlZmluZUJ1ZyA9IGZ1bmN0aW9uIGhhc0FycmF5TGVuZ3RoRGVmaW5lQnVnKCkge1xuXHQvLyBub2RlIHYwLjYgaGFzIGEgYnVnIHdoZXJlIGFycmF5IGxlbmd0aHMgY2FuIGJlIFNldCBidXQgbm90IERlZmluZWRcblx0aWYgKCEkZGVmaW5lUHJvcGVydHkpIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXHR0cnkge1xuXHRcdHJldHVybiAkZGVmaW5lUHJvcGVydHkoW10sICdsZW5ndGgnLCB7IHZhbHVlOiAxIH0pLmxlbmd0aCAhPT0gMTtcblx0fSBjYXRjaCAoZSkge1xuXHRcdC8vIEluIEZpcmVmb3ggNC0yMiwgZGVmaW5pbmcgbGVuZ3RoIG9uIGFuIGFycmF5IHRocm93cyBhbiBleGNlcHRpb24uXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gaGFzUHJvcGVydHlEZXNjcmlwdG9ycztcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/has-property-descriptors/index.js\n");

/***/ })

};
;