"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/available-typed-arrays";
exports.ids = ["vendor-chunks/available-typed-arrays"];
exports.modules = {

/***/ "(ssr)/./node_modules/available-typed-arrays/index.js":
/*!******************************************************!*\
  !*** ./node_modules/available-typed-arrays/index.js ***!
  \******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar possibleNames = __webpack_require__(/*! possible-typed-array-names */ \"(ssr)/./node_modules/possible-typed-array-names/index.js\");\n\nvar g = typeof globalThis === 'undefined' ? global : globalThis;\n\n/** @type {import('.')} */\nmodule.exports = function availableTypedArrays() {\n\tvar /** @type {ReturnType<typeof availableTypedArrays>} */ out = [];\n\tfor (var i = 0; i < possibleNames.length; i++) {\n\t\tif (typeof g[possibleNames[i]] === 'function') {\n\t\t\t// @ts-expect-error\n\t\t\tout[out.length] = possibleNames[i];\n\t\t}\n\t}\n\treturn out;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvYXZhaWxhYmxlLXR5cGVkLWFycmF5cy9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBYTs7QUFFYixvQkFBb0IsbUJBQU8sQ0FBQyw0RkFBNEI7O0FBRXhEOztBQUVBLFdBQVcsYUFBYTtBQUN4QjtBQUNBLGdCQUFnQix5Q0FBeUM7QUFDekQsaUJBQWlCLDBCQUEwQjtBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsid2VicGFjazovL2FyY2EtZGVmaS1hcHAvLi9ub2RlX21vZHVsZXMvYXZhaWxhYmxlLXR5cGVkLWFycmF5cy9pbmRleC5qcz9iZWYxIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIHBvc3NpYmxlTmFtZXMgPSByZXF1aXJlKCdwb3NzaWJsZS10eXBlZC1hcnJheS1uYW1lcycpO1xuXG52YXIgZyA9IHR5cGVvZiBnbG9iYWxUaGlzID09PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IGdsb2JhbFRoaXM7XG5cbi8qKiBAdHlwZSB7aW1wb3J0KCcuJyl9ICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGF2YWlsYWJsZVR5cGVkQXJyYXlzKCkge1xuXHR2YXIgLyoqIEB0eXBlIHtSZXR1cm5UeXBlPHR5cGVvZiBhdmFpbGFibGVUeXBlZEFycmF5cz59ICovIG91dCA9IFtdO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHBvc3NpYmxlTmFtZXMubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAodHlwZW9mIGdbcG9zc2libGVOYW1lc1tpXV0gPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdC8vIEB0cy1leHBlY3QtZXJyb3Jcblx0XHRcdG91dFtvdXQubGVuZ3RoXSA9IHBvc3NpYmxlTmFtZXNbaV07XG5cdFx0fVxuXHR9XG5cdHJldHVybiBvdXQ7XG59O1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/available-typed-arrays/index.js\n");

/***/ })

};
;